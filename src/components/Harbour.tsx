import { BedDouble, FileText } from 'lucide-react'

import { Reveal, SectionTitle } from './primitives'
import { useRegistration } from '../registration/context'
import { STAY_DOCUMENTS, STAY_STEPS } from '../data/accommodation'
import { asset } from '../lib/asset'

/**
 * Where to sleep.
 *
 * Three things this section deliberately does not do.
 *
 * It quotes no prices. It printed both rate cards in full to begin with,
 * fourteen rows, which turned a landing page into a tariff board. Money lives
 * inside the booking form now, where somebody has already decided they want a
 * bed. That makes the rate card inside that form load-bearing for signed-out
 * visitors: with no figure here and none before sign-in, the cost would
 * otherwise be undiscoverable. See `AccommodationForm`.
 *
 * It says nothing about where the rooms are. Placement is the accommodation
 * team's to make between the campus and the partner hotels, and a delegate who
 * booked expecting one and was given the other would have been told something
 * untrue by this page.
 *
 * And it does not inventory the room. An earlier version listed the furniture,
 * which reads as a hostel brochure from 1994 and sells nothing. What is here
 * instead is the shape of the decision: what you choose, and what happens once
 * you have paid.
 */
export default function Harbour() {
  const { openAccommodation } = useRegistration()

  return (
    <section id="harbour" className="relative overflow-hidden py-14 sm:py-18 lg:py-24">
      <div className="map-grid pointer-events-none absolute inset-0 opacity-25" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(70% 60% at 20% 0%, rgba(200,155,60,0.09), transparent 62%)',
        }}
      />

      <div className="relative mx-auto max-w-6xl px-6">
        <SectionTitle
          index="08"
          eyebrow="Make port"
          title="The Harbour"
          meaning="Stay & accommodation"
          kicker="Five days is a long way from home. Book a bed for the fest here, and it will be waiting for you when you arrive."
        />

        {/* Three steps rather than a list of features. The rule trailing off to
            the right of each numeral carries the eye across the row, which is
            what makes it read as a sequence instead of three unrelated notes. */}
        <ol className="mt-11 grid gap-9 sm:mt-14 sm:grid-cols-3 sm:gap-8">
          {STAY_STEPS.map((step, i) => (
            <Reveal key={step.title} delay={0.06 * i} as="li">
              <div className="flex items-center gap-4">
                <span className="font-display text-[1.5rem] leading-none text-gold-bright">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="h-px flex-1 bg-gradient-to-r from-gold/45 to-transparent" />
              </div>
              <h3 className="mt-4 font-display text-[1.22rem] leading-snug text-offwhite">
                {step.title}
              </h3>
              <p className="mt-2 max-w-sm text-pretty text-[0.92rem] leading-relaxed text-parchment/70">
                {step.body}
              </p>
            </Reveal>
          ))}
        </ol>

        <Reveal delay={0.24}>
          <div className="mt-12 flex flex-col gap-6 border-t border-gold/15 pt-7 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <p className="text-pretty text-[0.86rem] leading-relaxed text-parchment/55">
                Slots are limited and go first come, first served. A refundable deposit is
                collected in cash on arrival.
              </p>

              {/* The accommodation team's own two documents, for anybody who
                  wants the full text rather than the summary above. */}
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                {STAY_DOCUMENTS.map((doc) => (
                  <a
                    key={doc.file}
                    href={asset(doc.file)}
                    target="_blank"
                    rel="noreferrer"
                    data-cursor="READ"
                    className="group inline-flex items-center gap-2 text-[0.82rem] text-parchment/70 transition-colors hover:text-gold-bright"
                  >
                    <FileText size={14} className="shrink-0 text-gold/60 transition-colors group-hover:text-gold-bright" />
                    <span className="underline decoration-gold/30 underline-offset-4 transition-colors group-hover:decoration-gold-bright">
                      {doc.label}
                    </span>
                    <span className="text-[0.76rem] text-parchment/40">PDF</span>
                  </a>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={openAccommodation}
              data-cursor="STAY"
              className="flex min-h-12 shrink-0 items-center justify-center gap-2.5 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep px-8 py-3.5 font-log text-[0.74rem] uppercase tracking-wide2 text-abyss transition-transform hover:scale-[1.02]"
            >
              <BedDouble size={16} />
              Book your stay
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
