import { BedDouble, Check } from 'lucide-react'

import { Reveal, SectionTitle } from './primitives'
import { useRegistration } from '../registration/context'
import { sectionPhoto } from '../data/media'
import { STAY_FACTS } from '../data/accommodation'

/**
 * Where to sleep.
 *
 * Carries no prices, by decision. The first version of this section printed
 * both rate cards in full, fourteen rows of them, which turned a landing page
 * into a tariff board. Everything to do with money now lives inside the
 * booking form, where somebody has already decided they want a bed.
 *
 * That makes one thing load-bearing elsewhere: the rate card has to be visible
 * inside that form to a signed-out visitor, not just to somebody who has
 * already made an account. With no figure on this page and none before
 * sign-in, the cost of a bed would otherwise be undiscoverable. See
 * `AccommodationForm`.
 */
export default function Harbour() {
  const { openAccommodation } = useRegistration()

  return (
    <section id="harbour" className="relative overflow-hidden py-14 sm:py-18 lg:py-24">
      <div className="map-grid pointer-events-none absolute inset-0 opacity-25" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(80% 60% at 50% 0%, rgba(200,155,60,0.09), transparent 62%)',
        }}
      />

      <div className="relative mx-auto max-w-5xl px-6">
        <SectionTitle
          index="08"
          eyebrow="Make port"
          title="The Harbour"
          meaning="Stay & accommodation"
          align="center"
          kicker="Five days is a long way from home. Rooms on the AIIMS Rishikesh campus and with our hospitality partners, booked and paid for here."
        />

        <div className="mt-10 grid items-center gap-8 sm:mt-12 lg:grid-cols-2 lg:gap-12">
          <Reveal>
            {/* The campus at night. The rooms themselves are not photographed
                and a stock hotel interior would be a lie, so this is the place
                rather than the bed. */}
            <div className="relative overflow-hidden rounded-xl border border-gold/20">
              <img
                src={sectionPhoto.harbour}
                alt="The AIIMS Rishikesh campus at night"
                loading="lazy"
                className="h-56 w-full object-cover sm:h-72 lg:h-80"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-abyss via-abyss/25 to-transparent" />
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <ul className="space-y-3.5">
              {STAY_FACTS.map((fact) => (
                <li key={fact} className="flex items-start gap-3">
                  <Check size={15} className="mt-1 shrink-0 text-gold-bright" />
                  <span className="text-balance text-[0.94rem] leading-relaxed text-parchment/80">{fact}</span>
                </li>
              ))}
            </ul>

            <p className="mt-6 text-balance text-[0.86rem] leading-relaxed text-parchment/55">
              Slots are limited and go first come, first served. A refundable security deposit is
              collected in cash when you arrive.
            </p>

            <button
              type="button"
              onClick={openAccommodation}
              data-cursor="STAY"
              className="mt-7 flex min-h-12 w-full items-center justify-center gap-2.5 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep px-8 py-3.5 font-log text-[0.74rem] uppercase tracking-wide2 text-abyss transition-transform hover:scale-[1.02] sm:w-auto"
            >
              <BedDouble size={16} />
              Book your stay
            </button>

            <p className="mt-3 text-balance text-[0.76rem] text-parchment/45">
              Rates, house rules and what to bring are all on the booking form.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
