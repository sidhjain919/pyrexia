import { motion, useMotionValue, useReducedMotion, useSpring, type Variants } from 'framer-motion'
import { useRef, type MouseEvent, type ReactNode } from 'react'

import { art } from '../lib/art'

/* ---------- Scroll reveal ---------- */
export function Reveal({
  children,
  delay = 0,
  y = 26,
  className,
  as = 'div',
}: {
  children: ReactNode
  delay?: number
  y?: number
  className?: string
  as?: 'div' | 'section' | 'li' | 'span'
}) {
  const reduce = useReducedMotion()
  const MotionTag = motion[as]
  return (
    <MotionTag
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-12% 0px' }}
      transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </MotionTag>
  )
}

/* ---------- Word-by-word title stagger ---------- */
const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
}
const word: Variants = {
  hidden: { opacity: 0, y: '0.4em' },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } },
}

export function StaggerWords({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const reduce = useReducedMotion()
  if (reduce) return <span className={className}>{text}</span>
  return (
    <motion.span
      className={className}
      style={{ display: 'inline-block' }}
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true }}
    >
      {text.split(' ').map((w, i) => (
        <span key={i} style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'top' }}>
          <motion.span variants={word} style={{ display: 'inline-block' }}>
            {w}&nbsp;
          </motion.span>
        </span>
      ))}
    </motion.span>
  )
}

/* ---------- Section eyebrow + heading ---------- */
export function SectionTitle({
  index,
  eyebrow,
  title,
  meaning,
  align = 'left',
  kicker,
  eyebrowFont = 'log',
}: {
  index?: string
  eyebrow: string
  title: string
  /** Plain-English translation of a slang title, e.g. "SCHEDULE" for "Captain's Log". */
  meaning?: string
  align?: 'left' | 'center'
  kicker?: string
  /** 'log' (typewriter) reads well at this size; 'plain' swaps to the display serif for sections where it doesn't. */
  eyebrowFont?: 'log' | 'plain'
}) {
  return (
    <div className={align === 'center' ? 'text-center' : ''}>
      <Reveal>
        <div
          className={`flex items-center gap-3 text-[0.7rem] uppercase tracking-cinema text-gold/80 ${
            eyebrowFont === 'log' ? 'font-log' : 'font-display'
          } ${align === 'center' ? 'justify-center' : ''}`}
        >
          {index && <span className="font-accent text-gold/50">{index}</span>}
          <span className="h-px w-8 bg-gold/40" />
          <span>{eyebrow}</span>
        </div>
      </Reveal>
      <Reveal delay={0.05}>
        <h2 className="font-display mt-4 text-4xl leading-[0.98] tracking-tight text-offwhite sm:text-5xl md:text-6xl">
          <StaggerWords text={title} />
        </h2>
      </Reveal>
      {meaning && (
        <Reveal delay={0.08}>
          <div
            className={`mt-3 flex items-center gap-2.5 ${align === 'center' ? 'justify-center' : ''}`}
          >
            <span className="h-px w-5 bg-coral/50" />
            <span className="font-accent text-[0.8rem] uppercase tracking-wide2 text-coral/85 sm:text-[0.88rem]">
              {meaning}
            </span>
            <span className="h-px w-5 bg-coral/50" />
          </div>
        </Reveal>
      )}
      {kicker && (
        <Reveal delay={0.12}>
          <p
            className={`mt-4 max-w-xl text-[0.98rem] leading-relaxed text-parchment/70 ${
              align === 'center' ? 'mx-auto' : ''
            }`}
          >
            {kicker}
          </p>
        </Reveal>
      )}
    </div>
  )
}

/* ---------- Compass artifact ---------- */
export function Compass({
  size = 120,
  spin = true,
  className = '',
}: {
  size?: number
  spin?: boolean
  className?: string
}) {
  const reduce = useReducedMotion()
  return (
    <motion.img
      src={art.compass}
      alt=""
      aria-hidden
      loading="lazy"
      decoding="async"
      width={size}
      height={size}
      className={`select-none object-contain ${className}`}
      style={{ width: size, height: size }}
      animate={spin && !reduce ? { rotate: 360 } : undefined}
      transition={{ duration: 90, repeat: Infinity, ease: 'linear' }}
    />
  )
}

export function MagneticButton({
  children,
  href,
  variant = 'solid',
  className = '',
  onClick,
  dataCursor = 'ENTER',
}: {
  children: ReactNode
  href?: string
  variant?: 'solid' | 'ghost'
  className?: string
  onClick?: () => void
  dataCursor?: string
}) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLAnchorElement & HTMLButtonElement>(null)
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const x = useSpring(mx, { stiffness: 200, damping: 14, mass: 0.4 })
  const y = useSpring(my, { stiffness: 200, damping: 14, mass: 0.4 })

  const onMouseMove = (e: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
    if (reduce || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    mx.set((e.clientX - (r.left + r.width / 2)) * 0.35)
    my.set((e.clientY - (r.top + r.height / 2)) * 0.35)
  }
  const onMouseLeave = () => {
    mx.set(0)
    my.set(0)
  }

  const base =
    'font-accent group relative inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-[0.82rem] uppercase tracking-wide2 transition-colors duration-300 sm:px-7 sm:py-3.5 sm:text-[0.9rem]'
  const styles =
    variant === 'solid'
      ? 'bg-gradient-to-b from-gold-bright to-gold-deep text-abyss shadow-[0_18px_40px_-18px_rgba(200,155,60,0.8)] hover:from-gold hover:to-gold-deep'
      : 'text-parchment ring-1 ring-inset ring-gold/40 hover:ring-gold hover:text-gold-bright'
  const MotionCmp = motion[href ? 'a' : 'button']
  return (
    <MotionCmp
      ref={ref}
      href={href}
      onClick={onClick}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{ x, y }}
      data-cursor={dataCursor}
      className={`${base} ${styles} ${className}`}
    >
      {children}
    </MotionCmp>
  )
}
