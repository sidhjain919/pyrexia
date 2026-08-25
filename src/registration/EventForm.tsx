import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Plus,
  Hourglass,
  Search,
  Ticket,
  Trash2,
  UserCheck,
} from 'lucide-react'
import {
  allowsTeam,
  BASIC_AMOUNT,
  EVENT_REGISTRATION_OPEN,
  requiresTeam,
  resolveEvent,
  type ExtraField,
} from '../data/registration'
import { Icon } from '../lib/icons'
import { api } from './api'
import { RegistrationError, type Delegate, type EventEntry, type TeamMember } from './types'
import { Field, Select, TextArea, TextInput } from './fields'

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const phoneRe = /^[6-9]\d{9}$/

const emptyMember = (): TeamMember => ({ name: '', email: '', phone: '', delegateId: '' })

export default function EventForm({
  eventName,
  onNeedDelegate,
}: {
  eventName: string
  /** Called when the visitor has no registration yet and must complete one first. */
  onNeedDelegate: () => void
}) {
  const reduce = useReducedMotion()
  const resolved = useMemo(() => resolveEvent(eventName), [eventName])

  /* gate */
  const [lookup, setLookup] = useState('')
  const [checking, setChecking] = useState(false)
  const [gateError, setGateError] = useState<string | null>(null)
  const [delegate, setDelegate] = useState<Delegate | null>(null)
  const [alreadyIn, setAlreadyIn] = useState(false)

  /* entry */
  const [asTeam, setAsTeam] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [members, setMembers] = useState<TeamMember[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [fatal, setFatal] = useState<string | null>(null)
  const [entry, setEntry] = useState<EventEntry | null>(null)

  const form = resolved?.form
  const teamOnly = form ? requiresTeam(form) : false
  const teamPossible = form ? allowsTeam(form) : false

  // Team-only events start in team mode with the minimum rows already laid out.
  useEffect(() => {
    if (!form) return
    if (teamOnly) {
      setAsTeam(true)
      const extra = Math.max((form.teamSize?.min ?? 2) - 1, 1)
      setMembers(Array.from({ length: extra }, emptyMember))
    }
  }, [form, teamOnly])

  if (!resolved || !form) {
    return (
      <p className="py-8 text-center text-parchment/60">
        That event isn't on the chart. Pick one from the island map.
      </p>
    )
  }

  const { territory } = resolved

  /* ---------- entries not open yet ---------- */

  if (!EVENT_REGISTRATION_OPEN) {
    return (
      <div>
        <div className="mb-6 flex items-center gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
            style={{ background: `${territory.accent}22`, border: `1px solid ${territory.accent}66` }}
          >
            <Icon name={territory.icon} size={20} style={{ color: territory.accent }} />
          </span>
          <div className="min-w-0">
            <div className="font-log text-[0.66rem] uppercase tracking-cinema text-gold/70">
              {territory.code} · {territory.territory}
            </div>
            <div className="truncate font-display text-[1.05rem] leading-tight text-offwhite">
              {resolved.tag}
            </div>
          </div>
        </div>

        <div className="glass flex flex-col items-center gap-3 rounded-xl px-6 py-12 text-center">
          <Hourglass size={22} className="text-gold/60" />
          <p className="font-display text-2xl text-offwhite">Coming Soon</p>
          <p className="max-w-sm text-[0.86rem] leading-relaxed text-parchment/65">
            Entries for {eventName} aren't open yet. The crew is still finalising the rules and
            slots — the form lands here well before the fest.
          </p>
        </div>

        <div className="mt-5 rounded-xl border border-dashed border-gold/30 p-5 text-center">
          <p className="text-[0.86rem] leading-relaxed text-parchment/70">
            Get your Basic Registration (₹{BASIC_AMOUNT}) done now — it's compulsory for everyone,
            and event entries open only to registered voyagers.
          </p>
          <button
            type="button"
            onClick={onNeedDelegate}
            className="mt-3 inline-flex items-center gap-2 rounded-full px-6 py-3 font-log text-[0.68rem] uppercase tracking-wide2 text-gold-bright ring-1 ring-inset ring-gold/55 transition-colors hover:bg-gold/10"
          >
            <Ticket size={14} /> Do my Basic Registration
          </button>
        </div>
      </div>
    )
  }

  /* ---------- gate ---------- */

  const checkPass = async () => {
    const q = lookup.trim()
    if (!q) {
      setGateError('Enter your pass number, email or mobile.')
      return
    }
    setChecking(true)
    setGateError(null)
    try {
      const found = await api.findDelegate(
        q.includes('@')
          ? { email: q }
          : /^\d{10}$/.test(q.replace(/\D/g, ''))
            ? { phone: q }
            : { delegateId: q },
      )
      if (!found) {
        setGateError(
          'No registration matches that. Basic Registration comes first — it is your entry to every event.',
        )
        return
      }
      if (found.status !== 'confirmed') {
        setGateError('That registration exists but the payment never completed. Finish it first.')
        return
      }
      const entries = await api.listEntries(found.delegateId)
      setAlreadyIn(entries.some((e) => e.eventName === eventName))
      setDelegate(found)
    } catch {
      setGateError('Could not check that pass right now. Try again in a moment.')
    } finally {
      setChecking(false)
    }
  }

  /* ---------- entry ---------- */

  const setAnswer = (id: string, v: string) => {
    setAnswers((a) => ({ ...a, [id]: v }))
    setErrors((e) => (e[id] ? { ...e, [id]: '' } : e))
  }

  const setMember = (i: number, k: keyof TeamMember, v: string) => {
    setMembers((m) => m.map((row, j) => (j === i ? { ...row, [k]: v } : row)))
    setErrors((e) => ({ ...e, [`m${i}.${k}`]: '' }))
  }

  const validate = () => {
    const e: Record<string, string> = {}

    for (const f of form.fields) {
      if (f.required && !(answers[f.id] ?? '').trim()) e[f.id] = 'Required.'
    }

    if (asTeam) {
      if (teamName.trim().length < 2) e.teamName = 'Give your crew a name.'
      const size = members.length + 1
      const min = form.teamSize?.min ?? 2
      const max = form.teamSize?.max ?? 99
      if (size < min) e.team = `This event needs at least ${min} people — add ${min - size} more.`
      if (size > max) e.team = `This event allows at most ${max} people.`

      const seen = new Set([delegate?.delegateId.toLowerCase()])
      members.forEach((m, i) => {
        if (m.name.trim().length < 2) e[`m${i}.name`] = 'Name'
        if (!emailRe.test(m.email.trim())) e[`m${i}.email`] = 'Email'
        if (!phoneRe.test(m.phone.replace(/\D/g, ''))) e[`m${i}.phone`] = 'Mobile'
        const id = m.delegateId.trim().toLowerCase()
        if (!id) e[`m${i}.delegateId`] = 'Pass no.'
        else if (seen.has(id)) e[`m${i}.delegateId`] = 'Duplicate'
        else seen.add(id)
      })
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submit = async () => {
    if (!delegate || !validate()) return
    setBusy(true)
    setFatal(null)
    try {
      const saved = await api.registerForEvent({
        eventName,
        territoryCode: territory.code,
        delegateId: delegate.delegateId,
        participation: asTeam ? 'team' : 'solo',
        teamName: asTeam ? teamName.trim() : undefined,
        members: asTeam
          ? members.map((m) => ({ ...m, phone: m.phone.replace(/\D/g, ''), delegateId: m.delegateId.trim() }))
          : [],
        answers,
      })
      setEntry(saved)
    } catch (err) {
      setFatal(
        err instanceof RegistrationError ? err.message : 'Could not save that entry. Please try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  /* ---------- header ---------- */

  const header = (
    <div className="mb-6 flex items-center gap-3">
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
        style={{ background: `${territory.accent}22`, border: `1px solid ${territory.accent}66` }}
      >
        <Icon name={territory.icon} size={20} style={{ color: territory.accent }} />
      </span>
      {/* The modal header already prints the event name — this row carries the
          territory and the sub-title only, so it isn't said twice. */}
      <div className="min-w-0">
        <div className="font-log text-[0.66rem] uppercase tracking-cinema text-gold/70">
          {territory.code} · {territory.territory}
        </div>
        <div className="truncate font-display text-[1.05rem] leading-tight text-offwhite">
          {resolved.tag}
        </div>
      </div>
    </div>
  )

  /* ---------- done ---------- */

  if (entry) {
    return (
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center py-8 text-center"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-b from-gold-bright to-gold-deep">
          <Check size={30} className="text-abyss" />
        </div>
        <h3 className="mt-5 font-display text-2xl text-foil">You're entered for {eventName}.</h3>
        <p className="mt-2 max-w-sm text-[0.9rem] text-parchment/70">
          Entry <span className="text-gold-bright">{entry.entryId}</span>
          {entry.teamName && (
            <>
              {' '}
              · crew <span className="text-gold-bright">{entry.teamName}</span>
            </>
          )}
          . The {territory.code} wardens will reach out with the schedule.
        </p>
      </motion.div>
    )
  }

  /* ---------- gate screen ---------- */

  if (!delegate) {
    return (
      <div>
        {header}
        <div className="rounded-xl border border-gold/25 bg-ocean/40 p-5">
          <div className="flex items-start gap-3">
            <UserCheck size={18} className="mt-0.5 shrink-0 text-gold-bright" />
            <div>
              <div className="font-display text-[0.9rem] text-offwhite">Registered voyagers only</div>
              <p className="mt-1 text-[0.84rem] leading-relaxed text-parchment/70">
                Every event entry is tied to a completed Basic Registration. Enter your registration
                number, or the email or mobile you registered with.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-parchment/40" />
              <input
                value={lookup}
                onChange={(e) => {
                  setLookup(e.target.value)
                  setGateError(null)
                }}
                onKeyDown={(e) => e.key === 'Enter' && checkPass()}
                placeholder="PYX26-XXXXXX, email or mobile"
                className={`w-full rounded-lg border bg-ocean/60 py-2.5 pl-10 pr-3 text-[0.92rem] text-offwhite outline-none placeholder:text-parchment/30 focus:border-gold/70 ${
                  gateError ? 'border-coral/70' : 'border-gold/25'
                }`}
              />
            </div>
            <button
              type="button"
              onClick={checkPass}
              disabled={checking}
              className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-gold-bright to-gold-deep px-6 py-2.5 font-log text-[0.68rem] uppercase tracking-wide2 text-abyss disabled:opacity-60"
            >
              {checking ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
              Check
            </button>
          </div>

          {gateError && (
            <div className="mt-3 flex items-start gap-2 text-[0.82rem] text-coral">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {gateError}
            </div>
          )}
        </div>

        <div className="mt-5 rounded-xl border border-dashed border-gold/30 p-5 text-center">
          <p className="text-[0.86rem] text-parchment/70">Not registered yet?</p>
          <button
            type="button"
            onClick={onNeedDelegate}
            className="mt-3 inline-flex items-center gap-2 rounded-full px-6 py-3 font-log text-[0.68rem] uppercase tracking-wide2 text-gold-bright ring-1 ring-inset ring-gold/55 transition-colors hover:bg-gold/10"
          >
            <Ticket size={14} /> Do your Basic Registration first
          </button>
        </div>
      </div>
    )
  }

  /* ---------- already entered ---------- */

  if (alreadyIn) {
    return (
      <div>
        {header}
        <div className="rounded-xl border border-aqua/40 bg-aqua/10 p-5 text-center">
          <Check size={22} className="mx-auto text-aqua" />
          <p className="mt-2 text-[0.9rem] text-parchment/80">
            {delegate.name.split(' ')[0]}, you're already entered for {eventName}.
          </p>
        </div>
      </div>
    )
  }

  /* ---------- entry form ---------- */

  const min = form.teamSize?.min ?? 2
  const max = form.teamSize?.max ?? 99
  const size = members.length + 1

  return (
    <div>
      {header}

      <div className="mb-5 flex items-center gap-2 rounded-lg border border-aqua/35 bg-aqua/10 px-3.5 py-2.5">
        <Check size={14} className="shrink-0 text-aqua" />
        <span className="text-[0.82rem] text-parchment/80">
          Registration verified — {delegate.name} · {delegate.delegateId}
        </span>
      </div>

      {form.note && <p className="mb-5 text-[0.84rem] leading-relaxed text-parchment/65">{form.note}</p>}

      <div className="space-y-5">
        {/* solo vs team */}
        {teamPossible && !teamOnly && (
          <Field label="Entering as" required>
            <div className="flex gap-2">
              {[
                { id: false, label: 'Solo' },
                { id: true, label: `Team (${min}–${max})` },
              ].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => {
                    setAsTeam(o.id)
                    setMembers(o.id ? Array.from({ length: Math.max(min - 1, 1) }, emptyMember) : [])
                    setErrors({})
                  }}
                  className={`flex-1 rounded-lg px-4 py-2.5 text-[0.84rem] transition-colors ${
                    asTeam === o.id
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

        {/* team block */}
        {asTeam && (
          <div className="space-y-4 rounded-xl border border-gold/20 bg-ocean/30 p-4">
            <Field label="Team name" required error={errors.teamName}>
              <TextInput
                value={teamName}
                onChange={(v) => {
                  setTeamName(v)
                  setErrors((e) => ({ ...e, teamName: '' }))
                }}
                invalid={!!errors.teamName}
                placeholder="What do they call your crew?"
              />
            </Field>

            <div>
              <div className="flex items-baseline justify-between">
                <span className="font-log text-[0.66rem] uppercase tracking-wide2 text-parchment/70">
                  Team-mates
                </span>
                <span className={`text-[0.72rem] ${size < min || size > max ? 'text-coral' : 'text-parchment/45'}`}>
                  {size} of {min}–{max} (you included)
                </span>
              </div>

              <p className="mt-1 text-[0.72rem] text-parchment/45">
                Every team-mate needs their own Basic Registration — enter their number.
              </p>

              <div className="mt-3 space-y-3">
                {members.map((m, i) => (
                  <div key={i} className="rounded-lg border border-gold/15 bg-ocean/40 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-log text-[0.62rem] uppercase tracking-wide2 text-gold/70">
                        Member {i + 2}
                      </span>
                      {members.length > Math.max(min - 1, 1) && (
                        <button
                          type="button"
                          onClick={() => setMembers((ms) => ms.filter((_, j) => j !== i))}
                          aria-label={`Remove member ${i + 2}`}
                          className="text-parchment/45 transition-colors hover:text-coral"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <TextInput
                        value={m.name}
                        onChange={(v) => setMember(i, 'name', v)}
                        invalid={!!errors[`m${i}.name`]}
                        placeholder="Full name"
                      />
                      <TextInput
                        value={m.delegateId}
                        onChange={(v) => setMember(i, 'delegateId', v)}
                        invalid={!!errors[`m${i}.delegateId`]}
                        placeholder="Pass no. PYX26-…"
                      />
                      <TextInput
                        value={m.email}
                        onChange={(v) => setMember(i, 'email', v)}
                        invalid={!!errors[`m${i}.email`]}
                        type="email"
                        placeholder="Email"
                      />
                      <TextInput
                        value={m.phone}
                        onChange={(v) => setMember(i, 'phone', v)}
                        invalid={!!errors[`m${i}.phone`]}
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        placeholder="Mobile"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {size < max && (
                <button
                  type="button"
                  onClick={() => setMembers((ms) => [...ms, emptyMember()])}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-gold/35 py-2.5 font-log text-[0.64rem] uppercase tracking-wide2 text-parchment/65 transition-colors hover:border-gold/70 hover:text-gold-bright"
                >
                  <Plus size={13} /> Add team-mate
                </button>
              )}

              {errors.team && (
                <div className="mt-2 flex items-center gap-1.5 text-[0.78rem] text-coral">
                  <AlertCircle size={13} /> {errors.team}
                </div>
              )}
            </div>
          </div>
        )}

        {/* event-specific questions */}
        {form.fields.map((f) => (
          <ExtraFieldInput key={f.id} field={f} value={answers[f.id] ?? ''} error={errors[f.id]} onChange={setAnswer} />
        ))}

        {fatal && (
          <div className="flex items-start gap-2 rounded-lg border border-coral/50 bg-coral/10 p-3 text-[0.82rem] text-coral">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            {fatal}
          </div>
        )}
      </div>

      <div className="mt-7 flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setDelegate(null)
            setErrors({})
            setFatal(null)
          }}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-full px-5 py-3 font-log text-[0.68rem] uppercase tracking-wide2 text-parchment/70 ring-1 ring-inset ring-gold/40 transition-colors hover:text-gold-bright hover:ring-gold/80 disabled:opacity-40"
        >
          <ArrowLeft size={13} /> Not you?
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep py-3.5 font-log text-[0.72rem] uppercase tracking-wide2 text-abyss transition-transform hover:scale-[1.01] disabled:opacity-60"
        >
          {busy ? (
            <>
              <Loader2 size={15} className="animate-spin" /> Saving…
            </>
          ) : (
            <>
              <Ticket size={15} /> Confirm entry
            </>
          )}
        </button>
      </div>
    </div>
  )
}

function ExtraFieldInput({
  field,
  value,
  error,
  onChange,
}: {
  field: ExtraField
  value: string
  error?: string
  onChange: (id: string, v: string) => void
}) {
  const set = (v: string) => onChange(field.id, v)
  return (
    <Field label={field.label} required={field.required} error={error} hint={field.help}>
      {field.type === 'textarea' ? (
        <TextArea value={value} onChange={set} invalid={!!error} placeholder={field.placeholder} />
      ) : field.type === 'select' ? (
        <Select value={value} onChange={set} invalid={!!error} options={field.options ?? []} />
      ) : (
        <TextInput
          value={value}
          onChange={set}
          invalid={!!error}
          placeholder={field.placeholder}
          type={field.type === 'number' ? 'number' : field.type === 'url' ? 'url' : 'text'}
          inputMode={field.type === 'number' ? 'numeric' : undefined}
        />
      )}
    </Field>
  )
}
