import { Sun, Cloud, Palm, Ship, Parrot, Bird } from './art'

/**
 * Bright, sunny cartoon island scene behind the hero.
 * Each `.parallax-layer` carries a data-depth used by the Hero mouse parallax.
 */
export default function OceanScene() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Sky */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, #7fd3e0 0%, #bfe9ec 30%, #ffe6a8 60%, #ffc98c 78%, #ffb277 100%)',
        }}
      />

      {/* Sun */}
      <div data-depth="4" className="parallax-layer absolute right-[12%] top-[8%] sm:right-[16%]">
        <Sun size={140} className="anim-sun drop-ink" />
      </div>

      {/* Clouds */}
      <div data-depth="7" className="parallax-layer absolute left-[6%] top-[14%] opacity-95" style={{ animation: 'drift 60s linear infinite' }}>
        <Cloud size={190} className="drop-ink" />
      </div>
      <div data-depth="9" className="parallax-layer absolute left-[52%] top-[9%] opacity-90" style={{ animation: 'drift 90s linear infinite' }}>
        <Cloud size={130} className="drop-ink" />
      </div>

      {/* Birds */}
      <div data-depth="5" className="parallax-layer absolute left-[30%] top-[24%] anim-float text-ink">
        <Bird size={34} />
      </div>
      <div data-depth="5" className="parallax-layer absolute left-[38%] top-[20%] anim-bob">
        <Bird size={24} />
      </div>

      {/* Distant island */}
      <svg data-depth="11" className="parallax-layer absolute bottom-[24%] left-0 h-[34%] w-full" viewBox="0 0 1440 360" preserveAspectRatio="xMidYMax meet">
        <path d="M0 360 L0 250 C160 220 300 210 430 232 C520 150 620 150 690 232 C820 210 980 226 1120 220 C1260 214 1360 240 1440 250 L1440 360 Z" fill="#2f9e6b" stroke="#2a2018" strokeWidth="5" strokeLinejoin="round" />
        <path d="M0 360 L0 300 C240 280 520 292 760 300 C1000 308 1240 300 1440 296 L1440 360 Z" fill="#3fbf88" stroke="none" />
      </svg>
      <div data-depth="13" className="parallax-layer absolute bottom-[36%] left-[44%] hidden sm:block">
        <Palm size={120} className="anim-sway drop-ink" />
      </div>

      {/* Ship bobbing — hidden on mobile (the logo already has a ship; keeps text clear) */}
      <div data-depth="17" className="parallax-layer absolute bottom-[26%] left-[22%] hidden sm:block">
        <div className="anim-bob">
          <Ship size={190} className="drop-ink" />
        </div>
      </div>

      {/* Sea */}
      <div className="absolute bottom-0 left-0 h-[26%] w-full overflow-hidden" style={{ background: 'linear-gradient(180deg, #37c2a8 0%, #1e8f79 100%)' }}>
        {[0, 1, 2].map((row) => (
          <svg
            key={row}
            className="absolute left-0 w-[200%]"
            style={{ top: `${8 + row * 22}px`, height: '40px', animation: `drift ${20 + row * 9}s linear infinite`, opacity: 0.9 - row * 0.2 }}
            viewBox="0 0 1440 40"
            preserveAspectRatio="none"
          >
            <path d="M0 20 Q60 6 120 20 T240 20 T360 20 T480 20 T600 20 T720 20 T840 20 T960 20 T1080 20 T1200 20 T1320 20 T1440 20" fill="none" stroke="#d8f7ee" strokeWidth="3" />
          </svg>
        ))}
      </div>

      {/* Foreground palms framing — desktop only (they crowd content on mobile) */}
      <div data-depth="24" className="parallax-layer absolute -bottom-2 left-2 hidden sm:block">
        <Palm size={230} className="anim-sway drop-ink" />
      </div>
      <div data-depth="22" className="parallax-layer absolute -bottom-2 right-2 hidden sm:block">
        <Palm size={210} flip className="anim-sway drop-ink" />
      </div>
      <div data-depth="26" className="parallax-layer absolute bottom-[15%] right-[10%] anim-float sm:right-[16%]">
        <Parrot size={58} className="drop-ink" />
      </div>
    </div>
  )
}
