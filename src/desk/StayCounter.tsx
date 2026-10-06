import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, BedDouble, Check, Loader2, UserPlus } from 'lucide-react'

import { ApiError, api, type AccommodationInfo } from '../api/client'
import { Checkbox, Field, TextInput } from '../registration/fields'
import { HOUSE_RULES } from '../data/accommodation'
import { Choice, Legend } from './ui'

/**
 * The desk's accommodation counter: book a bed and take the room charge.
 *
 * Same shape as the Festival Pass counter. The person is named by the address
 * they registered with and looked up before any money changes hands, because
 * a bed needs Basic Registration. Their details come across from the
 * registration and stay editable, since the booking keeps its own copy.
 *
 * The rate card, the stay lengths and the arrival days come from the same
 * endpoint the online form reads, so this screen never prices anything
 * itself; the server prices it again on the way in regardless.
 */

type Found = Awaited<ReturnType<typeof api.deskLookup>>
type Done = Awaited<ReturnType<typeof api.deskAccommodation>>

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December']

/** `2026-10-12` as `12 October`, read off the string rather than through a Date and a timezone. */
const festDate = (iso: string | null) => {
  if (!iso) return ''
  const [, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]}`
}

const BLANK_CONTACT = { name: '', email: '', phone: '', college: '', course: '', arrivalTime: '' }

export default function StayCounter() {
  const [card, setCard] = useState<AccommodationInfo | null>(null)
  const [cardError, setCardError] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [found, setFound] = useState<Found | null>(null)
  const [looking, setLooking] = useState(false)

  const [gender, setGender] = useState<'boys' | 'girls' | ''>('')
  const [roomTypeId, setRoomTypeId] = useState('')
  const [days, setDays] = useState<number | null>(null)
  const [arrivalDate, setArrivalDate] = useState('')
  const [contact, setContact] = useState(BLANK_CONTACT)
  const [rulesRead, setRulesRead] = useState(false)

  const [method, setMethod] = useState<'upi' | 'cash'>('upi')
  const [reference, setReference] = useState('')
  const [amount, setAmount] = useState('')

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [fatal, setFatal] = useState<string | null>(null)
  const [done, setDone] = useState<Done | null>(null)

  useEffect(() => {
    api
      .accommodation()
      .then((c) => {
        setCard(c)
        // One stay length, and one day it can start on, is the whole fest as
        // it is sold today: nothing to ask.
        if (c.allowedDays.length === 1) setDays(c.allowedDays[0])
      })
      .catch((err) => setCardError(err instanceof Error ? err.message : 'Could not load the rate card.'))
  }, [])

  const arrivals = useMemo(
    () => (card && days ? (card.arrivalDates[String(days)] ?? []) : []),
    [card, days],
  )

  useEffect(() => {
    setArrivalDate(arrivals.length === 1 ? arrivals[0] : '')
  }, [arrivals])

  const rooms = card?.rooms.filter((r) => r.gender === gender) ?? []
  const room = card?.rooms.find((r) => r.id === roomTypeId) ?? null
  const listPaise = room && days ? room.ratePaise * days : 0

  const lookUp = async () => {
    const address = email.trim()
    if (!address) return
    setLooking(true)
    setFatal(null)
    setErrors({})
    setFound(null)
    try {
      const res = await api.deskLookup(address)
      setFound(res)
      if (res.found) {
        setContact({
          name: res.name,
          email: res.email,
          phone: res.phone,
          college: res.college,
          course: res.course,
          arrivalTime: '',
        })
        // Only a starting point for which block to show. The agent picks.
        const side = res.gender === 'Male' ? 'boys' : res.gender === 'Female' ? 'girls' : ''
        setGender(side)
        setRoomTypeId('')
      }
    } catch (err) {
      setFatal(err instanceof Error ? err.message : 'Could not look that address up.')
    } finally {
      setLooking(false)
    }
  }

  const canBook = !!found && found.found && found.hasBasic

  const ready =
    !!card?.open && canBook && !!room && !!days && !!arrivalDate && rulesRead

  const submit = async () => {
    if (!room || !days) return
    setBusy(true)
    setFatal(null)
    setErrors({})
    try {
      const res = await api.deskAccommodation({
        lookupEmail: email.trim(),
        roomTypeId: room.id,
        days,
        arrivalDate,
        arrivalTime: contact.arrivalTime.trim() || undefined,
        name: contact.name.trim(),
        email: contact.email.trim(),
        phone: contact.phone.trim(),
        college: contact.college.trim(),
        course: contact.course.trim(),
        rulesAccepted: rulesRead,
        amountRupees: amount === '' ? undefined : Number(amount),
        paymentMethod: method,
        paymentReference: reference.trim(),
      })
      // The confirmation replaces a long form; on a phone the agent is
      // otherwise left looking at the footer.
      window.scrollTo({ top: 0 })
      setDone(res)
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields)
      else setFatal(err instanceof Error ? err.message : 'Could not book that bed.')
    } finally {
      setBusy(false)
    }
  }

  const next = () => {
    setDone(null)
    setEmail('')
    setFound(null)
    setGender('')
    setRoomTypeId('')
    setContact(BLANK_CONTACT)
    setRulesRead(false)
    setReference('')
    setAmount('')
    setErrors({})
    setFatal(null)
  }

  const setC = (k: keyof typeof BLANK_CONTACT) => (v: string) => setContact((c) => ({ ...c, [k]: v }))

  /* ---------- done ---------- */

  if (done) {
    return (
      <div className="mx-auto mt-10 max-w-md text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-b from-gold-bright to-gold-deep">
          <Check size={26} className="text-abyss" />
        </div>
        <h2 className="mt-4 font-display text-3xl text-foil">Bed booked.</h2>
        <p className="mt-2 text-[0.95rem] text-offwhite">
          {done.gender === 'boys' ? 'Boys' : 'Girls'} · {done.room}
        </p>
        <p className="text-[0.84rem] text-parchment/60">
          {festDate(done.arrivalDate)} to {festDate(done.departureDate)} · {done.days} days
        </p>

        <div className="mt-5 rounded-xl border border-gold/25 bg-abyss/50 px-6 py-5">
          <div className="font-log text-[0.6rem] uppercase tracking-wide2 text-parchment/50">
            Accommodation reference
          </div>
          <div className="mt-1 font-mono text-2xl tracking-widest text-gold-bright">{done.code}</div>
          <div className="mt-2 text-[0.78rem] text-parchment/50">Registration {done.publicCode}</div>
        </div>

        <p className="mt-4 text-[0.88rem] leading-relaxed text-parchment/70">
          {rupees(done.amountPaise)} collected. The receipt is on its way to their inbox and they are
          on the rooming list.
        </p>
        <p className="mt-3 text-[0.82rem] leading-relaxed text-parchment/55">
          Remind them: ₹{card?.depositRupees ?? 500} security deposit in cash at check-in, refunded at
          check-out.
        </p>

        <button
          onClick={next}
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep px-7 py-3 font-log text-[0.7rem] uppercase tracking-wide2 text-abyss"
        >
          <UserPlus size={15} /> Next booking
        </button>
      </div>
    )
  }

  /* ---------- the form ---------- */

  if (cardError) {
    return (
      <p className="mt-8 flex items-start gap-2 text-[0.86rem] text-coral">
        <AlertCircle size={15} className="mt-0.5 shrink-0" /> {cardError}
      </p>
    )
  }

  if (!card) {
    return (
      <div className="mt-8 flex items-center gap-2 text-[0.86rem] text-parchment/60">
        <Loader2 size={15} className="animate-spin" /> Loading the rate card…
      </div>
    )
  }

  if (!card.open) {
    return (
      <p className="mt-8 flex max-w-xl items-start gap-2 text-[0.86rem] leading-relaxed text-coral">
        <AlertCircle size={15} className="mt-0.5 shrink-0" />
        Accommodation bookings are closed{card.note ? ` (“${card.note}”)` : ''}. Open them on the
        admin dashboard first if there are beds to give.
      </p>
    )
  }

  return (
    <div>
      {/* Who */}
      <div className="mt-8">
        <Legend n="2" label="Whose bed" />
        <div className="mt-3 max-w-md">
          <Field
            label="Their email"
            error={errors.lookupEmail}
            hint="The address they registered with. A bed needs Basic Registration."
          >
            <div className="flex gap-2">
              <TextInput
                value={email}
                onChange={(v) => {
                  setEmail(v)
                  setFound(null)
                }}
                invalid={!!errors.lookupEmail}
                type="email"
                maxLength={200}
              />
              <button
                type="button"
                onClick={() => void lookUp()}
                disabled={looking || !email.trim()}
                className="shrink-0 rounded-lg px-4 font-log text-[0.66rem] uppercase tracking-wide2 text-gold-bright ring-1 ring-inset ring-gold/40 transition-colors hover:ring-gold/70 disabled:opacity-40"
              >
                {looking ? <Loader2 size={14} className="animate-spin" /> : 'Look up'}
              </button>
            </div>
          </Field>

          {found && !found.found && (
            <p className="mt-3 flex items-start gap-2 text-[0.84rem] leading-relaxed text-coral">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              Nobody is registered with that address. Check the spelling, or take their Basic
              Registration first.
            </p>
          )}

          {found?.found && (
            <div className="mt-3 rounded-lg border border-gold/25 bg-abyss/40 px-4 py-3">
              <div className="font-mono text-[0.9rem] tracking-widest text-gold-bright">
                {found.publicCode}
              </div>
              <div className="mt-1 text-[0.9rem] text-offwhite">{found.name}</div>
              <div className="text-[0.78rem] text-parchment/55">{found.college}</div>
              {!found.hasBasic && (
                <p className="mt-2.5 text-[0.82rem] leading-relaxed text-coral">
                  No Basic Registration, which a bed needs. Take their Basic Registration first, on
                  the tab above.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {canBook && (
        <>
          {/* The room */}
          <div className="mt-8">
            <Legend n="3" label="The room" />
            <div className="mt-3 max-w-xl space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <Choice on={gender === 'boys'} onClick={() => { setGender('boys'); setRoomTypeId('') }}>
                  Boys' block
                </Choice>
                <Choice on={gender === 'girls'} onClick={() => { setGender('girls'); setRoomTypeId('') }}>
                  Girls' block
                </Choice>
              </div>

              {gender && (
                <Field label="Room" error={errors.roomTypeId}>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {rooms.map((r) => (
                      <Choice
                        key={r.id}
                        on={roomTypeId === r.id}
                        onClick={() => setRoomTypeId(r.id)}
                        disabled={!r.open}
                      >
                        <span className="flex w-full items-center justify-between gap-3">
                          <span>{r.label}</span>
                          <span className={r.open ? 'text-parchment/60' : ''}>
                            {r.open ? `${rupees(r.ratePaise)}/day` : 'Closed'}
                          </span>
                        </span>
                      </Choice>
                    ))}
                  </div>
                </Field>
              )}

              {card.allowedDays.length > 1 && (
                <Field label="How long" error={errors.days}>
                  <div className="flex flex-wrap gap-2">
                    {card.allowedDays.map((d) => (
                      <Choice key={d} on={days === d} onClick={() => setDays(d)}>
                        {d} days
                      </Choice>
                    ))}
                  </div>
                </Field>
              )}

              {arrivals.length > 1 && (
                <Field label="Arriving" error={errors.arrivalDate}>
                  <div className="flex flex-wrap gap-2">
                    {arrivals.map((d) => (
                      <Choice key={d} on={arrivalDate === d} onClick={() => setArrivalDate(d)}>
                        {festDate(d)}
                      </Choice>
                    ))}
                  </div>
                </Field>
              )}

              {days && arrivalDate && (
                <p className="flex items-center gap-2 text-[0.82rem] text-parchment/60">
                  <BedDouble size={14} className="shrink-0 text-gold/70" />
                  {days} days from {festDate(arrivalDate)}
                  {room && ` · ${rupees(room.ratePaise)} × ${days} = ${rupees(listPaise)}`}
                </p>
              )}
            </div>
          </div>

          {/* Contact */}
          <div className="mt-8">
            <Legend n="4" label="Their details" />
            <p className="mt-2 max-w-xl text-[0.8rem] text-parchment/50">
              From their registration. Change anything that is different now: the accommodation desk
              rings this number, and the receipt goes to this email.
            </p>
            <div className="mt-3 grid max-w-xl gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Full name" error={errors.name}>
                  <TextInput value={contact.name} onChange={setC('name')} invalid={!!errors.name} maxLength={120} />
                </Field>
              </div>
              <Field label="Mobile" error={errors.phone}>
                <TextInput value={contact.phone} onChange={setC('phone')} invalid={!!errors.phone} inputMode="numeric" maxLength={15} />
              </Field>
              <Field label="Email" error={errors.email}>
                <TextInput value={contact.email} onChange={setC('email')} invalid={!!errors.email} type="email" maxLength={200} />
              </Field>
              <Field label="College" error={errors.college}>
                <TextInput value={contact.college} onChange={setC('college')} invalid={!!errors.college} maxLength={160} />
              </Field>
              <Field label="Course" error={errors.course}>
                <TextInput value={contact.course} onChange={setC('course')} invalid={!!errors.course} maxLength={160} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Arrival time" hint="Optional. Roughly when they will turn up.">
                  <TextInput value={contact.arrivalTime} onChange={setC('arrivalTime')} placeholder="e.g. evening of the 11th" maxLength={60} />
                </Field>
              </div>
            </div>
          </div>

          {/* House rules */}
          <div className="mt-8">
            <Legend n="5" label="House rules" />
            <div className="mt-3 max-w-xl rounded-lg border border-gold/20 bg-ocean/30 p-4">
              <ul className="grid gap-1.5">
                {HOUSE_RULES.map((r) => (
                  <li key={r} className="flex gap-2 text-[0.82rem] leading-relaxed text-parchment/70">
                    <span aria-hidden className="mt-[0.45em] h-1 w-1 shrink-0 rounded-full bg-gold/60" />
                    {r}
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <Checkbox checked={rulesRead} onChange={setRulesRead} error={errors.rulesAccepted}>
                  <span className="text-[0.84rem] text-parchment/80">
                    I have read these out to them and they agree.
                  </span>
                </Checkbox>
              </div>
            </div>
          </div>

          {/* Payment */}
          <div className="mt-8">
            <Legend n="6" label="How they paid" />
            <div className="mt-3 max-w-md space-y-3">
              <Field
                label="Amount collected (₹)"
                error={errors.amountRupees}
                hint={
                  room
                    ? `Leave blank if they paid the full ${rupees(listPaise)}. Enter less if you gave a discount. The ₹${card.depositRupees} deposit is separate, at check-in.`
                    : 'Pick the room first.'
                }
              >
                <TextInput
                  value={amount}
                  onChange={(v) => setAmount(v.replace(/[^0-9]/g, ''))}
                  invalid={!!errors.amountRupees}
                  inputMode="numeric"
                  placeholder={room ? String(listPaise / 100) : ''}
                  maxLength={6}
                />
              </Field>
              {amount !== '' && room && Number(amount) * 100 < listPaise && (
                <p className="text-[0.76rem] text-gold-bright/80">
                  {rupees(listPaise - Number(amount) * 100)} discount, recorded against this booking.
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Choice on={method === 'upi'} onClick={() => setMethod('upi')}>UPI</Choice>
                <Choice on={method === 'cash'} onClick={() => setMethod('cash')}>Cash</Choice>
              </div>
              <Field
                label={method === 'upi' ? 'UPI reference' : 'Receipt number'}
                error={errors.paymentReference}
                hint="Optional, but it is what lets the treasurer match the booking to the money later."
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
        </>
      )}

      {fatal && (
        <div className="mt-6 flex items-start gap-2 rounded-lg border border-coral/40 bg-coral/10 p-3.5 text-[0.86rem] leading-relaxed text-coral">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          {fatal}
        </div>
      )}

      <button
        onClick={() => void submit()}
        disabled={busy || !ready}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep py-4 font-log text-[0.74rem] uppercase tracking-wide2 text-abyss transition-transform hover:scale-[1.01] disabled:opacity-50"
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
        {!found
          ? 'Look them up first'
          : amount === ''
            ? 'Confirm and book'
            : `Confirm ₹${Number(amount)} collected`}
      </button>
    </div>
  )
}
