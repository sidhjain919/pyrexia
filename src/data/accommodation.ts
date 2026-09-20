/**
 * Accommodation, as the site describes it.
 *
 * Display copy only. The rates here are mirrored from the official 2026 rate
 * schedule for the sake of the table on the page, and they are *not* what
 * anybody is charged: `api/src/data/accommodation.ts` prices every booking
 * server-side, and the form sends a room-type id rather than an amount. If the
 * two ever disagree, the server is right and this file is a bug.
 *
 * Rupees here, not paise. Nothing in this file is arithmetic.
 */

export type StayRate = {
  sharing: number
  /** Per person, per day. */
  ac: number
  nonAc: number
}

/** Boys' rooms run to five to a room; girls' rooms stop at four. */
export const BOYS_RATES: readonly StayRate[] = [
  { sharing: 2, ac: 800, nonAc: 750 },
  { sharing: 3, ac: 700, nonAc: 600 },
  { sharing: 4, ac: 550, nonAc: 500 },
  { sharing: 5, ac: 450, nonAc: 400 },
]

export const GIRLS_RATES: readonly StayRate[] = [
  { sharing: 2, ac: 800, nonAc: 750 },
  { sharing: 3, ac: 700, nonAc: 600 },
  { sharing: 4, ac: 550, nonAc: 500 },
]

/**
 * What the section on the landing page says about a bed.
 *
 * Facts, not figures. Every rate lives behind the booking form now: two
 * fourteen-row tables on the front page turned it into a tariff board, and
 * nobody reads a price list before they have decided to come.
 */
export const STAY_FACTS = [
  "Separate boys' and girls' blocks, on campus and with our hospitality partners.",
  'Two, three, four or five to a room, AC or non-AC.',
  'Stay four days or all five, arriving on the day that suits your train.',
  'Security guards on the premises, and beds, mattresses and an almirah in every room.',
] as const

/** Cash, at the desk, refundable at check-out. Never charged online. */
export const SECURITY_DEPOSIT = 500

/**
 * What the stay actually is, in the accommodation team's own words.
 *
 * Worth keeping close to the brochure's wording: somebody comparing the two
 * should not find a difference to worry about.
 */
export const AMENITIES = [
  'Rooms at the AIIMS Rishikesh campus and with our trusted hospitality partners.',
  'Each room has beds, mattresses and an almirah.',
  'Fans, buckets and mugs in every room.',
  'Security guards on the premises throughout the fest.',
] as const

export const HOUSE_RULES = [
  'Smoking and alcohol are strictly prohibited on the premises. Anything prohibited found in a room means immediate expulsion and loss of the deposit.',
  'Your luggage is your own responsibility.',
  'Only students with a confirmed booking are allowed in.',
  'Damage to the room or its facilities is charged against the deposit, plus more if the damage warrants it.',
  'Cancellations are not refunded.',
] as const

/**
 * What to bring to check-in.
 *
 * Three documents and cash. This list is the single most useful thing on the
 * page: everything else can be sorted out later, and these cannot.
 */
export const BRING_TO_CHECKIN = [
  'Your delegate card',
  'College ID',
  'Aadhaar card',
  `₹${SECURITY_DEPOSIT} in cash for the refundable deposit`,
] as const

/**
 * The accommodation team, from the brochure.
 *
 * Still here now that booking is self-serve, because a form cannot answer
 * "my train gets in at 3am, is that alright?".
 */
export const STAY_COORDINATORS = {
  boys: [
    { name: 'Rajneesh', phone: '8840107558' },
    { name: 'Ansh', phone: '8209535299' },
    { name: 'Rahul', phone: '9216474595' },
  ],
  girls: [
    { name: 'Anjali', phone: '9813073792' },
    { name: 'Aashana', phone: '9819295880' },
    { name: 'Puspita', phone: '9002860748' },
  ],
} as const
