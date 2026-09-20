/**
 * Accommodation.
 *
 *   GET  /api/accommodation      the rate card, whether bookings are open,
 *                                and where this person stands
 *   POST /api/me/accommodation   book a bed and pay for it
 *
 * Modelled on the paid half of `routes/events.ts`, because it is the same
 * problem: money arrives from Razorpay by webhook a second or two after the
 * request that started it, so the booking is written `pending`, an order is
 * attached, and the webhook is what turns it into a bed. A browser that dies
 * between paying and telling us costs nobody their room; the reconciliation
 * sweep settles it within fifteen minutes.
 *
 * The client never sends an amount. It sends a room-type id, a number of days
 * and an arrival date, and `data/accommodation.ts` prices those or refuses.
 *
 * There is no cancellation endpoint, and that is deliberate rather than
 * missing: the accommodation terms say a cancelled booking is not refunded, so
 * there is nothing for a student to self-serve here. The committee cancels a
 * booking from the dashboard when there is a human reason to.
 */

import { Hono } from 'hono'

import type { Env } from '../types.ts'
import { ApiError, readJson } from '../lib/http.ts'
import { newBookingId, newOrderId, newStayCode } from '../lib/ids.ts'
import {
  accommodationSettings,
  ALLOWED_DAYS,
  arrivalDatesFor,
  departureDate,
  priceStay,
  roomLabel,
  ROOM_TYPES,
  SECURITY_DEPOSIT_RUPEES,
} from '../data/accommodation.ts'
import { conveniencePaise } from '../lib/pricing.ts'
import { createOrder, razorpayConfig } from '../lib/razorpay.ts'
import { readToken, resolveSession } from '../lib/session.ts'
import { validateAccommodation } from '../lib/validate.ts'
import * as audit from '../lib/audit.ts'

export const accommodation = new Hono<{ Bindings: Env }>()

/** The shape the site renders a booking from, on the form and on the pass page. */
type BookingRow = {
  id: string
  public_code: string
  gender: string
  sharing: number
  ac: number
  days: number
  arrival_date: string
  arrival_time: string | null
  name: string
  email: string
  phone: string
  college: string
  course: string
  requirements: string | null
  rate_paise: number
  fee_paise: number
  status: string
  created_at: string
}

function present(row: BookingRow) {
  return {
    bookingId: row.id,
    code: row.public_code,
    gender: row.gender,
    sharing: row.sharing,
    ac: row.ac === 1,
    room: roomLabel({ sharing: row.sharing, ac: row.ac === 1 }),
    days: row.days,
    arrivalDate: row.arrival_date,
    arrivalTime: row.arrival_time,
    departureDate: departureDate(row.arrival_date, row.days),
    name: row.name,
    email: row.email,
    phone: row.phone,
    college: row.college,
    course: row.course,
    requirements: row.requirements,
    ratePaise: row.rate_paise,
    feePaise: row.fee_paise,
    status: row.status,
    createdAt: row.created_at,
  }
}

/**
 * The live booking for this registration, if there is one.
 *
 * Confirmed beats pending: somebody who paid and then opened the form again in
 * another tab should be shown the bed they hold, not the attempt they
 * abandoned.
 */
async function currentBooking(env: Env, registrationId: string): Promise<BookingRow | null> {
  return await env.DB.prepare(
    `SELECT * FROM accommodation_bookings
      WHERE registration_id = ? AND status IN ('confirmed', 'pending')
      ORDER BY CASE status WHEN 'confirmed' THEN 0 ELSE 1 END, created_at DESC
      LIMIT 1`,
  )
    .bind(registrationId)
    .first<BookingRow>()
}

/* ------------------------------------------------------------------ *
 * The rate card
 * ------------------------------------------------------------------ */

accommodation.get('/accommodation', async (c) => {
  const settings = await accommodationSettings(c.env)
  const session = await resolveSession(c.env, readToken(c.req.raw.headers))

  let eligible = false
  let prefill: Record<string, string> | null = null
  let booking = null

  if (session) {
    // Basic Registration is the only thing standing between a delegate and a
    // bed, the same rule events use. Checked here rather than trusted.
    const entitlement = await c.env.DB.prepare(
      `SELECT 1 AS ok FROM entitlements
        WHERE registration_id = ? AND product_id = 'basic' AND revoked_at IS NULL`,
    )
      .bind(session.registrationId)
      .first<{ ok: number }>()
    eligible = !!entitlement

    // Everything the booking form would otherwise ask twice. Sent so the form
    // opens filled in, and still editable: the number somebody carries at a
    // fest is often not the one they registered with.
    const reg = await c.env.DB.prepare(
      'SELECT name, email, phone, college, course, gender FROM registrations WHERE id = ?',
    )
      .bind(session.registrationId)
      .first<{
        name: string
        email: string
        phone: string
        college: string
        course: string
        gender: string | null
      }>()

    if (reg) {
      prefill = {
        name: reg.name,
        email: reg.email,
        phone: reg.phone,
        college: reg.college,
        course: reg.course,
        // Only ever a suggestion for which side to show first. A room is
        // allocated by what somebody picks on the form, not by this.
        gender: reg.gender === 'Male' ? 'boys' : reg.gender === 'Female' ? 'girls' : '',
      }
    }

    const row = await currentBooking(c.env, session.registrationId)
    booking = row ? present(row) : null
  }

  return c.json({
    open: settings.open,
    note: settings.note,
    /** Cash, at the desk, refundable. Never charged through the gateway. */
    depositRupees: SECURITY_DEPOSIT_RUPEES,
    allowedDays: ALLOWED_DAYS,
    /** Which days a stay of each length can start on, so the form can narrow it. */
    arrivalDates: Object.fromEntries(ALLOWED_DAYS.map((d) => [d, arrivalDatesFor(d)])),
    rooms: ROOM_TYPES.map((r) => ({
      id: r.id,
      gender: r.gender,
      sharing: r.sharing,
      ac: r.ac,
      label: roomLabel(r),
      ratePaise: r.ratePaise,
    })),
    signedIn: !!session,
    eligible,
    prefill,
    booking,
  })
})

/* ------------------------------------------------------------------ *
 * Booking
 * ------------------------------------------------------------------ */

accommodation.post('/me/accommodation', async (c) => {
  const session = await resolveSession(c.env, readToken(c.req.raw.headers))
  if (!session) throw new ApiError('unauthorised', 'Sign in to book accommodation.')

  // Checked here as well as on the way in: the client knowing the form is shut
  // is a courtesy, this is the rule.
  const settings = await accommodationSettings(c.env)
  if (!settings.open) {
    throw new ApiError(
      'forbidden',
      settings.note || 'Accommodation bookings are not open right now.',
    )
  }

  const entitlement = await c.env.DB.prepare(
    `SELECT 1 AS ok FROM entitlements
      WHERE registration_id = ? AND product_id = 'basic' AND revoked_at IS NULL`,
  )
    .bind(session.registrationId)
    .first<{ ok: number }>()

  if (!entitlement) {
    throw new ApiError(
      'payment_required',
      'Complete your Basic Registration before booking a bed.',
    )
  }

  const body = (await readJson(c)) as Record<string, unknown>

  const { ok, errors, value } = validateAccommodation(body)
  const fieldErrors: Record<string, string> = { ...errors }

  const roomTypeId = String(body.roomTypeId ?? '')
  const days = Number(body.days)
  const arrivalDate = String(body.arrivalDate ?? '')

  // One call decides the room, the length and the date together, because they
  // constrain each other: a five-day stay cannot start on the 13th.
  const priced = priceStay(roomTypeId, days, arrivalDate)
  if (!priced) {
    if (!roomTypeId) fieldErrors.roomTypeId = 'Pick a room.'
    else if (!ALLOWED_DAYS.includes(days)) fieldErrors.days = 'Pick how long you are staying.'
    else if (!arrivalDatesFor(days).includes(arrivalDate)) {
      fieldErrors.arrivalDate = 'Pick a day you can actually arrive on for that length of stay.'
    } else fieldErrors.roomTypeId = 'That room is not one we let.'
  }

  if (!ok || Object.keys(fieldErrors).length) {
    throw new ApiError('validation_failed', 'Some answers need another look.', {
      fields: fieldErrors,
    })
  }

  // Past this point `priced` is non-null: the block above throws otherwise.
  const stay = priced!

  // One bed per person. The unique index enforces this too; catching it here
  // is what turns a constraint violation into a sentence somebody can read.
  const existing = await c.env.DB.prepare(
    `SELECT public_code FROM accommodation_bookings
      WHERE registration_id = ? AND status = 'confirmed'`,
  )
    .bind(session.registrationId)
    .first<{ public_code: string }>()

  if (existing) {
    throw new ApiError(
      'conflict',
      `You already have a bed booked, reference ${existing.public_code}. Ring the accommodation team to change it.`,
    )
  }

  // Any earlier unfinished attempt is stood down first, so one person never
  // accumulates a drawer of half-paid bookings for rooms they did not take.
  await c.env.DB.prepare(
    `UPDATE accommodation_bookings SET status = 'cancelled', updated_at = datetime('now')
      WHERE registration_id = ? AND status = 'pending'`,
  )
    .bind(session.registrationId)
    .run()

  const bookingId = newBookingId()
  const code = newStayCode()
  const convenience = conveniencePaise(stay.feePaise)
  const totalPaise = stay.feePaise + convenience
  const orderId = newOrderId()

  const rzpOrder = await createOrder(razorpayConfig(c.env), {
    amountPaise: totalPaise,
    receipt: orderId,
    notes: {
      registrationId: session.registrationId,
      publicCode: session.publicCode,
      accommodation: stay.label,
      stayCode: code,
    },
  })

  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO accommodation_bookings
         (id, public_code, registration_id, gender, sharing, ac, days,
          arrival_date, arrival_time, name, email, phone, college, course,
          rules_accepted, rate_paise, fee_paise, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 'pending')`,
    ).bind(
      bookingId,
      code,
      session.registrationId,
      stay.room.gender,
      stay.room.sharing,
      stay.room.ac ? 1 : 0,
      stay.days,
      arrivalDate,
      value.arrivalTime || null,
      value.name,
      value.email,
      value.phone,
      value.college,
      value.course,
      stay.ratePaise,
      stay.feePaise,
    ),
    c.env.DB.prepare(
      `INSERT INTO orders (id, registration_id, amount_paise, convenience_paise,
                           kind, accommodation_booking_id, razorpay_order_id, status)
       VALUES (?, ?, ?, ?, 'accommodation', ?, ?, 'created')`,
    ).bind(orderId, session.registrationId, totalPaise, convenience, bookingId, rzpOrder.id),
  ])

  await audit.record(c.env, {
    action: 'accommodation.book',
    entity: 'accommodation_booking',
    entityId: bookingId,
    after: {
      registrationId: session.registrationId,
      code,
      room: stay.room.id,
      days: stay.days,
      arrivalDate,
      feePaise: stay.feePaise,
      status: 'pending',
    },
  })

  return c.json(
    {
      bookingId,
      code,
      orderId,
      checkout: {
        keyId: c.env.RAZORPAY_KEY_ID,
        razorpayOrderId: rzpOrder.id,
        amountPaise: totalPaise,
        currency: 'INR',
        name: value.name,
        email: value.email,
        phone: value.phone,
      },
      room: roomLabel(stay.room),
      days: stay.days,
      arrivalDate,
      departureDate: departureDate(arrivalDate, stay.days),
      ratePaise: stay.ratePaise,
      subtotalPaise: stay.feePaise,
      conveniencePaise: convenience,
      totalPaise,
      depositRupees: SECURITY_DEPOSIT_RUPEES,
    },
    201,
  )
})
