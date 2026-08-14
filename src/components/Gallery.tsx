import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { X, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react'
import { gallery, galleryCats, type GalleryCat } from '../data/gallery'
import { Reveal, SectionTitle } from './primitives'
import { useNavTo } from './routing'

type Filter = 'All' | GalleryCat

export default function Gallery({ preview = false }: { preview?: boolean }) {
  const [filter, setFilter] = useState<Filter>('All')
  const [lightbox, setLightbox] = useState<number | null>(null)
  const reduce = useReducedMotion()
  const navTo = useNavTo()

  const shots = useMemo(() => {
    const base = filter === 'All' ? gallery : gallery.filter((s) => s.cat === filter)
    return preview ? base.slice(0, 10) : base
  }, [filter, preview])

  const close = useCallback(() => setLightbox(null), [])
  const step = useCallback((d: number) => setLightbox((n) => (n === null ? n : (n + d + shots.length) % shots.length)), [shots.length])

  useEffect(() => {
    if (lightbox === null) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') step(1); if (e.key === 'ArrowLeft') step(-1) }
    window.addEventListener('keydown', onKey); document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [lightbox, close, step])

  return (
    <section id="gallery" className="relative overflow-hidden bg-sand py-16 sm:py-24">
      <div className="map-dots pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative mx-auto max-w-6xl px-6">
        <SectionTitle index="06" eyebrow="Previous Voyages" title="Memories from the Sea" color="var(--color-sea-deep)"
          kicker="Real frames from past editions of PYREXIA at AIIMS Rishikesh — the fever, the crews, the roar!" />

        {!preview && (
          <Reveal>
            <div className="mt-9 flex flex-wrap gap-2">
              {(['All', ...galleryCats] as Filter[]).map((c) => (
                <button key={c} onClick={() => setFilter(c)} data-cursor="PICK"
                  className={`sticker-sm sticker-press rounded-full px-4 py-1.5 font-fun text-sm font-bold ${filter === c ? 'bg-coral text-cream' : 'bg-cream text-ink'}`}>{c}</button>
              ))}
            </div>
          </Reveal>
        )}

        <motion.div layout className="mt-9 grid grid-flow-dense auto-rows-[116px] grid-cols-2 gap-3 sm:auto-rows-[150px] sm:grid-cols-3 lg:auto-rows-[168px] lg:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {shots.map((s, i) => (
              <motion.button key={s.src} layout initial={reduce ? false : { opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={reduce ? undefined : { opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.4, delay: Math.min(i * 0.015, 0.3) }} onClick={() => setLightbox(i)} data-cursor="VIEW"
                className={`sticker-sm group relative block overflow-hidden rounded-2xl bg-cream ${s.tall ? 'row-span-2' : ''} ${s.wide ? 'col-span-2 row-span-2' : ''}`}>
                <img src={s.src} alt={s.caption} loading="lazy" decoding="async" className="block h-full w-full object-cover object-[50%_34%] transition-transform duration-500 group-hover:scale-[1.08]" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="absolute inset-x-0 bottom-0 translate-y-2 p-2.5 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                  <span className="sticker-sm rounded-full bg-sun px-2 py-0.5 font-fun text-[0.6rem] font-bold text-ink">{s.cat}</span>
                  <p className="mt-1 font-fun text-sm font-semibold text-cream">{s.caption}</p>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </motion.div>

        {preview && (
          <Reveal>
            <div className="mt-9 flex justify-center">
              <button onClick={() => navTo('/gallery')} data-cursor="MORE" className="sticker sticker-press flex items-center gap-2 rounded-full bg-sun px-7 py-3 font-display text-base text-ink">
                See all voyages <ArrowRight size={18} strokeWidth={3} />
              </button>
            </div>
          </Reveal>
        )}
      </div>

      <AnimatePresence>
        {lightbox !== null && shots[lightbox] && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[2000] flex items-center justify-center bg-ink/85 p-4 backdrop-blur-sm sm:p-10" onClick={close}>
            <button onClick={close} aria-label="Close" className="sticker-sm absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-full bg-sun text-ink"><X size={18} strokeWidth={3} /></button>
            <button onClick={(e) => { e.stopPropagation(); step(-1) }} aria-label="Previous" className="sticker-sm absolute left-3 flex h-12 w-12 items-center justify-center rounded-full bg-cream text-ink sm:left-8"><ChevronLeft size={24} strokeWidth={3} /></button>
            <button onClick={(e) => { e.stopPropagation(); step(1) }} aria-label="Next" className="sticker-sm absolute right-3 flex h-12 w-12 items-center justify-center rounded-full bg-cream text-ink sm:right-8"><ChevronRight size={24} strokeWidth={3} /></button>
            <motion.figure key={shots[lightbox].src} initial={reduce ? false : { opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} className="max-h-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
              <img src={shots[lightbox].src} alt={shots[lightbox].caption} className="sticker-lg max-h-[74vh] w-auto rounded-2xl bg-cream object-contain" />
              <figcaption className="mt-3 text-center">
                <span className="sticker-sm rounded-full bg-sun px-3 py-0.5 font-fun text-xs font-bold text-ink">{shots[lightbox].cat}</span>
                <p className="mt-2 font-fun text-base font-semibold text-cream">{shots[lightbox].caption}</p>
              </figcaption>
            </motion.figure>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
