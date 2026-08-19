import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { AlertCircle, ArrowLeft, ArrowRight, Check, Loader2, ShieldCheck, Ticket } from 'lucide-react'
import {
  DELEGATE_CATEGORIES,
  DELEGATE_PASSES,
  PRICING_ANNOUNCED,
  type DelegateCategory,
} from '../data/registration'
import { api, IS_MOCK_BACKEND } from './api'
import { payWithRazorpay, paymentsAreLive } from './razorpay'
import { RegistrationError, type Delegate, type DocumentKind, type DocumentRef } from './types'
import { ChipGroup, DocumentUpload, Field, Select, TextInput } from './fields'
import DelegatePass from './DelegatePass'

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const phoneRe = /^[6-9]\d{9}$/

const STEPS = ['Voyager', 'Identity', 'Pass & payment'] as const

type Errors = Record<string, string>

export default function DelegateForm({ onIssued }: { onIssued?: (d: Delegate) => void }) {
  const reduce = useReducedMotion()
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState<Errors>({})
  const [busy, setBusy] = useState(false)
  const [fatal, setFatal] = useState<string | null>(null)
  const [issued, setIssued] = useState<Delegate | null>(null)

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    gender: '',
    category: '' as DelegateCategory | '',
    college: '',
    city: '',
    course: '',
    year: '',
    emergencyName: '',
    emergencyPhone: '',
  })
  const [docs, setDocs] = useState<Partial<Record<DocumentKind, DocumentRef>>>({})
  const [consent, setConsent] = useState(false)
  const [passId, setPassId] = useState(DELEGATE_PASSES.find((p) => p.featured)?.id ?? DELEGATE_PASSES[0].id)

  const set = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => (e[k] ? { ...e, [k]: '' } : e))
  }

  const pass = DELEGATE_PASSES.find((p) => p.id === passId)!

  /* ---------- validation ---------- */

  const validateStep0 = () => {
    const e: Errors = {}
    if (form.name.trim().length < 2) e.name = 'Tell us your name, voyager.'
    if (!emailRe.test(form.email.trim())) e.email = 'A valid email keeps you on the manifest.'
    if (!phoneRe.test(form.phone.replace(/\D/g, ''))) e.phone = 'A 10-digit Indian mobile number.'
    if (!form.category) e.category = 'Pick your delegate type.'
    if (form.college.trim().length < 2) e.college = 'Which port do you sail from?'
    if (form.city.trim().length < 2) e.city = 'Your city.'
    if (form.course.trim().length < 2) e.course = 'e.g. MBBS, BSc Nursing.'
    if (!form.year) e.year = 'Which year?'
    if (form.emergencyName.trim().length < 2) e.emergencyName = 'An emergency contact name.'
    if (!phoneRe.test(form.emergencyPhone.replace(/\D/g, ''))) e.emergencyPhone = 'A 10-digit number.'
    if (form.emergencyPhone.replace(/\D/g, '') === form.phone.replace(/\D/g, '') && form.phone)
      e.emergencyPhone = 'Use someone other than yourself.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const validateStep1 = () => {
    const e: Errors = {}
    if (!docs.aadhaar) e.aadhaar = 'Upload your Aadhaar to continue.'
    if (!docs.studentId) e.studentId = 'Upload your student / institute ID.'
    if (!consent) e.consent = 'We need your consent to store these documents.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const next = () => {
    if (step === 0 && validateStep0()) setStep(1)
    else if (step === 1 && validateStep1()) setStep(2)
  }

  /* ---------- submit + pay ---------- */

  const submit = async () => {
    setBusy(true)
    setFatal(null)
    try {
      const { delegate, order } = await api.createDelegate({
        ...form,
        category: form.category as DelegateCategory,
        phone: form.phone.replace(/\D/g, ''),
        emergencyPhone: form.emergencyPhone.replace(/\D/g, ''),
        passId,
        documents: docs,
        consent,
      })
      const payment = await payWithRazorpay(order, {
        name: form.name,
        email: form.email,
        contact: form.phone,
      })
      const confirmed = await api.confirmDelegatePayment(delegate.delegateId, payment)
      setIssued(confirmed)
      onIssued?.(confirmed)
    } catch (err) {
      setFatal(
        err instanceof RegistrationError
          ? err.message
          : 'Something went wrong on the crossing. Please try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  /* ---------- issued pass ---------- */

  if (issued) {
    return (
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="py-2"
      >
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-b from-gold-bright to-gold-deep">
            <Check size={26} className="text-abyss" />
          </div>
          <h3 className="mt-4 font-display text-2xl text-foil">You're aboard, {issued.name.split(' ')[0]}.</h3>
          <p className="mx-auto mt-2 max-w-sm text-[0.9rem] text-parchment/70">
            Your delegate pass is issued. Use pass number{' '}
            <span className="text-gold-bright">{issued.delegateId}</span> when you enter individual
            events.
          </p>
        </div>
        <DelegatePass delegate={issued} />
      </motion.div>
    )
  }

  /* ---------- form ---------- */

  return (
    <div>
      {/* step rail */}
      <ol className="mb-7 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display text-[0.7rem] transition-colors ${
                step > i
                  ? 'bg-aqua/25 text-aqua ring-1 ring-inset ring-aqua/60'
                  : step === i
                    ? 'bg-gold-bright text-abyss'
                    : 'text-parchment/45 ring-1 ring-inset ring-gold/30'
              }`}
            >
              {step > i ? <Check size={13} /> : i + 1}
            </span>
            <span
              className={`hidden truncate font-display text-[0.62rem] uppercase tracking-wide2 sm:block ${
                step === i ? 'text-gold-bright' : 'text-parchment/45'
              }`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-gold/20" />}
          </li>
        ))}
      </ol>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={reduce ? false : { opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduce ? undefined : { opacity: 0, x: -18 }}
          transition={{ duration: 0.28 }}
        >
          {/* ---------------- step 0 : who you are ---------------- */}
          {step === 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Full name" required error={errors.name}>
                  <TextInput
                    value={form.name}
                    onChange={(v) => set('name', v)}
                    invalid={!!errors.name}
                    placeholder="As it appears on your ID"
                    autoComplete="name"
                  />
                </Field>
              </div>
              <Field label="Email" required error={errors.email}>
                <TextInput
                  value={form.email}
                  onChange={(v) => set('email', v)}
                  invalid={!!errors.email}
                  type="email"
                  placeholder="you@college.edu"
                  autoComplete="email"
                />
              </Field>
              <Field label="Mobile" required error={errors.phone}>
                <TextInput
                  value={form.phone}
                  onChange={(v) => set('phone', v)}
                  invalid={!!errors.phone}
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="10 digits"
                  autoComplete="tel"
                />
              </Field>

              <div className="sm:col-span-2">
                <Field label="Delegate type" required error={errors.category}>
                  <ChipGroup
                    value={form.category}
                    onChange={(v) => set('category', v)}
                    options={DELEGATE_CATEGORIES}
                  />
                </Field>
              </div>

              <Field label="College / institution" required error={errors.college}>
                <TextInput
                  value={form.college}
                  onChange={(v) => set('college', v)}
                  invalid={!!errors.college}
                  placeholder="e.g. AIIMS Rishikesh"
                />
              </Field>
              <Field label="City" required error={errors.city}>
                <TextInput
                  value={form.city}
                  onChange={(v) => set('city', v)}
                  invalid={!!errors.city}
                  placeholder="e.g. Dehradun"
                />
              </Field>
              <Field label="Course" required error={errors.course}>
                <TextInput
                  value={form.course}
                  onChange={(v) => set('course', v)}
                  invalid={!!errors.course}
                  placeholder="e.g. MBBS"
                />
              </Field>
              <Field label="Year of study" required error={errors.year}>
                <Select
                  value={form.year}
                  onChange={(v) => set('year', v)}
                  invalid={!!errors.year}
                  options={['1st', '2nd', '3rd', '4th', '5th', 'Intern', 'Postgraduate', 'Not a student']}
                />
              </Field>
              <Field label="Gender" hint="Used for accommodation allocation.">
                <Select
                  value={form.gender}
                  onChange={(v) => set('gender', v)}
                  options={['Female', 'Male', 'Other', 'Prefer not to say']}
                />
              </Field>
              <div className="hidden sm:block" />

              <Field label="Emergency contact name" required error={errors.emergencyName}>
                <TextInput
                  value={form.emergencyName}
                  onChange={(v) => set('emergencyName', v)}
                  invalid={!!errors.emergencyName}
                  placeholder="Parent, guardian or friend"
                />
              </Field>
              <Field label="Emergency contact number" required error={errors.emergencyPhone}>
                <TextInput
                  value={form.emergencyPhone}
                  onChange={(v) => set('emergencyPhone', v)}
                  invalid={!!errors.emergencyPhone}
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="10 digits"
                />
              </Field>
            </div>
          )}

          {/* ---------------- step 1 : identity ---------------- */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="flex gap-3 rounded-lg border border-gold/25 bg-ocean/40 p-4">
                <ShieldCheck size={18} className="mt-0.5 shrink-0 text-gold-bright" />
                <p className="text-[0.82rem] leading-relaxed text-parchment/75">
                  These documents are checked once at the gate and are visible only to the core team.
                  They are never shown on the site and never shared with sponsors.
                </p>
              </div>

              <DocumentUpload
                kind="aadhaar"
                label="Aadhaar card"
                hint="Front side. JPG, PNG, WEBP or PDF, up to 8 MB."
                value={docs.aadhaar}
                error={errors.aadhaar}
                onChange={(ref) => {
                  setDocs((d) => ({ ...d, aadhaar: ref }))
                  setErrors((e) => ({ ...e, aadhaar: '' }))
                }}
              />

              <DocumentUpload
                kind="studentId"
                label="Student / institute ID"
                hint="Must show your name, photo and institution."
                value={docs.studentId}
                error={errors.studentId}
                onChange={(ref) => {
                  setDocs((d) => ({ ...d, studentId: ref }))
                  setErrors((e) => ({ ...e, studentId: '' }))
                }}
              />

              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => {
                    setConsent(e.target.checked)
                    setErrors((x) => ({ ...x, consent: '' }))
                  }}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#c89b3c]"
                />
                <span className="text-[0.82rem] leading-relaxed text-parchment/75">
                  I consent to PYREXIA 2026, AIIMS Rishikesh storing these documents for the sole
                  purpose of verifying my identity at the fest, and to their deletion afterwards.
                </span>
              </label>
              {errors.consent && (
                <span className="flex items-center gap-1 text-[0.72rem] text-coral">
                  <AlertCircle size={12} /> {errors.consent}
                </span>
              )}
            </div>
          )}

          {/* ---------------- step 2 : pass + payment ---------------- */}
          {step === 2 && (
            <div className="space-y-5">
              {!PRICING_ANNOUNCED && (
                <div className="flex gap-3 rounded-lg border border-ember/40 bg-ember/10 p-4">
                  <AlertCircle size={17} className="mt-0.5 shrink-0 text-ember" />
                  <p className="text-[0.82rem] leading-relaxed text-parchment/80">
                    Fees below are <strong className="text-ember">provisional</strong> and will be
                    confirmed before registrations open.
                  </p>
                </div>
              )}

              <div className="grid gap-3">
                {DELEGATE_PASSES.map((p) => {
                  const on = p.id === passId
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPassId(p.id)}
                      className={`rounded-xl border p-4 text-left transition-colors ${
                        on ? 'border-gold/70 bg-gold/10' : 'border-gold/20 bg-ocean/40 hover:border-gold/45'
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-display text-lg text-offwhite">{p.name}</span>
                        <span className="font-display text-lg text-gold-bright">₹{p.amount}</span>
                      </div>
                      <p className="mt-1 text-[0.82rem] text-parchment/65">{p.blurb}</p>
                      <ul className="mt-2.5 grid gap-1">
                        {p.includes.map((inc) => (
                          <li key={inc} className="flex items-center gap-2 text-[0.78rem] text-parchment/70">
                            <Check size={12} className="shrink-0 text-aqua" />
                            {inc}
                          </li>
                        ))}
                      </ul>
                    </button>
                  )
                })}
              </div>

              <div className="rounded-xl border border-gold/25 bg-ocean/50 p-4">
                <div className="flex items-center justify-between font-display text-[0.7rem] uppercase tracking-wide2 text-parchment/60">
                  <span>{pass.name}</span>
                  <span>₹{pass.amount}</span>
                </div>
                <div className="my-3 rule-gold" />
                <div className="flex items-center justify-between">
                  <span className="font-display text-[0.8rem] uppercase tracking-wide2 text-parchment/80">
                    Total
                  </span>
                  <span className="font-display text-2xl text-foil">₹{pass.amount}</span>
                </div>
              </div>

              {!paymentsAreLive && (
                <p className="text-[0.75rem] leading-relaxed text-parchment/50">
                  No payment gateway is connected yet, so this checkout is{' '}
                  <strong className="text-parchment/70">simulated</strong> — no money moves
                  {IS_MOCK_BACKEND && ', and the record is kept only in this browser'}.
                </p>
              )}

              {fatal && (
                <div className="flex items-start gap-2 rounded-lg border border-coral/50 bg-coral/10 p-3 text-[0.82rem] text-coral">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  {fatal}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* nav */}
      <div className="mt-7 flex items-center gap-3">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-full px-5 py-3 font-display text-[0.68rem] uppercase tracking-wide2 text-parchment/70 ring-1 ring-inset ring-gold/40 transition-colors hover:text-gold-bright hover:ring-gold/80 disabled:opacity-40"
          >
            <ArrowLeft size={13} /> Back
          </button>
        )}
        <button
          type="button"
          onClick={step === 2 ? submit : next}
          disabled={busy}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep py-3.5 font-display text-[0.72rem] uppercase tracking-wide2 text-abyss transition-transform hover:scale-[1.01] disabled:opacity-60"
        >
          {busy ? (
            <>
              <Loader2 size={15} className="animate-spin" /> Processing…
            </>
          ) : step === 2 ? (
            <>
              <Ticket size={15} /> Pay ₹{pass.amount} & get my pass
            </>
          ) : (
            <>
              Continue <ArrowRight size={14} />
            </>
          )}
        </button>
      </div>
    </div>
  )
}
