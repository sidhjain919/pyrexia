import { gallery } from '../data/gallery'

/**
 * Two rows drawn from opposite ends of the gallery, so the same frame never
 * scrolls past twice at once.
 */
const wide = gallery.filter((s) => !s.tall).map((s) => s.src)
const rowA = wide.filter((_, i) => i % 2 === 0).slice(0, 10)
const rowB = wide.filter((_, i) => i % 2 === 1).slice(0, 10)

function Row({ items, reverse = false }: { items: string[]; reverse?: boolean }) {
  const loop = [...items, ...items]
  return (
    <div className={`flex w-max gap-3 ${reverse ? 'marquee-rev' : 'marquee'}`}>
      {loop.map((src, i) => (
        <div key={i} className="relative h-28 w-44 shrink-0 overflow-hidden rounded-lg border border-gold/10 sm:h-32 sm:w-52">
          <img src={src} alt="" loading="lazy" className="h-full w-full object-cover opacity-85 transition-opacity duration-500 hover:opacity-100" />
          <div className="absolute inset-0 ring-1 ring-inset ring-white/5" />
        </div>
      ))}
    </div>
  )
}

/** Two-row infinite photo ribbon that fills the space between sections. */
export default function PhotoMarquee() {
  return (
    <section className="relative overflow-hidden border-y border-gold/10 py-4" aria-hidden>
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-abyss to-transparent sm:w-32" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-abyss to-transparent sm:w-32" />
      <div className="flex flex-col gap-3">
        <Row items={rowA} />
        <Row items={rowB} reverse />
      </div>
    </section>
  )
}
