import { BedDouble, Check, Wallet } from 'lucide-react'

import { Reveal, SectionTitle } from './primitives'
import { useRegistration } from '../registration/context'
import {
  BOYS_RATES,
  BRING_TO_CHECKIN,
  GIRLS_RATES,
  SECURITY_DEPOSIT,
  type StayRate,
} from '../data/accommodation'

/**
 * Where to sleep.
 *
 * Near the top of the page on purpose: slots are limited and allocated first
 * come, first served, so this is the one thing on the landing page where being
 * seen late actually costs somebody something.
 *
 * The section sells and the modal transacts. Everything here is readable
 * without signing in, including the full rate card, because the first question
 * anybody has is what it costs and making them sign in to find out is how you
 * lose them.
 */
export default function Harbour() {
  const { openAccommodation } = useRegistration()

  return (
    <section id="harbour" className="relative overflow-hidden py-14 sm:py-18 lg:py-24">
      <div className="map-grid pointer-events-none absolute inset-0 opacity-25" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(80% 60% at 50% 0%, rgba(200,155,60,0.10), transparent 62%)',
        }}
      />

      <div className="relative mx-auto max-w-5xl px-6">
        <SectionTitle
          /* Not a numeral: the section sits between 02 and 03, and the marker
             EventsGrid already uses avoids renumbering the whole page to slot
             one section into the middle of it. */
          index="◆"
          eyebrow="Make port"
          title="The Harbour"
          meaning="Stay & accommodation"
          align="center"
          kicker="Five days is a long way from home. Rooms on the AIIMS Rishikesh campus and with our hospitality partners, booked and paid for here. Slots are limited and go first come, first served."
        />

        {/* The rate card, both blocks side by side. */}
        <div className="mt-10 grid gap-4 sm:mt-12 lg:grid-cols-2">
          <Reveal>
            <RateCard title="Boys" rates={BOYS_RATES} />
          </Reveal>
          <Reveal delay={0.06}>
            <RateCard title="Girls" rates={GIRLS_RATES} />
          </Reveal>
        </div>

        <Reveal delay={0.1}>
          <p className="mt-4 text-center text-[0.78rem] text-parchment/45">
            Per person, per day. Book four days or all five. Payment gateway charges are added at
            checkout.
          </p>
        </Reveal>

        {/* The two things people turn up without. */}
        <div className="mt-8 grid gap-4 sm:mt-10 sm:grid-cols-2">
          <Reveal delay={0.12}>
            <div className="h-full rounded-xl border border-gold/30 bg-gold/5 p-5">
              <div className="flex items-center gap-2.5">
                <Wallet size={16} className="shrink-0 text-gold-bright" />
                <span className="font-log text-[0.64rem] uppercase tracking-wide2 text-gold/80">
                  The deposit
                </span>
              </div>
              <p className="mt-3 text-[0.88rem] leading-relaxed text-parchment/75">
                A refundable{' '}
                <strong className="text-gold-bright">₹{SECURITY_DEPOSIT} security deposit</strong> is
                collected in cash at check-in and returned when you leave. It is separate from the
                room rate and cannot be paid online, so carry it.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.16}>
            <div className="h-full rounded-xl border border-gold/20 bg-ocean/40 p-5">
              <div className="font-log text-[0.64rem] uppercase tracking-wide2 text-gold/75">
                Bring to check-in
              </div>
              <ul className="mt-3 space-y-1.5">
                {BRING_TO_CHECKIN.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-[0.86rem] leading-relaxed text-parchment/75"
                  >
                    <Check size={13} className="mt-1 shrink-0 text-gold-bright" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.2}>
          <div className="mt-8 flex justify-center sm:mt-10">
            <button
              type="button"
              onClick={openAccommodation}
              data-cursor="STAY"
              className="flex min-h-12 items-center justify-center gap-2.5 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep px-8 py-3.5 font-log text-[0.74rem] uppercase tracking-wide2 text-abyss transition-transform hover:scale-[1.02]"
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

/**
 * One block's rates.
 *
 * A real table rather than a grid of divs: it is tabular data, somebody will
 * read it with a screen reader, and the AC and non-AC columns only mean
 * anything next to their headers.
 */
function RateCard({ title, rates }: { title: string; rates: readonly StayRate[] }) {
  return (
    <div className="h-full rounded-xl border border-gold/20 bg-ocean/40 p-5">
      <div className="font-display text-[1.1rem] text-offwhite">{title}</div>

      <table className="mt-3 w-full border-collapse text-[0.86rem]">
        <thead>
          <tr className="font-log text-[0.6rem] uppercase tracking-wide2 text-parchment/50">
            <th scope="col" className="pb-2 text-left font-normal">
              Room
            </th>
            <th scope="col" className="pb-2 text-right font-normal">
              AC
            </th>
            <th scope="col" className="pb-2 text-right font-normal">
              Non-AC
            </th>
          </tr>
        </thead>
        <tbody>
          {rates.map((r) => (
            <tr key={r.sharing} className="border-t border-gold/15">
              <th scope="row" className="py-2 text-left font-normal text-parchment/75">
                {r.sharing} seater
              </th>
              <td className="py-2 text-right font-mono text-gold-bright">
                ₹{r.ac.toLocaleString('en-IN')}
              </td>
              <td className="py-2 text-right font-mono text-parchment/70">
                ₹{r.nonAc.toLocaleString('en-IN')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
