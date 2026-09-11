/**
 * Legends of the voyage.
 *
 * Two lists live here and they answer different questions. `proNights` is the
 * 2026 lineup: five nights, each either a named headliner or a slot still
 * charted in secret. `pastLegends` is who has played the Auriga stage before,
 * which is the only honest way to say how big the stage is before the last
 * names are announced.
 */

import { artistPhoto } from './photos'

export type Artist = {
  name: string
  role: string
  /** Omitted where the edition hasn't been confirmed; the card then prints the role alone. */
  year?: string
  /** monogram fallback shown until real portraits are supplied */
  mono: string
  accent: string
  revealed: boolean
  /**
   * Atmospheric star-night frame from past PYREXIA editions.
   *
   * Undefined until a portrait is supplied, and the card falls back to the
   * monogram on its accent rather than breaking: names are worth publishing
   * before the photographs catch up.
   */
  photo?: string
}

export const pastLegends: Artist[] = [
  { name: 'Sonu Nigam', role: 'Playback Legend', year: '2024', mono: 'SN', accent: '#e6c25e', revealed: true, photo: artistPhoto['Sonu Nigam'] },
  { name: 'Nikita Gandhi', role: 'Playback · Live', year: '2024', mono: 'NG', accent: '#d05a8a', revealed: true, photo: artistPhoto['Nikita Gandhi'] },
  { name: 'Amit Mishra', role: 'Vocalist', year: '2024', mono: 'AM', accent: '#5aa9d0', revealed: true, photo: artistPhoto['Amit Mishra'] },
  { name: 'Ravator', role: 'Indie · Rap', year: '2024', mono: 'RV', accent: '#4fae8b', revealed: true, photo: artistPhoto['Ravator'] },
  { name: 'Maadhyam', role: 'Live Band', year: '2024', mono: 'MD', accent: '#b06fd0', revealed: true, photo: artistPhoto['Maadhyam'] },
  { name: 'Mohit Chauhan', role: 'Playback Legend', year: '2025', mono: 'MC', accent: '#e6c25e', revealed: true, photo: artistPhoto['Mohit Chauhan'] },
  { name: 'B Praak', role: 'Playback · Live', year: '2025', mono: 'BP', accent: '#5aa9d0', revealed: true, photo: artistPhoto['B Praak'] },
  { name: 'Aditi Singh Sharma', role: 'Playback · Live', year: '2025', mono: 'AS', accent: '#d05a8a', revealed: true, photo: artistPhoto['Aditi Singh Sharma'] },
]

/**
 * One slot per night of the fest: five days on the island, five stages.
 *
 * Three are announced. The other two stay as they were — dates fixed, names
 * charted in secret — because a card that says "reveal soon" is honest and a
 * card that invents a name is not.
 */
export type ProNight = {
  label: string
  date: string
  /** Locked slots keep the teaser line; announced ones carry the artist. */
  hint: string
  accent: string
  artist?: {
    name: string
    /** One line under the name: what they are. */
    role: string
    /** The hook. Short enough to read from the back of a crowd. */
    tagline: string
    /** Two sentences at most, for people who want to know who they're seeing. */
    blurb: string
    /** The songs a stranger would recognise. */
    known: string[]
    mono: string
    photo: string
    /** object-position for the portrait, so the face survives the crop. */
    focus: string
  }
}

export const proNights: ProNight[] = [
  {
    label: 'Night I',
    date: '12 Oct',
    hint: 'Opening night. Lips sealed.',
    accent: '#e0894a',
  },
  {
    label: 'Night II',
    date: '13 Oct',
    hint: 'Punjab pulls up',
    accent: '#e0894a',
    artist: {
      name: 'Parmish Verma',
      role: 'Punjabi Superstar · Singer & Actor',
      tagline: 'Certified banger machine.',
      blurb:
        'He directed Punjab’s biggest music videos, then decided he’d rather be the one on camera — and never looked back. The whole ground knows every word before the beat even drops.',
      known: ['Gaal Ni Kadni', 'Shada', 'Chal Oye', 'Le Chak Main Aa Gaya'],
      mono: 'PV',
      photo: artistPhoto['Parmish Verma'],
      focus: '50% 22%',
    },
  },
  {
    label: 'Night III',
    date: '14 Oct',
    hint: 'Your feelings, live on stage',
    accent: '#5aa9d0',
    artist: {
      name: 'Navjot Ahuja',
      role: 'Singer-Songwriter · Indie Live',
      tagline: 'This one’s going to hit different.',
      blurb:
        'Jaipur kid, one guitar, and a ballad called “Khat” that walked straight into Apple Music India’s top ten. This is the night everyone puts their torch up and forgets they came here to compete.',
      known: ['Khat', 'Ye Waadiyan', 'Bayaan', 'Khud Se Mohabbat'],
      mono: 'NA',
      photo: artistPhoto['Navjot Ahuja'],
      focus: '50% 30%',
    },
  },
  {
    label: 'Night IV',
    date: '15 Oct',
    hint: 'The ground is not ready',
    accent: '#b06fd0',
    artist: {
      name: 'Nucleya',
      role: 'Bass Raja · Electronic',
      tagline: 'Bass so heavy it’s basically a crime.',
      blurb:
        'The man who invented desi bass, launched his debut album off the back of a truck at a Mumbai visarjan, and has been flattening festival grounds ever since. Wear shoes you’re fine with losing.',
      known: ['Bass Rani', 'Laung Gawacha', 'Aaja', 'Koocha Monster'],
      mono: 'NU',
      photo: artistPhoto['Nucleya'],
      focus: '50% 26%',
    },
  },
  {
    label: 'Night V',
    date: '16 Oct',
    hint: 'Saving the biggest for last',
    accent: '#e6c25e',
  },
]

/** The nights with a name on them, for anything that only wants the headliners. */
export const headliners = proNights.filter((n) => n.artist)
