import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Phone, Ticket, ArrowRight } from 'lucide-react'
import { territories } from '../data/events'
import { territoryPhoto, territoryFocus } from '../data/media'
import { Icon } from '../lib/icons'
import { Reveal, SectionTitle } from './primitives'
import { Compass, Palm } from './art'
import { useRegistration } from '../registration/context'
import { useNavTo } from './routing'

export default function IslandMap({ preview = false }: { preview?: boolean }) {
  const reduce = useReducedMotion()
  const { openRegister } = useRegistration()
  const navTo = useNavTo()
  const [activeId, setActiveId] = useState('chorea')
  const active = territories.find((t) => t.id === activeId)!
  const route = territories.map((t) => `${t.map.x},${t.map.y}`).join(' ')

  return (
    <section id="island" className="relative overflow-hidden bg-sand py-16 sm:py-24">
      <div className="map-dots pointer-events-none absolute inset-0 opacity-50" />
      <div className="relative mx-auto max-w-6xl px-6">
        <SectionTitle index="02" eyebrow="Explore the Island" title="Eleven Territories" color="var(--color-sea-deep)"
          kicker="Every part of PYREXIA is a stretch of the lost island. Tap a marker to discover what waits there!" />

        <div className="mt-12 grid gap-8 lg:grid-cols-[1.25fr_0.75fr]">
          {/* MAP */}
          <Reveal>
            <div className="parchment sticker-lg relative aspect-[4/3] w-full overflow-hidden rounded-3xl sm:aspect-[16/11]">
              <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
                <path d="M50 8 C64 8 73 15 78 25 C90 29 93 43 89 54 C95 64 88 79 75 84 C69 93 55 95 47 90 C35 95 21 90 15 79 C5 73 8 59 12 51 C5 41 12 27 24 23 C30 13 40 8 50 8 Z"
                  fill="#7fd6a8" stroke="#2a2018" strokeWidth="0.8" strokeLinejoin="round" />
                <path d="M50 14 C60 14 70 20 74 30 C82 34 84 44 80 52 C86 60 80 72 70 76 C64 84 54 84 47 80 C37 84 27 80 23 71 C15 66 16 55 20 48 C15 40 20 30 30 28 C34 20 42 14 50 14 Z"
                  fill="#a7e7c0" stroke="none" opacity="0.6" />
                <motion.polyline points={route} fill="none" stroke="#b5361f" strokeWidth="0.6" strokeDasharray="1.5 1.8" strokeLinecap="round"
                  initial={reduce ? undefined : { pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 2.2, ease: 'easeInOut' }} />
              </svg>

              <div className="pointer-events-none absolute bottom-2 right-2 anim-wobble sm:bottom-3 sm:right-3"><Compass size={70} /></div>
              <div className="pointer-events-none absolute -bottom-1 left-1 anim-sway"><Palm size={64} /></div>
              <div className="pointer-events-none absolute left-4 top-3 font-hand text-lg text-red">The Lost Island · Chart VI</div>

              {territories.map((t) => {
                const on = t.id === activeId
                return (
                  <button key={t.id} onMouseEnter={() => !reduce && setActiveId(t.id)} onFocus={() => setActiveId(t.id)} onClick={() => setActiveId(t.id)}
                    data-cursor="OPEN" aria-label={`${t.code} — ${t.territory}`}
                    className="group absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${t.map.x}%`, top: `${t.map.y}%` }}>
                    <span className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: t.accent, opacity: on ? 0.35 : 0, animation: on && !reduce ? 'sunpulse 1.4s ease-in-out infinite' : 'none' }} />
                    <span className="relative flex items-center justify-center rounded-full border-[2.5px] border-ink transition-transform duration-200"
                      style={{ width: on ? 40 : 32, height: on ? 40 : 32, background: on ? t.accent : '#fdf3dc', boxShadow: on ? '3px 4px 0 #2a2018' : '2px 3px 0 #2a2018', transform: on ? 'translateY(-3px)' : 'none' }}>
                      <Icon name={t.icon} size={on ? 17 : 15} strokeWidth={2.5} style={{ color: on ? '#fdf3dc' : '#2a2018' }} />
                    </span>
                    <span className={`pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap font-hand text-base leading-none transition-opacity ${on ? 'opacity-100' : 'opacity-0 group-hover:opacity-80'}`} style={{ color: '#b5361f' }}>{t.territory}</span>
                  </button>
                )
              })}
            </div>
          </Reveal>

          {/* PANEL */}
          <div className="relative min-h-[420px]">
            <AnimatePresence mode="wait">
              <motion.div key={active.id} initial={reduce ? false : { opacity: 0, y: 20, rotate: -1 }} animate={{ opacity: 1, y: 0, rotate: 0 }} exit={reduce ? undefined : { opacity: 0, y: -14 }} transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                className="glass sticker-lg sticky top-24 overflow-hidden rounded-3xl bg-cream">
                <div className="relative h-40 overflow-hidden border-b-[3px] border-ink">
                  <img src={territoryPhoto[active.id]} alt={active.code} className="h-full w-full object-cover" style={{ objectPosition: territoryFocus[active.id] ?? '50% 28%' }} />
                  <span className="absolute bottom-2 left-3 font-hand text-xl" style={{ color: '#fff', textShadow: '1px 2px 3px rgba(0,0,0,.6)' }}>{active.territory}</span>
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-3">
                    <span className="sticker-sm flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: active.accent }}>
                      <Icon name={active.icon} size={22} strokeWidth={2.5} style={{ color: '#fff' }} />
                    </span>
                    <div>
                      <div className="font-hand text-lg text-red">{active.subtitle}</div>
                      <h3 className="font-display text-2xl leading-none text-sea-deep">{active.code}</h3>
                    </div>
                  </div>
                  <p className="mt-3 font-fun text-[0.98rem] leading-relaxed text-ink/75">{active.blurb}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {active.events.map((e) => (
                      <button key={e.name} onClick={() => openRegister(e.name)} data-cursor="JOIN" title={`Register for ${e.name}`}
                        className="sticker-sm rounded-full bg-cream-soft px-3 py-1 font-fun text-sm font-semibold text-ink transition-colors hover:bg-sun">{e.name}</button>
                    ))}
                  </div>

                  {active.contacts.length > 0 && (
                    <div className="mt-5">
                      <div className="font-hand text-lg text-ink/60">Territory Wardens</div>
                      <div className="mt-1.5 flex flex-col gap-1">
                        {active.contacts.slice(0, 3).map((c) => (
                          <a key={c.phone} href={`tel:${c.phone}`} data-cursor="CALL" className="flex items-center gap-2 font-fun text-[0.92rem] text-ink/75 transition-colors hover:text-coral">
                            <Phone size={13} strokeWidth={2.5} className="text-sea" />
                            <span className="font-semibold text-ink">{c.name}</span><span className="text-ink/50">· {c.phone}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <button onClick={() => openRegister(active.events.length === 1 ? active.events[0].name : undefined)} data-cursor="AHOY"
                    className="sticker sticker-press mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-coral py-3 font-display text-base text-cream">
                    <Ticket size={16} strokeWidth={2.5} /> Register for {active.code}
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {preview && (
          <Reveal>
            <div className="mt-12 flex justify-center">
              <button onClick={() => navTo('/events')} data-cursor="MORE" className="sticker sticker-press flex items-center gap-2 rounded-full bg-sun px-7 py-3 font-display text-base text-ink">
                See all 60+ events <ArrowRight size={18} strokeWidth={3} />
              </button>
            </div>
          </Reveal>
        )}
      </div>
    </section>
  )
}
