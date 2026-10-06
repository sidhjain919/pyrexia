import { useCallback, useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Check, Copy, Loader2, RotateCw, Share2, Smartphone, Trash2 } from 'lucide-react'

import { stickerApi, type StickerDevice } from '../api/client'
import { ErrorLine } from './ActivateTab'
import { Panel, PrimaryButton, ago } from './ui'

/**
 * Pairing the guards' phones and the desk's devices, and unpairing them.
 *
 * The new phone opens the pairing QR with its ordinary camera app, which
 * takes it to /scan already signed in for its gate. Nobody on it needs an
 * account. A lost phone is unpaired here and is useless from that moment.
 *
 * A phone that loses its pairing (browser data cleared, the scanner opened in
 * another browser, a swapped phone) is re-paired from its row: a fresh link
 * the supervisor sends on WhatsApp, so the guard never has to leave the gate
 * to come and find them. Same guard, same gate, same count for tonight.
 */

type Pairing = {
  id: string
  /** Who the code is for, for the heading and the WhatsApp message. */
  who: string
  gate: string | null
  repair: boolean
  code: string
  url: string
  qr: string
}

export default function PhonesTab() {
  const [devices, setDevices] = useState<StickerDevice[]>([])
  const [gates, setGates] = useState<string[]>([])
  const [kind, setKind] = useState<'gate' | 'desk'>('gate')
  const [name, setName] = useState('')
  const [gate, setGate] = useState('')
  const [pairing, setPairing] = useState<Pairing | null>(null)
  const [copied, setCopied] = useState(false)
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

  const show = async (
    res: { id: string; code: string; url: string },
    who: string,
    gateName: string | null,
    repair: boolean,
  ) => {
    const qr = await QRCode.toDataURL(res.url, { errorCorrectionLevel: 'M', margin: 2, width: 480 })
    // Fresh list first: the row must read "not paired" before the panel starts
    // watching it, or a re-paired phone would show as done at once.
    await load()
    setCopied(false)
    setPairing({ id: res.id, code: res.code, url: res.url, who, gate: gateName, repair, qr })
  }

  const create = async () => {
    setBusy(true)
    setError(null)
    try {
      const gateName = kind === 'gate' ? gate.trim() : null
      const res = await stickerApi.addDevice(name.trim(), gateName)
      await show(res, name.trim(), gateName, false)
      setName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not make a pairing code.')
    } finally {
      setBusy(false)
    }
  }

  const repair = async (d: StickerDevice) => {
    const sure = confirm(
      `Make a new link for ${d.name}? Whatever phone ${d.name} is paired on now stops working, ` +
        'and the phone that opens the link takes its place.',
    )
    if (!sure) return
    setError(null)
    try {
      await show(await stickerApi.repairDevice(d.id), d.name, d.gate, true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not make a new link.')
    }
  }

  const message = (p: Pairing) =>
    `PYREXIA Star Night scanner for ${p.who}${p.gate ? ` (${p.gate})` : ''}. Open this on your phone in Chrome: ${p.url}`

  const share = async (p: Pairing) => {
    try {
      await navigator.share({ title: 'PYREXIA scanner', text: message(p) })
    } catch {
      /* the share sheet was closed */
    }
  }

  const copy = async (p: Pairing) => {
    try {
      await navigator.clipboard.writeText(message(p))
      setCopied(true)
    } catch {
      prompt('Copy this and send it:', message(p))
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
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator

  return (
    <div className="space-y-4">
      {pairing ? (
        <Panel>
          {paired ? (
            <div className="flex flex-col items-center py-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-600">
                <Check size={30} className="text-white" />
              </div>
              <div className="mt-3 text-lg text-offwhite">
                {pairing.who} is {pairing.repair ? 'back on' : 'paired to'} {pairing.gate ?? 'the activation desk'}
              </div>
              <PrimaryButton className="mt-5" onClick={() => setPairing(null)}>Done</PrimaryButton>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center">
              <div className="text-lg text-offwhite">
                {pairing.repair ? 'Re-pair' : 'Pair'} {pairing.who}
              </div>
              <p className="mt-1 text-[0.9rem] text-parchment/75">
                {pairing.repair
                  ? 'Send them this link on WhatsApp. When they tap it, their phone is back on the gate.'
                  : 'Point the new phone’s camera at the QR, or send it the link.'}
              </p>
              <div className="mt-4 grid w-full grid-cols-2 gap-2">
                {canShare && (
                  <button
                    type="button"
                    onClick={() => share(pairing)}
                    className="flex items-center justify-center gap-2 rounded-lg bg-gold/20 py-3 text-gold-bright ring-1 ring-inset ring-gold/50"
                  >
                    <Share2 size={16} /> Share
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => copy(pairing)}
                  className={`flex items-center justify-center gap-2 rounded-lg py-3 text-parchment/85 ring-1 ring-inset ring-gold/30 ${
                    canShare ? '' : 'col-span-2'
                  }`}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copied' : 'Copy link'}
                </button>
              </div>
              <img src={pairing.qr} alt="Pairing QR" className="mt-4 w-56 rounded-lg bg-white" />
              <div className="mt-3 font-mono text-2xl tracking-[0.3em] text-gold-bright">{pairing.code}</div>
              <p className="mt-1 text-[0.8rem] text-parchment/50">
                Or open pyrexiaaiims.com/scan and type the code. Works once, for 15 minutes.
              </p>
              <div className="mt-3 flex items-center gap-2 text-[0.85rem] text-parchment/60">
                <Loader2 size={14} className="animate-spin" /> Waiting for the phone…
              </div>
              <button type="button" onClick={() => setPairing(null)} className="mt-4 text-[0.85rem] text-parchment/50 underline">
                Close
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
        <div className="font-log text-[0.66rem] uppercase tracking-wide2 text-parchment/60">Phones</div>
        {devices.length === 0 ? (
          <p className="mt-2 text-[0.9rem] text-parchment/60">None yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-white/5">
            {devices.map((d) => (
              <li key={d.id} className="flex items-center gap-2 py-2.5">
                <Smartphone size={18} className={`shrink-0 ${d.paired ? 'text-parchment/50' : 'text-amber-300/80'}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-offwhite">{d.name}</div>
                  <div className="text-[0.78rem] text-parchment/55">
                    {d.kind === 'gate' ? d.gate : 'Activation desk'}
                    {d.paired && ` · seen ${ago(d.lastSeenAt)}`}
                    {d.kind === 'gate' ? ` · ${d.admittedTonight} in tonight` : ''}
                  </div>
                  {!d.paired && (
                    <div className="text-[0.78rem] text-amber-200/80">
                      {d.pairing === 'waiting' ? 'Waiting for the link to be opened' : 'Link expired: tap re-pair to send a new one'}
                    </div>
                  )}
                </div>
                <button type="button" onClick={() => repair(d)} aria-label={`Re-pair ${d.name}`} className="p-2 text-parchment/70">
                  <RotateCw size={18} />
                </button>
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
