/**
 * Legends of the voyage.
 * The 2024 lineup is real (from the brochure's "glimpse into the PYREXIA 2024
 * lineup"). The 2026 headliners are intentionally unrevealed, the fest keeps
 * the star lineup a secret until closer to the dates.
 */

import { artistPhoto } from './photos'

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
  { name: 'Sonu Nigam', role: 'Playback Legend', year: '2024', mono: 'SN', accent: '#e6c25e', revealed: true, photo: artistPhoto['Sonu Nigam'] },
  { name: 'Nikita Gandhi', role: 'Playback · Live', year: '2024', mono: 'NG', accent: '#d05a8a', revealed: true, photo: artistPhoto['Nikita Gandhi'] },
  { name: 'Amit Mishra', role: 'Vocalist', year: '2024', mono: 'AM', accent: '#5aa9d0', revealed: true, photo: artistPhoto['Amit Mishra'] },
  { name: 'Ravator', role: 'Indie · Rap', year: '2024', mono: 'RV', accent: '#4fae8b', revealed: true, photo: artistPhoto['Ravator'] },
  { name: 'Maadhyam', role: 'Live Band', year: '2024', mono: 'MD', accent: '#b06fd0', revealed: true, photo: artistPhoto['Maadhyam'] },
]

/**
 * One mystery slot per night of the fest: five days on the island, five
 * reveals. Dates are fixed; the names stay charted in secret until the drop.
 */
export const mysterySlots = [
  { label: 'Night I', date: '12 Oct', hint: 'The opening roar' },
  { label: 'Night II', date: '13 Oct', hint: 'A voice the island already knows' },
  { label: 'Night III', date: '14 Oct', hint: 'Charted, not yet revealed' },
  { label: 'Night IV', date: '15 Oct', hint: 'The wildcard of the voyage' },
  { label: 'Night V', date: '16 Oct', hint: 'The name that lights the summit' },
]
