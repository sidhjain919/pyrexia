import { motion } from 'framer-motion'
import { Compass } from '../components/primitives'
import RegisterForm from '../registration/RegisterForm'
import { sectionPhoto } from '../data/media'
import { SITE } from '../data/site'

const perks = [
  'Access to all 11 territories & 60+ events',
  'Entry to the Star Nights at Starlight Summit',
  'Delegate kit & official PYREXIA 2026 card',
  'Compete for glory across culture & sport',
]

export default function RegisterPage() {
  return (
    <section className="relative min-h-screen overflow-hidden pt-28 pb-20 sm:pt-32">
      {/* atmosphere */}
      <img src={sectionPhoto.register} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
      <div className="absolute inset-0 bg-gradient-to-b from-abyss/90 via-ocean/95 to-abyss" />
      <div className="map-grid pointer-events-none absolute inset-0 opacity-15" />

      <div className="relative mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
        {/* left pitch */}
        <div className="lg:pt-6">
          <div className="flex items-center gap-3 font-log text-[0.66rem] uppercase tracking-cinema text-gold/80">
            <Compass size={30} spin={false} />
            Join the Crew
          </div>
          <h1 className="mt-5 font-display text-5xl leading-[0.95] text-offwhite sm:text-6xl">
            Sign the <span className="text-foil">Manifest</span>
          </h1>
          <p className="mt-5 max-w-md text-parchment/70">
            The island awaits. Complete your delegate registration to unlock every event at PYREXIA
            2026, then pick the battles you'll fight.
          </p>
          <ul className="mt-8 space-y-3">
            {perks.map((p, i) => (
              <motion.li
                key={p}
                initial={{ opacity: 0, x: -14 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="flex items-start gap-3 text-[0.92rem] text-parchment/80"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-bright" />
                {p}
              </motion.li>
            ))}
          </ul>
          <p className="mt-8 font-log text-[0.6rem] uppercase tracking-cinema text-parchment/45">
            {SITE.window} · {SITE.institution}
          </p>
        </div>

        {/* form card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="glass grain rounded-2xl p-6 shadow-cinema sm:p-9"
        >
          <RegisterForm />
        </motion.div>
      </div>
    </section>
  )
}
