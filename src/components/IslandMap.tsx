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
import { Icon } from '../lib/icons'
import { asset } from '../lib/asset'
import { Reveal, SectionTitle } from './primitives'
import { useRegistration } from '../registration/context'

/** The chart's own proportions — the frame matches them so the torn border is never cropped. */
const CHART = '1513 / 1039'
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
            kicker="Every vertical of PYREXIA is a stretch of the lost archipelago. Click an island and the ship sets a course — its wake marks the way, and an X is left on every shore you've made landfall on."
          />
          {/* the captain keeps the empty half of the title row company */}
          <img
            src={asset('map/captain.png')}
            alt=""
            aria-hidden
            className="pointer-events-none absolute -bottom-8 right-0 hidden h-64 w-auto lg:block xl:h-72"
            style={{
              maskImage: 'radial-gradient(70% 70% at 50% 45%, #000 52%, transparent 100%)',
              WebkitMaskImage: 'radial-gradient(70% 70% at 50% 45%, #000 52%, transparent 100%)',
            }}
          />
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[1.25fr_0.75fr]">
          {/* ------------------------------- CHART ------------------------------- */}
          <Reveal>
            <div
              className="relative w-full overflow-hidden rounded-lg shadow-cinema"
              style={{ aspectRatio: CHART }}
            >
              <img
                src={asset('map/archipelago.png')}
                alt="The Lost Archipelago — eleven islands, one per PYREXIA vertical"
                className="absolute inset-0 h-full w-full object-cover"
              />

              {/* route — the dotted wake between islands */}
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
                  src={asset('map/ship.png')}
                  alt=""
                  aria-hidden
                  className="w-full drop-shadow-[0_10px_18px_rgba(0,0,0,0.45)]"
                  animate={reduce ? undefined : { y: [-3, 3, -3], rotate: [-1.6, 1.6, -1.6] }}
                  transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ scaleX: facingLeft ? -1 : 1 }}
                />
              </motion.div>

              {/* markers — a chest where the ship is, an X on every shore already made */}
              {territories.map((t) => {
                const on = t.id === activeId
                const seen = visited.includes(t.id) && !on
                return (
                  <button
                    key={t.id}
                    onClick={() => sailTo(t.id)}
                    onFocus={() => sailTo(t.id)}
                    data-cursor="SAIL"
                    aria-label={`${t.code} — ${t.territory}`}
                    aria-current={on ? 'true' : undefined}
                    className="group absolute z-10"
                    style={{
                      left: `${t.map.x}%`,
                      top: `${t.map.y}%`,
                      transform: 'translate(-50%, -50%)',
                      width: on ? 'clamp(34px, 7%, 84px)' : seen ? 'clamp(24px, 5%, 58px)' : 'auto',
                    }}
                  >
                    {on ? (
                      <motion.img
                        src={asset('map/marker-chest.png')}
                        alt=""
                        initial={reduce ? false : { scale: 0.2, opacity: 0, y: -14 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        transition={{ delay: 0.45, type: 'spring', stiffness: 260, damping: 16 }}
                        className="w-full drop-shadow-[0_6px_14px_rgba(0,0,0,0.6)]"
                      />
                    ) : seen ? (
                      <motion.img
                        src={asset('map/marker-x.png')}
                        alt=""
                        initial={reduce ? false : { scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 0.88 }}
                        className="w-full transition-transform duration-300 group-hover:scale-110"
                      />
                    ) : (
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-full border transition-transform duration-300 group-hover:scale-125 sm:h-7 sm:w-7"
                        style={{
                          borderColor: 'rgba(200,155,60,0.75)',
                          background: 'rgba(22,13,6,0.82)',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.55)',
                        }}
                      >
                        <Icon name={t.icon} size={13} style={{ color: '#e6c25e' }} />
                      </span>
                    )}

                    <span
                      className={`pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-1 font-log text-[0.6rem] uppercase tracking-wide2 shadow-[0_4px_12px_rgba(0,0,0,0.55)] transition-opacity duration-300 sm:text-[0.68rem] ${
                        on ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus:opacity-100'
                      }`}
                      style={{ background: 'rgba(4,15,20,0.94)', border: `1px solid ${t.accent}88`, color: t.accent }}
                    >
                      {t.territory}
                    </span>
                  </button>
                )
              })}

              {/* chart cartouche, sitting on the torn margin */}
              <img
                src={asset('map/compass.png')}
                alt=""
                aria-hidden
                className="pointer-events-none absolute opacity-55"
                style={{
                  left: '36%',
                  top: '62%',
                  width: 'clamp(38px, 9%, 104px)',
                  transform: 'translate(-50%, -50%)',
                }}
              />
            </div>
          </Reveal>

          {/* --------------------------- DETAIL PANEL --------------------------- */}
          <div className="relative min-h-[420px]">
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
                    <span
                      className="flex h-11 w-11 items-center justify-center rounded-lg"
                      style={{ background: `${active.accent}22`, border: `1px solid ${active.accent}66` }}
                    >
                      <Icon name={active.icon} size={20} style={{ color: active.accent }} />
                    </span>
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
                      No registration needed — every delegate is welcomed in.
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
                            title={`Register for ${e.name} — ${e.tag}`}
                          >
                            {e.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {active.contacts.length > 0 && (
                    <div className="mt-6">
                      <div className="font-log text-[0.7rem] uppercase tracking-cinema text-gold/65">
                        Territory Wardens
                      </div>
                      <div className="mt-2 flex flex-col gap-1.5">
                        {active.contacts.slice(0, 3).map((c) => (
                          <a
                            key={c.phone}
                            href={`tel:${c.phone}`}
                            data-cursor="CALL"
                            className="flex items-center gap-2 text-[0.82rem] text-parchment/70 transition-colors hover:text-gold-bright"
                          >
                            <Phone size={12} className="text-gold/60" />
                            <span className="text-offwhite/90">{c.name}</span>
                            <span className="text-parchment/50">· {c.phone}</span>
                          </a>
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
                    Get your delegate pass
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
