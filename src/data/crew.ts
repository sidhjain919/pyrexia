/**
 * The Navigator's Desk: the Chief Organising Committee and the FAQs.
 *
 * Roles carry a phone number because the one thing a visitor wants from this
 * block is a person to call, and a name with no number is a dead end.
 */

export type Officer = { role: string; name: string; phone: string }

export const committee: Officer[] = [
  { role: 'President', name: 'Ashwani Jangir', phone: '9485775207' },
  { role: 'Vice President', name: 'Siddhant Shourya Goyal', phone: '9340907899' },
  { role: 'General Secretary', name: 'Saumy Siddharth', phone: '9508452679' },
  { role: 'Finance Secretary', name: 'Avinash Pundhir', phone: '8273422045' },
  { role: 'Student Co-ordinator', name: 'Vridhi Prashar', phone: '8699155303' },
  { role: 'Student Co-ordinator', name: 'Amrisha', phone: '9508773394' },
  { role: 'Student Co-ordinator', name: 'Bhavya Gupta', phone: '9896127773' },
  { role: 'Student Co-ordinator', name: 'Shivin Giri', phone: '8859479477' },
  { role: 'Student Co-ordinator', name: 'Pushkar Jain', phone: '8077075480' },
]

export type FAQ = { q: string; a: string }

export const faqs: FAQ[] = [
  {
    q: 'When is PYREXIA 2026?',
    a: "Five days on the island, 12 to 16 October 2026, at AIIMS Rishikesh. The hour-by-hour Captain's Log drops closer to the fest.",
  },
  {
    q: 'How do I join the crew?',
    a: 'Everything happens on this website — registration for the fest and for every event. Start with Basic Registration (BR), which is your boarding pass to the island. Individual event entries open through the season; the noticeboard says when each territory opens.',
  },
  {
    q: 'Is basic registration mandatory?',
    a: 'Yes. Basic Registration is campus entry. To take part in any event or sport, or simply to come onto the campus, you must complete it first.',
  },
  {
    q: 'Do individual events cost anything?',
    a: 'Some do. Basic Registration covers being on the island and competing, and a few events, the Alfresco informals among them, charge their own entry fee on top. You see the exact amount on the entry form and pay it there; nothing is collected at the venue.',
  },
  {
    q: 'How do I reach the island (Rishikesh)?',
    a: 'Fly into Jolly Grant Airport, Dehradun (≈20 km) and cab in; take a train to Haridwar Junction (≈25 km) or direct to Rishikesh; or ride in by road. The town is well connected by bus and taxi from Delhi, Haridwar and Dehradun.',
  },
  {
    q: 'What is there to explore in Rishikesh?',
    a: 'Plenty: Triveni Ghat, Ram Jhula, Laxman Jhula, Janki Setu, Neelkanth Temple, the Beatles Ashram, Rajaji National Park, Shivpuri, and waterfalls at Patna and Neer Garh, with Dehradun, Mussoorie and Dhanaulti nearby.',
  },
  {
    q: 'When is the star lineup announced?',
    a: "That's the island's best-kept secret. Five nights, five reveals. When the curtain lifts, the stars will blow your mind.",
  },
]
