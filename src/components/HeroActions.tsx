import { BedDouble, BookOpen, Compass as CompassIcon } from 'lucide-react'

import { asset } from '../lib/asset'
import { useRegistration } from '../registration/context'
import { useNavTo } from './routing'

/**
 * The ledge under the hero.
 *
 * The hero used to carry four things you could press: the pass button, "Enter
 * the Island", a gold brochure pill, and a scroll cue, with the navbar's own
 * button above all of it. Five invitations competing over a wordmark is not a
 * landing page, it is a toolbar. The hero now makes one offer, and the
 * secondary ones live here, a scroll-tick below it, as text rather than
 * buttons.
 *
 * Deliberately no "Register" here: the hero's button is already that, a
 * hundred pixels up, and it changes to "My Pass" once somebody holds one. A
 * second copy would put the same offer on screen twice.
 */
export default function HeroActions() {
  const { openAccommodation } = useRegistration()
  const navTo = useNavTo()

  return (
    <div className="relative z-10 border-y border-gold/15 bg-abyss/60">
      <div className="mx-auto flex max-w-4xl flex-col divide-y divide-gold/12 px-6 sm:flex-row sm:divide-x sm:divide-y-0">
        <Action
          icon={<BedDouble size={15} />}
          label="Stay on the island"
          note="Rooms & rates"
          onClick={openAccommodation}
          cursor="STAY"
        />
        <Action
          icon={<CompassIcon size={15} />}
          label="Explore the events"
          note="All eleven territories"
          onClick={() => navTo('/#island')}
          cursor="GO"
        />
        <Action
          icon={<BookOpen size={15} />}
          label="Read the 2026 brochure"
          note="The full programme, one PDF"
          href={asset('pyrexia-brochure.pdf')}
          cursor="READ"
        />
      </div>
    </div>
  )
}

function Action({
  icon,
  label,
  note,
  href,
  onClick,
  cursor,
}: {
  icon: React.ReactNode
  label: string
  note: string
  href?: string
  onClick?: () => void
  cursor: string
}) {
  // Text, not a pill. The whole point of this strip is that it does not
  // compete with the one button above it.
  const className =
    'group flex min-h-16 flex-1 items-center gap-3 py-4 text-left transition-colors sm:justify-center sm:px-5'

  const inner = (
    <>
      <span className="shrink-0 text-gold/70 transition-colors group-hover:text-gold-bright">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-log text-[0.74rem] uppercase tracking-wide2 text-parchment/85 transition-colors group-hover:text-gold-bright">
          {label}
        </span>
        <span className="mt-0.5 block text-[0.72rem] text-parchment/45">{note}</span>
      </span>
    </>
  )

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        data-cursor={cursor}
        className={className}
      >
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
