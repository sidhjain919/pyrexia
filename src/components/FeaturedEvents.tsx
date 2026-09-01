import { useRef } from 'react'
import { ArrowLeft, ArrowRight, Hourglass, Ticket } from 'lucide-react'
import { territories } from '../data/events'
import { isTerritoryOpen } from '../data/registration'
import { territoryPhoto, territoryFocus } from '../data/media'
import { photoFor } from '../data/photos'
import { TerritoryGlyph } from '../lib/art'
import { Reveal, SectionTitle } from './primitives'
import { useRegistration } from '../registration/context'
import { useNavTo } from './routing'

type Pick = { code: string; event: string }

const picks: Pick[] = [
  { code: 'sinfonia', event: 'Battle of Bands' },
  { code: 'chorea', event: 'Ballismus' },
  { code: 'velocity', event: 'Cricket' },
  { code: 'thespians', event: 'Nukkad Natak' },
  { code: 'chronos', event: 'Mr. & Ms. PYREXIA' },
  { code: 'thunderbolt', event: 'BGMI' },
  { code: 'alfresco', event: 'Squid Game' },
  { code: 'littmania', event: 'Biocrux Jr & Sr' },
  { code: 'kalakriti', event: 'Fantasy Faces' },
  { code: 'auriga', event: 'The Pro Nights' },
]

export default function FeaturedEvents() {
  const track = useRef<HTMLDivElement>(null)
  const { openRegister } = useRegistration()
  const navTo = useNavTo()
  const scrollBy = (dir: number) => {
    track.current?.scrollBy({ left: dir * 340, behavior: 'smooth' })
  }

  return (
    <section className="relative overflow-hidden py-14 sm:py-18 lg:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex items-end justify-between gap-6">
          <SectionTitle
            index="03"
            eyebrow="Treasure Cards"
            title="Marquee Events"
            kicker="Map fragments from across the island: a taste of what the crews will fight for."
          />
          <div className="hidden shrink-0 gap-2 sm:flex">
            <button
              onClick={() => scrollBy(-1)}
              aria-label="Scroll left"
              data-cursor="PREV"
              className="flex h-11 w-11 items-center justify-center rounded-full ring-1 ring-inset ring-gold/45 text-gold-bright transition-colors hover:bg-gold/10"
            >
              <ArrowLeft size={16} />
            </button>
            <button
              onClick={() => scrollBy(1)}
              aria-label="Scroll right"
              data-cursor="NEXT"
              className="flex h-11 w-11 items-center justify-center rounded-full ring-1 ring-inset ring-gold/45 text-gold-bright transition-colors hover:bg-gold/10"
            >
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <Reveal>
        <div
          ref={track}
          className="mt-12 flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-px-6 px-6 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {picks.map((p, i) => {
            const t = territories.find((x) => x.id === p.code)!
            const sub = t.events.find((e) => e.name === p.event)
            return (
              <article
                key={p.event}
                className="group relative flex w-[280px] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-gold/15 bg-navy/60 transition-all duration-500 hover:-translate-y-1.5 hover:border-gold/40"
                style={{ minHeight: 360 }}
              >
                {/* photo */}
                <div className="relative h-40 overflow-hidden">
                  <img
                    src={photoFor(p.event) ?? territoryPhoto[t.id]}
                    alt=""
                    loading="lazy"
                    style={{ objectPosition: photoFor(p.event) ? '50% 38%' : (territoryFocus[t.id] ?? '50% 28%') }}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/40 to-transparent" />
                  <span className="absolute left-4 top-3 font-log text-[0.6rem] uppercase tracking-cinema text-parchment/80">
                    No. {String(i + 1).padStart(2, '0')}
                  </span>
                  <TerritoryGlyph
                    id={t.id}
                    size={40}
                    className="absolute right-3 top-3 drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]"
                  />
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <div className="font-log text-[0.6rem] uppercase tracking-wide2" style={{ color: t.accent }}>
                    {t.code}
                  </div>
                  <h3 className="mt-2 font-display text-2xl leading-tight text-offwhite">{p.event}</h3>
                  <p className="mt-1.5 text-[0.82rem] text-parchment/60">{sub?.tag ?? t.subtitle}</p>

                  <div className="mt-auto flex items-center gap-2 pt-5">
                    <button
                      onClick={() => openRegister(p.event)}
                      data-cursor={isTerritoryOpen(t.id) ? 'REGISTER' : 'SOON'}
                      className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep py-2.5 text-[0.66rem] font-semibold uppercase tracking-wide2 text-abyss transition-transform hover:scale-[1.02]"
                    >
                      {isTerritoryOpen(t.id) ? (
                        <>
                          <Ticket size={13} /> Register
                        </>
                      ) : (
                        <>
                          <Hourglass size={13} /> Coming Soon
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => navTo('/#island')}
                      data-cursor="DISCOVER"
                      className="min-h-11 rounded-full px-4 py-2.5 font-log text-[0.6rem] uppercase tracking-wide2 text-parchment/60 ring-1 ring-inset ring-gold/35 hover:text-gold-bright hover:ring-gold/80"
                    >
                      Info
                    </button>
                  </div>
                </div>
              </article>
            )
          })}

          {/* end cap */}
          <button
            onClick={() => navTo('/#island')}
            data-cursor="ALL"
            className="flex w-[240px] shrink-0 snap-start flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gold/25 text-center text-gold/70 transition-colors hover:border-gold/50 hover:text-gold-bright"
          >
            <span className="font-display text-lg">All Territories</span>
            <span className="font-log text-[0.6rem] uppercase tracking-cinema">60+ events await</span>
            <ArrowRight size={18} />
          </button>
        </div>
      </Reveal>
    </section>
  )
}
