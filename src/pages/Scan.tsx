import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

import { ApiError, clearSession, getAccount, getDevice, getSession, setDevice, stickerApi, type PairedDevice } from '../api/client'
import ActivateTab from '../scan/ActivateTab'
import GateScreen from '../scan/GateScreen'
import LookupTab from '../scan/LookupTab'
import PhonesTab from '../scan/PhonesTab'
import TonightTab from '../scan/TonightTab'
import { ErrorLine } from '../scan/ActivateTab'
import { Panel, TextEntry } from '../scan/ui'

/**
 * Star Night stickers: one page, three kinds of device.
 *
 *  - A guard's phone, paired to a gate, opens straight into the scanner and
 *    can do nothing else.
 *  - A desk device, paired for activation, activates and looks up stickers.
 *  - A supervisor, signed in as themselves, does all of that and pairs the
 *    phones, cancels stickers and watches the night.
 *
 * Not the security boundary, like /admin and /desk: every endpoint checks for
 * itself. A device link from a supervisor's screen lands here with
 * `?pair=CODE` and pairs on the spot.
 */

type Who = { kind: 'supervisor' | 'desk'; label: string; supervisor: boolean }
type Tab = 'activate' | 'lookup' | 'phones' | 'tonight'

export default function Scan() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [device, setDeviceState] = useState<PairedDevice | null>(() => getDevice())
  const [who, setWho] = useState<Who | null | 'none'>(null)
  const [tab, setTab] = useState<Tab>('activate')
  const [pairError, setPairError] = useState<string | null>(null)
  const [pairing, setPairing] = useState(false)

  const pair = async (code: string) => {
    setPairing(true)
    setPairError(null)
    try {
      const d = await stickerApi.pair(code)
      setDevice(d)
      setDeviceState(d)
      // Ask the browser not to clear this site's storage when space runs low:
      // that storage is the pairing, and losing it sends a guard back to the
      // supervisor mid-concert. Chrome grants it quietly for a site in use.
      void navigator.storage?.persist?.().catch(() => {})
      setWho(null)
    } catch (err) {
      setPairError(err instanceof Error ? err.message : 'Could not pair this phone.')
    } finally {
      setPairing(false)
      // The code is spent either way; do not leave it in the address bar.
      if (params.get('pair')) navigate('/scan', { replace: true })
    }
  }

  useEffect(() => {
    const code = params.get('pair')
    if (code) void pair(code)
  }, [])

  useEffect(() => {
    if (device?.kind === 'gate' || params.get('pair')) return
    let cancelled = false
    stickerApi
      .whoami()
      .then((w) => !cancelled && setWho(w))
      .catch((err) => {
        if (cancelled) return
        // A desk device that was unpaired from the supervisor's screen.
        if (device && err instanceof ApiError && err.status === 401) {
          setDevice(null)
          setDeviceState(null)
        }
        setWho('none')
      })
    return () => {
      cancelled = true
    }
  }, [device, params])

  useEffect(() => {
    document.title = 'Scan · PYREXIA 2026'
  }, [])

  if (device?.kind === 'gate') {
    return <GateScreen device={device} onUnpaired={() => setDeviceState(null)} />
  }

  if (pairing || who === null) {
    return (
      <Shell>
        <div className="flex items-center gap-3 text-parchment/60">
          <Loader2 size={16} className="animate-spin" /> {pairing ? 'Pairing this phone…' : 'Checking…'}
        </div>
      </Shell>
    )
  }

  if (who === 'none') {
    return (
      <Shell>
        <h1 className="font-display text-3xl text-offwhite">Star Night scanner</h1>
        <p className="mt-2 text-[0.95rem] text-parchment/65">For PYREXIA crew at the activation desk and the concert gates.</p>

        <div className="mt-6 space-y-4">
          <Panel>
            <div className="font-log text-[0.66rem] uppercase tracking-wide2 text-parchment/60">Pair this phone</div>
            <p className="mt-2 text-[0.88rem] text-parchment/65">
              Ask the supervisor for a pairing code, or scan the QR on their screen with this phone's camera.
            </p>
            <p className="mt-2 text-[0.88rem] text-parchment/65">
              Was this phone working and now shows this screen? Ask the supervisor to <em>re-pair</em> you: they
              will send a link on WhatsApp. Tap it and you are back on your gate.
            </p>
            <TextEntry className="mt-3" placeholder="8-character code" button="Pair" busy={pairing} onSubmit={pair} mono />
          </Panel>
          {pairError && <ErrorLine text={pairError} />}
          {getSession() ? (
            // Signed in, but not as a supervisor: say so, or "Sign in" just
            // brings them straight back here with no explanation.
            <p className="text-center text-[0.88rem] text-parchment/55">
              Signed in as {getAccount()?.email ?? 'a student account'}, which is not a supervisor account.{' '}
              <button
                type="button"
                onClick={() => {
                  clearSession()
                  navigate('/sign-in?next=/scan')
                }}
                className="text-gold-bright underline"
              >
                Sign in as a supervisor
              </button>
            </p>
          ) : (
            <p className="text-center text-[0.88rem] text-parchment/55">
              Supervisor?{' '}
              <Link to="/sign-in?next=/scan" className="text-gold-bright underline">
                Sign in
              </Link>
            </p>
          )}
        </div>
      </Shell>
    )
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'activate', label: 'Activate' },
    { id: 'lookup', label: 'Look up' },
    ...(who.supervisor
      ? [
          { id: 'phones' as const, label: 'Phones' },
          { id: 'tonight' as const, label: 'Tonight' },
        ]
      : []),
  ]

  return (
    <Shell>
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="font-display text-2xl text-offwhite">Star Night stickers</h1>
        <span className="truncate text-[0.78rem] text-parchment/50">
          {who.kind === 'desk' ? device?.name : who.label}
        </span>
      </div>

      <nav className="mt-4 flex gap-1 rounded-xl bg-abyss/70 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg py-2.5 text-[0.88rem] ${
              tab === t.id ? 'bg-gold/20 text-gold-bright' : 'text-parchment/60'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="mt-4">
        {tab === 'activate' && <ActivateTab supervisor={who.supervisor} />}
        {tab === 'lookup' && <LookupTab supervisor={who.supervisor} />}
        {tab === 'phones' && <PhonesTab />}
        {tab === 'tonight' && <TonightTab />}
      </div>

    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-abyss px-4 pb-12 pt-6 text-parchment">
      <div className="mx-auto max-w-lg">{children}</div>
    </div>
  )
}
