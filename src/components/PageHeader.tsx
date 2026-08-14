import { motion, useReducedMotion } from 'framer-motion'
import { StaggerWords } from './primitives'
import { Sun, Palm, Cloud } from './art'

/** Bright cartoon page banner with a real photo strip and playful title. */
export default function PageHeader({
  eyebrow, title, kicker, photo,
}: { eyebrow: string; title: string; kicker?: string; photo: string }) {
  const reduce = useReducedMotion()
  return (
    <header className="relative overflow-hidden pb-10 pt-28 sm:pb-14 sm:pt-32" style={{ background: 'linear-gradient(180deg,#7fd3e0 0%, #ffe6a8 70%, #ffc98c 100%)' }}>
      <Sun size={120} className="absolute right-8 top-20 anim-sun" />
      <Cloud size={150} className="absolute left-6 top-24 opacity-90" style={{ animation: 'drift 40s linear infinite' }} />
      <Palm size={150} className="absolute -bottom-2 -left-4 anim-sway drop-ink" />
      <Palm size={140} flip className="absolute -bottom-2 -right-4 anim-sway drop-ink" />
      <div className="map-dots pointer-events-none absolute inset-0 opacity-25" />

      <div className="relative mx-auto w-full max-w-6xl px-6 text-center">
        <motion.div initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex justify-center">
          <span className="sticker-sm inline-block rounded-full bg-sun px-4 py-1 font-fun text-sm font-bold uppercase tracking-wide2 text-ink">{eyebrow}</span>
        </motion.div>
        <h1 className="font-display mt-4 text-5xl leading-[1.02] text-cream sm:text-7xl title-stroke"><StaggerWords text={title} /></h1>
        {kicker && (
          <motion.p initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mx-auto mt-4 max-w-xl font-fun text-lg font-medium text-ink/80">{kicker}</motion.p>
        )}
        <motion.div initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mx-auto mt-7 max-w-sm">
          <div className="sticker-lg overflow-hidden rounded-2xl bg-cream" style={{ rotate: '-1.5deg' }}>
            <img src={photo} alt="" className="h-40 w-full object-cover sm:h-48" />
          </div>
        </motion.div>
      </div>
    </header>
  )
}
