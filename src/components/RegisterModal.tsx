import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useRegistration } from '../registration/context'
import RegisterForm from '../registration/RegisterForm'
import { Compass } from './primitives'
import { sectionPhoto } from '../data/media'

export default function RegisterModal() {
  const { open, preselected, closeRegister } = useRegistration()

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRegister()
    if (open) window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open, closeRegister])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[3000] flex items-center justify-center overflow-y-auto bg-abyss/85 p-4 backdrop-blur-md sm:p-8"
          onClick={closeRegister}
        >
          <motion.div
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
              <div className="absolute bottom-4 left-6">
                <div className="font-display text-[0.72rem] uppercase tracking-cinema text-gold/80">Join the Voyage</div>
                <h2 className="font-display text-2xl text-offwhite sm:text-3xl">Register for PYREXIA 2026</h2>
              </div>
            </div>

            <div className="max-h-[62vh] overflow-y-auto p-6 sm:p-8">
              <RegisterForm preselected={preselected} onDone={closeRegister} compact />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
