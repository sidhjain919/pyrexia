import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { faqs, arswa } from '../data/crew'
import { Reveal, SectionTitle } from './primitives'

export default function Navigator() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section id="contact" className="relative overflow-hidden bg-cream py-16 sm:py-24">
      <div className="map-dots pointer-events-none absolute inset-0 opacity-50" />
      <div className="relative mx-auto max-w-6xl px-6">
        <SectionTitle index="07" eyebrow="The Navigator's Desk" title="Charts & Queries" color="var(--color-grape)"
          kicker="Everything a voyager needs before setting sail. Still lost? The crew below will guide you in." />

        <div className="mt-12 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
          <div>
            <p className="font-hand text-2xl text-red">Frequently charted questions</p>
            <div className="mt-4 space-y-3">
              {faqs.map((f, i) => {
                const isOpen = open === i
                return (
                  <Reveal as="div" key={f.q} delay={i * 0.04}>
                    <div className="sticker-sm overflow-hidden rounded-2xl bg-cream-soft">
                      <button onClick={() => setOpen(isOpen ? null : i)} data-cursor={isOpen ? 'CLOSE' : 'OPEN'} className="flex w-full items-center justify-between gap-4 p-4 text-left">
                        <span className="font-fun text-lg font-bold text-ink">{f.q}</span>
                        <span className="sticker-sm flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sun text-ink transition-transform duration-300" style={{ transform: isOpen ? 'rotate(45deg)' : 'none' }}><Plus size={16} strokeWidth={3} /></span>
                      </button>
                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                            <p className="px-4 pb-4 font-fun text-[1rem] leading-relaxed text-ink/75">{f.a}</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </Reveal>
                )
              })}
            </div>
          </div>

          <Reveal>
            <div className="sticker-lg rounded-3xl bg-sea p-7 text-cream">
              <p className="font-hand text-2xl text-sun">ARSWA · The Chief Coordinating Committee</p>
              <ul className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {arswa.map((o) => (
                  <li key={o.role} className="border-b-2 border-dashed border-cream/25 pb-2">
                    <div className="font-hand text-lg text-foam">{o.role}</div>
                    <div className="font-fun font-semibold text-cream">{o.name}</div>
                  </li>
                ))}
              </ul>
              <div className="sticker-sm mt-5 rounded-2xl bg-cream p-4 text-ink">
                <p className="font-fun text-[0.95rem] leading-relaxed text-ink/80">Registrations for delegate cards and every event happen on the official PYREXIA website. Reach the PR crew for any query — the island keeps its gates open!</p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
