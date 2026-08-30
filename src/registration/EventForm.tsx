import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { AlertCircle, Check, Coins, Hourglass, Loader2, LogIn, Ticket, Users } from 'lucide-react'

import { ApiError, api, waitForConfirmation, type EventInfo } from '../api/client'
import { openCheckout, PaymentCancelled } from './razorpay'
import { Field, Select, TextArea, TextInput } from './fields'
import { CONVENIENCE_NOTE } from '../data/registration'

/**
 * Entering one event.
 *
 * The three states a visitor can be in, and what each one is shown:
 *
 *   not signed in    → what the event asks for, and a way in. Never a form they
 *                      would fill and then lose.
 *   signed in, unpaid→ told Basic Registration comes first, with the button.
 *   signed in, paid  → the actual form.
 *
 * Showing the form to someone who can't submit it is the mistake worth avoiding
 * here: they type for two minutes and then get told to go away.
 */
export default function EventForm({
  eventName,
  onNeedRegistration,
}: {
  eventName: string
  /** Take them to Basic Registration, keeping this event in mind. */
  onNeedRegistration: () => void
}) {
  const reduce = useReducedMotion()
  const [info, setInfo] = useState<EventInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [asTeam, setAsTeam] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [fatal, setFatal] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  /** Which price band applies, for events that charge different people differently. */
  const [variant, setVariant] = useState<string | null>(null)
  const [paying, setPaying] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    api
      .event(eventName)
      .then((e) => {
        if (!alive) return
        setInfo(e)
        setAsTeam(e.form.requiresTeam)
        // One band means there is nothing to choose; don't make them choose it.
        if (e.fee?.variants.length === 1) setVariant(e.fee.variants[0].id)
      })
      .catch((err) => alive && setLoadError(err instanceof Error ? err.message : 'Could not load this event.'))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [eventName])

  /**
   * Enter, and pay if the event charges.
   *
   * The server decides whether there is anything to pay: it answers with a
   * checkout or with nothing, and the amount is never something this screen
   * sends. A cancelled payment leaves a pending entry behind, which the next
   * attempt stands down, so cancelling and retrying is safe.
   */
  const submit = async () => {
    if (!info) return
    setBusy(true)
    setFatal(null)
    setErrors({})
    try {
      const res = await api.enterEvent({
        eventName: info.name,
        participation: asTeam ? 'team' : 'solo',
        teamName: asTeam ? teamName.trim() : undefined,
        feeVariant: variant ?? undefined,
        answers,
      })

      if (!res.checkout) {
        setDone(true)
        return
      }

      setPaying('Opening payment…')
      await openCheckout(res.checkout)

      setPaying('Confirming your entry…')
      const confirmed = res.orderId ? await waitForConfirmation(res.orderId) : false
      if (confirmed) {
        setDone(true)
      } else {
        setFatal(
          'Your payment went through and the entry is still confirming. Open My Pass in a moment and it will be there.',
        )
      }
    } catch (err) {
      if (err instanceof PaymentCancelled) {
        setFatal('Payment cancelled. Nothing has been charged, and you can try again.')
      } else if (err instanceof ApiError && err.fields) {
        setErrors(err.fields)
      } else {
        setFatal(err instanceof Error ? err.message : 'Could not save that entry.')
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
        {loadError ?? "That event isn't on the chart."}
      </p>
    )
  }

  const fee = info.fee

  const header = (
    <div className="mb-6">
      <div className="font-log text-[0.66rem] uppercase tracking-cinema text-gold/70">
        {info.territory.code} · {info.territory.name}
      </div>
      <div className="mt-1 font-display text-[1.05rem] leading-tight text-offwhite">{info.tag}</div>
    </div>
  )

  /* ---------- entries not open ---------- */

  if (!info.open) {
    return (
      <div>
        {header}
        <div className="glass flex flex-col items-center gap-3 rounded-xl px-6 py-12 text-center">
          <Hourglass size={22} className="text-gold/60" />
          <p className="font-display text-2xl text-offwhite">Coming Soon</p>
          <p className="max-w-sm text-[0.86rem] leading-relaxed text-parchment/65">
            Entries for {info.name} aren't open yet. The crew is still finalising the rules; the
            form lands here well before the fest.
          </p>
        </div>
      </div>
    )
  }

  /* ---------- already in ---------- */

  if (done || info.entered) {
    return (
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="py-8 text-center"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-b from-gold-bright to-gold-deep">
          <Check size={26} className="text-abyss" />
        </div>
        <h3 className="mt-4 font-display text-2xl text-foil">You're entered for {info.name}.</h3>
        <p className="mx-auto mt-2 max-w-sm text-[0.88rem] leading-relaxed text-parchment/70">
          It's on your pass page under <span className="text-gold-bright">Events you've entered</span>.
          The {info.territory.code} wardens will be in touch with the schedule.
        </p>
      </motion.div>
    )
  }

  /* ---------- not signed in ---------- */

  if (!info.signedIn) {
    return (
      <div>
        {header}
        <EventSummary info={info} fee={fee} />

        <div className="mt-5 rounded-xl border border-gold/25 bg-ocean/40 p-5">
          <div className="flex items-start gap-3">
            <LogIn size={18} className="mt-0.5 shrink-0 text-gold-bright" />
            <div>
              <div className="font-display text-[0.95rem] text-offwhite">Sign in to enter</div>
              <p className="mt-1 text-[0.84rem] leading-relaxed text-parchment/70">
                {fee
                  ? 'Your Basic Registration covers being on the island; this event charges its own entry fee on top, paid here.'
                  : 'Entering an event costs nothing extra: your Basic Registration already covers it.'}{' '}
                We just need to know who you are.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <a
              href={`${import.meta.env.BASE_URL}sign-in`}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep py-3 font-log text-[0.68rem] uppercase tracking-wide2 text-abyss"
            >
              <LogIn size={14} /> I've registered, sign me in
            </a>
            <button
              type="button"
              onClick={onNeedRegistration}
              className="flex flex-1 items-center justify-center gap-2 rounded-full px-5 py-3 font-log text-[0.68rem] uppercase tracking-wide2 text-gold-bright ring-1 ring-inset ring-gold/55 transition-colors hover:bg-gold/10"
            >
              <Ticket size={14} /> I'm new here
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ---------- signed in, but hasn't paid ---------- */

  if (!info.eligible) {
    return (
      <div>
        {header}
        <EventSummary info={info} fee={fee} />
        <div className="mt-5 rounded-xl border border-ember/40 bg-ember/10 p-5 text-center">
          <AlertCircle size={20} className="mx-auto text-ember" />
          <p className="mt-3 text-[0.88rem] leading-relaxed text-parchment/80">
            Basic Registration comes first. It's ₹500, it's compulsory for everyone, and it covers
            every event including this one.
          </p>
          <button
            type="button"
            onClick={onNeedRegistration}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep px-6 py-3 font-log text-[0.68rem] uppercase tracking-wide2 text-abyss"
          >
            <Ticket size={14} /> Do my Basic Registration
          </button>
        </div>
      </div>
    )
  }

  /* ---------- the form ---------- */

  const min = info.form.teamSize?.min ?? 2
  const max = info.form.teamSize?.max ?? 99

  return (
    <div>
      {header}

      {fee ? (
        <FeeCard fee={fee} picked={variant} onPick={setVariant} error={errors.feeVariant} />
      ) : (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-aqua/35 bg-aqua/10 px-3.5 py-2.5">
          <Check size={14} className="shrink-0 text-aqua" />
          <span className="text-[0.82rem] text-parchment/80">
            Registered. Entering this event costs nothing extra.
          </span>
        </div>
      )}

      {info.form.note && (
        <p className="mb-5 text-[0.84rem] leading-relaxed text-parchment/65">{info.form.note}</p>
      )}

      <div className="space-y-5">
        {info.form.allowsTeam && !info.form.requiresTeam && (
          <Field label="Entering as" required>
            <div className="flex gap-2">
              {[
                { team: false, label: 'Solo' },
                { team: true, label: `Team (${min}–${max})` },
              ].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => setAsTeam(o.team)}
                  className={`flex-1 rounded-lg px-4 py-2.5 text-[0.84rem] transition-colors ${
                    asTeam === o.team
                      ? 'bg-gold/20 text-gold-bright ring-1 ring-inset ring-gold/70'
                      : 'text-parchment/70 ring-1 ring-inset ring-gold/30 hover:ring-gold/70'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </Field>
        )}

        {asTeam && (
          <>
            <Field label="Team name" required error={errors.teamName}>
              <TextInput
                value={teamName}
                onChange={setTeamName}
                invalid={!!errors.teamName}
                placeholder="What do they call your crew?"
              />
            </Field>
            <div className="flex gap-3 rounded-lg border border-gold/25 bg-ocean/40 p-4">
              <Users size={17} className="mt-0.5 shrink-0 text-gold-bright" />
              <p className="text-[0.82rem] leading-relaxed text-parchment/75">
                Register your team here, then share your team name with your crew. Each of them
                needs their own Basic Registration and should enter this event too.{' '}
                <span className="text-parchment/50">
                  Invite links are coming; for now the wardens match crews by team name.
                </span>
              </p>
            </div>
          </>
        )}

        {info.form.fields.map((f) => (
          <Field key={f.id} label={f.label} required={f.required} error={errors[f.id]} hint={f.help}>
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
                type={f.type === 'number' ? 'number' : f.type === 'url' ? 'url' : 'text'}
                inputMode={f.type === 'number' ? 'numeric' : undefined}
              />
            )}
          </Field>
        ))}

        {fatal && (
          <div className="flex items-start gap-2 rounded-lg border border-coral/50 bg-coral/10 p-3 text-[0.82rem] text-coral">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            {fatal}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => void submit()}
        disabled={busy || (!!fee && !variant)}
        className="mt-7 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep py-3.5 font-log text-[0.72rem] uppercase tracking-wide2 text-abyss transition-transform hover:scale-[1.01] disabled:opacity-60"
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Ticket size={15} />}
        {paying ?? (busy ? 'Saving…' : fee ? `Pay ${pickedAmount(fee, variant)} and enter` : 'Confirm entry')}
      </button>

      {fee && (
        <p className="mt-3 text-center text-[0.72rem] leading-relaxed text-parchment/45">
          {CONVENIENCE_NOTE}
        </p>
      )}
    </div>
  )
}

type Fee = NonNullable<EventInfo['fee']>

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`

/** The picked band's price, for the button. */
function pickedAmount(fee: Fee, picked: string | null): string {
  const v = fee.variants.find((x) => x.id === picked) ?? fee.variants[0]
  return rupees(v.amountPaise)
}

/** "₹160 per team", or one line per band. */
function feeSummary(fee: Fee): string {
  if (fee.variants.length === 1) {
    return `${rupees(fee.variants[0].amountPaise)} per ${fee.unit === 'person' ? 'person' : 'team'}`
  }
  return fee.variants.map((v) => `${v.label} ${rupees(v.amountPaise)}`).join(', ')
}

/**
 * The entry fee, and which band applies.
 *
 * Its own block rather than a line in the summary: it is the one thing on this
 * screen that costs money, and it should not be discovered halfway down a list
 * of ticks. Where an event charges different people differently the bands are
 * radio buttons, because the alternative is asking somebody to read a table and
 * then pay the wrong one.
 */
function FeeCard({
  fee,
  picked,
  onPick,
  error,
}: {
  fee: Fee
  picked: string | null
  onPick: (id: string) => void
  error?: string
}) {
  const single = fee.variants.length === 1
  return (
    <div
      className={`mb-5 rounded-lg border px-4 py-3.5 ${
        error ? 'border-coral/60 bg-coral/10' : 'border-gold/35 bg-gold/[0.07]'
      }`}
    >
      <div className="flex items-center gap-2">
        <Coins size={14} className="shrink-0 text-gold-bright" />
        <span className="font-log text-[0.6rem] uppercase tracking-wide2 text-gold-bright">
          Entry fee
        </span>
      </div>

      {single ? (
        <p className="mt-2 text-[0.95rem] text-offwhite">
          {rupees(fee.variants[0].amountPaise)}{' '}
          <span className="text-[0.82rem] text-parchment/60">
            per {fee.unit === 'person' ? 'person' : 'team'}
          </span>
        </p>
      ) : (
        <div className="mt-2.5 grid gap-2">
          {fee.variants.map((v) => {
            const on = picked === v.id
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onPick(v.id)}
                aria-pressed={on}
                className={`flex items-center justify-between gap-3 rounded-lg px-3.5 py-2.5 text-left transition-colors ${
                  on
                    ? 'bg-gold/20 ring-1 ring-inset ring-gold/70'
                    : 'ring-1 ring-inset ring-gold/25 hover:ring-gold/60'
                }`}
              >
                <span className={`text-[0.86rem] ${on ? 'text-gold-bright' : 'text-parchment/80'}`}>
                  {v.label}
                </span>
                <span className={`text-[0.92rem] ${on ? 'text-gold-bright' : 'text-offwhite/85'}`}>
                  {rupees(v.amountPaise)}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {error && <p className="mt-2 text-[0.78rem] text-coral">{error}</p>}
    </div>
  )
}

/** What the event asks for, shown before anyone commits to filling it in. */
function EventSummary({ info, fee }: { info: EventInfo; fee: Fee | null }) {
  const min = info.form.teamSize?.min
  const max = info.form.teamSize?.max

  return (
    <div className="rounded-xl border border-gold/20 bg-ocean/30 p-4">
      <div className="font-log text-[0.6rem] uppercase tracking-wide2 text-parchment/50">
        What this event needs
      </div>
      <ul className="mt-2.5 grid gap-1.5">
        <li className="flex items-center gap-2 text-[0.84rem] text-parchment/75">
          <Check size={12} className="shrink-0 text-aqua" />
          {info.form.requiresTeam
            ? `A team of ${min}–${max}`
            : info.form.allowsTeam
              ? `Solo, or a team of ${min}–${max}`
              : 'Solo entry'}
        </li>
        {info.form.fields.slice(0, 4).map((f) => (
          <li key={f.id} className="flex items-center gap-2 text-[0.84rem] text-parchment/75">
            <Check size={12} className="shrink-0 text-aqua" />
            {f.label}
            {f.required ? '' : ' (optional)'}
          </li>
        ))}
        <li className="flex items-center gap-2 text-[0.84rem] text-parchment/75">
          <Check size={12} className="shrink-0 text-aqua" />
          {fee ? `Entry fee: ${feeSummary(fee)}` : 'No extra payment'}
        </li>
      </ul>
    </div>
  )
}

