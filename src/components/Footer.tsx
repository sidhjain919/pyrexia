import { NAV, SITE, SOCIAL } from '../data/site'
import { Icon } from '../lib/icons'
import { Compass } from './primitives'
import { useNavTo } from './routing'
import { useRegistration } from '../registration/context'

export default function Footer() {
  const navTo = useNavTo()
  const { openRegister } = useRegistration()
  return (
    <footer className="relative overflow-hidden border-t border-gold/15 bg-abyss pt-20">
      {/* background compass + coordinates */}
      <div className="pointer-events-none absolute -bottom-24 -right-16 opacity-[0.06]">
        <Compass size={360} />
      </div>
      <div className="map-grid pointer-events-none absolute inset-0 opacity-20" />
      <div className="pointer-events-none absolute left-6 top-6 font-log text-[0.55rem] uppercase tracking-cinema text-gold/25">
        30°06′N · 78°16′E
      </div>

      <div className="relative mx-auto max-w-6xl px-6">
        {/* closing line */}
        <div className="mb-14 text-center">
          <p className="font-display text-3xl text-foil sm:text-4xl">The voyage doesn't end here.</p>
          <p className="mt-3 font-log text-[0.62rem] uppercase tracking-cinema text-parchment/45">
            {SITE.theme} · {SITE.window}
          </p>
        </div>

        <div className="grid gap-10 border-t border-gold/10 py-12 sm:grid-cols-2 lg:grid-cols-4">
          {/* brand */}
          <div>
            <div className="flex items-center gap-2.5">
              <Compass size={30} spin={false} />
              <span className="font-deco text-foil text-xl tracking-[0.16em]">{SITE.name}</span>
            </div>
            <p className="mt-4 max-w-xs text-[0.85rem] leading-relaxed text-parchment/55">
              The annual socio-cultural and sports fest of {SITE.institutionFull}.
            </p>
          </div>

          {/* nav */}
          <div>
            <div className="font-log text-[0.58rem] uppercase tracking-cinema text-gold/55">Chart</div>
            <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
              {NAV.map((n) => (
                <li key={n.to}>
                  <button
                    onClick={() => navTo(n.to)}
                    className="text-left text-[0.85rem] text-parchment/65 transition-colors hover:text-gold-bright"
                  >
                    {n.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* social */}
          <div>
            <div className="font-log text-[0.58rem] uppercase tracking-cinema text-gold/55">Signal the Ship</div>
            <ul className="mt-4 space-y-3">
              {SOCIAL.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.href}
                    className="group flex items-center gap-3 text-parchment/65 transition-colors hover:text-gold-bright"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-gold/25 group-hover:ring-gold/60">
                      <Icon name={s.icon} size={15} />
                    </span>
                    <span className="text-[0.85rem]">{s.handle}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* register */}
          <div>
            <div className="font-log text-[0.58rem] uppercase tracking-cinema text-gold/55">Set Sail</div>
            <p className="mt-4 text-[0.85rem] text-parchment/55">
              Delegate cards & event registration on the official PYREXIA website.
            </p>
            <button
              onClick={() => openRegister()}
              className="mt-4 inline-block rounded-full bg-gradient-to-b from-gold-bright to-gold-deep px-6 py-3 font-log text-[0.66rem] uppercase tracking-wide2 text-abyss transition-transform hover:scale-[1.03]"
            >
              Register Now →
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-gold/10 py-7 text-center sm:flex-row sm:text-left">
          <p className="font-log text-[0.58rem] uppercase tracking-wide2 text-parchment/40">
            © {SITE.year} PYREXIA · {SITE.institution}. All rights reserved.
          </p>
          <p className="font-log text-[0.58rem] uppercase tracking-wide2 text-parchment/40">
            Charted with fever · Pirates of the Lost Island
          </p>
        </div>
      </div>
    </footer>
  )
}
