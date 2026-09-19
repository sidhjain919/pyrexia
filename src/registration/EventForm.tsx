import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  AlertCircle,
  BookOpen,
  Check,
  Coins,
  ExternalLink,
  Hourglass,
  Loader2,
  LogIn,
  Plus,
  Ticket,
  Trash2,
  Users,
} from 'lucide-react'

import { ApiError, api, waitForConfirmation, type EventInfo, type TeamMemberInput } from '../api/client'
import { openCheckout, PaymentCancelled } from './razorpay'
import { Field, Select, TextArea, TextInput } from './fields'
import { CONVENIENCE_NOTE } from '../data/registration'
import { detailFor } from '../data/rulebooks'
import { asset } from '../lib/asset'

/**
 * Entering one event.
 *
 * The states a visitor can be in, and what each one is shown:
 *
 *   entries not open  → the rules and the rulebook, so the wait is useful.
 *   external form     → the rules, then a button to the crew's own form.
 *   not signed in     → what the event asks for, and a way in. Never a form
 *                       they would fill and then lose.
 *   signed in, unpaid → told Basic Registration comes first, with the button.
 *   signed in, paid   → the actual form.
 *
 * Showing the form to someone who can't submit it is the mistake worth avoiding
 * here: they type for two minutes and then get told to go away.
 *
 * A team enters once. Whoever is filling this in lists their crew and pays for
 * everyone; nobody else has to click a link, accept an invitation or hold an
 * account. That is what the rulebooks describe, and it is one fewer thing to go
 * wrong at nine in the evening on the last day of entries.
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
  const [members, setMembers] = useState<TeamMemberInput[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [fatal, setFatal] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  /** Which price band applies, for events that charge different people differently. */
  const [variant, setVariant] = useState<string | null>(null)
  const [paying, setPaying] = useState<string | null>(null)

  const detail = detailFor(eventName)

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
        // A team event opens with the minimum number of blank rows already
        // there, so it reads as a list to fill rather than a button to find.
        if (e.form.requiresTeam && e.form.teamSize) {
          setMembers(blankRows(e.form.teamSize.min - 1))
        }
      })
      .catch((err) => alive && setLoadError(err instanceof Error ? err.message : 'Could not load this event.'))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [eventName])

  /** Everyone this entry covers: the crew, plus whoever is filling the form in. */
  const headCount = asTeam ? members.filter((m) => m.name.trim().length > 1).length + 1 : 1

  const pickedVariant = useMemo(
    () => info?.fee?.variants.find((v) => v.id === variant) ?? null,
    [info, variant],
  )

  /** What this entry costs right now, with a per-head band multiplied out. */
  const totalPaise = pickedVariant
    ? pickedVariant.perHead
      ? pickedVariant.amountPaise * headCount
      : pickedVariant.amountPaise
    : 0

  const setMember = (i: number, patch: Partial<TeamMemberInput>) =>
    setMembers((prev) => prev.map((m, j) => (i === j ? { ...m, ...patch } : m)))

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
        members: asTeam
          ? members
              .map((m) => ({ name: m.name.trim(), phone: m.phone.trim() }))
              .filter((m) => m.name.length > 1)
          : undefined,
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
    <div className="mb-5">
      <div className="font-log text-[0.66rem] uppercase tracking-cinema text-gold/70">
        {info.territory.code} · {info.territory.name}
      </div>
      <div className="mt-1 font-display text-[1.05rem] leading-tight text-offwhite">{info.tag}</div>
    </div>
  )

  const rulesBlock = <Rules detail={detail} rulebook={info.rulebook} eventName={info.name} />

  /* ---------- entries not open ---------- */

  if (!info.open) {
    return (
      <div>
        {header}
        <div className="glass flex flex-col items-center gap-3 rounded-xl px-6 py-10 text-center">
          <Hourglass size={22} className="text-gold/60" />
          <p className="font-display text-2xl text-offwhite">Coming Soon</p>
          <p className="max-w-sm text-[0.86rem] leading-relaxed text-parchment/65">
            Entries for {info.name} aren't open yet. The crew is still finalising the details; the
            form lands here well before the fest.
          </p>
        </div>
        {rulesBlock}
      </div>
    )
  }

  /* ---------- entry happens on the crew's own form ---------- */

  if (info.externalForm) {
    return (
      <div>
        {header}
        <div className="rounded-xl border border-gold/25 bg-ocean/40 p-5">
          <div className="font-display text-[1.05rem] text-offwhite">
            {info.formTitle ?? `${info.territory.code} takes entries on its own form`}
          </div>
          <p className="mt-1.5 text-[0.86rem] leading-relaxed text-parchment/70">
            {info.formNote ??
              'The crew runs this one from their own form. It opens in a new tab, and it takes a minute.'}
          </p>
          <a
            href={info.externalForm}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep py-3.5 font-log text-[0.72rem] uppercase tracking-wide2 text-abyss transition-transform hover:scale-[1.01]"
          >
            <ExternalLink size={15} /> Open the {info.name} form
          </a>
        </div>
        {rulesBlock}
      </div>
    )
  }

  /* ---------- already in ---------- */

  // An event that runs several brackets is entered per bracket, so "already
  // entered" means every bracket is held. Without this the last one leaves a
  // form where every band is greyed out and the button never enables.
  const allBandsHeld =
    !!fee && fee.variants.length > 1 && fee.variants.every((v) => info.enteredVariants.includes(v.id))

  if (done || info.entered || allBandsHeld) {
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
        {rulesBlock}
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
        {rulesBlock}
      </div>
    )
  }

  /* ---------- the form ---------- */

  const min = info.form.teamSize?.min ?? 2
  const max = info.form.teamSize?.max ?? 99
  /** Rows besides the person filling this in. */
  const maxRows = max - 1

  const sizeOff = asTeam && info.form.teamSize && (headCount < min || headCount > max)

  return (
    <div>
      {header}

      {fee ? (
        <FeeCard
          fee={fee}
          picked={variant}
          onPick={setVariant}
          error={errors.feeVariant}
          entered={info.enteredVariants}
          headCount={headCount}
          totalPaise={totalPaise}
        />
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
                  onClick={() => {
                    setAsTeam(o.team)
                    if (o.team && members.length === 0) setMembers(blankRows(Math.max(1, min - 1)))
                  }}
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

            {/* The crew. One person registers for everyone: no invites, no
                tokens, nobody else waiting on a link. */}
            <Field
              label="Your crew"
              required
              error={errors.members}
              hint={`You are counted automatically. This event needs ${min}–${max} people in total.`}
            >
              <div className="space-y-2">
                {members.map((m, i) => (
                  <div key={i} className="flex gap-2">
                    <div className="flex-1">
                      <TextInput
                        value={m.name}
                        onChange={(v) => setMember(i, { name: v })}
                        placeholder={`Team-mate ${i + 1} · full name`}
                        invalid={!!errors.members && m.name.trim().length < 2}
                      />
                    </div>
                    <div className="w-24 shrink-0 sm:w-32">
                      <TextInput
                        value={m.phone}
                        onChange={(v) => setMember(i, { phone: v })}
                        placeholder="Mobile"
                        inputMode="numeric"
                      />
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove team-mate ${i + 1}`}
                      onClick={() => setMembers((prev) => prev.filter((_, j) => j !== i))}
                      className="flex w-10 shrink-0 items-center justify-center rounded-lg text-parchment/45 ring-1 ring-inset ring-gold/20 transition-colors hover:text-coral hover:ring-coral/50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}

                <div className="flex items-center justify-between gap-3 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setMembers((prev) => [...prev, { name: '', phone: '' }])}
                    disabled={members.length >= maxRows}
                    className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 font-log text-[0.62rem] uppercase tracking-wide2 text-gold-bright ring-1 ring-inset ring-gold/40 transition-colors hover:bg-gold/10 disabled:opacity-40"
                  >
                    <Plus size={12} /> Add a team-mate
                  </button>
                  <span
                    className={`font-log text-[0.62rem] uppercase tracking-wide2 ${
                      sizeOff ? 'text-coral' : 'text-parchment/50'
                    }`}
                  >
                    {headCount} of {min}–{max}
                  </span>
                </div>
              </div>
            </Field>

            <div className="flex gap-3 rounded-lg border border-gold/25 bg-ocean/40 p-4">
              <Users size={17} className="mt-0.5 shrink-0 text-gold-bright" />
              <p className="text-[0.82rem] leading-relaxed text-parchment/75">
                You are registering the whole crew: only one of you needs to do this, and there is
                nothing for the others to accept.{' '}
                <span className="text-parchment/50">
                  Everyone still needs their own ₹500 Basic Registration to be on campus.
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
        disabled={busy || (!!fee && !variant) || !!sizeOff}
        className="mt-7 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep py-3.5 font-log text-[0.72rem] uppercase tracking-wide2 text-abyss transition-transform hover:scale-[1.01] disabled:opacity-60"
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Ticket size={15} />}
        {paying ?? (busy ? 'Saving…' : fee ? `Pay ${rupees(totalPaise)} and enter` : 'Confirm entry')}
      </button>

      {fee && (
        <p className="mt-3 text-center text-[0.72rem] leading-relaxed text-parchment/45">
          {CONVENIENCE_NOTE}
        </p>
      )}

      {rulesBlock}
    </div>
  )
}

type Fee = NonNullable<EventInfo['fee']>

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`

const blankRows = (n: number): TeamMemberInput[] =>
  Array.from({ length: Math.max(0, n) }, () => ({ name: '', phone: '' }))

/** "₹160 per team", or one line per band. */
function feeSummary(fee: Fee): string {
  const say = (v: Fee['variants'][number]) =>
    v.perHead ? `${rupees(v.amountPaise)} per head` : rupees(v.amountPaise)
  if (fee.variants.length === 1) {
    const v = fee.variants[0]
    return v.perHead ? say(v) : `${say(v)} per ${fee.unit === 'person' ? 'person' : 'team'}`
  }
  return fee.variants.map((v) => `${v.label} ${say(v)}`).join(', ')
}

/**
 * What the rulebook says, and where to read the rest of it.
 *
 * Shown in every state, including the ones where the form is out of reach: a
 * visitor who cannot enter yet is exactly the person who wants to know what
 * they'd be preparing for.
 */
function Rules({
  detail,
  rulebook,
  eventName,
}: {
  detail: ReturnType<typeof detailFor>
  rulebook: string | null
  eventName: string
}) {
  if (!detail && !rulebook) return null
  return (
    <div className="mt-6 rounded-xl border border-gold/15 bg-ocean/30 p-4">
      <div className="flex items-center gap-2">
        <BookOpen size={13} className="shrink-0 text-gold/70" />
        <span className="font-log text-[0.6rem] uppercase tracking-wide2 text-gold/75">
          From the rulebook
        </span>
        {detail?.date && (
          <span className="ml-auto rounded-full bg-gold/10 px-2.5 py-0.5 font-log text-[0.58rem] uppercase tracking-wide2 text-gold-bright">
            {detail.date}
          </span>
        )}
      </div>

      {detail && (
        <ul className="mt-3 grid gap-2">
          {detail.rules.map((r) => (
            <li key={r} className="flex gap-2 text-[0.82rem] leading-relaxed text-parchment/70">
              <span aria-hidden className="mt-[0.45em] h-1 w-1 shrink-0 rounded-full bg-gold/60" />
              {r}
            </li>
          ))}
        </ul>
      )}

      {detail?.contacts && detail.contacts.length > 0 && (
        <p className="mt-3 text-[0.78rem] leading-relaxed text-parchment/55">
          Questions?{' '}
          {detail.contacts.map((c, i) => (
            <span key={c.phone}>
              {i > 0 && ' · '}
              <a href={`tel:${c.phone}`} className="text-gold-bright/80 hover:text-gold-bright">
                {c.name} {c.phone}
              </a>
            </span>
          ))}
        </p>
      )}

      {rulebook && (
        <a
          href={asset(`rulebooks/${rulebook}`)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 font-log text-[0.62rem] uppercase tracking-wide2 text-gold-bright ring-1 ring-inset ring-gold/40 transition-colors hover:bg-gold/10"
        >
          <BookOpen size={12} /> Read the full {eventName} rulebook
          <ExternalLink size={11} className="opacity-60" />
        </a>
      )}
    </div>
  )
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
  entered,
  headCount,
  totalPaise,
}: {
  fee: Fee
  picked: string | null
  onPick: (id: string) => void
  error?: string
  /** Bands this person already holds a place in; offering them again is a dead end. */
  entered: string[]
  headCount: number
  totalPaise: number
}) {
  const single = fee.variants.length === 1
  const pickedVariant = fee.variants.find((v) => v.id === picked) ?? null

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
            {fee.variants[0].perHead
              ? 'per head'
              : `per ${fee.unit === 'person' ? 'person' : 'team'}`}
          </span>
        </p>
      ) : (
        <div className="mt-2.5 grid gap-2">
          {fee.variants.map((v) => {
            const on = picked === v.id
            const held = entered.includes(v.id)
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => !held && onPick(v.id)}
                disabled={held}
                aria-pressed={on}
                className={`flex items-center justify-between gap-3 rounded-lg px-3.5 py-2.5 text-left transition-colors ${
                  held
                    ? 'cursor-default opacity-45 ring-1 ring-inset ring-gold/15'
                    : on
                      ? 'bg-gold/20 ring-1 ring-inset ring-gold/70'
                      : 'ring-1 ring-inset ring-gold/25 hover:ring-gold/60'
                }`}
              >
                <span className={`text-[0.86rem] ${on ? 'text-gold-bright' : 'text-parchment/80'}`}>
                  {v.label}
                  {held && <span className="ml-2 text-[0.72rem] text-aqua">Already entered</span>}
                </span>
                <span className={`shrink-0 text-[0.92rem] ${on ? 'text-gold-bright' : 'text-offwhite/85'}`}>
                  {rupees(v.amountPaise)}
                  {v.perHead && <span className="text-[0.72rem] text-parchment/55"> /head</span>}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* A per-head band only becomes a number once the crew is listed, so the
          arithmetic is shown rather than left as a surprise at checkout. */}
      {pickedVariant?.perHead && (
        <div className="mt-2.5 flex items-baseline justify-between gap-3 border-t border-gold/20 pt-2.5">
          <span className="text-[0.78rem] text-parchment/60">
            {rupees(pickedVariant.amountPaise)} × {headCount}{' '}
            {headCount === 1 ? 'person' : 'people'}
          </span>
          <span className="text-[1.02rem] text-gold-bright">{rupees(totalPaise)}</span>
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
