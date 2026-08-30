/**
 * Central media map: which photograph stands for which territory, and which
 * ones back the big sections.
 *
 * Territory photos are chosen from that territory's own event photography, so
 * a card for Velocity is a real Velocity frame rather than a generic crowd
 * shot. Everything here resolves through `photos.ts`, which is generated from
 * the files in `public/photos`.
 */

import { asset } from '../lib/asset'
import { eventPhoto, sceneShots } from './photos'
import { gallery } from './gallery'

const p = (file: string) => asset(`photos/${file}`)

/** The first gallery shot in a category, for backdrops that want atmosphere. */
const fromGallery = (cat: string, n = 0) =>
  gallery.filter((s) => s.cat === cat)[n]?.src ?? sceneShots[0]

/** Representative photo per territory. */
export const territoryPhoto: Record<string, string> = {
  fahrenheit: sceneShots[2],
  chorea: eventPhoto['Street Blaze'],
  sinfonia: eventPhoto['Battle of Bands'],
  thespians: eventPhoto['Nukkad Natak'],
  velocity: eventPhoto['Basketball'],
  chronos: eventPhoto['Mr. & Ms. PYREXIA'],
  littmania: eventPhoto['Oratio'],
  kalakriti: eventPhoto['Fantasy Faces'],
  alfresco: eventPhoto['Evening Amore'],
  thunderbolt: eventPhoto['BGMI'],
  auriga: fromGallery('Pro Nights', 0),
}

/**
 * object-position focal point per territory photo, so heads and subjects stay
 * in frame when the image is cropped into short banners and cards.
 */
export const territoryFocus: Record<string, string> = {
  fahrenheit: '50% 45%',
  chorea: '50% 30%',
  sinfonia: '50% 30%',
  thespians: '50% 35%',
  velocity: '50% 35%',
  chronos: '50% 25%',
  littmania: '50% 35%',
  kalakriti: '50% 40%',
  alfresco: '50% 40%',
  thunderbolt: '50% 40%',
  auriga: '50% 45%',
}

/** Cinematic section backdrops. */
export const sectionPhoto = {
  legend: [
    fromGallery('Campus', 0),
    sceneShots[0],
    fromGallery('Dance', 0),
    fromGallery('Sports', 0),
  ],
  cta: sceneShots[1],
  register: fromGallery('Pro Nights', 1),
  eventsHero: sceneShots[2],
  scheduleHero: fromGallery('Campus', 1),
  artistsHero: fromGallery('Pro Nights', 2),
  watch: fromGallery('Pro Nights', 3),
} as const

export { p }
