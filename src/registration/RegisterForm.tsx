import { useMemo, useState, type ReactNode } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Check, ChevronRight, Anchor, PartyPopper, Search } from 'lucide-react'
import { territories } from '../data/events'
import { Icon } from '../lib/icons'

type Delegate = 'AIIMS Rishikesh Student' | 'Outstation Delegate' | 'Faculty' | 'Guest'

const delegateTypes: Delegate[] = [
  'AIIMS Rishikesh Student',
  'Outstation Delegate',
  'Faculty',
  'Guest',
]

const allEvents = territories.flatMap((t) =>
  t.events.map((e) => ({ name: e.name, tag: e.tag, terr: t.code, icon: t.icon, accent: t.accent })),
)

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const phoneRe = /^[6-9]\d{9}$/

export default function RegisterForm({
  preselected = [],
  onDone,
  compact = false,
}: {
  preselected?: string[]
  onDone?: () => void
  compact?: boolean
}) {
  const reduce = useReducedMotion()
  const [step, setStep] = useState(0)
  const [done, setDone] = useState(false)
  const [query, setQuery] = useState('')

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    college: '',
    delegate: '' as Delegate | '',
  })
  const [events, setEvents] = useState<string[]>(preselected)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const toggleEvent = (name: string) =>
    setEvents((e) => (e.includes(name) ? e.filter((x) => x !== name) : [...e, name]))

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allEvents
    return allEvents.filter(
      (e) => e.name.toLowerCase().includes(q) || e.terr.toLowerCase().includes(q) || e.tag.toLowerCase().includes(q),
    )
  }, [query])

  const validateStep0 = () => {
    const err: Record<string, string> = {}
    if (form.name.trim().length < 2) err.name = 'Tell us your name, voyager.'
    if (!emailRe.test(form.email)) err.email = 'A valid email keeps you on the manifest.'
    if (!phoneRe.test(form.phone)) err.phone = 'A 10-digit Indian mobile number.'
    if (form.college.trim().length < 2) err.college = 'Which port do you sail from?'
    if (!form.delegate) err.delegate = 'Pick your delegate type.'
    setErrors(err)
    return Object.keys(err).length === 0
  }

  const next = () => {
    if (validateStep0()) setStep(1)
  }

  const submit = () => {
    const record = { ...form, events, at: new Date().toISOString() }
    try {
      const prev = JSON.parse(localStorage.getItem('pyrexia_registrations') || '[]')
      prev.push(record)
      localStorage.setItem('pyrexia_registrations', JSON.stringify(prev))
    } catch {
      /* storage optional */
    }
    setDone(true)
  }

  /* ---------- Success ---------- */
  if (done) {
    return (
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center py-10 text-center"
      >
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-b from-gold-bright to-gold-deep">
          <Anchor size={34} className="text-abyss" />
        </div>
        <h3 className="mt-6 font-display text-3xl text-foil">Welcome aboard, {form.name.split(' ')[0]}!</h3>
        <p className="mt-3 max-w-sm text-parchment/70">
          Your place on the crew is charted. You've signed up for{' '}
          <span className="text-gold-bright">{events.length || 'the'} </span>
          {events.length === 1 ? 'event' : 'events'}. Keep an eye on your inbox — the island will call.
        </p>
        {events.length > 0 && (
          <div className="mt-5 flex max-w-md flex-wrap justify-center gap-2">
            {events.slice(0, 8).map((e) => (
              <span key={e} className="rounded-full border border-gold/25 bg-ocean/50 px-3 py-1 text-[0.72rem] text-parchment/85">
                {e}
              </span>
            ))}
            {events.length > 8 && <span className="px-2 py-1 text-[0.72rem] text-parchment/60">+{events.length - 8} more</span>}
          </div>
        )}
        <p className="mt-6 font-log text-[0.58rem] uppercase tracking-cinema text-parchment/40">
          Demo capture · connect a backend or Google Form to collect live entries
        </p>
        <button
          onClick={onDone}
          className="mt-6 rounded-full px-6 py-3 font-log text-[0.68rem] uppercase tracking-wide2 text-gold-bright ring-1 ring-gold/40 hover:bg-gold/10"
        >
          Close
        </button>
      </motion.div>
    )
  }

  const inputCls =
    'w-full rounded-lg border border-gold/20 bg-ocean/60 px-4 py-3 text-offwhite placeholder:text-parchment/35 outline-none transition-colors focus:border-gold/60'

  return (
    <div>
      {/* step header */}
      <div className="mb-6 flex items-center gap-3">
        {['The Crew', 'Choose Events'].map((s, i) => (
          <div key={s} className="flex items-center gap-3">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full font-log text-[0.7rem] transition-colors ${
                step >= i ? 'bg-gold-bright text-abyss' : 'ring-1 ring-gold/30 text-parchment/50'
              }`}
            >
              {step > i ? <Check size={13} /> : i + 1}
            </span>
            <span className={`font-log text-[0.66rem] uppercase tracking-wide2 ${step >= i ? 'text-gold-bright' : 'text-parchment/45'}`}>
              {s}
            </span>
            {i === 0 && <span className="mx-1 h-px w-6 bg-gold/25 sm:w-10" />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 0 ? (
          <motion.div
            key="s0"
            initial={reduce ? false : { opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? undefined : { opacity: 0, x: -16 }}
            transition={{ duration: 0.3 }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <Field label="Full name" error={errors.name}>
              <input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Captain Jack…" />
            </Field>
            <Field label="Email" error={errors.email}>
              <input className={inputCls} value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="you@college.edu" inputMode="email" />
            </Field>
            <Field label="Mobile" error={errors.phone}>
              <input className={inputCls} value={form.phone} onChange={(e) => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="98765 43210" inputMode="numeric" />
            </Field>
            <Field label="College / Institution" error={errors.college}>
              <input className={inputCls} value={form.college} onChange={(e) => set('college', e.target.value)} placeholder="Your port of origin" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Delegate type" error={errors.delegate}>
                <div className="flex flex-wrap gap-2">
                  {delegateTypes.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => set('delegate', d)}
                      className={`rounded-full px-4 py-2 text-[0.78rem] transition-colors ${
                        form.delegate === d
                          ? 'bg-gold/15 text-gold-bright ring-1 ring-gold/50'
                          : 'text-parchment/65 ring-1 ring-gold/20 hover:ring-gold/40'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </Field>
            </div>

            <div className="mt-2 sm:col-span-2">
              <button
                onClick={next}
                className="group flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep py-4 text-[0.8rem] font-semibold uppercase tracking-wide2 text-abyss transition-transform hover:scale-[1.01]"
              >
                Continue to Events
                <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="s1"
            initial={reduce ? false : { opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? undefined : { opacity: 0, x: 16 }}
            transition={{ duration: 0.3 }}
          >
            <div className="relative mb-3">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-parchment/40" />
              <input
                className={`${inputCls} pl-10`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search 60+ events…"
              />
            </div>
            <div className={`grid grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 ${compact ? 'max-h-[38vh]' : 'max-h-80'}`}>
              {filtered.map((e) => {
                const on = events.includes(e.name)
                return (
                  <button
                    key={e.terr + e.name}
                    type="button"
                    onClick={() => toggleEvent(e.name)}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      on ? 'border-gold/50 bg-gold/10' : 'border-gold/12 bg-ocean/40 hover:border-gold/30'
                    }`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md" style={{ background: `${e.accent}1f` }}>
                      <Icon name={e.icon} size={14} style={{ color: e.accent }} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.86rem] text-offwhite">{e.name}</span>
                      <span className="block truncate font-log text-[0.56rem] uppercase tracking-wide2 text-parchment/45">
                        {e.terr}
                      </span>
                    </span>
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        on ? 'border-gold-bright bg-gold-bright text-abyss' : 'border-gold/30'
                      }`}
                    >
                      {on && <Check size={12} />}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                onClick={() => setStep(0)}
                className="rounded-full px-5 py-3 font-log text-[0.68rem] uppercase tracking-wide2 text-parchment/70 ring-1 ring-gold/20 hover:ring-gold/40"
              >
                Back
              </button>
              <span className="font-log text-[0.62rem] uppercase tracking-wide2 text-parchment/55">
                {events.length} selected
              </span>
              <button
                onClick={submit}
                className="group flex items-center gap-2 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep px-6 py-3 text-[0.78rem] font-semibold uppercase tracking-wide2 text-abyss transition-transform hover:scale-[1.02]"
              >
                <PartyPopper size={15} />
                Join the Crew
              </button>
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
      <span className="mb-1.5 block font-log text-[0.6rem] uppercase tracking-wide2 text-parchment/55">{label}</span>
      {children}
      {error && <span className="mt-1 block text-[0.72rem] text-blood/90" style={{ color: '#e0894a' }}>{error}</span>}
    </label>
  )
}
