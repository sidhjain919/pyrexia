import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Zap } from 'lucide-react'
import { Compass, StaggerWords } from './primitives'
import { SITE } from '../data/site'
import { sectionPhoto } from '../data/media'
import { EARLY_BIRD } from '../data/site'
import { Link } from 'react-router-dom'

import { useRegistration } from '../registration/context'
import { passCta, useEntitlement } from '../registration/useEntitlement'
import { useNavTo } from './routing'

export default function CTA() {
  const reduce = useReducedMotion()
  const { openRegister } = useRegistration()
  const navTo = useNavTo()
  const { state } = useEntitlement()
  const cta = passCta(state)
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
          className="font-log text-[0.66rem] uppercase tracking-cinema text-gold/70"
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
          The island awaits from {SITE.dates}. Complete your Basic Registration, choose your crew,
          and set sail into the most epic edition of PYREXIA yet. The treasure is real. Come claim
          it.
        </motion.p>

        {/* What each tier is for, with no numbers on it. The price belongs at
            the point of paying, where it is current by definition. */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.26, duration: 0.8 }}
          className="mx-auto mt-9 grid max-w-lg gap-3 text-left sm:grid-cols-2"
        >
          <div className="glass rounded-xl p-4">
            <div className="font-display text-[1.05rem] text-offwhite">Basic Registration</div>
            <p className="mt-1.5 text-[0.8rem] leading-relaxed text-parchment/65">
              Compulsory for everyone. Enter the fest and compete in any event.
            </p>
          </div>
          <div className="glass rounded-xl border-gold/40 p-4">
            <div className="font-display text-[1.05rem] text-offwhite">Festival Pass</div>
            <p className="mt-1.5 text-[0.8rem] leading-relaxed text-parchment/65">
              On top of BR. The run of the whole island, every evening included.
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.29, duration: 0.8 }}
          className="mx-auto mt-4 flex max-w-lg items-center gap-3 rounded-xl border border-gold/45 bg-gold/[0.08] px-4 py-3.5 text-left"
        >
          <Zap size={16} className="shrink-0 text-gold-bright" />
          <p className="text-[0.85rem] leading-relaxed text-parchment/85">
            <span className="font-log uppercase tracking-wide2 text-gold-bright">Early bird</span>{' '}
            {EARLY_BIRD.blurb}
          </p>
        </motion.div>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.32, duration: 0.8 }}
          className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          {cta.action === 'register' ? (
            <button
              onClick={() => openRegister()}
              data-cursor="JOIN"
              className="font-accent group inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep px-9 py-4 text-[0.92rem] uppercase tracking-wide2 text-abyss transition-transform hover:scale-[1.04]"
            >
              {cta.label}
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </button>
          ) : (
            <Link
              to={cta.to ?? '/pass'}
              data-cursor="PASS"
              className="font-accent group inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep px-9 py-4 text-[0.92rem] uppercase tracking-wide2 text-abyss transition-transform hover:scale-[1.04]"
            >
              {cta.label}
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </Link>
          )}
          <button
            onClick={() => navTo('/#island')}
            data-cursor="EVENTS"
            className="font-accent inline-flex items-center gap-2 rounded-full px-7 py-4 text-[0.92rem] uppercase tracking-wide2 text-parchment ring-1 ring-inset ring-gold/40 transition-colors hover:text-gold-bright hover:ring-gold"
          >
            Explore Events
          </button>
        </motion.div>

        <p className="mt-8 font-log text-[0.6rem] uppercase tracking-cinema text-parchment/45">
          {SITE.dates} · {SITE.institution}
        </p>
      </div>
    </section>
  )
}
