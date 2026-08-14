import { allies } from '../data/sponsors'
import { Reveal } from './primitives'
import { useNavTo } from './routing'

function Seal({ name, big = false }: { name: string; big?: boolean }) {
  const initials = name.split(' ').filter((w) => !['Your', 'Here', 'By'].includes(w)).slice(0, 2).map((w) => w[0]).join('')
  return (
    <div className="group flex flex-col items-center gap-2.5">
      <div className={`sticker sticker-press relative flex items-center justify-center rounded-full bg-sun ${big ? 'h-28 w-28' : 'h-20 w-20'}`}>
        <span className="absolute inset-1.5 rounded-full border-[2.5px] border-dashed border-ink/40" />
        <span className={`font-display text-ink ${big ? 'text-3xl' : 'text-xl'}`}>{initials || 'P'}</span>
      </div>
      <span className="text-center font-fun text-sm font-bold text-cream">{name}</span>
    </div>
  )
}

export default function Sponsors({ preview = false }: { preview?: boolean }) {
  const navTo = useNavTo()
  return (
    <section id="allies" className="relative overflow-hidden bg-sea py-16 sm:py-24">
      <div className="map-dots pointer-events-none absolute inset-0 opacity-20" />
      <div className="relative mx-auto max-w-6xl px-6">
        <div className="text-center">
          <div className="flex justify-center">
            <span className="sticker-sm inline-block rounded-full bg-sun px-4 py-1 font-fun text-sm font-bold uppercase tracking-wide2 text-ink">The Trading Ports</span>
          </div>
          <h2 className="font-display mt-4 text-4xl text-cream sm:text-5xl md:text-6xl title-stroke">Allies of the Voyage</h2>
          <p className="mx-auto mt-4 max-w-xl font-fun text-lg text-cream/90">No island is conquered alone. Our partners power the fever — the wind in our sails!</p>
        </div>

        <div className="mt-14 space-y-12">
          {allies.map((tier, ti) => (
            <Reveal key={tier.tier} delay={ti * 0.05}>
              <div className="text-center">
                <span className="font-display text-2xl text-sun">{tier.tier}</span>
                <p className="mt-0.5 font-hand text-xl text-cream/70">{tier.role}</p>
                <div className={ti > 1 ? 'mx-auto mt-7 grid max-w-xs grid-cols-2 justify-items-center gap-x-6 gap-y-8 sm:max-w-2xl sm:grid-cols-3' : 'mt-7 flex flex-wrap items-start justify-center gap-x-10 gap-y-8'}>
                  {tier.seals.map((s) => <Seal key={s.name} name={s.name} big={ti === 0} />)}
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <div className="sticker-lg mt-14 flex flex-col items-center gap-4 rounded-3xl bg-cream px-6 py-9 text-center">
            <p className="max-w-md font-fun text-lg text-ink/80">Want your flag flying over the island? Become a PYREXIA&nbsp;2026 partner and reach thousands of voyagers across India.</p>
            <button onClick={() => navTo(preview ? '/sponsors' : '/#contact')} data-cursor="ALLY" className="sticker sticker-press rounded-full bg-coral px-7 py-3 font-display text-base text-cream">Become an Ally!</button>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
