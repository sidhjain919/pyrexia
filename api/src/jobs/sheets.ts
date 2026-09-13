/**
 * One live Google Sheet per event.
 *
 * The committee wanted what a Google Form gives them: open a sheet, watch the
 * entries arrive. The difference is that the database, not the sheet, is the
 * record. Each sheet is a mirror of that event's confirmed entries, rewritten
 * whenever they change:
 *
 *   an entry is confirmed, withdrawn or refunded  →  a `sheets.sync` job for
 *                                                    that event, seconds later
 *   every 15 minutes                              →  a sweep that finds new
 *                                                    sheets and anything a
 *                                                    lost job left stale
 *
 * A rewrite that would change nothing is skipped by comparing a hash of the
 * rows, which keeps a launch-hour rush from queueing on the script's lock.
 * The writing itself is done by an Apps Script running as the sheets' owner;
 * see lib/sheets.ts and scripts/event-sheets.mjs.
 *
 * Because the first tab is rewritten, anything typed into it by hand is lost on
 * the next change. Volunteers keep their own notes on a second tab.
 */

import type { Env } from '../types.ts'
import { registerableEvents, resolveEvent, allowsTeam } from '../data/events.ts'
import { feeFor } from '../data/fees.ts'
import {
  SheetsScriptError,
  listSheets,
  scriptConfig as config,
  writeSheet,
  type SheetValue,
} from '../lib/sheets.ts'

/** How the setup script labels a sheet, so a renamed file is still found. */
export const SHEET_TAG = 'pyrexia-event:'
/** The same, for a spreadsheet that holds a whole vertical, one tab per event. */
export const VERTICAL_TAG = 'pyrexia-vertical:'

/**
 * Verticals whose events each get a spreadsheet of their own. Every other
 * vertical shares one spreadsheet, with a tab per event. Velocity is the
 * exception because each sport is run by its own crew, who share their sheet
 * with nobody else's.
 */
export const SEPARATE_SHEET_VERTICALS = new Set(['velocity'])

/**
 * Events that get a sheet: every one entered on this site. The Thunderbolt
 * brackets and the Battle of Bands screening take entries on the crews' own
 * Google Forms, which already have sheets of their own.
 */
export const sheetEvents = registerableEvents.filter((e) => !resolveEvent(e.name)?.externalForm)

/**
 * Ask for an event's sheet to be brought up to date.
 *
 * Never throws: a sheet is a convenience, and nothing a student is waiting on
 * may fail because Google or the queue had a bad moment. The sweep catches up.
 */
export async function requestSheetSync(env: Env, eventName: string | null | undefined): Promise<void> {
  if (!eventName || !config(env)) return
  try {
    await env.JOBS.send({ kind: 'sheets.sync', eventName })
  } catch (err) {
    console.error('could not queue sheet sync', eventName, err)
  }
}

/** The same, for callers holding an entry id rather than an event name. */
export async function requestSheetSyncForEntry(env: Env, entryId: string | null | undefined): Promise<void> {
  if (!entryId || !config(env)) return
  try {
    const row = await env.DB.prepare('SELECT event_name FROM event_entries WHERE id = ?')
      .bind(entryId)
      .first<{ event_name: string }>()
    await requestSheetSync(env, row?.event_name)
  } catch (err) {
    console.error('could not queue sheet sync for entry', entryId, err)
  }
}

/* ------------------------------------------------------------------ *
 * What goes in a sheet
 * ------------------------------------------------------------------ */

type EntryRow = {
  event_name: string
  public_code: string
  name: string
  phone: string | null
  email: string
  college: string | null
  course: string | null
  year: string | null
  participation: string
  team_name: string | null
  members: string | null
  head_count: number | null
  answers: string | null
  fee_paise: number | null
  fee_variant: string | null
  created_at: string
}

const ENTRY_SQL = `
  SELECT ev.event_name, r.public_code, r.name, r.phone, r.email, r.college, r.course, r.year,
         ev.participation, ev.team_name, ev.members, ev.head_count, ev.answers,
         ev.fee_paise, ev.fee_variant, ev.created_at
    FROM event_entries ev
    JOIN registrations r ON r.id = ev.registration_id
   WHERE ev.status = 'confirmed'`

// Oldest first, the way a form's response sheet fills: a new entry lands at the
// bottom instead of shuffling everybody below it.
const ORDER = ' ORDER BY ev.created_at, ev.id'

/** "2026-09-13 15:34:10" (UTC, as SQLite writes it) → "2026-09-13 21:04" IST. */
export function toIst(utc: string): string {
  const ms = Date.parse(`${utc.replace(' ', 'T')}Z`)
  if (Number.isNaN(ms)) return utc
  return new Date(ms + 330 * 60_000).toISOString().replace('T', ' ').slice(0, 16)
}

function parseJson<T>(raw: string | null, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

/** Header row plus one row per confirmed entry, for one event. */
export function buildGrid(eventName: string, entries: EntryRow[]): SheetValue[][] {
  const form = resolveEvent(eventName)?.form
  const fields = form?.fields ?? []
  const team = form ? allowsTeam(form) : entries.some((e) => e.participation === 'team')
  const fee = feeFor(eventName)
  const banded = (fee?.variants.length ?? 0) > 1

  const headers = [
    '#', 'Registration No', 'Name', 'Mobile', 'Email', 'College', 'Course', 'Year',
    ...(banded ? ['Category'] : []),
    ...(team ? ['Solo/Team', 'Team name', 'People', 'Team-mates'] : []),
    ...fields.map((f) => f.label),
    ...(fee ? ['Fee (INR)'] : []),
    'Entered on (IST)',
  ]

  const rows = entries.map((e, i) => {
    const answers = parseJson<Record<string, string>>(e.answers, {})
    const squad = parseJson<{ name?: string; phone?: string }[]>(e.members, [])
    const band = fee?.variants.find((v) => v.id === (e.fee_variant ?? 'standard'))
    return [
      i + 1, e.public_code, e.name, e.phone ?? '', e.email, e.college ?? '', e.course ?? '', e.year ?? '',
      ...(banded ? [band?.label ?? e.fee_variant ?? ''] : []),
      ...(team
        ? [
            e.participation === 'team' ? 'Team' : 'Solo',
            e.team_name ?? '',
            e.head_count ?? 1,
            (Array.isArray(squad) ? squad : [])
              .map((m) => (m.phone ? `${m.name} (${m.phone})` : String(m.name ?? '')))
              .filter(Boolean)
              .join('; '),
          ]
        : []),
      ...fields.map((f) => String(answers[f.id] ?? '')),
      ...(fee ? [Math.round(e.fee_paise ?? 0) / 100] : []),
      toIst(e.created_at),
    ] as SheetValue[]
  })

  return [headers, ...rows]
}

async function hashGrid(grid: SheetValue[][]): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(grid)))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/* ------------------------------------------------------------------ *
 * Writing one sheet
 * ------------------------------------------------------------------ */

type SheetRecord = {
  event_name: string
  spreadsheet_id: string
  sheet_gid: number
  content_hash: string | null
  last_error: string | null
}

/** The `sheets.sync` job. Throws only for failures worth retrying. */
export async function syncEventSheet(env: Env, eventName: string): Promise<void> {
  const cfg = config(env)
  if (!cfg) return

  const record = await env.DB.prepare(
    `SELECT event_name, spreadsheet_id, sheet_gid, content_hash, last_error
       FROM event_sheets WHERE event_name = ?`,
  )
    .bind(eventName)
    .first<SheetRecord>()
  // No sheet made for this event yet. The sweep writes it once one appears.
  if (!record) return

  // Taken before the read: a write carrying an older snapshot of the entries
  // always carries a smaller version, whichever request reaches Google first.
  const version = Date.now()
  const { results } = await env.DB.prepare(`${ENTRY_SQL} AND ev.event_name = ?${ORDER}`)
    .bind(eventName)
    .all<EntryRow>()

  const grid = buildGrid(eventName, results)
  const hash = await hashGrid(grid)
  if (hash === record.content_hash) {
    // The tab already shows exactly this. An error left on the row came from
    // a retry whose reply Google lost after an earlier write had landed, so
    // it no longer describes the sheet.
    if (record.last_error) {
      await env.DB.prepare('UPDATE event_sheets SET last_error = NULL WHERE event_name = ? AND content_hash = ?')
        .bind(eventName, hash)
        .run()
    }
    return
  }

  let applied: boolean
  try {
    applied = await writeSheet(cfg, record.spreadsheet_id, record.sheet_gid, grid, version)
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 500) : String(err)
    await env.DB.prepare('UPDATE event_sheets SET last_error = ? WHERE event_name = ?')
      .bind(message, eventName)
      .run()
    // A deleted sheet or a misconfigured deployment will not fix itself on
    // retry; the sweep tries again in fifteen minutes, and the error sits on
    // the row (and in the Event Sheets download) meanwhile.
    if (err instanceof SheetsScriptError && !err.retryable) {
      console.error('sheet write refused', eventName, message)
      return
    }
    throw err
  }

  // A newer write already landed, so this hash is not what the sheet shows.
  if (!applied) return

  await env.DB.prepare(
    `UPDATE event_sheets
        SET content_hash = ?, synced_at = datetime('now'), last_error = NULL
      WHERE event_name = ?`,
  )
    .bind(hash, eventName)
    .run()
}

/* ------------------------------------------------------------------ *
 * Finding sheets, and catching up
 * ------------------------------------------------------------------ */

/**
 * Ask the script where each event's tab is, and remember it.
 *
 * The script finds them by tags it wrote itself (a file description, a tab's
 * developer metadata), so renaming a spreadsheet or a tab changes nothing
 * here. Returns how many were found.
 */
export async function discoverSheets(env: Env): Promise<number> {
  const cfg = config(env)
  if (!cfg) return 0

  const known = new Set(sheetEvents.map((e) => e.name))
  const matched = (await listSheets(cfg)).filter((f) => known.has(f.event))

  if (matched.length) {
    // A different spreadsheet or tab for an event means it moved: start that
    // one from nothing rather than trusting the old hash.
    await env.DB.batch(
      matched.map((f) =>
        env.DB.prepare(
          `INSERT INTO event_sheets (event_name, spreadsheet_id, sheet_gid) VALUES (?, ?, ?)
           ON CONFLICT (event_name) DO UPDATE
             SET spreadsheet_id = excluded.spreadsheet_id, sheet_gid = excluded.sheet_gid,
                 content_hash = NULL, synced_at = NULL, last_error = NULL
           WHERE event_sheets.spreadsheet_id != excluded.spreadsheet_id
              OR event_sheets.sheet_gid != excluded.sheet_gid`,
        ).bind(f.event, f.id, f.gid),
      ),
    )
  }
  return matched.length
}

/**
 * The 15-minute sweep: pick up new sheets, then queue a sync for every sheet
 * whose rows no longer match what was last written. Also what fills the sheets
 * the first time, from entries made before any of this existed.
 */
export async function sweepSheets(env: Env): Promise<{ found: number; queued: number }> {
  if (!config(env)) return { found: 0, queued: 0 }

  // Finding sheets asks Google to open every vertical's spreadsheet, which is
  // slow and now and then loses its reply. That must not stop the catch-up
  // below, which only needs the places already on record.
  let found = 0
  try {
    found = await discoverSheets(env)
  } catch (err) {
    console.error('sheet discovery failed; catching up on known sheets', err)
  }

  const [{ results: records }, { results: entries }] = await Promise.all([
    env.DB.prepare('SELECT event_name, content_hash, last_error FROM event_sheets').all<{
      event_name: string
      content_hash: string | null
      last_error: string | null
    }>(),
    env.DB.prepare(`${ENTRY_SQL}${ORDER}`).all<EntryRow>(),
  ])

  const byEvent = new Map<string, EntryRow[]>()
  for (const e of entries) {
    const list = byEvent.get(e.event_name) ?? []
    list.push(e)
    byEvent.set(e.event_name, list)
  }

  const stale: string[] = []
  for (const r of records) {
    const hash = await hashGrid(buildGrid(r.event_name, byEvent.get(r.event_name) ?? []))
    // An error flag is re-checked too: the sync either rewrites the tab or,
    // finding it already current, clears the flag.
    if (hash !== r.content_hash || r.last_error) stale.push(r.event_name)
  }

  // sendBatch takes at most 100 messages.
  for (let i = 0; i < stale.length; i += 100) {
    await env.JOBS.sendBatch(
      stale.slice(i, i + 100).map((eventName) => ({ body: { kind: 'sheets.sync' as const, eventName } })),
    )
  }

  return { found, queued: stale.length }
}
