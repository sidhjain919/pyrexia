/**
 * Captain's Log — an indicative day-wise voyage plan.
 * Built from the real PYREXIA verticals; specific slot times are a tentative
 * framework for 2026 (the official minute-by-minute schedule is released nearer
 * the fest). Category labels are real.
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
    entries: [
      { time: '10:00', title: 'The Gates Open · Delegate Check-in', cat: 'General', venue: 'Main Campus Gate' },
      { time: '12:30', title: 'Kalakriti — On-spot Art begins', cat: 'Fine Arts', venue: 'Painted Cliffs' },
      { time: '15:00', title: 'Littmania — JAM & Debates', cat: 'Literary', venue: 'Lecture Complex' },
      { time: '18:30', title: 'Fahrenheit — Opening Ceremony', cat: 'Ceremony', venue: 'Main Stage' },
      { time: '20:00', title: 'Sinfonia — Battle of Bands', cat: 'Music', venue: 'Main Stage' },
    ],
  },
  {
    day: 'Day 02',
    title: 'Cultural Currents',
    subtitle: 'The reef comes alive with rhythm and voice',
    entries: [
      { time: '09:30', title: 'Velocity — Cricket & Football League', cat: 'Sports', venue: 'Sports Ground' },
      { time: '11:00', title: 'Chorea — Nritya Sangam', cat: 'Dance', venue: 'Auditorium' },
      { time: '14:00', title: 'Sinfonia — Tarang & Metallica', cat: 'Music', venue: 'Auditorium' },
      { time: '17:00', title: 'Thespians — Nukkad Natak', cat: 'Theatre', venue: 'Amphitheatre' },
      { time: '20:00', title: 'Star Night — Auriga', cat: 'Star Night', venue: 'Main Stage' },
    ],
  },
  {
    day: 'Day 03',
    title: 'The Battlegrounds',
    subtitle: 'Crews clash for the flag on land and screen',
    entries: [
      { time: '09:00', title: 'Velocity — Basketball & Volleyball', cat: 'Sports', venue: 'Courts' },
      { time: '12:00', title: 'Thunderbolt — BGMI & FIFA', cat: 'E-Sports', venue: 'Gaming Arena' },
      { time: '15:00', title: 'Chorea — Street Blaze', cat: 'Dance', venue: 'Open Grounds' },
      { time: '17:30', title: 'Alfresco — Squid Game', cat: 'Informals', venue: 'Carnival Cove' },
      { time: '20:00', title: 'Star Night — Auriga', cat: 'Star Night', venue: 'Main Stage' },
    ],
  },
  {
    day: 'Day 04',
    title: 'Arts & Lore',
    subtitle: 'Ink, pigment and quiz-fire',
    entries: [
      { time: '10:00', title: 'Littmania — Biocrux & Cognizzia', cat: 'Literary', venue: 'Lecture Complex' },
      { time: '12:30', title: 'Kalakriti — Fantasy Faces', cat: 'Fine Arts', venue: 'Painted Cliffs' },
      { time: '15:00', title: 'Chronos — Mr. & Ms. PYREXIA', cat: 'Cultural', venue: 'Auditorium' },
      { time: '18:00', title: 'Thespians — Comic Combat', cat: 'Theatre', venue: 'Amphitheatre' },
      { time: '20:00', title: 'Star Night — Auriga', cat: 'Star Night', venue: 'Main Stage' },
    ],
  },
  {
    day: 'Day 05',
    title: 'Starlight Finale',
    subtitle: 'The treasure is claimed under the island sky',
    entries: [
      { time: '10:00', title: 'Velocity — Grand Finals', cat: 'Sports', venue: 'Sports Ground' },
      { time: '13:00', title: 'Chorea — Ballismus Finals', cat: 'Dance', venue: 'Main Stage' },
      { time: '16:00', title: 'Prize Distribution', cat: 'Ceremony', venue: 'Main Stage' },
      { time: '19:00', title: 'Headline Star Night', cat: 'Star Night', venue: 'Main Stage' },
      { time: '22:00', title: 'The Last Carnival — Closing', cat: 'Ceremony', venue: 'Main Stage' },
    ],
  },
]
