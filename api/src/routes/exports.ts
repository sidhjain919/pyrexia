/**
 * Excel exports.
 *
 * Four workbooks, one per thing the committee asks for:
 *
 *   /admin/export/registrations   three tabs: every login, then everyone who
 *                                 paid with everything they typed into the
 *                                 form, then the counter's own take
 *   /admin/export/payments        two tabs: every payment attempt, then the
 *                                 counter's own take
 *   /admin/export/events          every confirmed event entry, plus a per-event count
 *   /admin/export/event-sheets    one row per live Google spreadsheet, with its
 *                                 link — the rooming list included
 *
 * Two things matter more here than for a normal download:
 *
 *  - **Every sheet carries the time it was generated.** A list printed on day
 *    one won't contain anyone who registered on day two, and the only way a
 *    person holding paper can know that is if the paper says when it was made.
 *
 *  - **Sorted by name, not by when they registered.** Nobody finds "Meera" in
 *    a list ordered by signup time. The two desk tabs are the exception and
 *    run newest first: they are read while reconciling a cash box against a
 *    shift, which happens in the order the money came in.
 *
 * Amounts land in numeric cells so they sum in Excel; text lands in typed
 * string cells, so a name beginning `=` is never a formula.
 */

import { Hono } from 'hono'

import type { Env } from '../types.ts'
import { ApiError } from '../lib/http.ts'
import { readToken, resolveSession } from '../lib/session.ts'
import { xlsxResponse, type Cell, type Sheet } from '../lib/xlsx.ts'
import * as audit from '../lib/audit.ts'
import { sheetUrl } from '../lib/sheets.ts'
import { registerableEvents, resolveEvent } from '../data/events.ts'
import {
  ACCOMMODATION_SHEET,
  ACCOMMODATION_SHEET_TITLE,
  SEPARATE_SHEET_VERTICALS,
  sheetEvents,
  sweepSheets,
  toIst,
} from '../jobs/sheets.ts'

export const exports_ = new Hono<{ Bindings: Env }>()

exports_.use('/admin/export/*', async (c, next) => {
  const session = await resolveSession(c.env, readToken(c.req.raw.headers))
  if (!session) throw new ApiError('unauthorised', 'Sign in first.')

  const row = await c.env.DB.prepare(
    'SELECT id, email FROM admins WHERE lower(email) = ? AND active = 1',
  )
    .bind(session.email.toLowerCase())
    .first<{ id: string; email: string }>()

  if (!row) throw new ApiError('forbidden', 'You do not have access to this.')

  await audit.record(c.env, {
    action: 'export.download',
    entity: 'export',
    entityId: c.req.path,
    actorId: row.id,
    actorEmail: row.email,
  })

  await next()
})

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

const stamp = () => new Date().toISOString().replace('T', ' ').slice(0, 16)

/** A tab: a title row, a blank row, the headers, then the data. */
function tab(name: string, title: string, headers: string[], rows: Cell[][]): Sheet {
  return {
    name,
    rows: [[`${title} · generated ${stamp()} UTC · PYREXIA 2026`], [], headers, ...rows],
  }
}

function workbook(sheets: Sheet[], filename: string): Response {
  const day = new Date().toISOString().slice(0, 10)
  return xlsxResponse(sheets, `pyrexia-${filename}-${day}.xlsx`)
}

/** Paise → a rupee amount as a real number (2 dp), for a numeric Excel cell. */
const rupees = (paise: unknown) => (typeof paise === 'number' ? Math.round(paise) / 100 : 0)

const yesNo = (v: unknown) => (v ? 'Yes' : 'No')

const tierName = (tier: unknown) => (tier === 1 ? 'Festival Pass' : 'Basic')

/** "basic,delegate" → "Basic + Festival Pass". */
function bought(products: unknown, kind: unknown, eventName: unknown): string {
  if (kind === 'event') return `Event entry: ${String(eventName ?? '')}`
  // Without this an accommodation order printed a blank cell: it has no line
  // items, so there are no product ids below to name it by.
  if (kind === 'accommodation') return 'Accommodation'
  const ids = String(products ?? '').split(',').filter(Boolean)
  const names = ids.map((p) => (p === 'basic' ? 'Basic Registration' : p === 'delegate' ? 'Festival Pass' : p))
  return names.join(' + ')
}

/* ------------------------------------------------------------------ *
 * Registrations: logins, then the paid people with their form answers
 * ------------------------------------------------------------------ */

exports_.get('/admin/export/registrations', async (c) => {
  const { results: logins } = await c.env.DB.prepare(
    `SELECT r.public_code, r.name, r.email, r.phone, r.email_verified, r.created_at,
            EXISTS (SELECT 1 FROM entitlements e
                     WHERE e.registration_id = r.id AND e.product_id = 'basic'
                       AND e.revoked_at IS NULL) AS registered,
            t.tier
       FROM registrations r JOIN registration_tier t ON t.registration_id = r.id
      ORDER BY r.created_at DESC`,
  ).all<Record<string, unknown>>()

  const { results: paid } = await c.env.DB.prepare(
    `SELECT r.public_code, r.name, r.email, r.phone, r.gender, r.college, r.city,
            r.course, r.year, r.emergency_name, r.emergency_phone, r.created_at, t.tier,
            EXISTS (SELECT 1 FROM documents d
                     WHERE d.registration_id = r.id AND d.kind = 'student_id'
                       AND d.purged_at IS NULL)                                   AS has_id,
            EXISTS (SELECT 1 FROM documents d
                     WHERE d.registration_id = r.id AND d.kind = 'aadhaar'
                       AND d.purged_at IS NULL)                                   AS has_govt_id,
            (SELECT coalesce(sum(o.amount_paise), 0) FROM orders o
              WHERE o.registration_id = r.id AND o.status = 'paid')              AS paid,
            (SELECT min(o.paid_at) FROM orders o
              WHERE o.registration_id = r.id AND o.status = 'paid')              AS first_paid_at,
            (SELECT count(*) FROM event_entries ev
              WHERE ev.registration_id = r.id AND ev.status = 'confirmed')       AS entries
       FROM registrations r JOIN registration_tier t ON t.registration_id = r.id
      WHERE EXISTS (SELECT 1 FROM entitlements e
                     WHERE e.registration_id = r.id AND e.product_id = 'basic'
                       AND e.revoked_at IS NULL)
      ORDER BY r.name COLLATE NOCASE`,
  ).all<Record<string, unknown>>()

  /**
   * What the counter took, one row per transaction.
   *
   * A transaction rather than a person, because one delegate can appear twice
   * — registered at the desk on the Monday, upgraded at the desk on the
   * Wednesday — and collapsing those two into one row would hide a payment
   * somebody has to account for. Newest first, which is the order a shift is
   * reconciled in.
   */
  const { results: desk } = await c.env.DB.prepare(
    `SELECT r.public_code, r.name, r.email, r.phone, r.college, r.city, r.course, r.year,
            t.tier, o.id AS order_id, o.amount_paise, o.discount_paise, o.method,
            o.collected_by, o.payment_reference, o.paid_at,
            (SELECT group_concat(product_id) FROM order_items i WHERE i.order_id = o.id) AS items
       FROM orders o
       JOIN registrations r ON r.id = o.registration_id
       JOIN registration_tier t ON t.registration_id = r.id
      WHERE o.kind = 'desk' AND o.status = 'paid'
      ORDER BY o.paid_at DESC`,
  ).all<Record<string, unknown>>()

  return workbook(
    [
      tab(
        'Logins',
        'Every account',
        ['Registration No', 'Name', 'Email', 'Mobile', 'Email confirmed', 'Has paid', 'Tier', 'Account created'],
        logins.map((r) => [
          r.public_code, r.name, r.email, r.phone,
          yesNo(r.email_verified), yesNo(r.registered),
          r.registered ? tierName(r.tier) : '',
          r.created_at,
        ] as Cell[]),
      ),
      tab(
        'Registrations',
        'Everyone who paid, with what they entered on the form',
        ['Registration No', 'Name', 'Email', 'Mobile', 'Gender', 'College', 'City',
         'Course', 'Year', 'Emergency Name', 'Emergency Mobile', 'Tier',
         'College ID uploaded', 'Govt ID uploaded', 'Event entries',
         'Paid (INR)', 'First paid on', 'Account created'],
        paid.map((r) => [
          r.public_code, r.name, r.email, r.phone, r.gender, r.college, r.city,
          r.course, r.year, r.emergency_name, r.emergency_phone, tierName(r.tier),
          yesNo(r.has_id), yesNo(r.has_govt_id), r.entries,
          rupees(r.paid), r.first_paid_at, r.created_at,
        ] as Cell[]),
      ),
      tab(
        'Desk registrations',
        'Taken at a counter, newest first',
        ['Registration No', 'Name', 'Email', 'Mobile', 'College', 'City', 'Course', 'Year',
         'Tier now', 'Sold', 'Collected (INR)', 'Discount given (INR)',
         'Method', 'Collected by', 'Payment reference', 'Taken at', 'Order'],
        desk.map((r) => [
          r.public_code, r.name, r.email, r.phone, r.college, r.city, r.course, r.year,
          tierName(r.tier), bought(r.items, 'desk', null),
          rupees(r.amount_paise), rupees(r.discount_paise),
          r.method, r.collected_by ?? '', r.payment_reference ?? '', r.paid_at, r.order_id,
        ] as Cell[]),
      ),
    ],
    'registrations',
  )
})

/* ------------------------------------------------------------------ *
 * Payments: every attempt, whatever happened to it
 * ------------------------------------------------------------------ */

/** Every column the payments workbook prints, for either of its two tabs. */
const PAYMENT_COLUMNS = [
  'Order', 'Registration No', 'Name', 'Email', 'Mobile', 'Bought', 'Channel',
  'Amount charged (INR)', 'of which gateway charge (INR)', 'Discount given (INR)',
  'Razorpay fee (INR)', 'GST on fee (INR)', 'Net to fest (INR)',
  'Method', 'Status', 'Razorpay Order ID', 'Razorpay Payment ID',
  'Collected by', 'Payment reference',
  'Started', 'Paid at', 'Failure reason',
]

/** One payment as a row. Shared, so the desk tab can never drift from the main one. */
function paymentRow(r: Record<string, unknown>): Cell[] {
  const amount = Number(r.amount_paise ?? 0)
  const fee = Number(r.fee_paise ?? 0) + Number(r.tax_paise ?? 0)
  return [
    r.id, r.public_code, r.name, r.email, r.phone,
    bought(r.items, r.kind, r.event_name),
    // Which till it came through. A desk row has no Razorpay ids and
    // no gateway fee, so the two never have to be told apart by eye.
    r.kind === 'desk' ? 'Desk' : 'Online',
    rupees(amount), rupees(r.convenience_paise), rupees(r.discount_paise),
    rupees(r.fee_paise), rupees(r.tax_paise),
    rupees(r.status === 'paid' ? amount - fee : 0),
    r.method, r.status, r.razorpay_order_id, r.razorpay_payment_id,
    r.collected_by ?? '', r.payment_reference ?? '',
    r.created_at, r.paid_at, r.failure_reason,
  ] as Cell[]
}

exports_.get('/admin/export/payments', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT o.id, r.public_code, r.name, r.email, r.phone, o.kind,
            o.amount_paise, o.convenience_paise, o.discount_paise, o.fee_paise, o.tax_paise,
            o.method, o.status, o.razorpay_order_id, o.razorpay_payment_id,
            o.collected_by, o.payment_reference,
            o.created_at, o.paid_at, o.failure_reason,
            (SELECT group_concat(product_id) FROM order_items i WHERE i.order_id = o.id) AS items,
            (SELECT ev.event_name FROM event_entries ev WHERE ev.id = o.event_entry_id) AS event_name
       FROM orders o JOIN registrations r ON r.id = o.registration_id
      ORDER BY o.created_at DESC`,
  ).all<Record<string, unknown>>()

  // The counter's own take, pulled out of the list above rather than fetched
  // again. The same rows appear on both tabs on purpose: the first is the
  // ledger, the second is the one somebody reconciles a cash box against, and
  // a treasurer should not have to filter a thousand rows to find nine.
  const deskRows = results.filter((r) => r.kind === 'desk')

  return workbook(
    [
      tab('Payments', 'Every payment attempt', PAYMENT_COLUMNS, results.map(paymentRow)),
      tab(
        'Desk payments',
        'Taken at a counter, in cash or by UPI',
        PAYMENT_COLUMNS,
        deskRows.map(paymentRow),
      ),
    ],
    'payments',
  )
})

/* ------------------------------------------------------------------ *
 * Events: every confirmed entry, and a count per event
 * ------------------------------------------------------------------ */

exports_.get('/admin/export/events', async (c) => {
  const { results: entries } = await c.env.DB.prepare(
    `SELECT ev.event_name, ev.territory_code, ev.participation, ev.team_name,
            ev.members, ev.head_count, ev.answers, ev.fee_paise, ev.fee_variant, ev.created_at,
            r.public_code, r.name, r.email, r.phone, r.college, r.course, r.year, t.tier
       FROM event_entries ev
       JOIN registrations r ON r.id = ev.registration_id
       JOIN registration_tier t ON t.registration_id = r.id
      WHERE ev.status = 'confirmed'
      ORDER BY ev.territory_code, ev.event_name, coalesce(ev.team_name, '') COLLATE NOCASE,
               r.name COLLATE NOCASE`,
  ).all<Record<string, unknown>>()

  const { results: summary } = await c.env.DB.prepare(
    `SELECT event_name, territory_code, count(*) AS entries,
            sum(CASE WHEN participation = 'team' THEN 1 ELSE 0 END) AS team_entries,
            coalesce(sum(head_count), 0) AS people,
            coalesce(sum(fee_paise), 0) AS fees_paise
       FROM event_entries WHERE status = 'confirmed'
      GROUP BY event_name, territory_code ORDER BY territory_code, event_name`,
  ).all<Record<string, unknown>>()

  // Every event asks different questions, so the answers are flattened into
  // one readable cell rather than a shifting set of columns.
  const answers = (raw: unknown): string => {
    try {
      const a = JSON.parse(String(raw ?? '{}')) as Record<string, string>
      return Object.entries(a)
        .filter(([, v]) => String(v ?? '').trim())
        .map(([k, v]) => `${k}: ${v}`)
        .join('; ')
    } catch {
      return ''
    }
  }

  // A team enters once, so the squad is on the entry rather than on rows of
  // its own. Flattened into one cell for the same reason the answers are: the
  // desk needs to read a list of names, not join two sheets on a phone.
  const squad = (raw: unknown): string => {
    try {
      const list = JSON.parse(String(raw ?? '[]')) as { name?: string; phone?: string }[]
      if (!Array.isArray(list)) return ''
      return list
        .map((m) => (m.phone ? `${m.name} (${m.phone})` : String(m.name ?? '')))
        .filter(Boolean)
        .join('; ')
    } catch {
      return ''
    }
  }

  return workbook(
    [
      tab(
        'Entries',
        'Every confirmed event entry',
        ['Event', 'Territory', 'Registration No', 'Name', 'Email', 'Mobile', 'College',
         'Course', 'Year', 'Tier', 'Solo/Team', 'Team name', 'People', 'Team-mates',
         'Fee (INR)', 'Fee band', 'Answers', 'Entered on'],
        entries.map((r) => [
          r.event_name, r.territory_code, r.public_code, r.name, r.email, r.phone, r.college,
          r.course, r.year, tierName(r.tier), r.participation, r.team_name ?? '',
          r.head_count ?? 1, squad(r.members),
          rupees(r.fee_paise), r.fee_variant ?? '', answers(r.answers), r.created_at,
        ] as Cell[]),
      ),
      tab(
        'Summary',
        'Entries per event',
        ['Event', 'Territory', 'Entries', 'of which teams', 'People taking part',
         'Entry fees collected (INR)'],
        summary.map((r) => [
          r.event_name, r.territory_code, r.entries, r.team_entries, r.people,
          rupees(r.fees_paise),
        ] as Cell[]),
      ),
    ],
    'events',
  )
})

/* ------------------------------------------------------------------ *
 * Accommodation: the rooming list the desk works from
 * ------------------------------------------------------------------ */

exports_.get('/admin/export/accommodation', async (c) => {
  const { results: bookings } = await c.env.DB.prepare(
    `SELECT b.public_code, b.gender, b.sharing, b.ac, b.days, b.arrival_date,
            b.arrival_time, b.name, b.email, b.phone, b.college, b.course,
            b.rate_paise, b.fee_paise, b.created_at,
            r.public_code AS delegate_code, t.tier
       FROM accommodation_bookings b
       JOIN registrations r ON r.id = b.registration_id
       JOIN registration_tier t ON t.registration_id = r.id
      WHERE b.status = 'confirmed'
      ORDER BY b.gender, b.sharing, b.ac DESC, b.arrival_date, b.name COLLATE NOCASE`,
  ).all<Record<string, unknown>>()

  // What the accommodation team actually plans from: how many bodies per room
  // type, and therefore how many rooms of it they need to have ready.
  const { results: occupancy } = await c.env.DB.prepare(
    `SELECT gender, sharing, ac, count(*) AS people,
            coalesce(sum(fee_paise), 0) AS collected_paise
       FROM accommodation_bookings WHERE status = 'confirmed'
      GROUP BY gender, sharing, ac
      ORDER BY gender, sharing, ac DESC`,
  ).all<Record<string, unknown>>()

  const { results: arrivals } = await c.env.DB.prepare(
    `SELECT arrival_date, gender, count(*) AS people
       FROM accommodation_bookings WHERE status = 'confirmed'
      GROUP BY arrival_date, gender ORDER BY arrival_date, gender`,
  ).all<Record<string, unknown>>()

  const room = (r: Record<string, unknown>) =>
    `${r.sharing} seater ${r.ac === 1 ? 'AC' : 'Non-AC'}`

  /** Rooms needed, rounded up: five people in 2-seaters is three rooms, not two. */
  const roomsNeeded = (people: unknown, sharing: unknown) =>
    typeof people === 'number' && typeof sharing === 'number' && sharing > 0
      ? Math.ceil(people / sharing)
      : ''

  return workbook(
    [
      tab(
        'Bookings',
        'Every confirmed accommodation booking',
        ['Reference', 'Gender', 'Room', 'Nights', 'Arriving', 'Arrival time', 'Name', 'Mobile',
         'Email', 'College', 'Course', 'Registration No', 'Tier', 'Rate/day (INR)',
         'Paid for room (INR)', 'Booked on'],
        bookings.map((r) => [
          r.public_code, r.gender, room(r), r.days, r.arrival_date, r.arrival_time ?? '',
          r.name, r.phone, r.email, r.college, r.course, r.delegate_code, tierName(r.tier),
          rupees(r.rate_paise), rupees(r.fee_paise), r.created_at,
        ] as Cell[]),
      ),
      tab(
        'Occupancy',
        'People per room type, and the rooms that implies',
        ['Gender', 'Room', 'People', 'Rooms needed', 'Collected (INR)'],
        occupancy.map((r) => [
          r.gender, room(r), r.people, roomsNeeded(r.people, r.sharing),
          rupees(r.collected_paise),
        ] as Cell[]),
      ),
      tab(
        'Arrivals',
        'Who lands on which day, for staffing the desk',
        ['Arriving', 'Gender', 'People'],
        arrivals.map((r) => [r.arrival_date, r.gender, r.people] as Cell[]),
      ),
    ],
    'accommodation',
  )
})

/* ------------------------------------------------------------------ *
 * Event sheets: where each event's live Google Sheet is
 * ------------------------------------------------------------------ */

exports_.get('/admin/export/event-sheets', async (c) => {
  // Look for new sheets and queue a catch-up for any that are behind, but not
  // while the admin waits: asking Google takes a good fifteen seconds, and the
  // links below come from what the database already knows.
  c.executionCtx.waitUntil(
    sweepSheets(c.env).catch((err) => console.error('sheet sweep after export failed', err)),
  )

  const { results: places } = await c.env.DB.prepare(
    'SELECT event_name, spreadsheet_id, synced_at, last_error FROM event_sheets',
  ).all<{ event_name: string; spreadsheet_id: string; synced_at: string | null; last_error: string | null }>()
  const byEvent = new Map(places.map((s) => [s.event_name, s]))

  const { results: counts } = await c.env.DB.prepare(
    `SELECT event_name, count(*) AS n FROM event_entries
      WHERE status = 'confirmed' GROUP BY event_name`,
  ).all<{ event_name: string; n: number }>()
  const entries = new Map(counts.map((r) => [r.event_name, r.n]))

  /*
   * One row per spreadsheet, matching what is in the Drive folder: a vertical's
   * spreadsheet with its events as tabs, or one Velocity event's own. Grouped
   * by spreadsheet id rather than by vertical, so the rows are whatever the
   * folder really holds. Rows follow the order events appear on the site.
   */
  type Book = { vertical: string; events: string[]; synced: string[]; errors: string[] }
  const books = new Map<string, Book>()
  const unplaced: string[] = []

  for (const e of sheetEvents) {
    const place = byEvent.get(e.name)
    if (!place) {
      unplaced.push(e.name)
      continue
    }
    const book = books.get(place.spreadsheet_id) ?? { vertical: e.territory.code, events: [], synced: [], errors: [] }
    book.events.push(e.name)
    if (place.synced_at) book.synced.push(place.synced_at)
    if (place.last_error) book.errors.push(e.name)
    books.set(place.spreadsheet_id, book)
  }

  /*
   * The rooming list, which is a spreadsheet in the same folder but not an
   * event, so the loop above cannot see it.
   *
   * Without this row its link appeared nowhere in the portal at all: the
   * accommodation workbook carries the bookings but not the live sheet, and
   * this tab is where somebody looks for a link. A file nobody can find is
   * the same as a file that was never made.
   */
  const stay = byEvent.get(ACCOMMODATION_SHEET)
  const stayCount = stay
    ? await c.env.DB.prepare(
        `SELECT count(*) AS n FROM accommodation_bookings WHERE status = 'confirmed'`,
      ).first<{ n: number }>()
    : null

  const rows: Cell[][] = [...books.entries()].map(([id, book]) => {
    const own = book.events.length === 1 && SEPARATE_SHEET_VERTICALS.has(
      sheetEvents.find((e) => e.name === book.events[0])?.territory.id ?? '',
    )
    const filling = book.events.length - book.synced.length
    return [
      own ? `${book.vertical} · ${book.events[0]}` : book.vertical,
      book.vertical,
      { link: sheetUrl(id), text: 'Open spreadsheet' },
      own ? 1 : book.events.length,
      own ? '' : book.events.join(', '),
      book.events.reduce((sum, name) => sum + (entries.get(name) ?? 0), 0),
      book.synced.length ? toIst(book.synced.sort().at(-1)!) : '',
      book.errors.length
        ? `Last write failed for: ${book.errors.join(', ')} (retried automatically)`
        : filling
          ? `Filling in ${filling} tab(s)…`
          : 'Live',
    ]
  })

  if (stay) {
    rows.push([
      ACCOMMODATION_SHEET_TITLE,
      // Not a vertical, and saying so beats inventing one.
      '—',
      { link: sheetUrl(stay.spreadsheet_id), text: 'Open spreadsheet' },
      1,
      'Bookings',
      stayCount?.n ?? 0,
      stay.synced_at ? toIst(stay.synced_at) : '',
      stay.last_error ? 'Last write failed (retried automatically)' : 'Live',
    ])
  }

  if (unplaced.length) {
    rows.push([
      'Not set up yet', '', '', unplaced.length, unplaced.join(', '),
      unplaced.reduce((sum, name) => sum + (entries.get(name) ?? 0), 0), '',
      'Run setUp in the Apps Script, then publish a new version',
    ])
  }

  // Events that don't take entries here at all, kept apart so the first tab
  // lists only the fest's own spreadsheets.
  const external = registerableEvents
    .map((e) => ({ e, form: resolveEvent(e.name)?.externalForm }))
    .filter((x): x is { e: (typeof registerableEvents)[number]; form: string } => !!x.form)
    .map(({ e, form }) => [e.name, e.territory.code, { link: form, text: 'Open the crew’s Google Form' }] as Cell[])

  return workbook(
    [
      tab(
        'Spreadsheets',
        `${books.size + (stay ? 1 : 0)} live Google spreadsheets: one per vertical with a tab per event, one per Velocity event, and the accommodation rooming list`,
        ['Spreadsheet', 'Vertical', 'Link', 'Tabs', 'Events inside', 'Confirmed entries',
         'Last changed (IST)', 'Status'],
        rows,
      ),
      tab(
        'External forms',
        'Events that take entries on their own Google Form, not on the site',
        ['Event', 'Vertical', 'Form'],
        external,
      ),
    ],
    'event-sheets',
  )
})
