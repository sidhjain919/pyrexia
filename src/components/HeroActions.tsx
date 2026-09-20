import type { ReactNode } from 'react'

import { Reveal } from './primitives'
import { TOTAL_EVENTS, territories } from '../data/events'
import { asset } from '../lib/asset'
import { useRegistration } from '../registration/context'
import { useNavTo } from './routing'

/**
 * Three ways in, directly under the hero.
 *
 * The hero used to carry four things you could press, with the navbar's own
 * button above them. Five invitations over a wordmark is a toolbar, not a
 * landing page, so the hero makes one offer and these carry the rest.
 *
 * Two earlier attempts at this were furniture: a full-bleed band whose rules
 * ran edge to edge while its content stopped at 896px, leaving 512px of empty
 * line at each end of a wide screen, and then a row of plain labels that read
 * as a breadcrumb. Both looked like navigation bolted under a photograph. Each
 * card now leads with a fact rather than a label, which is the difference
 * between telling somebody where to click and telling them something worth
 * knowing.
 *
 * No "Register" here. The hero's button is already that, a hundred pixels up,
 * and it becomes "My Pass" once somebody holds one.
 */
export default function HeroActions() {
  const { openAccommodation } = useRegistration()
  const navTo = useNavTo()

  return (
    <div className="relative z-10 px-6 pb-4 pt-10 sm:pt-12">
      <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-3">
        <Reveal>
          <Card
            lead={String(TOTAL_EVENTS)}
            label="Events to enter"
            body={`${territories.length} territories, from the dance floor to the arena. Find the ones that are yours.`}
            onClick={() => navTo('/#island')}
            cursor="GO"
          />
        </Reveal>

        <Reveal delay={0.06}>
          <Card
            lead="5"
            label="Days on the island"
            body="Book a bed for the fest, and it will be waiting for you when you arrive."
            onClick={openAccommodation}
            cursor="STAY"
          />
        </Reveal>

        <Reveal delay={0.12}>
          <Card
            lead="1"
            label="Full programme"
            body="Every event, every rule and every date, in a single download."
            href={asset('pyrexia-brochure.pdf')}
            cursor="READ"
          />
        </Reveal>
      </div>
    </div>
  )
}

function Card({
  lead,
  label,
  body,
  href,
  onClick,
  cursor,
}: {
  lead: string
  label: string
  body: string
  href?: string
  onClick?: () => void
  cursor: string
}) {
  // No arrow anywhere. The border and the figure brighten together on hover,
  // which is what says "this is a thing you can press" here.
  const className =
    'group flex h-full w-full flex-col items-start rounded-xl border border-gold/15 bg-ocean/30 p-5 text-left transition-colors hover:border-gold/45 hover:bg-ocean/55'

  const inner: ReactNode = (
    <>
      <span className="flex items-baseline gap-2.5">
        <span className="font-display text-[2rem] leading-none text-gold/80 transition-colors group-hover:text-gold-bright">
          {lead}
        </span>
        <span className="font-log text-[0.62rem] uppercase tracking-wide2 text-parchment/55">
          {label}
        </span>
      </span>
      <span className="mt-3 text-pretty text-[0.88rem] leading-relaxed text-parchment/70">
        {body}
      </span>
    </>
  )

  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" data-cursor={cursor} className={className}>
        {inner}
      </a>
    )
  }

  return (
    <button type="button" onClick={onClick} data-cursor={cursor} className={className}>
      {inner}
    </button>
  )
}
