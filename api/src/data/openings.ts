/**
 * Which verticals are taking entries.
 *
 * This used to be a constant in a file, on the theory that opening entries is
 * a decision with a rulebook and a fee behind it and should arrive in a commit
 * somebody reviewed. That held right up until the first time a coordinator
 * needed a form open at nine in the evening. It is now a row per vertical that
 * the committee flips from the dashboard, and every change is written to the
 * audit log, which is the accountability the commit was really providing.
 *
 * `POST /api/me/events` checks this before writing. The site keeps an
 * optimistic default so sixty cards can label themselves on first paint, but
 * nothing the client believes is load-bearing.
 */

import type { Env } from '../types.ts'
import { territories } from './territories.ts'

/** Verticals that are not competitions to enter, so never openable. */
const NOT_OPENABLE = new Set(territories.filter((t) => t.noRegister).map((t) => t.id))

/** Every id the openings table is allowed to hold. */
export const OPENABLE: ReadonlySet<string> = new Set(
  territories.filter((t) => !t.noRegister).map((t) => t.id),
)

export function isOpenable(territoryId: string): boolean {
  return OPENABLE.has(territoryId) && !NOT_OPENABLE.has(territoryId)
}

/** The set of open vertical ids, straight from the table. */
export async function openTerritoryIds(env: Env): Promise<Set<string>> {
  const { results } = await env.DB.prepare(
    'SELECT territory_id FROM event_openings WHERE open = 1',
  ).all<{ territory_id: string }>()
  // A row for a vertical that no longer exists is ignored rather than trusted.
  return new Set(results.map((r) => r.territory_id).filter(isOpenable))
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

export type OpeningRow = {
  id: string
  code: string
  subtitle: string
  name: string
  events: number
  open: boolean
  updatedAt: string | null
  updatedBy: string | null
}

/**
 * Every vertical that could be opened, with its current state.
 *
 * Driven by the territory list rather than by the table, so a vertical added
 * to the rulebooks appears in the dashboard with a switch already off instead
 * of silently missing until someone remembers to insert a row.
 */
export async function listOpenings(env: Env): Promise<OpeningRow[]> {
  const { results } = await env.DB.prepare(
    'SELECT territory_id, open, updated_at, updated_by FROM event_openings',
  ).all<{ territory_id: string; open: number; updated_at: string; updated_by: string | null }>()

  const byId = new Map(results.map((r) => [r.territory_id, r]))

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
    `INSERT INTO event_openings (territory_id, open, updated_at, updated_by)
     VALUES (?, ?, datetime('now'), ?)
     ON CONFLICT (territory_id) DO UPDATE SET
       open = excluded.open,
       updated_at = excluded.updated_at,
       updated_by = excluded.updated_by`,
  )
    .bind(territoryId, open ? 1 : 0, by)
    .run()
  return true
}
