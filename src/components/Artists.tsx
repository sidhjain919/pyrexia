import { pastLegends, mysterySlots } from '../data/artists'
import { Reveal, SectionTitle } from './primitives'
import { Star, Lock } from 'lucide-react'
import { asset } from '../lib/asset'

export default function Artists() {
  return (
    <section id="artists" className="relative overflow-hidden py-14 sm:py-18 lg:py-24">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(70% 50% at 50% 0%, rgba(230,194,94,0.08), transparent 60%)' }}
      />
      <div className="relative mx-auto max-w-6xl px-6">
        <SectionTitle
          index="05"
          eyebrow="The Crew · Legends"
          title="Starlight Summit"
          meaning="Lineup"
          kicker="The peak of every voyage. A glimpse of the legends who have lit the PYREXIA sky — and the names still charted in secret."
        />

        {/* 2026 mystery slots */}
        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          {mysterySlots.map((m, i) => (
            <Reveal key={m.label} delay={i * 0.08}>
              <div className="glass group relative flex h-44 flex-col items-center justify-center overflow-hidden rounded-xl text-center">
                <div className="absolute inset-0 map-grid opacity-30" />
                <Lock size={20} className="text-gold/60 transition-transform group-hover:-translate-y-1" />
                <div className="mt-3 font-display text-xl text-offwhite">{m.label}</div>
                <div className="mt-1 max-w-[80%] font-log text-[0.6rem] uppercase tracking-wide2 text-parchment/65">
                  {m.hint}
                </div>
                <div className="mt-3 rounded-full bg-gold/10 px-3 py-1 font-log text-[0.7rem] uppercase tracking-cinema text-gold-bright">
                  2026 · Reveal soon
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* past legends */}
        <Reveal>
          <div className="mt-16 flex items-center gap-3 font-log text-[0.62rem] uppercase tracking-cinema text-gold/70">
            <Star size={12} />
            A glimpse of past voyages · Auriga lineups
          </div>
        </Reveal>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {pastLegends.map((a, i) => (
            <Reveal key={a.name} delay={i * 0.05}>
              <div className="group relative aspect-[3/4] overflow-hidden rounded-lg border border-gold/15">
                {/* star-night frame */}
                <img
                  src={asset(a.photo)}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover object-[50%_32%] transition-transform duration-700 group-hover:scale-110"
                />
                <div
                  className="absolute inset-0"
                  style={{ background: `linear-gradient(to top, #030b0f 8%, rgba(3,11,15,0.35) 45%, ${a.accent}22 100%)` }}
                />
                {/* grain + gold outline on hover */}
                <div className="grain absolute inset-0" />
                <div className="absolute inset-0 ring-1 ring-inset ring-transparent transition-all duration-500 group-hover:ring-gold/50" />
                {/* monogram seal */}
                <span
                  className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full font-deco text-[0.62rem] backdrop-blur"
                  style={{ background: `${a.accent}2e`, border: `1px solid ${a.accent}66`, color: '#f4efe3' }}
                >
                  {a.mono}
                </span>
                {/* info */}
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <div className="font-display text-sm leading-tight text-offwhite">{a.name}</div>
                  <div className="mt-0.5 font-log text-[0.7rem] uppercase tracking-wide2 text-parchment/70">
                    {a.role} · {a.year}
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
