import { motion, useReducedMotion, type Variants } from 'framer-motion'
import type { ReactNode } from 'react'
import { Sunburst } from './art'

export { Compass } from './art'

/* ---------- Scroll reveal (pops up with a bounce) ---------- */
export function Reveal({
  children, delay = 0, y = 28, className, as = 'div',
}: {
  children: ReactNode; delay?: number; y?: number; className?: string
  as?: 'div' | 'section' | 'li' | 'span'
}) {
  const reduce = useReducedMotion()
  const MotionTag = motion[as]
  return (
    <MotionTag
      className={className}
      initial={reduce ? false : { opacity: 0, y, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-10% 0px' }}
      transition={{ duration: 0.7, delay, ease: [0.34, 1.56, 0.64, 1] }}
    >
      {children}
    </MotionTag>
  )
}

/* ---------- Word-by-word title ---------- */
const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } }
const word: Variants = {
  hidden: { opacity: 0, y: '0.5em', rotate: -4 },
  show: { opacity: 1, y: 0, rotate: 0, transition: { duration: 0.6, ease: [0.34, 1.56, 0.64, 1] } },
}
export function StaggerWords({ text, className }: { text: string; className?: string }) {
  const reduce = useReducedMotion()
  if (reduce) return <span className={className}>{text}</span>
  return (
    <motion.span className={className} style={{ display: 'inline-block' }} variants={container} initial="hidden" whileInView="show" viewport={{ once: true }}>
      {text.split(' ').map((w, i) => (
        <span key={i} style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'top' }}>
          <motion.span variants={word} style={{ display: 'inline-block' }}>{w}&nbsp;</motion.span>
        </span>
      ))}
    </motion.span>
  )
}

/* ---------- Section eyebrow + heading ---------- */
export function SectionTitle({
  eyebrow, title, align = 'left', kicker, color = 'var(--color-ink)',
}: {
  index?: string; eyebrow: string; title: string
  align?: 'left' | 'center'; kicker?: string; color?: string
}) {
  return (
    <div className={align === 'center' ? 'text-center' : ''}>
      <Reveal>
        <div className={`flex items-center gap-3 ${align === 'center' ? 'justify-center' : ''}`}>
          <Sunburst size={34} className="anim-spin-slow shrink-0" />
          <span className="sticker-sm inline-block rounded-full bg-sun px-4 py-1 font-fun text-sm font-bold uppercase tracking-wide2 text-ink">
            {eyebrow}
          </span>
        </div>
      </Reveal>
      <Reveal delay={0.05}>
        <h2 className="font-display mt-4 text-4xl leading-[1.05] sm:text-5xl md:text-6xl" style={{ color }}>
          <StaggerWords text={title} />
        </h2>
      </Reveal>
      {kicker && (
        <Reveal delay={0.12}>
          <p className={`mt-4 max-w-xl font-fun text-lg leading-relaxed text-ink/70 ${align === 'center' ? 'mx-auto' : ''}`}>
            {kicker}
          </p>
        </Reveal>
      )}
    </div>
  )
}

/* ---------- Sticker button ---------- */
export function MagneticButton({
  children, href, color = 'coral', className = '', onClick, dataCursor = 'GO',
}: {
  children: ReactNode; href?: string; color?: 'coral' | 'sun' | 'sea' | 'cream'
  className?: string; onClick?: () => void; dataCursor?: string
}) {
  const bg = { coral: 'bg-coral text-cream', sun: 'bg-sun text-ink', sea: 'bg-sea text-cream', cream: 'bg-cream text-ink' }[color]
  const Cmp: 'a' | 'button' = href ? 'a' : 'button'
  return (
    <Cmp href={href} onClick={onClick} data-cursor={dataCursor}
      className={`sticker sticker-press inline-flex items-center justify-center gap-2 rounded-full px-7 py-3 font-display text-base ${bg} ${className}`}>
      {children}
    </Cmp>
  )
}
