/**
 * PYREXIA 2026: registration configuration.
 *
 * Two separate things live here:
 *  1. the registration tiers (Basic Registration, and the Festival Pass
 *     add-on covering the full festival programme), and
 *  2. the per-event entry forms (what you fill in once you're aboard).
 *
 * Event forms are derived: each territory has a default shape, and only the
 * events that genuinely differ carry an override. That keeps 70+ events
 * maintainable instead of hand-writing 70+ schemas. Every team size, round and
 * question here comes from that vertical's final 2026 rulebook.
 */

import { territories, type SubEvent, type Territory } from './events'

/* ------------------------------------------------------------------ *
 * Registration tiers
 * ------------------------------------------------------------------ */

/**
 * Which territories are taking event entries, before the server has said.
 *
 * The real answer lives in the `event_openings` table and arrives from
 * `GET /api/events/openings`; the committee flips it from the dashboard
 * without a deploy. This set is what sixty cards label themselves with on
 * first paint, so a slow network shows the usual state rather than a grid of
 * "Coming Soon" that turns out to be wrong. Nothing is decided here: entering
 * a closed event is refused by the server regardless of what this says.
 */
export const DEFAULT_OPEN_TERRITORIES: ReadonlySet<string> = new Set<string>([
  'alfresco',
  'chronos',
  'kalakriti',
  'littmania',
  'sinfonia',
  'chorea',
  'thespians',
  'velocity',
  'thunderbolt',
])

/** Rupees. Basic Registration is mandatory for everyone who enters the fest. */
export const BASIC_AMOUNT = 500
/**
 * Rupees, charged *on top of* Basic Registration. Covers the full programme.
 *
 * Was 2200 while early bird was running. Display only: the price actually
 * charged is the `delegate` row in the `products` table, and this has to be
 * kept in step with it.
 */
export const DELEGATE_ADDON = 2400

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
 *  - Festival Pass: BR plus a ₹2400 add-on covering the whole programme.
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
  /** Inclusive bounds on the size of the whole crew, the registrant included. */
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
    label: 'Backing track / karaoke link',
    type: 'url',
    placeholder: 'Google Drive / YouTube link',
    help: 'MP3, due 24 hours before the event. Bring a pen-drive backup too.',
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
  sportsPosition: {
    id: 'sportsPosition',
    label: 'Your position / role',
    type: 'text',
    placeholder: 'e.g. wicket-keeper, striker',
  },
  weightClass: {
    id: 'weightClass',
    label: 'Weight category',
    type: 'select',
    required: true,
    options: ['Up to 65.0 kg', '65.1 – 74.0 kg', '74.1 – 83.0 kg', 'Above 83.0 kg'],
  },
  experience: {
    id: 'experience',
    label: 'Prior experience',
    type: 'textarea',
    placeholder: 'Competitions, years of practice. Keep it short.',
  },
  topicPreference: {
    id: 'topicPreference',
    label: 'Preferred side / topic',
    type: 'text',
    placeholder: 'Optional',
  },
  batch: {
    id: 'batch',
    label: 'Your batch',
    type: 'text',
    required: true,
    placeholder: 'e.g. MBBS 2024',
  },
  whatsapp: {
    id: 'whatsapp',
    label: 'WhatsApp number',
    type: 'text',
    required: true,
    placeholder: '10-digit mobile',
    help: 'The quiz group link and every update go here.',
  },
  season: {
    id: 'season',
    label: 'The season you are dressing as',
    type: 'select',
    required: true,
    options: ['Spring', 'Summer', 'Autumn', 'Winter'],
  },
  introVideo: {
    id: 'introVideo',
    label: 'Introductory video link (MP4, 30 seconds)',
    type: 'url',
    required: true,
    placeholder: 'Google Drive link',
    help: 'You on camera, not a voiceover. Name, one word that describes you, and why you chose your outfit. No college or course names.',
  },
  talent: {
    id: 'talent',
    label: 'Your talent for Round 2',
    type: 'text',
    required: true,
    placeholder: 'One talent, two minutes maximum',
  },
  actType: {
    id: 'actType',
    label: 'Monoact or mime?',
    type: 'select',
    required: true,
    options: ['Monoact', 'Mime'],
  },
  rrFormat: {
    id: 'rrFormat',
    label: 'Rap or beatboxing?',
    type: 'select',
    required: true,
    options: ['Rap', 'Beatboxing', 'Both'],
  },
  debateLanguage: {
    id: 'debateLanguage',
    label: 'You will speak in',
    type: 'select',
    required: true,
    options: ['English', 'Hindi', 'Either'],
  },
  poemTitle: {
    id: 'poemTitle',
    label: 'Poem title',
    type: 'text',
    required: true,
    placeholder: 'Your own composition',
  },
} satisfies Record<string, ExtraField>

/** Default shape for every event in a territory, unless the event overrides it. */
const territoryDefaults: Record<string, EventForm> = {
  chorea: {
    participation: 'solo-or-team',
    teamSize: { min: 2, max: 22 },
    fields: [F.genre, F.performanceTitle, F.duration, F.trackLink],
  },
  sinfonia: {
    participation: 'solo-or-team',
    teamSize: { min: 2, max: 8 },
    fields: [F.performanceTitle, F.language, F.duration, F.trackLink],
  },
  thespians: {
    participation: 'team',
    teamSize: { min: 2, max: 20 },
    fields: [F.performanceTitle, F.duration, F.language],
  },
  velocity: {
    participation: 'team',
    teamSize: { min: 5, max: 18 },
    fields: [F.sportsPosition],
    note: 'Every player carries a valid college ID to each match. Report 30 minutes before the scheduled time.',
  },
  chronos: {
    participation: 'solo',
    fields: [F.season, F.introVideo, F.talent],
    note: 'Three rounds: the ramp walk (your video plays, then you walk for 40 seconds), a two-minute talent round, and a surprise round revealed on the day.',
  },
  littmania: { participation: 'solo', fields: [] },
  kalakriti: {
    participation: 'solo',
    fields: [],
    note: 'The theme is announced when the competition starts, and the materials are provided. Just turn up.',
  },
  alfresco: { participation: 'solo', fields: [] },
  thunderbolt: { participation: 'team', teamSize: { min: 4, max: 6 }, fields: [] },
  fahrenheit: { participation: 'solo', fields: [] },
  auriga: { participation: 'solo', fields: [] },
}

/** Only events whose shape genuinely differs from their territory's default. */
const eventOverrides: Record<string, Partial<EventForm>> = {
  /* ---------------- Chorea ---------------- */
  'Nritya Sangam': {
    teamSize: { min: 2, max: 22 },
    note: 'Solo 2–4 min · duet 3–5 min · group 6–10 min. Groups are 4–22 dancers, and the group band is priced per head.',
  },
  Ballismus: {
    teamSize: { min: 2, max: 22 },
    note: 'Solo 2–4 min · duet 3–5 min · group 6–10 min. Groups are 4–22 dancers, and the group band is priced per head.',
  },
  'Street Blaze': {
    teamSize: { min: 2, max: 20 },
    note: 'Street and urban styles only. Solo 2–4 min · duet 3–5 min · group 5–10 min. Groups are 4–20 dancers, priced per head.',
  },
  Adaptune: {
    teamSize: { min: 2, max: 2 },
    fields: [],
    note: 'Nothing to prepare: the song is revealed one minute before you dance, and you get up to three chances to accept the one offered.',
  },

  /* ---------------- Sinfonia ---------------- */
  Tarang: { teamSize: { min: 2, max: 8 }, fields: [F.performanceTitle, F.language, F.duration, F.trackLink] },
  Euphonia: { teamSize: { min: 2, max: 8 } },
  Metallica: {
    teamSize: { min: 2, max: 2 },
    fields: [F.instrument, F.performanceTitle, F.duration],
    note: 'Drum kit and keyboard are provided if you need them. Nothing else is.',
  },
  // Screened on the crew's Google Form before anything is paid; the site never
  // takes a Battle of Bands entry itself. The shape is kept so the card can
  // still say what a band is.
  'Battle of Bands': {
    participation: 'team',
    teamSize: { min: 4, max: 12 },
    fields: [],
    note: 'Screening round first, on the Google Form. The ₹2000 band fee is due only if you clear it. A maximum of 9 members on stage at once.',
  },
  'Rhythm Revolution': {
    teamSize: { min: 2, max: 2 },
    fields: [F.rrFormat, F.trackLink],
    note: 'Five minutes maximum. Backing beats are allowed, submitted 24 hours ahead in MP3.',
  },

  /* ---------------- Thespians ---------------- */
  'Echoes of Expression': {
    participation: 'solo-or-team',
    teamSize: { min: 2, max: 8 },
    fields: [F.actType, F.performanceTitle, F.duration, F.language],
    note: 'One act, no breaks, ten minutes maximum. Credit the writer if the script is adapted.',
  },
  'mADD Angle': {
    participation: 'solo-or-team',
    teamSize: { min: 2, max: 3 },
    fields: [],
    note: 'Priced per head. Nothing to prepare: you get a random prop and one minute, then five minutes to sell it or stage it.',
  },
  'Nukkad Natak': {
    teamSize: { min: 6, max: 30 },
    note: 'Teams of 6–30, and the limit is hard. Eighteen minutes maximum, Hindi or English, original work only. No fire, no water, no electronic instruments.',
  },

  /* ---------------- Velocity ---------------- */
  Basketball: {
    teamSize: { min: 3, max: 10 },
    fields: [],
    note: '5v5 squads are up to 10 players; 3v3 squads are up to 4. Contact the organisers before registering. FIBA rules.',
  },
  Volleyball: { teamSize: { min: 6, max: 12 }, fields: [] },
  Cricket: {
    teamSize: { min: 11, max: 15 },
    fields: [],
    note: 'Squad of 15 (11 + 4). Twenty overs, knockout. Contact the organisers before registering to confirm dates and spot availability.',
  },
  Football: { teamSize: { min: 11, max: 16 }, fields: [] },
  Futsal: { teamSize: { min: 5, max: 9 }, fields: [] },
  Kabaddi: {
    teamSize: { min: 7, max: 12 },
    fields: [],
    note: 'Batch 2021 or later only. Kabaddi shoes are provided during play and must be returned afterwards.',
  },
  'Table Tennis': {
    participation: 'solo-or-team',
    teamSize: { min: 2, max: 2 },
    fields: [],
    note: 'Bring your own racquet and your college ID. Report 15 minutes before your match.',
  },
  Badminton: {
    participation: 'solo-or-team',
    teamSize: { min: 2, max: 2 },
    fields: [],
    note: 'Entries are limited and filled first come, first served. Playing more than one category? Enter each one separately: the site keeps them apart.',
  },
  Chess: {
    participation: 'solo-or-team',
    teamSize: { min: 4, max: 6 },
    fields: [],
    note: 'Four tournaments run: one team event and three individual time controls. You may enter as many as you like, pick a band, then come back and enter another. Batch 2021 or later only.',
  },
  Carrom: { participation: 'solo-or-team', teamSize: { min: 2, max: 2 }, fields: [] },
  Powerlifting: {
    participation: 'solo',
    teamSize: undefined,
    fields: [F.weightClass, F.experience],
    note: 'Squat, bench and deadlift, three attempts each. Open to male participants. Belt, wrist wraps, knee sleeves and chalk are allowed.',
  },

  /* ---------------- Littmania ---------------- */
  Cognizzia: {
    participation: 'solo-or-team',
    teamSize: { min: 2, max: 3 },
    note: 'Four rounds, starting with a pen-and-paper screening that picks six teams. Phones away.',
  },
  Cineholics: {
    participation: 'solo-or-team',
    teamSize: { min: 2, max: 3 },
    note: 'Four rounds, starting with a pen-and-paper screening. Entering alone is fine: the organisers pair lone wolves on the day.',
  },
  'Anime no Tatakai': {
    participation: 'solo-or-team',
    teamSize: { min: 2, max: 4 },
    note: 'Four rounds: trivia, picture, audio, and a final round where you set your own stake. Mainstream and current series; little to no manga.',
  },
  JAM: { note: 'Sixty seconds on a topic you draw from a chit. No hesitation, no deviation, no repetition.' },
  Oratio: {
    participation: 'solo',
    teamSize: undefined,
    fields: [F.debateLanguage, F.topicPreference],
    note: 'Enter as an individual: the two sides of four are drawn up an hour before the debate. Speak in English or Hindi.',
  },
  'Literary Escape Room': {
    participation: 'solo-or-team',
    teamSize: { min: 2, max: 3 },
    note: 'Teams of 1–3. Four timed rounds of riddles, puzzles and clues, with eliminations along the way.',
  },
  Storysmiths: {
    participation: 'team',
    teamSize: { min: 3, max: 3 },
    note: 'Teams of 3, writing one story in relay. No team? Contact the coordinators: individual entrants are paired on the day of the event.',
  },
  Taboo: { participation: 'team', teamSize: { min: 2, max: 4 } },
  'Poetic Reveries': { fields: [F.poemTitle], note: 'The poem must be exclusively self-written. Five minutes maximum.' },
  Kavyotsav: { fields: [F.poemTitle], note: 'Hindi poetry, five minutes maximum. Theme is yours to choose.' },
  Logophilia: {
    participation: 'solo-or-team',
    teamSize: { min: 2, max: 3 },
    note: 'Teams of 2 preferred; lone wolves welcome, at the same fee.',
  },
  Declamation: { fields: [F.topicPreference], note: 'Four to seven minutes on one of the topics given beforehand.' },

  /* ---------------- Kalakriti ---------------- */
  'Fantasy Faces': {
    participation: 'team',
    teamSize: { min: 2, max: 2 },
    note: 'Teams of two: one of you is the canvas, the other the artist. Roles cannot swap once the clock starts. 1.5 hours; colours and brushes provided.',
  },
  'Art Roulette': {
    participation: 'team',
    teamSize: { min: 2, max: 2 },
    note: 'One canvas, two artists, two minutes each in turn, and no discussing what to paint. 1 hour.',
  },
  'Splash Tees': { note: '1.5 hours. T-shirts, paints and brushes provided; bring your own materials except the T-shirt.' },
  'Contrast Chronicles': { note: '2 hours of black-and-white sketching. Sheets and pencils provided; charcoal and the like are welcome.' },
  'Acrylic Odyssey': { note: '2 hours. Canvas, paints and brushes provided; bring your own materials except the canvas.' },
  'Cupful of Doodles': { note: '1 hour of doodling on paper cups. Cups and sketch pens provided.' },
  'Caffeine Creations': { note: '1 hour, coffee only. Pencils, paints and every other medium are out.' },
  'Brushless Strokes': { note: '1.5 hours. Sponges and knives welcome; brushes are strictly prohibited.' },
  'Stone Painting': { note: '1.5 hours. Stones, paints and brushes provided; no ready-made or pre-painted stones.' },
  'Mould It Up': { note: '1 hour. Only clay is provided, and decorative extras are not allowed.' },

  /* ---------------- Alfresco, from the 2026 informals rulebook ---------------- */
  // Singles are paired by the organisers, so a solo entry is a real option.
  'Evening Amore': {
    participation: 'solo-or-team',
    teamSize: { min: 2, max: 2 },
    note: 'Couples and singles both welcome; singles are paired by a randomised system. Come well groomed: lounge wear is not the look. No refunds once a partner is assigned.',
  },
  'Capture and Conquer': {
    participation: 'solo-or-team',
    teamSize: { min: 2, max: 4 },
    note: 'Teams of 1–4, one price. Sixty minutes, no vehicles, and nobody leaves campus.',
  },
  'Grab O Mania': {
    participation: 'team',
    teamSize: { min: 4, max: 4 },
    note: 'Teams of exactly 4: one of you can see, the other three are blindfolded and talked through the tasks.',
  },
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
}

export type ResolvedEvent = {
  name: string
  tag: string
  territory: Territory
  form: EventForm
  /** Set when entry is taken on an external form (every Thunderbolt bracket, the Battle of Bands screening). */
  externalForm?: string
  formTitle?: string
  formNote?: string
}

const byName = new Map<string, { t: Territory; e: SubEvent }>()
for (const t of territories) {
  for (const e of t.events) byName.set(e.name, { t, e })
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
    tag: hit.e.tag,
    territory: hit.t,
    externalForm: hit.e.form,
    formTitle: hit.e.formTitle,
    formNote: hit.e.formNote,
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
