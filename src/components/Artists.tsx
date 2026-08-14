import { pastLegends, mysterySlots } from '../data/artists'
import { Reveal, SectionTitle } from './primitives'
import { Lock } from 'lucide-react'
import { asset } from '../lib/asset'
import { Sun } from './art'

export default function Artists() {
  return (
    <section id="artists" className="relative overflow-hidden py-16 sm:py-24" style={{ background: 'linear-gradient(180deg,#ffe6a8 0%, #ffc98c 55%, #ffb277 100%)' }}>
      <Sun size={120} className="absolute right-8 top-8 anim-sun opacity-90" />
      <div className="relative mx-auto max-w-6xl px-6">
        <SectionTitle index="05" eyebrow="The Crew · Legends" title="Starlight Summit" color="var(--color-red)"
          kicker="The legends who have lit the PYREXIA sky — and the names still charted in secret!" />

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {mysterySlots.map((m, i) => (
            <Reveal key={m.label} delay={i * 0.08}>
              <div className="sticker sticker-press group flex h-44 flex-col items-center justify-center rounded-3xl bg-grape text-center text-cream" style={{ rotate: `${i % 2 ? 1.5 : -1.5}deg` }}>
                <Lock size={22} strokeWidth={2.5} className="transition-transform group-hover:-translate-y-1" />
                <div className="mt-2 font-display text-xl">{m.label}</div>
                <div className="mt-1 max-w-[80%] font-hand text-lg text-cream/80">{m.hint}</div>
                <div className="sticker-sm mt-2 rounded-full bg-sun px-3 py-0.5 font-fun text-xs font-bold text-ink">2026 · Reveal soon</div>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <p className="mt-12 text-center font-hand text-3xl text-red">A glimpse of past voyages…</p>
        </Reveal>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {pastLegends.map((a, i) => (
            <Reveal key={a.name} delay={i * 0.05}>
              <div className="sticker sticker-press group relative aspect-[3/4] overflow-hidden rounded-2xl bg-cream" style={{ rotate: `${(i % 3) - 1}deg` }}>
                <img src={asset(a.photo)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover object-[50%_30%] transition-transform duration-500 group-hover:scale-110" />
                <div className="absolute inset-0" style={{ background: `linear-gradient(to top,#2a2018 6%, transparent 45%)` }} />
                <span className="absolute right-2 top-2 sticker-sm flex h-8 w-8 items-center justify-center rounded-full font-display text-xs text-ink" style={{ background: a.accent, color: '#fff' }}>{a.mono}</span>
                <div className="absolute inset-x-0 bottom-0 p-2.5">
                  <div className="font-display text-sm leading-tight text-cream">{a.name}</div>
                  <div className="font-hand text-base text-cream/80">{a.role} · {a.year}</div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
