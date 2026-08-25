/**
 * The Navigator's Desk — ARSWA office bearers & FAQs.
 * Real data from the PYREXIA 5.0 (2025) brochure.
 */

export type Officer = { role: string; name: string }

export const arswa: Officer[] = [
  { role: 'President', name: 'Dishant Neemroth' },
  { role: 'Vice President', name: 'Ankit Tetarwal' },
  { role: 'General Secretary', name: 'Supratik Chattopadhyay' },
  { role: 'IT Secretary', name: 'Devanshu Agnhotri' },
  { role: 'Finance Secretary', name: 'Sachin Saini' },
  { role: 'Cultural Secretary', name: 'Gurbir Singh' },
  { role: 'Literary Secretary', name: 'Arnav Ranjan' },
  { role: 'Fine Arts Secretary', name: 'Rashi Goyal' },
  { role: 'Sports Secretary', name: 'Saransh Sharma' },
  { role: 'PR Secretary', name: 'Ankit Sinhmar' },
]

export type FAQ = { q: string; a: string }

export const faqs: FAQ[] = [
  {
    q: 'When is PYREXIA 2026?',
    a: "Five days on the island — 12 to 16 October 2026, at AIIMS Rishikesh. The hour-by-hour Captain's Log drops closer to the fest.",
  },
  {
    q: 'How do I join the crew?',
    a: 'Everything happens on this website. Start with Basic Registration (BR) — ₹450 — which is your boarding pass to the island. Event entry forms open a little later in the season.',
  },
  {
    q: 'What is the difference between BR and the Delegate Card?',
    a: 'Basic Registration (₹450) is compulsory for everyone entering the fest, and it lets you register for and compete in any event. The Delegate Card is an add-on of ₹2250 on top of BR (₹2700 in all) and it is what opens the Star Nights.',
  },
  {
    q: 'Can I attend the Star Nights with only BR?',
    a: 'No. Star Nights are the one thing BR does not cover — you need the Delegate Card, purchased as an additional ₹2250 on top of your Basic Registration.',
  },
  {
    q: 'Is basic registration mandatory?',
    a: 'Yes. To take part in any event or sport, or simply to enter the fest, you must complete your Basic Registration first — it is your entry to everything on the island.',
  },
  {
    q: 'How do I reach the island (Rishikesh)?',
    a: 'Fly into Jolly Grant Airport, Dehradun (≈20 km) and cab in; take a train to Haridwar Junction (≈25 km) or direct to Rishikesh; or ride in by road — the town is well connected by bus and taxi from Delhi, Haridwar and Dehradun.',
  },
  {
    q: 'What is there to explore in Rishikesh?',
    a: 'Plenty — Triveni Ghat, Ram Jhula, Laxman Jhula, Janki Setu, Neelkanth Temple, the Beatles Ashram, Rajaji National Park, Shivpuri, and waterfalls at Patna and Neer Garh, with Dehradun, Mussoorie and Dhanaulti nearby.',
  },
  {
    q: 'When is the star lineup announced?',
    a: "That's the island's best-kept secret. Five nights, five reveals — when the curtain lifts, the stars will blow your mind.",
  },
]
