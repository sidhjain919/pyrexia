import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useRegistration } from '../registration/context'
import DelegateForm from '../registration/DelegateForm'
import EventForm from '../registration/EventForm'
import { Compass } from './primitives'
import { sectionPhoto } from '../data/media'
import { resolveEvent } from '../data/registration'
import { isSignedIn } from '../api/client'
import { Link } from 'react-router-dom'
import { LogIn, Ticket } from 'lucide-react'

export default function RegisterModal() {
  const { open, mode, eventName, openDelegate, closeRegister } = useRegistration()
  // The event flow can hand off to the delegate flow ("get a pass first") without
  // losing the event the visitor came from.
  const [returnTo, setReturnTo] = useState<string | null>(null)
  const signedIn = isSignedIn()

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRegister()
    if (open) window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open, closeRegister])

  useEffect(() => {
    if (!open) setReturnTo(null)
  }, [open])

  const resolved = eventName ? resolveEvent(eventName) : null
  const isEvent = mode === 'event' && !!resolved

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[3000] flex items-start justify-center overflow-y-auto bg-abyss/85 p-4 backdrop-blur-md sm:items-center sm:p-8"
          onClick={closeRegister}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={isEvent ? `Register for ${eventName}` : 'Fest registration'}
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="glass grain relative my-auto w-full max-w-2xl overflow-hidden rounded-2xl shadow-cinema"
          >
            {/* header band with photo */}
            <div className="relative h-28 overflow-hidden sm:h-32">
              <img src={sectionPhoto.register} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-ocean via-ocean/70 to-ocean/30" />
              <div className="pointer-events-none absolute -right-6 -top-6 opacity-20">
                <Compass size={130} />
              </div>
              <button
                onClick={closeRegister}
                aria-label="Close"
                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-abyss/50 text-gold-bright ring-1 ring-inset ring-gold/45 hover:bg-abyss/80"
              >
                <X size={16} />
              </button>
              <div className="absolute bottom-4 left-6 right-16">
                <div className="font-log text-[0.72rem] uppercase tracking-cinema text-gold/80">
                  {isEvent ? 'Event Entry' : 'Join the Voyage'}
                </div>
                <h2 className="truncate font-display text-[1.3rem] text-offwhite sm:text-3xl">
                  {isEvent ? eventName : 'Fest Registration'}
                </h2>
              </div>
            </div>

            <div className="max-h-[68vh] overflow-y-auto p-6 sm:p-8">
              {isEvent ? (
                <EventForm
                  key={eventName}
                  eventName={eventName!}
                  onNeedRegistration={() => {
                    setReturnTo(eventName)
                    openDelegate()
                  }}
                />
              ) : signedIn ? (
                <DelegateForm key={returnTo ?? 'delegate'} />
              ) : (
                /* Buying requires an account, so ask for one before the form
                   rather than after — filling ten fields and then being told to
                   sign in is the worst possible ordering. */
                <div className="py-2">
                  <p className="text-[0.94rem] leading-relaxed text-parchment/75">
                    Basic Registration is tied to an account, so we know whose pass is whose and you
                    can get back to it later. It takes two fields.
                  </p>

                  <div className="mt-6 flex flex-col gap-2.5">
                    <Link
                      to="/sign-in?new=1&next=%2Fregister"
                      onClick={closeRegister}
                      className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep py-3.5 font-log text-[0.7rem] uppercase tracking-wide2 text-abyss"
                    >
                      <Ticket size={15} /> Create an account
                    </Link>
                    <Link
                      to="/sign-in?next=%2Fregister"
                      onClick={closeRegister}
                      className="flex items-center justify-center gap-2 rounded-full px-6 py-3.5 font-log text-[0.7rem] uppercase tracking-wide2 text-gold-bright ring-1 ring-inset ring-gold/55 transition-colors hover:bg-gold/10"
                    >
                      <LogIn size={15} /> I already have one
                    </Link>
                  </div>

                  <p className="mt-6 text-[0.78rem] leading-relaxed text-parchment/45">
                    Creating an account is free. Basic Registration is ₹450 and comes straight
                    after.
                  </p>
                </div>
              )}

              {!isEvent && returnTo && (
                <p className="mt-6 text-center text-[0.8rem] text-parchment/60">
                  Once your registration is confirmed, head back to{' '}
                  <span className="text-gold-bright">{returnTo}</span>.
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
