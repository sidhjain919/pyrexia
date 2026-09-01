/**
 * Per-event entry forms, copied from the site's src/data/registration.ts.
 *
 * Only the *form* half is here. Prices are deliberately absent: the API reads
 * those from the products table so no file can ever disagree with what someone
 * was actually charged.
 */

import { territories, type Territory } from './territories.ts'

/**
 * Which territories are taking event entries.
 *
 * A constant, on purpose. Opening entries is a decision with a rulebook, a fee
 * and a set of coordinators behind it, and it should arrive the same way those
 * do: in a commit somebody reviewed. Alfresco is open for 2026; the rest are
 * still being finalised.
 *
 * The site keeps its own copy in `src/data/registration.ts`, and this one is
 * what actually decides: `POST /api/me/events` checks it before writing.
 */
export const OPEN_TERRITORIES: ReadonlySet<string> = new Set<string>()

export function isTerritoryOpen(id: string): boolean {
  return OPEN_TERRITORIES.has(id)
}

/** Every territory that could be opened, with its current state. */
export function openTerritories() {
  return territories
    .filter((t) => !t.noRegister)
    .map((t) => ({
      id: t.id,
      code: t.code,
      name: t.territory,
      events: t.events.length,
      open: OPEN_TERRITORIES.has(t.id),
    }))
}

export type FieldType = 'text' | 'textarea' | 'select' | 'number' | 'url'

export type ExtraField = {
  id: string
  label: string
  type: FieldType
  required?: boolean
  options?: string[]
  placeholder?: string
  help?: string
}

export type Participation = 'solo' | 'duo' | 'team' | 'solo-or-team'

export type EventForm = {
  participation: Participation
  /** Inclusive bounds on the number of members *besides* nobody, the registrant counts as member 1. */
  teamSize?: { min: number; max: number }
  fields: ExtraField[]
  /** Rendered as a note above the form. */
  note?: string
}

const F = {
  performanceTitle: {
    id: 'performanceTitle',
    label: 'Performance / piece title',
    type: 'text',
    required: true,
    placeholder: 'What are you presenting?',
  },
  duration: {
    id: 'duration',
    label: 'Duration (minutes)',
    type: 'number',
    required: true,
    placeholder: 'e.g. 5',
  },
  trackLink: {
    id: 'trackLink',
    label: 'Backing track link',
    type: 'url',
    placeholder: 'Google Drive / YouTube link',
    help: 'Share a link the tech crew can download before the fest.',
  },
  language: {
    id: 'language',
    label: 'Language',
    type: 'text',
    placeholder: 'e.g. Hindi, English, Tamil',
  },
  genre: { id: 'genre', label: 'Genre / style', type: 'text', placeholder: 'e.g. Kathak, hip-hop' },
  instrument: {
    id: 'instrument',
    label: 'Instrument',
    type: 'text',
    required: true,
    placeholder: 'What do you play?',
  },
  gamerTag: {
    id: 'gamerTag',
    label: 'In-game name / ID',
    type: 'text',
    required: true,
    placeholder: 'Your player ID',
  },
  platform: {
    id: 'platform',
    label: 'Platform',
    type: 'select',
    required: true,
    options: ['Mobile', 'PC', 'Console'],
  },
  sportsPosition: {
    id: 'sportsPosition',
    label: 'Position / role',
    type: 'text',
    placeholder: 'e.g. wicket-keeper, striker',
  },
  weightClass: {
    id: 'weightClass',
    label: 'Weight category (kg)',
    type: 'number',
    required: true,
    placeholder: 'e.g. 74',
  },
  experience: {
    id: 'experience',
    label: 'Prior experience',
    type: 'textarea',
    placeholder: 'Competitions, years of practice, keep it short.',
  },
  materials: {
    id: 'materials',
    label: 'Materials you will bring',
    type: 'textarea',
    placeholder: 'Brushes, colours, clay… anything you need on the table.',
  },
  topicPreference: {
    id: 'topicPreference',
    label: 'Preferred side / topic',
    type: 'text',
    placeholder: 'Optional',
  },
} satisfies Record<string, ExtraField>

/** Default shape for every event in a territory, unless the event overrides it. */
const territoryDefaults: Record<string, EventForm> = {
  chorea: {
    participation: 'solo-or-team',
    teamSize: { min: 2, max: 12 },
    fields: [F.genre, F.performanceTitle, F.duration, F.trackLink],
  },
  sinfonia: {
    participation: 'solo-or-team',
    teamSize: { min: 2, max: 8 },
    fields: [F.performanceTitle, F.language, F.duration, F.trackLink],
  },
  thespians: {
    participation: 'team',
    teamSize: { min: 2, max: 15 },
    fields: [F.performanceTitle, F.duration, F.language],
  },
  velocity: {
    participation: 'team',
    teamSize: { min: 5, max: 18 },
    fields: [F.sportsPosition, F.experience],
  },
  chronos: {
    participation: 'solo',
    fields: [F.experience],
    note: 'Shortlisting happens after this form: the crew will reach out with audition details.',
  },
  littmania: { participation: 'solo', fields: [F.language, F.topicPreference] },
  kalakriti: { participation: 'solo', fields: [F.materials] },
  alfresco: { participation: 'solo', fields: [] },
  thunderbolt: {
    participation: 'team',
    teamSize: { min: 2, max: 6 },
    fields: [F.gamerTag, F.platform],
  },
  fahrenheit: { participation: 'solo', fields: [] },
  auriga: { participation: 'solo', fields: [] },
}

/** Only events whose shape genuinely differs from their territory's default. */
const eventOverrides: Record<string, Partial<EventForm>> = {
  /* Chorea */
  Adaptune: { participation: 'solo', teamSize: undefined, fields: [F.genre] },
  'Nritya Sangam': { participation: 'solo-or-team', teamSize: { min: 2, max: 10 } },
  'Street Blaze': { participation: 'team', teamSize: { min: 4, max: 15 } },

  /* Sinfonia */
  Tarang: { participation: 'solo', teamSize: undefined },
  Metallica: {
    participation: 'solo',
    teamSize: undefined,
    fields: [F.instrument, F.performanceTitle, F.duration],
  },
  Euphonia: { participation: 'solo', teamSize: undefined },
  'Battle of Bands': {
    participation: 'team',
    teamSize: { min: 3, max: 8 },
    fields: [F.performanceTitle, F.duration, F.genre],
  },
  'Rhythm Revolution': { participation: 'solo', teamSize: undefined, fields: [F.genre, F.language] },

  /* Thespians */
  'Echoes of Expression': { participation: 'solo', teamSize: undefined, fields: [F.duration] },
  'Nukkad Natak': { participation: 'team', teamSize: { min: 5, max: 20 } },

  /* Velocity */
  Cricket: { teamSize: { min: 11, max: 16 } },
  Football: { teamSize: { min: 11, max: 18 } },
  Basketball: { teamSize: { min: 5, max: 10 } },
  Volleyball: { teamSize: { min: 6, max: 12 } },
  Futsal: { teamSize: { min: 5, max: 10 } },
  Kabaddi: { teamSize: { min: 7, max: 12 } },
  'Table Tennis': { participation: 'solo-or-team', teamSize: { min: 2, max: 2 }, fields: [F.experience] },
  Badminton: { participation: 'solo-or-team', teamSize: { min: 2, max: 2 }, fields: [F.experience] },
  Powerlifting: { participation: 'solo', teamSize: undefined, fields: [F.weightClass, F.experience] },
  Carrom: { participation: 'solo-or-team', teamSize: { min: 2, max: 2 }, fields: [] },
  Chess: { participation: 'solo', teamSize: undefined, fields: [F.experience] },

  /* Littmania. Team sizes are provisional until the rulebook lands. */
  Oratio: {
    participation: 'duo',
    teamSize: { min: 2, max: 2 },
    fields: [F.language, F.topicPreference],
  },
  Taboo: { participation: 'duo', teamSize: { min: 2, max: 2 }, fields: [] },
  'Literary Escape Room': { participation: 'team', teamSize: { min: 2, max: 4 }, fields: [] },
  Cognizzia: { participation: 'team', teamSize: { min: 2, max: 3 }, fields: [] },
  Cineholics: { participation: 'team', teamSize: { min: 2, max: 3 }, fields: [] },
  'Anime no Tatakai': { participation: 'team', teamSize: { min: 2, max: 3 }, fields: [] },

  /* Alfresco, straight from the 2026 informals rulebook. */
  'Evening Amore': { participation: 'solo-or-team', teamSize: { min: 2, max: 2 } },
  'Capture and Conquer': { participation: 'solo-or-team', teamSize: { min: 2, max: 4 } },
  'Grab O Mania': { participation: 'team', teamSize: { min: 4, max: 4 } },
  'Squid Game': { participation: 'solo', teamSize: undefined },
  Pictionary: { participation: 'team', teamSize: { min: 3, max: 5 } },
  'Paper Dance': { participation: 'duo', teamSize: { min: 2, max: 2 } },
  'Balloon Burst': { participation: 'duo', teamSize: { min: 2, max: 2 } },
  'Treasure Hunt': { participation: 'team', teamSize: { min: 2, max: 4 } },
  'Songstra Vaganza': { participation: 'team', teamSize: { min: 2, max: 4 } },
  Tambola: { participation: 'solo', teamSize: undefined },
  'Musical Chairs': { participation: 'solo', teamSize: undefined },
  'Soul Sync': { participation: 'duo', teamSize: { min: 2, max: 2 } },
  'Drape It': { participation: 'duo', teamSize: { min: 2, max: 2 } },
  'Dumb Charades': { participation: 'team', teamSize: { min: 3, max: 5 } },
  'Swift Mingle': { participation: 'solo', teamSize: undefined },

  /* Thunderbolt */
  BGMI: { participation: 'team', teamSize: { min: 4, max: 5 } },
  FIFA: { participation: 'solo', teamSize: undefined },
  'COD: Mobile': { participation: 'team', teamSize: { min: 4, max: 5 } },
  Tekken: { participation: 'solo', teamSize: undefined },
  'Mortal Kombat': { participation: 'solo', teamSize: undefined },
}

export type ResolvedEvent = {
  name: string
  tag: string
  territory: Territory
  form: EventForm
}

const byName = new Map<string, { t: Territory; tag: string }>()
for (const t of territories) {
  for (const e of t.events) byName.set(e.name, { t, tag: e.tag })
}

/** Every event a delegate can actually enter (the opening ceremony and pro nights aren't entries). */
export const registerableEvents = territories
  .filter((t) => !t.noRegister)
  .flatMap((t) => t.events.map((e) => ({ name: e.name, tag: e.tag, territory: t })))

/**
 * The entry form for one event, or `null` if the name isn't a real event.
 * Merges the territory default with any per-event override.
 */
export function resolveEvent(name: string): ResolvedEvent | null {
  const hit = byName.get(name)
  if (!hit) return null
  const base = territoryDefaults[hit.t.id] ?? { participation: 'solo' as const, fields: [] }
  const over = eventOverrides[name] ?? {}
  return {
    name,
    tag: hit.tag,
    territory: hit.t,
    form: {
      participation: over.participation ?? base.participation,
      // `undefined` in an override means "explicitly no team", so check the key.
      teamSize: 'teamSize' in over ? over.teamSize : base.teamSize,
      fields: over.fields ?? base.fields,
      note: over.note ?? base.note,
    },
  }
}

/** True when this event can involve more than one person. */
export function allowsTeam(form: EventForm) {
  return form.participation !== 'solo' && !!form.teamSize
}

/** True when the entrant must bring a team (no solo option). */
export function requiresTeam(form: EventForm) {
  return (form.participation === 'team' || form.participation === 'duo') && !!form.teamSize
}
