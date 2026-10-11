import { useState } from 'react'
import { Ban, Undo2 } from 'lucide-react'

import { stickerApi, type StickerLookup } from '../api/client'
import { ErrorLine } from './ActivateTab'
import Camera from './Camera'
import { istTime, nightLabel } from './code'
import { Panel, PersonCard, TextEntry } from './ui'

const RESULT_LABEL: Record<string, string> = {
  ok: 'Entered',
  duplicate: 'Refused: already entered',
  not_active: 'Refused: not activated',
  void: 'Refused: cancelled',
  no_festival_pass: 'Refused: no Festival Pass',
  unknown: 'Unknown',
}

/**
 * Whose sticker is this, and where has it been. For the desk when somebody
 * turns up with a card they say is theirs, and for a supervisor called to a
 * red screen at the gate. Only a supervisor sees the buttons: cancel (a lost
 * card, never usable again) and undo (activated by mistake, back to unused so
 * it can go to the right person).
 */
export default function LookupTab({ supervisor }: { supervisor: boolean }) {
  const [found, setFound] = useState<StickerLookup | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scanned, setScanned] = useState('')

  const look = async (scan: string) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      setFound(await stickerApi.lookup(scan))
      setScanned(scan)
    } catch (err) {
      setFound(null)
      setError(err instanceof Error ? err.message : 'Could not look that up.')
    } finally {
      setBusy(false)
    }
  }

  const cancel = async () => {
    if (!found) return
    const reason = prompt(`Why is ${found.sticker.label} being cancelled? (e.g. "pass lost")`)
    if (!reason || reason.trim().length < 3) return
    try {
      await stickerApi.voidOne(scanned, reason.trim())
      await look(scanned)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel it.')
    }
  }

  const undo = async () => {
    if (!found) return
    const who = found.holder?.name ?? found.guest?.name ?? (found.guest ? 'the guest' : 'its holder')
    if (!confirm(`Undo ${found.sticker.label}? It stops working for ${who} and goes back to unused, ready to activate for the right person.`)) return
    try {
      await stickerApi.deactivate(scanned)
      await look(scanned)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not undo it.')
    }
  }

  const s = found?.sticker
  const status =
    s?.status === 'active' ? (found?.guest ? 'Active · guest card' : 'Active') : s?.status === 'void' ? 'Cancelled' : 'Not activated'

  return (
    <div className="space-y-4">
      <Panel>
        <div className="font-log text-[0.66rem] uppercase tracking-wide2 text-parchment/60">Scan any sticker</div>
        <Camera onRead={look} paused={busy} className="mt-3 h-56 rounded-xl" />
        <TextEntry className="mt-3" placeholder="or type the code" button="Look up" busy={busy} onSubmit={look} mono />
      </Panel>

      {error && <ErrorLine text={error} />}

      {s && found && (
        <>
          <Panel tone={s.status === 'void' ? 'bad' : s.status === 'stock' ? 'warn' : undefined}>
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-2xl tracking-widest text-gold-bright">{s.label}</span>
              <span className="text-[0.9rem]">{status}</span>
            </div>
            <div className="mt-2 space-y-0.5 text-[0.82rem] opacity-75">
              <div>Batch {s.batch} · {s.code}</div>
              {s.activatedAt && <div>Activated by {s.activatedBy}</div>}
              {s.voidedAt && <div>Cancelled by {s.voidedBy}: {s.voidReason}</div>}
            </div>
            {supervisor && s.status !== 'void' && (
              <div className="mt-3 flex flex-wrap gap-2">
                {s.status === 'active' && (
                  <button
                    type="button"
                    onClick={undo}
                    className="inline-flex items-center gap-2 rounded-lg border border-gold/40 px-4 py-2 text-[0.9rem] text-gold-bright"
                  >
                    <Undo2 size={16} /> Undo activation
                  </button>
                )}
                <button
                  type="button"
                  onClick={cancel}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-400/50 px-4 py-2 text-[0.9rem] text-red-200"
                >
                  <Ban size={16} /> Cancel this sticker
                </button>
              </div>
            )}
          </Panel>

          {found.holder && <PersonCard person={found.holder} />}
          {found.guest && (
            <Panel>
              <div className="font-log text-[0.66rem] uppercase tracking-wide2 text-parchment/60">Guest card</div>
              <div className="mt-2 text-2xl leading-tight text-offwhite">{found.guest.name ?? 'Unnamed guest'}</div>
              <div className="mt-1 text-[0.9rem] text-parchment/70">
                {[found.guest.note, found.guest.phone].filter(Boolean).join(' · ') || 'No details given'}
              </div>
            </Panel>
          )}

          <Panel>
            <div className="font-log text-[0.66rem] uppercase tracking-wide2 text-parchment/60">At the gates</div>
            {found.scans.length === 0 ? (
              <p className="mt-2 text-[0.9rem] text-parchment/60">Never scanned.</p>
            ) : (
              <ul className="mt-2 divide-y divide-white/5 text-[0.88rem]">
                {found.scans.map((x, i) => (
                  <li key={i} className="flex justify-between gap-3 py-2">
                    {x.admittedOffline && x.result !== 'ok' ? (
                      // The phone had no signal and let them in; only later did
                      // the server see the pass was already used. They are inside.
                      <span className="text-amber-300">Let in offline: pass already used tonight</span>
                    ) : (
                      <span className={x.result === 'ok' ? 'text-green-300' : 'text-red-300'}>
                        {RESULT_LABEL[x.result] ?? x.result}
                        {x.admittedOffline ? ' (offline)' : ''}
                      </span>
                    )}
                    <span className="text-right text-parchment/60">
                      {nightLabel(x.night)}, {istTime(x.at)}
                      {x.gate ? ` · ${x.gate}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </div>
  )
}
