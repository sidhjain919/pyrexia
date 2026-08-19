import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Anchor, Download } from 'lucide-react'
import type { Delegate } from './types'
import { DELEGATE_PASSES } from '../data/registration'

/**
 * The boarding pass issued once payment clears. The QR encodes the signed
 * payload the gate scanner resolves — so it must be rendered from
 * `delegate.qrPayload`, never from anything the browser makes up.
 */
export default function DelegatePass({ delegate }: { delegate: Delegate }) {
  const [qr, setQr] = useState<string | null>(null)
  const pass = DELEGATE_PASSES.find((p) => p.id === delegate.passId)

  useEffect(() => {
    let alive = true
    QRCode.toDataURL(delegate.qrPayload, {
      width: 640,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#06141b', light: '#e8d5ae' },
    })
      .then((url) => alive && setQr(url))
      .catch(() => alive && setQr(null))
    return () => {
      alive = false
    }
  }, [delegate.qrPayload])

  const download = () => {
    if (!qr) return
    const a = document.createElement('a')
    a.href = qr
    a.download = `pyrexia-2026-${delegate.delegateId}.png`
    a.click()
  }

  return (
    <div className="mx-auto max-w-sm">
      <div className="parchment relative overflow-hidden rounded-xl p-6 shadow-cinema">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-display text-[0.6rem] uppercase tracking-cinema text-wood/60">
              Delegate Pass · PYREXIA 2026
            </div>
            <div className="mt-1 font-display text-xl leading-tight text-wood">{delegate.name}</div>
            <div className="text-[0.78rem] text-wood/70">{delegate.college}</div>
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blood/90">
            <Anchor size={18} className="text-parchment" />
          </span>
        </div>

        <div className="my-5 h-px bg-wood/20" />

        <div className="flex items-center gap-5">
          <div className="shrink-0 rounded-lg bg-parchment p-2 ring-1 ring-wood/20">
            {qr ? (
              <img src={qr} alt={`QR code for pass ${delegate.delegateId}`} className="h-28 w-28" />
            ) : (
              <div className="h-28 w-28 animate-pulse rounded bg-wood/10" />
            )}
          </div>
          <dl className="min-w-0 flex-1 space-y-2.5">
            <div>
              <dt className="font-display text-[0.56rem] uppercase tracking-wide2 text-wood/55">Pass No.</dt>
              <dd className="font-display text-[0.98rem] tracking-wide text-wood">{delegate.delegateId}</dd>
            </div>
            <div>
              <dt className="font-display text-[0.56rem] uppercase tracking-wide2 text-wood/55">Tier</dt>
              <dd className="text-[0.86rem] text-wood/85">{pass?.name ?? delegate.passId}</dd>
            </div>
            <div>
              <dt className="font-display text-[0.56rem] uppercase tracking-wide2 text-wood/55">Status</dt>
              <dd className="text-[0.86rem] font-semibold text-[#1d6b4f]">Confirmed</dd>
            </div>
          </dl>
        </div>

        <p className="mt-5 text-[0.7rem] leading-relaxed text-wood/60">
          Show this at the gate. Keep the pass number handy — you'll need it every time you enter an
          event.
        </p>
      </div>

      <button
        type="button"
        onClick={download}
        disabled={!qr}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 font-display text-[0.68rem] uppercase tracking-wide2 text-gold-bright ring-1 ring-inset ring-gold/55 transition-colors hover:bg-gold/10 disabled:opacity-40"
      >
        <Download size={14} /> Download QR
      </button>
    </div>
  )
}
