import { useEffect, useRef, useState } from 'react'
import {
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'framer-motion'
import { Phone, Ticket } from 'lucide-react'
import { territories } from '../data/events'
import { territoryPhoto, territoryFocus } from '../data/media'
import { TerritoryGlyph } from '../lib/art'
import { asset } from '../lib/asset'
import { Reveal, SectionTitle } from './primitives'
import { useRegistration } from '../registration/context'

/** The chart's own proportions: the frame matches them so the torn border is never cropped. */
const CHART = '1536 / 1024'
/** How long the ship takes to cross; the wake keeps pace with it. */
const SAIL = { type: 'spring', stiffness: 42, damping: 16, mass: 0.9 } as const
/** Keeps the drawn route readable instead of scribbling over the whole chart. */
const TRAIL_MAX = 7

export default function IslandMap() {
  const reduce = useReducedMotion()
  const { openRegister, openDelegate } = useRegistration()

  const [activeId, setActiveId] = useState('chorea')
  const [trail, setTrail] = useState<string[]>(['chorea'])
  const [visited, setVisited] = useState<string[]>(['chorea'])
  const [facingLeft, setFacingLeft] = useState(false)

  const byId = (id: string) => territories.find((t) => t.id === id)!
  const active = byId(activeId)

  /* The ship's live position. The wake binds to the same two values, so the
     dotted line is drawn *by* the ship rather than animated alongside it. */
  const rawX = useMotionValue(active.map.x)
  const rawY = useMotionValue(active.map.y)
  const shipX = useSpring(rawX, reduce ? { duration: 0 } : SAIL)
  const shipY = useSpring(rawY, reduce ? { duration: 0 } : SAIL)
  const shipLeft = useMotionTemplate`${shipX}%`
  const shipTop = useMotionTemplate`${shipY}%`

  const prevX = useRef(active.map.x)

  const sailTo = (id: string) => {
    if (id === activeId) return
    const to = byId(id)
    // A side-on galleon can't be rotated to a heading, so it turns about instead.
    setFacingLeft(to.map.x < prevX.current)
    prevX.current = to.map.x
    setActiveId(id)
    setTrail((t) => [...t, id].slice(-TRAIL_MAX))
    setVisited((v) => (v.includes(id) ? v : [...v, id]))
  }

  useEffect(() => {
    rawX.set(active.map.x)
    rawY.set(active.map.y)
  }, [active.map.x, active.map.y, rawX, rawY])

  // Segments already sailed, plus the one being drawn behind the ship right now.
  const sailed = trail.slice(0, -1).map((id, i) => ({ from: byId(id), to: byId(trail[i + 1]) }))
  const drawingFrom = trail.length > 1 ? byId(trail[trail.length - 2]) : null

  return (
    <section id="island" className="relative overflow-hidden py-14 sm:py-18 lg:py-24">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(80% 60% at 50% 40%, rgba(23,74,82,0.16), transparent 70%)' }}
      />
      <div className="relative mx-auto max-w-6xl px-6">
        <div className="relative">
          <SectionTitle
            index="02"
            eyebrow="Explore the Island"
            title="Eleven Territories"
            eyebrowFont="plain"
            kicker="Every vertical of PYREXIA is a stretch of the lost archipelago. Click an island and the ship sets a course. Its wake marks the way, and an X is left on every shore you've made landfall on."
          />
          {/* the captain keeps the empty half of the title row company */}
          <img
            src={asset('map/captain.webp')}
            alt=""
            aria-hidden
            className="pointer-events-none absolute -bottom-8 right-0 hidden h-64 w-auto lg:block xl:h-72"
            style={{
              maskImage: 'radial-gradient(70% 70% at 50% 45%, #000 52%, transparent 100%)',
              WebkitMaskImage: 'radial-gradient(70% 70% at 50% 45%, #000 52%, transparent 100%)',
            }}
          />
        </div>

        <div className="mt-12 grid items-start gap-8 lg:grid-cols-[1.25fr_0.75fr]">
          {/* ------------------------------- CHART ------------------------------- */}
          <Reveal>
            <div
              className="relative -mx-6 w-[calc(100%+3rem)] overflow-hidden shadow-cinema sm:mx-0 sm:w-full sm:rounded-lg"
              style={{ aspectRatio: CHART }}
            >
              <img
                src={asset('map/archipelago.webp')}
                alt="The Lost Archipelago: eleven islands, one per PYREXIA vertical"
                className="absolute inset-0 h-full w-full object-cover"
              />

              {/* route: the dotted wake between islands */}
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden
              >
                {sailed.map(({ from, to }, i) => (
                  <line
                    key={`${from.id}-${to.id}-${i}`}
                    x1={from.map.x}
                    y1={from.map.y}
                    x2={to.map.x}
                    y2={to.map.y}
                    stroke="#5c2b0e"
                    strokeWidth={2.5}
                    strokeDasharray="1 8"
                    strokeLinecap="round"
                    opacity={0.5}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {drawingFrom && (
                  <motion.line
                    x1={drawingFrom.map.x}
                    y1={drawingFrom.map.y}
                    x2={shipX}
                    y2={shipY}
                    stroke="#7a2318"
                    strokeWidth={2.5}
                    strokeDasharray="1 8"
                    strokeLinecap="round"
                    opacity={0.85}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </svg>

              {/* the ship */}
              <motion.div
                className="pointer-events-none absolute z-20"
                style={{
                  left: shipLeft,
                  top: shipTop,
                  width: 'clamp(56px, 12%, 150px)',
                  transform: 'translate(-50%, -104%)',
                }}
              >
                <motion.img
                  src={asset('map/ship.webp')}
                  alt=""
                  aria-hidden
                  className="w-full drop-shadow-[0_10px_18px_rgba(0,0,0,0.45)]"
                  animate={reduce ? undefined : { y: [-3, 3, -3], rotate: [-1.6, 1.6, -1.6] }}
                  transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ scaleX: facingLeft ? -1 : 1 }}
                />
              </motion.div>

              {/* markers: a chest where the ship is, an X on every shore already made */}
              {territories.map((t) => {
                const on = t.id === activeId
                const seen = visited.includes(t.id) && !on
                return (
                  <button
                    key={t.id}
                    onClick={() => sailTo(t.id)}
                    onFocus={() => sailTo(t.id)}
                    data-cursor="SAIL"
                    aria-label={`${t.code}: ${t.territory}`}
                    aria-current={on ? 'true' : undefined}
                    className="group absolute z-10 flex flex-col items-center p-2.5 sm:p-1"
                    style={{
                      left: `${t.map.x}%`,
                      top: `${t.map.y}%`,
                      transform: 'translate(-50%, -50%)',
                      width: on ? 'clamp(46px, 7%, 84px)' : seen ? 'clamp(40px, 5%, 58px)' : 'auto',
                    }}
                  >
                    {on ? (
                      <motion.img
                        src={asset('map/marker-chest.webp')}
                        alt=""
                        initial={reduce ? false : { scale: 0.2, opacity: 0, y: -14 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        transition={{ delay: 0.45, type: 'spring', stiffness: 260, damping: 16 }}
                        className="w-full drop-shadow-[0_6px_14px_rgba(0,0,0,0.6)]"
                      />
                    ) : seen ? (
                      <motion.img
                        src={asset('map/marker-x.webp')}
                        alt=""
                        initial={reduce ? false : { scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 0.88 }}
                        className="w-full transition-transform duration-300 group-hover:scale-110"
                      />
                    ) : (
                      /* An inked ring rather than a dark UI chip: on a drawn
                         chart a glassy button reads as a control pasted over
                         the artwork instead of part of it. */
                      <span
                        className="block h-3 w-3 rounded-full border-2 transition-transform duration-300 group-hover:scale-150 sm:h-3.5 sm:w-3.5"
                        style={{
                          borderColor: 'rgba(78,38,14,0.9)',
                          background: 'rgba(214,180,124,0.85)',
                          boxShadow: '0 1px 3px rgba(40,20,6,0.5)',
                        }}
                      />
                    )}

                    {/* No label here any more: the island names are lettered
                        onto the chart itself, which is where a cartographer
                        would put them. */}
                  </button>
                )
              })}


              </div>

              {/* The key, and the wardens. Both sit under the chart so the two
                  columns finish on roughly the same line: the panel opposite is
                  always taller than a fixed-ratio map, and the gap it left
                  underneath was the emptiest part of the page. */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 rounded-lg border border-gold/15 bg-navy/35 px-4 py-2.5 font-log text-[0.55rem] uppercase tracking-wide2 text-parchment/55 sm:text-[0.6rem]">
                <span className="flex items-center gap-1.5">
                  <img src={asset('map/marker-chest.webp')} alt="" className="h-4 w-auto" />
                  You are here
                </span>
                <span className="flex items-center gap-1.5">
                  <img src={asset('map/marker-x.webp')} alt="" className="h-3.5 w-auto opacity-80" />
                  Shore made
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full border-2"
                    style={{ borderColor: 'rgba(78,38,14,0.9)', background: 'rgba(214,180,124,0.85)' }}
                  />
                  Uncharted
                </span>
              </div>

              {active.contacts.length > 0 && (
                <div className="mt-4 rounded-lg border border-gold/15 bg-navy/35 px-5 py-4">
                  <div className="font-log text-[0.6rem] uppercase tracking-cinema text-gold/65">
                    {active.code} · Territory Wardens
                  </div>
                  <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                    {active.contacts.slice(0, 3).map((c) => (
                      <a
                        key={c.phone}
                        href={`tel:${c.phone}`}
                        data-cursor="CALL"
                        className="flex items-center gap-2 text-[0.8rem] text-parchment/70 transition-colors hover:text-gold-bright"
                      >
                        <Phone size={12} className="shrink-0 text-gold/60" />
                        <span className="truncate text-offwhite/90">{c.name}</span>
                        <span className="tabular-nums text-parchment/50">{c.phone}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
          </Reveal>

          {/* --------------------------- DETAIL PANEL --------------------------- */}
          <div className="relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={active.id}
                initial={reduce ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -12 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="glass sticky top-24 overflow-hidden rounded-xl"
              >
                {/* territory photo */}
                <div className="relative h-40 overflow-hidden">
                  <img
                    src={territoryPhoto[active.id]}
                    alt={active.code}
                    className="h-full w-full object-cover"
                    style={{ objectPosition: territoryFocus[active.id] ?? '50% 28%' }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0b1e26] via-[#0b1e26]/40 to-transparent" />
                </div>

                <div className="p-7 pt-5">
                  <div className="flex items-center gap-3">
                    <TerritoryGlyph id={active.id} size={48} />
                    <div>
                      <div className="font-log text-[0.72rem] uppercase tracking-cinema text-gold/70">
                        {active.territory}
                      </div>
                      <h3 className="font-display text-2xl leading-none text-offwhite">{active.code}</h3>
                    </div>
                  </div>

                  <p className="mt-4 text-[0.82rem] uppercase tracking-wide2 text-parchment/60">
                    {active.subtitle}
                  </p>
                  <p className="mt-3 text-[0.92rem] leading-relaxed text-parchment/75">{active.blurb}</p>

                  <div className="my-5 rule-gold" />

                  {active.noRegister ? (
                    <p className="rounded-lg bg-ocean/50 px-3 py-2.5 text-[0.78rem] text-parchment/60">
                      No registration needed. Every delegate is welcomed in.
                    </p>
                  ) : (
                    <div>
                      <div className="font-log text-[0.7rem] uppercase tracking-cinema text-gold/65">
                        Pick an event to enter
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {active.events.map((e) => (
                          <button
                            key={e.name}
                            onClick={() => openRegister(e.name)}
                            data-cursor="REGISTER"
                            className="rounded-full border border-gold/20 bg-ocean/50 px-3 py-1.5 text-[0.72rem] text-parchment/85 transition-colors hover:border-gold/60 hover:text-gold-bright"
                            title={`Register for ${e.name} · ${e.tag}`}
                          >
                            {e.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Every entry needs a pass first, so the primary CTA sells the pass;
                      the chips above take you into a specific event's form. */}
                  <button
                    onClick={openDelegate}
                    data-cursor="REGISTER"
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep py-3 text-[0.7rem] font-semibold uppercase tracking-wide2 text-abyss transition-transform hover:scale-[1.02]"
                  >
                    <Ticket size={14} />
                    Get your Festival Pass
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}
