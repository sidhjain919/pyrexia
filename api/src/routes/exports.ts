/**
 * CSV exports.
 *
 * These become the printed sheets your team ticks names off at events and Star
 * Nights, so two things matter more than they would for a normal download:
 *
 *  - **Every sheet carries the time it was generated.** A list printed on day
 *    one won't contain anyone who registered on day two, and the only way a
 *    person holding paper can know that is if the paper says when it was made.
 *
 *  - **Sorted by name, not by when they registered.** Nobody finds "Meera" in
 *    a list ordered by signup time.
 */

import { Hono } from 'hono'

import type { Env } from '../types.ts'
import { ApiError } from '../lib/http.ts'
import { readToken, resolveSession } from '../lib/session.ts'
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

/**
 * Escape one cell.
 *
 * The leading-quote guard is not paranoia: a value starting with `=`, `+`, `-`
 * or `@` is executed as a formula when the file is opened in Excel, and names
 * and team names come from the public. Prefixing a quote makes it text.
 */
function cell(value: unknown): string {
  if (value === null || value === undefined) return ''
  let s = String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function csv(title: string, headers: string[], rows: unknown[][]): string {
  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16)
  return [
    // A title row above the headers, so a printout is never anonymous.
    cell(`${title} — generated ${stamp} UTC — PYREXIA 2026`),
    '',
    headers.map(cell).join(','),
    ...rows.map((r) => r.map(cell).join(',')),
  ].join('\r\n')
}

function download(body: string, filename: string): Response {
  const stamp = new Date().toISOString().slice(0, 10)
  return new Response(`﻿${body}`, {
    headers: {
      // The BOM makes Excel read it as UTF-8, without which ₹ and any
      // non-English name arrive as mojibake.
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="pyrexia-${filename}-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}

const rupees = (paise: unknown) =>
  typeof paise === 'number' ? (paise / 100).toFixed(2) : '0.00'

/* ------------------------------------------------------------------ *
 * Everyone
 * ------------------------------------------------------------------ */

exports_.get('/admin/export/registrations', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT r.public_code, r.name, r.email, r.phone, r.gender, r.college, r.city,
            r.course, r.year, r.emergency_name, r.emergency_phone, r.status,
            r.verification, t.tier, r.created_at,
            (SELECT coalesce(sum(o.amount_paise), 0) FROM orders o
              WHERE o.registration_id = r.id AND o.status = 'paid') AS paid
       FROM registrations r JOIN registration_tier t ON t.registration_id = r.id
      WHERE r.status = 'confirmed'
      ORDER BY r.name COLLATE NOCASE`,
  ).all<Record<string, unknown>>()

  return download(
    csv(
      'All registrations',
      ['Registration No', 'Name', 'Email', 'Mobile', 'Gender', 'College', 'City',
       'Course', 'Year', 'Emergency Name', 'Emergency Mobile', 'Tier',
       'Documents', 'Paid (INR)', 'Registered On'],
      results.map((r) => [
        r.public_code, r.name, r.email, r.phone, r.gender, r.college, r.city,
        r.course, r.year, r.emergency_name, r.emergency_phone,
        r.tier === 1 ? 'Delegate' : 'Basic',
        r.verification, rupees(r.paid), r.created_at,
      ]),
    ),
    'registrations',
  )
})

/* ------------------------------------------------------------------ *
 * Star Nights — who may come in
 * ------------------------------------------------------------------ */

exports_.get('/admin/export/delegates', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT r.public_code, r.name, r.college, r.phone
       FROM registrations r
       JOIN entitlements e ON e.registration_id = r.id
      WHERE e.product_id = 'delegate' AND e.revoked_at IS NULL
        AND r.status = 'confirmed'
      ORDER BY r.name COLLATE NOCASE`,
  ).all<Record<string, unknown>>()

  return download(
    csv(
      'Star Nights — Delegate Card holders',
      ['Registration No', 'Name', 'College', 'Mobile', 'Checked in'],
      // A blank final column, because this sheet exists to be written on.
      results.map((r) => [r.public_code, r.name, r.college, r.phone, '']),
    ),
    'delegates',
  )
})

/* ------------------------------------------------------------------ *
 * One event
 * ------------------------------------------------------------------ */

exports_.get('/admin/export/event', async (c) => {
  const name = (c.req.query('name') ?? '').trim()
  if (!name) throw new ApiError('bad_request', 'Which event? Pass ?name=…')

  const { results } = await c.env.DB.prepare(
    `SELECT r.public_code, r.name, r.college, r.phone, r.course, r.year,
            ev.participation, ev.team_name, ev.answers, ev.created_at, t.tier
       FROM event_entries ev
       JOIN registrations r ON r.id = ev.registration_id
       JOIN registration_tier t ON t.registration_id = r.id
      WHERE ev.event_name = ? AND ev.status = 'confirmed'
      ORDER BY coalesce(ev.team_name, '') COLLATE NOCASE, r.name COLLATE NOCASE`,
  )
    .bind(name)
    .all<Record<string, unknown>>()

  // Every event asks different questions, so the columns are whatever this
  // event's entrants actually answered rather than a fixed shape.
  const answerKeys: string[] = []
  const parsed = results.map((r) => {
    let a: Record<string, string> = {}
    try {
      a = JSON.parse(String(r.answers ?? '{}'))
    } catch {
      /* a malformed row should cost one cell, not the whole sheet */
    }
    for (const k of Object.keys(a)) if (!answerKeys.includes(k)) answerKeys.push(k)
    return { row: r, answers: a }
  })

  return download(
    csv(
      `${name} — entries`,
      ['Registration No', 'Name', 'College', 'Mobile', 'Course', 'Year', 'Tier',
       'Solo/Team', 'Team Name', ...answerKeys, 'Present'],
      parsed.map(({ row, answers }) => [
        row.public_code, row.name, row.college, row.phone, row.course, row.year,
        row.tier === 1 ? 'Delegate' : 'Basic',
        row.participation, row.team_name ?? '',
        ...answerKeys.map((k) => answers[k] ?? ''),
        '',
      ]),
    ),
    `event-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
  )
})

/* ------------------------------------------------------------------ *
 * Everything, for accounting
 * ------------------------------------------------------------------ */

exports_.get('/admin/export/payments', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT o.id, r.public_code, r.name, r.email, o.amount_paise, o.fee_paise,
            o.tax_paise, o.method, o.status, o.razorpay_payment_id, o.paid_at,
            (SELECT group_concat(product_id) FROM order_items i WHERE i.order_id = o.id) AS items
       FROM orders o JOIN registrations r ON r.id = o.registration_id
      ORDER BY o.created_at DESC`,
  ).all<Record<string, unknown>>()

  return download(
    csv(
      'Payments',
      ['Order', 'Registration No', 'Name', 'Email', 'Bought', 'Amount (INR)',
       'Razorpay Fee', 'GST on Fee', 'Net (INR)', 'Method', 'Status',
       'Razorpay Payment ID', 'Paid At'],
      results.map((r) => {
        const amount = Number(r.amount_paise ?? 0)
        const fee = Number(r.fee_paise ?? 0) + Number(r.tax_paise ?? 0)
        return [
          r.id, r.public_code, r.name, r.email, r.items,
          rupees(amount), rupees(r.fee_paise), rupees(r.tax_paise),
          rupees(r.status === 'paid' ? amount - fee : 0),
          r.method, r.status, r.razorpay_payment_id, r.paid_at,
        ]
      }),
    ),
    'payments',
  )
})

/** Which events have entries at all — so nobody prints sixty empty sheets. */
exports_.get('/admin/export/event-list', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT event_name, territory_code, count(*) AS entries
       FROM event_entries WHERE status = 'confirmed'
      GROUP BY event_name ORDER BY territory_code, event_name`,
  ).all<{ event_name: string; territory_code: string; entries: number }>()

  return c.json({
    events: results.map((r) => ({
      name: r.event_name,
      territory: r.territory_code,
      entries: r.entries,
    })),
  })
})
