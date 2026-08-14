import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { NAV } from '../data/site'
import { asset } from '../lib/asset'
import { useNavTo } from './routing'
import { useRegistration } from '../registration/context'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [open, setOpen] = useState(false)
  const navTo = useNavTo()
  const { openRegister } = useRegistration()
  const { pathname } = useLocation()

  useEffect(() => {
    let last = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      setScrolled(y > 40)
      setHidden(y > last && y > 400 && !open)
      last = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [open])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const isActive = (to: string) => {
    const path = to.split('#')[0] || '/'
    return path !== '/' ? pathname.startsWith(path) : pathname === '/' && !to.includes('#')
  }

  return (
    <>
      <motion.header
        initial={{ y: -90, opacity: 0 }}
        animate={{ y: hidden ? -100 : 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
        className="fixed inset-x-0 top-0 z-[900] flex justify-center px-3 pt-3"
      >
        <nav className={`flex w-full max-w-6xl items-center justify-between rounded-full px-3 py-2 transition-all duration-300 sm:px-4 ${scrolled ? 'glass rounded-full' : 'border-transparent'}`}>
          <Link to="/" data-cursor="TOP" className="flex items-center gap-2">
            <img src={asset('logo.png')} alt="PYREXIA" className="h-9 w-auto sm:h-11" />
          </Link>

          <ul className="hidden items-center gap-1 lg:flex">
            {NAV.map((n) => (
              <li key={n.to}>
                <button
                  onClick={() => navTo(n.to)}
                  data-cursor="GO"
                  className={`rounded-full px-3 py-1.5 font-fun text-[0.95rem] font-semibold transition-colors ${isActive(n.to) ? 'bg-sun text-ink' : 'text-ink/80 hover:bg-cream-soft hover:text-coral'}`}
                >
                  {n.label}
                </button>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2">
            <button
              onClick={() => openRegister()}
              data-cursor="AHOY"
              className="sticker-sm sticker-press hidden rounded-full bg-coral px-5 py-2 font-display text-sm text-cream sm:inline-block"
            >
              Register
            </button>
            <button
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              className="sticker-sm flex h-10 w-10 items-center justify-center rounded-full bg-sun text-ink lg:hidden"
            >
              <Menu size={18} strokeWidth={3} />
            </button>
          </div>
        </nav>
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="fixed inset-0 z-[1000] flex flex-col bg-sea lg:hidden"
          >
            <div className="map-dots pointer-events-none absolute inset-0 opacity-40" />
            <div className="relative flex items-center justify-between px-6 pt-5">
              <span className="rounded-2xl bg-cream px-3 py-1 sticker-sm">
                <img src={asset('logo.png')} alt="PYREXIA" className="h-9 w-auto" />
              </span>
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="sticker-sm flex h-10 w-10 items-center justify-center rounded-full bg-sun text-ink">
                <X size={18} strokeWidth={3} />
              </button>
            </div>
            <nav className="relative flex flex-1 flex-col justify-center gap-2 px-8">
              {NAV.map((n, i) => (
                <motion.button
                  key={n.to}
                  onClick={() => navTo(n.to, () => setOpen(false))}
                  initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.06 * i + 0.1, ease: [0.34, 1.56, 0.64, 1] }}
                  className="flex items-center gap-3 text-left"
                >
                  <span className="font-hand text-2xl text-sun">{String(i + 1).padStart(2, '0')}</span>
                  <span className="font-display text-3xl text-cream">{n.label}</span>
                </motion.button>
              ))}
            </nav>
            <div className="relative px-8 pb-10">
              <button onClick={() => { setOpen(false); openRegister() }} className="sticker sticker-press w-full rounded-full bg-coral py-4 text-center font-display text-lg text-cream">
                Join the Crew!
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
