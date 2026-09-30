import { useMemo, useState } from 'react'
import { AlertCircle, Check, Loader2, Plus, Trash2, UserPlus } from 'lucide-react'

import {
  ApiError,
  api,
  type EntrantInput,
  type EventInfo,
  type TeamMemberInput,
} from '../api/client'
import { Field, Select, TextArea, TextInput, inputBase } from '../registration/fields'
import { territories } from '../data/events'
import { Choice, Legend } from './ui'

/**
 * The desk's event counter: enter somebody for one event and take its fee.
 *
 * The person is named by address and looked up before any money changes
 * hands, like the Festival Pass counter. They must hold Basic Registration,
 * unless the event waives it (Badminton), in which case somebody new is
 * created from a name, a mobile and a college.
 *
 * The form itself is the event's own: its bands, its team bounds and its
 * questions, read from the same endpoint the event card uses. The server holds
 * the entry to the same rules as the online form, so nothing here can enter
 * somebody the website would have refused.
 */

/** Events the desk can enter people for, grouped by vertical. External forms are the crews' own. */
const GROUPS = territories
  .filter((t) => !t.noRegister)
  .map((t) => ({
    label: `${t.code} · ${t.territory}`,
    events: t.events.filter((e) => !e.form).map((e) => e.name),
  }))
  .filter((g) => g.events.length > 0)

type Found = Awaited<ReturnType<typeof api.deskLookup>>

type Done = {
  publicCode: string
  eventName: string
  band: string | null
  amountPaise: number
  createdPerson: boolean
}

const BLANK_ENTRANT: EntrantInput = { name: '', phone: '', college: '' }

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`

const blankRows = (n: number): TeamMemberInput[] =>
  Array.from({ length: Math.max(0, n) }, () => ({ name: '', phone: '' }))

export default function EventCounter() {
  const [eventName, setEventName] = useState('')
  const [info, setInfo] = useState<EventInfo | null>(null)
  const [loadingEvent, setLoadingEvent] = useState(false)

  const [email, setEmail] = useState('')
  const [found, setFound] = useState<Found | null>(null)
  const [looking, setLooking] = useState(false)
  const [entrant, setEntrant] = useState<EntrantInput>(BLANK_ENTRANT)

  const [variant, setVariant] = useState<string | null>(null)
  const [asTeam, setAsTeam] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [members, setMembers] = useState<TeamMemberInput[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})

  const [method, setMethod] = useState<'upi' | 'cash'>('upi')
  const [reference, setReference] = useState('')
  const [amount, setAmount] = useState('')

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [fatal, setFatal] = useState<string | null>(null)
  const [done, setDone] = useState<Done | null>(null)

  /** Everything about the entry itself, so the next person starts clean. */
  const resetEntry = (e: EventInfo | null) => {
    setVariant(e?.fee?.variants.length === 1 ? e.fee.variants[0].id : null)
    setAsTeam(!!e?.form.requiresTeam)
    setTeamName('')
    setMembers(e?.form.requiresTeam && e.form.teamSize ? blankRows(e.form.teamSize.min - 1) : [])
    setAnswers({})
    setAmount('')
    setReference('')
    setErrors({})
    setFatal(null)
  }

  const pickEvent = async (name: string) => {
    setEventName(name)
    setInfo(null)
    resetEntry(null)
    if (!name) return
    setLoadingEvent(true)
    try {
      const e = await api.event(name)
      setInfo(e)
      resetEntry(e)
    } catch (err) {
      setFatal(err instanceof Error ? err.message : 'Could not load that event.')
    } finally {
      setLoadingEvent(false)
    }
  }

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
      // Somebody who entered Badminton before already has these on file.
      setEntrant(
        res.found
          ? { name: res.name ?? '', phone: res.phone ?? '', college: res.college ?? '' }
          : BLANK_ENTRANT,
      )
    } catch (err) {
      setFatal(err instanceof Error ? err.message : 'Could not look that address up.')
    } finally {
      setLooking(false)
    }
  }

  // Every row counts at the desk, named or not: names may be skipped, the
  // team size may not.
  const headCount = asTeam ? members.length + 1 : 1
  const fee = info?.fee ?? null
  const picked = useMemo(() => fee?.variants.find((v) => v.id === variant) ?? null, [fee, variant])
  const listPaise = picked ? (picked.perHead ? picked.amountPaise * headCount : picked.amountPaise) : 0

  const hasBasic = !!found && found.found && found.hasBasic
  /** Basic is missing and this event will not go ahead without it. */
  const blockedOnBasic = !!info && !!found && info.requiresBasic && !hasBasic
  /** No Basic, but the event waives it: their details are asked for here. */
  const needsEntrant = !!info && !!found && !info.requiresBasic && !hasBasic

  const min = info?.form.teamSize?.min ?? 2
  const max = info?.form.teamSize?.max ?? 99
  const sizeOff = asTeam && !!info?.form.teamSize && (headCount < min || headCount > max)

  const ready =
    !!info && info.open && !info.externalForm && !!found && !blockedOnBasic &&
    (!fee || !!variant) && !sizeOff

  const submit = async () => {
    if (!info) return
    setBusy(true)
    setFatal(null)
    setErrors({})
    try {
      const res = await api.deskEnterEvent({
        email: email.trim(),
        eventName: info.name,
        participation: asTeam ? 'team' : 'solo',
        teamName: asTeam ? teamName.trim() : undefined,
        feeVariant: variant ?? undefined,
        // An unnamed row is sent as "Team-mate 2" and so on, so it still counts
        // towards the team size and the sheet shows a place to fill in later.
        members: asTeam
          ? members.map((m, i) => ({
              name: m.name.trim().length > 1 ? m.name.trim() : `Team-mate ${i + 2}`,
              phone: m.phone.trim(),
            }))
          : undefined,
        answers,
        entrant: needsEntrant
          ? { name: entrant.name.trim(), phone: entrant.phone.trim(), college: entrant.college.trim() }
          : undefined,
        ...(fee
          ? {
              amountRupees: amount === '' ? undefined : Number(amount),
              paymentMethod: method,
              paymentReference: reference.trim(),
            }
          : {}),
      })
      // The confirmation replaces a long form; on a phone the agent is
      // otherwise left looking at the footer.
      window.scrollTo({ top: 0 })
      setDone({
        publicCode: res.publicCode,
        eventName: res.eventName,
        band: res.band,
        amountPaise: res.amountPaise,
        createdPerson: res.createdPerson,
      })
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields)
      else setFatal(err instanceof Error ? err.message : 'Could not record that entry.')
    } finally {
      setBusy(false)
    }
  }

  /** The next person, usually for the same event: a badminton queue is one event. */
  const next = () => {
    setDone(null)
    setEmail('')
    setFound(null)
    setEntrant(BLANK_ENTRANT)
    resetEntry(info)
  }

  /* ---------- done ---------- */

  if (done) {
    return (
      <div className="mx-auto mt-10 max-w-md text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-b from-gold-bright to-gold-deep">
          <Check size={26} className="text-abyss" />
        </div>
        <h2 className="mt-4 font-display text-3xl text-foil">Entered.</h2>
        <p className="mt-2 text-[0.95rem] text-offwhite">
          {done.eventName}
          {done.band && <span className="text-parchment/60"> · {done.band}</span>}
        </p>

        <div className="mt-5 rounded-xl border border-gold/25 bg-abyss/50 px-6 py-5">
          <div className="font-log text-[0.6rem] uppercase tracking-wide2 text-parchment/50">
            Registration number
          </div>
          <div className="mt-1 font-mono text-2xl tracking-widest text-gold-bright">
            {done.publicCode}
          </div>
        </div>

        <p className="mt-4 text-[0.88rem] leading-relaxed text-parchment/70">
          {done.amountPaise > 0 ? `${rupees(done.amountPaise)} collected. ` : ''}
          The confirmation is on its way to their inbox, and they are on the event's sheet.
        </p>
        {done.createdPerson && (
          <p className="mt-3 text-[0.82rem] leading-relaxed text-parchment/50">
            They were new, so a record was made for them. If they later want Basic Registration, it
            completes this one rather than making a second.
          </p>
        )}

        <button
          onClick={next}
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep px-7 py-3 font-log text-[0.7rem] uppercase tracking-wide2 text-abyss"
        >
          <UserPlus size={15} /> Next entry
        </button>
      </div>
    )
  }

  /* ---------- the form ---------- */

  return (
    <div>
      {/* Which event */}
      <div className="mt-8">
        <Legend n="2" label="Which event" />
        <div className="mt-3 max-w-md">
          <select
            value={eventName}
            onChange={(e) => void pickEvent(e.target.value)}
            className={`${inputBase} appearance-none border-gold/25 ${eventName ? '' : 'text-parchment/40'}`}
          >
            <option value="">Choose an event…</option>
            {GROUPS.map((g) => (
              <optgroup key={g.label} label={g.label} className="bg-ocean text-parchment/60">
                {g.events.map((name) => (
                  <option key={name} value={name} className="bg-ocean text-offwhite">
                    {name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          {loadingEvent && (
            <div className="mt-3 flex items-center gap-2 text-[0.84rem] text-parchment/60">
              <Loader2 size={14} className="animate-spin" /> Loading the form…
            </div>
          )}

          {info && !info.open && (
            <p className="mt-3 flex items-start gap-2 text-[0.84rem] leading-relaxed text-coral">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              Entries for {info.name} are closed. Open it on the admin switchboard first if it should
              take more.
            </p>
          )}

          {info?.open && (
            <p className="mt-2 text-[0.78rem] text-parchment/50">
              {info.requiresBasic
                ? 'Needs Basic Registration first.'
                : 'No Basic Registration needed for this one.'}{' '}
              {fee ? '' : 'Free to enter: no money is taken.'}
            </p>
          )}
        </div>
      </div>

      {info?.open && (
        <>
          {/* Who */}
          <div className="mt-8">
            <Legend n="3" label="Who is entering" />
            <div className="mt-3 max-w-md">
              <Field
                label="Their email"
                error={errors.email}
                hint="Look them up before taking the money. The confirmation goes here."
              >
                <div className="flex gap-2">
                  <TextInput
                    value={email}
                    onChange={(v) => {
                      setEmail(v)
                      setFound(null)
                    }}
                    invalid={!!errors.email}
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

              {found?.found && (
                <div className="mt-3 rounded-lg border border-gold/25 bg-abyss/40 px-4 py-3">
                  <div className="font-mono text-[0.9rem] tracking-widest text-gold-bright">
                    {found.publicCode}
                  </div>
                  {found.name && <div className="mt-1 text-[0.9rem] text-offwhite">{found.name}</div>}
                  {found.college && (
                    <div className="text-[0.78rem] text-parchment/55">{found.college}</div>
                  )}
                  <p className="mt-2 text-[0.8rem] text-parchment/60">
                    {found.hasDelegate
                      ? 'Festival Pass holder.'
                      : found.hasBasic
                        ? 'On Basic Registration.'
                        : 'Has an account, but no Basic Registration.'}
                  </p>
                </div>
              )}

              {blockedOnBasic && (
                <p className="mt-3 flex items-start gap-2 text-[0.84rem] leading-relaxed text-coral">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  {found?.found
                    ? `${info.name} needs Basic Registration, and they haven't paid for it. Take their Basic Registration first, on the tab above.`
                    : `Nobody is registered with that address, and ${info.name} needs Basic Registration. Check the spelling, or take their Basic Registration first.`}
                </p>
              )}

              {needsEntrant && (
                <div className="mt-4 grid gap-3 rounded-lg border border-gold/25 bg-ocean/40 p-4 sm:grid-cols-2">
                  <p className="text-[0.8rem] leading-relaxed text-parchment/65 sm:col-span-2">
                    {found?.found
                      ? 'No Basic Registration, which this event doesn\'t need. Check these with them: they go on the organisers\' sheet.'
                      : 'New to us. This event doesn\'t need Basic Registration, so a record is made from these.'}
                  </p>
                  <div className="sm:col-span-2">
                    <Field label="Full name" error={errors.entrantName}>
                      <TextInput
                        value={entrant.name}
                        onChange={(v) => setEntrant((e) => ({ ...e, name: v }))}
                        invalid={!!errors.entrantName}
                        maxLength={120}
                      />
                    </Field>
                  </div>
                  <Field label="Mobile" error={errors.entrantPhone}>
                    <TextInput
                      value={entrant.phone}
                      onChange={(v) => setEntrant((e) => ({ ...e, phone: v }))}
                      invalid={!!errors.entrantPhone}
                      inputMode="numeric"
                      maxLength={15}
                    />
                  </Field>
                  <Field label="College" error={errors.entrantCollege}>
                    <TextInput
                      value={entrant.college}
                      onChange={(v) => setEntrant((e) => ({ ...e, college: v }))}
                      invalid={!!errors.entrantCollege}
                      maxLength={160}
                    />
                  </Field>
                </div>
              )}
            </div>
          </div>

          {/* The entry */}
          <div className="mt-8">
            <Legend n="4" label="The entry" />
            <div className="mt-3 max-w-xl space-y-5">
              {fee && fee.variants.length > 1 && (
                <Field label="Category" error={errors.feeVariant}>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {fee.variants.map((v) => (
                      <Choice key={v.id} on={variant === v.id} onClick={() => setVariant(v.id)}>
                        <span className="flex w-full items-center justify-between gap-3">
                          <span>{v.label}</span>
                          <span className="text-parchment/60">
                            {rupees(v.amountPaise)}
                            {v.perHead && '/head'}
                          </span>
                        </span>
                      </Choice>
                    ))}
                  </div>
                </Field>
              )}

              {info.form.allowsTeam && !info.form.requiresTeam && (
                <Field label="Entering as">
                  <div className="grid grid-cols-2 gap-2">
                    <Choice on={!asTeam} onClick={() => setAsTeam(false)}>Solo</Choice>
                    <Choice
                      on={asTeam}
                      onClick={() => {
                        setAsTeam(true)
                        if (members.length === 0) setMembers(blankRows(Math.max(1, min - 1)))
                      }}
                    >
                      Team ({min}–{max})
                    </Choice>
                  </div>
                </Field>
              )}

              {asTeam && (
                <>
                  <Field label="Team name" error={errors.teamName}>
                    <TextInput value={teamName} onChange={setTeamName} invalid={!!errors.teamName} maxLength={120} />
                  </Field>
                  <Field
                    label="The rest of the team"
                    error={errors.members}
                    hint={`The person paying is counted already. ${min}–${max} people in total.`}
                  >
                    <div className="space-y-2">
                      {members.map((m, i) => (
                        <div key={i} className="flex gap-2">
                          <div className="flex-1">
                            <TextInput
                              value={m.name}
                              onChange={(v) =>
                                setMembers((prev) => prev.map((x, j) => (j === i ? { ...x, name: v } : x)))
                              }
                              placeholder={`Team-mate ${i + 1} · full name`}
                            />
                          </div>
                          <div className="w-28 shrink-0 sm:w-36">
                            <TextInput
                              value={m.phone}
                              onChange={(v) =>
                                setMembers((prev) => prev.map((x, j) => (j === i ? { ...x, phone: v } : x)))
                              }
                              placeholder="Mobile"
                              inputMode="numeric"
                            />
                          </div>
                          <button
                            type="button"
                            aria-label={`Remove team-mate ${i + 1}`}
                            onClick={() => setMembers((prev) => prev.filter((_, j) => j !== i))}
                            className="flex w-10 shrink-0 items-center justify-center rounded-lg text-parchment/45 ring-1 ring-inset ring-gold/20 hover:text-coral"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setMembers((prev) => [...prev, { name: '', phone: '' }])}
                          disabled={members.length >= max - 1}
                          className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 font-log text-[0.62rem] uppercase tracking-wide2 text-gold-bright ring-1 ring-inset ring-gold/40 disabled:opacity-40"
                        >
                          <Plus size={12} /> Add a team-mate
                        </button>
                        <span className={`font-log text-[0.62rem] uppercase tracking-wide2 ${sizeOff ? 'text-coral' : 'text-parchment/50'}`}>
                          {headCount} of {min}–{max}
                        </span>
                      </div>
                    </div>
                  </Field>
                </>
              )}

              {info.form.fields.map((f) => (
                <Field key={f.id} label={f.label} error={errors[f.id]} hint={f.help}>
                  {f.type === 'textarea' ? (
                    <TextArea
                      value={answers[f.id] ?? ''}
                      onChange={(v) => setAnswers((a) => ({ ...a, [f.id]: v }))}
                      invalid={!!errors[f.id]}
                      placeholder={f.placeholder}
                    />
                  ) : f.type === 'select' ? (
                    <Select
                      value={answers[f.id] ?? ''}
                      onChange={(v) => setAnswers((a) => ({ ...a, [f.id]: v }))}
                      invalid={!!errors[f.id]}
                      options={f.options ?? []}
                    />
                  ) : (
                    <TextInput
                      value={answers[f.id] ?? ''}
                      onChange={(v) => setAnswers((a) => ({ ...a, [f.id]: v }))}
                      invalid={!!errors[f.id]}
                      placeholder={f.placeholder}
                      inputMode={f.type === 'number' ? 'numeric' : undefined}
                    />
                  )}
                </Field>
              ))}

              {errors.participation && <p className="text-[0.8rem] text-coral">{errors.participation}</p>}
            </div>
          </div>

          {/* Payment, only when there is something to pay */}
          {fee && (
            <div className="mt-8">
              <Legend n="5" label="How they paid" />
              <div className="mt-3 max-w-md space-y-3">
                <Field
                  label="Amount collected (₹)"
                  error={errors.amountRupees}
                  hint={
                    picked
                      ? `Leave blank if they paid the full ${rupees(listPaise)}${picked.perHead ? ` (${rupees(picked.amountPaise)} × ${headCount})` : ''}. Enter less if you gave a discount.`
                      : 'Pick the category first.'
                  }
                >
                  <TextInput
                    value={amount}
                    onChange={(v) => setAmount(v.replace(/[^0-9]/g, ''))}
                    invalid={!!errors.amountRupees}
                    inputMode="numeric"
                    placeholder={picked ? String(listPaise / 100) : ''}
                    maxLength={6}
                  />
                </Field>
                {amount !== '' && picked && Number(amount) * 100 < listPaise && (
                  <p className="text-[0.76rem] text-gold-bright/80">
                    {rupees(listPaise - Number(amount) * 100)} discount, recorded against this entry.
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <Choice on={method === 'upi'} onClick={() => setMethod('upi')}>UPI</Choice>
                  <Choice on={method === 'cash'} onClick={() => setMethod('cash')}>Cash</Choice>
                </div>
                <Field
                  label={method === 'upi' ? 'UPI reference' : 'Receipt number'}
                  error={errors.paymentReference}
                  hint="Optional, but it is what lets the treasurer match the entry to the money later."
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
          )}
        </>
      )}

      {fatal && (
        <div className="mt-6 flex items-start gap-2 rounded-lg border border-coral/40 bg-coral/10 p-3.5 text-[0.86rem] leading-relaxed text-coral">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          {fatal}
        </div>
      )}

      {info?.open && (
        <button
          onClick={() => void submit()}
          disabled={busy || !ready}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep py-4 font-log text-[0.74rem] uppercase tracking-wide2 text-abyss transition-transform hover:scale-[1.01] disabled:opacity-50"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          {!found
            ? 'Look them up first'
            : !fee
              ? 'Confirm entry'
              : amount === ''
                ? 'Confirm and enter'
                : `Confirm ₹${Number(amount)} collected`}
        </button>
      )}
    </div>
  )
}
