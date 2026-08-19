import { allies } from '../data/sponsors'
import { Reveal, SectionTitle } from './primitives'
import { useNavTo } from './routing'

function WaxSeal({ name, big = false }: { name: string; big?: boolean }) {
  const initials = name
    .split(' ')
    .filter((w) => !['Your', 'Here', 'By'].includes(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join('')

  return (
    <div className="group flex flex-col items-center gap-3">
      <div
        className={`relative flex items-center justify-center rounded-full transition-transform duration-500 group-hover:scale-105 ${
          big ? 'h-28 w-28' : 'h-20 w-20'
        }`}
        style={{
          background: 'radial-gradient(circle at 38% 32%, #9a2a1c, #641808 70%, #3d0f04)',
          boxShadow: 'inset 0 3px 8px rgba(255,255,255,0.15), inset 0 -6px 12px rgba(0,0,0,0.5), 0 12px 26px -12px rgba(0,0,0,0.8)',
        }}
      >
        {/* scalloped edge */}
        <span className="absolute inset-0 rounded-full border-2 border-dashed border-parchment/15" />
        <span
          className={`font-deco text-parchment/90 ${big ? 'text-2xl' : 'text-lg'}`}
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}
        >
          {initials || 'P'}
        </span>
      </div>
      <span className="text-center font-display text-[0.6rem] uppercase tracking-wide2 text-parchment/60">
        {name}
      </span>
    </div>
  )
}

export default function Sponsors() {
  const navTo = useNavTo()
  return (
    <section id="allies" className="relative overflow-hidden py-14 sm:py-18 lg:py-24">
      <div className="rule-gold absolute inset-x-0 top-0" />
      <div className="mx-auto max-w-6xl px-6">
        <SectionTitle
          index="07"
          eyebrow="The Trading Ports"
          title="Allies of the Voyage"
          meaning="Sponsors"
          align="center"
          kicker="No island is conquered alone. Our partners power the fever — the wind in our sails."
        />

        <div className="mt-16 space-y-14">
          {allies.map((tier, ti) => (
            <Reveal key={tier.tier} delay={ti * 0.05}>
              <div className="text-center">
                <div className="flex items-center justify-center gap-3">
                  <span className="h-px w-8 bg-gold/30" />
                  <span className="font-display text-lg text-foil">{tier.tier}</span>
                  <span className="h-px w-8 bg-gold/30" />
                </div>
                <p className="mt-1 font-display text-[0.6rem] uppercase tracking-cinema text-parchment/45">
                  {tier.role}
                </p>
                <div
                  className={
                    tier.seals.length > 2
                      ? 'mx-auto mt-8 grid max-w-xs grid-cols-2 justify-items-center gap-x-6 gap-y-9 sm:max-w-2xl sm:grid-cols-3'
                      : 'mt-8 flex flex-wrap items-start justify-center gap-x-12 gap-y-8'
                  }
                >
                  {tier.seals.map((s) => (
                    <WaxSeal key={s.name} name={s.name} big={ti === 0} />
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <div className="mt-16 flex flex-col items-center gap-4 rounded-2xl glass-parchment px-6 py-10 text-center">
            <p className="max-w-md text-parchment/70">
              Want your flag flying over the island? Become a PYREXIA&nbsp;2026 partner and reach
              thousands of voyagers from across India.
            </p>
            <button
              onClick={() => navTo('/#contact')}
              data-cursor="ALLY"
              className="rounded-full px-6 py-3 font-display text-[0.68rem] uppercase tracking-wide2 text-gold-bright ring-1 ring-inset ring-gold/40 transition-colors hover:bg-gold/10"
            >
              Become an Ally →
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
