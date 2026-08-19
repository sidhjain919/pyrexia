import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, X, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { NAV, SITE } from '../data/site'
import { Compass } from './primitives'
import { asset } from '../lib/asset'
import { useNavTo, useActiveSection } from './routing'
import { useRegistration } from '../registration/context'

const SECTION_IDS = NAV.map((n) => n.to.split('#')[1])

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [open, setOpen] = useState(false)
  const navTo = useNavTo()
  const { openRegister } = useRegistration()
  const activeId = useActiveSection(SECTION_IDS)

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

  const isActive = (to: string) => to.split('#')[1] === activeId

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
          {/* Wordmark reads directly on the dark bar */}
          <Link to="/" data-cursor="TOP" className="flex items-center gap-2.5">
            <img src={asset('logo-wordmark.webp')} alt="PYREXIA" className="h-8 w-auto sm:h-10" />
            <span className="hidden font-log text-[0.68rem] uppercase tracking-cinema text-parchment/70 sm:block">
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
                  title={n.meaning || undefined}
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
              className="font-accent hidden rounded-full bg-gradient-to-b from-gold-bright to-gold-deep px-5 py-2.5 text-[0.82rem] uppercase tracking-wide2 text-abyss transition-transform hover:scale-[1.03] sm:inline-block"
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
              <div className="flex items-center gap-2.5">
                <Compass size={26} spin={false} />
                <span className="font-log text-[0.72rem] uppercase tracking-cinema text-gold/70">
                  Navigator's Chart
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex h-10 w-10 items-center justify-center rounded-full ring-1 ring-gold/30 text-gold-bright transition-colors hover:bg-gold/10"
              >
                <X size={18} />
              </button>
            </div>
            <div className="relative mx-6 mt-4 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />

            <nav className="relative flex flex-1 flex-col justify-center gap-0.5 overflow-y-auto px-6 py-4">
              {NAV.map((n, i) => {
                const active = isActive(n.to)
                return (
                  <motion.button
                    key={n.to}
                    onClick={() => navTo(n.to, () => setOpen(false))}
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.06 * i + 0.1, ease: [0.16, 1, 0.3, 1] }}
                    className="group relative flex items-center gap-4 rounded-xl px-2 py-3 text-left transition-colors hover:bg-gold/5"
                  >
                    <span
                      className={`absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-full bg-gold-bright transition-opacity ${
                        active ? 'opacity-100' : 'opacity-0'
                      }`}
                    />
                    <span
                      className={`font-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[0.7rem] ring-1 transition-colors ${
                        active ? 'bg-gold-bright text-abyss ring-gold-bright' : 'text-gold/65 ring-gold/25'
                      }`}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="flex-1">
                      <span
                        className={`block font-display text-2xl leading-tight transition-colors sm:text-3xl ${
                          active ? 'text-gold-bright' : 'text-offwhite group-hover:text-gold-bright'
                        }`}
                      >
                        {n.label}
                      </span>
                      {n.meaning && (
                        <span className="mt-0.5 block font-log text-[0.66rem] uppercase tracking-wide2 text-parchment/50">
                          {n.meaning}
                        </span>
                      )}
                    </span>
                    <ArrowRight
                      size={16}
                      className="shrink-0 text-gold/40 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-gold-bright"
                    />
                  </motion.button>
                )
              })}
            </nav>

            <div className="relative px-8 pb-10">
              <button
                onClick={() => {
                  setOpen(false)
                  openRegister()
                }}
                className="font-accent block w-full rounded-full bg-gradient-to-b from-gold-bright to-gold-deep py-4 text-center text-base uppercase tracking-wide2 text-abyss"
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
