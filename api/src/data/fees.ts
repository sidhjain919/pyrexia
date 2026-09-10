/**
 * Per-event entry fees, from the final 2026 rulebooks.
 *
 * The authority on what an event costs, mirroring `src/data/fees.ts` on the
 * site. The site's copy is for display; this one is what gets charged, and the
 * client never sends an amount — only a variant id and, where a band is priced
 * per head, the squad size it already had to declare.
 *
 * Paise throughout, like everything else that touches money.
 */

export type FeeVariant = {
  id: string
  label: string
  amountPaise: number
  /** Charged per member of the crew rather than once for the crew. */
  perHead?: boolean
}

export type EventFee = {
  /** What one payment buys, for variants that don't say otherwise. */
  unit: 'person' | 'team'
  /** More than one when different people pay differently. */
  variants: FeeVariant[]
}

const one = (unit: EventFee['unit'], rupees: number): EventFee => ({
  unit,
  variants: [{ id: 'standard', label: 'Entry', amountPaise: rupees * 100 }],
})

const r = (id: string, label: string, rupees: number, perHead = false): FeeVariant =>
  perHead
    ? { id, label, amountPaise: rupees * 100, perHead: true }
    : { id, label, amountPaise: rupees * 100 }

/**
 * An event with no entry here costs nothing to enter beyond Basic Registration.
 *
 * Two deliberate absences: Battle of Bands, whose ₹2000 band fee is only due
 * after the online screening round, and every Thunderbolt bracket, which is
 * paid through the e-gaming crew's own Google Form.
 */
export const EVENT_FEES: Record<string, EventFee> = {
  /* ---------------- Chorea ---------------- */
  'Nritya Sangam': {
    unit: 'team',
    variants: [r('solo', 'Solo', 250), r('duet', 'Duet', 400), r('group', 'Group (4–22)', 100, true)],
  },
  Ballismus: {
    unit: 'team',
    variants: [r('solo', 'Solo', 250), r('duet', 'Duet', 400), r('group', 'Group (4–22)', 100, true)],
  },
  'Street Blaze': {
    unit: 'team',
    variants: [r('solo', 'Solo', 150), r('duet', 'Duet', 250), r('group', 'Group (4–20)', 90, true)],
  },
  Adaptune: {
    unit: 'team',
    variants: [r('solo', 'Solo', 100), r('duet', 'Duet', 180)],
  },

  /* ---------------- Sinfonia ---------------- */
  Tarang: {
    unit: 'team',
    variants: [r('solo', 'Solo', 210), r('duet', 'Duet', 300), r('group', 'Group', 500)],
  },
  Euphonia: {
    unit: 'team',
    variants: [r('solo', 'Solo', 210), r('duet', 'Duet', 300), r('group', 'Group', 500)],
  },
  Metallica: {
    unit: 'team',
    variants: [r('solo', 'Solo', 300), r('duet', 'Duet', 500)],
  },
  'Rhythm Revolution': {
    unit: 'team',
    variants: [r('solo', 'Solo', 120), r('duet', 'Duet', 180)],
  },

  /* ---------------- Thespians ---------------- */
  'Echoes of Expression': {
    unit: 'team',
    variants: [r('solo', 'Solo', 150), r('group', 'Group', 350)],
  },
  'mADD Angle': {
    unit: 'person',
    variants: [r('standard', 'Entry', 150, true)],
  },
  'Nukkad Natak': one('team', 700),

  /* ---------------- Velocity ---------------- */
  Basketball: {
    unit: 'team',
    variants: [
      r('5v5-men', '5v5 · Men', 2800),
      r('5v5-women', '5v5 · Women', 2200),
      r('3v3-men', '3v3 · Men', 1500),
      r('3v3-women', '3v3 · Women', 1300),
    ],
  },
  Volleyball: {
    unit: 'team',
    variants: [r('men', 'Men', 2300), r('women', 'Women', 2000)],
  },
  Cricket: one('team', 7000),
  Football: one('team', 5000),
  Futsal: one('team', 2500),
  Kabaddi: {
    unit: 'team',
    variants: [r('men', 'Men', 2300), r('women', 'Women', 1800)],
  },
  'Table Tennis': {
    unit: 'team',
    variants: [
      r('singles', 'Singles', 210),
      r('doubles', 'Doubles', 350),
      r('mixed-doubles', 'Mixed doubles', 350),
    ],
  },
  Badminton: {
    unit: 'team',
    variants: [
      r('mens-singles', "Men's singles", 275),
      r('womens-singles', "Women's singles", 275),
      r('mens-doubles', "Men's doubles", 550),
      r('womens-doubles', "Women's doubles", 550),
      r('mixed-doubles', 'Mixed doubles', 550),
    ],
  },
  Chess: {
    unit: 'team',
    variants: [
      r('team', 'Team tournament (4 + 2 subs)', 750),
      r('rapid', 'Rapid · 10+2', 200),
      r('blitz', 'Blitz · 5+3', 200),
      r('bullet', 'Bullet · 2+1', 200),
      r('individual-all', 'All three individual formats', 600),
    ],
  },
  Carrom: {
    unit: 'team',
    variants: [r('singles', 'Singles', 125), r('doubles', 'Doubles', 250)],
  },
  Powerlifting: one('person', 150),

  /* ---------------- Littmania ---------------- */
  'Biocrux Jr': {
    unit: 'team',
    variants: [r('team', 'Team (up to 3)', 250), r('lone-wolf', 'Lone wolf', 150)],
  },
  'Biocrux Sr': {
    unit: 'team',
    variants: [r('team', 'Team (up to 3)', 300), r('lone-wolf', 'Lone wolf', 150)],
  },
  Cognizzia: {
    unit: 'team',
    variants: [r('team-3', 'Team of 3', 120), r('team-2', 'Team of 2', 100), r('lone-wolf', 'Lone wolf', 60)],
  },
  Cineholics: {
    unit: 'team',
    variants: [r('team-3', 'Team of 3', 120), r('team-2', 'Team of 2', 100), r('lone-wolf', 'Lone wolf', 60)],
  },
  'Anime no Tatakai': {
    unit: 'team',
    variants: [r('team', 'Team (2–4)', 120), r('lone-wolf', 'Lone wolf', 60)],
  },
  JAM: one('person', 75),
  Oratio: one('person', 100),
  'Literary Escape Room': {
    unit: 'team',
    variants: [r('lone-wolf', 'Lone wolf', 50), r('team-2', 'Team of 2', 75), r('team-3', 'Team of 3', 100)],
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
      r('couple', 'Couple entry', 250),
      r('single-girls', 'Single, girls', 150),
      r('single-boys', 'Single, boys', 180),
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
    variants: [r('boys', 'Boys', 180), r('girls', 'Girls', 150)],
  },
}

export function feeFor(eventName: string): EventFee | null {
  return EVENT_FEES[eventName] ?? null
}

/** What one entry actually costs, once the band and the squad size are known. */
export type PricedEntry = {
  id: string
  label: string
  /** Already multiplied out: this is the number Razorpay is asked for. */
  amountPaise: number
  /** The per-head rate, for a receipt line that explains the multiplication. */
  unitPaise: number
  headCount: number
}

/**
 * The price for one entry, given the variant the entrant picked.
 *
 * Returns null when the variant is not one this event offers, which is the
 * only thing the client could get wrong here: it sends an id, never a number.
 *
 * `headCount` is how many people the entry covers, including the person
 * registering. It only changes the answer for a band priced per head, and is
 * clamped to at least one so a malformed request can never price an entry at
 * zero.
 */
export function priceEntry(
  eventName: string,
  variantId: string | null,
  headCount = 1,
): PricedEntry | null {
  const fee = feeFor(eventName)
  if (!fee) return null
  const variant =
    fee.variants.length === 1 ? fee.variants[0] : fee.variants.find((v) => v.id === variantId)
  if (!variant) return null

  // `Math.max(1, NaN)` is NaN, so the guard has to reject a non-number first:
  // a malformed body must never turn into an order for zero rupees.
  const heads = variant.perHead && Number.isFinite(headCount)
    ? Math.max(1, Math.floor(headCount))
    : 1
  return {
    id: variant.id,
    label: variant.label,
    amountPaise: variant.amountPaise * heads,
    unitPaise: variant.amountPaise,
    headCount: heads,
  }
}
