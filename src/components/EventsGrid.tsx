import { useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Search, ArrowUpRight, Hourglass, MoveHorizontal, Ticket } from 'lucide-react'
import { territories } from '../data/events'
import { EVENT_REGISTRATION_OPEN } from '../data/registration'
import { territoryPhoto, territoryFocus } from '../data/media'
import { Icon } from '../lib/icons'
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
}

// The opening ceremony (Fahrenheit) isn't a competition to browse/register for.
const registerable = territories.filter((t) => !t.noRegister)

const rows: Row[] = registerable.flatMap((t) =>
  t.events.map((e) => ({
    name: e.name,
    tag: e.tag,
    terr: t.code,
    terrId: t.id,
    territory: t.territory,
    icon: t.icon,
    accent: t.accent,
    photo: territoryPhoto[t.id],
  })),
)

export default function EventsGrid() {
  const { openRegister } = useRegistration()
  const reduce = useReducedMotion()
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState(registerable[0].code)

  const cats = registerable.map((t) => t.code)
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
        <SectionTitle index="◆" eyebrow="Event Discovery" title="Every Treasure on the Island" kicker="Pick a territory to see its events, or search across all 60+ competitions at once." />

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

          {/* territory tabs — a swipeable strip on mobile, wraps normally from sm up; hidden while searching */}
          {!searching && (
            <div className="-mx-6 flex flex-nowrap gap-2 overflow-x-auto px-6 py-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
              {cats.map((c) => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={`font-accent shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-[0.78rem] uppercase tracking-wide2 transition-all ${
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
              <span className="flex items-center gap-1.5 text-parchment/45 sm:hidden">
                Swipe <MoveHorizontal size={12} />
              </span>
            )}
          </div>
        </div>

        {/* On mobile the cards ride a swipeable rail — a 60-event column is an
            endless scroll otherwise. From sm up it goes back to a grid. */}
        <motion.div
          layout
          className="-mx-6 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-6 px-6 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3"
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
                className="group relative flex w-[78vw] max-w-[320px] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-gold/12 bg-navy/50 sm:w-auto sm:max-w-none sm:shrink"
              >
                {/* photo */}
                <div className="relative aspect-[16/10] overflow-hidden">
                  <img
                    src={r.photo}
                    alt=""
                    loading="lazy"
                    style={{ objectPosition: territoryFocus[r.terrId] ?? '50% 28%' }}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/30 to-transparent" />
                  <span
                    className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur"
                    style={{ background: `${r.accent}33`, border: `1px solid ${r.accent}77` }}
                  >
                    <Icon name={r.icon} size={15} style={{ color: '#fff' }} />
                  </span>
                  <span className="absolute bottom-3 left-3 font-log text-[0.7rem] uppercase tracking-wide2" style={{ color: r.accent }}>
                    {r.terr}
                  </span>
                </div>
                {/* body */}
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="font-display text-xl text-offwhite">{r.name}</h3>
                  <p className="mt-1 text-[0.85rem] text-parchment/60">{r.tag}</p>
                  <div className="mt-4 flex items-center gap-2 pt-1">
                    <button
                      onClick={() => openRegister(r.name)}
                      data-cursor={EVENT_REGISTRATION_OPEN ? 'REGISTER' : 'SOON'}
                      className="group/btn flex flex-1 items-center justify-center gap-1.5 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep py-2.5 text-[0.68rem] font-semibold uppercase tracking-wide2 text-abyss transition-transform hover:scale-[1.02]"
                    >
                      {EVENT_REGISTRATION_OPEN ? (
                        <>
                          <Ticket size={13} />
                          Register
                        </>
                      ) : (
                        <>
                          <Hourglass size={13} />
                          Coming Soon
                        </>
                      )}
                    </button>
                    <span className="flex items-center gap-1 rounded-full px-3 py-2.5 font-log text-[0.6rem] uppercase tracking-wide2 text-parchment/65 ring-1 ring-inset ring-gold/35">
                      <ArrowUpRight size={12} />
                    </span>
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
