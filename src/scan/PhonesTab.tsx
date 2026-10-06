import { useCallback, useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Check, Loader2, Smartphone, Trash2 } from 'lucide-react'

import { stickerApi, type StickerDevice } from '../api/client'
import { ErrorLine } from './ActivateTab'
import { Panel, PrimaryButton, ago } from './ui'

/**
 * Pairing the guards' phones and the desk's devices, and unpairing them.
 *
 * The new phone opens the pairing QR with its ordinary camera app, which
 * takes it to /scan already signed in for its gate. Nobody on it needs an
 * account. A lost phone is unpaired here and is useless from that moment.
 */
export default function PhonesTab() {
  const [devices, setDevices] = useState<StickerDevice[]>([])
  const [gates, setGates] = useState<string[]>([])
  const [kind, setKind] = useState<'gate' | 'desk'>('gate')
  const [name, setName] = useState('')
  const [gate, setGate] = useState('')
  const [pairing, setPairing] = useState<{ id: string; code: string; qr: string; until: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState({ from: '', to: '', reason: '' })
  const [rangeDone, setRangeDone] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await stickerApi.devices()
      setDevices(res.devices)
      setGates(res.gates)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the phones.')
    }
  }, [])

  useEffect(() => {
    void load()
    // While a code is on screen, watch for the phone that uses it.
    const t = setInterval(load, pairing ? 4000 : 30000)
    return () => clearInterval(t)
  }, [load, pairing])

  const paired = pairing ? devices.find((d) => d.id === pairing.id)?.paired : false

  const create = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await stickerApi.addDevice(name.trim(), kind === 'gate' ? gate.trim() : null)
      const qr = await QRCode.toDataURL(res.url, { errorCorrectionLevel: 'M', margin: 2, width: 480 })
      setPairing({ id: res.id, code: res.code, qr, until: Date.now() + res.expiresInMinutes * 60_000 })
      setName('')
      void load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not make a pairing code.')
    } finally {
      setBusy(false)
    }
  }

  const revoke = async (d: StickerDevice) => {
    if (!confirm(`Unpair ${d.name}${d.gate ? ` (${d.gate})` : ''}? It stops working immediately.`)) return
    await stickerApi.revokeDevice(d.id)
    void load()
  }

  const voidRange = async () => {
    const from = Number(range.from)
    const to = Number(range.to)
    if (!confirm(`Cancel every unused sticker from No. ${from} to No. ${to}? Activated ones are left alone.`)) return
    try {
      const res = await stickerApi.voidRange(from, to, range.reason.trim())
      setRangeDone(`${res.voided} unused stickers cancelled.`)
      setRange({ from: '', to: '', reason: '' })
    } catch (err) {
      setRangeDone(err instanceof Error ? err.message : 'Could not cancel them.')
    }
  }

  const input = 'w-full rounded-lg border border-gold/25 bg-abyss px-3 py-3 text-offwhite outline-none focus:border-gold'
  const ready = name.trim().length >= 2 && (kind === 'desk' || gate.trim().length > 0)

  return (
    <div className="space-y-4">
      {pairing ? (
        <Panel>
          {paired ? (
            <div className="flex flex-col items-center py-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-600">
                <Check size={30} className="text-white" />
              </div>
              <div className="mt-3 text-lg text-offwhite">Paired</div>
              <PrimaryButton className="mt-5" onClick={() => setPairing(null)}>Pair another</PrimaryButton>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center">
              <p className="text-[0.9rem] text-parchment/75">
                On the new phone, open the camera and point it at this. It opens the scanner ready to use.
              </p>
              <img src={pairing.qr} alt="Pairing QR" className="mt-4 w-64 rounded-lg bg-white" />
              <div className="mt-3 font-mono text-2xl tracking-[0.3em] text-gold-bright">{pairing.code}</div>
              <p className="mt-1 text-[0.8rem] text-parchment/50">
                Or open pyrexiaaiims.com/scan and type the code. Works once, for 15 minutes.
              </p>
              <div className="mt-3 flex items-center gap-2 text-[0.85rem] text-parchment/60">
                <Loader2 size={14} className="animate-spin" /> Waiting for the phone…
              </div>
              <button type="button" onClick={() => setPairing(null)} className="mt-4 text-[0.85rem] text-parchment/50 underline">
                Cancel
              </button>
            </div>
          )}
        </Panel>
      ) : (
        <Panel>
          <div className="font-log text-[0.66rem] uppercase tracking-wide2 text-parchment/60">Pair a phone</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(['gate', 'desk'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`rounded-lg px-3 py-3 text-[0.9rem] ring-1 ring-inset ${
                  kind === k ? 'bg-gold/15 text-gold-bright ring-gold/70' : 'text-parchment/70 ring-gold/25'
                }`}
              >
                {k === 'gate' ? 'Gate phone (guard)' : 'Activation desk'}
              </button>
            ))}
          </div>
          <div className="mt-3 space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={kind === 'gate' ? "Guard's name" : 'Which desk, e.g. Counter 2'}
              className={input}
            />
            {kind === 'gate' && (
              <>
                <input
                  value={gate}
                  onChange={(e) => setGate(e.target.value)}
                  placeholder="Gate, e.g. Main Gate"
                  list="known-gates"
                  className={input}
                />
                <datalist id="known-gates">
                  {gates.map((g) => <option key={g} value={g} />)}
                </datalist>
              </>
            )}
            <PrimaryButton className="w-full" disabled={!ready || busy} onClick={create}>
              {busy ? 'Making a code…' : 'Show pairing code'}
            </PrimaryButton>
          </div>
        </Panel>
      )}

      {error && <ErrorLine text={error} />}

      <Panel>
        <div className="font-log text-[0.66rem] uppercase tracking-wide2 text-parchment/60">Paired phones</div>
        {devices.filter((d) => d.paired).length === 0 ? (
          <p className="mt-2 text-[0.9rem] text-parchment/60">None yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-white/5">
            {devices.filter((d) => d.paired).map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-2.5">
                <Smartphone size={18} className="shrink-0 text-parchment/50" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-offwhite">{d.name}</div>
                  <div className="text-[0.78rem] text-parchment/55">
                    {d.kind === 'gate' ? d.gate : 'Activation desk'} · seen {ago(d.lastSeenAt)}
                    {d.kind === 'gate' ? ` · ${d.admittedTonight} in tonight` : ''}
                  </div>
                </div>
                <button type="button" onClick={() => revoke(d)} aria-label={`Unpair ${d.name}`} className="p-2 text-red-300/80">
                  <Trash2 size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <div className="font-log text-[0.66rem] uppercase tracking-wide2 text-parchment/60">A lost sheet of stickers</div>
        <p className="mt-2 text-[0.85rem] text-parchment/60">
          Cancels every unused sticker in the run. Stickers already activated for somebody are left alone.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <input value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} inputMode="numeric" placeholder="From No." className={input} />
          <input value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} inputMode="numeric" placeholder="To No." className={input} />
        </div>
        <input value={range.reason} onChange={(e) => setRange({ ...range, reason: e.target.value })} placeholder="Why, e.g. sheet 12 lost" className={`${input} mt-2`} />
        <button
          type="button"
          disabled={!range.from || !range.to || range.reason.trim().length < 3}
          onClick={voidRange}
          className="mt-3 w-full rounded-lg border border-red-400/50 py-3 text-red-200 disabled:opacity-40"
        >
          Cancel this run
        </button>
        {rangeDone && <p className="mt-2 text-[0.85rem] text-parchment/70">{rangeDone}</p>}
      </Panel>
    </div>
  )
}
