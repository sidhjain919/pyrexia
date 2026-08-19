import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { faqs, arswa } from '../data/crew'
import { Reveal, SectionTitle } from './primitives'

export default function Navigator() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section id="contact" className="relative overflow-hidden py-14 sm:py-18 lg:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <SectionTitle
          index="08"
          eyebrow="The Navigator's Desk"
          title="Charts & Queries"
          meaning="Contact & FAQ"
          kicker="Everything a voyager needs before setting sail. Still lost? The crew below will guide you in."
        />

        <div className="mt-14 grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          {/* FAQ accordion */}
          <div>
            <div className="font-log text-[0.6rem] uppercase tracking-cinema text-gold/70">
              Frequently Charted Questions
            </div>
            <div className="mt-4 divide-y divide-gold/12">
              {faqs.map((f, i) => {
                const isOpen = open === i
                return (
                  <Reveal as="div" key={f.q} delay={i * 0.04}>
                    <button
                      onClick={() => setOpen(isOpen ? null : i)}
                      data-cursor={isOpen ? 'CLOSE' : 'OPEN'}
                      className="flex w-full items-center justify-between gap-4 py-5 text-left"
                    >
                      <span className="font-display text-lg text-offwhite">{f.q}</span>
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-1 ring-gold/30 text-gold-bright transition-transform duration-300"
                        style={{ transform: isOpen ? 'rotate(45deg)' : 'none' }}
                      >
                        <Plus size={14} />
                      </span>
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                          className="overflow-hidden"
                        >
                          <p className="pb-5 pr-10 text-[0.92rem] leading-relaxed text-parchment/70">
                            {f.a}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Reveal>
                )
              })}
            </div>
          </div>

          {/* ARSWA crew */}
          <Reveal>
            <div className="glass rounded-xl p-7">
              <div className="font-log text-[0.6rem] uppercase tracking-cinema text-gold/70">
                ARSWA · The Chief Coordinating Committee
              </div>
              <ul className="mt-5 grid gap-x-6 gap-y-3.5 sm:grid-cols-2">
                {arswa.map((o) => (
                  <li key={o.role} className="border-b border-gold/8 pb-2.5">
                    <div className="font-log text-[0.7rem] uppercase tracking-wide2 text-gold/70">
                      {o.role}
                    </div>
                    <div className="mt-0.5 text-[0.95rem] text-offwhite/90">{o.name}</div>
                  </li>
                ))}
              </ul>
              <div className="mt-6 rounded-lg bg-ocean/50 p-4">
                <p className="text-[0.85rem] leading-relaxed text-parchment/70">
                  Registrations for delegate cards and every event happen entirely on the official
                  PYREXIA website. Reach the PR crew for any query — the island keeps its gates open.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
