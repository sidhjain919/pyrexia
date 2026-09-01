import { useEffect, useRef, useState } from 'react'
import { useInView, useReducedMotion } from 'framer-motion'
import { VOYAGE_STATS } from '../data/site'
import { Reveal } from './primitives'

function CountUp({ value, suffix }: { value: string; suffix: string }) {
  const target = parseInt(value, 10)
  const ref = useRef<HTMLSpanElement>(null)
  // `amount` (a visibility threshold), never a percentage `margin`. Safari's
  // IntersectionObserver rejects a percentage rootMargin, which is what a
  // `margin: '-20%'` compiles to — so on some iPads the observer never fired,
  // `inView` stayed false, and the number sat at 0 forever. A threshold uses no
  // rootMargin and fires everywhere.
  const inView = useInView(ref, { once: true, amount: 0.3 })
  const reduce = useReducedMotion()
  const [n, setN] = useState(reduce ? target : 0)

  useEffect(() => {
    if (reduce) {
      setN(target)
      return
    }
    if (!inView) return
    let raf = 0
    const start = performance.now()
    const dur = 1400
    const tick = (t: number) => {
      const p = Math.min((t - start) / dur, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setN(Math.round(eased * target))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, target, reduce])

  // Belt and braces: if the observer somehow never reports this element as
  // visible (an old engine, a resize race), the real number still lands rather
  // than showing a permanent 0. Only rescues a value that ought to be on screen
  // already — anything still below the fold is left to animate when reached.
  useEffect(() => {
    if (reduce || target === 0) return
    const t = window.setTimeout(() => {
      const el = ref.current
      if (el && el.getBoundingClientRect().top < window.innerHeight) {
        setN((cur) => (cur === 0 ? target : cur))
      }
    }, 2600)
    return () => window.clearTimeout(t)
  }, [target, reduce])

  return (
    <span ref={ref} className="font-display text-foil text-5xl font-semibold sm:text-6xl">
      {n}
      <span className="text-3xl sm:text-4xl">{suffix}</span>
    </span>
  )
}

export default function Stats() {
  return (
    <section className="relative overflow-hidden border-y border-gold/10 py-12">
      <div className="map-grid pointer-events-none absolute inset-0 opacity-20" />
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <div className="mb-10 text-center font-log text-[0.62rem] uppercase tracking-cinema text-gold/60">
            The Previous Voyage · PYREXIA in numbers
          </div>
        </Reveal>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {VOYAGE_STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.08} className="text-center">
              <CountUp value={s.value} suffix={s.suffix} />
              <p className="mt-3 text-[0.8rem] leading-snug text-parchment/60">{s.label}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
