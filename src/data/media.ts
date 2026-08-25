/**
 * Central media map — links real PYREXIA photos (public/photos) to territories
 * and sections so imagery can be swapped in one place.
 */

import { asset } from '../lib/asset'

const p = (n: number) => asset(`photos/p${String(n).padStart(2, '0')}.jpg`)

/** Representative photo per territory / vertical. */
export const territoryPhoto: Record<string, string> = {
  fahrenheit: p(22), // opening · fireworks
  chorea: p(24), // dance
  sinfonia: p(27), // band
  thespians: p(26), // stage expression
  velocity: p(18), // volleyball spike
  chronos: p(12), // ramp walk
  littmania: p(16), // stage / storytelling
  kalakriti: p(32), // face painting
  alfresco: p(38), // themed decor
  thunderbolt: p(23), // stage lights
  auriga: p(25), // star night crowd
}

/**
 * object-position focal point per territory photo, so heads/subjects stay in
 * frame when the image is cropped into short banners and cards.
 */
export const territoryFocus: Record<string, string> = {
  fahrenheit: '50% 42%', // fireworks — wide
  chorea: '50% 22%', // dancer — head high
  sinfonia: '50% 24%', // guitarist standing
  thespians: '50% 30%',
  velocity: '50% 20%', // volleyball spike — players jumping
  chronos: '50% 18%', // ramp walk — full body
  littmania: '50% 26%',
  kalakriti: '50% 34%', // face-paint close-up
  alfresco: '50% 40%', // decor signage
  thunderbolt: '50% 42%', // stage lights
  auriga: '50% 40%', // crowd / stage
}

/** Cinematic section backdrops. */
export const sectionPhoto = {
  legend: [p(43), p(9), p(39), p(45)], // montage: gate, fire, dance, basketball
  cta: p(9), // fire fountains + crowd
  register: p(1), // concert
  eventsHero: p(22),
  scheduleHero: p(35), // fairy-light tunnel
  artistsHero: p(41), // blue-hour headline
} as const
