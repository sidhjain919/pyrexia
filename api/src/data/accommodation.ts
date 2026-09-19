/**
 * The accommodation rate card, from the 2026 rate schedule.
 *
 * The authority on what a bed costs, mirroring `api/src/data/fees.ts` for
 * events. `src/data/accommodation.ts` on the site is the display copy; this
 * one is what gets charged. The client sends a room-type id and a number of
 * days, never an amount.
 *
 * Every rate is per person, per day. The rate schedule also prints a "whole
 * fest" column, and that column is exactly five times the daily rate in all
 * fourteen rows, so there is no package price to model: five days is five days
 * at the daily rate.
 *
 * Paise throughout, like everything else that touches money.
 */

import type { Env } from '../types.ts'

export type Gender = 'boys' | 'girls'

export type RoomType = {
  /** e.g. `boys-3-ac`. What the client sends, and all it sends. */
  id: string
  gender: Gender
  /** People to a room. */
  sharing: number
  ac: boolean
  /** Per person, per day. */
  ratePaise: number
}

/** `2 seater · AC`, for a receipt and for the desk. */
export function roomLabel(room: Pick<RoomType, 'sharing' | 'ac'>): string {
  return `${room.sharing} seater · ${room.ac ? 'AC' : 'Non-AC'}`
}

const rate = (gender: Gender, sharing: number, ac: boolean, rupees: number): RoomType => ({
  id: `${gender}-${sharing}-${ac ? 'ac' : 'nonac'}`,
  gender,
  sharing,
  ac,
  ratePaise: rupees * 100,
})

/**
 * Boys' rooms run to five to a room, girls' rooms stop at four. That is the
 * rate schedule, not an oversight: there are no five-bed rooms in the girls'
 * block. The two blocks are priced identically for the sizes they share, and
 * are still listed separately, because they are allocated by different people
 * and have gone out at different prices before.
 */
export const ROOM_TYPES: readonly RoomType[] = [
  rate('boys', 2, true, 800),
  rate('boys', 2, false, 750),
  rate('boys', 3, true, 700),
  rate('boys', 3, false, 600),
  rate('boys', 4, true, 550),
  rate('boys', 4, false, 500),
  rate('boys', 5, true, 450),
  rate('boys', 5, false, 400),

  rate('girls', 2, true, 800),
  rate('girls', 2, false, 750),
  rate('girls', 3, true, 700),
  rate('girls', 3, false, 600),
  rate('girls', 4, true, 550),
  rate('girls', 4, false, 500),
]

const BY_ID = new Map(ROOM_TYPES.map((r) => [r.id, r]))

export function roomTypeById(id: string): RoomType | null {
  return BY_ID.get(id) ?? null
}

export function roomTypesFor(gender: Gender): RoomType[] {
  return ROOM_TYPES.filter((r) => r.gender === gender)
}

/* ------------------------------------------------------------------ *
 * The stay window
 * ------------------------------------------------------------------ */

/** The five days of the fest, inclusive. */
export const FEST_DAYS = [
  '2026-10-12',
  '2026-10-13',
  '2026-10-14',
  '2026-10-15',
  '2026-10-16',
] as const

/**
 * How long somebody may book for.
 *
 * Four or five, which is what the accommodation team offers. The column
 * constraint allows one through five, so shortening this list is the only
 * change needed if they ever sell a weekend.
 */
export const ALLOWED_DAYS: readonly number[] = [4, 5]

/**
 * The arrival dates a stay of this length can start on.
 *
 * A five-day stay can only begin on the first day. A four-day stay can begin
 * on either of the first two, which is the whole reason arrival is asked for
 * rather than assumed: "four days" alone does not tell the desk whether to
 * expect somebody on the 12th or the 13th.
 */
export function arrivalDatesFor(days: number): string[] {
  if (!ALLOWED_DAYS.includes(days)) return []
  const last = FEST_DAYS.length - days
  return FEST_DAYS.slice(0, last + 1)
}

/** The day they leave, for the receipt. Departure is the morning after the last night. */
export function departureDate(arrival: string, days: number): string | null {
  const start = FEST_DAYS.indexOf(arrival as (typeof FEST_DAYS)[number])
  if (start < 0) return null
  return FEST_DAYS[start + days - 1] ?? null
}

/**
 * `2026-10-12` as `12 October`.
 *
 * A lookup rather than `new Date(...)`. The Worker runs in UTC and the fest
 * runs in IST, and a date-only string parsed as UTC and formatted anywhere
 * east of Greenwich is exactly how a booking for the 12th prints as the 11th
 * on the receipt somebody waves at the desk.
 */
const DAY_NAMES: Record<string, string> = {
  '2026-10-12': '12 October',
  '2026-10-13': '13 October',
  '2026-10-14': '14 October',
  '2026-10-15': '15 October',
  '2026-10-16': '16 October',
}

export function festDate(iso: string | null): string {
  if (!iso) return ''
  return DAY_NAMES[iso] ?? iso
}

/* ------------------------------------------------------------------ *
 * Pricing
 * ------------------------------------------------------------------ */

export type PricedStay = {
  room: RoomType
  days: number
  /** Per person, per day, snapshotted onto the booking. */
  ratePaise: number
  /** rate × days. The line item, before gateway charges. */
  feePaise: number
  label: string
}

/**
 * Price one stay, or refuse to.
 *
 * Returns null rather than throwing for anything a client could have got
 * wrong, so the caller reports it as a field error beside the right control
 * instead of a five hundred.
 */
export function priceStay(roomTypeId: string, days: number, arrival: string): PricedStay | null {
  const room = roomTypeById(roomTypeId)
  if (!room) return null
  if (!Number.isInteger(days) || !ALLOWED_DAYS.includes(days)) return null
  if (!arrivalDatesFor(days).includes(arrival)) return null

  return {
    room,
    days,
    ratePaise: room.ratePaise,
    feePaise: room.ratePaise * days,
    label: `${roomLabel(room)} · ${days} days`,
  }
}

/**
 * The refundable security deposit, in rupees, collected in cash at check-in.
 *
 * Here so that the form, the receipt and the confirmation email all print one
 * number. It is never charged through the gateway: the desk takes it on
 * arrival and returns it at check-out against the hard-copy receipt.
 */
export const SECURITY_DEPOSIT_RUPEES = 500

/* ------------------------------------------------------------------ *
 * The switch
 * ------------------------------------------------------------------ */

export type AccommodationSettings = {
  open: boolean
  /** Shown on the site while closed, so "full" and "not open yet" read differently. */
  note: string | null
  updatedAt: string | null
  updatedBy: string | null
}

const CLOSED: AccommodationSettings = { open: false, note: null, updatedAt: null, updatedBy: null }

/**
 * Whether bookings are being taken, and what to say if not.
 *
 * Deliberately not a capacity check. Nothing in this system counts beds: how
 * many exist is negotiated with the hospitality partners week to week and has
 * never been a number the database could know. This is one row the committee
 * flips when they run out.
 */
export async function accommodationSettings(env: Env): Promise<AccommodationSettings> {
  const row = await env.DB.prepare(
    'SELECT open, note, updated_at, updated_by FROM accommodation_settings WHERE id = 1',
  ).first<{ open: number; note: string | null; updated_at: string; updated_by: string | null }>()

  // A missing row means the migration ran and the insert did not. Closed is
  // the safe reading: better a form nobody can use than beds nobody has.
  if (!row) return CLOSED

  return {
    open: row.open === 1,
    note: row.note,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  }
}

export async function setAccommodationOpen(
  env: Env,
  open: boolean,
  note: string | null,
  by: string,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO accommodation_settings (id, open, note, updated_at, updated_by)
     VALUES (1, ?, ?, datetime('now'), ?)
     ON CONFLICT (id) DO UPDATE SET
       open = excluded.open,
       note = excluded.note,
       updated_at = excluded.updated_at,
       updated_by = excluded.updated_by`,
  )
    .bind(open ? 1 : 0, note, by)
    .run()
}
