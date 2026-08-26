/**
 * Admin.
 *
 * Sign-in reuses the ordinary account system rather than bolting on a second
 * one: an admin signs in exactly like a student, and their email being present
 * in the `admins` table is what grants them anything extra. One fewer login to
 * build, one fewer to compromise, and revoking someone is deleting a row.
 *
 * Every route here is behind `requireAdmin`, and anything that changes the
 * world writes to the audit log. Reads don't — an append-only table filling up
 * with "looked at a list" makes the entries that matter harder to find.
 */

import { Hono } from 'hono'

import type { Env } from '../types.ts'
import { ApiError, clientIp } from '../lib/http.ts'
import { readToken, resolveSession } from '../lib/session.ts'
import * as audit from '../lib/audit.ts'

type Admin = { id: string; email: string; role: string; registrationId: string }

export const admin = new Hono<{ Bindings: Env; Variables: { admin: Admin } }>()

/** Roles allowed to change money or revoke access. */
const PRIVILEGED = new Set(['superadmin', 'core', 'finance'])

admin.use('/admin/*', async (c, next) => {
  const session = await resolveSession(c.env, readToken(c.req.raw.headers))
  if (!session) throw new ApiError('unauthorised', 'Sign in first.')

  const row = await c.env.DB.prepare(
    'SELECT id, email, role FROM admins WHERE lower(email) = ? AND active = 1',
  )
    .bind(session.email.toLowerCase())
    .first<{ id: string; email: string; role: string }>()

  // Deliberately the same message a signed-out visitor gets. A signed-in
  // student probing /admin learns nothing about whether the route exists.
  if (!row) throw new ApiError('forbidden', 'You do not have access to this.')

  c.set('admin', { ...row, registrationId: session.registrationId })
  await next()
})

/** Who am I, and what may I do — drives which controls the UI renders. */
admin.get('/admin/me', (c) => {
  const me = c.get('admin')
  return c.json({
    email: me.email,
    role: me.role,
    can: {
      money: PRIVILEGED.has(me.role),
      verify: PRIVILEGED.has(me.role) || me.role === 'verifier',
      notices: PRIVILEGED.has(me.role),
      desk: PRIVILEGED.has(me.role) || me.role === 'gate_supervisor',
    },
  })
})

/* ------------------------------------------------------------------ *
 * The numbers
 * ------------------------------------------------------------------ */

admin.get('/admin/stats', async (c) => {
  const totals = await c.env.DB.prepare(
    `SELECT
       (SELECT count(*) FROM registrations)                                        AS accounts,
       (SELECT count(*) FROM registrations WHERE status = 'confirmed')             AS registered,
       (SELECT count(*) FROM entitlements WHERE product_id = 'basic'    AND revoked_at IS NULL) AS basic,
       (SELECT count(*) FROM entitlements WHERE product_id = 'delegate' AND revoked_at IS NULL) AS delegate,
       (SELECT count(*) FROM event_entries WHERE status = 'confirmed')             AS entries,
       (SELECT count(*) FROM passes WHERE revoked_at IS NULL)                      AS passes,
       (SELECT count(*) FROM orders WHERE status = 'created'
          AND created_at < datetime('now', '-30 minutes'))                         AS stuck,
       (SELECT coalesce(sum(amount_paise), 0) FROM orders WHERE status = 'paid')   AS collected_paise,
       (SELECT coalesce(sum(fee_paise + tax_paise), 0) FROM orders WHERE status = 'paid') AS fees_paise`,
  ).first<Record<string, number>>()

  // Registrations per day, for the sparkline. Two weeks is enough to see a
  // launch spike without turning into a wall of numbers.
  const { results: daily } = await c.env.DB.prepare(
    `SELECT date(paid_at) AS day, count(*) AS n
       FROM orders
      WHERE status = 'paid' AND paid_at >= date('now', '-13 days')
      GROUP BY day ORDER BY day`,
  ).all<{ day: string; n: number }>()

  const { results: colleges } = await c.env.DB.prepare(
    `SELECT college, count(*) AS n FROM registrations
      WHERE status = 'confirmed' AND college != ''
      GROUP BY college ORDER BY n DESC LIMIT 8`,
  ).all<{ college: string; n: number }>()

  const { results: topEvents } = await c.env.DB.prepare(
    `SELECT event_name, count(*) AS n FROM event_entries
      WHERE status = 'confirmed' GROUP BY event_name ORDER BY n DESC LIMIT 8`,
  ).all<{ event_name: string; n: number }>()

  return c.json({
    accounts: totals?.accounts ?? 0,
    registered: totals?.registered ?? 0,
    basicOnly: (totals?.basic ?? 0) - (totals?.delegate ?? 0),
    delegates: totals?.delegate ?? 0,
    eventEntries: totals?.entries ?? 0,
    passes: totals?.passes ?? 0,
    // Payments started but never resolved. Should be near zero — the
    // reconciliation sweep clears them — so anything here wants a look.
    stuckPayments: totals?.stuck ?? 0,
    collectedPaise: totals?.collected_paise ?? 0,
    feesPaise: totals?.fees_paise ?? 0,
    netPaise: (totals?.collected_paise ?? 0) - (totals?.fees_paise ?? 0),
    daily,
    colleges,
    topEvents,
  })
})

/* ------------------------------------------------------------------ *
 * People
 * ------------------------------------------------------------------ */

admin.get('/admin/registrations', async (c) => {
  const q = (c.req.query('q') ?? '').trim().toLowerCase()
  const filter = c.req.query('filter') ?? 'all'
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 200)
  const offset = Math.max(Number(c.req.query('offset') ?? 0), 0)

  const where: string[] = []
  const binds: unknown[] = []

  if (q) {
    // One box that searches everything someone might have to hand: a name
    // half-remembered, an email, a phone, or the code off a pass.
    where.push(
      `(lower(r.name) LIKE ?1 OR lower(r.email) LIKE ?1 OR r.phone LIKE ?1
        OR lower(r.public_code) LIKE ?1 OR lower(r.college) LIKE ?1)`,
    )
    binds.push(`%${q}%`)
  }

  if (filter === 'registered') where.push("r.status = 'confirmed'")
  else if (filter === 'delegates') {
    where.push(
      `EXISTS (SELECT 1 FROM entitlements e WHERE e.registration_id = r.id
                AND e.product_id = 'delegate' AND e.revoked_at IS NULL)`,
    )
  } else if (filter === 'unpaid') where.push("r.status != 'confirmed'")
  else if (filter === 'pending_docs') where.push("r.verification = 'pending'")

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const { results } = await c.env.DB.prepare(
    `SELECT r.id, r.public_code, r.name, r.email, r.phone, r.college, r.course, r.year,
            r.status, r.verification, r.created_at, t.tier,
            (SELECT count(*) FROM event_entries ev
              WHERE ev.registration_id = r.id AND ev.status = 'confirmed') AS entries,
            (SELECT coalesce(sum(o.amount_paise), 0) FROM orders o
              WHERE o.registration_id = r.id AND o.status = 'paid')        AS paid_paise
       FROM registrations r JOIN registration_tier t ON t.registration_id = r.id
       ${clause}
      ORDER BY r.created_at DESC
      LIMIT ${limit} OFFSET ${offset}`,
  )
    .bind(...binds)
    .all<Record<string, unknown>>()

  const total = await c.env.DB.prepare(
    `SELECT count(*) AS n FROM registrations r ${clause}`,
  )
    .bind(...binds)
    .first<{ n: number }>()

  return c.json({
    total: total?.n ?? 0,
    offset,
    limit,
    rows: results.map((r) => ({
      id: r.id,
      publicCode: r.public_code,
      name: r.name || null,
      email: r.email,
      phone: r.phone || null,
      college: r.college || null,
      course: r.course || null,
      year: r.year || null,
      status: r.status,
      verification: r.verification,
      tier: r.tier,
      entries: r.entries,
      paidPaise: r.paid_paise,
      createdAt: r.created_at,
    })),
  })
})

admin.get('/admin/registrations/:id', async (c) => {
  const id = c.req.param('id')

  const person = await c.env.DB.prepare(
    `SELECT r.*, t.tier FROM registrations r
       JOIN registration_tier t ON t.registration_id = r.id WHERE r.id = ?`,
  )
    .bind(id)
    .first<Record<string, unknown>>()

  if (!person) throw new ApiError('not_found', 'No such registration.')

  const [orders, entitlements, entries, scans] = await Promise.all([
    c.env.DB.prepare(
      `SELECT id, amount_paise, status, method, fee_paise, tax_paise,
              razorpay_payment_id, created_at, paid_at
         FROM orders WHERE registration_id = ? ORDER BY created_at`,
    ).bind(id).all<Record<string, unknown>>(),
    c.env.DB.prepare(
      'SELECT product_id, granted_at, revoked_at, revoked_reason FROM entitlements WHERE registration_id = ?',
    ).bind(id).all<Record<string, unknown>>(),
    c.env.DB.prepare(
      `SELECT event_name, territory_code, participation, team_name, status, created_at
         FROM event_entries WHERE registration_id = ? ORDER BY created_at`,
    ).bind(id).all<Record<string, unknown>>(),
    c.env.DB.prepare(
      `SELECT s.scan_day, s.result, s.synced_at, g.name AS gate
         FROM scans s LEFT JOIN gates g ON g.id = s.gate_id
         JOIN passes p ON p.id = s.pass_id
        WHERE p.registration_id = ? ORDER BY s.synced_at DESC LIMIT 40`,
    ).bind(id).all<Record<string, unknown>>(),
  ])

  // The password hash must never leave the server, not even to an admin.
  const { password_hash: _hash, ...safe } = person as Record<string, unknown>

  return c.json({
    registration: safe,
    orders: orders.results,
    entitlements: entitlements.results,
    entries: entries.results,
    scans: scans.results,
  })
})

/* ------------------------------------------------------------------ *
 * Fixing things
 * ------------------------------------------------------------------ */

/**
 * Correct a mistyped email.
 *
 * The single most likely support request: someone registers with a typo, never
 * receives their pass, and cannot sign in to fix it themselves — because the
 * email *is* the login.
 */
admin.post('/admin/registrations/:id/email', async (c) => {
  const me = c.get('admin')
  if (!PRIVILEGED.has(me.role)) throw new ApiError('forbidden', 'Not allowed.')

  const id = c.req.param('id')
  const body = (await c.req.json().catch(() => ({}))) as { email?: string }
  const email = String(body.email ?? '').trim().toLowerCase()

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new ApiError('validation_failed', 'That does not look like an email.', {
      fields: { email: 'Enter a valid address.' },
    })
  }

  const before = await c.env.DB.prepare('SELECT email FROM registrations WHERE id = ?')
    .bind(id)
    .first<{ email: string }>()
  if (!before) throw new ApiError('not_found', 'No such registration.')

  try {
    await c.env.DB.prepare(
      "UPDATE registrations SET email = ?, updated_at = datetime('now') WHERE id = ?",
    )
      .bind(email, id)
      .run()
  } catch {
    throw new ApiError('conflict', 'Another account already uses that email.')
  }

  // Their old address can no longer be trusted to hold a session.
  await c.env.DB.prepare(
    "UPDATE sessions SET revoked_at = datetime('now') WHERE registration_id = ? AND revoked_at IS NULL",
  ).bind(id).run()

  await audit.record(c.env, {
    action: 'registration.email_changed',
    entity: 'registration',
    entityId: id,
    actorId: me.id,
    actorEmail: me.email,
    before: { email: before.email },
    after: { email },
    ip: clientIp(c),
  })

  return c.json({ ok: true, email })
})

/** Send the confirmation and pass again — the second-most-common request. */
admin.post('/admin/registrations/:id/resend', async (c) => {
  const me = c.get('admin')
  const id = c.req.param('id')

  const order = await c.env.DB.prepare(
    `SELECT id FROM orders WHERE registration_id = ? AND status = 'paid'
      ORDER BY paid_at DESC LIMIT 1`,
  )
    .bind(id)
    .first<{ id: string }>()

  if (!order) throw new ApiError('conflict', 'Nothing to resend — no completed payment.')

  await c.env.JOBS.send({
    kind: 'email.registration_confirmed',
    registrationId: id,
    orderId: order.id,
  })

  await audit.record(c.env, {
    action: 'registration.email_resent',
    entity: 'registration',
    entityId: id,
    actorId: me.id,
    actorEmail: me.email,
    ip: clientIp(c),
  })

  return c.json({ ok: true })
})

/* ------------------------------------------------------------------ *
 * The audit log
 * ------------------------------------------------------------------ */

admin.get('/admin/audit', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? 100), 500)
  const { results } = await c.env.DB.prepare(
    `SELECT id, actor_email, action, entity, entity_id, after_json, ip, at
       FROM audit_log ORDER BY at DESC LIMIT ${limit}`,
  ).all<Record<string, unknown>>()
  return c.json({ rows: results })
})
