import { useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Compass, Sun, Cloud } from './art'
import { asset } from '../lib/asset'
import { SITE } from '../data/site'

export default function Loader({ onDone }: { onDone: () => void }) {
  const reduce = useReducedMotion()
  const total = reduce ? 0.2 : 2.4

  useEffect(() => {
    const t = window.setTimeout(onDone, total * 1000)
    return () => window.clearTimeout(t)
  }, [onDone, total])

  return (
    <motion.div
      className="fixed inset-0 z-[10000] flex flex-col items-center justify-center overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #7fd3e0 0%, #ffe6a8 55%, #ffb277 100%)' }}
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.7, ease: 'easeInOut' } }}
    >
      <Sun size={110} className="absolute right-10 top-10 anim-sun" />
      <Cloud size={150} className="absolute left-8 top-16" style={{ animation: 'drift 30s linear infinite' }} />

      <motion.div initial={{ scale: 0.4, rotate: -40, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ duration: 0.9, ease: [0.34, 1.56, 0.64, 1] }}>
        <Compass size={120} spin />
      </motion.div>

      <motion.img
        src={asset('logo.png')} alt="PYREXIA"
        className="mt-6 w-64 drop-shadow-[4px_6px_0_rgba(42,32,24,0.2)]"
        initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4, duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}
      />

      <p className="mt-4 font-hand text-2xl text-ink/80">Charting the course…</p>

      <div className="sticker-sm mt-4 h-4 w-52 overflow-hidden rounded-full bg-cream">
        <motion.div className="h-full bg-coral" initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: total * 0.9, ease: 'easeInOut' }} />
      </div>
      <p className="mt-3 font-display text-sm text-ink/70">{SITE.theme}</p>
    </motion.div>
  )
}
