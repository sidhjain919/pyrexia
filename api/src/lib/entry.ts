/**
 * Reading one event entry off a request.
 *
 * Shared by the two ways in: somebody entering online from the event card, and
 * the desk entering them in person. Both must hold an entry to the same rules
 * (the form's required answers, the team-size bounds, a valid price band) or
 * the desk becomes the way around them.
 */

import type { ResolvedEvent } from '../data/events.ts'
import { requiresTeam } from '../data/events.ts'
import { feeFor, priceEntry, type PricedEntry } from '../data/fees.ts'
import { normalisePhone } from './validate.ts'

/** A team-mate as the captain listed them. Not an account, just a name to check. */
export type Member = { name: string; phone: string }

/** At most this many people on one entry, whatever the form says. A guard, not a rule. */
const MAX_MEMBERS = 40

/**
 * Read the squad off the request body.
 *
 * Anything that isn't a usable name is dropped rather than rejected: a captain
 * who left the last two rows of a fifteen-row squad blank meant to, and losing
 * their whole submission over it would be absurd.
 */
function readMembers(raw: unknown): Member[] {
  if (!Array.isArray(raw)) return []
  const out: Member[] = []
  for (const item of raw.slice(0, MAX_MEMBERS)) {
    if (!item || typeof item !== 'object') continue
    const m = item as Record<string, unknown>
    const name = String(m.name ?? '').trim().slice(0, 120)
    const phone = String(m.phone ?? '').trim().slice(0, 20)
    if (name.length < 2) continue
    out.push({ name, phone })
  }
  return out
}

export type ParsedEntry = {
  asTeam: boolean
  teamName: string
  /** The crew, captain excluded. */
  members: Member[]
  /** The captain counts. A solo entry covers one person. */
  headCount: number
  /** Only the form's own fields, trimmed, as they are stored. */
  answersJson: string
  membersJson: string
  /** Null for an event that costs nothing to enter. */
  priced: PricedEntry | null
  /** The band this entry holds a place in: one confirmed place per band. */
  bandId: string
  fieldErrors: Record<string, string>
}

/**
 * `optional` is the desk's mode: the event's own questions and the team name
 * may be left blank. The rules that decide whether the entry is allowed at
 * all (team size, a team event entered as a team, a price band) still apply.
 */
export function parseEntry(
  resolved: ResolvedEvent,
  body: Record<string, unknown>,
  { optional = false }: { optional?: boolean } = {},
): ParsedEntry {
  const asTeam = body.participation === 'team'
  const teamName = String(body.teamName ?? '').trim().slice(0, 120)
  const answers = (body.answers ?? {}) as Record<string, unknown>
  const variantId = body.feeVariant == null ? null : String(body.feeVariant)
  const members = asTeam ? readMembers(body.members) : []
  const headCount = asTeam ? members.length + 1 : 1

  const fieldErrors: Record<string, string> = {}
  for (const field of resolved.form.fields) {
    const value = String(answers[field.id] ?? '').trim()
    if (field.required && !value && !optional) fieldErrors[field.id] = 'Required.'
    if (value.length > 1000) fieldErrors[field.id] = 'That answer is too long.'
  }

  if (requiresTeam(resolved.form) && !asTeam) {
    fieldErrors.participation = 'This event is entered as a team.'
  }

  if (asTeam) {
    if (teamName.length < 2 && !(optional && !teamName)) fieldErrors.teamName = 'Give your crew a name.'

    const size = resolved.form.teamSize
    if (size) {
      if (headCount < size.min) {
        fieldErrors.members = `This event needs ${size.min}–${size.max} people, you included. Add ${size.min - headCount} more.`
      } else if (headCount > size.max) {
        fieldErrors.members = `This event allows at most ${size.max} people, you included.`
      }
    }
  }

  const fee = feeFor(resolved.name)
  const priced = fee ? priceEntry(resolved.name, variantId, headCount) : null
  if (fee && !priced) {
    fieldErrors.feeVariant = 'Choose which entry applies to you.'
  }

  return {
    asTeam,
    teamName,
    members,
    headCount,
    answersJson: JSON.stringify(
      Object.fromEntries(resolved.form.fields.map((f) => [f.id, String(answers[f.id] ?? '').trim()])),
    ),
    membersJson: JSON.stringify(members),
    priced,
    bandId: priced?.id ?? 'standard',
    fieldErrors,
  }
}

/**
 * Who is playing, for somebody entering without Basic Registration.
 *
 * Basic is where a name, a mobile and a college are normally collected. An
 * event that waives it has to ask for them itself, or its sheet lists an email
 * address and nothing else.
 */
export type Entrant = { name: string; phone: string; college: string }

export function parseEntrant(
  raw: unknown,
  { optional = false }: { optional?: boolean } = {},
): { value: Entrant; errors: Record<string, string> } {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const value: Entrant = {
    name: String(p.name ?? '').trim().replace(/\s+/g, ' ').slice(0, 120),
    phone: normalisePhone(String(p.phone ?? '')),
    college: String(p.college ?? '').trim().slice(0, 160),
  }

  const errors: Record<string, string> = {}
  // At the desk each may be skipped; whatever is typed is still checked.
  const check = (v: string) => !optional || v !== ''
  if (check(value.name) && value.name.length < 2) errors.entrantName = 'Your full name.'
  if (check(value.phone) && !/^[6-9]\d{9}$/.test(value.phone)) errors.entrantPhone = 'A 10-digit mobile number.'
  if (check(value.college) && value.college.length < 2) errors.entrantCollege = 'Your college or institution.'

  return { value, errors }
}
