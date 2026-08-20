import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Phone, Ticket } from 'lucide-react'
import { territories } from '../data/events'
import { territoryPhoto, territoryFocus } from '../data/media'
import { Icon } from '../lib/icons'
import { Reveal, SectionTitle, Compass } from './primitives'
import { useRegistration } from '../registration/context'

/** A smooth, gently irregular island coastline — deterministic per territory so it never reshuffles on re-render. */
function islandPath(cx: number, cy: number, r: number, seed: number) {
  const n = 9
  const pts: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const jitter = 1 + 0.16 * Math.sin(seed * 12.9898 + i * 4.73) * Math.cos(seed * 3.71 + i * 1.9)
    const rad = r * jitter
    pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad * 0.82])
  }
  let d = `M ${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)} `
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += `C ${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)} `
  }
  return d + 'Z'
}

export default function IslandMap() {
  const reduce = useReducedMotion()
  const { openRegister, openDelegate } = useRegistration()
  const [activeId, setActiveId] = useState('chorea')
  const active = territories.find((t) => t.id === activeId)!

  // route path through territories, in visiting order (visual only)
  const route = territories.map((t) => `${t.map.x},${t.map.y}`).join(' ')

  // ship heading: angle from wherever it last was, toward the newly active island
  const prevPos = useRef({ x: active.map.x, y: active.map.y })
  const dx = active.map.x - prevPos.current.x
  const dy = active.map.y - prevPos.current.y
  const heading = dx === 0 && dy === 0 ? 0 : (Math.atan2(dy, dx) * 180) / Math.PI
  useEffect(() => {
    prevPos.current = { x: active.map.x, y: active.map.y }
  }, [activeId, active.map.x, active.map.y])

  return (
    <section id="island" className="relative overflow-hidden py-14 sm:py-18 lg:py-24">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(80% 60% at 50% 40%, rgba(23,74,82,0.16), transparent 70%)' }}
      />
      <div className="relative mx-auto max-w-6xl px-6">
        <SectionTitle
          index="02"
          eyebrow="Explore the Island"
          title="Eleven Territories"
          eyebrowFont="plain"
          kicker="Every vertical of PYREXIA is a stretch of the lost archipelago. Chart a course, and your ship sails there — pick an island to see what waits ashore."
        />

        <div className="mt-14 grid gap-8 lg:grid-cols-[1.25fr_0.75fr]">
          {/* MAP */}
          <Reveal>
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl frame-gold bg-[#071b22] sm:aspect-[16/11]">
              {/* drifting water light, behind everything */}
              <motion.div
                aria-hidden
                className="pointer-events-none absolute -inset-x-1/4 -inset-y-1/4 opacity-40"
                style={{ background: 'radial-gradient(38% 30% at 30% 70%, rgba(47,165,143,0.22), transparent 60%), radial-gradient(30% 24% at 75% 30%, rgba(90,169,208,0.16), transparent 60%)' }}
                animate={reduce ? undefined : { x: ['0%', '3%', '0%'], y: ['0%', '-2%', '0%'] }}
                transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
              />
              <div className="map-grid pointer-events-none absolute inset-0 opacity-25" />

              <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
                <defs>
                  <radialGradient id="land" cx="38%" cy="30%" r="80%">
                    <stop offset="0%" stopColor="#2a6b4f" />
                    <stop offset="45%" stopColor="#163f30" />
                    <stop offset="100%" stopColor="#0a2620" />
                  </radialGradient>
                  <linearGradient id="hull" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e8d5ae" />
                    <stop offset="100%" stopColor="#9e7427" />
                  </linearGradient>
                  <filter id="islandShadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="0.5" stdDeviation="0.6" floodColor="#000" floodOpacity="0.45" />
                  </filter>
                </defs>

                {/* wave rings, static chart texture */}
                {[16, 26, 36, 46].map((r) => (
                  <ellipse key={r} cx="50" cy="50" rx={r} ry={r * 0.8} fill="none" stroke="#c89b3c" strokeWidth="0.12" opacity="0.12" />
                ))}

                {/* sailing route between islands */}
                <motion.polyline
                  points={route}
                  fill="none"
                  stroke="#c89b3c"
                  strokeWidth="0.35"
                  strokeDasharray="1 1.6"
                  opacity="0.5"
                  initial={reduce ? undefined : { pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 2.4, ease: 'easeInOut' }}
                />

                {/* the archipelago — one island per territory */}
                {territories.map((t, i) => {
                  const on = t.id === activeId
                  const rOuter = on ? 6.8 : 6.1
                  return (
                    <g key={t.id} opacity={on ? 1 : 0.8} filter="url(#islandShadow)" style={{ transition: 'opacity 0.4s' }}>
                      <path d={islandPath(t.map.x, t.map.y, rOuter, i + 1)} fill="url(#land)" />
                      {/* a slightly inset shoreline ring — reads as a coastline, not an outline */}
                      <path
                        d={islandPath(t.map.x, t.map.y, rOuter * 0.86, i + 1)}
                        fill="none"
                        stroke={on ? t.accent : '#3a8a7a'}
                        strokeWidth={on ? 0.32 : 0.16}
                        opacity={on ? 0.9 : 0.45}
                        style={{ transition: 'stroke 0.4s, opacity 0.4s' }}
                      />
                    </g>
                  )
                })}

                {/* arrival ripple — replays whenever the active island changes */}
                <motion.circle
                  key={activeId}
                  cx={active.map.x}
                  cy={active.map.y}
                  r={2}
                  fill="none"
                  stroke={active.accent}
                  strokeWidth={0.4}
                  initial={reduce ? { opacity: 0 } : { opacity: 0.8, r: 1 }}
                  animate={reduce ? { opacity: 0 } : { opacity: 0, r: 10 }}
                  transition={{ duration: 1.4, ease: 'easeOut' }}
                />

                {/* the ship — sails to whichever island is active */}
                <motion.g
                  animate={{ x: active.map.x, y: active.map.y, rotate: heading }}
                  transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 40, damping: 12, mass: 0.6 }}
                  style={{ originX: '0px', originY: '0px' }}
                >
                  <motion.g
                    animate={reduce ? undefined : { y: [-3.4, -3.0, -3.4], rotate: [-3, 3, -3] }}
                    transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    {/* hull */}
                    <path d="M -2.6,0 L 2.6,0 L 1.7,1.3 L -1.7,1.3 Z" fill="url(#hull)" stroke="#5a3e17" strokeWidth="0.15" />
                    {/* mast + sail */}
                    <path d="M 0,0 L 0,-3.6" stroke="#5a3e17" strokeWidth="0.18" />
                    <path d="M 0.1,-3.4 L 2.2,-1.4 L 0.1,-0.4 Z" fill="#e8d5ae" opacity="0.92" />
                    {/* tiny flag */}
                    <path d="M 0,-3.6 L 1.1,-3.3 L 0,-3.0 Z" fill="#b1341f" />
                  </motion.g>
                </motion.g>
              </svg>

              {/* compass rose */}
              <div className="pointer-events-none absolute bottom-3 right-3 opacity-45 sm:bottom-5 sm:right-5">
                <Compass size={78} />
              </div>
              <div className="pointer-events-none absolute left-4 top-3 font-body text-[0.72rem] italic tracking-wide text-gold/70">
                The Lost Archipelago · Chart No. VI
              </div>

              {/* markers, layered over their islands */}
              {territories.map((t) => {
                const on = t.id === activeId
                return (
                  <button
                    key={t.id}
                    onMouseEnter={() => !reduce && setActiveId(t.id)}
                    onFocus={() => setActiveId(t.id)}
                    onClick={() => setActiveId(t.id)}
                    data-cursor="OPEN"
                    aria-label={`${t.code} — ${t.territory}`}
                    className="group absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${t.map.x}%`, top: `${t.map.y}%` }}
                  >
                    <span
                      className="relative flex h-7 w-7 items-center justify-center rounded-full border transition-all duration-300"
                      style={{
                        borderColor: on ? t.accent : 'rgba(200,155,60,0.5)',
                        background: on ? t.accent : 'rgba(6,20,27,0.85)',
                        boxShadow: on ? `0 0 18px ${t.accent}` : 'none',
                        transform: on ? 'scale(1.15)' : 'scale(1)',
                      }}
                    >
                      <Icon name={t.icon} size={13} style={{ color: on ? '#04141b' : '#e6c25e' }} />
                    </span>
                    {on && (
                      <span
                        className="pointer-events-none absolute left-1/2 top-full mt-3 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-1 font-log text-[0.68rem] uppercase tracking-wide2 shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
                        style={{ background: 'rgba(4,15,20,0.92)', border: `1px solid ${t.accent}77`, color: t.accent }}
                      >
                        {t.territory}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </Reveal>

          {/* DETAIL PANEL */}
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
