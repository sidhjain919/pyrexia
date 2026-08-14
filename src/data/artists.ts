/**
 * Legends of the voyage.
 * The 2024 lineup is real (from the brochure's "glimpse into the PYREXIA 2024
 * lineup"). The 2026 headliners are intentionally unrevealed — the fest keeps
 * the star lineup a secret until closer to the dates.
 */

export type Artist = {
  name: string
  role: string
  year: string
  /** monogram fallback shown until real portraits are supplied */
  mono: string
  accent: string
  revealed: boolean
  /** atmospheric star-night frame from past PYREXIA editions */
  photo: string
}

export const pastLegends: Artist[] = [
  { name: 'Sonu Nigam', role: 'Playback Legend', year: '2024', mono: 'SN', accent: '#e6c25e', revealed: true, photo: '/photos/p01.jpg' },
  { name: 'Nikita Gandhi', role: 'Playback · Live', year: '2024', mono: 'NG', accent: '#d05a8a', revealed: true, photo: '/photos/p41.jpg' },
  { name: 'Amit Mishra', role: 'Vocalist', year: '2024', mono: 'AM', accent: '#5aa9d0', revealed: true, photo: '/photos/p15.jpg' },
  { name: 'Ravator', role: 'Indie · Rap', year: '2024', mono: 'RV', accent: '#4fae8b', revealed: true, photo: '/photos/p13.jpg' },
  { name: 'Maadhyam', role: 'Live Band', year: '2024', mono: 'MD', accent: '#b06fd0', revealed: true, photo: '/photos/p23.jpg' },
  { name: 'Antariksh', role: 'Live Band', year: '2024', mono: 'AK', accent: '#e07a5a', revealed: true, photo: '/photos/p25.jpg' },
]

/** Placeholder mystery slots for the 2026 reveal. */
export const mysterySlots = [
  { label: 'Headliner I', hint: 'The name that lights the summit' },
  { label: 'Headliner II', hint: 'A voice the island already knows' },
  { label: 'The Wildcard', hint: 'Charted, not yet revealed' },
]
