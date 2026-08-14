/**
 * Memories from previous voyages.
 * Real PYREXIA photographs (AIIMS Rishikesh). Categories assigned by content.
 */

export type Shot = {
  src: string
  cat: GalleryCat
  caption: string
  /** rough aspect for masonry sizing */
  wide?: boolean
  tall?: boolean
}

export type GalleryCat =
  | 'Star Nights'
  | 'Music'
  | 'Dance'
  | 'Sports'
  | 'Cultural'
  | 'Fine Arts'
  | 'Campus'
  | 'Crew'

export const galleryCats: GalleryCat[] = [
  'Star Nights',
  'Music',
  'Dance',
  'Sports',
  'Cultural',
  'Fine Arts',
  'Campus',
  'Crew',
]

import { asset } from '../lib/asset'

const p = (n: number) => asset(`photos/p${String(n).padStart(2, '0')}.jpg`)

export const gallery: Shot[] = [
  { src: p(22), cat: 'Star Nights', caption: 'Auriga · fireworks over the main stage', wide: true },
  { src: p(9), cat: 'Star Nights', caption: 'Fire fountains & the crowd' },
  { src: p(1), cat: 'Star Nights', caption: 'Star Night · opening pyros' },
  { src: p(25), cat: 'Star Nights', caption: 'A sea of hands under red light', wide: true },
  { src: p(23), cat: 'Star Nights', caption: 'The summit lights up' },
  { src: p(41), cat: 'Star Nights', caption: 'Blue-hour headline set', tall: true },
  { src: p(7), cat: 'Star Nights', caption: 'Smoke, light and thousands' },
  { src: p(2), cat: 'Star Nights', caption: 'Silhouette on the console' },

  { src: p(15), cat: 'Music', caption: 'Sinfonia · the mic finds its voice', tall: true },
  { src: p(27), cat: 'Music', caption: 'Battle of Bands · lead guitar' },
  { src: p(28), cat: 'Music', caption: 'Confetti and a full-throated chorus' },
  { src: p(31), cat: 'Music', caption: 'Euphonia · the seated ensemble', wide: true },
  { src: p(33), cat: 'Music', caption: 'Crimson wash, open throat' },
  { src: p(36), cat: 'Music', caption: 'Tarang · a classical swell' },
  { src: p(40), cat: 'Music', caption: 'Strings under a teal sky' },
  { src: p(46), cat: 'Music', caption: 'Green-lit lead vocal' },
  { src: p(13), cat: 'Music', caption: 'Rhythm Revolution · the rap battle' },

  { src: p(39), cat: 'Dance', caption: 'Nritya Sangam · folk formation', wide: true },
  { src: p(24), cat: 'Dance', caption: 'Adaptune · mid-flight' },
  { src: p(30), cat: 'Dance', caption: 'Street Blaze · a frozen pose', tall: true },
  { src: p(20), cat: 'Dance', caption: 'Floorwork under the spotlight' },
  { src: p(26), cat: 'Dance', caption: 'Expression in motion' },
  { src: p(48), cat: 'Dance', caption: 'Ballismus · the ensemble finale', wide: true },

  { src: p(6), cat: 'Sports', caption: 'Velocity · cricket under the sun' },
  { src: p(5), cat: 'Sports', caption: 'Champions lifted high', wide: true },
  { src: p(18), cat: 'Sports', caption: 'Volleyball · the spike' },
  { src: p(3), cat: 'Sports', caption: 'Night volleyball' },
  { src: p(19), cat: 'Sports', caption: 'Football · the strike' },
  { src: p(17), cat: 'Sports', caption: 'Floodlit football' },
  { src: p(45), cat: 'Sports', caption: 'Basketball · rising to the rim', tall: true },
  { src: p(37), cat: 'Sports', caption: 'Kabaddi · the tackle' },
  { src: p(29), cat: 'Sports', caption: 'Table tennis · focus' },
  { src: p(34), cat: 'Sports', caption: 'Volleyball · the block' },

  { src: p(8), cat: 'Cultural', caption: 'Chronos · Mr. & Ms. PYREXIA', tall: true },
  { src: p(12), cat: 'Cultural', caption: 'Crown Isle · the ramp walk' },
  { src: p(16), cat: 'Cultural', caption: 'On stage, in character' },

  { src: p(32), cat: 'Fine Arts', caption: 'Fantasy Faces · face painting', tall: true },

  { src: p(43), cat: 'Campus', caption: 'PYREXIA · The Last Carnival gate', wide: true },
  { src: p(35), cat: 'Campus', caption: 'A tunnel of fairy lights' },
  { src: p(38), cat: 'Campus', caption: 'Themed decor · Spooky Street' },
  { src: p(42), cat: 'Campus', caption: 'Balloons over the campus green' },
  { src: p(47), cat: 'Campus', caption: 'Welcome to AIIMS Rishikesh', wide: true },
  { src: p(49), cat: 'Campus', caption: 'The institute at first light' },

  { src: p(14), cat: 'Crew', caption: 'Team PYREXIA · the crew' },
  { src: p(44), cat: 'Crew', caption: 'Backstage · building the stage' },
]
