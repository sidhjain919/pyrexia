import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { captainsLog } from '../data/schedule'
import { Reveal, SectionTitle } from './primitives'
import { SITE } from '../data/site'
import { useNavTo } from './routing'

const catColor: Record<string, string> = {
  'Star Night': '#7c4a86', Music: '#3a86c9', Dance: '#d05a8a', Sports: '#2f9e6b',
  Theatre: '#b06fd0', Literary: '#c98f5a', 'Fine Arts': '#e07a5a', Informals: '#ff7d53',
  'E-Sports': '#5566cc', Cultural: '#e7a531', Ceremony: '#d6472f', General: '#5a8a8a',
}

export default function CaptainsLog({ preview = false }: { preview?: boolean }) {
  const [day, setDay] = useState(0)
  const reduce = useReducedMotion()
  const navTo = useNavTo()
  const active = captainsLog[day]

  return (
    <section id="log" className="relative overflow-hidden py-16 sm:py-24" style={{ background: 'linear-gradient(180deg,#d7f0f2 0%, #eef8ee 100%)' }}>
      <div className="map-dots pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative mx-auto max-w-6xl px-6">
        <SectionTitle index="04" eyebrow="The Schedule" title="Captain's Log" color="var(--color-sea-deep)"
          kicker={`Five days on the island, charted hour by hour — an indicative plan for ${SITE.window}.`} />

        <Reveal>
          <div className="mt-10 flex flex-wrap gap-2.5">
            {captainsLog.map((d, i) => (
              <button key={d.day} onClick={() => setDay(i)} data-cursor="DAY"
                className={`sticker-sm sticker-press rounded-full px-5 py-2 font-display text-sm ${i === day ? 'bg-coral text-cream' : 'bg-cream text-ink'}`}>{d.day}</button>
            ))}
          </div>
        </Reveal>

        <div className="mt-9">
          <AnimatePresence mode="wait">
            <motion.div key={active.day} initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -12 }} transition={{ duration: 0.35 }}>
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <h3 className="font-display text-3xl text-grape">{active.title}</h3>
                <span className="font-hand text-2xl text-ink/60">{active.subtitle}</span>
              </div>

              <div className="mt-7 space-y-3">
                {active.entries.map((e, i) => {
                  const col = catColor[e.cat] ?? '#e7a531'
                  return (
                    <motion.div key={e.title} initial={reduce ? false : { opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }}
                      className="sticker-sm flex items-center gap-4 rounded-2xl bg-cream p-3 sm:p-4">
                      <span className="sticker-sm flex h-14 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-sand font-display text-base text-ink">{e.time}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                          <h4 className="font-fun text-lg font-bold text-ink">{e.title}</h4>
                          <span className="rounded-full px-2.5 py-0.5 font-fun text-xs font-bold text-white" style={{ background: col }}>{e.cat}</span>
                        </div>
                        <p className="mt-0.5 font-hand text-lg text-ink/55">{e.venue}</p>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {preview && (
          <Reveal>
            <div className="mt-10">
              <button onClick={() => navTo('/schedule')} data-cursor="MORE" className="sticker sticker-press flex items-center gap-2 rounded-full bg-sun px-7 py-3 font-display text-base text-ink">
                See the full log <ArrowRight size={18} strokeWidth={3} />
              </button>
            </div>
          </Reveal>
        )}
      </div>
    </section>
  )
}
