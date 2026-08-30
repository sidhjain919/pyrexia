/** Global site + fest constants for PYREXIA 2026 */

export const SITE = {
  name: 'PYREXIA',
  year: '2026',
  edition: 'The Sixth Voyage',
  theme: 'Pirates of the Lost Island',
  institution: 'AIIMS Rishikesh',
  institutionFull: 'All India Institute of Medical Sciences, Rishikesh',
  /** The confirmed 2026 window: five days on the island. */
  dates: '12–16 October 2026',
  datesShort: 'Oct 12–16',
  dateStart: '12 October',
  dateEnd: '16 October',
  /** Legacy alias kept so every surface prints the same string. */
  window: '12–16 October 2026',
  tagline: 'The island has been lost. The treasure is waiting.',
  registerUrl: '#register',
} as const

/**
 * The early-bird window.
 *
 * A cap on registrations rather than a date, because that is what was actually
 * promised: the first hundred pay the current price. `live: false` removes it
 * from every surface at once when the hundred are gone, rather than leaving a
 * stale promise on the page.
 */
export const EARLY_BIRD = {
  live: true,
  headline: 'Early bird is open',
  short: 'Early bird: first 100 registrations at the current price',
  blurb: 'is running now. The first 100 registrations pay the current price; after that it goes up.',
} as const

/** `meaning` is the plain-English translation shown as a subtitle wherever the
 * slang name alone wouldn't be obvious (mobile nav, desktop nav tooltip). */
export const NAV = [
  { label: 'Home', to: '/#home', meaning: '' },
  { label: 'The Legend', to: '/#legend', meaning: 'About' },
  { label: 'Events', to: '/#island', meaning: 'Explore & register' },
  { label: "Captain's Log", to: '/#log', meaning: 'Schedule' },
  { label: 'Legends', to: '/#artists', meaning: 'Lineup' },
  { label: 'Voyages', to: '/#gallery', meaning: 'Gallery' },
  { label: 'Navigator', to: '/#contact', meaning: 'Contact & FAQ' },
] as const

export const SOCIAL = [
  {
    label: 'Instagram',
    handle: '@pyrexiaaiims',
    icon: 'Instagram',
    href: 'https://www.instagram.com/pyrexiaaiims/',
  },
  { label: 'YouTube', handle: 'PYREXIA AIIMS Rishikesh', icon: 'Youtube', href: '#' },
  { label: 'Facebook', handle: 'PYREXIA', icon: 'Facebook', href: '#' },
]

/** Stats reference the 5.0 edition breadth. Deliberately qualitative, no fabricated numbers. */
export const VOYAGE_STATS = [
  { value: '11', label: 'Territories to conquer', suffix: '' },
  { value: '60', label: 'Events & competitions', suffix: '+' },
  { value: '5', label: 'Days of the fever', suffix: '' },
  { value: '6', label: 'Editions strong', suffix: 'th' },
]
