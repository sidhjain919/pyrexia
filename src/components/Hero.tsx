import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, ChevronDown } from 'lucide-react'
import OceanScene from './OceanScene'
import { Compass } from './art'
import { asset } from '../lib/asset'
import { SITE } from '../data/site'
import { useRegistration } from './../registration/context'
import { useNavTo } from './routing'

export default function Hero() {
  const scope = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()
  const { openRegister } = useRegistration()
  const navTo = useNavTo()

  useEffect(() => {
    if (reduce) return
    const el = scope.current
    if (!el) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    const layers = Array.from(el.querySelectorAll<HTMLElement>('.parallax-layer'))
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0
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
      tx = (e.clientX / window.innerWidth - 0.5) * -1.6
      ty = (e.clientY / window.innerHeight - 0.5) * -1.1
    }
    window.addEventListener('mousemove', onMove)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('mousemove', onMove) }
  }, [reduce])

  const pop = {
    hidden: { opacity: 0, y: 40, scale: 0.8 },
    show: (i: number) => ({
      opacity: 1, y: 0, scale: 1,
      transition: { delay: 0.12 * i + 0.2, duration: 0.7, ease: [0.34, 1.56, 0.64, 1] as const },
    }),
  }

  return (
    <section id="home" ref={scope} className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden">
      <OceanScene />

      {/* compass badge */}
      <div className="parallax-layer pointer-events-none absolute left-[6%] top-[16%] hidden anim-wobble sm:block" data-depth="3">
        <Compass size={92} spin />
      </div>

      <div className="relative z-10 flex flex-col items-center px-5 text-center">
        <motion.p custom={0} variants={pop} initial="hidden" animate="show" className="font-hand text-2xl text-ink/80 sm:text-3xl">
          {SITE.institution} proudly presents
        </motion.p>

        {/* Logo */}
        <motion.img
          custom={1}
          variants={pop}
          initial="hidden"
          animate="show"
          src={asset('logo.png')}
          alt="PYREXIA"
          className="mt-2 w-[min(88vw,760px)] drop-shadow-[6px_8px_0_rgba(42,32,24,0.18)]"
        />

        {/* Theme ribbon */}
        <motion.div custom={2} variants={pop} initial="hidden" animate="show" className="-mt-2 sm:-mt-4">
          <span className="sticker inline-block rounded-full bg-red px-6 py-2 font-display text-lg tracking-wide text-cream sm:text-2xl" style={{ rotate: '-2deg' }}>
            Pirates of the Lost Island
          </span>
        </motion.div>

        <motion.p custom={3} variants={pop} initial="hidden" animate="show" className="mt-6 max-w-md font-fun text-lg font-medium text-ink/80">
          The island has been found. Grab your crew, follow the map, and set sail — your voyage begins here!
        </motion.p>

        <motion.div custom={4} variants={pop} initial="hidden" animate="show" className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <button
            onClick={() => openRegister()}
            data-cursor="AHOY"
            className="sticker sticker-press inline-flex items-center gap-2 rounded-full bg-coral px-8 py-3.5 font-display text-lg text-cream"
          >
            Join the Crew
            <ArrowRight size={20} strokeWidth={3} />
          </button>
          <button
            onClick={() => navTo('/events')}
            data-cursor="EXPLORE"
            className="sticker sticker-press inline-flex items-center gap-2 rounded-full bg-sun px-8 py-3.5 font-display text-lg text-ink"
          >
            Explore the Island
          </button>
        </motion.div>
      </div>

      {/* meta strip */}
      <motion.div custom={5} variants={pop} initial="hidden" animate="show" className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-4 font-hand text-xl text-ink/70">
        <span>{SITE.window}</span>
        <span className="h-4 w-1 rounded-full bg-ink/30" />
        <span>The Sixth Voyage</span>
      </motion.div>

      {/* scroll cue */}
      <motion.a
        href="#legend"
        aria-label="Scroll down"
        className="absolute bottom-5 right-5 z-10 hidden h-11 w-11 items-center justify-center rounded-full bg-cream text-ink sticker sm:flex"
        animate={reduce ? undefined : { y: [0, 7, 0] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <ChevronDown size={22} strokeWidth={3} />
      </motion.a>
    </section>
  )
}
