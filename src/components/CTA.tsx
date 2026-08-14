import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { StaggerWords } from './primitives'
import { Chest, Sun, Palm, Coin } from './art'
import { SITE } from '../data/site'
import { useRegistration } from '../registration/context'
import { useNavTo } from './routing'

export default function CTA() {
  const reduce = useReducedMotion()
  const { openRegister } = useRegistration()
  const navTo = useNavTo()
  return (
    <section id="register" className="relative overflow-hidden py-20 sm:py-28" style={{ background: 'linear-gradient(180deg,#ffd98a 0%, #ffb267 45%, #ff7d53 100%)' }}>
      <Sun size={150} className="absolute left-1/2 top-8 -translate-x-1/2 anim-sun opacity-90" />
      <Palm size={200} className="absolute -bottom-2 left-0 anim-sway drop-ink" />
      <Palm size={190} flip className="absolute -bottom-2 right-0 anim-sway drop-ink" />
      <div className="map-dots pointer-events-none absolute inset-0 opacity-25" />

      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <div className="flex justify-center gap-2">
          <Coin size={30} className="anim-bob" /><Coin size={30} className="anim-bob" style={{ animationDelay: '.3s' }} /><Coin size={30} className="anim-bob" style={{ animationDelay: '.6s' }} />
        </div>
        <p className="mt-3 font-hand text-3xl text-red">X marks the spot!</p>
        <h2 className="mt-2 font-display text-4xl leading-[1.05] text-cream sm:text-6xl title-stroke">
          <StaggerWords text="Will you join the voyage?" />
        </h2>
        <motion.p initial={reduce ? false : { opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="mx-auto mt-5 max-w-lg font-fun text-lg font-medium text-ink/80">
          The island awaits. Grab your delegate card, choose your crew, and set sail into the most epic edition of PYREXIA yet!
        </motion.p>

        <div className="mt-8 flex justify-center anim-bounce-slow"><Chest size={140} /></div>

        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button onClick={() => openRegister()} data-cursor="AHOY" className="sticker sticker-press inline-flex items-center gap-2 rounded-full bg-red px-9 py-4 font-display text-lg text-cream">
            Join the Crew <ArrowRight size={20} strokeWidth={3} />
          </button>
          <button onClick={() => navTo('/events')} data-cursor="EXPLORE" className="sticker sticker-press inline-flex items-center gap-2 rounded-full bg-cream px-8 py-4 font-display text-lg text-ink">
            Explore Events
          </button>
        </div>
        <p className="mt-7 font-hand text-2xl text-ink/70">{SITE.window} · {SITE.institution}</p>
      </div>
    </section>
  )
}
