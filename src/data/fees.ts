/**
 * Per-event entry fees, straight from the 2026 rulebooks.
 *
 * Deliberately not printed on the browse page. A visitor meets the number at
 * the point of entering the event, which is the moment it is useful and the
 * moment they can act on it.
 *
 * This is the display copy. `api/src/data/fees.ts` holds the same table in
 * paise and is what actually gets charged; the client only ever sends a
 * variant id, never an amount.
 */

export type FeeVariant = {
  id: string
  label: string
  amount: number
  /**
   * Charged for every member of the crew rather than once for the crew.
   *
   * Three of the dance events price groups per head, so the total depends on
   * how many people you bring. The server multiplies by the declared squad
   * size; the form shows the running total before anybody pays.
   */
  perHead?: boolean
}

export type EventFee = {
  /** What one payment buys, for variants that don't say otherwise. */
  unit: 'person' | 'team'
  variants: FeeVariant[]
}

const one = (unit: EventFee['unit'], amount: number): EventFee => ({
  unit,
  variants: [{ id: 'standard', label: 'Entry', amount }],
})

export const EVENT_FEES: Record<string, EventFee> = {
  /* ---------------- Chorea ---------------- */
  'Nritya Sangam': {
    unit: 'team',
    variants: [
      { id: 'solo', label: 'Solo', amount: 250 },
      { id: 'duet', label: 'Duet', amount: 400 },
      { id: 'group', label: 'Group (4–22)', amount: 100, perHead: true },
    ],
  },
  Ballismus: {
    unit: 'team',
    variants: [
      { id: 'solo', label: 'Solo', amount: 250 },
      { id: 'duet', label: 'Duet', amount: 400 },
      { id: 'group', label: 'Group (4–22)', amount: 100, perHead: true },
    ],
  },
  'Street Blaze': {
    unit: 'team',
    variants: [
      { id: 'solo', label: 'Solo', amount: 150 },
      { id: 'duet', label: 'Duet', amount: 250 },
      { id: 'group', label: 'Group (4–20)', amount: 90, perHead: true },
    ],
  },
  Adaptune: {
    unit: 'team',
    variants: [
      { id: 'solo', label: 'Solo', amount: 100 },
      { id: 'duet', label: 'Duet', amount: 180 },
    ],
  },

  /* ---------------- Sinfonia ---------------- */
  Tarang: {
    unit: 'team',
    variants: [
      { id: 'solo', label: 'Solo', amount: 210 },
      { id: 'duet', label: 'Duet', amount: 300 },
      { id: 'group', label: 'Group', amount: 500 },
    ],
  },
  Euphonia: {
    unit: 'team',
    variants: [
      { id: 'solo', label: 'Solo', amount: 210 },
      { id: 'duet', label: 'Duet', amount: 300 },
      { id: 'group', label: 'Group', amount: 500 },
    ],
  },
  Metallica: {
    unit: 'team',
    variants: [
      { id: 'solo', label: 'Solo', amount: 300 },
      { id: 'duet', label: 'Duet', amount: 500 },
    ],
  },
  // Battle of Bands is deliberately absent: the ₹2000 band fee is charged only
  // after the online screening round, so entering here costs nothing.
  'Rhythm Revolution': {
    unit: 'team',
    variants: [
      { id: 'solo', label: 'Solo', amount: 120 },
      { id: 'duet', label: 'Duet', amount: 180 },
    ],
  },

  /* ---------------- Thespians ---------------- */
  'Echoes of Expression': {
    unit: 'team',
    variants: [
      { id: 'solo', label: 'Solo', amount: 150 },
      { id: 'group', label: 'Group', amount: 350 },
    ],
  },
  'mADD Angle': {
    unit: 'person',
    variants: [{ id: 'standard', label: 'Entry', amount: 150, perHead: true }],
  },
  'Nukkad Natak': one('team', 700),

  /* ---------------- Velocity ---------------- */
  Basketball: {
    unit: 'team',
    variants: [
      { id: '5v5-men', label: '5v5 · Men', amount: 2800 },
      { id: '5v5-women', label: '5v5 · Women', amount: 2200 },
      { id: '3v3-men', label: '3v3 · Men', amount: 1500 },
      { id: '3v3-women', label: '3v3 · Women', amount: 1300 },
    ],
  },
  Volleyball: {
    unit: 'team',
    variants: [
      { id: 'men', label: 'Men', amount: 2300 },
      { id: 'women', label: 'Women', amount: 2000 },
    ],
  },
  Cricket: one('team', 7000),
  Football: one('team', 5000),
  Futsal: one('team', 2500),
  Kabaddi: {
    unit: 'team',
    variants: [
      { id: 'men', label: 'Men', amount: 2300 },
      { id: 'women', label: 'Women', amount: 1800 },
    ],
  },
  'Table Tennis': {
    unit: 'team',
    variants: [
      { id: 'singles', label: 'Singles', amount: 210 },
      { id: 'doubles', label: 'Doubles', amount: 350 },
      { id: 'mixed-doubles', label: 'Mixed doubles', amount: 350 },
    ],
  },
  Badminton: {
    unit: 'team',
    variants: [
      { id: 'mens-singles', label: "Men's singles", amount: 275 },
      { id: 'womens-singles', label: "Women's singles", amount: 275 },
      { id: 'mens-doubles', label: "Men's doubles", amount: 550 },
      { id: 'womens-doubles', label: "Women's doubles", amount: 550 },
      { id: 'mixed-doubles', label: 'Mixed doubles', amount: 550 },
    ],
  },
  Chess: {
    unit: 'team',
    variants: [
      { id: 'team', label: 'Team tournament (4 + 2 subs)', amount: 750 },
      { id: 'rapid', label: 'Rapid · 10+2', amount: 200 },
      { id: 'blitz', label: 'Blitz · 5+3', amount: 200 },
      { id: 'bullet', label: 'Bullet · 2+1', amount: 200 },
      { id: 'individual-all', label: 'All three individual formats', amount: 600 },
    ],
  },
  Carrom: {
    unit: 'team',
    variants: [
      { id: 'singles', label: 'Singles', amount: 125 },
      { id: 'doubles', label: 'Doubles', amount: 250 },
    ],
  },
  Powerlifting: one('person', 150),

  /* ---------------- Chronos ---------------- */
  'Mr. & Ms. PYREXIA': one('person', 400),

  /* ---------------- Littmania ---------------- */
  Cognizzia: {
    unit: 'team',
    variants: [
      { id: 'team-3', label: 'Team of 3', amount: 120 },
      { id: 'team-2', label: 'Team of 2', amount: 100 },
      { id: 'lone-wolf', label: 'Lone wolf', amount: 60 },
    ],
  },
  Cineholics: {
    unit: 'team',
    variants: [
      { id: 'team-3', label: 'Team of 3', amount: 120 },
      { id: 'team-2', label: 'Team of 2', amount: 100 },
      { id: 'lone-wolf', label: 'Lone wolf', amount: 60 },
    ],
  },
  'Anime no Tatakai': {
    unit: 'team',
    variants: [
      { id: 'team', label: 'Team (2–4)', amount: 120 },
      { id: 'lone-wolf', label: 'Lone wolf', amount: 60 },
    ],
  },
  JAM: one('person', 75),
  Oratio: one('person', 100),
  'Literary Escape Room': {
    unit: 'team',
    variants: [
      { id: 'lone-wolf', label: 'Lone wolf', amount: 50 },
      { id: 'team-2', label: 'Team of 2', amount: 75 },
      { id: 'team-3', label: 'Team of 3', amount: 100 },
    ],
  },
  Storysmiths: one('team', 300),
  Taboo: one('team', 100),
  'Poetic Reveries': one('person', 75),
  Kavyotsav: one('person', 80),
  Logophilia: one('team', 75),
  Declamation: one('person', 60),

  /* ---------------- Kalakriti ---------------- */
  'Fantasy Faces': one('team', 100),
  'Splash Tees': one('person', 150),
  'Contrast Chronicles': one('person', 50),
  'Acrylic Odyssey': one('person', 100),
  'Cupful of Doodles': one('person', 40),
  'Caffeine Creations': one('person', 40),
  'Brushless Strokes': one('person', 50),
  'Stone Painting': one('person', 80),
  'Mould It Up': one('person', 150),
  'Art Roulette': one('team', 100),

  /* ---------------- Alfresco ---------------- */
  'Evening Amore': {
    unit: 'person',
    variants: [
      { id: 'couple', label: 'Couple entry', amount: 250 },
      { id: 'single-girls', label: 'Single, girls', amount: 150 },
      { id: 'single-boys', label: 'Single, boys', amount: 180 },
    ],
  },
  'Capture and Conquer': one('team', 200),
  'Grab O Mania': one('team', 200),
  'Squid Game': one('person', 80),
  Pictionary: one('team', 200),
  'Paper Dance': one('team', 60),
  'Balloon Burst': one('team', 60),
  'Treasure Hunt': one('team', 240),
  'Songstra Vaganza': one('team', 120),
  Tambola: one('person', 60),
  'Musical Chairs': one('person', 40),
  'Soul Sync': one('team', 80),
  'Drape It': one('team', 60),
  'Dumb Charades': one('team', 160),
  'Swift Mingle': {
    unit: 'person',
    variants: [
      { id: 'boys', label: 'Boys', amount: 180 },
      { id: 'girls', label: 'Girls', amount: 150 },
    ],
  },

  /* Thunderbolt is absent on purpose: every bracket is paid through the
     e-gaming crew's own Google Form, not through this site. */
}

/** The fee for one event, or `null` when it costs nothing to enter. */
export function eventFee(name: string): EventFee | null {
  return EVENT_FEES[name] ?? null
}

/** "₹160 per team", or one line per price band. */
export function feeLines(fee: EventFee): string[] {
  const say = (v: FeeVariant) =>
    v.perHead ? `₹${v.amount} per head` : `₹${v.amount} per ${fee.unit === 'person' ? 'person' : 'team'}`
  if (fee.variants.length === 1) return [say(fee.variants[0])]
  return fee.variants.map((v) => `${v.label} · ${say(v)}`)
}
