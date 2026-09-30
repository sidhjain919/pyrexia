/**
 * Event entry.
 *
 *   GET    /api/events/openings   which verticals are taking entries
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
 * The client never sends an amount. It sends a variant id, and the price for
 * that id comes from `data/fees.ts`. Where a band is priced per head it also
 * sends a squad, but the *count* is taken from the squad the server stores,
 * never from a number the client claims.
 *
 * Teams enter once. Whoever registers lists their crew, pays, and is done:
 * there is no invitation, no token and no half-built squad waiting on someone
 * else to click a link. The names are what the desk checks against, which is
 * all the rulebooks ask for.
 */

import { Hono } from 'hono'

import type { Env } from '../types.ts'
import { ApiError, readJson } from '../lib/http.ts'
import { newEntryId, newOrderId } from '../lib/ids.ts'
import { allowsTeam, requiresTeam, resolveEvent } from '../data/events.ts'
import { parseEntrant, parseEntry } from '../lib/entry.ts'
import {
  closedEventNames,
  everOpenedTerritoryIds,
  isEventOpen,
  listOpenings,
  openTerritoryIds,
} from '../data/openings.ts'
import { feeFor } from '../data/fees.ts'
import { conveniencePaise } from '../lib/pricing.ts'
import { createOrder, razorpayConfig } from '../lib/razorpay.ts'
import { readToken, resolveSession } from '../lib/session.ts'
import * as audit from '../lib/audit.ts'
import { requestSheetSync } from '../jobs/sheets.ts'

export const events = new Hono<{ Bindings: Env }>()

/**
 * Which territories are taking entries.
 *
 * Public and cheap: the events grid needs it to choose between "Register" and
 * "Coming soon" for seventy cards, and asking per card would be seventy
 * requests.
 */
events.get('/events/openings', async (c) => {
  const [open, closed, everOpened, rows] = await Promise.all([
    openTerritoryIds(c.env),
    closedEventNames(c.env),
    everOpenedTerritoryIds(c.env),
    listOpenings(c.env),
  ])
  return c.json({
    open: [...open],
    /** Have taken entries at some point. Lets a shut card say which kind of shut. */
    everOpened: [...everOpened],
    /** Events shut on their own switch inside an open vertical. */
    closedEvents: [...closed],
    territories: rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      events: r.events,
      open: r.open,
    })),
  })
})

events.get('/events/:name', async (c) => {
  const name = decodeURIComponent(c.req.param('name'))
  const resolved = resolveEvent(name)
  if (!resolved) throw new ApiError('not_found', "That event isn't on the chart.")

  const session = await resolveSession(c.env, readToken(c.req.raw.headers))
  const open = await isEventOpen(c.env, resolved.name)
  // Whether this vertical has ever taken entries, so a shut form can say
  // "closed" rather than inviting somebody to wait for one that is over.
  const everOpened = (await everOpenedTerritoryIds(c.env)).has(resolved.territory.id)
  const fee = feeFor(name)

  let eligible = false
  /** Bands this person already holds a confirmed place in. */
  let enteredVariants: string[] = []
  /**
   * Set when this person is entering an event that waives Basic Registration
   * without holding it: the form must ask who they are, prefilled with
   * whatever an earlier entry left on file.
   */
  let entrant: { name: string; phone: string; college: string } | null = null

  if (session) {
    const entitlement = await c.env.DB.prepare(
      `SELECT 1 AS ok FROM entitlements
        WHERE registration_id = ? AND product_id = 'basic' AND revoked_at IS NULL`,
    )
      .bind(session.registrationId)
      .first<{ ok: number }>()
    eligible = !!entitlement || !resolved.requiresBasic

    if (!entitlement && !resolved.requiresBasic) {
      const row = await c.env.DB.prepare(
        'SELECT name, phone, college FROM registrations WHERE id = ?',
      )
        .bind(session.registrationId)
        .first<{ name: string; phone: string; college: string }>()
      entrant = { name: row?.name ?? '', phone: row?.phone ?? '', college: row?.college ?? '' }
    }

    const { results } = await c.env.DB.prepare(
      `SELECT COALESCE(fee_variant, 'standard') AS variant FROM event_entries
        WHERE registration_id = ? AND event_name = ? AND status = 'confirmed'`,
    )
      .bind(session.registrationId, name)
      .all<{ variant: string }>()
    enteredVariants = results.map((r) => r.variant)
  }

  // An event with one price band can only be entered once, so "entered" is a
  // yes or no. One with several is entered per band, and the form greys out
  // only the bands already held.
  const single = !fee || fee.variants.length === 1
  const entered = single ? enteredVariants.length > 0 : false

  return c.json({
    name: resolved.name,
    tag: resolved.tag,
    territory: { id: resolved.territory.id, code: resolved.territory.code, name: resolved.territory.territory },
    /** Filename under the site's /rulebooks, where this vertical's PDF lives. */
    rulebook: resolved.territory.rulebook ?? null,
    /** Set for every Thunderbolt bracket and the Battle of Bands screening: entry happens on the crew's own form. */
    externalForm: resolved.externalForm ?? null,
    formTitle: resolved.formTitle ?? null,
    formNote: resolved.formNote ?? null,
    open,
    everOpened,
    fee: fee && {
      unit: fee.unit,
      variants: fee.variants.map((v) => ({
        id: v.id,
        label: v.label,
        amountPaise: v.amountPaise,
        perHead: !!v.perHead,
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
    /** False for an event anyone can enter without Basic Registration. */
    requiresBasic: resolved.requiresBasic,
    signedIn: !!session,
    eligible,
    entrant,
    entered,
    enteredVariants,
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

  // Thunderbolt's brackets are run and paid for on the e-gaming crew's own
  // Google Forms. Accepting an entry here would leave somebody believing they
  // were in a tournament nobody had entered them into.
  if (resolved.externalForm) {
    throw new ApiError(
      'forbidden',
      `${resolved.name} takes its entries on its own form. Open it from the event card.`,
    )
  }

  // Checked here as well as on the way in: the client knowing a form is shut
  // is a courtesy, this is the rule.
  if (!(await isEventOpen(c.env, resolved.name))) {
    throw new ApiError('forbidden', `Entries for ${resolved.name} are not open right now.`)
  }

  // Basic Registration stands between a person and every event except the
  // few that waive it. Checked here rather than trusted from the client.
  const entitlement = await c.env.DB.prepare(
    `SELECT 1 AS ok FROM entitlements
      WHERE registration_id = ? AND product_id = 'basic' AND revoked_at IS NULL`,
  )
    .bind(session.registrationId)
    .first<{ ok: number }>()

  if (!entitlement && resolved.requiresBasic) {
    throw new ApiError(
      'payment_required',
      'Complete your Basic Registration before entering an event.',
    )
  }

  const { asTeam, teamName, headCount, answersJson, membersJson, priced, bandId, fieldErrors } =
    parseEntry(resolved, body)
  const fee = feeFor(name)

  // Somebody playing without Basic has told us nothing but an email address.
  // The entry is the first place they are asked who they are.
  const entrant = entitlement ? null : parseEntrant(body.entrant)
  if (entrant) Object.assign(fieldErrors, entrant.errors)

  if (Object.keys(fieldErrors).length) {
    throw new ApiError('validation_failed', 'Some answers need another look.', {
      fields: fieldErrors,
    })
  }

  // Written onto the account itself, not the entry, so a second entry is
  // prefilled and the sheet and the confirmation email both have a name. It
  // cannot collide with anybody: the one-number-per-person index only covers
  // confirmed registrations, and this one is not confirmed until Basic is paid,
  // at which point the registration form overwrites all three anyway.
  if (entrant) {
    await c.env.DB.prepare(
      `UPDATE registrations SET name = ?, phone = ?, college = ?, updated_at = datetime('now')
        WHERE id = ? AND status != 'confirmed'`,
    )
      .bind(entrant.value.name, entrant.value.phone, entrant.value.college, session.registrationId)
      .run()
  }

  // One confirmed place per person per price band. Somebody playing badminton
  // singles *and* doubles is entering two different competitions, and used to
  // be told they were already registered.
  const already = await c.env.DB.prepare(
    `SELECT 1 AS ok FROM event_entries
      WHERE registration_id = ? AND event_name = ?
        AND COALESCE(fee_variant, 'standard') = ? AND status = 'confirmed'`,
  )
    .bind(session.registrationId, name, bandId)
    .first<{ ok: number }>()
  if (already) {
    throw new ApiError(
      'conflict',
      priced && fee && fee.variants.length > 1
        ? `You're already entered for ${resolved.name}, ${priced.label}.`
        : `You're already entered for ${resolved.name}.`,
    )
  }

  const entryId = newEntryId()

  /* ---------- free: settled here and now ---------- */

  if (!priced) {
    try {
      await c.env.DB.prepare(
        `INSERT INTO event_entries
           (id, registration_id, event_name, territory_code, participation, team_name, answers,
            members, head_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          entryId,
          session.registrationId,
          resolved.name,
          resolved.territory.code,
          asTeam ? 'team' : 'solo',
          asTeam ? teamName : null,
          answersJson,
          membersJson,
          headCount,
        )
        .run()
    } catch {
      throw new ApiError('conflict', `You're already entered for ${resolved.name}.`)
    }

    await audit.record(c.env, {
      action: 'event.enter',
      entity: 'event_entry',
      entityId: entryId,
      after: {
        registrationId: session.registrationId,
        eventName: resolved.name,
        headCount,
      },
    })
    await requestSheetSync(c.env, resolved.name)

    // A free entry is settled the moment it is written, so nothing else will
    // ever tell this person they are in. Most events on the island charge
    // nothing, which made "no email" the normal experience of entering one:
    // the form closed and that was the only confirmation there was.
    await c.env.JOBS.send({
      kind: 'email.event_entered',
      registrationId: session.registrationId,
      entryId,
    })

    return c.json(
      { entryId, eventName: resolved.name, participation: asTeam ? 'team' : 'solo', checkout: null },
      201,
    )
  }

  /* ---------- paid: written pending, confirmed by the webhook ---------- */

  // Any earlier unfinished attempt at this same band is stood down first, so
  // one person never accumulates a drawer of half-paid entries.
  await c.env.DB.prepare(
    `UPDATE event_entries SET status = 'withdrawn'
      WHERE registration_id = ? AND event_name = ?
        AND COALESCE(fee_variant, 'standard') = ? AND status = 'pending'`,
  )
    .bind(session.registrationId, name, bandId)
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
          members, head_count, fee_paise, fee_variant, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    ).bind(
      entryId,
      session.registrationId,
      resolved.name,
      resolved.territory.code,
      asTeam ? 'team' : 'solo',
      asTeam ? teamName : null,
      answersJson,
      membersJson,
      headCount,
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
      headCount,
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
        name: entrant?.value.name ?? session.name,
        email: session.email,
        phone: contact?.phone ?? '',
      },
      subtotalPaise: priced.amountPaise,
      conveniencePaise: convenience,
      totalPaise,
      feeLabel: priced.label,
      headCount: priced.headCount,
    },
    201,
  )
})

events.delete('/me/events/:name', async (c) => {
  const session = await resolveSession(c.env, readToken(c.req.raw.headers))
  if (!session) throw new ApiError('unauthorised', 'Sign in first.')

  const name = decodeURIComponent(c.req.param('name'))
  // Optional: withdraw one price band rather than every place held in an event
  // that runs several. Absent means all of them, which is what the pass page
  // asks for.
  const variant = c.req.query('variant')

  const result = variant
    ? await c.env.DB.prepare(
        `UPDATE event_entries SET status = 'withdrawn'
          WHERE registration_id = ? AND event_name = ?
            AND COALESCE(fee_variant, 'standard') = ? AND status = 'confirmed'`,
      )
        .bind(session.registrationId, name, variant)
        .run()
    : await c.env.DB.prepare(
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
    after: { registrationId: session.registrationId, variant: variant ?? null },
  })
  await requestSheetSync(c.env, name)

  return c.json({ ok: true })
})
