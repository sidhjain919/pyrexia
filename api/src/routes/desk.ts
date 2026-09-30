/**
 * The registration desk.
 *
 *   GET  /api/admin/desk/lookup          who holds this address already
 *   POST /api/admin/desk/registrations   take a registration, paid in person
 *   POST /api/admin/desk/upgrades        sell the Festival Pass to somebody
 *                                        who already holds Basic
 *   POST /api/admin/desk/events          enter somebody for an event and take
 *                                        its fee
 *   POST /api/admin/desk/accommodation   book a bed for somebody already
 *                                        registered
 *
 * This is the only path in the system that turns a person into a paid
 * delegate without money passing through Razorpay, which makes it the highest
 * risk surface here. Everything below is shaped by that.
 *
 *  - **Allowlisted by name.** Two addresses, written below, and nobody else.
 *    Not a role: a role is a row a superadmin can edit, and the committee's
 *    decision was that not even a superadmin takes money at a counter. The
 *    only way to add a third person is a commit and a deploy, which is the
 *    point — it leaves a reviewable trail that a database UPDATE does not.
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
import { newBookingId, newEntryId, newId, newOrderId, newPublicCode, newStayCode } from '../lib/ids.ts'
import { loadProducts, ownedProducts, quote } from '../lib/pricing.ts'
import { readToken, resolveSession } from '../lib/session.ts'
import { validateAccommodation, validateRegistration } from '../lib/validate.ts'
import { issuePassIfNeeded } from '../lib/grant.ts'
import { parseEntrant, parseEntry } from '../lib/entry.ts'
import { resolveEvent } from '../data/events.ts'
import { feeFor } from '../data/fees.ts'
import { isEventOpen } from '../data/openings.ts'
import { requestAccommodationSheetSync, requestSheetSync } from '../jobs/sheets.ts'
import {
  accommodationSettings,
  ALLOWED_DAYS,
  arrivalDatesFor,
  departureDate,
  priceStay,
  roomLabel,
} from '../data/accommodation.ts'
import * as audit from '../lib/audit.ts'

export const desk = new Hono<{ Bindings: Env; Variables: { agent: Agent } }>()

type Agent = { id: string; email: string; role: string }

/**
 * Who may take money at a counter, by address.
 *
 * The committee named these two people and asked that nobody else hold it,
 * superadmins included. So this is not a role check: every role in the admins
 * table is grantable by somebody sitting in the admin portal, and this is the
 * one capability that must not be grantable that way.
 *
 * A person here must still be an active admin. The list narrows who may reach
 * the desk; it does not let somebody in who was never an admin at all, and
 * deactivating an account still shuts this door with it.
 *
 * Lower-case, because the lookup lower-cases the session address.
 */
export const DESK_AGENTS: ReadonlySet<string> = new Set([
  'pushkarj320@gmail.com',
  'sidhswg@gmail.com',
])

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
  if (!row || !DESK_AGENTS.has(row.email.toLowerCase())) {
    throw new ApiError('forbidden', 'You do not have access to this.')
  }

  c.set('agent', row)
  await next()
})

/**
 * How the money arrived and what proves it.
 *
 * Both counters ask for the same two things, and the reference is the one
 * that makes a row reconcilable later: a UPI transaction id, or whatever is
 * written on the cash receipt, but never nothing.
 */
function paymentDetails(body: Record<string, unknown>) {
  const method = String(body.paymentMethod ?? '').trim().toLowerCase()
  const reference = String(body.paymentReference ?? '').trim().slice(0, 120)

  const errors: Record<string, string> = {}
  if (!METHODS.has(method)) errors.paymentMethod = 'Cash or UPI.'
  if (reference.length < 3) errors.paymentReference = 'A UPI reference or receipt number.'

  return { method, reference, errors }
}

/**
 * What was actually taken, in whole rupees, bounded by the list price.
 *
 * The desk types this because the committee discounts at a counter: a
 * contingent rate, a volunteer, a comp. It may go under the published price
 * and the gap is recorded; it may never go over, because a counter that can
 * invent a price above the published one is a counter nobody can audit.
 */
function amountCollected(body: Record<string, unknown>, listPaise: number): number {
  const raw = Number(body.amountRupees)
  if (!Number.isFinite(raw) || !Number.isInteger(raw) || raw < 0) {
    throw new ApiError('validation_failed', 'Some details need another look.', {
      fields: { amountRupees: 'A whole number of rupees.' },
    })
  }

  const amountPaise = raw * 100
  if (amountPaise > listPaise) {
    throw new ApiError('validation_failed', 'Some details need another look.', {
      fields: { amountRupees: `That is more than the list price of ₹${listPaise / 100}.` },
    })
  }

  return amountPaise
}

/* ------------------------------------------------------------------ *
 * Who is this?
 * ------------------------------------------------------------------ */

/**
 * What the desk already knows about an address, before it charges it.
 *
 * The upgrade below sells to somebody who is already registered, so the agent
 * has to see who they are about to take money from: an address read off a
 * phone screen across a counter is an address that gets mistyped. It answers
 * for anybody it finds, including somebody who cannot be upgraded, because
 * "no such person" and "they already hold it" are different problems at a
 * counter and the agent has to be able to tell them apart.
 */
desk.get('/admin/desk/lookup', async (c) => {
  const email = String(c.req.query('email') ?? '').trim().toLowerCase()
  if (!email) throw new ApiError('bad_request', 'An email address to look up.')

  const row = await c.env.DB.prepare(
    `SELECT id, public_code, name, email, phone, college, course, gender
       FROM registrations WHERE lower(email) = ?`,
  )
    .bind(email)
    .first<{
      id: string
      public_code: string
      name: string
      email: string
      phone: string
      college: string
      course: string
      gender: string | null
    }>()

  if (!row) return c.json({ found: false })

  const owned = await ownedProducts(c.env, row.id)

  return c.json({
    found: true,
    publicCode: row.public_code,
    name: row.name,
    email: row.email,
    phone: row.phone,
    college: row.college,
    course: row.course,
    gender: row.gender,
    hasBasic: owned.has('basic'),
    hasDelegate: owned.has('delegate'),
  })
})

/* ------------------------------------------------------------------ *
 * A registration, taken in person
 * ------------------------------------------------------------------ */

desk.post('/admin/desk/registrations', async (c) => {
  const agent = c.get('agent')
  const body = (await readJson(c)) as Record<string, unknown>

  const { ok, errors, value } = validateRegistration(body)

  const { method, reference, errors: paymentErrors } = paymentDetails(body)
  const fieldErrors: Record<string, string> = { ...errors, ...paymentErrors }

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
      `${value.email} already holds a registration (${existing?.public_code}). Sell them the Festival Pass on its own if that is what they want.`,
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
  const amountPaise = amountCollected(body, listPaise)
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

/* ------------------------------------------------------------------ *
 * The Festival Pass, on its own
 * ------------------------------------------------------------------ */

/**
 * Sell the Festival Pass to somebody who already holds Basic Registration.
 *
 * A separate route rather than a branch inside the one above, because the two
 * transactions have almost nothing in common. This one creates nobody, asks
 * for no form, and must not touch a single column on the registration: the
 * person exists, their details were checked when they registered, and making
 * an agent retype a name and a college to sell an upgrade is how a good row
 * turns into a typo. All it needs is who, how much, and what proves it.
 *
 * `delegate` requires `basic` in the products table, so the prerequisite is
 * enforced by the quote as well as by the check below. That is deliberate
 * duplication: the check gives the agent a sentence they can act on at a
 * counter, and the quote is what makes it true.
 */
desk.post('/admin/desk/upgrades', async (c) => {
  const agent = c.get('agent')
  const body = (await readJson(c)) as Record<string, unknown>

  const email = String(body.email ?? '').trim().toLowerCase()
  const { method, reference, errors } = paymentDetails(body)

  const fieldErrors: Record<string, string> = { ...errors }
  if (!email) fieldErrors.email = 'Their email address.'

  if (Object.keys(fieldErrors).length) {
    throw new ApiError('validation_failed', 'Some details need another look.', {
      fields: fieldErrors,
    })
  }

  /* ---------- who this is ---------- */

  const existing = await c.env.DB.prepare(
    'SELECT id, public_code, name FROM registrations WHERE lower(email) = ?',
  )
    .bind(email)
    .first<{ id: string; public_code: string; name: string }>()

  // Each of these is a different thing for the agent to do next, so each says
  // which one it is rather than all three sharing one refusal.
  if (!existing) {
    throw new ApiError(
      'not_found',
      `Nobody is registered with ${email}. Take a Basic Registration for them instead, or check the spelling.`,
      { fields: { email: 'No registration with this address.' } },
    )
  }

  const owned = await ownedProducts(c.env, existing.id)

  if (!owned.has('basic')) {
    throw new ApiError(
      'bad_request',
      `${existing.public_code} started an account but never paid for Basic Registration. Take a Basic + Festival Pass registration for them instead.`,
      { fields: { email: 'This account has not paid for Basic Registration.' } },
    )
  }

  if (owned.has('delegate')) {
    throw new ApiError(
      'already_registered',
      `${existing.public_code} already holds the Festival Pass. Take no money.`,
      { fields: { email: 'Already holds the Festival Pass.' } },
    )
  }

  /* ---------- what it costs ---------- */

  const products = await loadProducts(c.env)
  const priced = quote(['delegate'], products, owned)
  if (!priced.ok) {
    throw new ApiError('bad_request', 'The Festival Pass cannot be sold right now.', {
      extra: { reason: priced.failure },
    })
  }

  const listPaise = priced.quote.subtotalPaise
  const amountPaise = amountCollected(body, listPaise)
  const discountPaise = listPaise - amountPaise

  /* ---------- write it ---------- */

  const orderId = newOrderId()

  const statements: D1PreparedStatement[] = [
    c.env.DB.prepare(
      `INSERT INTO orders (id, registration_id, amount_paise, convenience_paise, discount_paise,
                           kind, status, method, collected_by, payment_reference, paid_at)
       VALUES (?, ?, ?, 0, ?, 'desk', 'paid', ?, ?, ?, datetime('now'))`,
    ).bind(orderId, existing.id, amountPaise, discountPaise, method, agent.email, reference),
    ...priced.quote.lines.map((line) =>
      c.env.DB.prepare(
        'INSERT INTO order_items (id, order_id, product_id, amount_paise) VALUES (?, ?, ?, ?)',
      ).bind(newId(), orderId, line.productId, line.amountPaise),
    ),
    ...priced.quote.lines.map((line) =>
      c.env.DB.prepare(
        `INSERT OR IGNORE INTO entitlements (id, registration_id, product_id, order_id)
         VALUES (?, ?, ?, ?)`,
      ).bind(newId(), existing.id, line.productId, orderId),
    ),
  ]

  try {
    await c.env.DB.batch(statements)
  } catch (err) {
    console.error('desk upgrade failed', err)
    throw new ApiError('conflict', 'That upgrade could not be recorded. Try again.')
  }

  await issuePassIfNeeded(c.env, existing.id)

  await audit.record(c.env, {
    actorId: agent.id,
    actorEmail: agent.email,
    action: 'desk.upgrade',
    entity: 'order',
    entityId: orderId,
    after: {
      registrationId: existing.id,
      publicCode: existing.public_code,
      email,
      products: priced.quote.lines.map((l) => l.productId),
      listPaise,
      amountPaise,
      discountPaise,
      method,
      reference,
    },
    ip: clientIp(c),
  })

  // The same job the gateway queues. It reads this order as an upgrade on its
  // own — a paid order that follows an earlier one and adds no `basic` — and
  // sends "Festival Pass added" rather than "welcome", which is what somebody
  // who registered a month ago should receive.
  await c.env.JOBS.send({
    kind: 'email.registration_confirmed',
    registrationId: existing.id,
    orderId,
  })

  return c.json(
    {
      registrationId: existing.id,
      publicCode: existing.public_code,
      name: existing.name,
      orderId,
      listPaise,
      amountPaise,
      discountPaise,
      products: priced.quote.lines.map((l) => ({ id: l.productId, name: l.name })),
    },
    201,
  )
})

/* ------------------------------------------------------------------ *
 * An event entry, taken in person
 * ------------------------------------------------------------------ */

/**
 * Enter somebody for an event and take its fee at the counter.
 *
 * The same entry the event card makes online, held to the same rules by the
 * same parser: required answers, team-size bounds, one place per band, and the
 * event's own open switch. The only difference is how the fee arrives, and
 * that is recorded exactly as the other two counters record it.
 *
 * The person is named by address. They must already be registered, with Basic
 * Registration paid, unless the event waives it (Badminton). Somebody new to
 * such an event is created here from a name, a mobile and a college, with no
 * password, the same way the registration counter creates people.
 *
 * A free event takes no money and asks for no payment details: the entry is
 * written and that is all. There is no desk order for a transaction that
 * never happened.
 */
desk.post('/admin/desk/events', async (c) => {
  const agent = c.get('agent')
  const body = (await readJson(c)) as Record<string, unknown>

  const email = String(body.email ?? '').trim().toLowerCase()
  const eventName = String(body.eventName ?? '').trim()

  const resolved = resolveEvent(eventName)
  if (!resolved) throw new ApiError('not_found', "That event isn't on the chart.")

  if (resolved.externalForm) {
    throw new ApiError(
      'forbidden',
      `${resolved.name} takes its entries on its own form, so the desk cannot enter anyone for it.`,
    )
  }

  // A shut event is usually a full one. The desk is not a way past that: open
  // it on the switchboard first if the committee wants more entries.
  if (!(await isEventOpen(c.env, resolved.name))) {
    throw new ApiError(
      'forbidden',
      `Entries for ${resolved.name} are closed. Open it on the admin switchboard first if it should take more.`,
    )
  }

  const entry = parseEntry(resolved, body)
  /** Worth naming the band only when the event runs more than one. */
  const band = entry.priced && (feeFor(resolved.name)?.variants.length ?? 0) > 1 ? entry.priced.label : null
  const fieldErrors: Record<string, string> = { ...entry.fieldErrors }
  if (!email) fieldErrors.email = 'Their email address.'

  const payment = entry.priced ? paymentDetails(body) : null
  if (payment) Object.assign(fieldErrors, payment.errors)

  /* ---------- who this is ---------- */

  const existing = email
    ? await c.env.DB.prepare('SELECT id, public_code, name FROM registrations WHERE lower(email) = ?')
        .bind(email)
        .first<{ id: string; public_code: string; name: string }>()
    : null

  const owned = existing ? await ownedProducts(c.env, existing.id) : new Set<string>()
  const hasBasic = owned.has('basic')

  if (email && resolved.requiresBasic && !hasBasic) {
    throw new ApiError(
      'bad_request',
      existing
        ? `${existing.public_code} has not paid for Basic Registration, which ${resolved.name} needs. Take their Basic Registration first.`
        : `Nobody is registered with ${email}, and ${resolved.name} needs Basic Registration. Take that first, or check the spelling.`,
      { fields: { email: 'Needs Basic Registration first.' } },
    )
  }

  // Without Basic, the entry is the only place their details are asked for.
  const entrant = email && !hasBasic ? parseEntrant(body.entrant) : null
  if (entrant) Object.assign(fieldErrors, entrant.errors)

  if (Object.keys(fieldErrors).length) {
    throw new ApiError('validation_failed', 'Some details need another look.', {
      fields: fieldErrors,
    })
  }

  if (existing) {
    const already = await c.env.DB.prepare(
      `SELECT 1 AS ok FROM event_entries
        WHERE registration_id = ? AND event_name = ?
          AND COALESCE(fee_variant, 'standard') = ? AND status = 'confirmed'`,
    )
      .bind(existing.id, resolved.name, entry.bandId)
      .first<{ ok: number }>()
    if (already) {
      throw new ApiError(
        'conflict',
        band
          ? `${existing.public_code} is already entered for ${resolved.name}, ${band}. Take no money.`
          : `${existing.public_code} is already entered for ${resolved.name}. Take no money.`,
      )
    }
  }

  /* ---------- what it costs ---------- */

  const listPaise = entry.priced?.amountPaise ?? 0
  const amountPaise = entry.priced ? amountCollected(body, listPaise) : 0
  const discountPaise = listPaise - amountPaise

  /* ---------- write it ---------- */

  const registrationId = existing?.id ?? newId()
  const publicCode = existing?.public_code ?? newPublicCode()
  const entryId = newEntryId()
  const orderId = entry.priced ? newOrderId() : null

  const statements: D1PreparedStatement[] = []

  if (!existing && entrant) {
    // Pending, not confirmed: they hold no registration, only this entry.
    // Should they buy Basic later, online or here, that flow finds this row
    // by email and completes it rather than making a second one.
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO registrations
           (id, public_code, name, email, phone, college, city, course, year,
            emergency_name, emergency_phone, status, email_verified)
         VALUES (?, ?, ?, ?, ?, ?, '', '', '', '', '', 'pending', 0)`,
      ).bind(
        registrationId, publicCode, entrant.value.name, email, entrant.value.phone,
        entrant.value.college,
      ),
    )
  } else if (existing && entrant) {
    statements.push(
      c.env.DB.prepare(
        `UPDATE registrations SET name = ?, phone = ?, college = ?, updated_at = datetime('now')
          WHERE id = ? AND status != 'confirmed'`,
      ).bind(entrant.value.name, entrant.value.phone, entrant.value.college, registrationId),
    )
  }

  // Confirmed from the start: the money is already in the drawer. The fee on
  // the entry is what was taken, so the confirmation email's "we received"
  // matches the receipt the desk just wrote, discount and all.
  statements.push(
    c.env.DB.prepare(
      `INSERT INTO event_entries
         (id, registration_id, event_name, territory_code, participation, team_name, answers,
          members, head_count, fee_paise, fee_variant, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')`,
    ).bind(
      entryId, registrationId, resolved.name, resolved.territory.code,
      entry.asTeam ? 'team' : 'solo', entry.asTeam ? entry.teamName : null,
      entry.answersJson, entry.membersJson, entry.headCount, amountPaise,
      entry.priced?.id ?? null,
    ),
  )

  if (orderId && payment) {
    // `kind = 'desk'` keeps it on the counter's tabs of both exports and out
    // of the Razorpay reconciliation, which only looks at gateway orders.
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO orders (id, registration_id, amount_paise, convenience_paise, discount_paise,
                             kind, event_entry_id, status, method, collected_by,
                             payment_reference, paid_at)
         VALUES (?, ?, ?, 0, ?, 'desk', ?, 'paid', ?, ?, ?, datetime('now'))`,
      ).bind(
        orderId, registrationId, amountPaise, discountPaise, entryId,
        payment.method, agent.email, payment.reference,
      ),
    )
  }

  try {
    await c.env.DB.batch(statements)
  } catch (err) {
    // The one-place-per-band index, or the email index, lost a race.
    console.error('desk event entry failed', err)
    throw new ApiError('conflict', 'That entry could not be recorded: it may have just been made elsewhere. Check before taking money again.')
  }

  await audit.record(c.env, {
    actorId: agent.id,
    actorEmail: agent.email,
    action: 'desk.event',
    entity: 'event_entry',
    entityId: entryId,
    after: {
      registrationId,
      publicCode,
      email,
      eventName: resolved.name,
      variant: entry.priced?.id ?? null,
      headCount: entry.headCount,
      orderId,
      listPaise,
      amountPaise,
      discountPaise,
      method: payment?.method ?? null,
      reference: payment?.reference ?? null,
      createdPerson: !existing,
    },
    ip: clientIp(c),
  })

  await requestSheetSync(c.env, resolved.name)
  await c.env.JOBS.send({ kind: 'email.event_entered', registrationId, entryId })

  return c.json(
    {
      registrationId,
      publicCode,
      entryId,
      orderId,
      eventName: resolved.name,
      band,
      listPaise,
      amountPaise,
      discountPaise,
      createdPerson: !existing,
    },
    201,
  )
})

/* ------------------------------------------------------------------ *
 * A bed, booked in person
 * ------------------------------------------------------------------ */

/**
 * Book accommodation for somebody and take the room charge at the counter.
 *
 * The online booking's rules, kept: Basic Registration first, one confirmed
 * bed per person, the global open switch, and the price from the rate card
 * rather than from the browser. What differs is that the money is already in
 * the drawer, so the booking is written confirmed and the rooming list and the
 * receipt email go out straight away, which online is the webhook's job.
 *
 * The contact details are the booking's own copy, prefilled by the counter
 * from the registration and editable: the number somebody carries at a fest
 * is often not the one they registered with. The agent ticks the house rules
 * on the person's behalf, having read them out: the terms behind them (no
 * refund on cancellation, damage against the deposit) are the same.
 *
 * The ₹500 security deposit is not part of this. It is cash at check-in, as
 * it is for everybody.
 */
desk.post('/admin/desk/accommodation', async (c) => {
  const agent = c.get('agent')
  const body = (await readJson(c)) as Record<string, unknown>

  // A shut form is usually a full one. The desk does not get past it either.
  const settings = await accommodationSettings(c.env)
  if (!settings.open) {
    throw new ApiError(
      'forbidden',
      'Accommodation bookings are closed. Open them on the admin dashboard first if there are beds to give.',
    )
  }

  const lookupEmail = String(body.lookupEmail ?? '').trim().toLowerCase()
  const { errors, value } = validateAccommodation(body)
  const { method, reference, errors: paymentErrors } = paymentDetails(body)
  const fieldErrors: Record<string, string> = { ...errors, ...paymentErrors }
  if (!lookupEmail) fieldErrors.lookupEmail = 'Their registered email address.'

  const roomTypeId = String(body.roomTypeId ?? '')
  const days = Number(body.days)
  const arrivalDate = String(body.arrivalDate ?? '')
  const stay = priceStay(roomTypeId, days, arrivalDate)
  if (!stay) {
    if (!roomTypeId) fieldErrors.roomTypeId = 'Pick a room.'
    else if (!ALLOWED_DAYS.includes(days)) fieldErrors.days = 'Pick how long they are staying.'
    else if (!arrivalDatesFor(days).includes(arrivalDate)) fieldErrors.arrivalDate = 'Pick an arrival day.'
    else fieldErrors.roomTypeId = 'That room is not one we let.'
  }

  /* ---------- who this is ---------- */

  const existing = lookupEmail
    ? await c.env.DB.prepare('SELECT id, public_code, name FROM registrations WHERE lower(email) = ?')
        .bind(lookupEmail)
        .first<{ id: string; public_code: string; name: string }>()
    : null

  if (lookupEmail && !existing) {
    throw new ApiError(
      'not_found',
      `Nobody is registered with ${lookupEmail}. A bed needs Basic Registration: take that first, or check the spelling.`,
      { fields: { lookupEmail: 'No registration with this address.' } },
    )
  }

  if (existing && !(await ownedProducts(c.env, existing.id)).has('basic')) {
    throw new ApiError(
      'bad_request',
      `${existing.public_code} has not paid for Basic Registration, which a bed needs. Take their Basic Registration first.`,
      { fields: { lookupEmail: 'Needs Basic Registration first.' } },
    )
  }

  if (Object.keys(fieldErrors).length || !existing || !stay) {
    throw new ApiError('validation_failed', 'Some details need another look.', {
      fields: fieldErrors,
    })
  }

  const held = await c.env.DB.prepare(
    `SELECT public_code FROM accommodation_bookings
      WHERE registration_id = ? AND status = 'confirmed'`,
  )
    .bind(existing.id)
    .first<{ public_code: string }>()

  if (held) {
    throw new ApiError(
      'conflict',
      `${existing.public_code} already has a bed, reference ${held.public_code}. Take no money: the accommodation team changes bookings.`,
    )
  }

  /* ---------- what it costs ---------- */

  const listPaise = stay.feePaise
  const amountPaise = amountCollected(body, listPaise)
  const discountPaise = listPaise - amountPaise

  /* ---------- write it ---------- */

  const bookingId = newBookingId()
  const code = newStayCode()
  const orderId = newOrderId()

  const statements: D1PreparedStatement[] = [
    // An abandoned online attempt is stood down, as the online form does.
    c.env.DB.prepare(
      `UPDATE accommodation_bookings SET status = 'cancelled', updated_at = datetime('now')
        WHERE registration_id = ? AND status = 'pending'`,
    ).bind(existing.id),
    // `fee_paise` is what was taken, so the rooming list's "paid for room" and
    // the receipt both match the drawer, discount and all. The rate stays the
    // list rate: that is what the room cost on the day.
    c.env.DB.prepare(
      `INSERT INTO accommodation_bookings
         (id, public_code, registration_id, gender, sharing, ac, days,
          arrival_date, arrival_time, name, email, phone, college, course,
          rules_accepted, rate_paise, fee_paise, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 'confirmed')`,
    ).bind(
      bookingId, code, existing.id, stay.room.gender, stay.room.sharing, stay.room.ac ? 1 : 0,
      stay.days, arrivalDate, value.arrivalTime || null, value.name, value.email, value.phone,
      value.college, value.course, stay.ratePaise, amountPaise,
    ),
    // `kind = 'desk'` keeps it on the counter's tabs and out of the Razorpay
    // reconciliation; the booking id is what the receipt email reads it by.
    c.env.DB.prepare(
      `INSERT INTO orders (id, registration_id, amount_paise, convenience_paise, discount_paise,
                           kind, accommodation_booking_id, status, method, collected_by,
                           payment_reference, paid_at)
       VALUES (?, ?, ?, 0, ?, 'desk', ?, 'paid', ?, ?, ?, datetime('now'))`,
    ).bind(orderId, existing.id, amountPaise, discountPaise, bookingId, method, agent.email, reference),
  ]

  try {
    await c.env.DB.batch(statements)
  } catch (err) {
    // The one-bed-per-person index lost a race with the online form.
    console.error('desk accommodation failed', err)
    throw new ApiError(
      'conflict',
      'That booking could not be recorded: they may have just booked online. Check before taking money again.',
    )
  }

  await audit.record(c.env, {
    actorId: agent.id,
    actorEmail: agent.email,
    action: 'desk.accommodation',
    entity: 'accommodation_booking',
    entityId: bookingId,
    after: {
      registrationId: existing.id,
      publicCode: existing.public_code,
      code,
      room: stay.room.id,
      days: stay.days,
      arrivalDate,
      orderId,
      listPaise,
      amountPaise,
      discountPaise,
      method,
      reference,
    },
    ip: clientIp(c),
  })

  await requestAccommodationSheetSync(c.env)
  await c.env.JOBS.send({
    kind: 'email.accommodation_confirmed',
    registrationId: existing.id,
    bookingId,
  })

  return c.json(
    {
      bookingId,
      code,
      publicCode: existing.public_code,
      orderId,
      room: roomLabel(stay.room),
      gender: stay.room.gender,
      days: stay.days,
      arrivalDate,
      departureDate: departureDate(arrivalDate, stay.days),
      listPaise,
      amountPaise,
      discountPaise,
    },
    201,
  )
})
