/**
 * Memories from previous voyages.
 *
 * Real PYREXIA photographs from AIIMS Rishikesh, grouped by what is in the
 * frame. `wide` and `tall` come from the actual aspect ratio of each file, so
 * the mosaic spans cells for the shots that earn it rather than by guesswork.
 */

import { asset } from '../lib/asset'

const p = (file: string) => asset(`photos/${file}`)

export type Shot = {
  src: string
  cat: GalleryCat
  caption: string
  /** rough aspect for masonry sizing */
  wide?: boolean
  tall?: boolean
}

export type GalleryCat =
  | 'Pro Nights'
  | 'Music'
  | 'Dance'
  | 'Sports'
  | 'Cultural'
  | 'Fine Arts'
  | 'Campus'

export const galleryCats: GalleryCat[] = [
  'Pro Nights',
  'Music',
  'Dance',
  'Sports',
  'Cultural',
  'Fine Arts',
  'Campus',
]

export const gallery: Shot[] = [
  { src: p('gallery/star-nights-01.webp'), cat: 'Pro Nights', caption: "The summit lights up" },
  { src: p('gallery/star-nights-02.webp'), cat: 'Pro Nights', caption: "A sea of hands under the stage" },
  { src: p('gallery/star-nights-03.webp'), cat: 'Pro Nights', caption: "Pyros light the night", wide: true },
  { src: p('gallery/star-nights-04.webp'), cat: 'Pro Nights', caption: "Smoke, light and thousands", wide: true },
  { src: p('gallery/star-nights-05.webp'), cat: 'Pro Nights', caption: "The headline set", tall: true },
  { src: p('gallery/star-nights-06.webp'), cat: 'Pro Nights', caption: "Confetti at the last chorus" },
  { src: p('gallery/star-nights-07.webp'), cat: 'Pro Nights', caption: "Blue hour on the summit" },
  { src: p('gallery/star-nights-08.webp'), cat: 'Pro Nights', caption: "The crowd holds its breath", wide: true },
  { src: p('gallery/star-nights-09.webp'), cat: 'Pro Nights', caption: "Silhouettes against the rig", wide: true },
  { src: p('gallery/star-nights-10.webp'), cat: 'Pro Nights', caption: "The island keeps its promise" },
  { src: p('gallery/star-nights-11.webp'), cat: 'Pro Nights', caption: "Closing night" },
  { src: p('gallery/music-01.webp'), cat: 'Music', caption: "Sinfonia, the mic finds its voice" },
  { src: p('gallery/music-02.webp'), cat: 'Music', caption: "Battle of Bands, lead guitar" },
  { src: p('gallery/music-03.webp'), cat: 'Music', caption: "A full-throated chorus", wide: true },
  { src: p('gallery/music-04.webp'), cat: 'Music', caption: "Euphonia, the seated ensemble", wide: true },
  { src: p('gallery/music-05.webp'), cat: 'Music', caption: "Crimson wash, open throat" },
  { src: p('gallery/music-06.webp'), cat: 'Music', caption: "Tarang, a classical swell" },
  { src: p('gallery/music-07.webp'), cat: 'Music', caption: "Strings under a teal sky" },
  { src: p('gallery/music-08.webp'), cat: 'Music', caption: "The rhythm section", wide: true },
  { src: p('gallery/music-09.webp'), cat: 'Music', caption: "Rhythm Revolution, the rap battle", wide: true },
  { src: p('gallery/music-10.webp'), cat: 'Music', caption: "Hands on the keys" },
  { src: p('gallery/music-11.webp'), cat: 'Music', caption: "Backing vocals" },
  { src: p('gallery/music-12.webp'), cat: 'Music', caption: "The last note" },
  { src: p('gallery/music-13.webp'), cat: 'Music', caption: "Metallica, western vocals" },
  { src: p('gallery/music-14.webp'), cat: 'Music', caption: "The band takes the stage" },
  { src: p('gallery/dance-01.webp'), cat: 'Dance', caption: "Nritya Sangam, folk formation", wide: true },
  { src: p('gallery/dance-02.webp'), cat: 'Dance', caption: "Adaptune, mid-flight", wide: true },
  { src: p('gallery/dance-03.webp'), cat: 'Dance', caption: "Street Blaze, a frozen pose", wide: true },
  { src: p('gallery/dance-04.webp'), cat: 'Dance', caption: "Floorwork under the spotlight", wide: true },
  { src: p('gallery/dance-05.webp'), cat: 'Dance', caption: "Expression in motion", tall: true },
  { src: p('gallery/dance-06.webp'), cat: 'Dance', caption: "Ballismus, the ensemble finale" },
  { src: p('gallery/dance-07.webp'), cat: 'Dance', caption: "The line holds" },
  { src: p('gallery/dance-08.webp'), cat: 'Dance', caption: "A lift, caught", tall: true },
  { src: p('gallery/dance-09.webp'), cat: 'Dance', caption: "Classical hands" },
  { src: p('gallery/dance-10.webp'), cat: 'Dance', caption: "The crew moves as one" },
  { src: p('gallery/dance-11.webp'), cat: 'Dance', caption: "Colour and momentum" },
  { src: p('gallery/dance-12.webp'), cat: 'Dance', caption: "The drop" },
  { src: p('gallery/dance-13.webp'), cat: 'Dance', caption: "Formation change" },
  { src: p('gallery/dance-14.webp'), cat: 'Dance', caption: "Centre stage" },
  { src: p('gallery/dance-15.webp'), cat: 'Dance', caption: "The final pose" },
  { src: p('gallery/dance-16.webp'), cat: 'Dance', caption: "Curtain call", wide: true },
  { src: p('gallery/sports-01.webp'), cat: 'Sports', caption: "Velocity, cricket under the sun" },
  { src: p('gallery/sports-02.webp'), cat: 'Sports', caption: "Champions lifted high" },
  { src: p('gallery/sports-03.webp'), cat: 'Sports', caption: "Volleyball, the spike" },
  { src: p('gallery/sports-04.webp'), cat: 'Sports', caption: "Night volleyball" },
  { src: p('gallery/sports-05.webp'), cat: 'Sports', caption: "Football, the strike" },
  { src: p('gallery/sports-06.webp'), cat: 'Sports', caption: "Floodlit football", wide: true },
  { src: p('gallery/sports-07.webp'), cat: 'Sports', caption: "Basketball, rising to the rim", wide: true },
  { src: p('gallery/sports-08.webp'), cat: 'Sports', caption: "Kabaddi, the tackle" },
  { src: p('gallery/sports-09.webp'), cat: 'Sports', caption: "Table tennis, focus" },
  { src: p('gallery/sports-10.webp'), cat: 'Sports', caption: "Volleyball, the block", wide: true },
  { src: p('gallery/sports-11.webp'), cat: 'Sports', caption: "The sprint" },
  { src: p('gallery/sports-12.webp'), cat: 'Sports', caption: "Full time" },
  { src: p('gallery/sports-13.webp'), cat: 'Sports', caption: "The podium" },
  { src: p('gallery/cultural-01.webp'), cat: 'Cultural', caption: "Chronos, Mr. & Ms. PYREXIA" },
  { src: p('gallery/cultural-02.webp'), cat: 'Cultural', caption: "Crown Isle, the ramp walk", wide: true },
  { src: p('gallery/cultural-03.webp'), cat: 'Cultural', caption: "On stage, in character", wide: true },
  { src: p('gallery/cultural-04.webp'), cat: 'Cultural', caption: "Nukkad Natak on the quad" },
  { src: p('gallery/cultural-05.webp'), cat: 'Cultural', caption: "The monologue", wide: true },
  { src: p('gallery/cultural-06.webp'), cat: 'Cultural', caption: "The punchline lands", wide: true },
  { src: p('gallery/cultural-07.webp'), cat: 'Cultural', caption: "Costume and light", wide: true },
  { src: p('gallery/cultural-08.webp'), cat: 'Cultural', caption: "The ensemble scene", wide: true },
  { src: p('gallery/cultural-09.webp'), cat: 'Cultural', caption: "A held gesture" },
  { src: p('gallery/cultural-10.webp'), cat: 'Cultural', caption: "The bow" },
  { src: p('gallery/fine-arts-01.webp'), cat: 'Fine Arts', caption: "Fantasy Faces, face painting", wide: true },
  { src: p('gallery/fine-arts-02.webp'), cat: 'Fine Arts', caption: "Acrylic Odyssey in progress", wide: true },
  { src: p('gallery/fine-arts-03.webp'), cat: 'Fine Arts', caption: "Contrast Chronicles, graphite", wide: true },
  { src: p('gallery/fine-arts-04.webp'), cat: 'Fine Arts', caption: "Caffeine Creations" },
  { src: p('gallery/fine-arts-05.webp'), cat: 'Fine Arts', caption: "Mould It Up, clay" },
  { src: p('gallery/fine-arts-06.webp'), cat: 'Fine Arts', caption: "Splash Tees" },
  { src: p('gallery/fine-arts-07.webp'), cat: 'Fine Arts', caption: "Brushless Strokes" },
  { src: p('gallery/fine-arts-08.webp'), cat: 'Fine Arts', caption: "Cupful of Doodles" },
  { src: p('gallery/fine-arts-09.webp'), cat: 'Fine Arts', caption: "The finished piece" },
  { src: p('gallery/fine-arts-10.webp'), cat: 'Fine Arts', caption: "Colour on the table" },
  { src: p('gallery/fine-arts-11.webp'), cat: 'Fine Arts', caption: "Hands and pigment" },
  { src: p('gallery/fine-arts-12.webp'), cat: 'Fine Arts', caption: "The gallery wall" },
  { src: p('gallery/campus-01.webp'), cat: 'Campus', caption: "The PYREXIA gate" },
  { src: p('gallery/campus-02.webp'), cat: 'Campus', caption: "A tunnel of fairy lights", tall: true },
  { src: p('gallery/campus-03.webp'), cat: 'Campus', caption: "Themed decor across the quad" },
  { src: p('gallery/campus-04.webp'), cat: 'Campus', caption: "The campus green at dusk", wide: true },
  { src: p('gallery/campus-05.webp'), cat: 'Campus', caption: "Welcome to AIIMS Rishikesh", wide: true },
  { src: p('gallery/campus-06.webp'), cat: 'Campus', caption: "The institute at first light", wide: true },
]
