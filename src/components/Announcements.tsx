import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronRight, Megaphone, Pin, TriangleAlert, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'

import { api, type Notice } from '../api/client'
import { EARLY_BIRD } from '../data/site'

/**
 * The announcement strip, directly under the navbar.
 *
 * The noticeboard used to be one link in the footer, which is the same as not
 * having one: during the fest it is the page that changes hour to hour and the
 * only one anybody needs twice. It sits at the top now.
 *
 * It is a single line rather than a stacked banner on purpose. The hero is the
 * first thing anyone sees and a full-width bar across the top of it would cost
 * more than the notices are worth on a quiet day. Instead one item shows at a
 * time and they rotate, so the strip is the same height whether there is one
 * notice or nine.
 *
 * Urgent notices are marked with a word and an icon, never colour alone, and
 * they jump the queue.
 */

type Item = {
  key: string
  kind: 'early-bird' | 'notice'
  urgent: boolean
  label: string
  text: string
  /** Shown below `sm`, where the strip has room for about half as much. */
  short?: string
}

const ROTATE_MS = 6500

export default function Announcements() {
  const reduce = useReducedMotion()
  const [notices, setNotices] = useState<Notice[]>([])
  const [index, setIndex] = useState(0)

  useEffect(() => {
    let alive = true
    api
      .notices()
      .then((r) => alive && setNotices(r.notices))
      // A board that cannot be reached is not worth an error on the hero.
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const items = useMemo<Item[]>(() => {
    const fromNotices: Item[] = notices.slice(0, 5).map((n) => ({
      key: n.id,
      kind: 'notice',
      urgent: n.category === 'urgent',
      label: n.category === 'urgent' ? 'Urgent' : n.pinned ? 'Pinned' : 'Notice',
      text: n.title,
    }))

    const earlyBird: Item[] = EARLY_BIRD.live
      ? [
          {
            key: 'early-bird',
            kind: 'early-bird',
            urgent: false,
            label: 'Early bird',
            text: 'First 100 registrations pay the current price. After that it goes up.',
            short: 'First 100 pay the current price',
          },
        ]
      : []

    // Urgent first, then the offer, then the rest of the board.
    const urgent = fromNotices.filter((n) => n.urgent)
    const rest = fromNotices.filter((n) => !n.urgent)
    return [...urgent, ...earlyBird, ...rest]
  }, [notices])

  useEffect(() => {
    if (items.length < 2 || reduce) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % items.length), ROTATE_MS)
    return () => clearInterval(timer)
  }, [items.length, reduce])

  // The list can shrink when notices load; don't index off the end of it.
  const current = items[index % Math.max(items.length, 1)]
  if (!current) return null

  const Badge =
    current.urgent ? TriangleAlert : current.kind === 'early-bird' ? Zap : current.label === 'Pinned' ? Pin : Megaphone

  return (
    <div className="pointer-events-none mt-2 flex w-full justify-center px-1">
      <Link
        to="/notices"
        data-cursor="NOTICES"
        aria-live="polite"
        className={`pointer-events-auto group flex max-w-full items-center gap-2.5 overflow-hidden rounded-full border px-3 py-1.5 backdrop-blur-md transition-colors sm:px-4 ${
          current.urgent
            ? 'border-coral/55 bg-coral/15 hover:border-coral'
            : 'border-gold/35 bg-abyss/70 hover:border-gold/70'
        }`}
      >
        <span
          className={`flex shrink-0 items-center gap-1.5 font-log text-[0.55rem] uppercase tracking-wide2 sm:text-[0.6rem] ${
            current.urgent ? 'text-coral' : 'text-gold-bright'
          }`}
        >
          <Badge size={12} className="shrink-0" />
          <span className="hidden sm:inline">{current.label}</span>
        </span>

        <span className="h-3 w-px shrink-0 bg-gold/30" />

        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={current.key}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="truncate text-[0.76rem] text-parchment/85 sm:text-[0.84rem]"
          >
            <span className="sm:hidden">{current.short ?? current.text}</span>
            <span className="hidden sm:inline">{current.text}</span>
          </motion.span>
        </AnimatePresence>

        <ChevronRight
          size={13}
          className="shrink-0 text-gold/60 transition-transform group-hover:translate-x-0.5 group-hover:text-gold-bright"
        />
      </Link>
    </div>
  )
}
