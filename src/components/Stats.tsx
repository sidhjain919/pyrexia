import { useEffect, useRef, useState } from 'react'
import { useInView, useReducedMotion } from 'framer-motion'
import { VOYAGE_STATS } from '../data/site'
import { Reveal } from './primitives'
import { SeaBand } from './art'

function CountUp({ value, suffix }: { value: string; suffix: string }) {
  const target = parseInt(value, 10)
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-20%' })
  const reduce = useReducedMotion()
  const [n, setN] = useState(reduce ? target : 0)
  useEffect(() => {
    if (!inView || reduce) return
    let raf = 0; const start = performance.now(); const dur = 1300
    const tick = (t: number) => {
      const p = Math.min((t - start) / dur, 1)
      setN(Math.round((1 - Math.pow(1 - p, 3)) * target))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, target, reduce])
  return (
    <span ref={ref} className="font-display text-6xl text-sun sm:text-7xl title-stroke">{n}<span className="text-4xl">{suffix}</span></span>
  )
}

export default function Stats() {
  return (
    <section className="relative overflow-hidden bg-sea pt-14 pb-16">
      <SeaBand className="absolute -top-1 left-0 h-6 w-full rotate-180" style={{ transform: 'scaleY(-1)' }} />
      <div className="map-dots pointer-events-none absolute inset-0 opacity-20" />
      <div className="relative mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="mb-9 text-center font-hand text-3xl text-foam">Our previous voyage, in numbers…</p>
        </Reveal>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {VOYAGE_STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.08} className="text-center">
              <CountUp value={s.value} suffix={s.suffix} />
              <p className="mt-2 font-fun text-base font-semibold text-cream">{s.label}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
