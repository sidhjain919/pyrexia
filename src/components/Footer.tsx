import { Link } from 'react-router-dom'
import { NAV, SITE, SOCIAL } from '../data/site'
import { Icon } from '../lib/icons'
import { Compass } from './primitives'
import { asset } from '../lib/asset'
import { useNavTo } from './routing'
import { useRegistration } from '../registration/context'
import { passCta, useEntitlement } from '../registration/useEntitlement'

export default function Footer() {
  const navTo = useNavTo()
  const { openRegister } = useRegistration()
  // The footer's "Set Sail" call to action follows what the visitor already
  // holds, exactly like the header and hero: a registered delegate should not
  // be told to "Register Now" from the bottom of every page.
  const { state } = useEntitlement()
  const cta = passCta(state)
  return (
    <footer className="relative overflow-hidden border-t border-gold/15 bg-abyss pt-20">
      {/* background compass + coordinates */}
      <div className="pointer-events-none absolute -bottom-24 -right-16 opacity-[0.06]">
        <Compass size={360} />
      </div>
      <div className="map-grid pointer-events-none absolute inset-0 opacity-20" />
      <div className="pointer-events-none absolute left-6 top-6 font-log text-[0.7rem] uppercase tracking-cinema text-gold/45">
        30°06′N · 78°16′E
      </div>

      <div className="relative mx-auto max-w-6xl px-6">
        {/* closing line */}
        <div className="mb-14 text-center">
          <p className="font-display text-3xl text-foil sm:text-4xl">The voyage doesn't end here.</p>
          <p className="mt-3 font-log text-[0.62rem] uppercase tracking-cinema text-parchment/62">
            {SITE.theme} · {SITE.dates}
          </p>
        </div>

        <div className="grid gap-10 border-t border-gold/10 py-12 sm:grid-cols-2 lg:grid-cols-4">
          {/* brand */}
          <div>
            <img src={asset('logo-wordmark.webp')} alt="PYREXIA" className="h-12 w-auto" />
            <p className="mt-4 max-w-xs text-[0.85rem] leading-relaxed text-parchment/55">
              The annual socio-cultural and sports fest of {SITE.institutionFull}.
            </p>
          </div>

          {/* nav */}
          <div>
            <div className="font-log text-[0.72rem] uppercase tracking-cinema text-gold/70">Chart</div>
            <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
              {NAV.map((n) => (
                <li key={n.to}>
                  <button
                    onClick={() => navTo(n.to)}
                    className="flex min-h-10 items-center text-left text-[0.85rem] text-parchment/65 transition-colors hover:text-gold-bright sm:min-h-0"
                  >
                    {n.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* social */}
          <div>
            <div className="font-log text-[0.72rem] uppercase tracking-cinema text-gold/70">Signal the Ship</div>
            <ul className="mt-4 space-y-3">
              {SOCIAL.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.href}
                    className="group flex items-center gap-3 text-parchment/65 transition-colors hover:text-gold-bright"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-inset ring-gold/45 group-hover:ring-gold/60">
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
            <div className="font-log text-[0.72rem] uppercase tracking-cinema text-gold/70">Set Sail</div>
            <p className="mt-4 text-[0.85rem] text-parchment/55">
              {state === 'festival'
                ? 'You hold the Festival Pass — the full run of the island is yours. Your pass is ready whenever you want it.'
                : state === 'basic'
                  ? 'Your Basic Registration is confirmed. Add the Festival Pass any time for the full programme across the island, the pro nights included.'
                  : 'Basic Registration and the Festival Pass, which covers the full programme, are both on the official PYREXIA website. You see the price when you register.'}
            </p>
            {cta.action === 'register' ? (
              <button
                onClick={() => openRegister()}
                className="mt-4 inline-block rounded-full bg-gradient-to-b from-gold-bright to-gold-deep px-6 py-3 font-log text-[0.66rem] uppercase tracking-wide2 text-abyss transition-transform hover:scale-[1.03]"
              >
                {cta.label} →
              </button>
            ) : (
              <Link
                to={cta.to ?? '/pass'}
                className="mt-4 inline-block rounded-full bg-gradient-to-b from-gold-bright to-gold-deep px-6 py-3 font-log text-[0.66rem] uppercase tracking-wide2 text-abyss transition-transform hover:scale-[1.03]"
              >
                {cta.label} →
              </Link>
            )}
            <a
              href={asset('pyrexia-brochure.pdf')}
              target="_blank"
              rel="noreferrer"
              className="mt-4 block text-[0.82rem] text-parchment/60 underline decoration-gold/30 underline-offset-4 transition-colors hover:text-gold-bright"
            >
              View the 2026 brochure →
            </a>
          </div>
        </div>

        {/* Reachable from every page, which is how a payment provider's
            reviewer expects to find them. */}
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 border-t border-gold/10 py-6 font-log text-[0.66rem] uppercase tracking-wide2 sm:justify-start">
          {[
            // First, and deliberately: during the fest this is the page people
            // need, and it is the only one here that changes day to day.
            ['/notices', 'Noticeboard'],
            ['/terms', 'Terms'],
            ['/privacy', 'Privacy'],
            ['/refunds', 'Refunds'],
            ['/contact', 'Contact'],
          ].map(([to, label]) => (
            <Link
              key={to}
              to={to}
              className="inline-flex min-h-10 items-center text-parchment/50 transition-colors hover:text-gold-bright sm:min-h-0"
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-gold/10 py-7 text-center sm:flex-row sm:text-left">
          <p className="font-log text-[0.72rem] uppercase tracking-wide2 text-parchment/58">
            © {SITE.year} PYREXIA · {SITE.institution}. All rights reserved.
          </p>
          <p className="font-log text-[0.72rem] uppercase tracking-wide2 text-parchment/58">
            Charted with fever · Pirates of the Lost Island
          </p>
        </div>

        {/* The maker's mark: the last line on the page, centred, at the level
            of the small print. It only brightens for someone who goes looking. */}
        <p className="pb-6 text-center">
          <a
            href="mailto:sidh.jain.1809@gmail.com?subject=Website%20enquiry"
            className="font-log text-[0.62rem] uppercase tracking-wide2 text-parchment/30 transition-colors hover:text-gold-bright"
            title="Want a website like this? Get in touch."
          >
            Developed by Sidh
          </a>
        </p>
      </div>
    </footer>
  )
}
