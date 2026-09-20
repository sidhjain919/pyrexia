import type { ReactNode } from 'react'

import { Reveal } from './primitives'
import { asset } from '../lib/asset'
import { useRegistration } from '../registration/context'
import { useNavTo } from './routing'
import { BedDouble, BookOpen, Compass as CompassIcon } from 'lucide-react'

/**
 * Three ways in, directly under the hero.
 *
 * The hero used to carry four things you could press, with the navbar's own
 * button above them. Five invitations over a wordmark is a toolbar, not a
 * landing page, so the hero makes one offer and these carry the rest.
 *
 * Three earlier attempts were furniture, and all three shared one trait: a
 * bordered box with text in it. A full-bleed band whose rules ran edge to edge
 * while its content stopped at 896px, leaving 512px of empty line at each end
 * of a wide screen; a row of plain labels that read as a breadcrumb; then
 * cards, which were the generic pattern outright. What is here now has no box
 * at all, only hairlines between the columns, so nothing can be left stranded
 * and nothing reads as a widget.
 *
 * The order is deliberate and is not the order of importance: the brochure
 * leads because it is what somebody who knows nothing yet actually wants, and
 * the bed comes last because it is the thing you think about only once you
 * have decided to come.
 *
 * No "Register" here. The hero's button is already that, a hundred pixels up,
 * and it becomes "My Pass" once somebody holds one.
 */
export default function HeroActions() {
  const { openAccommodation } = useRegistration()
  const navTo = useNavTo()

  return (
    <div className="relative z-10 px-6 pb-4 pt-9 sm:pt-11">
      <Reveal>
        <nav
          aria-label="Quick links"
          className="mx-auto grid max-w-4xl divide-y divide-gold/15 sm:grid-cols-3 sm:divide-x sm:divide-y-0"
        >
          <Item
            icon={<BookOpen size={17} />}
            title="The brochure"
            body="The whole programme, one download."
            href={asset('pyrexia-brochure.pdf')}
            cursor="READ"
          />
          <Item
            icon={<CompassIcon size={17} />}
            title="The events"
            body="From the arena to the dance floor."
            onClick={() => navTo('/#island')}
            cursor="GO"
          />
          <Item
            icon={<BedDouble size={17} />}
            title="Your stay"
            body="A bed for the five days, booked here."
            onClick={openAccommodation}
            cursor="STAY"
          />
        </nav>
      </Reveal>
    </div>
  )
}

function Item({
  icon,
  title,
  body,
  href,
  onClick,
  cursor,
}: {
  icon: ReactNode
  title: string
  body: string
  href?: string
  onClick?: () => void
  cursor: string
}) {
  /* A flex column anchored to the top, not `block`. A button whose content is
     shorter than its grid cell has that content centred vertically by the
     browser, which dropped the one-line third column 11px below the other
     two while the two-line middle column happened to line up by accident. */
  const className =
    'group flex h-full w-full flex-col items-start justify-start px-6 py-4 text-left'

  const inner = (
    <>
      <span className="flex items-center gap-2.5">
        <span className="shrink-0 text-gold/70 transition-colors group-hover:text-gold-bright">
          {icon}
        </span>
        <span className="font-display text-[1.15rem] leading-none text-offwhite transition-colors group-hover:text-gold-bright">
          {title}
        </span>
      </span>
      <span className="mt-2.5 block text-pretty text-[0.82rem] leading-relaxed text-parchment/55">
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
