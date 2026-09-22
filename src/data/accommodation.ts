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
 * How booking a bed works, in three steps.
 *
 * Not a list of what is in the room. The first version of this section
 * inventoried the furniture, which is both unappealing and beside the point:
 * nobody chooses a fest by its almirahs. What somebody actually wants to know
 * before they commit is what they get to decide, and what happens after they
 * pay. That is what these say.
 *
 * Deliberately silent on where the rooms are. Placement is the accommodation
 * team's to make between the campus and the partner hotels, so promising
 * either here would be telling somebody something that might not hold.
 */
export const STAY_STEPS = [
  {
    title: 'Choose your room',
    body: 'Boys and girls separately, two to five sharing, with or without AC.',
  },
  {
    title: 'Book the full fest',
    body: 'All five days, from the 12th. Tell us roughly when your train gets in.',
  },
  {
    title: "Pay, and it's yours",
    body: 'The receipt reaches you by email. Bring it and your ID when you turn up.',
  },
] as const

/**
 * The accommodation team's own two documents, as handed over.
 *
 * `details` is the five-page notice (amenities, rules, room types, the
 * coordinators); `rates` is the one-page rate schedule. The notice was 20MB of
 * poster-sized PNGs and is recompressed to about half a megabyte here, which
 * is the difference between a link a delegate opens on mobile data and one
 * they give up on.
 */
export const STAY_DOCUMENTS = [
  { label: 'Accommodation details', file: 'accommodation-details.pdf', note: 'Rules, amenities and the coordinators' },
  { label: 'Rate card', file: 'accommodation-rates.pdf', note: 'Every room type, per person per day' },
] as const

/** Cash, at the desk, refundable at check-out. Never charged online. */
export const SECURITY_DEPOSIT = 500

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
