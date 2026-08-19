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
        Moon. On mobile it is pinned into the very top-right corner, above the
        eyebrow's band — at its old centre-right position its glow washed out
        "AIIMS Rishikesh · presents". On desktop it moves to the upper-left
        margin, which the centred title never reaches at any viewport height.
      */}
      <div
        data-depth="6"
        className="parallax-layer absolute left-[48%] top-[-5%] h-28 w-28 rounded-full sm:left-[2%] sm:top-[11%] sm:h-44 sm:w-44"
        style={{
          background: 'radial-gradient(circle, rgba(230,213,174,0.75) 0%, rgba(230,213,174,0.14) 34%, transparent 60%)',
        }}
      />
      <div
        data-depth="6"
        className="parallax-layer absolute left-[56%] top-[0.8%] h-8 w-8 rounded-full sm:left-[6%] sm:top-[14%] sm:h-14 sm:w-14"
        style={{ background: 'radial-gradient(circle, #f4efe3 0%, #d9c79a 70%, #b89f6a 100%)', boxShadow: '0 0 34px 6px rgba(232,213,174,0.24)' }}
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

      {/*
        Distant island. `slice` makes the silhouette cover the full band at any
        width — with `meet` it shrank to a thin strip on mobile and left hard
        vertical walls where the artboard ended on desktop. Two ridges + a haze
        wash give it depth; the paths run past the viewBox edges so the coast
        never terminates in a straight cut.
      */}
      <div
        data-depth="10"
        className="parallax-layer absolute bottom-[27%] left-0 h-[36%] w-full sm:bottom-[26%] sm:h-[42%]"
        style={{
          maskImage: 'linear-gradient(90deg, transparent 0%, #000 14%, #000 86%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, #000 14%, #000 86%, transparent 100%)',
        }}
      >
        <svg className="h-full w-full" viewBox="0 0 1440 420" preserveAspectRatio="xMidYMax slice">
          <defs>
            <linearGradient id="ridgeBack" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0a2c37" />
              <stop offset="100%" stopColor="#062028" />
            </linearGradient>
            <linearGradient id="ridgeFront" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#05171f" />
              <stop offset="100%" stopColor="#020d12" />
            </linearGradient>
            <filter id="ridgeHaze" x="-10%" y="-30%" width="120%" height="180%">
              <feGaussianBlur stdDeviation="3.2" />
            </filter>
            <filter id="ridgeSoft" x="-10%" y="-30%" width="120%" height="180%">
              <feGaussianBlur stdDeviation="1.1" />
            </filter>
          </defs>

          {/* far ridge — hazier, sits behind */}
          <path
            filter="url(#ridgeHaze)"
            opacity="0.62"
            fill="url(#ridgeBack)"
            d="M-80 420 L-80 332 C90 324 200 308 300 294 C382 282 430 254 480 228 C520 208 560 216 596 238 C652 270 720 260 800 252 C900 242 1000 258 1092 242 C1162 230 1210 202 1264 178 C1292 166 1318 170 1340 190 C1382 228 1424 264 1520 288 L1520 420 Z"
          />

          {/* front ridge — the main island */}
          <path
            filter="url(#ridgeSoft)"
            opacity="0.96"
            fill="url(#ridgeFront)"
            d="M-80 420 L-80 318 C110 302 240 288 360 276 C420 270 452 252 486 216 C512 188 540 160 574 134 C590 122 606 120 622 132 C660 160 694 202 726 240 C748 264 780 274 820 278 C960 290 1100 276 1240 290 C1344 300 1424 310 1520 318 L1520 420 Z"
          />

          {/* palms on the summit */}
          <g stroke="#010a0e" strokeWidth="4" fill="none" opacity="0.8">
            <path d="M628 130 C626 110 622 90 620 76" />
            <path d="M620 76 C604 68 588 72 578 82" />
            <path d="M620 76 C636 66 654 70 664 82" />
            <path d="M620 76 C612 60 610 52 616 42" />
          </g>
        </svg>
      </div>

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
