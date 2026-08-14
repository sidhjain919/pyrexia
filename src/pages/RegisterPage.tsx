import { motion } from 'framer-motion'
import RegisterForm from '../registration/RegisterForm'
import { Sun, Palm, Compass, Chest } from '../components/art'
import { SITE } from '../data/site'

const perks = [
  'Access to all 11 territories & 60+ events',
  'Entry to the Star Nights at Starlight Summit',
  'Delegate kit & official PYREXIA 2026 card',
  'Compete for glory across culture & sport',
]

export default function RegisterPage() {
  return (
    <section id="register" className="relative min-h-screen overflow-hidden pt-28 pb-20 sm:pt-32" style={{ background: 'linear-gradient(180deg,#7fd3e0 0%, #ffe6a8 55%, #ffc98c 100%)' }}>
      <Sun size={130} className="absolute right-10 top-24 anim-sun" />
      <Palm size={200} className="absolute -bottom-2 -left-4 anim-sway drop-ink" />
      <div className="map-dots pointer-events-none absolute inset-0 opacity-25" />

      <div className="relative mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
        <div className="lg:pt-4">
          <div className="flex items-center gap-3">
            <Compass size={48} className="anim-wobble" />
            <span className="sticker-sm rounded-full bg-sun px-4 py-1 font-fun text-sm font-bold uppercase tracking-wide2 text-ink">Join the Crew</span>
          </div>
          <h1 className="font-display mt-4 text-5xl leading-[1.02] text-cream sm:text-6xl title-stroke">Sign the Manifest</h1>
          <p className="mt-4 max-w-md font-fun text-lg font-medium text-ink/80">The island awaits! Complete your delegate registration to unlock every event at PYREXIA 2026, then pick the battles you'll fight.</p>
          <ul className="mt-7 space-y-2.5">
            {perks.map((p, i) => (
              <motion.li key={p} initial={{ opacity: 0, x: -14 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="flex items-start gap-3 font-fun text-[1.02rem] font-medium text-ink/85">
                <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full border-2 border-ink bg-coral" />{p}
              </motion.li>
            ))}
          </ul>
          <div className="mt-8 anim-bounce-slow"><Chest size={130} /></div>
        </div>

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }} className="sticker-lg rounded-3xl bg-cream p-6 sm:p-9">
          <RegisterForm />
          <p className="mt-4 text-center font-hand text-lg text-ink/50">{SITE.window} · {SITE.institution}</p>
        </motion.div>
      </div>
    </section>
  )
}
