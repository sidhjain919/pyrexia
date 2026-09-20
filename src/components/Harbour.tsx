import { BedDouble, Check } from 'lucide-react'

import { Reveal, SectionTitle } from './primitives'
import { useRegistration } from '../registration/context'
import { STAY_FACTS } from '../data/accommodation'

/**
 * Where to sleep.
 *
 * Two things this section deliberately does not have.
 *
 * It carries no prices. It printed both rate cards in full to begin with,
 * fourteen rows, which turned a landing page into a tariff board. Everything
 * to do with money lives inside the booking form now, where somebody has
 * already decided they want a bed. That makes the rate card inside that form
 * load-bearing for signed-out visitors: with no figure here and none before
 * sign-in, the cost would otherwise be undiscoverable. See `AccommodationForm`.
 *
 * It carries no photograph either, and that is an answer rather than a gap.
 * Nothing in the photo library shows a room. Every other candidate either
 * shows the campus, which would imply the stay is on it, or shows an
 * auditorium, which has nothing to do with sleeping. Where somebody is placed
 * is decided by the accommodation team between the campus and the partner
 * hotels, so this page promises a bed, a block and what is in the room, and
 * says nothing at all about where it is.
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
        {/* Left, like every other section on the page. This was the only one
            centred, which is what made it read as a different kind of thing
            from the eight around it. */}
        <SectionTitle
          index="08"
          eyebrow="Make port"
          title="The Harbour"
          meaning="Stay & accommodation"
          kicker="Five days is a long way from home. Book a bed for the fest here, and it will be waiting for you when you arrive."
        />

        <div className="mt-10 grid gap-x-10 gap-y-4 sm:mt-12 sm:grid-cols-2">
          {STAY_FACTS.map((fact, i) => (
            <Reveal key={fact} delay={0.04 * i}>
              <div className="flex h-full items-start gap-3 rounded-xl border border-gold/15 bg-ocean/30 p-4">
                <Check size={15} className="mt-0.5 shrink-0 text-gold-bright" />
                <span className="text-pretty text-[0.92rem] leading-relaxed text-parchment/80">
                  {fact}
                </span>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.18}>
          <div className="mt-8 flex flex-col gap-5 sm:mt-10 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xl text-pretty text-[0.88rem] leading-relaxed text-parchment/60">
              Slots are limited and go first come, first served. A refundable security deposit is
              collected in cash when you arrive, and the rates, house rules and what to bring are
              all on the booking form.
            </p>

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
