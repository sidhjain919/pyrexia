import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useRegistration } from '../registration/context'
import RegisterForm from '../registration/RegisterForm'
import { Sun, Palm } from './art'

export default function RegisterModal() {
  const { open, preselected, closeRegister } = useRegistration()
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRegister()
    if (open) window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey) }
  }, [open, closeRegister])

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[3000] flex items-center justify-center overflow-y-auto bg-ink/70 p-4 backdrop-blur-sm sm:p-8" onClick={closeRegister}>
          <motion.div initial={{ opacity: 0, y: 30, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.97 }} transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }} onClick={(e) => e.stopPropagation()}
            className="sticker-lg relative my-auto w-full max-w-2xl overflow-hidden rounded-3xl bg-cream">
            <div className="relative h-24 overflow-hidden border-b-[3px] border-ink sm:h-28" style={{ background: 'linear-gradient(180deg,#7fd3e0 0%, #ffe6a8 100%)' }}>
              <Sun size={90} className="absolute -right-2 -top-2 anim-sun" />
              <Palm size={110} className="absolute -bottom-2 -left-2 anim-sway" />
              <button onClick={closeRegister} aria-label="Close" className="sticker-sm absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-coral text-cream"><X size={16} strokeWidth={3} /></button>
              <div className="absolute bottom-3 left-6">
                <div className="font-hand text-xl text-red">Join the Voyage</div>
                <h2 className="font-display text-2xl text-ink sm:text-3xl">Register for PYREXIA 2026</h2>
              </div>
            </div>
            <div className="max-h-[62vh] overflow-y-auto p-6 sm:p-8"><RegisterForm preselected={preselected} onDone={closeRegister} compact /></div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
