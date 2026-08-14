import { useMemo, useState, type ReactNode } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Check, ChevronRight, PartyPopper, Search } from 'lucide-react'
import { territories } from '../data/events'
import { Icon } from '../lib/icons'
import { Coin } from '../components/art'

type Delegate = 'AIIMS Rishikesh Student' | 'Outstation Delegate' | 'Faculty' | 'Guest'
const delegateTypes: Delegate[] = ['AIIMS Rishikesh Student', 'Outstation Delegate', 'Faculty', 'Guest']
const allEvents = territories.flatMap((t) => t.events.map((e) => ({ name: e.name, tag: e.tag, terr: t.code, icon: t.icon, accent: t.accent })))
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const phoneRe = /^[6-9]\d{9}$/

export default function RegisterForm({ preselected = [], onDone, compact = false }: { preselected?: string[]; onDone?: () => void; compact?: boolean }) {
  const reduce = useReducedMotion()
  const [step, setStep] = useState(0)
  const [done, setDone] = useState(false)
  const [query, setQuery] = useState('')
  const [form, setForm] = useState({ name: '', email: '', phone: '', college: '', delegate: '' as Delegate | '' })
  const [events, setEvents] = useState<string[]>(preselected)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const toggleEvent = (name: string) => setEvents((e) => (e.includes(name) ? e.filter((x) => x !== name) : [...e, name]))
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return !q ? allEvents : allEvents.filter((e) => e.name.toLowerCase().includes(q) || e.terr.toLowerCase().includes(q) || e.tag.toLowerCase().includes(q))
  }, [query])

  const validate0 = () => {
    const err: Record<string, string> = {}
    if (form.name.trim().length < 2) err.name = 'Tell us your name, voyager!'
    if (!emailRe.test(form.email)) err.email = 'A valid email keeps you on the manifest.'
    if (!phoneRe.test(form.phone)) err.phone = 'A 10-digit Indian mobile number.'
    if (form.college.trim().length < 2) err.college = 'Which port do you sail from?'
    if (!form.delegate) err.delegate = 'Pick your delegate type.'
    setErrors(err)
    return Object.keys(err).length === 0
  }
  const submit = () => {
    try {
      const prev = JSON.parse(localStorage.getItem('pyrexia_registrations') || '[]')
      prev.push({ ...form, events, at: new Date().toISOString() })
      localStorage.setItem('pyrexia_registrations', JSON.stringify(prev))
    } catch { /* optional */ }
    setDone(true)
  }

  if (done) {
    return (
      <motion.div initial={reduce ? false : { opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ ease: [0.34, 1.56, 0.64, 1] }} className="flex flex-col items-center py-8 text-center">
        <div className="flex gap-1.5"><Coin size={34} className="anim-bob" /><Coin size={34} className="anim-bob" style={{ animationDelay: '.2s' }} /><Coin size={34} className="anim-bob" style={{ animationDelay: '.4s' }} /></div>
        <h3 className="mt-4 font-display text-3xl text-sea-deep">Welcome aboard, {form.name.split(' ')[0]}!</h3>
        <p className="mt-2 max-w-sm font-fun text-ink/75">You've signed up for <span className="font-bold text-coral">{events.length || 'the'}</span> {events.length === 1 ? 'event' : 'events'}. Keep an eye on your inbox — the island will call!</p>
        {events.length > 0 && (
          <div className="mt-4 flex max-w-md flex-wrap justify-center gap-2">
            {events.slice(0, 8).map((e) => <span key={e} className="sticker-sm rounded-full bg-cream-soft px-3 py-1 font-fun text-sm font-semibold text-ink">{e}</span>)}
            {events.length > 8 && <span className="px-2 py-1 font-hand text-lg text-ink/60">+{events.length - 8} more</span>}
          </div>
        )}
        <p className="mt-5 font-hand text-base text-ink/50">Demo capture · connect a backend or Google Form to collect live entries</p>
        <button onClick={onDone} className="sticker-sm sticker-press mt-5 rounded-full bg-sun px-6 py-2.5 font-display text-sm text-ink">Close</button>
      </motion.div>
    )
  }

  const inputCls = 'sticker-sm w-full rounded-2xl bg-cream-soft px-4 py-3 font-fun font-semibold text-ink placeholder:text-ink/40 outline-none'

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        {['The Crew', 'Choose Events'].map((s, i) => (
          <div key={s} className="flex items-center gap-3">
            <span className={`sticker-sm flex h-8 w-8 items-center justify-center rounded-full font-display text-sm ${step >= i ? 'bg-coral text-cream' : 'bg-cream text-ink/50'}`}>{step > i ? <Check size={14} strokeWidth={3} /> : i + 1}</span>
            <span className={`font-fun text-sm font-bold ${step >= i ? 'text-coral' : 'text-ink/45'}`}>{s}</span>
            {i === 0 && <span className="mx-1 h-1 w-6 rounded-full bg-ink/20 sm:w-10" />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 0 ? (
          <motion.div key="s0" initial={reduce ? false : { opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={reduce ? undefined : { opacity: 0, x: -16 }} transition={{ duration: 0.25 }} className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" error={errors.name}><input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Captain Jack…" /></Field>
            <Field label="Email" error={errors.email}><input className={inputCls} value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="you@college.edu" inputMode="email" /></Field>
            <Field label="Mobile" error={errors.phone}><input className={inputCls} value={form.phone} onChange={(e) => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="98765 43210" inputMode="numeric" /></Field>
            <Field label="College / Institution" error={errors.college}><input className={inputCls} value={form.college} onChange={(e) => set('college', e.target.value)} placeholder="Your port of origin" /></Field>
            <div className="sm:col-span-2">
              <Field label="Delegate type" error={errors.delegate}>
                <div className="flex flex-wrap gap-2">
                  {delegateTypes.map((d) => (
                    <button key={d} type="button" onClick={() => set('delegate', d)} className={`sticker-sm rounded-full px-4 py-2 font-fun text-sm font-semibold ${form.delegate === d ? 'bg-sun text-ink' : 'bg-cream text-ink/70'}`}>{d}</button>
                  ))}
                </div>
              </Field>
            </div>
            <div className="mt-1 sm:col-span-2">
              <button onClick={() => validate0() && setStep(1)} className="sticker sticker-press flex w-full items-center justify-center gap-2 rounded-full bg-coral py-3.5 font-display text-base text-cream">
                Continue to Events <ChevronRight size={18} strokeWidth={3} />
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="s1" initial={reduce ? false : { opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={reduce ? undefined : { opacity: 0, x: 16 }} transition={{ duration: 0.25 }}>
            <div className="relative mb-3">
              <Search size={16} strokeWidth={2.5} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/45" />
              <input className={`${inputCls} pl-11`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search 60+ events…" />
            </div>
            <div className={`grid grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 ${compact ? 'max-h-[36vh]' : 'max-h-80'}`}>
              {filtered.map((e) => {
                const on = events.includes(e.name)
                return (
                  <button key={e.terr + e.name} type="button" onClick={() => toggleEvent(e.name)} className={`sticker-sm flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left ${on ? 'bg-sun' : 'bg-cream-soft'}`}>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: e.accent }}><Icon name={e.icon} size={14} strokeWidth={2.5} style={{ color: '#fff' }} /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate font-fun font-semibold text-ink">{e.name}</span><span className="block truncate font-hand text-base text-ink/55">{e.terr}</span></span>
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-ink ${on ? 'bg-ink text-cream' : 'bg-cream'}`}>{on && <Check size={12} strokeWidth={3} />}</span>
                  </button>
                )
              })}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <button onClick={() => setStep(0)} className="sticker-sm rounded-full bg-cream px-5 py-2.5 font-display text-sm text-ink">Back</button>
              <span className="font-hand text-lg text-ink/60">{events.length} selected</span>
              <button onClick={submit} className="sticker sticker-press flex items-center gap-2 rounded-full bg-coral px-6 py-2.5 font-display text-sm text-cream"><PartyPopper size={15} strokeWidth={2.5} /> Join the Crew</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-hand text-lg text-ink/70">{label}</span>
      {children}
      {error && <span className="mt-1 block font-fun text-sm font-semibold text-red">{error}</span>}
    </label>
  )
}
