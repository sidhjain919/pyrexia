import { useCallback, useEffect, useState } from 'react'
import { Check, Loader2, QrCode, ShieldAlert, Ticket } from 'lucide-react'

import { ApiError, stickerApi, type ArrivalCounts, type StickerPerson } from '../api/client'
import { ErrorLine } from './ActivateTab'
import Camera from './Camera'
import { signal } from './feedback'
import { Panel, PersonCard, PrimaryButton, TextEntry } from './ui'

/**
 * The entry desk: a registered delegate shows the pass QR from their email,
 * the volunteer reads the name back, and marks them as arrived.
 *
 * One tap to confirm, not zero: unlike a sticker, which only works for the
 * person whose card it is stuck on, a pass QR is a picture anybody can be
 * forwarded. Reading the name back, and glancing at their college ID, is the
 * check; the tap is the volunteer saying they did it.
 *
 * Somebody already checked in is shown when and by whom. That is the answer
 * to "is this pass being used twice?", and why it is a warning, not an error.
 *
 * A Festival Pass holder without a Star Night card can be given one right
 * here, so a single desk can do both jobs.
 */

type Step =
  | { kind: 'find' }
  | { kind: 'person'; person: StickerPerson }
  | { kind: 'in'; person: StickerPerson; already: boolean }

export default function CheckInTab() {
  const [step, setStep] = useState<Step>({ kind: 'find' })
  const [camera, setCamera] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [counts, setCounts] = useState<ArrivalCounts | null>(null)

  const refreshCounts = useCallback(() => {
    stickerApi.arrivals().then(setCounts).catch(() => {})
  }, [])

  useEffect(refreshCounts, [refreshCounts])

  const reset = () => {
    setStep({ kind: 'find' })
    setError(null)
  }

  const identify = async (query: string) => {
    if (busy || !query.trim()) return
    setBusy(true)
    setError(null)
    try {
      const { person } = await stickerApi.identify(query)
      if (person.arrival) {
        setStep({ kind: 'in', person, already: true })
        signal('warn')
      } else {
        setStep({ kind: 'person', person })
        signal(person.registered ? 'ok' : 'bad')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not look that up.')
      signal('bad')
    } finally {
      setBusy(false)
    }
  }

  const checkIn = async () => {
    if (busy || step.kind !== 'person') return
    setBusy(true)
    setError(null)
    try {
      const res = await stickerApi.checkin(step.person.registrationId)
      setStep({ kind: 'in', person: res.person, already: res.already })
      setCounts(res.arrivals)
      signal(res.already ? 'warn' : 'ok')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check them in.')
      signal('bad')
    } finally {
      setBusy(false)
    }
  }

  const giveCard = async (sticker: string) => {
    if (busy || step.kind !== 'in') return
    setBusy(true)
    setError(null)
    try {
      const res = await stickerApi.activate(step.person.registrationId, sticker)
      setStep({ ...step, person: res.person })
      signal('ok')
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not activate that card.')
      signal('bad')
    } finally {
      setBusy(false)
    }
  }

  const tally = counts && (
    <div className="flex justify-between text-[0.8rem] text-parchment/55">
      <span>
        {counts.today.toLocaleString('en-IN')} arrived today · {counts.total.toLocaleString('en-IN')} in all
      </span>
      {counts.guests > 0 && <span>{counts.guests} guest cards</span>}
    </div>
  )

  if (step.kind === 'in') {
    const { person, already } = step
    const needsCard = person.festivalPass && !person.sticker
    return (
      <div className="space-y-4">
        {tally}
        {already ? (
          <Panel tone="warn">
            <div className="text-xl font-semibold">Already checked in</div>
            <p className="mt-1 text-[0.95rem] opacity-90">
              {person.name} came in {person.arrival ? when(person.arrival.at) : 'earlier'}
              {person.arrival?.by ? `, checked in by ${person.arrival.by}` : ''}.
            </p>
            <p className="mt-2 text-[0.85rem] opacity-80">
              If the person in front of you is not {person.name}, this pass is being shared. Ask for their college ID and
              call a supervisor.
            </p>
          </Panel>
        ) : (
          <Panel>
            <div className="flex flex-col items-center py-2 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-600">
                <Check size={34} strokeWidth={3} className="text-white" />
              </div>
              <div className="mt-3 text-2xl text-offwhite">{person.name}</div>
              <div className="mt-1 text-[0.95rem] text-green-300">Entered</div>
            </div>
          </Panel>
        )}

        <PersonCard person={person} />

        {needsCard && (
          <Panel>
            <div className="flex items-center gap-2 font-log text-[0.66rem] uppercase tracking-wide2 text-parchment/60">
              <Ticket size={14} /> Festival Pass: scan their Star Night card to activate it
            </div>
            <Camera onRead={giveCard} paused={busy} className="mt-3 h-56 rounded-xl" />
            <TextEntry className="mt-3" placeholder="or type the code" button="Activate" busy={busy} onSubmit={giveCard} mono />
            <p className="mt-2 text-[0.8rem] text-parchment/50">No card at this desk? Skip it; the sticker desk can do it later.</p>
          </Panel>
        )}
        {person.sticker && (
          <p className="text-center text-[0.9rem] text-parchment/70">
            Star Night card: <span className="font-mono text-gold-bright">{person.sticker.label}</span>
          </p>
        )}

        {error && <ErrorLine text={error} />}

        <PrimaryButton className="w-full" onClick={reset} autoFocus={!needsCard}>
          Next person
        </PrimaryButton>
      </div>
    )
  }

  if (step.kind === 'person') {
    const { person } = step
    return (
      <div className="space-y-4">
        {tally}
        <PersonCard person={person} />

        {person.registered ? (
          <>
            <p className="text-center text-[0.9rem] text-parchment/65">
              Read the name back. If in doubt, check their college ID.
            </p>
            <PrimaryButton className="w-full py-5 text-lg" onClick={checkIn} disabled={busy} autoFocus>
              {busy ? <Loader2 size={20} className="mx-auto animate-spin" /> : 'Mark entered'}
            </PrimaryButton>
          </>
        ) : (
          <Panel tone="bad">
            <div className="flex gap-3">
              <ShieldAlert size={20} className="mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold">Not paid</div>
                <p className="mt-1 text-[0.9rem] opacity-90">
                  This account never paid for registration. Send them to the registration counter.
                </p>
              </div>
            </div>
          </Panel>
        )}

        {error && <ErrorLine text={error} />}

        <button type="button" onClick={reset} className="w-full py-3 text-[0.9rem] text-parchment/60 underline">
          Wrong person? Start again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {tally}
      <Panel>
        <div className="flex items-center justify-between">
          <div className="font-log text-[0.66rem] uppercase tracking-wide2 text-parchment/60">
            Scan the pass QR from their email
          </div>
          <button
            type="button"
            onClick={() => setCamera((c) => !c)}
            className="flex items-center gap-1.5 text-[0.8rem] text-parchment/60"
          >
            <QrCode size={14} /> {camera ? 'Hide camera' : 'Camera'}
          </button>
        </div>
        {camera && <Camera onRead={identify} paused={busy} className="mt-3 h-64 rounded-xl" />}
        <TextEntry className="mt-3" placeholder="or email, mobile, PYX26-…" button="Find" busy={busy} onSubmit={identify} />
      </Panel>
      {busy && (
        <div className="flex items-center gap-2 text-parchment/60">
          <Loader2 size={16} className="animate-spin" /> Looking…
        </div>
      )}
      {error && <ErrorLine text={error} />}
    </div>
  )
}

/** "today at 10:42 am" or "Mon 12 Oct, 10:42 am", from D1's UTC timestamp, in IST. */
function when(sqlUtc: string): string {
  const d = new Date(sqlUtc.includes('T') ? sqlUtc : `${sqlUtc.replace(' ', 'T')}Z`)
  if (!Number.isFinite(d.getTime())) return sqlUtc
  const day = (x: Date) => x.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })
  if (day(d) === day(new Date())) return `today at ${time}`
  const date = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })
  return `${date}, ${time}`
}
