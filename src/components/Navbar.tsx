import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, X, ArrowRight, LogOut, Megaphone, Star, Ticket } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { NAV, SITE } from '../data/site'
import { Compass } from './primitives'
import { asset } from '../lib/asset'
import { useNavTo, useActiveSection } from './routing'
import { useRegistration } from '../registration/context'
import { passCta, useEntitlement } from '../registration/useEntitlement'
import { api, clearSession } from '../api/client'
import { firstName, useAuth } from '../auth/useAuth'
import Announcements from './Announcements'

const SECTION_IDS = NAV.map((n) => n.to.split('#')[1])

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [open, setOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const navTo = useNavTo()
  const navigate = useNavigate()
  const { openRegister } = useRegistration()
  const activeId = useActiveSection(SECTION_IDS)
  const { state: entitlement } = useEntitlement()
  const headerCta = passCta(entitlement)

  // Subscribed, not read once at mount. Signing out navigates rather than
  // remounting the header, and the old version went on offering My Pass to
  // somebody who no longer had a session.
  const auth = useAuth()
  const signedIn = auth.signedIn
  const who = firstName(auth)

  /* The header is not a fixed height: the announcement strip appears only when
     there is something on the board, and both it and the bar wrap differently
     at every width. Anything that has to clear the header (the hero's first
     line, a section scrolled to by anchor) reads the measured height off the
     root rather than guessing, which is what used to put the announcement
     pill straight through "AIIMS RISHIKESH PRESENTS" on a short screen. */
  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const publish = () => {
      // Anything clearing the header has to clear whatever is stacked above it
      // too, which today is the test-mode banner. Read rather than assumed, so
      // a banner that wraps to two lines on a narrow phone still works.
      const banner =
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue('--banner-h'),
        ) || 0
      const height = Math.round(el.getBoundingClientRect().height + banner)
      document.documentElement.style.setProperty('--header-h', `${height}px`)
    }
    publish()
    const ro = new ResizeObserver(publish)
    ro.observe(el)
    window.addEventListener('resize', publish)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', publish)
    }
  }, [])

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

  const signOut = async () => {
    setOpen(false)
    await api.signOut().catch(() => {})
    clearSession()
    navigate('/', { replace: true })
  }

  return (
    <>
      <motion.header
        ref={headerRef}
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: hidden ? -140 : 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="pointer-events-none fixed inset-x-0 top-[var(--banner-h,0px)] z-[900] flex flex-col items-center px-4 pt-4"
      >
        {/* A wash of night behind the bar. The hero paints a full moon into the
            top-right corner, which is exactly where Sign in and Register sit,
            and pale type on it was unreadable. Fades out once the glass bar
            takes over on scroll. */}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-x-0 top-0 -z-10 h-[calc(100%+2.5rem)] transition-opacity duration-500 ${
            scrolled ? 'opacity-0' : 'opacity-100'
          }`}
          style={{
            background:
              'linear-gradient(180deg, rgba(3,11,15,0.88) 0%, rgba(3,11,15,0.72) 38%, rgba(3,11,15,0.34) 72%, transparent 100%)',
          }}
        />
        <nav
          /* From 2xl up the bar shows the "2026 · AIIMS Rishikesh" block and
             the roomier link spacing, which together are wider than the old
             78rem cap — so the Register button spilled off the right edge of
             the glass. Widening the cap at that one breakpoint gives the extra
             content the room it needs and keeps everything inside the bar. */
          className={`pointer-events-auto flex w-full max-w-[78rem] items-center justify-between gap-3 rounded-2xl px-3 py-2.5 transition-all duration-500 sm:gap-4 sm:px-5 2xl:max-w-[88rem] ${
            scrolled ? 'glass shadow-cinema' : 'bg-transparent'
          }`}
        >
          {/* Wordmark reads directly on the dark bar */}
          <Link to="/" data-cursor="TOP" className="flex shrink-0 items-center gap-2.5 py-1">
            <img
              src={asset('logo-wordmark.webp')}
              alt="PYREXIA"
              /* h-7 below `sm`: on a 360px phone, signed in, the row is a
                 dozen pixels over and this is the only element that can give
                 them up without losing information. */
              className="h-7 w-auto sm:h-10"
            />
            <span
              className={`hidden whitespace-nowrap font-log text-[0.68rem] uppercase tracking-cinema text-parchment/70 ${
                // Signing in adds a greeting and a gold button to a row that
                // was already full at this width. This is the only thing in it
                // that is pure decoration, so it is the thing that goes.
                signedIn ? '' : '2xl:block'
              }`}
            >
              {SITE.year}
              <br />
              AIIMS Rishikesh
            </span>
          </Link>

          {/* Desktop links */}
          <ul className="hidden items-center gap-3.5 xl:flex 2xl:gap-5">
            {NAV.map((n) => (
              // Every item is the same box: a flex li holding a leading-none
              // inline-flex control. The Notices link carries an icon and was
              // built that way; the section buttons were plain inline text in
              // a taller line box, which put their caps a couple of pixels
              // lower than the word beside them.
              <li key={n.to} className="flex items-center">
                <button
                  onClick={() => navTo(n.to)}
                  data-cursor="GO"
                  title={n.meaning || undefined}
                  className={`font-display group relative inline-flex items-center whitespace-nowrap text-[0.82rem] leading-none transition-colors hover:text-offwhite 2xl:text-[0.88rem] ${
                    isActive(n.to) ? 'text-gold-bright' : 'text-parchment/80'
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
            {/* A route, not a section, so it sits after the chart with a rule
                between rather than pretending to be part of the scroll. */}
            <li className="flex items-center gap-3.5 2xl:gap-5">
              <span className="h-4 w-px bg-gold/25" />
              <Link
                to="/notices"
                data-cursor="NOTICES"
                className="font-display inline-flex items-center gap-1.5 whitespace-nowrap text-[0.82rem] leading-none text-parchment/80 transition-colors hover:text-gold-bright 2xl:text-[0.88rem]"
              >
                <Megaphone size={13} className="relative -top-px" />
                Notices
              </Link>
            </li>
          </ul>

          <div className="flex min-w-0 items-center gap-2">
            {signedIn ? (
              <>
                {/*
                    Two states, not one squashed continuum.

                    This was `min-w-0` with a truncating name, so when the bar
                    ran out of room - which signing in guarantees, because the
                    greeting is added to a row that was already full - the name
                    truncated to nothing and left the pill's right padding
                    wrapped around the avatar as a collapsed oval sitting under
                    the gold button.

                    So it does not shrink. It is a circle holding the initial,
                    and only where the row can genuinely spare 9rem does it
                    open out into the greeting.
                */}
                <Link
                  to="/pass"
                  data-cursor="PASS"
                  aria-label={who ? `Signed in as ${who}. Open my pass` : 'Open my pass'}
                  /* On mobile this is now the only account control in the bar:
                     the gold Register/Upgrade button is hidden below `sm` so it
                     does not duplicate the hero's, so the avatar-to-pass link
                     has to survive at every width. */
                  className="flex shrink-0 items-center gap-2 rounded-full border border-gold/35 p-1 transition-colors hover:border-gold/70 2xl:pr-3.5"
                >
                  <span className="font-accent flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-gold-bright to-gold-deep text-[0.72rem] text-abyss">
                    {(who ?? 'P').charAt(0).toUpperCase()}
                  </span>
                  <span className="hidden max-w-[9rem] truncate text-[0.84rem] text-parchment/85 2xl:block">
                    Hi,{' '}
                    <span className="text-gold-bright">{who ?? 'voyager'}</span>
                  </span>
                </Link>

                {/* Three different people are signed in here and they need
                    three different buttons: one who has not paid at all, one
                    holding Basic Registration who is a tap away from the Pro
                    Nights, and one who is done. The old bar said "My Pass" to
                    all three, which was wrong for two of them. */}
                {/* Hidden below `sm`: on a phone the hero already carries this
                    exact call to action (Register / Upgrade / My Pass), and two
                    of them stacked read as a mistake. On the phone it lives in
                    the hero and the hamburger menu instead. */}
                {headerCta.action === 'register' ? (
                  <button
                    onClick={() => openRegister()}
                    data-cursor="JOIN"
                    className="font-accent hidden min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-gradient-to-b from-gold-bright to-gold-deep px-4 py-2.5 text-[0.7rem] uppercase tracking-wide2 text-abyss transition-transform hover:scale-[1.03] sm:inline-flex sm:min-h-0 sm:px-5 sm:text-[0.82rem]"
                  >
                    <Ticket size={13} className="hidden sm:block" />
                    {headerCta.short}
                  </button>
                ) : (
                  <Link
                    to={headerCta.to ?? '/pass'}
                    data-cursor="PASS"
                    className="font-accent hidden min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-gradient-to-b from-gold-bright to-gold-deep px-4 py-2.5 text-[0.7rem] uppercase tracking-wide2 text-abyss transition-transform hover:scale-[1.03] sm:inline-flex sm:min-h-0 sm:px-5 sm:text-[0.82rem]"
                  >
                    <span className="hidden sm:block">
                      {entitlement === 'basic' ? <Star size={13} /> : <Ticket size={13} />}
                    </span>
                    {headerCta.short}
                  </Link>
                )}
              </>
            ) : (
              /* A matched pair: same height, same radius, one filled and one
                 outlined. The old bare text link beside a gold pill read as an
                 afterthought bolted onto the bar. */
              <>
                {/* On a phone this is the bar's only account action: the gold
                    Register button is hidden below `sm` because the hero right
                    beneath it already says "Register Now", and two of them read
                    as a mistake. Register still lives in the hero and in the
                    hamburger menu. From `sm` up the pair returns. */}
                <Link
                  to="/sign-in"
                  data-cursor="SIGN IN"
                  className="font-accent inline-block shrink-0 whitespace-nowrap rounded-full px-4 py-2.5 text-[0.72rem] uppercase tracking-wide2 text-parchment/85 ring-1 ring-inset ring-gold/40 transition-colors hover:text-gold-bright hover:ring-gold/80 sm:px-5 sm:text-[0.78rem]"
                >
                  Sign in
                </Link>
                <button
                  onClick={() => openRegister()}
                  data-cursor="JOIN"
                  className="font-accent hidden min-h-10 shrink-0 items-center whitespace-nowrap rounded-full bg-gradient-to-b from-gold-bright to-gold-deep px-4 py-2.5 text-[0.7rem] uppercase tracking-wide2 text-abyss transition-transform hover:scale-[1.03] sm:inline-flex sm:min-h-0 sm:px-5 sm:text-[0.78rem]"
                >
                  <span className="sm:hidden">Register</span>
                  <span className="hidden sm:inline">Register Now</span>
                </button>
              </>
            )}
            <button
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              data-cursor="MAP"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ring-gold/45 text-gold-bright xl:hidden"
            >
              <Menu size={18} />
            </button>
          </div>
        </nav>

        {/* Notices and the early-bird offer, at the top where they are read. */}
        <Announcements />
      </motion.header>

      {/* Mobile / tablet full-screen chart menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="grain fixed inset-0 z-[1000] flex flex-col bg-ocean/95 backdrop-blur-xl xl:hidden"
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
                className="flex h-10 w-10 items-center justify-center rounded-full ring-1 ring-inset ring-gold/45 text-gold-bright transition-colors hover:bg-gold/10"
              >
                <X size={18} />
              </button>
            </div>

            {signedIn && (
              <div className="relative mx-6 mt-4 flex items-center gap-3 rounded-xl border border-gold/25 bg-navy/40 px-4 py-3">
                <span className="font-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-gold-bright to-gold-deep text-[0.8rem] text-abyss">
                  {(who ?? 'P').charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="font-display text-[1rem] text-offwhite">
                    Hi, {who ?? 'voyager'}
                  </div>
                  <div className="truncate font-log text-[0.6rem] uppercase tracking-wide2 text-parchment/45">
                    {auth.account?.email ?? 'Signed in'}
                  </div>
                </div>
              </div>
            )}

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

              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.06 * NAV.length + 0.1, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link
                  to="/notices"
                  onClick={() => setOpen(false)}
                  className="group relative flex items-center gap-4 rounded-xl px-2 py-3 text-left transition-colors hover:bg-gold/5"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gold/65 ring-1 ring-gold/25">
                    <Megaphone size={15} />
                  </span>
                  <span className="flex-1">
                    <span className="block font-display text-2xl leading-tight text-offwhite transition-colors group-hover:text-gold-bright sm:text-3xl">
                      Noticeboard
                    </span>
                    <span className="mt-0.5 block font-log text-[0.66rem] uppercase tracking-wide2 text-parchment/50">
                      Announcements & results
                    </span>
                  </span>
                  <ArrowRight
                    size={16}
                    className="shrink-0 text-gold/40 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-gold-bright"
                  />
                </Link>
              </motion.div>
            </nav>

            <div
              className="relative space-y-3 px-8 pb-10"
              /* Clear of the home indicator: the sign-in link was landing
                 under the gesture bar on every phone without a bezel. */
              style={{ paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom))' }}
            >
              {signedIn ? (
                <>
                  {headerCta.action === 'register' ? (
                    <button
                      onClick={() => {
                        setOpen(false)
                        openRegister()
                      }}
                      className="font-accent block w-full rounded-full bg-gradient-to-b from-gold-bright to-gold-deep py-4 text-center text-base uppercase tracking-wide2 text-abyss"
                    >
                      {headerCta.label} →
                    </button>
                  ) : (
                    <Link
                      to={headerCta.to ?? '/pass'}
                      onClick={() => setOpen(false)}
                      className="font-accent block w-full rounded-full bg-gradient-to-b from-gold-bright to-gold-deep py-4 text-center text-base uppercase tracking-wide2 text-abyss"
                    >
                      {headerCta.label} →
                    </Link>
                  )}
                  {/* Here as well as on the pass page: signing out should not
                      require finding the page you are signing out of. */}
                  <button
                    onClick={() => void signOut()}
                    className="flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-center font-log text-[0.7rem] uppercase tracking-wide2 text-parchment/60 ring-1 ring-inset ring-gold/30 transition-colors hover:text-coral"
                  >
                    <LogOut size={13} /> Sign out
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setOpen(false)
                      openRegister()
                    }}
                    className="font-accent block w-full rounded-full bg-gradient-to-b from-gold-bright to-gold-deep py-4 text-center text-base uppercase tracking-wide2 text-abyss"
                  >
                    Join the Crew →
                  </button>
                  <Link
                    to="/sign-in"
                    onClick={() => setOpen(false)}
                    className="block w-full rounded-full py-3.5 text-center font-log text-[0.7rem] uppercase tracking-wide2 text-parchment/70 ring-1 ring-inset ring-gold/40"
                  >
                    Already registered? Sign in
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
