import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { Compass, StaggerWords } from './primitives'
import { SITE } from '../data/site'
import { sectionPhoto } from '../data/media'
import { useRegistration } from '../registration/context'
import { useNavTo } from './routing'

export default function CTA() {
  const reduce = useReducedMotion()
  const { openRegister } = useRegistration()
  const navTo = useNavTo()
  return (
    <section id="register" className="grain relative overflow-hidden py-20 sm:py-28 lg:py-32">
      {/* photo atmosphere */}
      <img src={sectionPhoto.cta} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />
      <div className="absolute inset-0 bg-gradient-to-b from-abyss via-ocean/90 to-abyss" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(90% 70% at 50% 100%, rgba(200,155,60,0.16), transparent 60%)' }}
      />
      <div className="map-grid pointer-events-none absolute inset-0 opacity-20" />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-0 -translate-x-1/2 -translate-y-1/2 opacity-[0.07]"
        animate={reduce ? undefined : { rotate: 360 }}
        transition={{ duration: 120, repeat: Infinity, ease: 'linear' }}
      >
        <Compass size={520} spin={false} />
      </motion.div>

      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="font-display text-[0.66rem] uppercase tracking-cinema text-gold/70"
        >
          X marks the spot
        </motion.p>

        <h2 className="mt-5 font-display text-4xl leading-[1.02] text-offwhite sm:text-6xl">
          <StaggerWords text="Will you join the voyage?" />
        </h2>

        <motion.p
          initial={reduce ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="mx-auto mt-6 max-w-lg text-[1rem] leading-relaxed text-parchment/70"
        >
          The island awaits. Grab your delegate card, choose your crew, and set sail into the most
          epic edition of PYREXIA yet. The treasure is real — come claim it.
        </motion.p>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.32, duration: 0.8 }}
          className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <button
            onClick={() => openRegister()}
            data-cursor="JOIN"
            className="font-accent group inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep px-9 py-4 text-[0.92rem] uppercase tracking-wide2 text-abyss transition-transform hover:scale-[1.04]"
          >
            Join the Crew
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
          </button>
          <button
            onClick={() => navTo('/#island')}
            data-cursor="EVENTS"
            className="font-accent inline-flex items-center gap-2 rounded-full px-7 py-4 text-[0.92rem] uppercase tracking-wide2 text-parchment ring-1 ring-inset ring-gold/40 transition-colors hover:text-gold-bright hover:ring-gold"
          >
            Explore Events
          </button>
        </motion.div>

        <p className="mt-8 font-display text-[0.6rem] uppercase tracking-cinema text-parchment/45">
          {SITE.window} · {SITE.institution}
        </p>
      </div>
    </section>
  )
}
