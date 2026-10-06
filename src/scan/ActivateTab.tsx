import { useState } from 'react'
import { AlertCircle, Check, Loader2, QrCode, RotateCcw, ShieldAlert } from 'lucide-react'

import { ApiError, stickerApi, type StickerPerson } from '../api/client'
import Camera from './Camera'
import { signal } from './feedback'
import { Panel, PersonCard, PrimaryButton, TextEntry } from './ui'

/**
 * Activating a sticker at the desk: find the person, then scan the sticker
 * that goes on their card.
 *
 * Finding them is the step that matters. The volunteer reads the name back to
 * the person in front of them before any sticker is scanned, so the quickest
 * way in is the online pass QR on their phone, which names exactly one
 * person and cannot be mistyped. Email, mobile and the PYX26 number are there
 * for whoever has no phone or no signal.
 *
 * Scanning the sticker activates it straight away, with no confirm button:
 * the confirmation was reading the name back. A wrong one is undone by a
 * supervisor, and a queue of hundreds is not slowed by a tap per person.
 */

type Step =
  | { kind: 'find' }
  | { kind: 'person'; person: StickerPerson; replace: boolean }
  | { kind: 'done'; person: StickerPerson; already: boolean; replaced: string | null }

export default function ActivateTab({ supervisor }: { supervisor: boolean }) {
  const [step, setStep] = useState<Step>({ kind: 'find' })
  const [camera, setCamera] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      setStep({ kind: 'person', person, replace: false })
      signal(person.festivalPass && !person.sticker ? 'ok' : 'warn')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not look that up.')
      signal('bad')
    } finally {
      setBusy(false)
    }
  }

  const activate = async (sticker: string) => {
    if (busy || step.kind !== 'person') return
    setBusy(true)
    setError(null)
    try {
      const res = await stickerApi.activate(step.person.registrationId, sticker, step.replace)
      setStep({ kind: 'done', person: res.person, already: res.already, replaced: res.replaced ?? null })
      signal('ok')
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not activate that sticker.')
      signal('bad')
    } finally {
      setBusy(false)
    }
  }

  if (step.kind === 'done') {
    return (
      <Panel>
        <div className="flex flex-col items-center py-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-600">
            <Check size={34} strokeWidth={3} className="text-white" />
          </div>
          <div className="mt-4 font-mono text-3xl tracking-widest text-gold-bright">{step.person.sticker?.label}</div>
          <div className="mt-1 text-xl text-offwhite">{step.person.name}</div>
          <p className="mt-3 max-w-xs text-[0.9rem] text-parchment/70">
            {step.already
              ? 'This sticker was already theirs. Nothing changed.'
              : step.replaced
                ? `Active now. ${step.replaced} is cancelled and will be refused at the gate.`
                : 'Active now. Make sure it is stuck on their festival pass.'}
          </p>
          <PrimaryButton className="mt-6 w-full max-w-xs" onClick={reset} autoFocus>
            Next person
          </PrimaryButton>
        </div>
      </Panel>
    )
  }

  if (step.kind === 'person') {
    const { person } = step
    const canActivate = person.festivalPass && (!person.sticker || step.replace)
    return (
      <div className="space-y-4">
        <PersonCard person={person} />

        {!person.festivalPass && (
          <Panel tone="bad">
            <div className="flex gap-3">
              <ShieldAlert size={20} className="mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold">No Festival Pass</div>
                <p className="mt-1 text-[0.9rem] opacity-90">
                  Star Night stickers are for Festival Pass holders only. They can buy it at the registration desk, then come back.
                </p>
              </div>
            </div>
          </Panel>
        )}

        {person.festivalPass && person.sticker && !step.replace && (
          <Panel tone="warn">
            <div className="font-semibold">Already has {person.sticker.label}</div>
            <p className="mt-1 text-[0.9rem] opacity-90">
              One sticker per person. If their pass is lost, a supervisor can cancel the old sticker and give a new one.
            </p>
            {supervisor && (
              <button
                type="button"
                onClick={() => setStep({ ...step, replace: true })}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-current px-4 py-2 text-[0.9rem]"
              >
                <RotateCcw size={16} /> Replace a lost pass
              </button>
            )}
          </Panel>
        )}

        {canActivate && (
          <Panel>
            <div className="font-log text-[0.66rem] uppercase tracking-wide2 text-parchment/60">
              {step.replace ? `Replacing ${person.sticker?.label}: scan the new sticker` : 'Scan the sticker on their card'}
            </div>
            {camera && <Camera onRead={activate} paused={busy} className="mt-3 h-64 rounded-xl" />}
            <TextEntry
              className="mt-3"
              placeholder="or type the code"
              button="Activate"
              busy={busy}
              onSubmit={activate}
              mono
            />
          </Panel>
        )}

        {error && <ErrorLine text={error} />}

        <button type="button" onClick={reset} className="w-full py-3 text-[0.9rem] text-parchment/60 underline">
          {canActivate ? 'Wrong person? Start again' : 'Next person'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex items-center justify-between">
          <div className="font-log text-[0.66rem] uppercase tracking-wide2 text-parchment/60">
            Who is it? Scan the QR on their phone
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
        <TextEntry
          className="mt-3"
          placeholder="or email, mobile, PYX26-…"
          button="Find"
          busy={busy}
          onSubmit={identify}
        />
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

export function ErrorLine({ text }: { text: string }) {
  return (
    <div className="flex gap-2 rounded-lg bg-red-900/40 px-4 py-3 text-[0.9rem] text-red-200">
      <AlertCircle size={18} className="mt-0.5 shrink-0" /> {text}
    </div>
  )
}
