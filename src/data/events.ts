/**
 * PYREXIA 2026: Event data
 *
 * Every event, sub-event, team size and coordinator here comes from the final
 * 2026 rulebooks (the PDFs served from `public/rulebooks`). Where the 2025
 * brochure and the 2026 rulebook disagree, the rulebook wins: it is what the
 * wardens will actually run.
 *
 * Island "territory" names are the 2026 creative layer.
 */

export type Contact = { name: string; phone: string }

export type SubEvent = {
  name: string
  tag: string
  /**
   * Registration lives on an external form.
   *
   * Thunderbolt runs its tournaments off Google Forms the e-gaming crew
   * already built, and Battle of Bands screens on one before anybody pays,
   * so the site links straight out rather than rebuilding those questions.
   */
  form?: string
  /** What the form is for, said on the card in the crew's own words. */
  formTitle?: string
  formNote?: string
}

/** Every Thunderbolt bracket says the same thing about its form, once. */
const THUNDERBOLT_FORM = {
  formTitle: 'Thunderbolt takes entries on its own form',
  formNote:
    'The e-gaming crew runs every bracket from their own sheet — squads, in-game IDs and the tournament WhatsApp group all live there. It opens in a new tab, and it takes a minute.',
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
  /**
   * What the card offers when there is nothing to register for.
   *
   * Fahrenheit and Auriga are not competitions: one is the ceremony every
   * delegate walks into, the other is the pro nights. A "Register" button on
   * either would be a lie, and "Coming Soon" is worse — it promises a form
   * that is never going to arrive. So they get the thing a visitor actually
   * wants from them instead.
   */
  cta?: { label: string; to: string }
  /** Filename in `public/rulebooks`, where this vertical's official rulebook is published. */
  rulebook?: string
}

export const territories: Territory[] = [
  // Competitions first, in the order the brochure lists them; the two you
  // don't register for — the opening ceremony and the pro nights — come last,
  // so a strip of tabs opens on a rail of things to enter rather than on the
  // one card with a single item.
  {
    id: 'chorea',
    code: 'Chorea',
    subtitle: 'Dance Extravaganza',
    territory: 'Rhythm Reef',
    blurb: 'Every wave keeps time. Solo storms, folk tides and street currents collide on the reef.',
    icon: 'Music4',
    map: { x: 13.5, y: 13.0 },
    accent: '#d05a8a',
    rulebook: 'solasta.pdf',
    events: [
      { name: 'Nritya Sangam', tag: 'Classical & Folk · Solo, Duet or Group' },
      { name: 'Ballismus', tag: 'Western, Bollywood & Fusion' },
      { name: 'Street Blaze', tag: 'Street & Urban Battle' },
      { name: 'Adaptune', tag: 'Song revealed one minute before you dance' },
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
    rulebook: 'solasta.pdf',
    events: [
      { name: 'Tarang', tag: 'Indian Light, Semi-classical, Bollywood & Folk' },
      { name: 'Euphonia', tag: 'Western Singing' },
      { name: 'Metallica', tag: 'Instrumental · Solo or Duet' },
      {
        name: 'Battle of Bands',
        tag: 'Screening round open · Google Form',
        form: 'https://docs.google.com/forms/d/e/1FAIpQLScVk9SA0EM9EnKK6ZKEGRkalygCFITqgkJ6wRoOJ3LZFNrcbA/viewform?usp=dialog',
        formTitle: 'This form is for the screening round',
        formNote:
          'Battle of Bands screens online first. Fill the form with a link to a performance video of no more than 5 minutes by 2 October 2026 — nothing is paid at this stage. Bands that clear the screening hear from the Sinfonia crew about the live final and the ₹2000 band fee.',
      },
      { name: 'Rhythm Revolution', tag: 'Rap & Beatboxing Face-off' },
    ],
    contacts: [
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
    rulebook: 'solasta.pdf',
    events: [
      { name: 'Echoes of Expression', tag: 'Monoact & Mime' },
      { name: 'mADD Angle', tag: 'Random prop, one minute, sell it or stage it' },
      { name: 'Nukkad Natak', tag: 'Street Play · Teams of 6–20' },
    ],
    contacts: [
      { name: 'Shivanshi', phone: '9258542725' },
      { name: 'Rikki', phone: '9034573823' },
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
    rulebook: 'velocity.pdf',
    events: [
      { name: 'Basketball', tag: '5v5 and 3v3 · Men & Women' },
      { name: 'Volleyball', tag: 'Squad of 12 · Men & Women' },
      { name: 'Cricket', tag: '20 overs, knockout · Squad of 15' },
      { name: 'Football', tag: '11-a-side · 30-5-30' },
      { name: 'Futsal', tag: '5-a-side · Squad of 9' },
      { name: 'Kabaddi', tag: 'Squad of 12 · Men & Women' },
      { name: 'Table Tennis', tag: 'Singles, Doubles & Mixed' },
      { name: 'Badminton', tag: 'Singles, Doubles & Mixed · BWF rules' },
      { name: 'Chess', tag: 'Team, Rapid, Blitz & Bullet' },
      { name: 'Carrom', tag: 'Singles & Doubles · Best of three' },
      { name: 'Powerlifting', tag: 'Squat, Bench, Deadlift · Four weight classes' },
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
    rulebook: 'chronos.pdf',
    events: [{ name: 'Mr. & Ms. PYREXIA', tag: 'Theme 2026 · Serenity of Seasons' }],
    contacts: [
      { name: 'Ritika', phone: '9302596114' },
      { name: 'Rashi', phone: '8200093641' },
      { name: 'Mudassir', phone: '8861384164' },
      { name: 'Vridhi', phone: '8699155303' },
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
    rulebook: 'littmania.pdf',
    events: [
      { name: 'Cognizzia', tag: 'General Trivia · Four rounds' },
      { name: 'Cineholics', tag: 'Film, series & OTT quiz' },
      { name: 'Anime no Tatakai', tag: 'Anime Quiz · Trivia, picture & audio rounds' },
      { name: 'JAM', tag: 'Sixty seconds, no hesitation' },
      { name: 'Oratio', tag: 'Bilingual Debate · Hindi & English' },
      { name: 'Literary Escape Room', tag: 'Riddles, clues and a ticking clock' },
      { name: 'Storysmiths', tag: 'Relay story writing · Teams of 3' },
      { name: 'Taboo', tag: 'Describe it without saying it' },
      { name: 'Poetic Reveries', tag: 'English Poetry · Self-written only' },
      { name: 'Kavyotsav', tag: 'Hindi Poetry' },
      { name: 'Logophilia', tag: 'Spell bee, etymology, wordle and more' },
      { name: 'Declamation', tag: 'Four to seven minutes on a topic you choose' },
    ],
    contacts: [
      { name: 'Jatin', phone: '9571602438' },
      { name: 'Priyansh', phone: '9855545921' },
      { name: 'Sushma', phone: '7892927158' },
      { name: 'Yug Bhoi', phone: '9978618124' },
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
    rulebook: 'kalakriti.pdf',
    events: [
      { name: 'Fantasy Faces', tag: 'Face Painting · One artist, one canvas' },
      { name: 'Splash Tees', tag: 'T-shirt Painting · 1.5 hours' },
      { name: 'Contrast Chronicles', tag: 'B&W Sketching · 2 hours' },
      { name: 'Acrylic Odyssey', tag: 'Acrylic on canvas · 2 hours' },
      { name: 'Cupful of Doodles', tag: 'Doodle a paper cup · 1 hour' },
      { name: 'Caffeine Creations', tag: 'Coffee Painting · Coffee only' },
      { name: 'Brushless Strokes', tag: 'Paint with anything but a brush' },
      { name: 'Stone Painting', tag: 'Turn a stone into a story' },
      { name: 'Mould It Up', tag: 'Clay Sculpting · Clay only' },
      { name: 'Art Roulette', tag: 'One canvas, two artists, two minutes each' },
    ],
    contacts: [
      { name: 'Bhavya', phone: '8764213826' },
      { name: 'Siddharth', phone: '6393090764' },
      { name: 'Rashi', phone: '8200093641' },
      { name: 'Ayush', phone: '7985371801' },
    ],
  },
  {
    id: 'alfresco',
    code: 'Alfresco',
    subtitle: 'The Informals · Fun Frenzy',
    territory: 'Carnival Cove',
    blurb: 'No rules, all riot. Squid games, dates, dumb charades and treasure hunts on the sand. Prize pool worth ₹25,000.',
    icon: 'PartyPopper',
    map: { x: 50.5, y: 63.5 },
    accent: '#e07a5a',
    rulebook: 'alfresco.pdf',
    events: [
      { name: 'Evening Amore', tag: 'Blind date night · 14 Oct' },
      { name: 'Capture and Conquer', tag: 'Scavenger hunt · 60 minutes' },
      { name: 'Grab O Mania', tag: 'Blindfolded relay · Teams of 4' },
      { name: 'Squid Game', tag: 'Four rounds. Only some of you continue.' },
      { name: 'Pictionary', tag: 'Three rounds, one non-dominant hand' },
      { name: 'Paper Dance', tag: 'The paper gets smaller. Keep dancing.' },
      { name: 'Balloon Burst', tag: 'No hands. Just the chair.' },
      { name: 'Treasure Hunt', tag: 'Crack the clues, race your rivals' },
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
    rulebook: 'thunderbolt.pdf',
    /**
     * Every Thunderbolt bracket is run from the e-gaming crew's own Google
     * Form, so the card links out instead of opening the site's entry form.
     */
    events: [
      { name: 'BGMI', tag: 'Battle Royale & TDM · Squads of 4+', form: 'https://forms.gle/vjFRZTP1P9XkSa9v5', ...THUNDERBOLT_FORM },
      { name: 'COD: Mobile', tag: 'Multiplayer · Teams of 5', form: 'https://forms.gle/LFS8Kh3pMk6xhkhq6', ...THUNDERBOLT_FORM },
      { name: 'Free Fire', tag: 'Battle Royale & Clash Squad', form: 'https://forms.gle/hqAWj3HgAAYvXZRW9', ...THUNDERBOLT_FORM },
      { name: 'Clash Royale', tag: 'Duel Battle · Three rounds', form: 'https://forms.gle/P6ZNcpGxGxFcZLVQ8', ...THUNDERBOLT_FORM },
      { name: 'E-Chess', tag: 'Bullet on Chess.com · Swiss format', form: 'https://forms.gle/QkGDNELVdJgeDtjK9', ...THUNDERBOLT_FORM },
      { name: 'Tekken', tag: 'Pools, then knockout finals', form: 'https://forms.gle/hqXw7j1kMM6qgDcp8', ...THUNDERBOLT_FORM },
      { name: 'Mortal Kombat', tag: 'Pools, then knockout finals', form: 'https://forms.gle/SjjPk7sS9WYRdFmY7', ...THUNDERBOLT_FORM },
      { name: 'FIFA', tag: 'Pools, then knockout finals', form: 'https://forms.gle/sFwhgkrBrCqNBbuT7', ...THUNDERBOLT_FORM },
    ],
    contacts: [
      { name: 'Bharat', phone: '9588957283' },
      { name: 'Lokesh', phone: '6238930083' },
    ],
  },
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
    /** Opening ceremony: every delegate walks in on their pass, so no entry form. */
    noRegister: true,
    cta: { label: 'Get your pass', to: '/#register' },
    contacts: [
      { name: 'Pulkit', phone: '6387508295' },
      { name: 'Shreya', phone: '8887878101' },
      { name: 'Gautam', phone: '8540909279' },
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
    events: [{ name: 'The Pro Nights', tag: 'Parmish Verma · Navjot Ahuja · Nucleya' }],
    /** The pro nights are on your pass, not something you enter. */
    noRegister: true,
    cta: { label: 'See the lineup', to: '/#artists' },
    contacts: [],
  },
]

/**
 * Every competition on the island, counted once.
 *
 * Derived rather than typed out, because the number appears on three surfaces
 * and the events list changes more often than anybody remembers to update a
 * headline. Fahrenheit and the Pro Nights are excluded: they are not things
 * you compete in.
 */
export const TOTAL_EVENTS = territories
  .filter((t) => !t.noRegister)
  .reduce((n, t) => n + t.events.length, 0)

/** The rulebook PDF for one territory, or null where none is published yet. */
export function rulebookFor(territoryId: string): string | null {
  return territories.find((t) => t.id === territoryId)?.rulebook ?? null
}
