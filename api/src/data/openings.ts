/**
 * Which verticals, and which single events, are taking entries.
 *
 * This used to be a constant in a file, on the theory that opening entries is
 * a decision with a rulebook and a fee behind it and should arrive in a commit
 * somebody reviewed. That held right up until the first time a coordinator
 * needed a form open at nine in the evening. It is now rows the committee
 * flips from the dashboard, and every change is written to the audit log,
 * which is the accountability the commit was really providing.
 *
 * Two layers, and an event is open only when both say so:
 *
 *   event_openings   one row per vertical. The master switch: closing Velocity
 *                    closes all eleven sports at once.
 *   event_switches   one row per event, absent meaning open. For closing one
 *                    badminton category that has filled up without touching
 *                    the ten sports beside it.
 *
 * `POST /api/me/events` checks both before writing. The site keeps an
 * optimistic default so seventy cards can label themselves on first paint,
 * but nothing the client believes is load-bearing.
 */

import type { Env } from '../types.ts'
import { territories } from './territories.ts'

/** Every id the openings table is allowed to hold. */
export const OPENABLE: ReadonlySet<string> = new Set(
  territories.filter((t) => !t.noRegister).map((t) => t.id),
)

export function isOpenable(territoryId: string): boolean {
  return OPENABLE.has(territoryId)
}

/** Event name → its vertical, for the events that can be entered at all. */
const eventTerritory = new Map<string, string>()
for (const t of territories) {
  if (t.noRegister) continue
  for (const e of t.events) eventTerritory.set(e.name, t.id)
}

export function isSwitchable(eventName: string): boolean {
  return eventTerritory.has(eventName)
}

/** The set of open vertical ids, straight from the table. */
export async function openTerritoryIds(env: Env): Promise<Set<string>> {
  const { results } = await env.DB.prepare(
    'SELECT territory_id FROM event_openings WHERE open = 1',
  ).all<{ territory_id: string }>()
  // A row for a vertical that no longer exists is ignored rather than trusted.
  return new Set(results.map((r) => r.territory_id).filter(isOpenable))
}

/**
 * Verticals that have taken entries at some point, open or not right now.
 *
 * The difference between a card that says "Coming Soon" and one that says
 * "Entries Closed". Nothing under a vertical can have been open before the
 * vertical was, so this answers for its events too.
 */
export async function everOpenedTerritoryIds(env: Env): Promise<Set<string>> {
  const { results } = await env.DB.prepare(
    'SELECT territory_id FROM event_openings WHERE was_open = 1',
  ).all<{ territory_id: string }>()
  return new Set(results.map((r) => r.territory_id).filter(isOpenable))
}

/** Events shut on their own switch, regardless of their vertical. */
export async function closedEventNames(env: Env): Promise<Set<string>> {
  const { results } = await env.DB.prepare(
    'SELECT event_name FROM event_switches WHERE open = 0',
  ).all<{ event_name: string }>()
  return new Set(results.map((r) => r.event_name).filter(isSwitchable))
}

export async function isTerritoryOpen(env: Env, territoryId: string): Promise<boolean> {
  if (!isOpenable(territoryId)) return false
  const row = await env.DB.prepare(
    'SELECT open FROM event_openings WHERE territory_id = ?',
  )
    .bind(territoryId)
    .first<{ open: number }>()
  return row?.open === 1
}

/**
 * Whether one event is taking entries right now.
 *
 * The vertical has to be open *and* the event must not have been shut on its
 * own switch. No switch row means the event follows its vertical.
 */
export async function isEventOpen(env: Env, eventName: string): Promise<boolean> {
  const territoryId = eventTerritory.get(eventName)
  if (!territoryId) return false
  if (!(await isTerritoryOpen(env, territoryId))) return false
  const row = await env.DB.prepare(
    'SELECT open FROM event_switches WHERE event_name = ?',
  )
    .bind(eventName)
    .first<{ open: number }>()
  return row ? row.open === 1 : true
}

export type EventSwitchRow = {
  name: string
  /** This event's own switch. Meaningful only while the vertical is open. */
  open: boolean
  updatedAt: string | null
  updatedBy: string | null
}

export type OpeningRow = {
  id: string
  code: string
  subtitle: string
  name: string
  events: number
  open: boolean
  updatedAt: string | null
  updatedBy: string | null
  eventList: EventSwitchRow[]
}

/**
 * Every vertical that could be opened, with its current state and the state
 * of each event under it.
 *
 * Driven by the territory list rather than by the tables, so an event added
 * to the rulebooks appears in the dashboard with a switch already on instead
 * of silently missing until someone remembers to insert a row.
 */
export async function listOpenings(env: Env): Promise<OpeningRow[]> {
  const [{ results: verticals }, { results: switches }] = await Promise.all([
    env.DB.prepare(
      'SELECT territory_id, open, updated_at, updated_by FROM event_openings',
    ).all<{ territory_id: string; open: number; updated_at: string; updated_by: string | null }>(),
    env.DB.prepare(
      'SELECT event_name, open, updated_at, updated_by FROM event_switches',
    ).all<{ event_name: string; open: number; updated_at: string; updated_by: string | null }>(),
  ])

  const byId = new Map(verticals.map((r) => [r.territory_id, r]))
  const byEvent = new Map(switches.map((r) => [r.event_name, r]))

  return territories
    .filter((t) => !t.noRegister)
    .map((t) => {
      const row = byId.get(t.id)
      return {
        id: t.id,
        code: t.code,
        subtitle: t.subtitle,
        name: t.territory,
        events: t.events.length,
        open: row?.open === 1,
        updatedAt: row?.updated_at ?? null,
        updatedBy: row?.updated_by ?? null,
        eventList: t.events.map((e) => {
          const sw = byEvent.get(e.name)
          return {
            name: e.name,
            open: sw ? sw.open === 1 : true,
            updatedAt: sw?.updated_at ?? null,
            updatedBy: sw?.updated_by ?? null,
          }
        }),
      }
    })
}

/** Open or close one vertical. Returns false when the id isn't one we run. */
export async function setOpening(
  env: Env,
  territoryId: string,
  open: boolean,
  by: string,
): Promise<boolean> {
  if (!isOpenable(territoryId)) return false
  await env.DB.prepare(
    `INSERT INTO event_openings (territory_id, open, was_open, updated_at, updated_by)
     VALUES (?, ?, ?, datetime('now'), ?)
     ON CONFLICT (territory_id) DO UPDATE SET
       open = excluded.open,
       -- Latched, never cleared: it is what lets a card say "closed" rather
       -- than "coming soon" once entries have actually been and gone.
       was_open = max(event_openings.was_open, excluded.open),
       updated_at = excluded.updated_at,
       updated_by = excluded.updated_by`,
  )
    .bind(territoryId, open ? 1 : 0, open ? 1 : 0, by)
    .run()
  return true
}

/** Open or close one event on its own switch. Returns false for a name we don't run. */
export async function setEventSwitch(
  env: Env,
  eventName: string,
  open: boolean,
  by: string,
): Promise<boolean> {
  if (!isSwitchable(eventName)) return false
  await env.DB.prepare(
    `INSERT INTO event_switches (event_name, open, updated_at, updated_by)
     VALUES (?, ?, datetime('now'), ?)
     ON CONFLICT (event_name) DO UPDATE SET
       open = excluded.open,
       updated_at = excluded.updated_at,
       updated_by = excluded.updated_by`,
  )
    .bind(eventName, open ? 1 : 0, by)
    .run()
  return true
}
