import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Hourglass } from 'lucide-react'
import { captainsLog } from '../data/schedule'
import { Reveal, SectionTitle } from './primitives'
import { SITE } from '../data/site'

const catColor: Record<string, string> = {
  'Star Night': '#e6c25e',
  Music: '#5aa9d0',
  Dance: '#d05a8a',
  Sports: '#4fae8b',
  Theatre: '#b06fd0',
  Literary: '#c98f5a',
  'Fine Arts': '#d98f6a',
  Informals: '#e07a5a',
  'E-Sports': '#6f7bd0',
  Cultural: '#e6c25e',
  Ceremony: '#e0894a',
  General: '#9fb0b3',
}

export default function CaptainsLog() {
  const [day, setDay] = useState(0)
  const reduce = useReducedMotion()
  const active = captainsLog[day]

  return (
    <section id="log" className="relative overflow-hidden py-14 sm:py-18 lg:py-24">
      <div className="rule-gold absolute inset-x-0 top-0" />
      <div className="mx-auto max-w-6xl px-6">
        <SectionTitle
          index="04"
          eyebrow="The Schedule"
          title="Captain's Log"
          kicker={`Five days on the island. The hour-by-hour log for ${SITE.window} is still being charted — check back closer to the fest.`}
        />

        {/* day tabs */}
        <Reveal>
          <div className="-mx-6 flex flex-nowrap gap-2 overflow-x-auto px-6 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
            {captainsLog.map((d, i) => (
              <button
                key={d.day}
                onClick={() => setDay(i)}
                data-cursor="LOG"
                className={`font-accent shrink-0 whitespace-nowrap rounded-full px-5 py-2.5 text-[0.82rem] uppercase tracking-wide2 transition-all duration-300 ${
                  i === day
                    ? 'bg-gradient-to-b from-gold-bright to-gold-deep text-abyss'
                    : 'text-parchment/70 ring-1 ring-gold/20 hover:ring-gold/50'
                }`}
              >
                {d.day}
              </button>
            ))}
          </div>
        </Reveal>

        <div className="mt-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={active.day}
              initial={reduce ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -12 }}
              transition={{ duration: 0.4 }}
            >
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
                <h3 className="font-display text-3xl text-foil">{active.title}</h3>
                <span className="font-display text-[0.7rem] uppercase tracking-wide2 text-parchment/65">
                  {active.subtitle}
                </span>
              </div>

              {/* timeline, or a coming-soon note while the log isn't finalized */}
              {active.entries.length > 0 ? (
                <div className="mt-8 border-l border-gold/20 pl-0">
                  {active.entries.map((e, i) => {
                    const col = catColor[e.cat] ?? '#c89b3c'
                    return (
                      <motion.div
                        key={e.title}
                        initial={reduce ? false : { opacity: 0, x: -14 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.06 * i, duration: 0.5 }}
                        className="group relative flex gap-5 pb-7 pl-6 last:pb-0"
                      >
                        {/* node */}
                        <span
                          className="absolute -left-[6.5px] top-1.5 h-3 w-3 rounded-full border-2 border-ocean"
                          style={{ background: col }}
                        />
                        <span className="w-14 shrink-0 pt-0.5 font-body text-sm text-gold-bright">{e.time}</span>
                        <div className="flex-1 border-b border-gold/8 pb-4 group-last:border-0">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <h4 className="font-body text-[1.02rem] text-offwhite">{e.title}</h4>
                            <span
                              className="rounded-full px-2.5 py-0.5 font-display text-[0.7rem] uppercase tracking-wide2"
                              style={{ background: `${col}1c`, color: col }}
                            >
                              {e.cat}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[0.8rem] text-parchment/55">{e.venue}</p>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              ) : (
                <div className="glass mt-8 flex flex-col items-center gap-3 rounded-xl px-6 py-14 text-center">
                  <Hourglass size={22} className="text-gold/60" />
                  <p className="font-display text-2xl text-offwhite">Coming Soon</p>
                  <p className="max-w-sm text-[0.85rem] leading-relaxed text-parchment/60">
                    The crew is still charting {active.title}'s hour-by-hour log. It'll drop here
                    closer to {SITE.window}.
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
