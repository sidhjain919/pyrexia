import { useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Search, Ticket } from 'lucide-react'
import { territories } from '../data/events'
import { territoryPhoto, territoryFocus } from '../data/media'
import { Icon } from '../lib/icons'
import { SectionTitle } from './primitives'
import { useRegistration } from '../registration/context'

const rows = territories.flatMap((t) =>
  t.events.map((e) => ({ name: e.name, tag: e.tag, terr: t.code, terrId: t.id, territory: t.territory, icon: t.icon, accent: t.accent, photo: territoryPhoto[t.id] })),
)

export default function EventsGrid() {
  const { openRegister } = useRegistration()
  const reduce = useReducedMotion()
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState('All')
  const cats = ['All', ...territories.map((t) => t.code)]

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => (cat === 'All' || r.terr === cat) && (!q || r.name.toLowerCase().includes(q) || r.tag.toLowerCase().includes(q) || r.terr.toLowerCase().includes(q)))
  }, [query, cat])

  return (
    <section className="relative bg-cream py-16 sm:py-24">
      <div className="map-dots pointer-events-none absolute inset-0 opacity-50" />
      <div className="relative mx-auto max-w-6xl px-6">
        <SectionTitle index="✦" eyebrow="Event Discovery" title="Every Treasure on the Island" color="var(--color-sea-deep)"
          kicker="Search 60+ competitions, filter by territory, and sign up for the ones you'll conquer!" />

        <div className="mt-10 flex flex-col gap-4">
          <div className="relative max-w-md">
            <Search size={18} strokeWidth={2.5} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/50" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search events…"
              className="sticker-sm w-full rounded-full bg-cream-soft py-3 pl-11 pr-4 font-fun font-semibold text-ink placeholder:text-ink/40 outline-none" />
          </div>
          <div className="flex flex-wrap gap-2">
            {cats.map((c) => (
              <button key={c} onClick={() => setCat(c)} data-cursor="PICK"
                className={`sticker-sm sticker-press rounded-full px-3.5 py-1.5 font-fun text-sm font-bold ${cat === c ? 'bg-coral text-cream' : 'bg-cream text-ink'}`}>{c}</button>
            ))}
          </div>
          <div className="font-hand text-xl text-ink/60">{filtered.length} {filtered.length === 1 ? 'event' : 'events'}</div>
        </div>

        <motion.div layout className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((r, i) => (
              <motion.article key={r.terr + r.name} layout initial={reduce ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.35, delay: Math.min(i * 0.02, 0.25) }} className="sticker sticker-press group flex flex-col overflow-hidden rounded-3xl bg-cream">
                <div className="relative aspect-[16/10] overflow-hidden border-b-[3px] border-ink">
                  <img src={r.photo} alt="" loading="lazy" style={{ objectPosition: territoryFocus[r.terrId] ?? '50% 28%' }} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <span className="sticker-sm absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full" style={{ background: r.accent }}><Icon name={r.icon} size={15} strokeWidth={2.5} style={{ color: '#fff' }} /></span>
                  <span className="absolute bottom-2 left-3 font-hand text-lg" style={{ color: '#fff', textShadow: '1px 2px 3px rgba(0,0,0,.6)' }}>{r.terr} · {r.territory}</span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="font-display text-xl text-ink">{r.name}</h3>
                  <p className="mt-0.5 font-fun text-[0.9rem] text-ink/60">{r.tag}</p>
                  <button onClick={() => openRegister(r.name)} data-cursor="JOIN" className="sticker-sm sticker-press mt-4 flex items-center justify-center gap-1.5 rounded-full bg-coral py-2.5 font-display text-sm text-cream">
                    <Ticket size={14} strokeWidth={2.5} /> Register
                  </button>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  )
}
