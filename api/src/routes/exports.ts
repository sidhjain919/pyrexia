/**
 * Excel exports.
 *
 * Three workbooks, one per thing the committee asks for:
 *
 *   /admin/export/registrations   two tabs: every login, then everyone who paid
 *                                 with everything they typed into the form
 *   /admin/export/payments        every payment attempt, whatever became of it
 *   /admin/export/events          every confirmed event entry, plus a per-event count
 *
 * Two things matter more here than for a normal download:
 *
 *  - **Every sheet carries the time it was generated.** A list printed on day
 *    one won't contain anyone who registered on day two, and the only way a
 *    person holding paper can know that is if the paper says when it was made.
 *
 *  - **Sorted by name, not by when they registered.** Nobody finds "Meera" in
 *    a list ordered by signup time.
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
    rows: [[`${title} — generated ${stamp()} UTC — PYREXIA 2026`], [], headers, ...rows],
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
    ],
    'registrations',
  )
})

/* ------------------------------------------------------------------ *
 * Payments: every attempt, whatever happened to it
 * ------------------------------------------------------------------ */

exports_.get('/admin/export/payments', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT o.id, r.public_code, r.name, r.email, r.phone, o.kind,
            o.amount_paise, o.convenience_paise, o.fee_paise, o.tax_paise,
            o.method, o.status, o.razorpay_order_id, o.razorpay_payment_id,
            o.created_at, o.paid_at, o.failure_reason,
            (SELECT group_concat(product_id) FROM order_items i WHERE i.order_id = o.id) AS items,
            (SELECT ev.event_name FROM event_entries ev WHERE ev.id = o.event_entry_id) AS event_name
       FROM orders o JOIN registrations r ON r.id = o.registration_id
      ORDER BY o.created_at DESC`,
  ).all<Record<string, unknown>>()

  return workbook(
    [
      tab(
        'Payments',
        'Every payment attempt',
        ['Order', 'Registration No', 'Name', 'Email', 'Mobile', 'Bought',
         'Amount charged (INR)', 'of which gateway charge (INR)',
         'Razorpay fee (INR)', 'GST on fee (INR)', 'Net to fest (INR)',
         'Method', 'Status', 'Razorpay Order ID', 'Razorpay Payment ID',
         'Started', 'Paid at', 'Failure reason'],
        results.map((r) => {
          const amount = Number(r.amount_paise ?? 0)
          const fee = Number(r.fee_paise ?? 0) + Number(r.tax_paise ?? 0)
          return [
            r.id, r.public_code, r.name, r.email, r.phone,
            bought(r.items, r.kind, r.event_name),
            rupees(amount), rupees(r.convenience_paise),
            rupees(r.fee_paise), rupees(r.tax_paise),
            rupees(r.status === 'paid' ? amount - fee : 0),
            r.method, r.status, r.razorpay_order_id, r.razorpay_payment_id,
            r.created_at, r.paid_at, r.failure_reason,
          ] as Cell[]
        }),
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
            ev.answers, ev.fee_paise, ev.fee_variant, ev.created_at,
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

  return workbook(
    [
      tab(
        'Entries',
        'Every confirmed event entry',
        ['Event', 'Territory', 'Registration No', 'Name', 'Email', 'Mobile', 'College',
         'Course', 'Year', 'Tier', 'Solo/Team', 'Team name', 'Fee (INR)', 'Fee band',
         'Answers', 'Entered on'],
        entries.map((r) => [
          r.event_name, r.territory_code, r.public_code, r.name, r.email, r.phone, r.college,
          r.course, r.year, tierName(r.tier), r.participation, r.team_name ?? '',
          rupees(r.fee_paise), r.fee_variant ?? '', answers(r.answers), r.created_at,
        ] as Cell[]),
      ),
      tab(
        'Summary',
        'Entries per event',
        ['Event', 'Territory', 'Entries', 'of which teams', 'Entry fees collected (INR)'],
        summary.map((r) => [
          r.event_name, r.territory_code, r.entries, r.team_entries, rupees(r.fees_paise),
        ] as Cell[]),
      ),
    ],
    'events',
  )
})
