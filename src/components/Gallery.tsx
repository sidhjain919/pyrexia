import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { X, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { gallery, galleryCats, type GalleryCat } from '../data/gallery'
import { Reveal, SectionTitle } from './primitives'

type Filter = 'All' | GalleryCat
const PAGE_SIZE = 12

export default function Gallery() {
  const [filter, setFilter] = useState<Filter>('All')
  const [lightbox, setLightbox] = useState<number | null>(null)
  const [visible, setVisible] = useState(PAGE_SIZE)
  const reduce = useReducedMotion()

  const shots = useMemo(() => {
    return filter === 'All' ? gallery : gallery.filter((s) => s.cat === filter)
  }, [filter])
  const shown = shots.slice(0, visible)

  useEffect(() => setVisible(PAGE_SIZE), [filter])

  const close = useCallback(() => setLightbox(null), [])
  const step = useCallback(
    (d: number) => setLightbox((n) => (n === null ? n : (n + d + shots.length) % shots.length)),
    [shots.length],
  )

  useEffect(() => {
    if (lightbox === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight') step(1)
      if (e.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [lightbox, close, step])

  return (
    <section id="gallery" className="relative overflow-hidden py-14 sm:py-18 lg:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <SectionTitle
          index="06"
          eyebrow="Previous Voyages"
          title="Memories from the Sea"
          meaning="Gallery"
          kicker="Real frames from past editions of PYREXIA at AIIMS Rishikesh: the fever, the crews, the roar."
        />

        {/* filters */}
        <Reveal>
          <div className="-mx-6 mt-10 flex flex-nowrap gap-2 overflow-x-auto px-6 py-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
            {(['All', ...galleryCats] as Filter[]).map((c) => (
              <button
                key={c}
                onClick={() => setFilter(c)}
                data-cursor="FILTER"
                className={`font-accent shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-[0.76rem] uppercase tracking-wide2 transition-all duration-300 ${
                  filter === c
                    ? 'bg-gradient-to-b from-gold-bright to-gold-deep text-abyss'
                    : 'bg-ocean/40 text-parchment/75 ring-1 ring-inset ring-gold/45 hover:text-gold-bright hover:ring-gold/85'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </Reveal>

        {/* mosaic: dense grid fills gaps; wide/tall shots span extra cells */}
        <motion.div
          layout
          className="mt-8 grid grid-flow-dense auto-rows-[116px] grid-cols-2 gap-3 sm:auto-rows-[150px] sm:grid-cols-3 lg:auto-rows-[168px] lg:grid-cols-4"
        >
          <AnimatePresence mode="popLayout">
            {shown.map((s, i) => (
              <motion.button
                key={s.src}
                layout
                initial={reduce ? false : { opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduce ? undefined : { opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.4, delay: Math.min(i * 0.015, 0.3) }}
                onClick={() => setLightbox(i)}
                data-cursor="VIEW"
                className={`group relative block overflow-hidden rounded-lg border border-gold/10 ${
                  s.tall ? 'row-span-2' : ''
                } ${s.wide ? 'col-span-2 row-span-2' : ''}`}
              >
                <img
                  src={s.src}
                  alt={s.caption}
                  loading="lazy"
                  decoding="async"
                  className="block h-full w-full object-cover object-[50%_34%] transition-transform duration-700 ease-out group-hover:scale-[1.06]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-abyss/90 via-abyss/10 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <div className="absolute inset-x-0 bottom-0 translate-y-2 p-3 opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                  <span className="font-log text-[0.68rem] uppercase tracking-wide2 text-gold-bright">
                    {s.cat}
                  </span>
                  <p className="mt-0.5 text-[0.78rem] leading-snug text-offwhite">{s.caption}</p>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </motion.div>

        {visible < shots.length && (
          <Reveal>
            <div className="mt-8 flex justify-center">
              <button
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
                data-cursor="MORE"
                className="font-accent group flex items-center gap-2 rounded-full px-7 py-3 text-[0.86rem] uppercase tracking-wide2 text-gold-bright ring-1 ring-inset ring-gold/55 transition-colors hover:bg-gold/10 hover:ring-gold"
              >
                Show More
                <ChevronDown size={15} className="transition-transform group-hover:translate-y-0.5" />
              </button>
            </div>
          </Reveal>
        )}
      </div>

      {/* lightbox */}
      <AnimatePresence>
        {lightbox !== null && shots[lightbox] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2000] flex items-center justify-center bg-abyss/94 p-4 backdrop-blur-sm sm:p-10"
            onClick={close}
          >
            <button
              onClick={close}
              aria-label="Close"
              className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-full ring-1 ring-inset ring-gold/45 text-gold-bright hover:bg-gold/10"
            >
              <X size={18} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); step(-1) }}
              aria-label="Previous"
              className="absolute left-3 flex h-12 w-12 items-center justify-center rounded-full text-gold-bright hover:bg-gold/10 sm:left-8"
            >
              <ChevronLeft size={26} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); step(1) }}
              aria-label="Next"
              className="absolute right-3 flex h-12 w-12 items-center justify-center rounded-full text-gold-bright hover:bg-gold/10 sm:right-8"
            >
              <ChevronRight size={26} />
            </button>

            <motion.figure
              key={shots[lightbox].src}
              initial={reduce ? false : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35 }}
              className="max-h-full max-w-4xl"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={shots[lightbox].src}
                alt={shots[lightbox].caption}
                className="max-h-[76vh] w-auto rounded-lg border border-gold/20 object-contain shadow-cinema"
              />
              <figcaption className="mt-3 text-center">
                <span className="font-log text-[0.72rem] uppercase tracking-cinema text-gold-bright">
                  {shots[lightbox].cat}
                </span>
                <p className="mt-1 text-sm text-parchment/80">{shots[lightbox].caption}</p>
              </figcaption>
            </motion.figure>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
