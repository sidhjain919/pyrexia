/**
 * Event entry.
 *
 *   GET    /api/events/:name      what this event needs, costs, and where you stand
 *   POST   /api/me/events         enter one, paying if it charges
 *   DELETE /api/me/events/:name   withdraw
 *
 * Two shapes of entry live here. A free event is settled in one request: the
 * row is written and the entrant is in. A paid one cannot be, because the money
 * arrives from Razorpay by webhook a second or two later, so the entry is
 * written as `pending`, an order is attached to it, and the webhook is what
 * turns it into a place in the event.
 *
 * The client never sends an amount. It sends a variant id at most, and the
 * price for that id comes from `data/fees.ts`.
 */

import { Hono } from 'hono'

import type { Env } from '../types.ts'
import { ApiError, readJson } from '../lib/http.ts'
import { newEntryId, newOrderId } from '../lib/ids.ts'
import {
  OPEN_TERRITORIES,
  allowsTeam,
  isTerritoryOpen,
  openTerritories,
  requiresTeam,
  resolveEvent,
} from '../data/events.ts'
import { feeFor, priceEntry } from '../data/fees.ts'
import { conveniencePaise } from '../lib/pricing.ts'
import { createOrder, razorpayConfig } from '../lib/razorpay.ts'
import { readToken, resolveSession } from '../lib/session.ts'
import * as audit from '../lib/audit.ts'

export const events = new Hono<{ Bindings: Env }>()

/**
 * Which territories are taking entries.
 *
 * Public and static: the events grid needs it to choose between "Register" and
 * "Coming soon" for sixty cards, and asking per card would be sixty requests.
 */
events.get('/events/openings', (c) =>
  c.json({ open: [...OPEN_TERRITORIES], territories: openTerritories() }),
)

events.get('/events/:name', async (c) => {
  const name = decodeURIComponent(c.req.param('name'))
  const resolved = resolveEvent(name)
  if (!resolved) throw new ApiError('not_found', "That event isn't on the chart.")

  const session = await resolveSession(c.env, readToken(c.req.raw.headers))
  const open = isTerritoryOpen(resolved.territory.id)
  const fee = feeFor(name)

  let entered = false
  let eligible = false

  if (session) {
    const entitlement = await c.env.DB.prepare(
      `SELECT 1 AS ok FROM entitlements
        WHERE registration_id = ? AND product_id = 'basic' AND revoked_at IS NULL`,
    )
      .bind(session.registrationId)
      .first<{ ok: number }>()
    eligible = !!entitlement

    const existing = await c.env.DB.prepare(
      `SELECT 1 AS ok FROM event_entries
        WHERE registration_id = ? AND event_name = ? AND status = 'confirmed'`,
    )
      .bind(session.registrationId, name)
      .first<{ ok: number }>()
    entered = !!existing
  }

  return c.json({
    name: resolved.name,
    tag: resolved.tag,
    territory: { code: resolved.territory.code, name: resolved.territory.territory },
    open,
    fee: fee && {
      unit: fee.unit,
      variants: fee.variants.map((v) => ({
        id: v.id,
        label: v.label,
        amountPaise: v.amountPaise,
      })),
    },
    form: {
      participation: resolved.form.participation,
      teamSize: resolved.form.teamSize ?? null,
      fields: resolved.form.fields,
      note: resolved.form.note ?? null,
      allowsTeam: allowsTeam(resolved.form),
      requiresTeam: requiresTeam(resolved.form),
    },
    signedIn: !!session,
    eligible,
    entered,
  })
})

/* ------------------------------------------------------------------ *
 * Entering
 * ------------------------------------------------------------------ */

events.post('/me/events', async (c) => {
  const session = await resolveSession(c.env, readToken(c.req.raw.headers))
  if (!session) throw new ApiError('unauthorised', 'Sign in to enter an event.')

  const body = (await readJson(c)) as Record<string, unknown>
  const name = String(body.eventName ?? '').trim()

  const resolved = resolveEvent(name)
  if (!resolved) throw new ApiError('not_found', "That event isn't on the chart.")

  // Checked here as well as on the way in: the client knowing a form is shut
  // is a courtesy, this is the rule.
  if (!isTerritoryOpen(resolved.territory.id)) {
    throw new ApiError('forbidden', `Entries for ${resolved.territory.code} are not open yet.`)
  }

  // Basic Registration is the only thing standing between a person and an
  // event. Checked here rather than trusted from the client.
  const entitlement = await c.env.DB.prepare(
    `SELECT 1 AS ok FROM entitlements
      WHERE registration_id = ? AND product_id = 'basic' AND revoked_at IS NULL`,
  )
    .bind(session.registrationId)
    .first<{ ok: number }>()

  if (!entitlement) {
    throw new ApiError(
      'payment_required',
      'Complete your Basic Registration before entering an event.',
    )
  }

  const asTeam = body.participation === 'team'
  const teamName = String(body.teamName ?? '').trim()
  const answers = (body.answers ?? {}) as Record<string, unknown>
  const variantId = body.feeVariant == null ? null : String(body.feeVariant)

  const fieldErrors: Record<string, string> = {}
  for (const field of resolved.form.fields) {
    const value = String(answers[field.id] ?? '').trim()
    if (field.required && !value) fieldErrors[field.id] = 'Required.'
    if (value.length > 1000) fieldErrors[field.id] = 'That answer is too long.'
  }

  if (requiresTeam(resolved.form) && !asTeam) {
    fieldErrors.participation = 'This event is entered as a team.'
  }
  if (asTeam && teamName.length < 2) {
    fieldErrors.teamName = 'Give your crew a name.'
  }

  const fee = feeFor(name)
  const priced = fee ? priceEntry(name, variantId) : null
  if (fee && !priced) {
    fieldErrors.feeVariant = 'Choose which entry applies to you.'
  }

  if (Object.keys(fieldErrors).length) {
    throw new ApiError('validation_failed', 'Some answers need another look.', {
      fields: fieldErrors,
    })
  }

  const already = await c.env.DB.prepare(
    `SELECT 1 AS ok FROM event_entries
      WHERE registration_id = ? AND event_name = ? AND status = 'confirmed'`,
  )
    .bind(session.registrationId, name)
    .first<{ ok: number }>()
  if (already) throw new ApiError('conflict', `You're already entered for ${resolved.name}.`)

  const entryId = newEntryId()
  const answersJson = JSON.stringify(
    Object.fromEntries(resolved.form.fields.map((f) => [f.id, String(answers[f.id] ?? '').trim()])),
  )

  /* ---------- free: settled here and now ---------- */

  if (!priced) {
    try {
      await c.env.DB.prepare(
        `INSERT INTO event_entries
           (id, registration_id, event_name, territory_code, participation, team_name, answers)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          entryId,
          session.registrationId,
          resolved.name,
          resolved.territory.code,
          asTeam ? 'team' : 'solo',
          asTeam ? teamName : null,
          answersJson,
        )
        .run()
    } catch {
      throw new ApiError('conflict', `You're already entered for ${resolved.name}.`)
    }

    await audit.record(c.env, {
      action: 'event.enter',
      entity: 'event_entry',
      entityId: entryId,
      after: { registrationId: session.registrationId, eventName: resolved.name },
    })

    return c.json(
      { entryId, eventName: resolved.name, participation: asTeam ? 'team' : 'solo', checkout: null },
      201,
    )
  }

  /* ---------- paid: written pending, confirmed by the webhook ---------- */

  // Any earlier unfinished attempt at this same event is stood down first, so
  // one person never accumulates a drawer of half-paid entries.
  await c.env.DB.prepare(
    `UPDATE event_entries SET status = 'withdrawn'
      WHERE registration_id = ? AND event_name = ? AND status = 'pending'`,
  )
    .bind(session.registrationId, name)
    .run()

  // Razorpay prefills its form from these; the session does not carry a phone.
  const contact = await c.env.DB.prepare(
    'SELECT phone FROM registrations WHERE id = ?',
  )
    .bind(session.registrationId)
    .first<{ phone: string | null }>()

  const convenience = conveniencePaise(priced.amountPaise)
  const totalPaise = priced.amountPaise + convenience
  const orderId = newOrderId()

  const rzpOrder = await createOrder(razorpayConfig(c.env), {
    amountPaise: totalPaise,
    receipt: orderId,
    notes: {
      registrationId: session.registrationId,
      publicCode: session.publicCode,
      eventName: resolved.name,
    },
  })

  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO event_entries
         (id, registration_id, event_name, territory_code, participation, team_name, answers,
          fee_paise, fee_variant, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    ).bind(
      entryId,
      session.registrationId,
      resolved.name,
      resolved.territory.code,
      asTeam ? 'team' : 'solo',
      asTeam ? teamName : null,
      answersJson,
      priced.amountPaise,
      priced.id,
    ),
    c.env.DB.prepare(
      `INSERT INTO orders (id, registration_id, amount_paise, convenience_paise,
                           kind, event_entry_id, razorpay_order_id, status)
       VALUES (?, ?, ?, ?, 'event', ?, ?, 'created')`,
    ).bind(
      orderId,
      session.registrationId,
      totalPaise,
      convenience,
      entryId,
      rzpOrder.id,
    ),
  ])

  await audit.record(c.env, {
    action: 'event.enter',
    entity: 'event_entry',
    entityId: entryId,
    after: {
      registrationId: session.registrationId,
      eventName: resolved.name,
      feePaise: priced.amountPaise,
      variant: priced.id,
      status: 'pending',
    },
  })

  return c.json(
    {
      entryId,
      eventName: resolved.name,
      participation: asTeam ? 'team' : 'solo',
      orderId,
      checkout: {
        keyId: c.env.RAZORPAY_KEY_ID,
        razorpayOrderId: rzpOrder.id,
        amountPaise: totalPaise,
        currency: 'INR',
        name: session.name,
        email: session.email,
        phone: contact?.phone ?? '',
      },
      subtotalPaise: priced.amountPaise,
      conveniencePaise: convenience,
      totalPaise,
      feeLabel: priced.label,
    },
    201,
  )
})

events.delete('/me/events/:name', async (c) => {
  const session = await resolveSession(c.env, readToken(c.req.raw.headers))
  if (!session) throw new ApiError('unauthorised', 'Sign in first.')

  const name = decodeURIComponent(c.req.param('name'))

  const result = await c.env.DB.prepare(
    `UPDATE event_entries SET status = 'withdrawn'
      WHERE registration_id = ? AND event_name = ? AND status = 'confirmed'`,
  )
    .bind(session.registrationId, name)
    .run()

  if (!result.meta.changes) throw new ApiError('not_found', "You aren't entered for that.")

  await audit.record(c.env, {
    action: 'event.withdraw',
    entity: 'event_entry',
    entityId: name,
    after: { registrationId: session.registrationId },
  })

  return c.json({ ok: true })
})
