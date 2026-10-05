/**
 * Captain's Log: the day-wise voyage plan for 12–16 October 2026.
 *
 * Transcribed from the official schedule posted on Instagram on 4 Oct 2026.
 * Event names follow the spelling on the event cards (`events.ts`), not the
 * poster's, so the same event reads the same everywhere on the site.
 *
 * Each Star Night takes its headliner from `proNights`, so opening night stays
 * unnamed until its artist is revealed there, and then appears here on its own.
 */
import { proNights } from './artists'

export type LogEntry = {
  time: string
  title: string
  cat: string
  venue: string
}

export type LogDay = {
  day: string
  /** Calendar date this chapter falls on, e.g. `12 Oct`. */
  date: string
  title: string
  subtitle: string
  entries: LogEntry[]
}

function starNight(date: string, time: string): LogEntry {
  const artist = proNights.find((n) => n.date === date)?.artist
  return {
    time,
    title: artist ? `Star Night · ${artist.name}` : 'Star Night',
    cat: 'Pro Night',
    venue: 'AIIMS Square',
  }
}

export const captainsLog: LogDay[] = [
  {
    day: 'Day 01',
    date: '12 Oct',
    title: 'Anchors Aweigh',
    subtitle: 'The gates open and the fever is lit',
    entries: [
      { time: '10:00 AM', title: 'Contrast Chronicles', cat: 'Fine Arts', venue: 'Mini Audi' },
      { time: '12:00 PM', title: 'Fahrenheit · Opening Ceremony', cat: 'Ceremony', venue: 'Auditorium' },
      { time: '1:00 PM', title: 'Art Roulette', cat: 'Fine Arts', venue: 'Mini Audi' },
      { time: '2:00 PM', title: 'JAM', cat: 'Literary', venue: 'LT 3' },
      { time: '4:00 PM', title: 'Logophilia', cat: 'Literary', venue: 'LT 3' },
      starNight('12 Oct', '7:00 PM'),
    ],
  },
  {
    day: 'Day 02',
    date: '13 Oct',
    title: 'Cultural Currents',
    subtitle: 'The reef comes alive with rhythm and voice',
    entries: [
      { time: '9:00 AM', title: 'Nukkad Natak', cat: 'Theatre', venue: 'Solarium · till 12:00 PM' },
      { time: '10:00 AM', title: 'Squid Game', cat: 'Informals', venue: 'Millet Cafe' },
      { time: '10:00 AM', title: 'Acrylic Odyssey', cat: 'Fine Arts', venue: 'Mini Audi · till 1:00 PM' },
      { time: '10:30 AM', title: 'Musical Chairs', cat: 'Informals', venue: 'Millet Cafe' },
      { time: '12:30 PM', title: 'Nritya Sangam', cat: 'Dance', venue: 'Auditorium' },
      { time: '1:00 PM', title: 'Mould It Up', cat: 'Fine Arts', venue: 'Mini Audi' },
      { time: '2:00 PM', title: 'Grab O Mania', cat: 'Informals', venue: 'Millet Cafe' },
      { time: '2:00 PM', title: 'Literary Escape Room', cat: 'Literary', venue: 'LT 3' },
      { time: '2:30 PM', title: 'Rhythm Revolution', cat: 'Music', venue: 'Foyer' },
      { time: '4:00 PM', title: 'Kavyotsav', cat: 'Literary', venue: 'LT 3' },
      { time: '5:00 PM', title: 'Paper Dance', cat: 'Informals', venue: 'Millet Cafe' },
      starNight('13 Oct', '7:00 PM'),
    ],
  },
  {
    day: 'Day 03',
    date: '14 Oct',
    title: 'The Battlegrounds',
    subtitle: 'Crews clash for the flag on land and screen',
    entries: [
      { time: '9:00 AM', title: 'mADD Angle', cat: 'Theatre', venue: 'Solarium' },
      { time: '10:00 AM', title: 'Treasure Hunt', cat: 'Informals', venue: 'Millet Cafe' },
      { time: '10:00 AM', title: 'Brushless Strokes', cat: 'Fine Arts', venue: 'Mini Audi · till 1:00 PM' },
      { time: '12:30 PM', title: 'Tarang', cat: 'Music', venue: 'Auditorium' },
      { time: '1:00 PM', title: 'Cupful of Doodles', cat: 'Fine Arts', venue: 'Mini Audi' },
      { time: '2:00 PM', title: 'Dumb Charades', cat: 'Informals', venue: 'Millet Cafe' },
      { time: '2:00 PM', title: 'Cineholics', cat: 'Literary', venue: 'LT 3' },
      { time: '2:30 PM', title: 'Balloon Burst', cat: 'Informals', venue: 'Millet Cafe' },
      { time: '4:00 PM', title: 'Adaptune', cat: 'Dance', venue: 'Foyer' },
      { time: '4:00 PM', title: 'Taboo', cat: 'Literary', venue: 'LT 5' },
      { time: '5:00 PM', title: 'Evening Amore', cat: 'Informals', venue: 'Nursing College' },
      starNight('14 Oct', '7:00 PM'),
    ],
  },
  {
    day: 'Day 04',
    date: '15 Oct',
    title: 'Arts & Lore',
    subtitle: 'Ink, pigment and quiz-fire',
    entries: [
      { time: '9:00 AM', title: 'Ballismus', cat: 'Dance', venue: 'Auditorium' },
      { time: '10:00 AM', title: 'Capture and Conquer', cat: 'Informals', venue: 'LT 3' },
      { time: '10:00 AM', title: 'Stone Painting', cat: 'Fine Arts', venue: 'Mini Audi' },
      { time: '10:00 AM', title: 'Cognizzia', cat: 'Literary', venue: 'LT 3' },
      { time: '12:30 PM', title: 'Metallica', cat: 'Music', venue: 'Auditorium' },
      { time: '1:00 PM', title: 'Splash Tees', cat: 'Fine Arts', venue: 'Mini Audi' },
      { time: '2:00 PM', title: 'Songstra Vaganza', cat: 'Informals', venue: 'Millet Cafe' },
      { time: '2:00 PM', title: 'Declamation', cat: 'Literary', venue: 'LT 3' },
      { time: '2:30 PM', title: 'Street Blaze', cat: 'Dance', venue: 'Foyer' },
      { time: '3:00 PM', title: 'Battle of Bands', cat: 'Music', venue: 'Auditorium' },
      { time: '4:00 PM', title: 'Poetic Reveries', cat: 'Literary', venue: 'LT 3' },
      { time: '5:00 PM', title: 'Swift Mingle', cat: 'Informals', venue: 'Near Nursing College · till 8:00 PM' },
      starNight('15 Oct', '7:00 PM'),
    ],
  },
  {
    day: 'Day 05',
    date: '16 Oct',
    title: 'Starlight Finale',
    subtitle: 'The treasure is claimed under the island sky',
    entries: [
      { time: '9:00 AM', title: 'Euphonia', cat: 'Music', venue: 'Auditorium' },
      { time: '10:00 AM', title: 'Pictionary', cat: 'Informals', venue: 'Millet Cafe' },
      { time: '10:00 AM', title: 'Fantasy Faces', cat: 'Fine Arts', venue: 'Mini Audi' },
      { time: '10:00 AM', title: 'Oratio · Bilingual Debate', cat: 'Literary', venue: 'LT 3' },
      { time: '12:30 PM', title: 'Echoes of Expression', cat: 'Theatre', venue: 'Auditorium' },
      { time: '1:00 PM', title: 'Caffeine Creations', cat: 'Fine Arts', venue: 'Mini Audi' },
      { time: '2:00 PM', title: 'Tambola', cat: 'Informals', venue: 'Millet Cafe' },
      { time: '2:00 PM', title: 'Anime no Tatakai', cat: 'Literary', venue: 'LT 3' },
      { time: '2:30 PM', title: 'Soul Sync', cat: 'Informals', venue: 'Foyer' },
      { time: '3:00 PM', title: 'Chronos · Mr. & Ms. PYREXIA', cat: 'Cultural', venue: 'Auditorium' },
      { time: '4:00 PM', title: 'Storysmiths', cat: 'Literary', venue: 'LT 3' },
      { time: '5:00 PM', title: 'Drape It', cat: 'Informals', venue: 'Millet Cafe · till 8:00 PM' },
      starNight('16 Oct', '8:00 PM'),
    ],
  },
]
