/** Global site + fest constants for PYREXIA 2026 */

export const SITE = {
  name: 'PYREXIA',
  year: '2026',
  edition: 'The Sixth Voyage',
  theme: 'Pirates of the Lost Island',
  institution: 'AIIMS Rishikesh',
  institutionFull: 'All India Institute of Medical Sciences, Rishikesh',
  // The fest has historically sailed every October (2024, 2025). Exact 2026
  // dates are announced closer to the fest — kept as a window, not fabricated.
  window: 'October 2026',
  datesNote: 'Exact dates dropping soon',
  tagline: 'The island has been lost. The treasure is waiting.',
  registerUrl: '#register',
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
  { label: 'Allies', to: '/#allies', meaning: 'Sponsors' },
  { label: 'Navigator', to: '/#contact', meaning: 'Contact & FAQ' },
] as const

export const SOCIAL = [
  { label: 'Instagram', handle: '@pyrexia.aiimsrishikesh', icon: 'Instagram', href: '#' },
  { label: 'YouTube', handle: 'PYREXIA AIIMS Rishikesh', icon: 'Youtube', href: '#' },
  { label: 'Facebook', handle: 'PYREXIA', icon: 'Facebook', href: '#' },
]

/** Verified metadata cards for The Legend (from the 2025 brochure). */
export const LEGEND_META = [
  'AIIMS Rishikesh',
  'Annual Fest',
  'Culture',
  'Sports',
  'Music',
  'Art',
  'Literature',
  'E-Sports',
]

/** Stats reference the 5.0 edition breadth. Deliberately qualitative — no fabricated numbers. */
export const VOYAGE_STATS = [
  { value: '11', label: 'Territories to conquer', suffix: '' },
  { value: '60', label: 'Events & competitions', suffix: '+' },
  { value: '5', label: 'Days of the fever', suffix: '' },
  { value: '6', label: 'Editions strong', suffix: 'th' },
]
