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

export const NAV = [
  { label: 'Home', to: '/' },
  { label: 'The Legend', to: '/#legend' },
  { label: 'Events', to: '/events' },
  { label: "Captain's Log", to: '/schedule' },
  { label: 'Legends', to: '/artists' },
  { label: 'Voyages', to: '/gallery' },
  { label: 'Allies', to: '/sponsors' },
  { label: 'Navigator', to: '/#contact' },
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
