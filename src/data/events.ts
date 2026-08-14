/**
 * PYREXIA 2026 — Event data
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
}

export const territories: Territory[] = [
  {
    id: 'fahrenheit',
    code: 'Fahrenheit',
    subtitle: 'The Opening Ceremony',
    territory: 'Ember Landing',
    blurb: 'Where the fever is lit. The gates open and the voyage begins in fire and light.',
    icon: 'Flame',
    map: { x: 50, y: 20 },
    accent: '#e0894a',
    events: [{ name: 'Fahrenheit', tag: 'Grand Opening Ceremony' }],
    contacts: [
      { name: 'Arunima', phone: '9741001680' },
      { name: 'Devanshu', phone: '7986477572' },
    ],
  },
  {
    id: 'chorea',
    code: 'Chorea',
    subtitle: 'Dance Extravaganza',
    territory: 'Rhythm Reef',
    blurb: 'Every wave keeps time. Solo storms, folk tides and street currents collide on the reef.',
    icon: 'Music4',
    map: { x: 24, y: 34 },
    accent: '#d05a8a',
    events: [
      { name: 'Adaptune', tag: 'Extempore Dance' },
      { name: 'Nritya Sangam', tag: 'Classical / Folk' },
      { name: 'Street Blaze', tag: 'Street Dance' },
      { name: 'Ballismus', tag: 'Western Dance' },
    ],
    contacts: [
      { name: 'Sonal', phone: '7747882919' },
      { name: 'Gurbir', phone: '9888281783' },
      { name: 'Jasgeet', phone: '8360125977' },
    ],
  },
  {
    id: 'sinfonia',
    code: 'Sinfonia',
    subtitle: 'The Vocal Symphony',
    territory: "Siren's Harbor",
    blurb: 'Voices that lure ships to shore — classical swells, western storms, bands and rap battles.',
    icon: 'Mic2',
    map: { x: 71, y: 30 },
    accent: '#5aa9d0',
    events: [
      { name: 'Tarang', tag: 'Indian / Classical Singing' },
      { name: 'Metallica', tag: 'Western Singing' },
      { name: 'Euphonia', tag: 'Instrumental Music' },
      { name: 'Battle of Bands', tag: 'Band Competition' },
      { name: 'Rhythm Revolution', tag: 'Rap & Beatboxing' },
    ],
    contacts: [
      { name: 'Atharva', phone: '7709048685' },
      { name: 'Ayush', phone: '7983283731' },
      { name: 'Sweta', phone: '8595651487' },
      { name: 'Anusha', phone: '7888941481' },
    ],
  },
  {
    id: 'thespians',
    code: 'Thespians',
    subtitle: 'The Theatre Syndicate',
    territory: 'Masquerade Bay',
    blurb: 'Masks, monologues and mayhem. The stage where every story is a heist.',
    icon: 'Drama',
    map: { x: 38, y: 52 },
    accent: '#b06fd0',
    events: [
      { name: 'Comic Combat', tag: 'Stand-up Comedy' },
      { name: 'Echoes of Expression', tag: 'Monoact & Mime' },
      { name: 'mADD Angle', tag: 'Drama bhi, Deal bhi' },
      { name: 'Nukkad Natak', tag: 'Street Play' },
    ],
    contacts: [
      { name: 'Devendra', phone: '6265618860' },
      { name: 'Arpit', phone: '9914670293' },
    ],
  },
  {
    id: 'velocity',
    code: 'Velocity',
    subtitle: 'Epic Sports Showdown',
    territory: 'Conquest Arena',
    blurb: 'Sand, sweat and glory. Eleven battlegrounds where crews fight for the flag.',
    icon: 'Swords',
    map: { x: 82, y: 55 },
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
      { name: 'Sahil', phone: '6350274294' },
      { name: 'Abhishek', phone: '9001229622' },
      { name: 'Partyaksh', phone: '8988639379' },
      { name: 'Suhani', phone: '9929018373' },
    ],
  },
  {
    id: 'chronos',
    code: 'Chronos',
    subtitle: 'Mr. & Ms. PYREXIA',
    territory: 'Crown Isle',
    blurb: 'Poise, wit and presence. The isle that crowns the faces of the fever.',
    icon: 'Crown',
    map: { x: 58, y: 46 },
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
    blurb: 'Words are weapons here — poetry duels, debates, extempore and quizzes of every realm.',
    icon: 'ScrollText',
    map: { x: 17, y: 62 },
    accent: '#c98f5a',
    events: [
      { name: 'JAM', tag: '60-second Extempore' },
      { name: 'Bilingual Debate', tag: 'Hindi & English' },
      { name: 'Kavyotsav', tag: 'Hindi Poetry' },
      { name: 'Poetic Reverie', tag: 'English Poetry' },
      { name: 'Taboo', tag: 'Word Play' },
      { name: 'Literary Treasure Hunt', tag: 'Informal' },
      { name: 'Biocrux Jr & Sr', tag: 'Pre-Clinical / Clinical Quiz' },
      { name: 'Cognizzia', tag: 'General Trivia' },
      { name: 'Cineholic', tag: 'Fandom Quiz' },
      { name: 'Anime No Tatakae', tag: 'Anime Quiz' },
      { name: 'Hindi Gyan Utsav', tag: 'Literature Quiz' },
    ],
    contacts: [
      { name: 'Dibya', phone: '9475753525' },
      { name: 'Arnav', phone: '8971290704' },
      { name: 'Aditya', phone: '7483319871' },
    ],
  },
  {
    id: 'kalakriti',
    code: 'Kalakriti',
    subtitle: 'The Artistry Alliance',
    territory: 'Painted Cliffs',
    blurb: 'Pigment, clay and coffee. Cliffs where the island paints its own legend.',
    icon: 'Palette',
    map: { x: 30, y: 78 },
    accent: '#d98f6a',
    events: [
      { name: 'Fantasy Faces', tag: 'Face Painting' },
      { name: 'Acrylic Odyssey', tag: 'Acrylic Painting' },
      { name: 'Contrast Chronicles', tag: 'Sketching' },
      { name: 'Caffeine Creations', tag: 'Coffee Painting' },
      { name: 'Brushless Strokes', tag: 'No-brush Painting' },
      { name: 'Splash Tees', tag: 'T-shirt Painting' },
      { name: 'Mould It Up', tag: 'Clay Sculpting' },
      { name: 'Fold Tales', tag: 'Origami + Story' },
      { name: 'Cupful of Doodles', tag: 'Cup Doodling' },
    ],
    contacts: [
      { name: 'Ronak', phone: '8769235744' },
      { name: 'Rashi', phone: '8200093641' },
    ],
  },
  {
    id: 'alfresco',
    code: 'Alfresco',
    subtitle: 'The Informals — Fun Frenzy',
    territory: 'Carnival Cove',
    blurb: 'No rules, all riot. Squid games, dates, dumb charades and treasure hunts on the sand.',
    icon: 'PartyPopper',
    map: { x: 63, y: 74 },
    accent: '#e07a5a',
    events: [
      { name: 'Squid Game', tag: 'Win big or else' },
      { name: 'Capture and Conquer', tag: 'Photo Hunt' },
      { name: 'Treasure Hunt', tag: 'Can you find it?' },
      { name: 'Silent Giggles', tag: 'Guess without a sound' },
      { name: 'Paper Dance', tag: 'Balance duo' },
      { name: 'Balloon Burst Frenzy', tag: 'Every pop counts' },
      { name: 'Songstravaganza', tag: 'Melody marathon' },
      { name: "Your Pace or Mine?", tag: 'Dumb Charades' },
      { name: 'Evening Amore', tag: 'Date Night' },
      { name: 'Swift Mingle', tag: 'Speed connect' },
      { name: 'Soul Sync', tag: 'Test your bond' },
      { name: 'Tambola', tag: 'Housie' },
      { name: 'Musical Chairs', tag: 'Spin & scramble' },
      { name: 'Drape It', tag: 'Style face-off' },
    ],
    contacts: [
      { name: 'VKK Jayanth', phone: '9515359653' },
      { name: 'Vishal', phone: '8209039899' },
      { name: 'Muskan', phone: '9784431503' },
    ],
  },
  {
    id: 'thunderbolt',
    code: 'Thunderbolt',
    subtitle: 'The E-Gaming Galore',
    territory: 'Thunder Keep',
    blurb: 'Screens flash like lightning. Squads clash in the keep of the digital storm.',
    icon: 'Gamepad2',
    map: { x: 78, y: 82 },
    accent: '#6f7bd0',
    events: [
      { name: 'BGMI', tag: 'Squad Tournament' },
      { name: 'FIFA', tag: 'Tournament' },
      { name: 'COD: Mobile', tag: 'Tournament' },
      { name: 'Tekken', tag: 'Tournament' },
      { name: 'Mortal Kombat', tag: 'Tournament' },
    ],
    contacts: [
      { name: 'Deepanshu', phone: '6367292318' },
      { name: 'Saurabh', phone: '9958625272' },
    ],
  },
  {
    id: 'auriga',
    code: 'Auriga',
    subtitle: 'The Star Nights',
    territory: 'Starlight Summit',
    blurb: 'The peak of the voyage. Where the biggest names light up the island sky.',
    icon: 'Star',
    map: { x: 50, y: 88 },
    accent: '#e6c25e',
    events: [{ name: 'The Star Nights', tag: 'Headline Performances' }],
    contacts: [],
  },
]
