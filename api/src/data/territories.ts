// Copied from the site's src/data/events.ts. Kept in step by hand for now;
// if these two ever drift, the API is the one that decides what is real.

/**
 * PYREXIA 2026: Event data
 * Sourced from the PYREXIA 5.0 (2025) official brochure, AIIMS Rishikesh.
 * Category names, sub-events and coordinator contacts are real.
 * Island "territory" names are the 2026 creative layer.
 */

export type Contact = { name: string; phone: string }

export type SubEvent = {
  name: string
  tag: string
}

export type Territory = {
  id: string
  /** Real PYREXIA vertical name */
  code: string
  /** Real descriptor from the brochure */
  subtitle: string
  /** 2026 island territory name */
  territory: string
  blurb: string
  /** lucide-react icon name */
  icon: string
  /** position on the island map, in % */
  map: { x: number; y: number }
  accent: string
  events: SubEvent[]
  contacts: Contact[]
  /** True for territories that aren't a competitive event to sign up for (e.g. the opening ceremony). */
  noRegister?: boolean
}

export const territories: Territory[] = [
  {
    id: 'fahrenheit',
    code: 'Fahrenheit',
    subtitle: 'The Opening Ceremony',
    territory: 'Ember Landing',
    blurb: 'Where the fever is lit. The gates open and the voyage begins in fire and light.',
    icon: 'Flame',
    map: { x: 58.5, y: 82.0 },
    accent: '#e0894a',
    events: [{ name: 'Fahrenheit', tag: 'Grand Opening Ceremony' }],
    /** Opening ceremony: every delegate attends automatically, so no registration. */
    noRegister: true,
    contacts: [
      { name: 'Pulkit', phone: '6387508295' },
      { name: 'Shreya', phone: '8887878101' },
      { name: 'Gautam', phone: '8540909279' },
    ],
  },
  {
    id: 'chorea',
    code: 'Chorea',
    subtitle: 'Dance Extravaganza',
    territory: 'Rhythm Reef',
    blurb: 'Every wave keeps time. Solo storms, folk tides and street currents collide on the reef.',
    icon: 'Music4',
    map: { x: 13.5, y: 13.0 },
    accent: '#d05a8a',
    events: [
      { name: 'Adaptune', tag: 'Extempore Dance' },
      { name: 'Nritya Sangam', tag: 'Classical / Folk' },
      { name: 'Street Blaze', tag: 'Street Dance' },
      { name: 'Ballismus', tag: 'Western Dance' },
    ],
    contacts: [
      { name: 'Ritika', phone: '9302596114' },
      { name: 'Raheel', phone: '7086042407' },
      { name: 'Shivanshi', phone: '9258542725' },
    ],
  },
  {
    id: 'sinfonia',
    code: 'Sinfonia',
    subtitle: 'The Vocal Symphony',
    territory: "Siren's Harbor",
    blurb: 'Voices that lure ships to shore: classical swells, western storms, bands and rap battles.',
    icon: 'Mic2',
    map: { x: 36.5, y: 12.0 },
    accent: '#5aa9d0',
    events: [
      { name: 'Tarang', tag: 'Indian / Classical Singing' },
      { name: 'Metallica', tag: 'Instrumental Music' },
      { name: 'Euphonia', tag: 'Western Singing' },
      { name: 'Battle of Bands', tag: 'Band Competition' },
      { name: 'Rhythm Revolution', tag: 'Rap & Beatboxing' },
    ],
    contacts: [
      { name: 'Ritika', phone: '9302596114' },
      { name: 'Raheel', phone: '7086042407' },
      { name: 'Shivanshi', phone: '9258542725' },
    ],
  },
  {
    id: 'thespians',
    code: 'Thespians',
    subtitle: 'The Theatre Syndicate',
    territory: 'Masquerade Bay',
    blurb: 'Masks, monologues and mayhem. The stage where every story is a heist.',
    icon: 'Drama',
    map: { x: 65.5, y: 13.0 },
    accent: '#b06fd0',
    events: [
      { name: 'Echoes of Expression', tag: 'Monoact & Mime' },
      { name: 'mADD Angle', tag: 'Drama bhi, Deal bhi' },
      { name: 'Nukkad Natak', tag: 'Street Play' },
    ],
    contacts: [
      { name: 'Ritika', phone: '9302596114' },
      { name: 'Raheel', phone: '7086042407' },
      { name: 'Shivanshi', phone: '9258542725' },
    ],
  },
  {
    id: 'velocity',
    code: 'Velocity',
    subtitle: 'Epic Sports Showdown',
    territory: 'Conquest Arena',
    blurb: 'Sand, sweat and glory. Eleven battlegrounds where crews fight for the flag.',
    icon: 'Swords',
    map: { x: 79.0, y: 31.5 },
    accent: '#4fae8b',
    events: [
      { name: 'Cricket', tag: 'Team' },
      { name: 'Football', tag: 'Team' },
      { name: 'Basketball', tag: 'Team' },
      { name: 'Volleyball', tag: 'Team' },
      { name: 'Futsal', tag: 'Team' },
      { name: 'Kabaddi', tag: 'Team' },
      { name: 'Table Tennis', tag: 'Racquet' },
      { name: 'Badminton', tag: 'Racquet' },
      { name: 'Powerlifting', tag: 'Strength' },
      { name: 'Carrom', tag: 'Board' },
      { name: 'Chess', tag: 'Board' },
    ],
    contacts: [
      { name: 'Sharva', phone: '8484857561' },
      { name: 'Saransh', phone: '6377478125' },
      { name: 'Harnoor', phone: '7719602007' },
    ],
  },
  {
    id: 'chronos',
    code: 'Chronos',
    subtitle: 'Mr. & Ms. PYREXIA',
    territory: 'Crown Isle',
    blurb: 'Poise, wit and presence. The isle that crowns the faces of the fever.',
    icon: 'Crown',
    map: { x: 50.0, y: 33.0 },
    accent: '#e6c25e',
    events: [{ name: 'Mr. & Ms. PYREXIA', tag: 'Personality Showcase' }],
    contacts: [
      { name: 'Tanmaydeep', phone: '8699381231' },
      { name: 'Ananya', phone: '9663038303' },
      { name: 'Ridhima', phone: '9877963460' },
      { name: 'Asmita', phone: '9915198162' },
    ],
  },
  {
    id: 'littmania',
    code: 'Littmania',
    subtitle: "The Storytellers' Guild",
    territory: 'Ink & Lore Lagoon',
    blurb: 'Words are weapons here: poetry duels, debates, extempore and quizzes of every realm.',
    icon: 'ScrollText',
    map: { x: 23.5, y: 33.0 },
    accent: '#c98f5a',
    events: [
      { name: 'JAM', tag: 'Just a Minute' },
      { name: 'Literary Escape Room', tag: 'Solve your way out' },
      { name: 'Oratio', tag: 'Bi-lingual Debate' },
      { name: 'Poetic Reveries', tag: 'English Poetry' },
      { name: 'Taboo', tag: 'Word Play' },
      { name: 'Declamation', tag: 'Spoken Word' },
      { name: 'Kavyotsav', tag: 'Hindi Poetry' },
      { name: 'Storysmiths', tag: 'Storytelling' },
      { name: 'Logophilia', tag: 'For the word-obsessed' },
      { name: 'Cognizzia', tag: 'General Trivia' },
      { name: 'Cineholics', tag: 'Fandom Quiz' },
      { name: 'Anime no Tatakai', tag: 'Anime Quiz' },
    ],
    contacts: [
      { name: 'Jatin', phone: '9571602438' },
      { name: 'Chetna', phone: '8885284755' },
      { name: 'Kriti', phone: '8837824605' },
      { name: 'Sudeshna', phone: '7041351726' },
    ],
  },
  {
    id: 'kalakriti',
    code: 'Kalakriti',
    subtitle: 'The Artistry Alliance',
    territory: 'Painted Cliffs',
    blurb: 'Pigment, clay and coffee. Cliffs where the island paints its own legend.',
    icon: 'Palette',
    map: { x: 36.5, y: 55.0 },
    accent: '#d98f6a',
    events: [
      { name: 'Fantasy Faces', tag: 'Face Painting' },
      { name: 'Acrylic Odyssey', tag: 'Acrylic Painting' },
      { name: 'Contrast Chronicles', tag: 'Sketching' },
      { name: 'Caffeine Creations', tag: 'Coffee Painting' },
      { name: 'Brushless Strokes', tag: 'No-brush Painting' },
      { name: 'Splash Tees', tag: 'T-shirt Painting' },
      { name: 'Mould It Up', tag: 'Clay Sculpting' },
      { name: 'Stone Painting', tag: 'Paint on stone' },
      { name: 'Cupful of Doodles', tag: 'Cup Doodling' },
    ],
    contacts: [
      { name: 'Mudassir', phone: '8861384164' },
      { name: 'Bhavya', phone: '8764213826' },
    ],
  },
  {
    id: 'alfresco',
    code: 'Alfresco',
    subtitle: 'The Informals · Fun Frenzy',
    territory: 'Carnival Cove',
    blurb: 'No rules, all riot. Squid games, dates, dumb charades and treasure hunts on the sand.',
    icon: 'PartyPopper',
    map: { x: 50.5, y: 63.5 },
    accent: '#e07a5a',
    events: [
      { name: 'Evening Amore', tag: 'Date Night' },
      { name: 'Capture and Conquer', tag: 'Photo Hunt' },
      { name: 'Grab O Mania', tag: 'Grab it before it goes' },
      { name: 'Squid Game', tag: 'Win big or else' },
      { name: 'Pictionary', tag: 'Draw it out' },
      { name: 'Paper Dance', tag: 'Balance duo' },
      { name: 'Balloon Burst', tag: 'Every pop counts' },
      { name: 'Treasure Hunt', tag: 'Can you find it?' },
      { name: 'Songstra Vaganza', tag: 'Melody marathon' },
      { name: 'Tambola', tag: 'Housie' },
      { name: 'Musical Chairs', tag: 'Spin & scramble' },
      { name: 'Soul Sync', tag: 'Test your bond' },
      { name: 'Drape It', tag: 'Style face-off' },
      { name: 'Dumb Charades', tag: 'Act it, never say it' },
      { name: 'Swift Mingle', tag: 'Speed connect' },
    ],
    contacts: [
      { name: 'Shail Nandini', phone: '9817818054' },
      { name: 'Ranjeeta', phone: '9939179798' },
    ],
  },
  {
    id: 'thunderbolt',
    code: 'Thunderbolt',
    subtitle: 'The E-Gaming Galore',
    territory: 'Thunder Keep',
    blurb: 'Screens flash like lightning. Squads clash in the keep of the digital storm.',
    icon: 'Gamepad2',
    map: { x: 66.5, y: 52.0 },
    accent: '#6f7bd0',
    events: [
      { name: 'BGMI', tag: 'Squad Tournament' },
      { name: 'FIFA', tag: 'Tournament' },
      { name: 'COD: Mobile', tag: 'Tournament' },
      { name: 'Tekken', tag: 'Tournament' },
      { name: 'Mortal Kombat', tag: 'Tournament' },
    ],
    contacts: [
      { name: 'Bharat', phone: '9588957283' },
      { name: 'Lokesh', phone: '623890083' },
    ],
  },
  {
    id: 'auriga',
    code: 'Auriga',
    subtitle: 'The Pro Nights',
    territory: 'Starlight Summit',
    blurb: 'The peak of the voyage. Where the biggest names light up the island sky.',
    icon: 'Star',
    map: { x: 87.5, y: 57.0 },
    accent: '#e6c25e',
    events: [{ name: 'The Pro Nights', tag: 'Headline Performances' }],
    contacts: [],
  },
]
