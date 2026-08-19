/**
 * PYREXIA 2026 — registration configuration.
 *
 * Two separate things live here:
 *  1. the delegate pass catalogue (what you buy to get onto the island), and
 *  2. the per-event entry forms (what you fill in once you're aboard).
 *
 * Event forms are derived: each territory has a default shape, and only the
 * events that genuinely differ carry an override. That keeps 60+ events
 * maintainable instead of hand-writing 60+ schemas.
 */

import { territories, type Territory } from './events'

/* ------------------------------------------------------------------ *
 * Delegate passes
 * ------------------------------------------------------------------ */

/**
 * FLIP TO `true` ONCE THE CORE TEAM SIGNS OFF ON THE FEE CARD.
 * While it's false the pass step shows a "provisional" notice so nobody
 * treats these numbers as final.
 */
export const PRICING_ANNOUNCED = false

export type PassTier = {
  id: string
  name: string
  /** Rupees. PLACEHOLDER until PRICING_ANNOUNCED flips — replace with the real fee card. */
  amount: number
  blurb: string
  includes: string[]
  /** Shown as the recommended card. */
  featured?: boolean
}

export const DELEGATE_PASSES: PassTier[] = [
  {
    id: 'voyager',
    name: 'Voyager Pass',
    amount: 1499,
    blurb: 'The full five-day voyage — every territory, every night.',
    includes: [
      'Entry to all five days',
      'Entry to every competitive event',
      'All star nights',
      'Delegate kit & ID',
    ],
    featured: true,
  },
  {
    id: 'daysail',
    name: 'Day Sail',
    amount: 599,
    blurb: 'One day on the island, chosen at check-in.',
    includes: ['Entry for a single day', 'Events running that day', 'Delegate ID'],
  },
  {
    id: 'crew',
    name: 'Crew Pass',
    amount: 999,
    blurb: 'For AIIMS Rishikesh students sailing with the home crew.',
    includes: [
      'Entry to all five days',
      'Entry to every competitive event',
      'All star nights',
      'Requires an AIIMS Rishikesh student ID',
    ],
  },
]

export type DelegateCategory =
  | 'AIIMS Rishikesh Student'
  | 'Outstation Delegate'
  | 'Faculty'
  | 'Guest'

export const DELEGATE_CATEGORIES: DelegateCategory[] = [
  'AIIMS Rishikesh Student',
  'Outstation Delegate',
  'Faculty',
  'Guest',
]

/* ------------------------------------------------------------------ *
 * Per-event entry forms
 * ------------------------------------------------------------------ */

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
  /** Inclusive bounds on the number of members *besides* nobody — the registrant counts as member 1. */
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
    placeholder: 'Competitions, years of practice — keep it short.',
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
    note: 'Shortlisting happens after this form — the crew will reach out with audition details.',
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
  Metallica: { participation: 'solo', teamSize: undefined },
  Euphonia: {
    participation: 'solo',
    teamSize: undefined,
    fields: [F.instrument, F.performanceTitle, F.duration],
  },
  'Battle of Bands': {
    participation: 'team',
    teamSize: { min: 3, max: 8 },
    fields: [F.performanceTitle, F.duration, F.genre],
  },
  'Rhythm Revolution': { participation: 'solo', teamSize: undefined, fields: [F.genre, F.language] },

  /* Thespians */
  'Comic Combat': { participation: 'solo', teamSize: undefined, fields: [F.duration, F.language] },
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

  /* Littmania */
  'Bilingual Debate': {
    participation: 'duo',
    teamSize: { min: 2, max: 2 },
    fields: [F.language, F.topicPreference],
  },
  Taboo: { participation: 'duo', teamSize: { min: 2, max: 2 }, fields: [] },
  'Literary Treasure Hunt': { participation: 'team', teamSize: { min: 2, max: 4 }, fields: [] },
  'Biocrux Jr & Sr': { participation: 'team', teamSize: { min: 2, max: 3 }, fields: [] },
  Cognizzia: { participation: 'team', teamSize: { min: 2, max: 3 }, fields: [] },
  Cineholic: { participation: 'team', teamSize: { min: 2, max: 3 }, fields: [] },
  'Anime No Tatakae': { participation: 'team', teamSize: { min: 2, max: 3 }, fields: [] },
  'Hindi Gyan Utsav': { participation: 'team', teamSize: { min: 2, max: 3 }, fields: [] },

  /* Alfresco */
  'Paper Dance': { participation: 'duo', teamSize: { min: 2, max: 2 } },
  'Evening Amore': { participation: 'duo', teamSize: { min: 2, max: 2 } },
  'Soul Sync': { participation: 'duo', teamSize: { min: 2, max: 2 } },
  'Treasure Hunt': { participation: 'team', teamSize: { min: 2, max: 5 } },
  'Squid Game': { participation: 'team', teamSize: { min: 2, max: 6 } },
  'Capture and Conquer': { participation: 'solo-or-team', teamSize: { min: 2, max: 3 } },

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

/** Every event a delegate can actually enter (the opening ceremony and star nights aren't entries). */
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
