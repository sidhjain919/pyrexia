import { useMemo } from 'react'

/**
 * Layered, GPU-friendly ocean/island/ship scene rendered as SVG + CSS.
 * Each layer carries a `data-depth` used by the Hero parallax loop.
 */
export default function OceanScene() {
  const stars = useMemo(
    () =>
      Array.from({ length: 70 }).map(() => ({
        x: Math.random() * 100,
        y: Math.random() * 58,
        r: Math.random() * 1.3 + 0.3,
        d: Math.random() * 4,
        o: Math.random() * 0.6 + 0.3,
      })),
    [],
  )

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Sky gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, #030b0f 0%, #071820 38%, #0a2530 60%, #061821 78%, #04141b 100%)',
        }}
      />

      {/*
        Moon. On mobile it sits top-right, high above the eyebrow (vertical
        clearance). On desktop it moves to the upper-left margin — the centered
        title never reaches that band at any viewport height, so no overlap.
      */}
      <div
        data-depth="6"
        className="parallax-layer absolute left-[58%] top-[0%] h-28 w-28 rounded-full sm:left-[2%] sm:top-[11%] sm:h-44 sm:w-44"
        style={{
          background: 'radial-gradient(circle, rgba(230,213,174,0.75) 0%, rgba(230,213,174,0.14) 34%, transparent 60%)',
        }}
      />
      <div
        data-depth="6"
        className="parallax-layer absolute left-[64%] top-[3%] h-11 w-11 rounded-full sm:left-[6%] sm:top-[14%] sm:h-14 sm:w-14"
        style={{ background: 'radial-gradient(circle, #f4efe3 0%, #d9c79a 70%, #b89f6a 100%)', boxShadow: '0 0 46px 10px rgba(232,213,174,0.3)' }}
      />

      {/* Stars */}
      <svg data-depth="4" className="parallax-layer absolute inset-0 h-full w-full">
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

      {/* Distant island silhouette */}
      <svg
        data-depth="10"
        className="parallax-layer absolute bottom-[26%] left-0 h-[42%] w-full"
        viewBox="0 0 1440 420"
        preserveAspectRatio="xMidYMax meet"
      >
        <path
          d="M0 420 L0 300 C120 270 210 250 320 258 C360 210 420 168 470 176 C520 130 560 120 600 168 C660 150 700 210 760 250 C880 235 980 265 1100 250 C1220 240 1330 268 1440 290 L1440 420 Z"
          fill="#04151c"
          opacity="0.9"
        />
        {/* palm hint */}
        <g stroke="#02100f" strokeWidth="4" fill="none" opacity="0.85">
          <path d="M596 170 C594 150 590 130 588 116" />
          <path d="M588 116 C572 108 556 112 546 122" />
          <path d="M588 116 C604 106 622 110 632 122" />
          <path d="M588 116 C580 100 578 92 584 82" />
        </g>
      </svg>

      {/* Fog band behind ship */}
      <div
        data-depth="8"
        className="parallax-layer absolute bottom-[30%] left-0 h-40 w-full"
        style={{ background: 'linear-gradient(180deg, transparent, rgba(23,74,82,0.28) 45%, transparent)' }}
      />

      {/* Ship silhouette */}
      <div data-depth="16" className="parallax-layer absolute bottom-[30%] left-[14%] w-40 sm:w-52">
        <div className="anim-sway">
          <svg viewBox="0 0 260 220" className="w-full drop-shadow-[0_10px_20px_rgba(0,0,0,0.6)]">
            <g fill="#020c10">
              {/* hull */}
              <path d="M40 168 C70 200 190 200 220 168 L206 150 L54 150 Z" />
              {/* masts */}
              <rect x="86" y="40" width="4" height="112" />
              <rect x="128" y="24" width="4" height="128" />
              <rect x="170" y="46" width="4" height="106" />
              {/* sails */}
              <path d="M90 52 C120 60 120 120 90 132 Z" opacity="0.96" />
              <path d="M126 36 C160 46 160 122 126 138 Z" opacity="0.96" />
              <path d="M172 58 C198 66 198 122 172 134 Z" opacity="0.96" />
              {/* flag */}
              <path d="M130 24 L154 30 L130 36 Z" fill="#7a2318" />
            </g>
          </svg>
        </div>
      </div>

      {/* Ocean */}
      <div className="absolute bottom-0 left-0 h-[34%] w-full overflow-hidden">
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, #06222b 0%, #051820 55%, #030f14 100%)' }}
        />
        {/* moon reflection — soft radial, no hard edges */}
        <div
          className="absolute bottom-0 left-[16%] h-full w-72 -translate-x-1/2"
          style={{
            background:
              'radial-gradient(60% 100% at 50% 0%, rgba(230,213,174,0.22), rgba(230,213,174,0.06) 45%, transparent 75%)',
            filter: 'blur(10px)',
          }}
        />
        {/* drifting wave rows */}
        {[0, 1, 2].map((row) => (
          <svg
            key={row}
            className="absolute left-0 w-[200%]"
            style={{
              bottom: `${row * 16}px`,
              height: '60px',
              animation: `drift ${18 + row * 8}s linear infinite`,
              opacity: 0.5 - row * 0.12,
            }}
            viewBox="0 0 1440 60"
            preserveAspectRatio="none"
          >
            <path
              d="M0 30 Q90 10 180 30 T360 30 T540 30 T720 30 T900 30 T1080 30 T1260 30 T1440 30 V60 H0 Z"
              fill="none"
              stroke="#2b7d84"
              strokeWidth="1.5"
            />
          </svg>
        ))}
      </div>
    </div>
  )
}
