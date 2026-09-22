import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, Check, Loader2, ShieldAlert, UserPlus } from 'lucide-react'

import { ApiError, api } from '../api/client'
import { Field, Select, TextInput } from '../registration/fields'
import { BASIC_AMOUNT, DELEGATE_ADDON } from '../data/registration'

/**
 * The registration desk.
 *
 * For a person on a counter taking cash or UPI from somebody standing in
 * front of them. It is the only way a paid pass is created without money
 * going through Razorpay, so two things are deliberate:
 *
 *  - The collector types what was actually taken, because the committee
 *    discounts at a counter. The server still holds the list price and
 *    refuses anything above it, and writes the gap down as a discount.
 *  - The payment reference is required. Without it a treasurer cannot match
 *    a pass against a cash box or a UPI statement afterwards, which is the
 *    whole point of writing it down at all.
 *
 * No account is made. The delegate never signs in; they get an email with
 * their registration number and QR, and that is what the gate scans.
 */

const YEARS = ['1st', '2nd', '3rd', '4th', '5th', 'Intern', 'Postgraduate', 'Not a student']
const GENDERS = ['Female', 'Male', 'Other', 'Prefer not to say']

type Done = {
  publicCode: string
  amountPaise: number
  completedExisting: boolean
  /** The Festival Pass sold on its own, to somebody already registered. */
  upgraded: boolean
}

/** Somebody the lookup found, as the counter needs to see them. */
type Found = Awaited<ReturnType<typeof api.deskLookup>>

/**
 * What this counter is selling.
 *
 * `upgrade` is the Festival Pass on its own. It is a different transaction
 * from the other two rather than a variation of one: the person already
 * exists, so nothing is typed about them and nothing about them is changed.
 */
type Tier = 'basic' | 'delegate' | 'upgrade'

export default function Desk() {
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [tier, setTier] = useState<Tier>('basic')
  const [method, setMethod] = useState<'upi' | 'cash'>('upi')
  const [reference, setReference] = useState('')
  /** What was actually taken. Typed, not computed: the desk discounts. */
  const [amount, setAmount] = useState('')
  const [form, setForm] = useState({
    name: '', email: '', phone: '', gender: '', college: '', city: '',
    course: '', year: '', emergencyName: '', emergencyPhone: '',
  })
  /** The upgrade flow: an address, and who the server says holds it. */
  const [lookupEmail, setLookupEmail] = useState('')
  const [found, setFound] = useState<Found | null>(null)
  const [looking, setLooking] = useState(false)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [fatal, setFatal] = useState<string | null>(null)
  const [done, setDone] = useState<Done | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const me = await api.adminMe()
        setAllowed(me.can?.deskRegister ?? false)
      } catch {
        setAllowed(false)
      }
    })()
  }, [])

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }))

  const total =
    tier === 'upgrade' ? DELEGATE_ADDON
      : tier === 'delegate' ? BASIC_AMOUNT + DELEGATE_ADDON
        : BASIC_AMOUNT

  /** Whether the person the lookup found can actually be sold the upgrade. */
  const upgradable = !!found && found.found && found.hasBasic && !found.hasDelegate

  /**
   * Find who holds an address, before any money is taken.
   *
   * Its own step rather than something the submit does silently, because the
   * agent is about to charge somebody and should read the name back to them
   * first. A failure here is shown in the panel, not as a fatal: not finding
   * somebody is an ordinary outcome at a counter.
   */
  const lookUp = async () => {
    const email = lookupEmail.trim()
    if (!email) return
    setLooking(true)
    setFatal(null)
    setErrors({})
    setFound(null)
    try {
      setFound(await api.deskLookup(email))
    } catch (err) {
      setFatal(err instanceof Error ? err.message : 'Could not look that address up.')
    } finally {
      setLooking(false)
    }
  }

  const submit = async () => {
    setBusy(true)
    setFatal(null)
    setErrors({})
    try {
      if (tier === 'upgrade') {
        const res = await api.deskUpgrade({
          email: lookupEmail.trim(),
          amountRupees: Number(amount),
          paymentMethod: method,
          paymentReference: reference.trim(),
        })
        setDone({
          publicCode: res.publicCode,
          amountPaise: res.amountPaise,
          completedExisting: false,
          upgraded: true,
        })
        return
      }

      const res = await api.deskRegister({
        ...form,
        products: tier === 'delegate' ? ['basic', 'delegate'] : ['basic'],
        amountRupees: Number(amount),
        paymentMethod: method,
        paymentReference: reference.trim(),
      })
      setDone({
        publicCode: res.publicCode,
        amountPaise: res.amountPaise,
        completedExisting: res.completedExisting,
        upgraded: false,
      })
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields)
      else setFatal(err instanceof Error ? err.message : 'Could not take that registration.')
    } finally {
      setBusy(false)
    }
  }

  const again = () => {
    setDone(null)
    setReference('')
    setAmount('')
    setLookupEmail('')
    setFound(null)
    setForm({
      name: '', email: '', phone: '', gender: '', college: '', city: '',
      course: '', year: '', emergencyName: '', emergencyPhone: '',
    })
  }

  /* ---------- gates ---------- */

  if (allowed === null) {
    return (
      <Shell>
        <div className="flex items-center gap-3 text-parchment/60">
          <Loader2 size={16} className="animate-spin" /> Checking your access…
        </div>
      </Shell>
    )
  }

  if (!allowed) {
    return (
      <Shell>
        <div className="max-w-md rounded-xl border border-gold/15 bg-navy/45 p-6">
          <ShieldAlert size={20} className="text-ember" />
          <h1 className="mt-3 font-display text-2xl text-offwhite">Desk only</h1>
          <p className="mt-2 text-[0.9rem] leading-relaxed text-parchment/60">
            This page is for the registration desk. If you should have access, sign in with the
            address that was added as a desk agent.
          </p>
          <Link
            to="/sign-in?next=/desk"
            className="mt-5 inline-block rounded-full bg-gradient-to-b from-gold-bright to-gold-deep px-5 py-2.5 font-log text-[0.66rem] uppercase tracking-wide2 text-abyss"
          >
            Sign in
          </Link>
        </div>
      </Shell>
    )
  }

  /* ---------- done ---------- */

  if (done) {
    return (
      <Shell>
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-b from-gold-bright to-gold-deep">
            <Check size={26} className="text-abyss" />
          </div>
          <h1 className="mt-4 font-display text-3xl text-foil">
            {done.upgraded ? 'Pass added.' : 'Registered.'}
          </h1>

          <div className="mt-5 rounded-xl border border-gold/25 bg-abyss/50 px-6 py-5">
            <div className="font-log text-[0.6rem] uppercase tracking-wide2 text-parchment/50">
              Registration number
            </div>
            <div className="mt-1 font-mono text-2xl tracking-widest text-gold-bright">
              {done.publicCode}
            </div>
          </div>

          <p className="mt-4 text-[0.88rem] leading-relaxed text-parchment/70">
            ₹{(done.amountPaise / 100).toLocaleString('en-IN')} collected.{' '}
            {done.upgraded
              ? 'They are on the Festival Pass now. Their registration number has not changed, and the confirmation is on its way to their inbox.'
              : 'Their pass and QR are on the way to their inbox. Read them the number above if they want it now.'}
          </p>
          {done.completedExisting && (
            <p className="mt-3 text-[0.82rem] leading-relaxed text-parchment/50">
              They had already started an account online, so this completed that one rather than
              making a second.
            </p>
          )}

          <button
            onClick={again}
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep px-7 py-3 font-log text-[0.7rem] uppercase tracking-wide2 text-abyss"
          >
            <UserPlus size={15} />{' '}
            {done.upgraded ? 'Serve the next person' : 'Register the next person'}
          </button>
        </div>
      </Shell>
    )
  }

  /* ---------- the form ---------- */

  return (
    <Shell>
      <div className="mx-auto max-w-3xl">
        <div className="font-log text-[0.62rem] uppercase tracking-cinema text-gold/70">
          Registration desk
        </div>
        <h1 className="mt-2 font-display text-3xl text-offwhite sm:text-4xl">Register in person</h1>
        <p className="mt-2 max-w-xl text-pretty text-[0.9rem] leading-relaxed text-parchment/60">
          Take the payment first, then fill this in. Their pass goes straight to their inbox; no
          account is made and they never have to sign in.
        </p>

        {/* What they are buying */}
        <div className="mt-8">
          <Legend n="1" label="What they are paying for" />
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <Choice on={tier === 'basic'} onClick={() => setTier('basic')}>
              Basic Registration
            </Choice>
            <Choice on={tier === 'delegate'} onClick={() => setTier('delegate')}>
              Basic + Festival Pass
            </Choice>
            <Choice on={tier === 'upgrade'} onClick={() => setTier('upgrade')}>
              <span>
                Festival Pass only
                <span className="mt-0.5 block text-[0.72rem] text-parchment/50">
                  Already registered
                </span>
              </span>
            </Choice>
          </div>

          <div className="mt-3 max-w-xs">
            <Field
              label="Amount collected (₹)"
              required
              error={errors.amountRupees}
              hint={`List price is ₹${total}. Enter less if you gave a discount.`}
            >
              <TextInput
                value={amount}
                onChange={(v) => setAmount(v.replace(/[^0-9]/g, ''))}
                invalid={!!errors.amountRupees}
                inputMode="numeric"
                placeholder={String(total)}
                maxLength={6}
              />
            </Field>
            {amount !== '' && Number(amount) < total && (
              <p className="mt-1.5 text-[0.76rem] text-gold-bright/80">
                ₹{total - Number(amount)} discount, recorded against this order.
              </p>
            )}
          </div>

          <p className="mt-3 text-[0.74rem] text-parchment/45">
            No gateway charge is added: that 2.36% is Razorpay's, and nothing here goes through it.
          </p>
        </div>

        {/* How it was paid */}
        <div className="mt-8">
          <Legend n="2" label="How they paid" />
          <div className="mt-2 max-w-md">
            <div>
              <div className="grid grid-cols-2 gap-2">
                <Choice on={method === 'upi'} onClick={() => setMethod('upi')}>UPI</Choice>
                <Choice on={method === 'cash'} onClick={() => setMethod('cash')}>Cash</Choice>
              </div>

              <div className="mt-3">
                <Field
                  label={method === 'upi' ? 'UPI reference' : 'Receipt number'}
                  required
                  error={errors.paymentReference}
                  hint="This is what lets the treasurer match the pass to the money later."
                >
                  <TextInput
                    value={reference}
                    onChange={setReference}
                    invalid={!!errors.paymentReference}
                    placeholder={method === 'upi' ? 'e.g. 4291 8830 1122' : 'e.g. 014'}
                    maxLength={120}
                  />
                </Field>
              </div>
            </div>
          </div>
        </div>

        {/* Who is upgrading: an address, and who the server says holds it. */}
        {tier === 'upgrade' && (
          <div className="mt-8">
            <Legend n="3" label="Who is upgrading" />
            <div className="mt-3 max-w-md">
              <Field
                label="Their email"
                required
                error={errors.email}
                hint="The address they registered with. Look them up before taking the money."
              >
                <div className="flex gap-2">
                  <TextInput
                    value={lookupEmail}
                    onChange={(v) => {
                      setLookupEmail(v)
                      setFound(null)
                    }}
                    invalid={!!errors.email}
                    type="email"
                    maxLength={200}
                  />
                  <button
                    type="button"
                    onClick={() => void lookUp()}
                    disabled={looking || !lookupEmail.trim()}
                    className="shrink-0 rounded-lg px-4 font-log text-[0.66rem] uppercase tracking-wide2 text-gold-bright ring-1 ring-inset ring-gold/40 transition-colors hover:ring-gold/70 disabled:opacity-40"
                  >
                    {looking ? <Loader2 size={14} className="animate-spin" /> : 'Look up'}
                  </button>
                </div>
              </Field>

              {found && !found.found && (
                <p className="mt-3 flex items-start gap-2 text-[0.84rem] leading-relaxed text-coral">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  Nobody is registered with that address. Check the spelling, or take a Basic +
                  Festival Pass registration for them instead.
                </p>
              )}

              {found?.found && (
                <div className="mt-3 rounded-lg border border-gold/25 bg-abyss/40 px-4 py-3">
                  <div className="font-mono text-[0.9rem] tracking-widest text-gold-bright">
                    {found.publicCode}
                  </div>
                  <div className="mt-1 text-[0.9rem] text-offwhite">{found.name}</div>
                  <div className="text-[0.78rem] text-parchment/55">{found.college}</div>

                  {/* Read this back before taking the money. */}
                  {found.hasDelegate ? (
                    <p className="mt-2.5 text-[0.82rem] leading-relaxed text-coral">
                      They already hold the Festival Pass. Take no money.
                    </p>
                  ) : !found.hasBasic ? (
                    <p className="mt-2.5 text-[0.82rem] leading-relaxed text-coral">
                      They started an account but never paid for Basic Registration. Take a Basic +
                      Festival Pass registration for them instead.
                    </p>
                  ) : (
                    <p className="mt-2.5 text-[0.82rem] leading-relaxed text-parchment/60">
                      On Basic Registration. The Festival Pass can be added for ₹{DELEGATE_ADDON}.
                    </p>
                  )}
                </div>
              )}

              <p className="mt-3 text-[0.74rem] leading-relaxed text-parchment/45">
                Nothing on their registration is changed. Only the pass is added, and the
                confirmation goes to the address above.
              </p>
            </div>
          </div>
        )}

        {/* Who they are */}
        {tier !== 'upgrade' && (
        <div className="mt-8">
          <Legend n="3" label="Who they are" />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Full name" required error={errors.name}>
              <TextInput value={form.name} onChange={set('name')} invalid={!!errors.name} maxLength={120} />
            </Field>
            <Field label="Mobile" required error={errors.phone}>
              <TextInput value={form.phone} onChange={set('phone')} invalid={!!errors.phone} inputMode="numeric" maxLength={15} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Email" required error={errors.email} hint="Their pass and QR go here. Check it twice.">
                <TextInput value={form.email} onChange={set('email')} invalid={!!errors.email} type="email" maxLength={200} />
              </Field>
            </div>
            <Field label="College" required error={errors.college}>
              <TextInput value={form.college} onChange={set('college')} invalid={!!errors.college} maxLength={160} />
            </Field>
            <Field label="City" required error={errors.city}>
              <TextInput value={form.city} onChange={set('city')} invalid={!!errors.city} maxLength={120} />
            </Field>
            <Field label="Course" required error={errors.course}>
              <TextInput value={form.course} onChange={set('course')} invalid={!!errors.course} placeholder="e.g. MBBS" maxLength={160} />
            </Field>
            <Field label="Year" required error={errors.year}>
              <Select value={form.year} onChange={set('year')} options={YEARS} invalid={!!errors.year} />
            </Field>
            <Field label="Gender" error={errors.gender}>
              <Select value={form.gender} onChange={set('gender')} options={GENDERS} invalid={!!errors.gender} />
            </Field>
            <div />
            <Field label="Emergency contact" required error={errors.emergencyName}>
              <TextInput value={form.emergencyName} onChange={set('emergencyName')} invalid={!!errors.emergencyName} maxLength={120} />
            </Field>
            <Field label="Emergency number" required error={errors.emergencyPhone}>
              <TextInput value={form.emergencyPhone} onChange={set('emergencyPhone')} invalid={!!errors.emergencyPhone} inputMode="numeric" maxLength={15} />
            </Field>
          </div>
        </div>
        )}

        {fatal && (
          <div className="mt-6 flex items-start gap-2 rounded-lg border border-coral/40 bg-coral/10 p-3.5 text-[0.86rem] leading-relaxed text-coral">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            {fatal}
          </div>
        )}

        {/* An upgrade cannot be confirmed until somebody has been found and
            can actually take it: the server refuses anyway, but refusing after
            the cash is in the drawer is not the same as refusing before. */}
        <button
          onClick={() => void submit()}
          disabled={busy || (tier === 'upgrade' && !upgradable)}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep py-4 font-log text-[0.74rem] uppercase tracking-wide2 text-abyss transition-transform hover:scale-[1.01] disabled:opacity-50"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          {amount === ''
            ? tier === 'upgrade'
              ? 'Confirm and add the pass'
              : 'Confirm and register'
            : `Confirm ₹${Number(amount)} collected`}
        </button>
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section className="mx-auto min-h-[80svh] max-w-5xl px-5 pb-24 pt-[calc(var(--header-h,7rem)+2rem)] sm:px-8">
      {children}
    </section>
  )
}

function Legend({ n, label }: { n: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-gold/40 font-mono text-[0.62rem] text-gold-bright">
        {n}
      </span>
      <span className="font-log text-[0.66rem] uppercase tracking-wide2 text-parchment/70">
        {label}
      </span>
    </div>
  )
}

function Choice({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex min-h-11 items-center rounded-lg px-4 py-2.5 text-left text-[0.88rem] transition-colors ${
        on
          ? 'bg-gold/15 text-gold-bright ring-1 ring-inset ring-gold/70'
          : 'text-parchment/75 ring-1 ring-inset ring-gold/25 hover:text-gold-bright hover:ring-gold/60'
      }`}
    >
      {children}
    </button>
  )
}
