import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, ChevronDown, Ticket } from 'lucide-react'
import OceanScene from './OceanScene'
import { Compass, MagneticButton } from './primitives'
import { SITE } from '../data/site'
import { asset } from '../lib/asset'
import { useRegistration } from '../registration/context'
import { passCta, useEntitlement } from '../registration/useEntitlement'

export default function Hero() {
  const scope = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()
  const { openRegister } = useRegistration()
  // The hero's primary button offers the next thing somebody needs, not the
  // first thing: a delegate who already holds the Festival Pass is shown the
  // way to their pass rather than invited to buy it again.
  const { state } = useEntitlement()
  const cta = passCta(state)

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
      /* Padded clear of the measured header at every width, with the title
         block centred in whatever is left by `my-auto` rather than by
         `justify-center`. An auto margin collapses to zero when the space runs
         out; `justify-center` overflows both ways, which is how the
         announcement pill ended up printed across "AIIMS RISHIKESH PRESENTS"
         on any screen shorter than about 800px. */
      className="grain relative flex min-h-[100svh] flex-col items-center overflow-hidden pb-16 pt-[calc(var(--header-h,7rem)+1rem)] sm:pb-20 sm:pt-[calc(var(--header-h,7rem)+1.5rem)]"
    >
      <OceanScene />

      {/* faint compass, top-right: desktop only (crowds the title on mobile) */}
      <div className="parallax-layer pointer-events-none absolute right-10 top-32 hidden opacity-[0.12] sm:block lg:right-16" data-depth="3">
        <Compass size={168} />
      </div>

      {/* Phone-only scrim behind the type. The island ridge runs straight
          through this band at 390px wide, and letterforms over a silhouette
          are the whole reason the mobile hero read as cluttered. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-[4] h-[74%] sm:hidden"
        style={{ background: 'radial-gradient(120% 58% at 50% 40%, rgba(3,11,15,0.72) 30%, rgba(3,11,15,0.42) 62%, transparent 100%)' }}
      />

      {/* vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(120% 80% at 50% 44%, transparent 40%, rgba(3,11,15,0.75) 100%)' }}
      />

      {/* bottom scrim: the meta strip sits over the drifting wave rows, and the
          strokes cut straight through the type without it */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-16 sm:h-44"
        style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(3,11,15,0.45) 45%, rgba(3,11,15,0.85) 100%)' }}
      />

      {/* Title block */}
      <div className="relative z-10 my-auto flex flex-col items-center px-6 text-center">
        <motion.p
          custom={0}
          variants={rise}
          initial="hidden"
          animate="show"
          className="font-log text-xs uppercase tracking-cinema text-parchment/85 [text-shadow:0_2px_14px_rgba(3,11,15,0.95)] sm:text-sm"
        >
          {SITE.institution} · presents
        </motion.p>

        {/* Real PYREXIA logo, spotlit out of the dark */}
        <motion.div
          custom={1}
          variants={rise}
          initial="hidden"
          animate="show"
          className="relative mt-5 flex items-center justify-center sm:mt-8"
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
            /* Capped by height as well as width at every size, not just on a
               phone. The width rule alone draws it 287px tall, which on a
               720px-tall laptop pushed the dates off the bottom of the frame;
               `svh` gives the cap back to whatever screen is actually there
               and does nothing at all on a tall one. */
            className="anim-float relative max-h-[20svh] w-[min(58vw,400px)] object-contain sm:max-h-[34svh]"
            style={{ filter: 'drop-shadow(0 10px 26px rgba(0,0,0,0.5))' }}
          />
        </motion.div>

        {/* theme + year line */}
        <motion.div
          custom={2}
          variants={rise}
          initial="hidden"
          animate="show"
          className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 sm:mt-6"
        >
          <span className="hidden h-px w-8 bg-gold/50 sm:block sm:w-14" />
          {/* Tracking loosens only from sm up: at 390px the wide setting broke
              this into two rows, and the second row was costing the ship the
              band it needed at the bottom of the frame. */}
          <span className="font-display whitespace-nowrap text-[0.72rem] uppercase tracking-[0.14em] text-parchment/90 [text-shadow:0_2px_12px_rgba(3,11,15,0.9)] sm:text-base sm:tracking-[0.32em]">
            Pirates of the Lost Island
          </span>
          <span className="flex items-center gap-2 sm:gap-3">
            <span className="text-gold-bright">·</span>
            <span className="font-display text-[0.72rem] tracking-[0.2em] text-gold-bright sm:text-base sm:tracking-[0.3em]">2026</span>
          </span>
          <span className="hidden h-px w-8 bg-gold/50 sm:block sm:w-14" />
        </motion.div>

        <motion.p
          custom={2.5}
          variants={rise}
          initial="hidden"
          animate="show"
          className="mt-3.5 max-w-md text-[0.86rem] leading-relaxed text-parchment/80 [text-shadow:0_2px_12px_rgba(3,11,15,0.95)] sm:mt-7 sm:text-[0.95rem]"
        >
          The island has been lost. The treasure is waiting.
          <br className="hidden sm:block" /> Your voyage begins here.
        </motion.p>

        <motion.div
          custom={3}
          variants={rise}
          initial="hidden"
          animate="show"
          className="mt-5 flex w-full max-w-[17rem] flex-col items-center gap-2 sm:mt-9 sm:w-auto sm:max-w-none sm:flex-row sm:gap-3"
        >
          {cta.action === 'register' ? (
            <MagneticButton onClick={() => openRegister()} dataCursor="JOIN">
              <Ticket size={16} />
              {cta.label}
            </MagneticButton>
          ) : (
            <MagneticButton href={cta.to ?? '/pass'} dataCursor="PASS">
              <Ticket size={16} />
              {/* "Upgrade to Festival Pass" wraps to two lines in the
                  full-width phone button. A shorter label on mobile keeps it on
                  one line; the full wording returns from `sm` up. */}
              {state === 'basic' ? (
                <>
                  <span className="sm:hidden">Get Festival Pass</span>
                  <span className="hidden sm:inline">{cta.label}</span>
                </>
              ) : (
                cta.label
              )}
            </MagneticButton>
          )}
          <MagneticButton href="#legend" variant="ghost" dataCursor="ENTER" className="group">
            Enter the Island
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
          </MagneticButton>
        </motion.div>
      </div>

      {/* meta strip: in normal flow on mobile so it can't collide with the buttons above; floats at the true bottom from sm up */}
      <motion.div
        custom={4}
        variants={rise}
        initial="hidden"
        animate="show"
        /* Pinned to the bottom at every width. In normal flow on mobile it ate
           the band the ship needs; down here the only thing under it is the
           water it is printed on. The dates are longer than the old
           "October 2026", so mobile tracking tightens to hold one line. */
        className="absolute inset-x-0 bottom-4 z-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 px-4 font-log text-[0.6rem] uppercase tracking-[0.12em] text-parchment/85 [text-shadow:0_2px_12px_rgba(3,11,15,0.95)] sm:bottom-10 sm:gap-x-6 sm:px-6 sm:text-sm sm:tracking-cinema"
      >
        <span className="whitespace-nowrap text-gold-bright">{SITE.dates}</span>
        <span className="h-4 w-px bg-gold/40" />
        <span className="hidden sm:inline">30°06′N&nbsp;·&nbsp;78°16′E</span>
        <span className="hidden h-4 w-px bg-gold/40 sm:block" />
        <span className="whitespace-nowrap">{SITE.edition}</span>
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
