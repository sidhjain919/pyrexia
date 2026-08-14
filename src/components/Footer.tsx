import { NAV, SITE, SOCIAL } from '../data/site'
import { Icon } from '../lib/icons'
import { asset } from '../lib/asset'
import { SeaBand } from './art'
import { useNavTo } from './routing'
import { useRegistration } from '../registration/context'

export default function Footer() {
  const navTo = useNavTo()
  const { openRegister } = useRegistration()
  return (
    <footer className="relative overflow-hidden bg-sea-deep pt-16 text-cream">
      <SeaBand className="absolute top-0 left-0 h-6 w-full" style={{ transform: 'scaleY(-1)' }} />
      <div className="map-dots pointer-events-none absolute inset-0 opacity-15" />

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mb-12 text-center">
          <p className="font-display text-3xl text-sun sm:text-4xl title-stroke">The voyage doesn't end here!</p>
          <p className="mt-2 font-hand text-2xl text-foam">{SITE.theme} · {SITE.window}</p>
        </div>

        <div className="grid gap-10 border-t-2 border-dashed border-cream/20 py-11 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="inline-block rounded-2xl bg-cream px-3 py-2 sticker-sm"><img src={asset('logo.png')} alt="PYREXIA" className="h-10 w-auto" /></span>
            <p className="mt-4 max-w-xs font-fun text-[0.95rem] leading-relaxed text-cream/80">The annual socio-cultural and sports fest of {SITE.institutionFull}.</p>
          </div>
          <div>
            <div className="font-hand text-xl text-sun">Chart</div>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
              {NAV.map((n) => <li key={n.to}><button onClick={() => navTo(n.to)} className="font-fun text-[0.95rem] text-cream/80 transition-colors hover:text-sun">{n.label}</button></li>)}
            </ul>
          </div>
          <div>
            <div className="font-hand text-xl text-sun">Signal the Ship</div>
            <ul className="mt-3 space-y-2.5">
              {SOCIAL.map((s) => (
                <li key={s.label}>
                  <a href={s.href} className="group flex items-center gap-3 text-cream/80 transition-colors hover:text-sun">
                    <span className="sticker-sm flex h-9 w-9 items-center justify-center rounded-full bg-sun text-ink"><Icon name={s.icon} size={15} strokeWidth={2.5} /></span>
                    <span className="font-fun text-[0.9rem]">{s.handle}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="font-hand text-xl text-sun">Set Sail</div>
            <p className="mt-3 font-fun text-[0.95rem] text-cream/80">Delegate cards & event registration on the official PYREXIA website.</p>
            <button onClick={() => openRegister()} className="sticker-sm sticker-press mt-4 rounded-full bg-coral px-6 py-2.5 font-display text-sm text-cream">Register Now!</button>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-2 border-t-2 border-dashed border-cream/20 py-6 text-center font-fun text-xs text-cream/60 sm:flex-row sm:text-left">
          <p>© {SITE.year} PYREXIA · {SITE.institution}. All rights reserved.</p>
          <p>Charted with fever · Pirates of the Lost Island</p>
        </div>
      </div>
    </footer>
  )
}
