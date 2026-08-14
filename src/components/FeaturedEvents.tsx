import { useRef } from 'react'
import { ArrowLeft, ArrowRight, Ticket } from 'lucide-react'
import { territories } from '../data/events'
import { territoryPhoto, territoryFocus } from '../data/media'
import { Icon } from '../lib/icons'
import { SectionTitle } from './primitives'
import { useRegistration } from '../registration/context'
import { useNavTo } from './routing'

const picks = [
  { code: 'fahrenheit', event: 'Fahrenheit' }, { code: 'sinfonia', event: 'Battle of Bands' },
  { code: 'chorea', event: 'Ballismus' }, { code: 'velocity', event: 'Cricket' },
  { code: 'thespians', event: 'Nukkad Natak' }, { code: 'chronos', event: 'Mr. & Ms. PYREXIA' },
  { code: 'thunderbolt', event: 'BGMI' }, { code: 'alfresco', event: 'Squid Game' },
  { code: 'littmania', event: 'Biocrux Jr & Sr' }, { code: 'kalakriti', event: 'Fantasy Faces' },
  { code: 'auriga', event: 'The Star Nights' },
]

export default function FeaturedEvents() {
  const track = useRef<HTMLDivElement>(null)
  const { openRegister } = useRegistration()
  const navTo = useNavTo()
  const scrollBy = (dir: number) => track.current?.scrollBy({ left: dir * 320, behavior: 'smooth' })

  return (
    <section className="relative overflow-hidden bg-cream py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex items-end justify-between gap-6">
          <SectionTitle index="03" eyebrow="Treasure Cards" title="Marquee Events" color="var(--color-grape)"
            kicker="A taste of what the crews will fight for across the island." />
          <div className="hidden shrink-0 gap-2 sm:flex">
            <button onClick={() => scrollBy(-1)} aria-label="Scroll left" data-cursor="PREV" className="sticker-sm flex h-12 w-12 items-center justify-center rounded-full bg-cream text-ink hover:bg-sun"><ArrowLeft size={18} strokeWidth={3} /></button>
            <button onClick={() => scrollBy(1)} aria-label="Scroll right" data-cursor="NEXT" className="sticker-sm flex h-12 w-12 items-center justify-center rounded-full bg-sun text-ink"><ArrowRight size={18} strokeWidth={3} /></button>
          </div>
        </div>
      </div>

      <div ref={track} className="mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-px-6 px-6 pb-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {picks.map((p, i) => {
          const t = territories.find((x) => x.id === p.code)!
          const sub = t.events.find((e) => e.name === p.event)
          return (
            <article key={p.event} className="sticker sticker-press group flex w-[270px] shrink-0 snap-start flex-col overflow-hidden rounded-3xl bg-cream" style={{ minHeight: 360 }}>
              <div className="relative h-40 overflow-hidden border-b-[3px] border-ink">
                <img src={territoryPhoto[t.id]} alt="" loading="lazy" style={{ objectPosition: territoryFocus[t.id] ?? '50% 28%' }} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                <span className="absolute left-3 top-3 sticker-sm rounded-full bg-cream px-3 py-0.5 font-display text-sm text-ink">#{String(i + 1).padStart(2, '0')}</span>
                <span className="absolute right-3 top-3 sticker-sm flex h-10 w-10 items-center justify-center rounded-full" style={{ background: t.accent }}><Icon name={t.icon} size={16} strokeWidth={2.5} style={{ color: '#fff' }} /></span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <div className="font-hand text-lg" style={{ color: t.accent }}>{t.code} · {t.territory}</div>
                <h3 className="mt-1 font-display text-2xl leading-tight text-ink">{p.event}</h3>
                <p className="mt-1 font-fun text-sm text-ink/60">{sub?.tag ?? t.subtitle}</p>
                <button onClick={() => openRegister(p.event)} data-cursor="JOIN" className="sticker-sm sticker-press mt-auto flex items-center justify-center gap-1.5 rounded-full bg-coral py-2.5 font-display text-sm text-cream">
                  <Ticket size={14} strokeWidth={2.5} /> Register
                </button>
              </div>
            </article>
          )
        })}
        <button onClick={() => navTo('/events')} data-cursor="MORE" className="flex w-[230px] shrink-0 snap-start flex-col items-center justify-center gap-3 rounded-3xl border-[3px] border-dashed border-ink/40 bg-cream-soft text-ink hover:border-ink">
          <span className="font-display text-2xl text-sea-deep">All Territories</span>
          <span className="font-hand text-xl text-ink/60">60+ events await!</span>
          <span className="sticker-sm flex h-11 w-11 items-center justify-center rounded-full bg-sun"><ArrowRight size={18} strokeWidth={3} /></span>
        </button>
      </div>
    </section>
  )
}
