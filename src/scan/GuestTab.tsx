import { useState } from 'react'
import { Check, UserPlus } from 'lucide-react'

import { stickerApi } from '../api/client'
import { ErrorLine } from './ActivateTab'
import Camera from './Camera'
import { signal } from './feedback'
import { Panel, PrimaryButton, TextEntry } from './ui'

/**
 * Guest cards: a printed card for somebody who never registered, usually the
 * committee's friends and family, activated on the spot. Supervisors only;
 * the server refuses anyone else.
 *
 * The details come first and the scan second, because scanning activates:
 * whatever is typed here is what the guard sees, so it has to be there before
 * the card goes live. All of it is optional; an unnamed card shows "Guest".
 */
export default function GuestTab() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ label: string; name: string | null; already: boolean } | null>(null)

  const activate = async (sticker: string) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      setDone(await stickerApi.guest(sticker, name.trim(), phone.trim(), note.trim()))
      signal('ok')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not activate that card.')
      signal('bad')
    } finally {
      setBusy(false)
    }
  }

  const next = () => {
    setDone(null)
    setName('')
    setPhone('')
    setNote('')
    setError(null)
  }

  if (done) {
    return (
      <Panel>
        <div className="flex flex-col items-center py-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-600">
            <Check size={34} strokeWidth={3} className="text-white" />
          </div>
          <div className="mt-4 font-mono text-3xl tracking-widest text-gold-bright">{done.label}</div>
          <div className="mt-1 text-xl text-offwhite">{done.name ?? 'Guest'}</div>
          <p className="mt-3 max-w-xs text-[0.9rem] text-parchment/70">
            {done.already
              ? 'This card was already theirs. Nothing changed.'
              : 'Guest card active. It gets them into each Star Night once, and they are on the Arrivals sheet.'}
          </p>
          <PrimaryButton className="mt-6 w-full max-w-xs" onClick={next} autoFocus>
            Next guest
          </PrimaryButton>
        </div>
      </Panel>
    )
  }

  const field =
    'w-full rounded-lg border border-gold/25 bg-abyss px-3 py-3 text-offwhite outline-none placeholder:text-parchment/35 focus:border-gold'

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex items-center gap-2 font-log text-[0.66rem] uppercase tracking-wide2 text-parchment/60">
          <UserPlus size={14} /> 1. Who is the guest (all optional)
        </div>
        <div className="mt-3 space-y-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional; the guard sees it)" className={field} maxLength={80} />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Mobile (optional)"
            inputMode="tel"
            className={field}
            maxLength={15}
          />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Whose guest? (optional)" className={field} maxLength={120} />
        </div>
      </Panel>

      <Panel>
        <div className="font-log text-[0.66rem] uppercase tracking-wide2 text-parchment/60">2. Scan the card to activate it</div>
        <Camera onRead={activate} paused={busy} className="mt-3 h-56 rounded-xl" />
        <TextEntry className="mt-3" placeholder="or type the code" button="Activate" busy={busy} onSubmit={activate} mono />
        {!name.trim() && (
          <p className="mt-2 text-[0.8rem] text-parchment/50">No name: the guard will see “Guest” and the card number.</p>
        )}
      </Panel>

      {error && <ErrorLine text={error} />}

      <p className="text-[0.8rem] text-parchment/50">
        Only supervisors can do this. Every guest card is logged with your name. Wrong name or wrong card? Undo it from
        Look up.
      </p>
    </div>
  )
}
