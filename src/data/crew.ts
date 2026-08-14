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
    q: 'How do I join the crew?',
    a: 'Registrations for delegate cards and every event happen entirely on the official PYREXIA website. A basic (delegate) registration is your boarding pass to the island.',
  },
  {
    q: 'Is basic registration mandatory?',
    a: 'Yes. To take part in any event or sport, you must complete your basic registration first — it is your entry to everything on the island.',
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
    a: "That's the island's best-kept secret. When the curtain lifts, the stars will blow your mind — trust us, it is worth the wait.",
  },
]
