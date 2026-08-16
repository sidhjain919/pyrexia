import { useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Search, ArrowUpRight, Ticket } from 'lucide-react'
import { territories } from '../data/events'
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

const rows: Row[] = territories.flatMap((t) =>
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
  const [cat, setCat] = useState('All')

  const cats = ['All', ...territories.map((t) => t.code)]

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      const matchCat = cat === 'All' || r.terr === cat
      const matchQ = !q || r.name.toLowerCase().includes(q) || r.tag.toLowerCase().includes(q) || r.terr.toLowerCase().includes(q)
      return matchCat && matchQ
    })
  }, [query, cat])

  return (
    <section className="relative py-14 sm:py-18 lg:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <SectionTitle index="◆" eyebrow="Event Discovery" title="Every Treasure on the Island" kicker="Search 60+ competitions, filter by territory, and sign up for the ones you'll conquer." />

        {/* controls */}
        <div className="mt-10 flex flex-col gap-4">
          <div className="relative max-w-md">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-parchment/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search events…"
              className="w-full rounded-full border border-gold/20 bg-ocean/60 py-3 pl-11 pr-4 text-offwhite placeholder:text-parchment/35 outline-none focus:border-gold/60"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {cats.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`rounded-full px-3.5 py-1.5 font-log text-[0.62rem] uppercase tracking-wide2 transition-all ${
                  cat === c ? 'bg-gradient-to-b from-gold-bright to-gold-deep text-abyss' : 'text-parchment/65 ring-1 ring-gold/20 hover:ring-gold/50'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="font-log text-[0.62rem] uppercase tracking-wide2 text-parchment/45">
            {filtered.length} {filtered.length === 1 ? 'event' : 'events'}
          </div>
        </div>

        {/* grid */}
        <motion.div layout className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((r, i) => (
              <motion.article
                key={r.terr + r.name}
                layout
                initial={reduce ? false : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.4, delay: Math.min(i * 0.02, 0.25) }}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-gold/12 bg-navy/50"
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
                  <span className="absolute bottom-3 left-3 font-log text-[0.56rem] uppercase tracking-wide2" style={{ color: r.accent }}>
                    {r.terr} · {r.territory}
                  </span>
                </div>
                {/* body */}
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="font-display text-xl text-offwhite">{r.name}</h3>
                  <p className="mt-1 text-[0.85rem] text-parchment/60">{r.tag}</p>
                  <div className="mt-4 flex items-center gap-2 pt-1">
                    <button
                      onClick={() => openRegister(r.name)}
                      data-cursor="REGISTER"
                      className="group/btn flex flex-1 items-center justify-center gap-1.5 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep py-2.5 text-[0.68rem] font-semibold uppercase tracking-wide2 text-abyss transition-transform hover:scale-[1.02]"
                    >
                      <Ticket size={13} />
                      Register
                    </button>
                    <span className="flex items-center gap-1 rounded-full px-3 py-2.5 font-log text-[0.6rem] uppercase tracking-wide2 text-parchment/50 ring-1 ring-gold/15">
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
