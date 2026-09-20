import { asset } from '../lib/asset'
import { useRegistration } from '../registration/context'
import { useNavTo } from './routing'

/**
 * The three ways in, directly under the hero.
 *
 * The hero used to carry four things you could press, with the navbar's own
 * button above them. Five invitations over a wordmark is a toolbar, not a
 * landing page, so the hero now makes one offer and the rest live here.
 *
 * Deliberately not a band. The first version of this was a full-bleed strip
 * with a rule top and bottom, and because its content was capped at 896px
 * while the rules ran edge to edge, a 1920px screen drew 512px of empty
 * bordered line at each end and the whole thing read as an unfinished table.
 * Text centred on the page background cannot do that: it is only ever as wide
 * as the words in it.
 *
 * No "Register" here either. The hero's button is already that, a hundred
 * pixels up, and it changes to "My Pass" once somebody holds one.
 */
export default function HeroActions() {
  const { openAccommodation } = useRegistration()
  const navTo = useNavTo()

  return (
    <div className="relative z-10 px-6 pb-2 pt-7 sm:pt-8">
      {/* A column of three on a phone, one line with marks between from sm up.
          Wrapping an inline list would strand a separator at the end of a
          line, which is worse than simply stacking. */}
      <nav
        aria-label="Quick links"
        className="mx-auto flex max-w-3xl flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-0"
      >
        <Action label="Explore the events" onClick={() => navTo('/#island')} cursor="GO" />
        <Mark />
        <Action label="Book your stay" onClick={openAccommodation} cursor="STAY" />
        <Mark />
        <Action label="Read the brochure" href={asset('pyrexia-brochure.pdf')} cursor="READ" />
      </nav>
    </div>
  )
}

/** The separator. Decoration, so it is hidden from the accessibility tree. */
function Mark() {
  return (
    <span aria-hidden className="hidden px-4 text-[0.5rem] text-gold/40 sm:inline lg:px-5">
      ◆
    </span>
  )
}

function Action({
  label,
  href,
  onClick,
  cursor,
}: {
  label: string
  href?: string
  onClick?: () => void
  cursor: string
}) {
  // A minimum tap height on a phone, where these are stacked and thumbed.
  const className =
    'group inline-flex min-h-11 items-center font-log text-[0.72rem] uppercase tracking-wide2 text-parchment/70 transition-colors hover:text-gold-bright sm:min-h-0 sm:text-[0.74rem]'

  const inner = (
    <span className="relative">
      {label}
      <span className="absolute -bottom-1 left-0 h-px w-0 bg-gold-bright/70 transition-all duration-300 group-hover:w-full" />
    </span>
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
