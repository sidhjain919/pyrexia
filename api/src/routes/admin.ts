/**
 * Admin.
 *
 * Sign-in reuses the ordinary account system rather than bolting on a second
 * one: an admin signs in exactly like a student, and their email being present
 * in the `admins` table is what grants them anything extra. One fewer login to
 * build, one fewer to compromise, and revoking someone is deleting a row.
 *
 * Every route here is behind `requireAdmin`, and anything that changes the
 * world writes to the audit log. Reads don't, an append-only table filling up
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

/** Who am I, and what may I do: drives which controls the UI renders. */
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

/**
 * Every day-grouping here is in IST, not UTC.
 *
 * The fest and its team are in India, so "today" and each bar have to mean an
 * IST calendar day: grouping by the raw UTC timestamp would move a late-evening
 * sign-up onto tomorrow and make the dashboard disagree with the clock on the
 * wall. `datetime(col,'+5 hours','+30 minutes')` shifts the stored UTC value to
 * IST before the date is taken. The frontend builds its 14-day axis in IST too,
 * so the keys line up exactly.
 */
const IST = "'+5 hours', '+30 minutes'"

/** "Today" and rolling windows, all as IST calendar days. */
const TODAY = `date('now', ${IST})`
const SINCE_7 = `date('now', ${IST}, '-6 days')`
const SINCE_14 = `date('now', ${IST}, '-13 days')`
/** A registration that actually holds Basic Registration. */
const HOLDS_BASIC = `EXISTS (SELECT 1 FROM entitlements e
                      WHERE e.registration_id = r.id AND e.product_id = 'basic'
                        AND e.revoked_at IS NULL)`

admin.get('/admin/stats', async (c) => {
  const db = c.env.DB

  const totals = await db.prepare(
    `SELECT
       (SELECT count(*) FROM registrations)                                        AS accounts,
       (SELECT count(*) FROM registrations WHERE email_verified = 1)               AS verified,
       (SELECT count(DISTINCT registration_id) FROM documents
          WHERE kind = 'student_id' AND purged_at IS NULL)                         AS id_uploaded,
       (SELECT count(*) FROM entitlements WHERE product_id = 'basic'    AND revoked_at IS NULL) AS basic,
       (SELECT count(*) FROM entitlements WHERE product_id = 'delegate' AND revoked_at IS NULL) AS delegate,
       (SELECT count(*) FROM event_entries WHERE status = 'confirmed')             AS entries,
       (SELECT count(*) FROM passes WHERE revoked_at IS NULL)                      AS passes,
       (SELECT count(*) FROM orders WHERE status = 'created'
          AND created_at < datetime('now', '-30 minutes'))                         AS stuck,
       (SELECT count(*) FROM orders WHERE status = 'paid')                         AS paid_orders,
       (SELECT count(*) FROM orders WHERE status = 'failed')                       AS failed_orders,
       (SELECT count(*) FROM orders WHERE status = 'refunded')                     AS refunded_orders,
       (SELECT coalesce(sum(amount_paise), 0) FROM orders WHERE status = 'paid')   AS collected_paise,
       (SELECT coalesce(sum(amount_paise), 0) FROM orders
          WHERE status = 'paid' AND date(paid_at, ${IST}) = ${TODAY})              AS collected_today,
       (SELECT coalesce(sum(amount_paise), 0) FROM orders
          WHERE status = 'paid' AND date(paid_at, ${IST}) >= ${SINCE_7})           AS collected_week,
       (SELECT coalesce(sum(convenience_paise), 0) FROM orders WHERE status = 'paid') AS gateway_paise,
       (SELECT coalesce(sum(amount_paise - convenience_paise), 0) FROM orders
          WHERE status = 'paid' AND kind = 'event')                                AS event_fees_paise,
       (SELECT coalesce(sum(i.amount_paise), 0) FROM order_items i
          JOIN orders o ON o.id = i.order_id
          WHERE o.status = 'paid' AND i.product_id = 'basic')                      AS basic_paise,
       (SELECT coalesce(sum(i.amount_paise), 0) FROM order_items i
          JOIN orders o ON o.id = i.order_id
          WHERE o.status = 'paid' AND i.product_id = 'delegate')                   AS festival_paise,
       (SELECT count(*) FROM registrations
          WHERE date(created_at, ${IST}) = ${TODAY})                               AS accounts_today,
       (SELECT count(*) FROM passes
          WHERE revoked_at IS NULL AND date(issued_at, ${IST}) = ${TODAY})         AS passes_today,
       (SELECT count(DISTINCT registration_id) FROM sessions
          WHERE revoked_at IS NULL
            AND date(coalesce(last_seen_at, created_at), ${IST}) = ${TODAY})       AS signed_in_today,
       (SELECT count(*) FROM passes
          WHERE revoked_at IS NULL AND date(issued_at, ${IST}) >= ${SINCE_7})      AS passes_last7,
       (SELECT count(*) FROM passes
          WHERE revoked_at IS NULL AND date(issued_at, ${IST}) >= ${SINCE_14}
            AND date(issued_at, ${IST}) < ${SINCE_7})                              AS passes_prev7,
       (SELECT count(*) FROM registrations
          WHERE date(created_at, ${IST}) >= ${SINCE_7})                            AS accounts_last7,
       (SELECT count(*) FROM registrations
          WHERE date(created_at, ${IST}) >= ${SINCE_14}
            AND date(created_at, ${IST}) < ${SINCE_7})                             AS accounts_prev7`,
  ).first<Record<string, number>>()

  // Accounts created per day: the top of the funnel, whether or not anyone paid.
  const { results: accountsDaily } = await db.prepare(
    `SELECT date(created_at, ${IST}) AS day, count(*) AS n
       FROM registrations
      WHERE created_at >= datetime('now', '-31 days')
      GROUP BY day ORDER BY day`,
  ).all<{ day: string; n: number }>()

  // Passes issued per day, split by what the holder currently owns: a Festival
  // Pass (delegate) or Basic only. `tier` is read live, so an upgrade moves a
  // pass from the Basic column to the Festival column on the day it was issued.
  const { results: passesDaily } = await db.prepare(
    `SELECT date(p.issued_at, ${IST}) AS day,
            sum(CASE WHEN t.tier = 1 THEN 1 ELSE 0 END) AS festival,
            sum(CASE WHEN t.tier = 0 THEN 1 ELSE 0 END) AS basic
       FROM passes p JOIN registration_tier t ON t.registration_id = p.registration_id
      WHERE p.revoked_at IS NULL AND p.issued_at >= datetime('now', '-31 days')
      GROUP BY day ORDER BY day`,
  ).all<{ day: string; festival: number; basic: number }>()

  // Money received per day, for the sparkline under the headline figure.
  const { results: revenueDaily } = await db.prepare(
    `SELECT date(paid_at, ${IST}) AS day, coalesce(sum(amount_paise), 0) AS paise
       FROM orders
      WHERE status = 'paid' AND paid_at >= datetime('now', '-31 days')
      GROUP BY day ORDER BY day`,
  ).all<{ day: string; paise: number }>()

  // What hour of the day people pay, in IST: tells the team when a post lands.
  const { results: hourly } = await db.prepare(
    `SELECT CAST(strftime('%H', issued_at, ${IST}) AS INTEGER) AS hour, count(*) AS n
       FROM passes WHERE revoked_at IS NULL
      GROUP BY hour ORDER BY hour`,
  ).all<{ hour: number; n: number }>()

  const { results: methods } = await db.prepare(
    `SELECT coalesce(method, 'unknown') AS method, count(*) AS n
       FROM orders WHERE status = 'paid' GROUP BY method ORDER BY n DESC`,
  ).all<{ method: string; n: number }>()

  // For accommodation and logistics, over registered people only.
  const { results: gender } = await db.prepare(
    `SELECT CASE WHEN trim(coalesce(r.gender, '')) = '' THEN 'Not given' ELSE r.gender END AS label,
            count(*) AS n
       FROM registrations r WHERE ${HOLDS_BASIC}
      GROUP BY label ORDER BY n DESC`,
  ).all<{ label: string; n: number }>()

  const { results: years } = await db.prepare(
    `SELECT CASE WHEN trim(coalesce(r.year, '')) = '' THEN 'Not given' ELSE r.year END AS label,
            count(*) AS n
       FROM registrations r WHERE ${HOLDS_BASIC}
      GROUP BY label ORDER BY n DESC`,
  ).all<{ label: string; n: number }>()

  const { results: topEvents } = await db.prepare(
    `SELECT event_name, count(*) AS n FROM event_entries
      WHERE status = 'confirmed' GROUP BY event_name ORDER BY n DESC LIMIT 8`,
  ).all<{ event_name: string; n: number }>()

  // The last few payments, so the page has a pulse.
  const { results: recent } = await db.prepare(
    `SELECT r.name, r.public_code, o.amount_paise, o.paid_at, o.kind,
            (SELECT group_concat(product_id) FROM order_items i WHERE i.order_id = o.id) AS products
       FROM orders o JOIN registrations r ON r.id = o.registration_id
      WHERE o.status = 'paid'
      ORDER BY o.paid_at DESC LIMIT 8`,
  ).all<{
    name: string
    public_code: string
    amount_paise: number
    paid_at: string
    kind: string
    products: string | null
  }>()

  const t = totals ?? {}
  const n = (k: string) => Number(t[k] ?? 0)
  const registered = n('basic')
  const festival = n('delegate')

  return c.json({
    // Money. Exact paise; the browser formats. Gross of everything received
    // via Razorpay across paid orders; refunds excluded (a refunded order is no
    // longer 'paid').
    collectedPaise: n('collected_paise'),
    collectedTodayPaise: n('collected_today'),
    collectedWeekPaise: n('collected_week'),
    composition: {
      basicPaise: n('basic_paise'),
      festivalPaise: n('festival_paise'),
      eventFeesPaise: n('event_fees_paise'),
      gatewayPaise: n('gateway_paise'),
    },
    revenueDaily,

    // People. `registered` means holds Basic Registration, the same basis as
    // the People table's flag, so the headline and the list never disagree.
    accounts: n('accounts'),
    accountsToday: n('accounts_today'),
    registered,
    delegates: festival,
    basicOnly: Math.max(0, registered - festival),
    passes: n('passes'),
    passesToday: n('passes_today'),
    signedInToday: n('signed_in_today'),
    eventEntries: n('entries'),

    funnel: {
      accounts: n('accounts'),
      verified: n('verified'),
      idUploaded: n('id_uploaded'),
      paid: registered,
      festival,
    },

    accountsDaily,
    passesDaily,

    momentum: {
      passesLast7: n('passes_last7'),
      passesPrev7: n('passes_prev7'),
      accountsLast7: n('accounts_last7'),
      accountsPrev7: n('accounts_prev7'),
    },

    hourly,

    payments: {
      paid: n('paid_orders'),
      failed: n('failed_orders'),
      refunded: n('refunded_orders'),
      stuck: n('stuck'),
      methods,
    },
    // Kept for the alert strip.
    stuckPayments: n('stuck'),

    gender,
    years,
    topEvents,

    recent: recent.map((r) => ({
      name: r.name,
      publicCode: r.public_code,
      amountPaise: r.amount_paise,
      paidAt: r.paid_at,
      kind: r.kind,
      products: (r.products ?? '').split(',').filter(Boolean),
    })),
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
            EXISTS (SELECT 1 FROM entitlements e
                     WHERE e.registration_id = r.id AND e.product_id = 'basic'
                       AND e.revoked_at IS NULL)                            AS registered,
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
      // Whether they actually hold Basic Registration. Without this the table
      // cannot tell "paid Basic" from "made an account and paid nothing", and
      // both showed as "Basic".
      registered: !!r.registered,
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
 * receives their pass, and cannot sign in to fix it themselves, because the
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

/** Send the confirmation and pass again: the second-most-common request. */
admin.post('/admin/registrations/:id/resend', async (c) => {
  const me = c.get('admin')
  const id = c.req.param('id')

  const order = await c.env.DB.prepare(
    `SELECT id FROM orders WHERE registration_id = ? AND status = 'paid'
      ORDER BY paid_at DESC LIMIT 1`,
  )
    .bind(id)
    .first<{ id: string }>()

  if (!order) throw new ApiError('conflict', 'Nothing to resend, no completed payment.')

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
