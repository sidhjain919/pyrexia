import { motion, useReducedMotion, useScroll, useSpring } from 'framer-motion'

/**
 * A fixed voyage line down the left edge of the page — a small ship glides
 * along it as you scroll, so navigating the site itself feels like sailing
 * from the top of the chart to the bottom.
 */
export default function VoyageProgress() {
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 90, damping: 24, mass: 0.4 })

  if (reduce) return null

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-4 top-0 z-[850] hidden h-svh py-24 lg:block xl:left-6"
    >
      <div className="relative h-full w-px">
        {/* track */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gold/15 to-transparent" />
        {/* sailed distance */}
        <motion.div
          className="absolute inset-x-0 top-0 origin-top bg-gradient-to-b from-gold-bright/70 to-gold/25"
          style={{ scaleY: progress, height: '100%' }}
        />
        {/* the ship, riding the progress */}
        <motion.div
          className="absolute left-1/2 -translate-x-1/2"
          style={{ top: progress, y: '-50%' }}
        >
          <svg width="16" height="16" viewBox="-6 -6 12 12" className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
            <path d="M -3.4,0.2 L 3.4,0.2 L 2.2,2 L -2.2,2 Z" fill="#e6c25e" stroke="#4a330f" strokeWidth="0.3" />
            <path d="M 0,0.2 L 0,-4.4" stroke="#4a330f" strokeWidth="0.35" />
            <path d="M 0.15,-4.1 L 2.7,-1.6 L 0.15,-0.4 Z" fill="#f4efe3" />
          </svg>
        </motion.div>
      </div>
    </div>
  )
}
