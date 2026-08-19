import { motion, useMotionValue, useReducedMotion, useSpring, type Variants } from 'framer-motion'
import { useRef, type MouseEvent, type ReactNode } from 'react'

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
export function Compass({ size = 120, className = '', spin = true }: { size?: number; className?: string; spin?: boolean }) {
  const reduce = useReducedMotion()
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Compass"
    >
      <defs>
        <radialGradient id="cface" cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor="#12303a" />
          <stop offset="100%" stopColor="#06141b" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="94" fill="url(#cface)" stroke="#c89b3c" strokeWidth="1.4" opacity="0.95" />
      <circle cx="100" cy="100" r="80" fill="none" stroke="#c89b3c" strokeWidth="0.6" opacity="0.5" />
      {/* tick marks */}
      <g className={spin && !reduce ? 'anim-spin-slow' : ''} style={{ transformOrigin: '100px 100px' }}>
        {Array.from({ length: 72 }).map((_, i) => {
          const a = (i * 5 * Math.PI) / 180
          const major = i % 9 === 0
          const r1 = major ? 68 : 74
          const r2 = 80
          return (
            <line
              key={i}
              x1={100 + r1 * Math.cos(a)}
              y1={100 + r1 * Math.sin(a)}
              x2={100 + r2 * Math.cos(a)}
              y2={100 + r2 * Math.sin(a)}
              stroke="#c89b3c"
              strokeWidth={major ? 1.6 : 0.6}
              opacity={major ? 0.9 : 0.4}
            />
          )
        })}
      </g>
      {/* cardinal letters */}
      {[
        ['N', 100, 34],
        ['E', 166, 104],
        ['S', 100, 174],
        ['W', 34, 104],
      ].map(([l, x, y]) => (
        <text
          key={l as string}
          x={x as number}
          y={y as number}
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily="Cinzel, serif"
          fontSize="13"
          fill="#e6c25e"
        >
          {l}
        </text>
      ))}
      {/* needle */}
      <g style={{ transformOrigin: '100px 100px' }} className={reduce ? '' : 'anim-float'}>
        <polygon points="100,44 108,100 100,110 92,100" fill="#b1341f" />
        <polygon points="100,156 108,100 100,90 92,100" fill="#e8d5ae" />
        <circle cx="100" cy="100" r="6" fill="#0b2029" stroke="#c89b3c" strokeWidth="1.5" />
      </g>
    </svg>
  )
}

/* ---------- Magnetic button — nudges toward the cursor on hover ---------- */
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
    'font-accent group relative inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-[0.9rem] uppercase tracking-wide2 transition-colors duration-300'
  const styles =
    variant === 'solid'
      ? 'bg-gradient-to-b from-gold-bright to-gold-deep text-abyss shadow-[0_18px_40px_-18px_rgba(200,155,60,0.8)] hover:from-gold hover:to-gold-deep'
      : 'text-parchment ring-1 ring-gold/40 hover:ring-gold hover:text-gold-bright'
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
