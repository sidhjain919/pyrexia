/**
 * Captain's Log — the day-wise voyage plan.
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
  title: string
  subtitle: string
  entries: LogEntry[]
}

export const captainsLog: LogDay[] = [
  {
    day: 'Day 01',
    title: 'Anchors Aweigh',
    subtitle: 'The gates open and the fever is lit',
    entries: [],
  },
  {
    day: 'Day 02',
    title: 'Cultural Currents',
    subtitle: 'The reef comes alive with rhythm and voice',
    entries: [],
  },
  {
    day: 'Day 03',
    title: 'The Battlegrounds',
    subtitle: 'Crews clash for the flag on land and screen',
    entries: [],
  },
  {
    day: 'Day 04',
    title: 'Arts & Lore',
    subtitle: 'Ink, pigment and quiz-fire',
    entries: [],
  },
  {
    day: 'Day 05',
    title: 'Starlight Finale',
    subtitle: 'The treasure is claimed under the island sky',
    entries: [],
  },
]
