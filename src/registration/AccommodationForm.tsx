import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  AlertCircle,
  BedDouble,
  Check,
  Hourglass,
  Loader2,
  LogIn,
  Ticket,
  Wallet,
} from 'lucide-react'

import {
  ApiError,
  api,
  waitForConfirmation,
  type AccommodationInfo,
  type AccommodationRoom,
} from '../api/client'
import { openCheckout, PaymentCancelled } from './razorpay'
import { Checkbox, Field, TextArea, TextInput } from './fields'
import { CONVENIENCE_NOTE } from '../data/registration'
import { BRING_TO_CHECKIN, HOUSE_RULES, STAY_COORDINATORS } from '../data/accommodation'

/**
 * Booking a bed.
 *
 * The states somebody can be in, and what each is shown:
 *
 *   bookings not open : the rates and the coordinators, so the wait is useful.
 *   not signed in     : the rates, and a way in. Never a form they fill and lose.
 *   signed in, unpaid : told Basic Registration comes first, with the button.
 *   already booked    : their booking, and what to bring to check-in.
 *   otherwise         : the form.
 *
 * One person, one bed, one payment. There is no group booking and no roommate
 * list: rooms are allocated by the accommodation team, and every rate on the
 * card is per person, so a booking that covered several people would produce
 * one receipt for a room full of students who each need their own to get their
 * deposit back.
 *
 * The amount is never sent from here. The form sends a room-type id, a number
 * of days and an arrival date; the server prices those or refuses.
 */
export default function AccommodationForm({
  onNeedRegistration,
}: {
  /** Take them to Basic Registration, which a bed requires. */
  onNeedRegistration: () => void
}) {
  const reduce = useReducedMotion()
  const [info, setInfo] = useState<AccommodationInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [gender, setGender] = useState<'boys' | 'girls' | ''>('')
  const [ac, setAc] = useState<boolean | null>(null)
  const [sharing, setSharing] = useState<number | null>(null)
  const [days, setDays] = useState<number | null>(null)
  const [arrivalDate, setArrivalDate] = useState('')
  const [arrivalTime, setArrivalTime] = useState('')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [college, setCollege] = useState('')
  const [course, setCourse] = useState('')
  const [requirements, setRequirements] = useState('')
  const [rulesAccepted, setRulesAccepted] = useState(false)
  const [partnerConsent, setPartnerConsent] = useState(false)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [fatal, setFatal] = useState<string | null>(null)
  const [paying, setPaying] = useState<string | null>(null)
  const [done, setDone] = useState<{ code: string } | null>(null)

  useEffect(() => {
    let alive = true
    api
      .accommodation()
      .then((a) => {
        if (!alive) return
        setInfo(a)
        if (a.prefill) {
          setName(a.prefill.name)
          setEmail(a.prefill.email)
          setPhone(a.prefill.phone)
          setCollege(a.prefill.college)
          setCourse(a.prefill.course)
          // Only a suggestion for which block to open on. They can change it,
          // and a registration that recorded "Other" or nothing opens on
          // neither rather than guessing.
          if (a.prefill.gender === 'boys' || a.prefill.gender === 'girls') {
            setGender(a.prefill.gender)
          }
        }
      })
      .catch((err) =>
        alive && setLoadError(err instanceof Error ? err.message : 'Could not load the rates.'),
      )
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  /** The rooms on offer in the chosen block, at the chosen AC setting. */
  const options = useMemo<AccommodationRoom[]>(() => {
    if (!info || !gender || ac === null) return []
    return info.rooms
      .filter((r) => r.gender === gender && r.ac === ac)
      .sort((a, b) => a.sharing - b.sharing)
  }, [info, gender, ac])

  const picked = options.find((r) => r.sharing === sharing) ?? null

  /**
   * Which days this length of stay can start on. Narrows as soon as they
   * choose. Memoised because the effect below depends on it, and a fresh array
   * every render would re-run that effect on every keystroke in the form.
   */
  const arrivalChoices = useMemo<string[]>(
    () => (days && info ? (info.arrivalDates[String(days)] ?? []) : []),
    [days, info],
  )

  /*
   * A five-seater exists only in the boys' block, and four days can start on
   * a day five days cannot. Switching either one can therefore strand a choice
   * that was valid a moment ago, so the dependent choice is dropped rather
   * than left sitting there about to be rejected by the server.
   */
  useEffect(() => {
    if (sharing !== null && !options.some((r) => r.sharing === sharing)) setSharing(null)
  }, [options, sharing])

  useEffect(() => {
    if (arrivalDate && !arrivalChoices.includes(arrivalDate)) setArrivalDate('')
    // One possible arrival for a five-day stay, so there is nothing to choose.
    if (!arrivalDate && arrivalChoices.length === 1) setArrivalDate(arrivalChoices[0])
  }, [arrivalChoices, arrivalDate])

  /** What this stay costs, for display. The server computes the real figure. */
  const subtotalPaise = picked && days ? picked.ratePaise * days : 0
  const conveniencePaise = Math.ceil((subtotalPaise * 236) / 10000)
  const totalPaise = subtotalPaise + conveniencePaise

  const ready =
    !!picked && !!days && !!arrivalDate && rulesAccepted && partnerConsent && !busy

  /**
   * Book, and pay.
   *
   * A cancelled payment leaves a pending booking behind, which the next
   * attempt stands down, so cancelling and trying again is safe and costs
   * nothing.
   */
  const submit = async () => {
    if (!picked || !days) return
    setBusy(true)
    setFatal(null)
    setErrors({})
    try {
      const res = await api.bookAccommodation({
        roomTypeId: picked.id,
        days,
        arrivalDate,
        arrivalTime: arrivalTime.trim() || undefined,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        college: college.trim(),
        course: course.trim(),
        requirements: requirements.trim() || undefined,
        rulesAccepted,
        partnerConsent,
      })

      setPaying('Opening payment…')
      await openCheckout(res.checkout)

      setPaying('Confirming your booking…')
      const confirmed = await waitForConfirmation(res.orderId)
      if (confirmed) {
        setDone({ code: res.code })
      } else {
        // The money is safe and the webhook is late. Said plainly, because the
        // alternative is somebody paying a second time.
        setFatal(
          `Your payment went through and the booking is still confirming. Your reference is ${res.code}. Open My Pass in a moment and it will be there. Do not pay again.`,
        )
      }
    } catch (err) {
      if (err instanceof PaymentCancelled) {
        setFatal('Payment cancelled. Nothing has been charged, and you can try again.')
      } else if (err instanceof ApiError && err.fields) {
        setErrors(err.fields)
      } else {
        setFatal(err instanceof Error ? err.message : 'Could not make that booking.')
      }
    } finally {
      setPaying(null)
      setBusy(false)
    }
  }

  /* ---------- loading / broken ---------- */

  if (loading) {
    return (
      <div className="py-12 text-center">
        <Loader2 size={22} className="mx-auto animate-spin text-gold/70" />
      </div>
    )
  }

  if (loadError || !info) {
    return (
      <p className="py-8 text-center text-parchment/60">
        {loadError ?? 'Could not load the rates just now.'}
      </p>
    )
  }

  /* ---------- booked, either just now or earlier ---------- */

  const held = info.booking?.status === 'confirmed' ? info.booking : null

  if (done || held) {
    const code = done?.code ?? held!.code
    return (
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="py-6 text-center"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-b from-gold-bright to-gold-deep">
          <Check size={26} className="text-abyss" />
        </div>
        <h3 className="mt-4 font-display text-2xl text-foil">Your bed is booked.</h3>

        <div className="mx-auto mt-4 max-w-xs rounded-lg border border-gold/25 bg-abyss/50 px-5 py-4">
          <div className="font-log text-[0.6rem] uppercase tracking-wide2 text-parchment/50">
            Booking reference
          </div>
          <div className="mt-1 font-mono text-xl tracking-widest text-gold-bright">{code}</div>
        </div>

        {held && (
          <p className="mx-auto mt-3 text-[0.84rem] text-parchment/65">
            {held.room} · {held.days} days
          </p>
        )}

        <p className="mx-auto mt-4 max-w-sm text-[0.86rem] leading-relaxed text-parchment/70">
          The receipt is in your inbox and on your pass page. Show it at the accommodation desk
          when you arrive.
        </p>

        <div className="mx-auto mt-5 max-w-sm rounded-lg border border-gold/25 bg-ocean/40 p-4 text-left">
          <div className="font-log text-[0.62rem] uppercase tracking-wide2 text-gold/70">
            Bring with you
          </div>
          <ul className="mt-2 space-y-1.5">
            {BRING_TO_CHECKIN.map((item) => (
              <li key={item} className="flex items-start gap-2 text-[0.84rem] text-parchment/75">
                <Check size={13} className="mt-1 shrink-0 text-gold-bright" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </motion.div>
    )
  }

  /* ---------- bookings not open ---------- */

  if (!info.open) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-gold/20 bg-ocean/40 px-6 py-10 text-center">
        <Hourglass size={22} className="text-gold/60" />
        <p className="font-display text-2xl text-offwhite">Not open yet</p>
        <p className="max-w-sm text-[0.86rem] leading-relaxed text-parchment/65">
          {info.note ??
            'Bookings open closer to the fest. Slots are limited and go first come, first served, so it is worth checking back.'}
        </p>
        <Coordinators />
      </div>
    )
  }

  /* ---------- not signed in ---------- */

  if (!info.signedIn) {
    return (
      <div className="rounded-xl border border-gold/25 bg-ocean/40 p-5">
        <div className="flex items-start gap-3">
          <LogIn size={18} className="mt-0.5 shrink-0 text-gold-bright" />
          <div>
            <div className="font-display text-[0.95rem] text-offwhite">Sign in to book</div>
            <p className="mt-1 text-[0.84rem] leading-relaxed text-parchment/70">
              Accommodation is for registered delegates, and your booking is tied to the delegate
              card the desk checks you in against. Signing in also saves you typing most of this
              form.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <a
            href={`${import.meta.env.BASE_URL}sign-in`}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep py-3 font-log text-[0.72rem] uppercase tracking-wide2 text-abyss transition-transform hover:scale-[1.01]"
          >
            <LogIn size={15} /> Sign in
          </a>
          <button
            type="button"
            onClick={onNeedRegistration}
            className="flex flex-1 items-center justify-center gap-2 rounded-full py-3 font-log text-[0.72rem] uppercase tracking-wide2 text-gold-bright ring-1 ring-inset ring-gold/40 transition-colors hover:ring-gold/80"
          >
            <Ticket size={15} /> Register first
          </button>
        </div>
      </div>
    )
  }

  /* ---------- signed in, no Basic Registration ---------- */

  if (!info.eligible) {
    return (
      <div className="rounded-xl border border-gold/25 bg-ocean/40 p-5">
        <div className="flex items-start gap-3">
          <Ticket size={18} className="mt-0.5 shrink-0 text-gold-bright" />
          <div>
            <div className="font-display text-[0.95rem] text-offwhite">
              Basic Registration comes first
            </div>
            <p className="mt-1 text-[0.84rem] leading-relaxed text-parchment/70">
              A bed is for delegates on the manifest. Complete your Basic Registration and this
              form opens up.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onNeedRegistration}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep py-3 font-log text-[0.72rem] uppercase tracking-wide2 text-abyss transition-transform hover:scale-[1.01]"
        >
          <Ticket size={15} /> Complete registration
        </button>
      </div>
    )
  }

  /* ---------- the form ---------- */

  return (
    <div className="space-y-6">
      {/* 1. Which block */}
      <div>
        <Legend n="1" label="Which block" />
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(['boys', 'girls'] as const).map((g) => (
            <Choice key={g} on={gender === g} onClick={() => setGender(g)}>
              <span className="capitalize">{g}</span>
            </Choice>
          ))}
        </div>
        <p className="mt-2 text-[0.74rem] text-parchment/45">
          Rooms are single-gender. The boys' block has rooms up to five to a room; the girls' block
          goes up to four.
        </p>
      </div>

      {/* 2. AC */}
      {gender && (
        <div>
          <Legend n="2" label="AC or not" />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Choice on={ac === true} onClick={() => setAc(true)}>
              AC
            </Choice>
            <Choice on={ac === false} onClick={() => setAc(false)}>
              Non-AC
            </Choice>
          </div>
        </div>
      )}

      {/* 3. Room */}
      {gender && ac !== null && (
        <div>
          <Legend n="3" label="Room sharing" />
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {options.map((r) => (
              <Choice key={r.id} on={sharing === r.sharing} onClick={() => setSharing(r.sharing)}>
                <span className="flex w-full items-baseline justify-between gap-3">
                  <span>{r.sharing} seater</span>
                  <span className="font-mono text-[0.78rem] text-gold-bright">
                    ₹{(r.ratePaise / 100).toLocaleString('en-IN')}
                    <span className="text-parchment/45">/day</span>
                  </span>
                </span>
              </Choice>
            ))}
          </div>
          <p className="mt-2 text-[0.74rem] text-parchment/45">
            Per person, per day. Fewer to a room costs more.
          </p>
          {errors.roomTypeId && <FieldError>{errors.roomTypeId}</FieldError>}
        </div>
      )}

      {/* 4. How long */}
      {picked && (
        <div>
          <Legend n="4" label="How long" />
          <div className="mt-2 grid grid-cols-2 gap-2">
            {info.allowedDays.map((d) => (
              <Choice key={d} on={days === d} onClick={() => setDays(d)}>
                <span className="flex w-full items-baseline justify-between gap-3">
                  <span>{d} days</span>
                  <span className="font-mono text-[0.78rem] text-gold-bright">
                    ₹{((picked.ratePaise * d) / 100).toLocaleString('en-IN')}
                  </span>
                </span>
              </Choice>
            ))}
          </div>
          {errors.days && <FieldError>{errors.days}</FieldError>}
        </div>
      )}

      {/* 5. Arrival */}
      {picked && days && (
        <div>
          <Legend n="5" label="When you arrive" />
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div>
              {arrivalChoices.length > 1 ? (
                <div className="grid grid-cols-2 gap-2">
                  {arrivalChoices.map((d) => (
                    <Choice key={d} on={arrivalDate === d} onClick={() => setArrivalDate(d)}>
                      {prettyDate(d)}
                    </Choice>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-gold/25 bg-ocean/50 px-3.5 py-2.5 text-[0.92rem] text-offwhite">
                  {prettyDate(arrivalDate)}
                  <span className="ml-2 text-[0.76rem] text-parchment/45">
                    the only start for a {days}-day stay
                  </span>
                </div>
              )}
              {errors.arrivalDate && <FieldError>{errors.arrivalDate}</FieldError>}
            </div>

            <Field label="Roughly what time" hint="A guess is fine. It helps the desk staff up.">
              <TextInput
                value={arrivalTime}
                onChange={setArrivalTime}
                placeholder="e.g. late evening, or 9pm"
                maxLength={60}
              />
            </Field>
          </div>
        </div>
      )}

      {/* 6. Who you are */}
      {picked && days && arrivalDate && (
        <div>
          <Legend n="6" label="Who is staying" />
          <p className="mt-1 text-[0.74rem] text-parchment/45">
            Filled in from your registration. Change anything that has moved on: the desk rings the
            number below, not the one you signed up with.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Full name" required error={errors.name}>
              <TextInput value={name} onChange={setName} invalid={!!errors.name} maxLength={120} />
            </Field>
            <Field label="Phone / WhatsApp" required error={errors.phone}>
              <TextInput
                value={phone}
                onChange={setPhone}
                invalid={!!errors.phone}
                inputMode="numeric"
                maxLength={15}
              />
            </Field>
            <Field
              label="Email"
              required
              error={errors.email}
              hint="Where the receipt goes."
            >
              <TextInput
                value={email}
                onChange={setEmail}
                invalid={!!errors.email}
                type="email"
                maxLength={200}
              />
            </Field>
            <Field label="College" required error={errors.college}>
              <TextInput
                value={college}
                onChange={setCollege}
                invalid={!!errors.college}
                maxLength={160}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Course / batch" required error={errors.course}>
                <TextInput
                  value={course}
                  onChange={setCourse}
                  invalid={!!errors.course}
                  placeholder="e.g. MBBS 2023"
                  maxLength={160}
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field
                label="Anything we should know"
                hint="Ground floor, a medical condition, arriving with a friend you would like to be near. Optional."
              >
                <TextArea
                  value={requirements}
                  onChange={setRequirements}
                  maxLength={600}
                  placeholder="Optional"
                />
              </Field>
            </div>
          </div>
        </div>
      )}

      {/* 7. What it costs, and what it does not cover */}
      {picked && days && arrivalDate && (
        <div className="rounded-xl border border-gold/25 bg-abyss/40 p-4">
          <div className="font-log text-[0.62rem] uppercase tracking-wide2 text-gold/70">
            What you pay now
          </div>

          <dl className="mt-3 space-y-1.5 text-[0.86rem]">
            <Line
              label={`${picked.label} · ${days} days`}
              value={`₹${(subtotalPaise / 100).toLocaleString('en-IN')}`}
            />
            <Line
              label="Payment gateway charges"
              value={`₹${(conveniencePaise / 100).toLocaleString('en-IN')}`}
              muted
            />
            <div className="border-t border-gold/20 pt-1.5">
              <Line
                label="Total"
                value={`₹${(totalPaise / 100).toLocaleString('en-IN')}`}
                strong
              />
            </div>
          </dl>

          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-gold/30 bg-gold/5 p-3">
            <Wallet size={15} className="mt-0.5 shrink-0 text-gold-bright" />
            <p className="text-[0.8rem] leading-relaxed text-parchment/80">
              Bring <strong className="text-gold-bright">₹{info.depositRupees} in cash</strong> as
              well. That is the refundable security deposit, taken at check-in and returned when you
              leave. It is not part of the total above and cannot be paid online.
            </p>
          </div>

          <p className="mt-2 text-[0.72rem] text-parchment/45">{CONVENIENCE_NOTE}</p>
        </div>
      )}

      {/* 8. The terms, ticked rather than assumed */}
      {picked && days && arrivalDate && (
        <div className="space-y-3">
          <Checkbox
            checked={rulesAccepted}
            onChange={setRulesAccepted}
            error={errors.rulesAccepted}
          >
            I have read the house rules: no smoking or alcohol on the premises, damage is charged
            against my deposit, my luggage is my own responsibility, and{' '}
            <strong className="text-parchment">a cancellation is not refunded</strong>.
          </Checkbox>

          <Checkbox
            checked={partnerConsent}
            onChange={setPartnerConsent}
            error={errors.partnerConsent}
          >
            I agree to my name, phone number and college being shared with the hotel or hostel
            PYREXIA places me in, so they can check me in.
          </Checkbox>
        </div>
      )}

      {fatal && (
        <div className="flex items-start gap-2 rounded-lg border border-coral/40 bg-coral/10 p-3.5 text-[0.84rem] leading-relaxed text-coral">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          {fatal}
        </div>
      )}

      {picked && days && arrivalDate && (
        <button
          type="button"
          onClick={submit}
          disabled={!ready}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep py-3.5 font-log text-[0.74rem] uppercase tracking-wide2 text-abyss transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:scale-100"
        >
          {busy ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              {paying ?? 'Working…'}
            </>
          ) : (
            <>
              <BedDouble size={15} />
              Book and pay ₹{(totalPaise / 100).toLocaleString('en-IN')}
            </>
          )}
        </button>
      )}

      <details className="rounded-lg border border-gold/20 bg-ocean/30 p-4">
        <summary className="cursor-pointer font-log text-[0.66rem] uppercase tracking-wide2 text-gold/70">
          House rules in full
        </summary>
        <ul className="mt-3 space-y-2">
          {HOUSE_RULES.map((rule) => (
            <li key={rule} className="text-[0.82rem] leading-relaxed text-parchment/70">
              {rule}
            </li>
          ))}
        </ul>
        <div className="mt-4 border-t border-gold/15 pt-3">
          <Coordinators />
        </div>
      </details>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Small parts
 * ------------------------------------------------------------------ */

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
      className={`flex min-h-11 items-center rounded-lg px-4 py-2.5 text-left text-[0.86rem] transition-colors ${
        on
          ? 'bg-gold/15 text-gold-bright ring-1 ring-inset ring-gold/70'
          : 'text-parchment/75 ring-1 ring-inset ring-gold/25 hover:text-gold-bright hover:ring-gold/60'
      }`}
    >
      {children}
    </button>
  )
}

function Line({
  label,
  value,
  muted,
  strong,
}: {
  label: string
  value: string
  muted?: boolean
  strong?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={muted ? 'text-parchment/50' : 'text-parchment/75'}>{label}</dt>
      <dd
        className={`font-mono whitespace-nowrap ${
          strong ? 'text-[1rem] text-gold-bright' : muted ? 'text-parchment/50' : 'text-parchment/75'
        }`}
      >
        {value}
      </dd>
    </div>
  )
}

function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <span className="mt-1.5 flex items-center gap-1 text-[0.72rem] text-coral">
      <AlertCircle size={12} /> {children}
    </span>
  )
}

/**
 * The accommodation team's numbers.
 *
 * Kept even though booking is now self-serve, because a form cannot answer
 * "my train gets in at three in the morning, is that alright?".
 */
function Coordinators() {
  return (
    <div className="grid gap-3 text-left sm:grid-cols-2">
      {(['boys', 'girls'] as const).map((g) => (
        <div key={g}>
          <div className="font-log text-[0.6rem] uppercase tracking-wide2 text-gold/65">
            {g} accommodation
          </div>
          <ul className="mt-1.5 space-y-0.5">
            {STAY_COORDINATORS[g].map((c) => (
              <li key={c.phone} className="text-[0.8rem] text-parchment/70">
                {c.name}{' '}
                <a href={`tel:${c.phone}`} className="text-gold-bright hover:underline">
                  {c.phone}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

/** `2026-10-12` as `Mon 12 Oct`. A lookup, so no timezone can shift it. */
const DATE_NAMES: Record<string, string> = {
  '2026-10-12': 'Mon 12 Oct',
  '2026-10-13': 'Tue 13 Oct',
  '2026-10-14': 'Wed 14 Oct',
  '2026-10-15': 'Thu 15 Oct',
  '2026-10-16': 'Fri 16 Oct',
}

function prettyDate(iso: string): string {
  return DATE_NAMES[iso] ?? iso
}
