import { useEffect, useState } from 'react'

import { stickerApi, type StickerOverview } from '../api/client'
import { ErrorLine } from './ActivateTab'
import { istTime, nightLabel } from './code'
import { Panel } from './ui'

const REFUSED: Record<string, string> = {
  duplicate: 'Already entered',
  not_active: 'Not activated',
  void: 'Cancelled sticker',
  no_festival_pass: 'No Festival Pass',
  unknown: 'Not our QR',
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-lg bg-abyss/60 px-3 py-3">
      <div className="font-mono text-2xl text-offwhite">{n.toLocaleString('en-IN')}</div>
      <div className="mt-0.5 text-[0.75rem] text-parchment/55">{label}</div>
    </div>
  )
}

/** The supervisor's view of tonight, refreshed while it is open. */
export default function TonightTab() {
  const [data, setData] = useState<StickerOverview | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = () =>
      stickerApi
        .overview()
        .then((d) => {
          setData(d)
          setError(null)
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Could not load.'))
    void load()
    const t = setInterval(load, 15_000)
    return () => clearInterval(t)
  }, [])

  if (error) return <ErrorLine text={error} />
  if (!data) return <p className="text-parchment/60">Loading…</p>

  const refusedTotal = data.tonight.refused.reduce((s, r) => s + r.n, 0)

  return (
    <div className="space-y-4">
      <Panel>
        <div className="font-log text-[0.66rem] uppercase tracking-wide2 text-parchment/60">
          Tonight · {nightLabel(data.night)}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Stat n={data.tonight.admitted} label="Admitted" />
          <Stat n={refusedTotal} label="Refused" />
        </div>
        {data.tonight.byGate.length > 0 && (
          <ul className="mt-3 divide-y divide-white/5 text-[0.9rem]">
            {data.tonight.byGate.map((g) => (
              <li key={g.gate} className="flex justify-between py-2">
                <span className="text-parchment/80">{g.gate}</span>
                <span className="font-mono text-offwhite">{g.n}</span>
              </li>
            ))}
          </ul>
        )}
        {data.tonight.refused.length > 0 && (
          <ul className="mt-2 space-y-1 text-[0.82rem] text-red-200/80">
            {data.tonight.refused.map((r) => (
              <li key={r.result} className="flex justify-between">
                <span>{REFUSED[r.result] ?? r.result}</span>
                <span className="font-mono">{r.n}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {data.tonight.letInTwice.length > 0 && (
        <Panel tone="bad">
          <div className="font-semibold">
            Let in twice while offline: {data.tonight.letInTwice.length}
          </div>
          <p className="mt-1 text-[0.85rem] opacity-90">
            A gate phone without signal admitted these passes, and the server later found each had already been
            used tonight. Both people are inside: the pass was almost certainly copied. Look the sticker up and
            cancel it before the next night.
          </p>
          <ul className="mt-3 divide-y divide-white/10 text-[0.85rem]">
            {data.tonight.letInTwice.map((t, i) => (
              <li key={i} className="py-2">
                <div className="flex justify-between gap-3">
                  <span className="font-semibold">{t.name ?? 'Unknown holder'}</span>
                  <span className="font-mono">{t.label}</span>
                </div>
                {/* Not "first" and "again": the phone without signal may well
                    have let its person in before the other gate did. */}
                <div className="opacity-85">
                  In at {t.firstGate ?? '?'}, {t.firstAt ? istTime(t.firstAt) : '?'}
                </div>
                <div className="opacity-85">
                  Also in at {t.gate ?? '?'}, {istTime(t.at)}, no signal{t.guard ? ` (${t.guard})` : ''}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel>
        <div className="font-log text-[0.66rem] uppercase tracking-wide2 text-parchment/60">Stickers</div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat n={data.stickers.active} label="Activated" />
          <Stat n={data.stickers.stock} label="Unused" />
          <Stat n={data.stickers.void} label="Cancelled" />
        </div>
        <p className="mt-3 text-[0.85rem] text-parchment/65">
          {data.festivalPassWithoutSticker.toLocaleString('en-IN')} Festival Pass holders have not collected a sticker yet.
        </p>
      </Panel>

      {data.nights.length > 0 && (
        <Panel>
          <div className="font-log text-[0.66rem] uppercase tracking-wide2 text-parchment/60">Every night</div>
          <ul className="mt-2 divide-y divide-white/5 text-[0.9rem]">
            {data.nights.map((n) => (
              <li key={n.night} className="flex justify-between py-2">
                <span className="text-parchment/80">{nightLabel(n.night)}</span>
                <span className="font-mono text-offwhite">{n.n}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}
