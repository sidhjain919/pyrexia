import { useEffect, useRef, useState } from 'react'
import QrScanner from 'qr-scanner'
import { CameraOff, Flashlight, FlashlightOff } from 'lucide-react'

/**
 * The back camera, reading QR codes.
 *
 * qr-scanner uses the phone's own barcode reader where Chrome has one, which
 * is fast and copes with a dark gate, and falls back to its bundled decoder
 * on iPhones.
 *
 * A code that stays in view is reported once, not thirty times a second: it
 * is reported again only after it has been out of view for `repeatMs`. That
 * matters at the gate, where the pass is still in front of the camera after
 * the green screen, and a second read would turn the person just admitted
 * into ALREADY ENTERED.
 */
export default function Camera({
  onRead,
  paused = false,
  repeatMs = 2500,
  className = '',
}: {
  onRead: (text: string) => void
  /** Keep the camera running but ignore what it sees. Restarting it is slow. */
  paused?: boolean
  repeatMs?: number
  className?: string
}) {
  const video = useRef<HTMLVideoElement>(null)
  const scanner = useRef<QrScanner | null>(null)
  const last = useRef<{ text: string; at: number }>({ text: '', at: 0 })
  const handler = useRef(onRead)
  const pausedRef = useRef(paused)
  const [error, setError] = useState<string | null>(null)
  const [hasTorch, setHasTorch] = useState(false)
  const [torch, setTorch] = useState(false)

  handler.current = onRead
  pausedRef.current = paused

  useEffect(() => {
    if (!video.current) return
    const s = new QrScanner(
      video.current,
      (result) => {
        const text = result.data
        const now = Date.now()
        const seenRecently = text === last.current.text && now - last.current.at < repeatMs
        last.current = { text, at: now }
        if (seenRecently || pausedRef.current) return
        handler.current(text)
      },
      {
        preferredCamera: 'environment',
        maxScansPerSecond: 12,
        returnDetailedScanResult: true,
        highlightScanRegion: false,
        highlightCodeOutline: false,
      },
    )
    scanner.current = s
    s.start()
      .then(async () => setHasTorch(await s.hasFlash()))
      .catch((err: unknown) => {
        const msg = String(err ?? '')
        setError(
          /permission|denied|notallowed/i.test(msg)
            ? 'Camera permission was refused. Allow the camera for this site in the browser settings, then reload.'
            : 'No camera could be started on this device. Type the code instead.',
        )
      })
    return () => {
      s.destroy()
      scanner.current = null
    }
  }, [repeatMs])

  const toggleTorch = async () => {
    try {
      await scanner.current?.toggleFlash()
      setTorch(!!scanner.current?.isFlashOn())
    } catch {
      setHasTorch(false)
    }
  }

  return (
    <div className={`relative overflow-hidden bg-black ${className}`}>
      <video ref={video} className="h-full w-full object-cover" muted playsInline />
      {/* Aim box, so a guard knows where the sticker goes. */}
      {!error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="aspect-square w-[58%] max-w-[18rem] rounded-2xl border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-[0.9rem] text-parchment/80">
          <CameraOff size={28} className="text-ember" />
          {error}
        </div>
      )}
      {hasTorch && (
        <button
          type="button"
          onClick={toggleTorch}
          aria-label={torch ? 'Torch off' : 'Torch on'}
          className={`absolute right-3 top-3 flex h-12 w-12 items-center justify-center rounded-full ${
            torch ? 'bg-gold-bright text-abyss' : 'bg-black/60 text-white'
          }`}
        >
          {torch ? <FlashlightOff size={22} /> : <Flashlight size={22} />}
        </button>
      )}
    </div>
  )
}
