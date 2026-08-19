import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, ChevronDown } from 'lucide-react'
import OceanScene from './OceanScene'
import { Compass } from './primitives'
import { SITE } from '../data/site'
import { asset } from '../lib/asset'

export default function Hero() {
  const scope = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()

  // Mouse parallax across depth layers
  useEffect(() => {
    if (reduce) return
    const el = scope.current
    if (!el) return
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    if (!fine) return

    const layers = Array.from(el.querySelectorAll<HTMLElement>('.parallax-layer'))
    let tx = 0
    let ty = 0
    let cx = 0
    let cy = 0
    let raf = 0

    const loop = () => {
      cx += (tx - cx) * 0.08
      cy += (ty - cy) * 0.08
      for (const l of layers) {
        const d = Number(l.dataset.depth ?? 8)
        l.style.transform = `translate3d(${cx * d}px, ${cy * d}px, 0)`
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const onMove = (e: MouseEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * -2
      ty = (e.clientY / window.innerHeight - 0.5) * -1.4
    }
    window.addEventListener('mousemove', onMove)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMove)
    }
  }, [reduce])

  const rise = {
    hidden: { opacity: 0, y: 34 },
    show: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: 0.15 * i + 0.2, duration: 1, ease: [0.16, 1, 0.3, 1] as const },
    }),
  }

  return (
    <section
      id="home"
      ref={scope}
      className="grain relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden"
    >
      <OceanScene />

      {/* faint compass, top-right — desktop only (crowds the title on mobile) */}
      <div className="parallax-layer pointer-events-none absolute right-10 top-32 hidden opacity-[0.12] sm:block lg:right-16" data-depth="3">
        <Compass size={168} />
      </div>

      {/* vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(120% 80% at 50% 44%, transparent 40%, rgba(3,11,15,0.75) 100%)' }}
      />

      {/* Title block */}
      <div className="relative z-10 flex flex-col items-center px-6 text-center">
        <motion.p
          custom={0}
          variants={rise}
          initial="hidden"
          animate="show"
          className="font-log text-xs uppercase tracking-cinema text-parchment/70 sm:text-sm"
        >
          {SITE.institution} · presents
        </motion.p>

        {/* Real PYREXIA logo, spotlit out of the dark */}
        <motion.div
          custom={1}
          variants={rise}
          initial="hidden"
          animate="show"
          className="relative mt-7 flex items-center justify-center sm:mt-8"
        >
          {/* soft dark halo so the wordmark pops off the scene */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 -z-0 h-[130%] w-[122%] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ background: 'radial-gradient(closest-side, rgba(3,11,15,0.6), rgba(3,11,15,0.25) 55%, transparent 75%)', filter: 'blur(10px)' }}
          />
          <img
            src={asset('logo-full.webp')}
            alt="PYREXIA 2026"
            className="anim-float relative w-[min(58vw,400px)]"
            style={{ filter: 'drop-shadow(0 10px 26px rgba(0,0,0,0.5))' }}
          />
        </motion.div>

        {/* theme + year line */}
        <motion.div
          custom={2}
          variants={rise}
          initial="hidden"
          animate="show"
          className="mt-6 flex items-center gap-4"
        >
          <span className="h-px w-8 bg-gold/50 sm:w-14" />
          <span className="font-display text-sm uppercase tracking-[0.32em] text-parchment/90 sm:text-base">
            Pirates of the Lost Island
          </span>
          <span className="text-gold-bright">·</span>
          <span className="font-display text-sm tracking-[0.3em] text-gold-bright sm:text-base">2026</span>
          <span className="h-px w-8 bg-gold/50 sm:w-14" />
        </motion.div>

        <motion.p
          custom={2.5}
          variants={rise}
          initial="hidden"
          animate="show"
          className="mt-7 max-w-md text-[0.95rem] leading-relaxed text-parchment/70"
        >
          The island has been lost. The treasure is waiting.
          <br className="hidden sm:block" /> Your voyage begins here.
        </motion.p>

        <motion.div
          custom={3}
          variants={rise}
          initial="hidden"
          animate="show"
          className="mt-9 flex flex-col items-center gap-3 sm:flex-row"
        >
          <a
            href="#legend"
            data-cursor="ENTER"
            className="font-accent group inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep px-8 py-4 text-[0.9rem] uppercase tracking-wide2 text-abyss transition-transform hover:scale-[1.04]"
          >
            Enter the Island
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
          </a>
          <a
            href="#island"
            data-cursor="EXPLORE"
            className="font-accent inline-flex items-center gap-2 rounded-full px-7 py-4 text-[0.9rem] uppercase tracking-wide2 text-parchment ring-1 ring-gold/40 transition-colors hover:text-gold-bright hover:ring-gold"
          >
            Explore PYREXIA
          </a>
        </motion.div>
      </div>

      {/* meta strip */}
      <motion.div
        custom={4}
        variants={rise}
        initial="hidden"
        animate="show"
        className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 items-center gap-6 font-log text-[0.78rem] uppercase tracking-cinema text-parchment/70 sm:text-sm"
      >
        <span>{SITE.window}</span>
        <span className="h-4 w-px bg-gold/40" />
        <span className="hidden sm:inline">30°06′N&nbsp;·&nbsp;78°16′E</span>
        <span className="hidden h-4 w-px bg-gold/40 sm:block" />
        <span>{SITE.edition}</span>
      </motion.div>

      {/* scroll cue */}
      <motion.a
        href="#legend"
        aria-label="Scroll to begin"
        className="absolute bottom-8 right-6 z-10 hidden flex-col items-center gap-2 text-gold/60 sm:flex"
        animate={reduce ? undefined : { y: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <span className="font-log text-[0.7rem] uppercase tracking-cinema [writing-mode:vertical-rl]">
          Set sail
        </span>
        <ChevronDown size={16} />
      </motion.a>
    </section>
  )
}
