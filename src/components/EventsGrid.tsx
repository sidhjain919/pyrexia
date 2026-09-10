import { useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Search, ArrowUpRight, BookOpen, ExternalLink, Hourglass, MoveHorizontal, Sparkles, Ticket } from 'lucide-react'
import { territories, TOTAL_EVENTS } from '../data/events'
import { useOpenings } from '../registration/useOpenings'
import { asset } from '../lib/asset'
import { useNavTo } from './routing'
import { territoryPhoto, territoryFocus } from '../data/media'
import { photoFor } from '../data/photos'
import { TerritoryGlyph } from '../lib/art'
import { SectionTitle } from './primitives'
import { useRegistration } from '../registration/context'

type Row = {
  name: string
  tag: string
  terr: string
  terrId: string
  territory: string
  icon: string
  accent: string
  photo: string
  ownPhoto: boolean
  /** Thunderbolt brackets link straight out to the e-gaming crew's own form. */
  externalForm?: string
  /** This vertical's official rulebook PDF, where one is published. */
  rulebook?: string
  /** Set on the two verticals that aren't competitions: what the card offers instead. */
  cta?: { label: string; to: string }
}

/**
 * Every territory, including the two you don't register for.
 *
 * Fahrenheit and Auriga used to be handled by leaving one out of the grid and
 * letting the other render a "Coming Soon" button that would never become
 * anything. Both are real parts of the fest and both belong here — they just
 * offer something other than a form.
 */
const rows: Row[] = territories.flatMap((t) =>
  t.events.map((e) => ({
    name: e.name,
    tag: e.tag,
    terr: t.code,
    terrId: t.id,
    territory: t.territory,
    icon: t.icon,
    accent: t.accent,
    // Its own frame where we have one; the territory's otherwise. A card that
    // shows the event you are about to enter beats sixty of the same crowd.
    photo: photoFor(e.name) ?? territoryPhoto[t.id],
    ownPhoto: !!photoFor(e.name),
    externalForm: e.form,
    rulebook: t.rulebook,
    cta: t.cta,
  })),
)

export default function EventsGrid() {
  const { openRegister } = useRegistration()
  const { isOpen } = useOpenings()
  const navTo = useNavTo()
  const reduce = useReducedMotion()
  const [query, setQuery] = useState('')
  // Chorea rather than Fahrenheit: the first tab should open onto a rail of
  // competitions, not onto the one card that has a single entry.
  const [cat, setCat] = useState('Chorea')

  const cats = territories.map((t) => t.code)
  const searching = query.trim().length > 0

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      const matchCat = searching || r.terr === cat
      const matchQ = !q || r.name.toLowerCase().includes(q) || r.tag.toLowerCase().includes(q) || r.terr.toLowerCase().includes(q)
      return matchCat && matchQ
    })
  }, [query, cat, searching])

  return (
    <section className="relative py-14 sm:py-18 lg:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <SectionTitle index="◆" eyebrow="Event Discovery" title="Every Treasure on the Island" kicker={`Pick a territory to see its events, or search across all ${TOTAL_EVENTS} competitions at once.`} />

        {/* controls */}
        <div className="mt-10 flex flex-col gap-5">
          <div className="relative max-w-md">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-parchment/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search all events…"
              className="w-full rounded-full border border-gold/20 bg-ocean/60 py-3 pl-11 pr-4 text-offwhite placeholder:text-parchment/35 outline-none focus:border-gold/60"
            />
          </div>

          {/* territory tabs: a swipeable strip on mobile, wraps normally from sm up; hidden while searching */}
          {!searching && (
            <div className="-mx-6 flex flex-nowrap gap-2 overflow-x-auto px-6 py-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
              {cats.map((c) => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={`font-accent inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-full px-4 py-1.5 text-[0.78rem] uppercase tracking-wide2 transition-all sm:min-h-0 ${
                    cat === c
                      ? 'bg-gradient-to-b from-gold-bright to-gold-deep text-abyss'
                      : 'bg-ocean/40 text-parchment/75 ring-1 ring-inset ring-gold/45 hover:text-gold-bright hover:ring-gold/85'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-4 font-log text-[0.62rem] uppercase tracking-wide2 text-parchment/62">
            <span>
              {filtered.length} {filtered.length === 1 ? 'event' : 'events'}
              {searching ? ' found' : ` in ${cat}`}
            </span>
            {filtered.length > 1 && (
              <span className="flex items-center gap-1.5 text-parchment/45">
                <span className="sm:hidden">Swipe</span>
                <span className="hidden sm:inline">Scroll</span>
                <MoveHorizontal size={12} />
              </span>
            )}
          </div>
        </div>

        {/* A swipeable rail at every width: the cards scroll horizontally on
            desktop too, rather than stacking into a grid, so a territory reads
            as one row you slide through. */}
        <motion.div
          layout
          className="mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <AnimatePresence mode="popLayout">
            {filtered.map((r, i) => (
              <motion.article
                key={r.terr + r.name}
                layout
                initial={reduce ? false : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.4, delay: Math.min(i * 0.02, 0.25) }}
                className="group relative flex w-[78vw] max-w-[300px] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-gold/12 bg-navy/50 sm:w-[300px]"
              >
                {/* photo */}
                <div className="relative aspect-[16/10] overflow-hidden">
                  <img
                    src={r.photo}
                    alt=""
                    loading="lazy"
                    style={{ objectPosition: r.ownPhoto ? '50% 38%' : (territoryFocus[r.terrId] ?? '50% 28%') }}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/30 to-transparent" />
                  {/* The emblem sits on the photo without a chip: a drawn
                      mark does not need a UI container to be legible. */}
                  <TerritoryGlyph
                    id={r.terrId}
                    size={38}
                    className="absolute right-2.5 top-2.5 drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]"
                  />
                  <span className="absolute bottom-3 left-3 font-log text-[0.7rem] uppercase tracking-wide2" style={{ color: r.accent }}>
                    {r.terr}
                  </span>
                </div>
                {/* body */}
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="font-display text-xl text-offwhite">{r.name}</h3>
                  <p className="mt-1 text-[0.85rem] text-parchment/60">{r.tag}</p>
                  {/* `mt-auto`, not a fixed margin: a two-line tag would
                      otherwise push its buttons a row lower than its
                      neighbours', and a rail of cards whose buttons don't line
                      up reads as broken. The row sits on the floor of the card
                      whatever the text above it does. */}
                  <div className="mt-auto flex items-center gap-2 pt-5">
                    {/* Three kinds of card, and only one of them is a form.
                        The ceremony and the pro nights are on your pass, so
                        they point at the thing you actually came to find. */}
                    <button
                      onClick={() => (r.cta ? navTo(r.cta.to) : openRegister(r.name))}
                      data-cursor={r.cta ? 'LOOK' : isOpen(r.terrId) ? 'REGISTER' : 'SOON'}
                      className="group/btn flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep py-2.5 text-[0.68rem] font-semibold uppercase tracking-wide2 text-abyss transition-transform hover:scale-[1.02]"
                    >
                      {r.cta ? (
                        <>
                          <Sparkles size={13} />
                          {r.cta.label}
                        </>
                      ) : !isOpen(r.terrId) ? (
                        <>
                          <Hourglass size={13} />
                          Coming Soon
                        </>
                      ) : r.externalForm ? (
                        <>
                          <ExternalLink size={13} />
                          Register
                        </>
                      ) : (
                        <>
                          <Ticket size={13} />
                          Register
                        </>
                      )}
                    </button>
                    {/* The rulebook, one tap from the card. Somebody deciding
                        whether to enter wants the rules, not a second click
                        through a modal to find them. */}
                    {r.rulebook ? (
                      <a
                        href={asset(`rulebooks/${r.rulebook}`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`${r.terr} rulebook (PDF)`}
                        aria-label={`${r.terr} rulebook, PDF, opens in a new tab`}
                        className="flex min-h-11 items-center gap-1.5 rounded-full px-3.5 font-log text-[0.6rem] uppercase tracking-wide2 text-parchment/70 ring-1 ring-inset ring-gold/35 transition-colors hover:text-gold-bright hover:ring-gold/70"
                      >
                        <BookOpen size={12} />
                        Rules
                      </a>
                    ) : (
                      <span className="flex items-center gap-1 rounded-full px-3 py-2.5 font-log text-[0.6rem] uppercase tracking-wide2 text-parchment/65 ring-1 ring-inset ring-gold/35">
                        <ArrowUpRight size={12} />
                      </span>
                    )}
                  </div>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  )
}
