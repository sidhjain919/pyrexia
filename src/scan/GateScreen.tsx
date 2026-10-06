import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Keyboard, MoreVertical, TriangleAlert, Wifi, WifiOff, X } from 'lucide-react'

import { ApiError, setDevice, stickerApi, type GateManifest, type GateResult, type PairedDevice } from '../api/client'
import Camera from './Camera'
import { festNight, isOnlinePass, istTime, stickerCode } from './code'
import { signal, unlockAudio } from './feedback'

/**
 * The guard's screen at a Star Night gate.
 *
 * Online first: every scan asks the server, because only the server knows
 * whether another gate admitted the same sticker a second ago. If the server
 * does not answer within a few seconds, the phone decides from the list it
 * last downloaded, admits, and queues the scan to send when it can. A queued
 * admission the server finds was a duplicate is booked as one, so it shows
 * up for the committee afterwards even though the gate could not know.
 *
 * Green clears itself so the queue keeps moving. Red stays until the guard
 * taps it, because a refusal is a conversation, and the screen should not
 * move on in the middle of it.
 */

const SCAN_TIMEOUT_MS = 3500
const MANIFEST_EVERY_MS = 90_000
const FLUSH_EVERY_MS = 8_000

const MANIFEST_KEY = 'pyrexia.gate.manifest'
const ADMITTED_KEY = 'pyrexia.gate.admitted'
const QUEUE_KEY = 'pyrexia.gate.queue'

type Queued = { scan: string; scanId: string; offline: true; clientScannedAt: string }

type Display = {
  tone: 'ok' | 'bad' | 'warn'
  title: string
  name?: string
  lines: string[]
  offline?: boolean
  /** Clears itself after this long; otherwise waits for a tap. */
  autoMs?: number
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* a full or blocked storage costs the offline fallback, not the scan */
  }
}

function who(p: GateResult['person']): string[] {
  if (!p) return []
  return [[p.college, p.gender].filter(Boolean).join(' · ')].filter(Boolean)
}

/** Turn the server's answer into what the guard sees. */
function present(r: GateResult): Display {
  const serial = r.sticker?.label ? [r.sticker.label] : []
  switch (r.outcome) {
    case 'ok':
      return { tone: 'ok', title: 'ENTER', name: r.person?.name, lines: [...who(r.person), ...serial], autoMs: 1600 }
    case 'duplicate': {
      const ago = r.first ? (Date.now() - new Date(r.first.at).getTime()) / 1000 : Infinity
      // The same guard, a moment ago: the pass came back into view, not a copy.
      if (r.first?.byThisPhone && ago < 120) {
        return {
          tone: 'warn',
          title: 'JUST ADMITTED',
          name: r.person?.name,
          lines: [`You admitted this pass ${Math.max(1, Math.round(ago))} s ago.`, 'Same person: let them through.'],
          autoMs: 2500,
        }
      }
      return {
        tone: 'bad',
        title: 'ALREADY ENTERED',
        name: r.person?.name,
        lines: [
          r.first ? `Entered at ${istTime(r.first.at)}${r.first.gate ? ` · ${r.first.gate}` : ''}` : 'This pass was already used tonight.',
          'No re-entry. If this is a different person, the pass is a copy: call the supervisor.',
          ...serial,
        ],
      }
    }
    case 'not_active':
      return { tone: 'bad', title: 'NOT ACTIVATED', lines: ['This sticker was never activated.', 'Send them to the activation desk.', ...serial] }
    case 'void':
      return {
        tone: 'bad',
        title: 'CANCELLED PASS',
        name: r.person?.name,
        lines: ['This pass was reported lost or replaced.', 'Do not admit. Call the supervisor.', ...serial],
      }
    case 'no_festival_pass':
      return { tone: 'bad', title: 'NO FESTIVAL PASS', name: r.person?.name, lines: ['Their Festival Pass is no longer valid.', 'Call the supervisor.', ...serial] }
    case 'online_pass':
      return { tone: 'warn', title: 'PHONE QR NOT VALID', lines: ['Star Nights need the sticker on the festival pass card.', 'Scan the card, not the phone.'] }
    default:
      return { tone: 'bad', title: 'NOT OUR PASS', lines: ['This QR is not a PYREXIA sticker.'] }
  }
}

export default function GateScreen({ device, onUnpaired }: { device: PairedDevice; onUnpaired: () => void }) {
  const [started, setStarted] = useState(false)
  const [display, setDisplay] = useState<Display | null>(null)
  const [checking, setChecking] = useState(false)
  const [online, setOnline] = useState(true)
  const [count, setCount] = useState<number | null>(null)
  const [manifest, setManifest] = useState<GateManifest | null>(() => load<GateManifest | null>(MANIFEST_KEY, null))
  const [queue, setQueue] = useState<Queued[]>(() => load<Queued[]>(QUEUE_KEY, []))
  const [typing, setTyping] = useState(false)
  const [typed, setTyped] = useState('')
  const [menu, setMenu] = useState(false)

  const busy = useRef(false)
  const displayRef = useRef<Display | null>(null)
  const queueRef = useRef(queue)
  const flushing = useRef(false)
  displayRef.current = display
  queueRef.current = queue

  /** Code → [serial, name, college, gender], from the last download. */
  const live = useMemo(() => {
    const map = new Map<string, [number, string, string, string]>()
    for (const [code, serial, name, college, gender] of manifest?.stickers ?? []) {
      map.set(code, [serial, name, college, gender])
    }
    return map
  }, [manifest])

  const unpaired = useCallback(() => {
    setDevice(null)
    onUnpaired()
  }, [onUnpaired])

  const setQueueSaved = (next: Queued[]) => {
    queueRef.current = next
    setQueue(next)
    save(QUEUE_KEY, next)
  }

  /** Admitted by this phone tonight, for the offline duplicate check. */
  const rememberAdmitted = (code: string) => {
    const night = festNight()
    const held = load<{ night: string; codes: string[] }>(ADMITTED_KEY, { night, codes: [] })
    const codes = held.night === night ? held.codes : []
    if (!codes.includes(code)) codes.push(code)
    save(ADMITTED_KEY, { night, codes })
  }

  const enteredTonight = (code: string) => {
    const night = festNight()
    const held = load<{ night: string; codes: string[] }>(ADMITTED_KEY, { night, codes: [] })
    return (
      (held.night === night && held.codes.includes(code)) ||
      (manifest?.night === night && manifest.entered.includes(code))
    )
  }

  /* ---------- keeping the offline copy fresh ---------- */

  const refreshManifest = useCallback(async () => {
    try {
      const m = await stickerApi.manifest()
      setManifest(m)
      save(MANIFEST_KEY, m)
      setOnline(true)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) unpaired()
      else setOnline(false)
    }
  }, [unpaired])

  const flush = useCallback(async () => {
    if (flushing.current || !queueRef.current.length) return
    flushing.current = true
    try {
      for (const item of [...queueRef.current]) {
        try {
          await stickerApi.scan(item, 8000)
          setQueueSaved(queueRef.current.filter((q) => q.scanId !== item.scanId))
          setOnline(true)
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) return unpaired()
          // A refusal for a bad payload will never succeed; drop it rather
          // than block the queue behind it.
          if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
            setQueueSaved(queueRef.current.filter((q) => q.scanId !== item.scanId))
            continue
          }
          setOnline(false)
          return
        }
      }
    } finally {
      flushing.current = false
    }
  }, [unpaired])

  useEffect(() => {
    if (!started) return
    void stickerApi
      .gateMe()
      .then((me) => {
        setCount(me.admittedHere)
        setOnline(true)
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) unpaired()
        else setOnline(false)
      })
    void refreshManifest()
    const m = setInterval(refreshManifest, MANIFEST_EVERY_MS)
    const f = setInterval(flush, FLUSH_EVERY_MS)
    return () => {
      clearInterval(m)
      clearInterval(f)
    }
  }, [started, refreshManifest, flush, unpaired])

  /* ---------- the screen stays on while the gate is open ---------- */

  useEffect(() => {
    if (!started || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    const take = async () => {
      try {
        lock = await navigator.wakeLock.request('screen')
      } catch {
        /* battery saver, or not allowed: the guard taps the screen instead */
      }
    }
    const again = () => document.visibilityState === 'visible' && void take()
    void take()
    document.addEventListener('visibilitychange', again)
    return () => {
      document.removeEventListener('visibilitychange', again)
      void lock?.release()
    }
  }, [started])

  /* ---------- a scan ---------- */

  const show = (d: Display) => {
    setDisplay(d)
    signal(d.tone)
    if (d.autoMs) {
      const shown = d
      setTimeout(() => setDisplay((cur) => (cur === shown ? null : cur)), d.autoMs)
    }
  }

  /** The decision when the server cannot be reached. */
  const decideOffline = (text: string, scanId: string, at: string): Display => {
    if (isOnlinePass(text)) return present({ outcome: 'online_pass', night: festNight() })
    const code = stickerCode(text)
    if (!code) return present({ outcome: 'unknown', night: festNight() })

    const entry = live.get(code)
    if (!entry) {
      return {
        tone: 'warn',
        title: 'CANNOT CHECK',
        lines: ['No signal, and this sticker is not in the phone’s list.', 'Send them to the supervisor.'],
        offline: true,
      }
    }
    const [serial, name, college, gender] = entry
    const label = `No. ${String(serial).padStart(5, '0')}`
    if (enteredTonight(code)) {
      return {
        tone: 'bad',
        title: 'ALREADY ENTERED',
        name,
        lines: ['This pass was already used tonight.', 'No re-entry.', label],
        offline: true,
      }
    }

    rememberAdmitted(code)
    setQueueSaved([...queueRef.current, { scan: text, scanId, offline: true, clientScannedAt: at }])
    setCount((n) => (n ?? 0) + 1)
    return {
      tone: 'ok',
      title: 'ENTER',
      name,
      lines: [[college, gender].filter(Boolean).join(' · '), label].filter(Boolean),
      offline: true,
      autoMs: 1600,
    }
  }

  const handleRead = async (text: string) => {
    if (busy.current) return
    // A red or amber screen is waiting for the guard; the next pass waits too.
    if (displayRef.current && !displayRef.current.autoMs) return
    busy.current = true
    setChecking(true)
    const scanId = crypto.randomUUID()
    const at = new Date().toISOString()
    try {
      const r = await stickerApi.scan({ scan: text, scanId }, SCAN_TIMEOUT_MS)
      setOnline(true)
      if (r.outcome === 'ok') {
        const code = stickerCode(text)
        if (code) rememberAdmitted(code)
      }
      if (typeof r.admittedHere === 'number') setCount(r.admittedHere)
      show(present(r))
      // Back online with a queue waiting: send it now, not in eight seconds.
      if (queueRef.current.length) void flush()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return unpaired()
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
        show({ tone: 'bad', title: 'COULD NOT CHECK', lines: [err.message] })
      } else {
        setOnline(false)
        show(decideOffline(text, scanId, at))
      }
    } finally {
      busy.current = false
      setChecking(false)
    }
  }

  /* ---------- screens ---------- */

  if (!started) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-abyss px-6 text-center">
        <div>
          <div className="font-log text-[0.7rem] uppercase tracking-wide2 text-parchment/50">Star Night gate</div>
          <h1 className="mt-2 font-display text-3xl text-gold-bright">{device.gate}</h1>
          <p className="mt-1 text-parchment/70">{device.name}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            unlockAudio()
            void document.documentElement.requestFullscreen?.().catch(() => {})
            setStarted(true)
          }}
          className="rounded-full bg-gradient-to-b from-gold-bright to-gold-deep px-10 py-5 font-display text-xl text-abyss"
        >
          Start scanning
        </button>
        <p className="max-w-xs text-[0.85rem] text-parchment/50">
          Turn the volume up. A double beep means let them in; a long buzz means stop them.
        </p>
      </div>
    )
  }

  const bg = { ok: 'bg-green-600', bad: 'bg-red-700', warn: 'bg-amber-500' }

  return (
    <div className="relative flex h-[100dvh] flex-col bg-black text-white">
      <Camera onRead={handleRead} paused={!!display && !display.autoMs} className="min-h-0 flex-1" />

      {checking && !display && (
        <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center">
          <span className="rounded-full bg-black/70 px-4 py-2 text-[0.9rem]">Checking…</span>
        </div>
      )}

      {/* Status bar */}
      <div className="flex items-center gap-2.5 bg-abyss px-3 py-3 font-sans">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[1.05rem] font-semibold text-gold-bright">{device.gate}</div>
          <div className="truncate text-[0.78rem] text-parchment/60">{device.name}</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-2xl leading-none text-offwhite">{count ?? '–'}</div>
          <div className="text-[0.66rem] uppercase text-parchment/50">in tonight</div>
        </div>
        {/* Just an icon while all is well; words only when the guard needs to know. */}
        <div
          aria-label={online ? 'Online' : 'Offline'}
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[0.75rem] ${
            online ? 'bg-green-900/60 text-green-300' : 'bg-amber-900/70 text-amber-200'
          }`}
        >
          {online ? <Wifi size={15} /> : <WifiOff size={15} />}
          {!online && 'Offline'}
          {queue.length > 0 && <span className="font-mono">· {queue.length}</span>}
        </div>
        <button type="button" onClick={() => setTyping(true)} aria-label="Type a code" className="p-1.5 text-parchment/80">
          <Keyboard size={22} />
        </button>
        <button type="button" onClick={() => setMenu((m) => !m)} aria-label="More" className="p-1.5 text-parchment/60">
          <MoreVertical size={20} />
        </button>
      </div>

      {menu && (
        <div className="absolute bottom-20 right-3 z-20 w-64 rounded-xl border border-gold/20 bg-navy p-2 text-[0.9rem] shadow-xl">
          <div className="px-3 py-2 text-[0.75rem] text-parchment/50">
            {manifest ? `Offline list: ${manifest.stickers.length} passes, from ${istTime(manifest.at)}` : 'No offline list yet'}
          </div>
          <button
            type="button"
            className="w-full rounded-lg px-3 py-2.5 text-left text-parchment/90 hover:bg-white/5"
            onClick={() => {
              setMenu(false)
              void refreshManifest()
              void flush()
            }}
          >
            Sync now
          </button>
          <button
            type="button"
            className="w-full rounded-lg px-3 py-2.5 text-left text-red-300 hover:bg-white/5"
            onClick={() => {
              if (queue.length && !confirm(`${queue.length} admissions have not been sent yet and will be lost. Unpair anyway?`)) return
              if (confirm('Unpair this phone? A supervisor will have to pair it again.')) unpaired()
            }}
          >
            Unpair this phone
          </button>
        </div>
      )}

      {typing && (
        <form
          className="absolute inset-x-0 bottom-0 z-30 space-y-3 bg-navy p-4"
          onSubmit={(e) => {
            e.preventDefault()
            const v = typed
            setTyped('')
            setTyping(false)
            if (v.trim()) void handleRead(v)
          }}
        >
          <label className="block text-[0.85rem] text-parchment/70">
            The 10 characters under the QR
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value.toUpperCase())}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              placeholder="K7M2Q 9XA3F"
              className="mt-1.5 w-full rounded-lg border border-gold/30 bg-abyss px-4 py-3 font-mono text-2xl tracking-widest text-offwhite outline-none focus:border-gold"
            />
          </label>
          <div className="flex gap-3">
            <button type="button" onClick={() => setTyping(false)} className="flex-1 rounded-lg border border-white/20 py-3">
              Cancel
            </button>
            <button type="submit" className="flex-1 rounded-lg bg-gold-bright py-3 font-semibold text-abyss">
              Check
            </button>
          </div>
        </form>
      )}

      {display && (
        <button
          type="button"
          onClick={() => setDisplay(null)}
          // Plain sans, not the site's display serif: read at arm's length, at night, in a crowd.
          className={`absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 px-6 text-center font-sans ${bg[display.tone]}`}
        >
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/20">
            {display.tone === 'ok' ? <Check size={64} strokeWidth={3} /> : display.tone === 'bad' ? <X size={64} strokeWidth={3} /> : <TriangleAlert size={56} strokeWidth={2.5} />}
          </div>
          <div className="text-5xl font-black tracking-tight">{display.title}</div>
          {display.name && <div className="text-3xl font-semibold leading-tight">{display.name}</div>}
          {display.lines.map((l) => (
            <div key={l} className="max-w-sm text-lg leading-snug opacity-95">{l}</div>
          ))}
          {display.offline && (
            <div className="mt-2 rounded-full bg-black/30 px-4 py-1.5 text-sm">No signal: decided on this phone, will sync</div>
          )}
          {!display.autoMs && <div className="mt-6 text-sm opacity-80">Tap anywhere to continue</div>}
        </button>
      )}
    </div>
  )
}
