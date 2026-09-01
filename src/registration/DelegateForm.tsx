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
import { ANNOUNCEMENT_CHANNEL } from '../data/site'
import { openCheckout, PaymentCancelled } from './razorpay'
import { refreshEntitlement } from './useEntitlement'
import DocumentUpload from './DocumentUpload'
import { Field, Select, TextInput } from './fields'

/**
 * Registration.
 *
 * Three steps. The middle one used to be skippable and is not any more.
 *
 * The argument for skipping was that blocking a ₹500 payment on somebody
 * finding a photo of their college ID loses registrations, and the desk checks
 * the physical card anyway. What that missed is *which* document: the college
 * ID is the evidence for the student rate the whole price is built on, and
 * collecting it after the money is collecting it from people who no longer
 * have a reason to answer. So the college ID is required here, and the
 * government ID stays optional exactly as it was.
 */

const STEPS = ['Your details', 'Documents', 'Registration & payment'] as const

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

  const [products, setProducts] = useState<Product[]>([])
  const [wantsDelegate, setWantsDelegate] = useState(false)
  /** Which documents the server already holds, reported by the upload step. */
  const [heldDocs, setHeldDocs] = useState<string[]>([])
  const hasStudentId = heldDocs.includes('student_id')

  const [form, setForm] = useState<RegistrationInput>({
    name: '',
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

  const subtotalPaise = useMemo(
    () => (basic?.amountPaise ?? 0) + (wantsDelegate ? (delegate?.amountPaise ?? 0) : 0),
    [basic, delegate, wantsDelegate],
  )

  /*
   * Razorpay's cut, added on top and shown here.
   *
   * The server computes the paise that are actually charged; this mirrors the
   * same rate so the number in the summary is the number in the Razorpay
   * window. Being surprised by a different total at the last step is how a
   * payment gets abandoned.
   */
  const conveniencePaise = Math.ceil((subtotalPaise * 236) / 10000)
  const totalPaise = subtotalPaise + conveniencePaise

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
          setStep(0)
          return
        }
        if (err.code === 'already_registered') {
          setFatal(err.message)
          return
        }
        // The server enforces the college ID too. Land them on the step that
        // fixes it rather than on the payment screen with a red box.
        if (err.code === 'student_id_required') {
          setStep(1)
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

      // Makes the success screen instant. It grants nothing, the webhook does.
      await api.verifyCheckout(result).catch(() => {})

      setPhase({ name: 'confirming', orderId: created.orderId })

      const confirmed = await waitForConfirmation(created.orderId)
      if (confirmed) {
        // Tell the shared entitlement store so the header, hero and chart CTAs
        // stop saying "Register Now" the moment payment lands, rather than only
        // after the next full page load.
        refreshEntitlement()
        setPhase({
          name: 'done',
          publicCode: created.publicCode ?? '',
          tierName: wantsDelegate ? 'Festival Pass' : 'Basic Registration',
        })
      } else {
        setPhase({ name: 'slow', publicCode: created.publicCode ?? '' })
      }
    } catch (err) {
      setPhase({ name: 'form' })
      // Back to payment, not to documents: they cancelled a payment and that
      // is the screen they need in front of them to try again.
      setStep(2)

      if (err instanceof PaymentCancelled) {
        // Not an error worth alarming them about. The order stays unpaid and
        // they can try again with the same key: no duplicate registration.
        setFatal('Payment was cancelled. Your details are saved, try again when ready.')
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
          Your {phase.tierName} is confirmed, and we've emailed your pass. You're already signed
          in. Your pass is ready whenever you want it.
        </p>

        <div className="mx-auto mt-6 max-w-xs rounded-xl border border-gold/25 bg-ocean/50 p-4">
          <div className="font-log text-[0.6rem] uppercase tracking-cinema text-parchment/50">
            Your registration number
          </div>
          <div className="mt-1.5 font-display text-2xl tracking-wide text-gold-bright">
            {phase.publicCode}
          </div>
        </div>

        {/* The one thing left to do, and the moment somebody is most likely
            to do it: they have just paid and the fest is on their mind. It
            goes above the pass link because the pass will still be there
            tomorrow and this attention will not. */}
        <a
          href={ANNOUNCEMENT_CHANNEL.href}
          target="_blank"
          rel="noreferrer"
          className="mx-auto mt-6 block max-w-sm rounded-xl border border-aqua/45 bg-aqua/10 px-5 py-4 text-left transition-colors hover:border-aqua"
        >
          <div className="font-display text-[1.02rem] text-offwhite">
            Join the announcement channel
          </div>
          <p className="mt-1 text-[0.82rem] leading-relaxed text-parchment/70">
            Every schedule change and result goes here first.
          </p>
          <p className="mt-2 text-[0.78rem] leading-relaxed text-aqua">
            {ANNOUNCEMENT_CHANNEL.mute}
          </p>
        </a>

        <a
          href={`${import.meta.env.BASE_URL}pass`}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep px-6 py-3 font-log text-[0.68rem] uppercase tracking-wide2 text-abyss"
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
          It's taking a moment to confirm. Nothing is lost. Your registration number is{' '}
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
              <div>
                <h3 className="font-display text-lg text-offwhite">Identity documents</h3>
                <p className="mt-1.5 text-[0.85rem] text-parchment/55">
                  Your college ID is needed before you can pay — it is what the
                  student rate is based on. A government photo ID is optional.
                </p>
              </div>
              <DocumentUpload onChange={(held) => setHeldDocs(held)} />
              {!hasStudentId && (
                <p className="flex items-start gap-2 rounded-lg border border-gold/25 bg-ocean/40 p-3 text-[0.82rem] text-parchment/70">
                  <AlertCircle size={14} className="mt-0.5 shrink-0 text-gold-bright" />
                  Upload your college ID to continue. A photo taken on your phone is fine.
                </p>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="flex gap-3 rounded-lg border border-gold/25 bg-ocean/40 p-4">
                <Star size={17} className="mt-0.5 shrink-0 text-gold-bright" />
                <p className="text-[0.82rem] leading-relaxed text-parchment/80">
                  Basic Registration is compulsory for everyone and lets you enter{' '}
                  <strong className="text-parchment">any event</strong>. The Festival Pass adds the
                  rest of the programme, including the evenings on the main stage.
                </p>
              </div>

              <div className="rounded-xl border border-gold/70 bg-gold/10 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-display text-[1.05rem] leading-tight text-offwhite sm:text-lg">
                    Basic Registration
                  </span>
                  <span className="shrink-0 whitespace-nowrap font-display text-lg text-gold-bright">
                    {rupees(basic?.amountPaise ?? 50000)}
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
                    The evening programme, which the Festival Pass covers
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
                    Add the Festival Pass
                  </span>
                  <span className="shrink-0 whitespace-nowrap font-display text-lg text-gold-bright">
                    +{rupees(delegate?.amountPaise ?? 220000)}
                  </span>
                </div>
                <p className="mt-1 text-[0.82rem] text-parchment/65">
                  Full access to everything the island runs, all five evenings included. You can
                  also add this later, and it costs exactly the same.
                </p>
              </button>

              <div className="rounded-xl border border-gold/25 bg-ocean/50 p-4">
                <div className="flex items-center justify-between py-0.5 font-log text-[0.7rem] uppercase tracking-wide2 text-parchment/60">
                  <span>Basic Registration</span>
                  <span>{rupees(basic?.amountPaise ?? 50000)}</span>
                </div>
                {wantsDelegate && (
                  <div className="flex items-center justify-between py-0.5 font-log text-[0.7rem] uppercase tracking-wide2 text-parchment/60">
                    <span>Festival Pass · full programme</span>
                    <span>{rupees(delegate?.amountPaise ?? 220000)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between py-0.5 font-log text-[0.7rem] uppercase tracking-wide2 text-parchment/60">
                  <span>Payment gateway charges</span>
                  <span>{rupees(conveniencePaise)}</span>
                </div>
                <div className="my-3 rule-gold" />
                <div className="flex items-center justify-between">
                  <span className="font-log text-[0.8rem] uppercase tracking-wide2 text-parchment/80">
                    Total
                  </span>
                  <span className="font-display text-2xl text-foil">{rupees(totalPaise)}</span>
                </div>
              </div>

              <p className="text-[0.75rem] leading-relaxed text-parchment/50">
                Registration fees are non-refundable. You can add or replace a government photo ID
                later from your pass.
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
            onClick={() => setStep((n) => Math.max(0, n - 1))}
            className="flex items-center gap-1.5 rounded-full px-5 py-3 font-log text-[0.68rem] uppercase tracking-wide2 text-parchment/70 ring-1 ring-inset ring-gold/40 transition-colors hover:text-gold-bright hover:ring-gold/80"
          >
            <ArrowLeft size={13} /> Back
          </button>
        )}
        <button
          type="button"
          disabled={step === 1 && !hasStudentId}
          onClick={() => (step === 2 ? submit() : setStep((n) => n + 1))}
          className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep py-3.5 font-log text-[0.72rem] uppercase tracking-wide2 text-abyss transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:scale-100"
        >
          {step === 2 ? (
            <>
              <Ticket size={15} /> Pay {rupees(totalPaise)}
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
