import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { AlertCircle, ArrowLeft, ArrowRight, Check, Loader2, Star, Ticket, X } from 'lucide-react'

import {
  ApiError,
  api,
  newIdempotencyKey,
  waitForConfirmation,
  type Product,
  type RegistrationInput,
} from '../api/client'
import { openCheckout, PaymentCancelled } from './razorpay'
import { Field, Select, TextInput } from './fields'

/**
 * Registration.
 *
 * Two steps, not three. The identity-document step used to sit between details
 * and payment; it now happens *after* payment, from the pass page. Blocking a
 * ₹450 payment on someone finding a photo of their college ID loses
 * registrations for no benefit — the documents are checked at the gate either
 * way, and an unverified payer is far easier to chase than an abandoned one.
 */

const STEPS = ['Your details', 'Registration & payment'] as const

type Phase =
  | { name: 'form' }
  | { name: 'paying' }
  /** Payment taken; waiting for the webhook to issue the pass. */
  | { name: 'confirming'; orderId: string }
  | { name: 'done'; publicCode: string; tierName: string }
  /** Paid, but the webhook hasn't landed within the polling window. */
  | { name: 'slow'; publicCode: string }

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`

export default function DelegateForm() {
  const reduce = useReducedMotion()
  const [step, setStep] = useState(0)
  const [phase, setPhase] = useState<Phase>({ name: 'form' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [fatal, setFatal] = useState<string | null>(null)
  const [emailFix, setEmailFix] = useState<string | null>(null)

  const [products, setProducts] = useState<Product[]>([])
  const [wantsDelegate, setWantsDelegate] = useState(false)

  const [form, setForm] = useState<RegistrationInput>({
    name: '',
    email: '',
    phone: '',
    gender: '',
    college: '',
    city: '',
    course: '',
    year: '',
    emergencyName: '',
    emergencyPhone: '',
  })

  // One key per attempt, so a retry after a network wobble is recognised as the
  // same request rather than becoming a second registration.
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey)

  useEffect(() => {
    api.products().then(setProducts).catch(() => setProducts([]))
  }, [])

  const basic = products.find((p) => p.id === 'basic')
  const delegate = products.find((p) => p.id === 'delegate')

  const totalPaise = useMemo(
    () => (basic?.amountPaise ?? 0) + (wantsDelegate ? (delegate?.amountPaise ?? 0) : 0),
    [basic, delegate, wantsDelegate],
  )

  const set = (k: keyof RegistrationInput, v: string) => {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => (e[k] ? { ...e, [k]: '' } : e))
  }

  /* ---------- submit ---------- */

  const submit = async () => {
    setFatal(null)
    setErrors({})
    setPhase({ name: 'paying' })

    let created
    try {
      created = await api.register(
        { ...form, products: wantsDelegate ? ['basic', 'delegate'] : ['basic'] },
        idempotencyKey,
      )
    } catch (err) {
      setPhase({ name: 'form' })

      if (err instanceof ApiError) {
        if (err.fields) {
          setErrors(err.fields)
          setEmailFix((err.extra.emailSuggestion as string) ?? null)
          setStep(0)
          return
        }
        if (err.code === 'already_registered') {
          setFatal(err.message)
          return
        }
        setFatal(err.message)
        return
      }
      setFatal('Something went wrong. Please try again.')
      return
    }

    try {
      const result = await openCheckout(created.checkout)

      // Makes the success screen instant. It grants nothing — the webhook does.
      await api.verifyCheckout(result).catch(() => {})

      setPhase({ name: 'confirming', orderId: created.orderId })

      const confirmed = await waitForConfirmation(created.orderId)
      if (confirmed) {
        setPhase({
          name: 'done',
          publicCode: created.publicCode ?? '',
          tierName: wantsDelegate ? 'Delegate Card' : 'Basic Registration',
        })
      } else {
        setPhase({ name: 'slow', publicCode: created.publicCode ?? '' })
      }
    } catch (err) {
      setPhase({ name: 'form' })
      setStep(1)

      if (err instanceof PaymentCancelled) {
        // Not an error worth alarming them about. The order stays unpaid and
        // they can try again with the same key — no duplicate registration.
        setFatal('Payment was cancelled. Your details are saved — try again when ready.')
        return
      }
      setFatal(err instanceof Error ? err.message : 'The payment could not be completed.')
      // A genuinely failed attempt gets a fresh key so a retry is a new order.
      setIdempotencyKey(newIdempotencyKey())
    }
  }

  /* ---------- terminal states ---------- */

  if (phase.name === 'done') {
    return (
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="py-4 text-center"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-b from-gold-bright to-gold-deep">
          <Check size={26} className="text-abyss" />
        </div>
        <h3 className="mt-4 font-display text-2xl text-foil">
          You're aboard, {form.name.split(' ')[0]}.
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-[0.9rem] leading-relaxed text-parchment/70">
          Your {phase.tierName} is confirmed. We've emailed your pass to{' '}
          <span className="text-gold-bright">{form.email}</span> — the link in that email signs you
          in, so keep it.
        </p>

        <div className="mx-auto mt-6 max-w-xs rounded-xl border border-gold/25 bg-ocean/50 p-4">
          <div className="font-log text-[0.6rem] uppercase tracking-cinema text-parchment/50">
            Your registration number
          </div>
          <div className="mt-1.5 font-display text-2xl tracking-wide text-gold-bright">
            {phase.publicCode}
          </div>
        </div>

        <a
          href={`${import.meta.env.BASE_URL}pass`}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep px-6 py-3 font-log text-[0.68rem] uppercase tracking-wide2 text-abyss"
        >
          <Ticket size={14} /> View my pass
        </a>
      </motion.div>
    )
  }

  if (phase.name === 'slow') {
    return (
      <div className="py-6 text-center">
        <Loader2 size={26} className="mx-auto animate-spin text-gold/70" />
        <h3 className="mt-4 font-display text-xl text-offwhite">Your payment went through</h3>
        <p className="mx-auto mt-2 max-w-sm text-[0.88rem] leading-relaxed text-parchment/70">
          It's taking a moment to confirm. Nothing is lost — your registration number is{' '}
          <span className="text-gold-bright">{phase.publicCode}</span>, and the confirmation email
          will arrive shortly. You can close this window.
        </p>
      </div>
    )
  }

  if (phase.name === 'paying' || phase.name === 'confirming') {
    return (
      <div className="py-10 text-center">
        <Loader2 size={26} className="mx-auto animate-spin text-gold/70" />
        <p className="mt-4 font-display text-lg text-offwhite">
          {phase.name === 'paying' ? 'Opening checkout…' : 'Confirming your payment…'}
        </p>
        <p className="mx-auto mt-2 max-w-xs text-[0.84rem] text-parchment/60">
          {phase.name === 'paying'
            ? 'The payment window will appear in a moment.'
            : 'This usually takes a second or two. Please don’t close this window.'}
        </p>
      </div>
    )
  }

  /* ---------- the form ---------- */

  return (
    <div>
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
              className={`hidden truncate font-log text-[0.62rem] uppercase tracking-wide2 sm:block ${
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
                  onChange={(v) => {
                    set('email', v)
                    setEmailFix(null)
                  }}
                  invalid={!!errors.email}
                  type="email"
                  placeholder="you@college.edu"
                  autoComplete="email"
                />
                {emailFix && (
                  <button
                    type="button"
                    onClick={() => {
                      set('email', emailFix)
                      setEmailFix(null)
                    }}
                    className="mt-1.5 text-left text-[0.78rem] text-ember hover:text-gold-bright"
                  >
                    Did you mean <span className="underline">{emailFix}</span>?
                  </button>
                )}
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

              <Field label="Gender" hint="Used for accommodation allocation." error={errors.gender}>
                <Select
                  value={form.gender}
                  onChange={(v) => set('gender', v)}
                  invalid={!!errors.gender}
                  options={['Female', 'Male', 'Other', 'Prefer not to say']}
                />
              </Field>
              <div className="hidden sm:block" />

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

          {step === 1 && (
            <div className="space-y-5">
              <div className="flex gap-3 rounded-lg border border-gold/25 bg-ocean/40 p-4">
                <Star size={17} className="mt-0.5 shrink-0 text-gold-bright" />
                <p className="text-[0.82rem] leading-relaxed text-parchment/80">
                  Basic Registration is compulsory for everyone and lets you enter{' '}
                  <strong className="text-parchment">any event</strong>. The Star Nights are the one
                  exception — they need the Delegate Card.
                </p>
              </div>

              <div className="rounded-xl border border-gold/70 bg-gold/10 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-display text-[1.05rem] leading-tight text-offwhite sm:text-lg">
                    Basic Registration
                  </span>
                  <span className="shrink-0 whitespace-nowrap font-display text-lg text-gold-bright">
                    {rupees(basic?.amountPaise ?? 45000)}
                  </span>
                </div>
                <div className="mt-1 font-log text-[0.58rem] uppercase tracking-wide2 text-parchment/50">
                  Required for everyone
                </div>
                <ul className="mt-2.5 grid gap-1">
                  {['Entry to the fest, all five days', 'Register for and compete in any event', 'Delegate ID & kit'].map(
                    (t) => (
                      <li key={t} className="flex items-center gap-2 text-[0.78rem] text-parchment/70">
                        <Check size={12} className="shrink-0 text-aqua" />
                        {t}
                      </li>
                    ),
                  )}
                  <li className="flex items-center gap-2 text-[0.78rem] text-parchment/45">
                    <X size={12} className="shrink-0 text-coral/70" />
                    Star Nights — those need the Delegate Card
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => setWantsDelegate((v) => !v)}
                aria-pressed={wantsDelegate}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${
                  wantsDelegate
                    ? 'border-gold/70 bg-gold/10'
                    : 'border-gold/20 bg-ocean/40 hover:border-gold/45'
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-display text-[1.05rem] leading-tight text-offwhite sm:text-lg">
                    Add the Delegate Card
                  </span>
                  <span className="shrink-0 whitespace-nowrap font-display text-lg text-gold-bright">
                    +{rupees(delegate?.amountPaise ?? 225000)}
                  </span>
                </div>
                <p className="mt-1 text-[0.82rem] text-parchment/65">
                  The only way into all five Star Nights. You can also add this later — it costs
                  exactly the same.
                </p>
              </button>

              <div className="rounded-xl border border-gold/25 bg-ocean/50 p-4">
                <div className="flex items-center justify-between py-0.5 font-log text-[0.7rem] uppercase tracking-wide2 text-parchment/60">
                  <span>Basic Registration</span>
                  <span>{rupees(basic?.amountPaise ?? 45000)}</span>
                </div>
                {wantsDelegate && (
                  <div className="flex items-center justify-between py-0.5 font-log text-[0.7rem] uppercase tracking-wide2 text-parchment/60">
                    <span>Delegate Card · Star Nights</span>
                    <span>{rupees(delegate?.amountPaise ?? 225000)}</span>
                  </div>
                )}
                <div className="my-3 rule-gold" />
                <div className="flex items-center justify-between">
                  <span className="font-log text-[0.8rem] uppercase tracking-wide2 text-parchment/80">
                    Total
                  </span>
                  <span className="font-display text-2xl text-foil">{rupees(totalPaise)}</span>
                </div>
              </div>

              <p className="text-[0.75rem] leading-relaxed text-parchment/50">
                You'll upload your college ID after payment, from your pass page. Registration fees
                are non-refundable.
              </p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {fatal && (
        <div className="mt-5 flex items-start gap-2 rounded-lg border border-coral/50 bg-coral/10 p-3 text-[0.82rem] text-coral">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          {fatal}
        </div>
      )}

      <div className="mt-7 flex items-center gap-3">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep(0)}
            className="flex items-center gap-1.5 rounded-full px-5 py-3 font-log text-[0.68rem] uppercase tracking-wide2 text-parchment/70 ring-1 ring-inset ring-gold/40 transition-colors hover:text-gold-bright hover:ring-gold/80"
          >
            <ArrowLeft size={13} /> Back
          </button>
        )}
        <button
          type="button"
          onClick={() => (step === 0 ? setStep(1) : submit())}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep py-3.5 font-log text-[0.72rem] uppercase tracking-wide2 text-abyss transition-transform hover:scale-[1.01]"
        >
          {step === 0 ? (
            <>
              Continue <ArrowRight size={14} />
            </>
          ) : (
            <>
              <Ticket size={15} /> Pay {rupees(totalPaise)}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
