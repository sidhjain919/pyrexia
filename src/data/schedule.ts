/**
 * Captain's Log: the day-wise voyage plan for 12–16 October 2026.
 * Day names are the creative 2026 chapter titles; the minute-by-minute
 * schedule itself isn't finalized yet, so entries stay empty and the UI
 * shows "Coming Soon" until the real log is released nearer the fest.
 */

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

export const captainsLog: LogDay[] = [
  {
    day: 'Day 01',
    date: '12 Oct',
    title: 'Anchors Aweigh',
    subtitle: 'The gates open and the fever is lit',
    entries: [],
  },
  {
    day: 'Day 02',
    date: '13 Oct',
    title: 'Cultural Currents',
    subtitle: 'The reef comes alive with rhythm and voice',
    entries: [],
  },
  {
    day: 'Day 03',
    date: '14 Oct',
    title: 'The Battlegrounds',
    subtitle: 'Crews clash for the flag on land and screen',
    entries: [],
  },
  {
    day: 'Day 04',
    date: '15 Oct',
    title: 'Arts & Lore',
    subtitle: 'Ink, pigment and quiz-fire',
    entries: [],
  },
  {
    day: 'Day 05',
    date: '16 Oct',
    title: 'Starlight Finale',
    subtitle: 'The treasure is claimed under the island sky',
    entries: [],
  },
]
