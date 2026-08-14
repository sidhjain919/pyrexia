import { motion, useReducedMotion } from 'framer-motion'
import { StaggerWords } from './primitives'

/** Cinematic page banner with a real photo, parchment eyebrow and title. */
export default function PageHeader({
  eyebrow,
  title,
  kicker,
  photo,
}: {
  eyebrow: string
  title: string
  kicker?: string
  photo: string
}) {
  const reduce = useReducedMotion()
  return (
    <header className="grain relative flex min-h-[62vh] items-end overflow-hidden pb-14 pt-32 sm:min-h-[68vh] sm:pb-20">
      {/* photo */}
      <motion.img
        src={photo}
        alt=""
        initial={reduce ? false : { scale: 1.12 }}
        animate={{ scale: 1 }}
        transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-abyss via-abyss/75 to-abyss/40" />
      <div className="absolute inset-0 bg-gradient-to-r from-abyss/70 to-transparent" />
      <div className="map-grid pointer-events-none absolute inset-0 opacity-20" />

      <div className="relative mx-auto w-full max-w-6xl px-6">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex items-center gap-3 font-log text-[0.66rem] uppercase tracking-cinema text-gold/80"
        >
          <span className="h-px w-10 bg-gold/50" />
          {eyebrow}
        </motion.div>
        <h1 className="mt-4 font-display text-5xl leading-[0.95] text-offwhite sm:text-7xl">
          <StaggerWords text={title} />
        </h1>
        {kicker && (
          <motion.p
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-5 max-w-xl text-[0.98rem] leading-relaxed text-parchment/75"
          >
            {kicker}
          </motion.p>
        )}
      </div>
    </header>
  )
}
