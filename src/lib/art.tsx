import { asset } from './asset'

/**
 * The drawn artwork.
 *
 * Everything under `public/art` is hand-drawn in one style, so it is worth
 * naming in one place rather than sprinkling string paths through components.
 * Each of these replaces something that used to be a CSS gradient or a generic
 * UI icon, and looks like it belongs beside the chart.
 */
export const art = {
  parchment: asset('art/parchment.webp'),
  heroSea: asset('art/hero-sea.webp'),
  compass: asset('art/compass.webp'),
  rope: asset('art/rope.webp'),
  logbook: asset('art/logbook.webp'),
  noticeBoard: asset('art/notice-board.webp'),
  passCard: asset('art/pass-card.webp'),
  seal: asset('seal.webp'),
} as const

/** Territory ids that have a drawn glyph. Anything else falls back to a Lucide icon. */
const GLYPHS = new Set([
  'fahrenheit',
  'chorea',
  'sinfonia',
  'thespians',
  'velocity',
  'chronos',
  'littmania',
  'kalakriti',
  'alfresco',
  'thunderbolt',
  'auriga',
])

export const hasGlyph = (id: string) => GLYPHS.has(id)

/**
 * The inked emblem for a territory.
 *
 * These replaced Lucide icons in coloured chips. A line icon reads as a
 * control; beside a drawn chart it looked like the UI had leaked into the
 * artwork.
 */
export function TerritoryGlyph({
  id,
  size = 24,
  className = '',
}: {
  id: string
  size?: number
  className?: string
}) {
  return (
    <img
      src={asset(`art/territory/${id}.png`)}
      alt=""
      aria-hidden
      loading="lazy"
      decoding="async"
      width={size}
      height={size}
      className={`shrink-0 select-none object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  )
}
