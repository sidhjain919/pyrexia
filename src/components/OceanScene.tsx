import { useMemo } from 'react'

import { art } from '../lib/art'

/**
 * The hero's night sea.
 *
 * This used to be the whole scene drawn in SVG and CSS: a moon, a gradient sky,
 * a two-ridge island, a fog band, a ship and three rows of waves. One painted
 * plate has replaced all of it, and has each of those in it painted better than
 * they were being approximated.
 *
 * What is kept is only what a painting cannot do, which is move. Stars twinkle
 * over the sky and two rows of swell drift across the water. Everything else
 * that used to be drawn is gone rather than layered on top, because a drawn
 * moon beside a painted one reads as a mistake rather than as depth.
 *
 * The plate carries `data-depth` so the hero's parallax loop still drifts it
 * under the cursor.
 */
export default function OceanScene() {
  const stars = useMemo(
    () =>
      Array.from({ length: 44 }).map(() => ({
        x: Math.random() * 100,
        y: Math.random() * 42,
        r: Math.random() * 1.2 + 0.3,
        d: Math.random() * 4,
        o: Math.random() * 0.5 + 0.2,
      })),
    [],
  )

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* The ground under the plate. On a tall phone `cover` crops the painting
          hard, and this is what shows through at the edges. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, #030b0f 0%, #071820 38%, #0a2530 60%, #061821 78%, #04141b 100%)',
        }}
      />

      {/* The painting. Anchored low so the horizon and the ship survive the crop
          on a portrait screen; on a wide one it fills the frame centred. */}
      <img
        src={art.heroSea}
        /* The plate is 1642px wide. Full-bleed on a retina desktop that is a
           1.8x enlargement, which is what made the first thing anyone sees
           look soft. `@2x` is the same painting resampled and re-encoded at
           2880px; a phone never downloads it, because 51KB over 143KB matters
           far more there than the sharpness does at 390px wide. */
        srcSet={`${art.heroSea} 1642w, ${art.heroSea2x} 2880w`}
        sizes="100vw"
        alt=""
        aria-hidden
        data-depth="3"
        fetchPriority="high"
        decoding="async"
        /* 1.02 rather than 1.06: the parallax drifts this layer by about three
           pixels, so that is all the bleed it needs, and every percent of
           scale is another percent of enlargement on an already-stretched
           plate. */
        /*
         * The phone crop is art direction, not a default.
         *
         * The painting is 1.71:1 and a phone is 0.46:1, so `cover` shows about
         * a quarter of its width. Centred, that quarter is open water: the
         * island is off the left edge, and the ship and the moon — the two
         * things that say "pirates" — are both off the right. Anchoring at 81%
         * puts the ship mid-frame, the moon upper-right and the island's palms
         * at the left edge, which is the whole scene in a portrait window.
         *
         * The 7% drop is what stops the moon landing behind the Register
         * button: it is painted a ninth of the way down the plate, which on a
         * phone is exactly where the header sits. The strip it uncovers at the
         * top is the same near-black the plate's own sky starts at, and the
         * star layer runs over both.
         */
        className="parallax-layer absolute left-0 right-0 top-[7%] h-[107%] w-full scale-[1.02] object-cover object-[81%_50%] sm:top-0 sm:h-full sm:object-center"
      />

      {/* Twinkle. Sparse, and only across the upper sky where the plate is
          darkest, so it reads as the same sky rather than a second one. */}
      <svg data-depth="4" className="parallax-layer absolute inset-0 h-full w-full opacity-70">
        {stars.map((s, i) => (
          <circle
            key={i}
            cx={`${s.x}%`}
            cy={`${s.y}%`}
            r={s.r}
            fill="#f4efe3"
            opacity={s.o}
            style={{ animation: `twinkle ${3 + s.d}s ease-in-out ${s.d}s infinite` }}
          />
        ))}
      </svg>

      {/* Swell. Two rows rather than three, faint, drifting across the painted
          water so the sea is not a photograph of one. */}
      <div className="absolute bottom-0 left-0 h-[22%] w-full overflow-hidden sm:h-[26%]">
        {[0, 1].map((row) => (
          <svg
            key={row}
            className="absolute left-0 w-[200%]"
            style={{
              bottom: `${row * 18}px`,
              height: '60px',
              animation: `drift ${22 + row * 9}s linear infinite`,
              opacity: 0.22 - row * 0.07,
            }}
            viewBox="0 0 1440 60"
            preserveAspectRatio="none"
          >
            <path
              d="M0 30 Q90 10 180 30 T360 30 T540 30 T720 30 T900 30 T1080 30 T1260 30 T1440 30 V60 H0 Z"
              fill="none"
              stroke="#7fb6bd"
              strokeWidth="1.5"
            />
          </svg>
        ))}
      </div>
    </div>
  )
}
