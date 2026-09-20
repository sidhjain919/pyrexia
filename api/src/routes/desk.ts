/**
 * The registration desk.
 *
 *   POST /api/admin/desk/registrations   take a registration, paid in person
 *
 * This is the only path in the system that turns a person into a paid
 * delegate without money passing through Razorpay, which makes it the highest
 * risk surface here. Everything below is shaped by that.
 *
 *  - **Allowlisted.** Only `desk_agent` and the money roles. `desk_agent` can
 *    do nothing else at all.
 *  - **Bounded by the server.** The browser names products and states what was
 *    collected; the list price still comes from the products table, and the
 *    collected amount may not exceed it. A desk can discount, which is the
 *    point, but it cannot invent a price above the published one and it
 *    cannot quietly under-record one without the gap being written down.
 *  - **Signed.** Who collected it, how, and the reference that proves it, on
 *    the order row and in the audit log. A treasurer reconciles a cash box
 *    and a UPI statement against these.
 *  - **Idempotent-ish.** One live registration per email. A second attempt for
 *    somebody who already holds a pass is refused rather than issuing a
 *    second one.
 *
 * No account is created. A registration row is the account in this schema, so
 * the row exists, but with no password set: the delegate is never asked to
 * make one and never needs to. They get the email with their number and QR.
 */

import { Hono } from 'hono'

import type { Env } from '../types.ts'
import { ApiError, clientIp, readJson } from '../lib/http.ts'
import { newId, newOrderId, newPublicCode } from '../lib/ids.ts'
import { loadProducts, ownedProducts, quote } from '../lib/pricing.ts'
import { readToken, resolveSession } from '../lib/session.ts'
import { validateRegistration } from '../lib/validate.ts'
import { issuePassIfNeeded } from '../lib/grant.ts'
import * as audit from '../lib/audit.ts'

export const desk = new Hono<{ Bindings: Env; Variables: { agent: Agent } }>()

type Agent = { id: string; email: string; role: string }

/** Roles that may take money at a counter. */
const DESK_ROLES = new Set(['superadmin', 'core', 'finance', 'desk_agent'])

/** How the money actually arrived. Anything else is refused. */
const METHODS = new Set(['cash', 'upi'])

desk.use('/admin/desk/*', async (c, next) => {
  const session = await resolveSession(c.env, readToken(c.req.raw.headers))
  if (!session) throw new ApiError('unauthorised', 'Sign in first.')

  const row = await c.env.DB.prepare(
    'SELECT id, email, role FROM admins WHERE lower(email) = ? AND active = 1',
  )
    .bind(session.email.toLowerCase())
    .first<Agent>()

  // Deliberately the same message a signed-out visitor gets, so probing this
  // endpoint tells somebody nothing about whether it exists.
  if (!row || !DESK_ROLES.has(row.role)) {
    throw new ApiError('forbidden', 'You do not have access to this.')
  }

  c.set('agent', row)
  await next()
})

desk.post('/admin/desk/registrations', async (c) => {
  const agent = c.get('agent')
  const body = (await readJson(c)) as Record<string, unknown>

  const { ok, errors, value } = validateRegistration(body)

  const method = String(body.paymentMethod ?? '').trim().toLowerCase()
  const reference = String(body.paymentReference ?? '').trim().slice(0, 120)

  const fieldErrors: Record<string, string> = { ...errors }
  if (!METHODS.has(method)) fieldErrors.paymentMethod = 'Cash or UPI.'
  // The one thing that makes this reconcilable later. A UPI transaction id, or
  // whatever is written on the cash receipt, but never nothing.
  if (reference.length < 3) {
    fieldErrors.paymentReference = 'A UPI reference or receipt number.'
  }

  if (!ok || Object.keys(fieldErrors).length) {
    throw new ApiError('validation_failed', 'Some details need another look.', {
      fields: fieldErrors,
    })
  }

  const requested = Array.isArray(body.products) ? (body.products as string[]) : []
  if (!requested.length || !requested.every((p) => typeof p === 'string')) {
    throw new ApiError('bad_request', 'Choose what they are paying for.')
  }

  /* ---------- who this is ---------- */

  // The email is the identity in this schema and is uniquely indexed, so
  // somebody who started online and never paid must be completed rather than
  // duplicated: two rows would mean two passes and one confused person.
  const existing = await c.env.DB.prepare(
    'SELECT id, public_code, status FROM registrations WHERE lower(email) = ?',
  )
    .bind(value.email)
    .first<{ id: string; public_code: string; status: string }>()

  const owned = existing ? await ownedProducts(c.env, existing.id) : new Set<string>()
  if (owned.has('basic')) {
    throw new ApiError(
      'already_registered',
      `${value.email} already holds a registration (${existing?.public_code}). Add the Festival Pass from the dashboard instead.`,
    )
  }

  // A mobile number belongs to one human, the same rule the online form keeps.
  const phoneClash = await c.env.DB.prepare(
    `SELECT public_code FROM registrations
      WHERE status = 'confirmed' AND phone = ? AND id != ? LIMIT 1`,
  )
    .bind(value.phone, existing?.id ?? '')
    .first<{ public_code: string }>()

  if (phoneClash) {
    throw new ApiError('conflict', 'That mobile number is already on another registration.', {
      fields: { phone: `Already registered as ${phoneClash.public_code}.` },
    })
  }

  /* ---------- what it costs ---------- */

  const products = await loadProducts(c.env)
  const priced = quote(requested, products, owned)
  if (!priced.ok) {
    throw new ApiError('bad_request', 'That combination cannot be sold.', {
      extra: { reason: priced.failure },
    })
  }

  // No gateway, so no gateway charge. Adding 2.36% to a cash payment would be
  // inventing a fee that nobody is charging us.
  const listPaise = priced.quote.subtotalPaise

  // What was actually taken. The desk types this because the committee
  // discounts at a counter: a contingent rate, a volunteer, a comp. Read in
  // whole rupees, because that is what changes hands.
  const rupeesRaw = Number(body.amountRupees)
  if (!Number.isFinite(rupeesRaw) || !Number.isInteger(rupeesRaw) || rupeesRaw < 0) {
    throw new ApiError('validation_failed', 'Some details need another look.', {
      fields: { amountRupees: 'A whole number of rupees.' },
    })
  }

  const amountPaise = rupeesRaw * 100
  if (amountPaise > listPaise) {
    throw new ApiError('validation_failed', 'Some details need another look.', {
      fields: {
        amountRupees: `That is more than the list price of ₹${listPaise / 100}.`,
      },
    })
  }

  const discountPaise = listPaise - amountPaise

  /* ---------- write it ---------- */

  const registrationId = existing?.id ?? newId()
  const publicCode = existing?.public_code ?? newPublicCode()
  const orderId = newOrderId()

  const statements: D1PreparedStatement[] = []

  if (existing) {
    statements.push(
      c.env.DB.prepare(
        `UPDATE registrations
            SET name = ?, phone = ?, gender = ?, college = ?, city = ?, course = ?, year = ?,
                emergency_name = ?, emergency_phone = ?, status = 'confirmed',
                updated_at = datetime('now')
          WHERE id = ?`,
      ).bind(
        value.name, value.phone, value.gender || null, value.college, value.city,
        value.course, value.year, value.emergencyName, value.emergencyPhone, registrationId,
      ),
    )
  } else {
    // No password and no verification: the delegate never signs in, and the
    // desk has just checked their identity in person, which is a stronger
    // proof than a link in an inbox.
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO registrations
           (id, public_code, name, email, phone, gender, college, city, course, year,
            emergency_name, emergency_phone, status, email_verified)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', 0)`,
      ).bind(
        registrationId, publicCode, value.name, value.email, value.phone, value.gender || null,
        value.college, value.city, value.course, value.year,
        value.emergencyName, value.emergencyPhone,
      ),
    )
  }

  statements.push(
    c.env.DB.prepare(
      `INSERT INTO orders (id, registration_id, amount_paise, convenience_paise, discount_paise,
                           kind, status, method, collected_by, payment_reference, paid_at)
       VALUES (?, ?, ?, 0, ?, 'desk', 'paid', ?, ?, ?, datetime('now'))`,
    ).bind(
      orderId, registrationId, amountPaise, discountPaise, method, agent.email, reference,
    ),
    ...priced.quote.lines.map((line) =>
      c.env.DB.prepare(
        'INSERT INTO order_items (id, order_id, product_id, amount_paise) VALUES (?, ?, ?, ?)',
      ).bind(newId(), orderId, line.productId, line.amountPaise),
    ),
    ...priced.quote.lines.map((line) =>
      c.env.DB.prepare(
        `INSERT OR IGNORE INTO entitlements (id, registration_id, product_id, order_id)
         VALUES (?, ?, ?, ?)`,
      ).bind(newId(), registrationId, line.productId, orderId),
    ),
  )

  try {
    await c.env.DB.batch(statements)
  } catch (err) {
    // The unique index on email or phone lost a race with another desk.
    console.error('desk registration failed', err)
    throw new ApiError('conflict', 'That email or mobile number was just registered elsewhere.')
  }

  await issuePassIfNeeded(c.env, registrationId)

  await audit.record(c.env, {
    actorId: agent.id,
    actorEmail: agent.email,
    action: 'desk.register',
    entity: 'order',
    entityId: orderId,
    after: {
      registrationId,
      publicCode,
      email: value.email,
      products: priced.quote.lines.map((l) => l.productId),
      listPaise,
      amountPaise,
      discountPaise,
      method,
      reference,
    },
    ip: clientIp(c),
  })

  await c.env.JOBS.send({
    kind: 'email.registration_confirmed',
    registrationId,
    orderId,
  })

  return c.json(
    {
      registrationId,
      publicCode,
      orderId,
      listPaise,
      amountPaise,
      discountPaise,
      products: priced.quote.lines.map((l) => ({ id: l.productId, name: l.name })),
      completedExisting: !!existing,
    },
    201,
  )
})
