/**
 * PYREXIA 2026: registration configuration.
 *
 * Two separate things live here:
 *  1. the registration tiers (Basic Registration, and the Festival Pass
 *     add-on covering the full festival programme), and
 *  2. the per-event entry forms (what you fill in once you're aboard).
 *
 * Event forms are derived: each territory has a default shape, and only the
 * events that genuinely differ carry an override. That keeps 60+ events
 * maintainable instead of hand-writing 60+ schemas.
 */

import { territories, type Territory } from './events'

/* ------------------------------------------------------------------ *
 * Registration tiers
 * ------------------------------------------------------------------ */

/**
 * Which territories are taking event entries.
 *
 * A constant, on purpose. Opening entries is a decision with a rulebook, a fee
 * and a set of coordinators behind it, and it should arrive the same way those
 * do. `api/src/data/events.ts` holds the same set and is what actually decides;
 * this copy is only so sixty cards can label themselves without a round trip.
 */
export const OPEN_TERRITORIES: ReadonlySet<string> = new Set<string>()

export const isTerritoryOpen = (id: string) => OPEN_TERRITORIES.has(id)

/** Rupees. Basic Registration is mandatory for everyone who enters the fest. */
export const BASIC_AMOUNT = 500
/** Rupees, charged *on top of* Basic Registration. Covers the full programme. */
export const DELEGATE_ADDON = 2200

/**
 * The payment gateway's cut, added on top of every amount on this page.
 *
 * Razorpay takes 2% plus 18% GST on that fee. The server computes the exact
 * paise (see `api/src/lib/pricing.ts`); this is only for saying so out loud
 * before somebody reaches the checkout.
 */
export const CONVENIENCE_NOTE = 'Payment gateway charges (2.36%) are added at checkout.'

/** One line on the payment summary. */
export type PassLine = { label: string; amount: number }

export type PassTier = {
  id: string
  name: string
  /** Compact label for tight surfaces (the pass card, chips). */
  short: string
  /** Rupees actually charged for this tier: the sum of `lines`. */
  amount: number
  blurb: string
  includes: string[]
  /** What this tier deliberately does not cover. */
  excludes?: string[]
  /** Itemised breakdown, so the delegate add-on never looks like a second full price. */
  lines: PassLine[]
  /** Shown as the recommended card. */
  featured?: boolean
}

/**
 * Two tiers, and the second contains the first:
 *  - Basic Registration (BR): campus entry, and the right to compete.
 *  - Festival Pass: BR plus a ₹2200 add-on covering the whole programme.
 * Nobody buys the Festival Pass alone, so its `amount` is the full BR + add-on.
 *
 * The wording across every surface describes levels of *festival access*, not
 * admission sold to a particular performance. What it still has to do is leave
 * a buyer in no doubt: somebody who takes Basic Registration alone needs to
 * know the wider programme is not part of it, or they reach a gate and are
 * turned away, which is a worse outcome than any phrasing it avoided.
 */
export const DELEGATE_PASSES: PassTier[] = [
  {
    id: 'basic',
    name: 'Basic Registration',
    short: 'BR',
    amount: BASIC_AMOUNT,
    blurb: 'Campus entry. Every voyager needs one to set foot on the island.',
    includes: [
      'Campus entry, all five days',
      'Register for and compete in any event',
      'Delegate ID & kit',
    ],
    excludes: ['The pro nights and the wider programme, which the Festival Pass covers'],
    lines: [{ label: 'Basic Registration', amount: BASIC_AMOUNT }],
  },
  {
    id: 'delegate',
    name: 'Festival Pass',
    short: 'BR + Festival Pass',
    amount: BASIC_AMOUNT + DELEGATE_ADDON,
    blurb: `Basic Registration plus access to the full programme across the island, the pro nights included. Add ₹${DELEGATE_ADDON}.`,
    includes: [
      'Everything in Basic Registration',
      'Full access to the festival programme, the pro nights included',
      'Festival Pass, ID & kit',
    ],
    lines: [
      { label: 'Basic Registration', amount: BASIC_AMOUNT },
      { label: 'Festival Pass · full programme', amount: DELEGATE_ADDON },
    ],
    featured: true,
  },
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
    placeholder: 'Competitions, years of practice. Keep it short.',
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
    note: 'Shortlisting happens after this form; the crew will reach out with audition details.',
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
  // Singles are paired by the organisers, so a solo entry is a real option.
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
