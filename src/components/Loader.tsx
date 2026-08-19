import { motion, useReducedMotion } from 'framer-motion'
import { Compass } from './primitives'
import { SITE } from '../data/site'
import { asset } from '../lib/asset'

/**
 * Branded loading sequence: a compass settles, the wordmark unfolds, then the
 * curtain lifts to reveal the hero.
 */
export default function Loader({ onDone }: { onDone: () => void }) {
  const reduce = useReducedMotion()
  const total = reduce ? 0.2 : 2.6

  return (
    <motion.div
      className="grain fixed inset-0 z-[10000] flex flex-col items-center justify-center overflow-hidden bg-abyss"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.8, ease: 'easeInOut' } }}
      onAnimationComplete={() => {
        window.setTimeout(onDone, total * 1000)
      }}
    >
      <div className="map-grid pointer-events-none absolute inset-0 opacity-40" />

      <motion.div
        initial={{ opacity: 0, scale: 0.85, rotate: -30 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
      >
        <Compass size={132} />
      </motion.div>

      <motion.div
        className="relative mt-8"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      >
        <img src={asset('logo-wordmark.webp')} alt="PYREXIA 2026" className="relative w-72 drop-shadow-[0_10px_24px_rgba(0,0,0,0.5)] sm:w-96" />
      </motion.div>

      <motion.p
        className="mt-3 font-log text-[0.62rem] uppercase tracking-cinema text-parchment/70"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.8 }}
      >
        {SITE.theme}
      </motion.p>

      {/* loading rule */}
      <div className="mt-8 h-px w-40 overflow-hidden bg-gold/15 sm:w-56">
        <motion.div
          className="h-full bg-gradient-to-r from-transparent via-gold-bright to-transparent"
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      <p className="mt-4 font-log text-[0.72rem] uppercase tracking-cinema text-gold/65">
        Charting the course…
      </p>
    </motion.div>
  )
}
