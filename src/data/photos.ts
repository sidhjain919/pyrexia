/**
 * Real PYREXIA photography, one frame per event.
 *
 * Shot at previous editions at AIIMS Rishikesh and re-encoded to WebP at the
 * size the cards actually render (see the resizer note in README). An event
 * with no entry here falls back to its territory's photo, so adding one is
 * dropping a file in and adding a line.
 */

import { asset } from '../lib/asset'

const p = (file: string) => asset(`photos/${file}`)

/** Event name, exactly as it appears in `events.ts`, to its photo. */
export const eventPhoto: Record<string, string> = {
  "Balloon Burst": p('events/balloon-burst.webp'),
  "Capture and Conquer": p('events/capture-and-conquer.webp'),
  "Drape It": p('events/drape-it.webp'),
  "Evening Amore": p('events/evening-amore.webp'),
  "Grab O Mania": p('events/grab-o-mania.webp'),
  "Musical Chairs": p('events/musical-chairs.webp'),
  "Paper Dance": p('events/paper-dance.webp'),
  Pictionary: p('events/pictionary.webp'),
  "Songstra Vaganza": p('events/songstra-vaganza.webp'),
  "Soul Sync": p('events/soul-sync.webp'),
  "Squid Game": p('events/squid-game.webp'),
  "Swift Mingle": p('events/swift-mingle.webp'),
  Tambola: p('events/tambola.webp'),
  "Treasure Hunt": p('events/treasure-hunt.webp'),
  "Dumb Charades": p('events/dumb-charades.webp'),
  "Acrylic Odyssey": p('events/acrylic-odyssey.webp'),
  "Brushless Strokes": p('events/brushless-strokes.webp'),
  "Caffeine Creations": p('events/caffeine-creations.webp'),
  "Contrast Chronicles": p('events/contrast-chronicles.webp'),
  "Cupful of Doodles": p('events/cupful-of-doodles.webp'),
  "Fantasy Faces": p('events/fantasy-faces.webp'),
  "Mould It Up": p('events/mould-it-up.webp'),
  "Splash Tees": p('events/splash-tees.webp'),
  "Stone Painting": p('events/stone-painting.webp'),
  "Anime no Tatakai": p('events/anime-no-tatakai.webp'),
  Oratio: p('events/oratio.webp'),
  "Biocrux Jr.": p('events/biocrux-jr.webp'),
  "Biocrux Sr.": p('events/biocrux-sr.webp'),
  Cineholics: p('events/cineholics.webp'),
  Cognizzia: p('events/cognizzia.webp'),
  JAM: p('events/jam.webp'),
  Kavyotsav: p('events/kavyotsav.webp'),
  Taboo: p('events/taboo.webp'),
  Adaptune: p('events/adaptune.webp'),
  Ballismus: p('events/ballismus.webp'),
  "Nritya Sangam": p('events/nritya-sangam.webp'),
  "Street Blaze": p('events/street-blaze.webp'),
  "Battle of Bands": p('events/battle-of-bands.webp'),
  Euphonia: p('events/euphonia.webp'),
  Metallica: p('events/metallica.webp'),
  "Rhythm Revolution": p('events/rhythm-revolution.webp'),
  Tarang: p('events/tarang.webp'),
  "Comic Combat": p('events/comic-combat.webp'),
  "Echoes of Expression": p('events/echoes-of-expression.webp'),
  "Nukkad Natak": p('events/nukkad-natak.webp'),
  "Mr. & Ms. PYREXIA": p('events/mr-and-ms-pyrexia.webp'),
  BGMI: p('events/bgmi.webp'),
  "COD: Mobile": p('events/cod-mobile.webp'),
  FIFA: p('events/fifa.webp'),
  "Mortal Kombat": p('events/mortal-kombat.webp'),
  Tekken: p('events/tekken.webp'),
  Badminton: p('events/badminton.webp'),
  Basketball: p('events/basketball.webp'),
  Carrom: p('events/carrom.webp'),
  Chess: p('events/chess.webp'),
  Cricket: p('events/cricket.webp'),
  Football: p('events/football.webp'),
  Futsal: p('events/futsal.webp'),
  Kabaddi: p('events/kabaddi.webp'),
  Powerlifting: p('events/powerlifting.webp'),
  "Table Tennis": p('events/table-tennis.webp'),
  Volleyball: p('events/volleyball.webp'),
}

/** Past headliners, for the Legends section. */
export const artistPhoto: Record<string, string> = {
  "Sonu Nigam": p('artists/sonu-nigam.webp'),
  "Nikita Gandhi": p('artists/nikita-gandhi.webp'),
  "Amit Mishra": p('artists/amit-mishra.webp'),
  Ravator: p('artists/ravator.webp'),
  Maadhyam: p('artists/maadhyam.webp'),
}

/** Opening-ceremony frames, doubling as section backdrops. */
export const sceneShots: string[] = [
  p('scene/fahrenheit-01.webp'),
  p('scene/fahrenheit-02.webp'),
  p('scene/fahrenheit-03.webp'),
  p('scene/fahrenheit-04.webp'),
  p('scene/fahrenheit-05.webp'),
  p('scene/fahrenheit-06.webp'),
  p('scene/fahrenheit-07.webp'),
]

/** The photo for one event, or null when none has been supplied yet. */
export function photoFor(eventName: string): string | null {
  return eventPhoto[eventName] ?? null
}
