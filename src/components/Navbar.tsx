import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { NAV, SITE } from '../data/site'
import { Compass } from './primitives'
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
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const isActive = (to: string) => {
    const path = to.split('#')[0] || '/'
    return path !== '/' ? pathname.startsWith(path) : pathname === '/' && !to.includes('#')
  }

  return (
    <>
      <motion.header
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: hidden ? -90 : 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="fixed inset-x-0 top-0 z-[900] flex justify-center px-4 pt-4"
      >
        <nav
          className={`flex w-full max-w-6xl items-center justify-between rounded-2xl px-4 py-2.5 transition-all duration-500 sm:px-5 ${
            scrolled ? 'glass shadow-cinema' : 'bg-transparent'
          }`}
        >
          {/* Real logo on an aged-parchment plate */}
          <Link to="/" data-cursor="TOP" className="flex items-center gap-2.5">
            <span className="flex items-center rounded-xl bg-parchment/95 px-2.5 py-1.5 shadow-[0_6px_16px_-8px_rgba(0,0,0,0.8)] ring-1 ring-gold/40">
              <img src={asset('logo.png')} alt="PYREXIA" className="h-7 w-auto sm:h-8" />
            </span>
            <span className="hidden font-log text-[0.5rem] uppercase tracking-cinema text-parchment/55 sm:block">
              {SITE.year}
              <br />
              AIIMS Rishikesh
            </span>
          </Link>

          {/* Desktop links */}
          <ul className="hidden items-center gap-6 lg:flex">
            {NAV.map((n) => (
              <li key={n.to}>
                <button
                  onClick={() => navTo(n.to)}
                  data-cursor="GO"
                  className={`group relative font-body text-[0.82rem] transition-colors hover:text-offwhite ${
                    isActive(n.to) ? 'text-gold-bright' : 'text-parchment/75'
                  }`}
                >
                  {n.label}
                  <span
                    className={`absolute -bottom-1 left-0 h-px bg-gold-bright transition-all duration-300 ${
                      isActive(n.to) ? 'w-full' : 'w-0 group-hover:w-full'
                    }`}
                  />
                </button>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2">
            <button
              onClick={() => openRegister()}
              data-cursor="JOIN"
              className="hidden rounded-full bg-gradient-to-b from-gold-bright to-gold-deep px-5 py-2.5 text-[0.72rem] font-semibold uppercase tracking-wide2 text-abyss transition-transform hover:scale-[1.03] sm:inline-block"
            >
              Register Now
            </button>
            <button
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              data-cursor="MAP"
              className="flex h-10 w-10 items-center justify-center rounded-full ring-1 ring-gold/30 text-gold-bright lg:hidden"
            >
              <Menu size={18} />
            </button>
          </div>
        </nav>
      </motion.header>

      {/* Mobile / tablet full-screen chart menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="grain fixed inset-0 z-[1000] flex flex-col bg-ocean/95 backdrop-blur-xl lg:hidden"
          >
            <div className="map-grid pointer-events-none absolute inset-0 opacity-30" />
            <div className="pointer-events-none absolute -right-16 -top-16 opacity-20">
              <Compass size={280} />
            </div>

            <div className="relative flex items-center justify-between px-6 pt-6">
              <span className="font-log text-[0.6rem] uppercase tracking-cinema text-gold/70">
                Navigator's Chart
              </span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex h-10 w-10 items-center justify-center rounded-full ring-1 ring-gold/30 text-gold-bright"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="relative flex flex-1 flex-col justify-center gap-1 px-8">
              {NAV.map((n, i) => (
                <motion.button
                  key={n.to}
                  onClick={() => navTo(n.to, () => setOpen(false))}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08 * i + 0.1, ease: [0.16, 1, 0.3, 1] }}
                  className="group flex items-baseline gap-4 border-b border-gold/10 py-3 text-left"
                >
                  <span className="font-log text-xs text-gold/50">{String(i + 1).padStart(2, '0')}</span>
                  <span className="font-display text-3xl text-offwhite transition-colors group-hover:text-gold-bright">
                    {n.label}
                  </span>
                </motion.button>
              ))}
            </nav>

            <div className="relative px-8 pb-10">
              <button
                onClick={() => {
                  setOpen(false)
                  openRegister()
                }}
                className="block w-full rounded-full bg-gradient-to-b from-gold-bright to-gold-deep py-4 text-center text-sm font-semibold uppercase tracking-wide2 text-abyss"
              >
                Join the Crew →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
