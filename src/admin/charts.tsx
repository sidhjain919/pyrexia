import { useRef, useState, type ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'

import type { AdminStats } from '../api/client'

/**
 * The instrument panel.
 *
 * Every chart here is built from a few rules so the page reads as one thing:
 *
 *  - One hue. Bright brass is the Festival Pass and deep brass is Basic on
 *    every chart (a tier is ordered, so a light-to-dark ramp is the honest
 *    encoding); single-series bars take the middle step, and context (the
 *    accounts line) is drawn in parchment so it never reads as a category.
 *  - Marks are thin (columns cap at 24px), separated by a 2px gap in the surface
 *    colour rather than by a stroke, and grow from a single baseline.
 *  - Text never wears the series colour; a swatch beside the text carries it.
 *  - Every chart has a hover readout and a table view, so no value is reachable
 *    only by colour or only by pointing.
 *  - Status colours (good / attention / problem) are reserved for things that
 *    are actually good or bad, and always sit beside an icon or a word.
 */

/* ------------------------------------------------------------------ *
 * Formatting
 * ------------------------------------------------------------------ */

export const inr = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const inrWhole = (paise: number) =>
  `₹${Math.round(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

/** Axis-sized rupees: ₹850 · ₹12k · ₹1.5L */
function inrShort(paise: number): string {
  const r = paise / 100
  if (r >= 100000) return `₹${(r / 100000).toFixed(r >= 1000000 ? 0 : 1)}L`
  if (r >= 1000) return `₹${(r / 1000).toFixed(r >= 10000 ? 0 : 1)}k`
  return `₹${Math.round(r)}`
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)

/**
 * A tidy axis: four gridlines at clean whole-number steps (1, 2, 5, 10, 20 …),
 * with the ceiling at the fourth. Rounding quarter-points of an arbitrary
 * ceiling gave ticks like 1, 3, 4, 5, which is worse than none.
 */
function niceAxis(max: number): { top: number; ticks: number[] } {
  const raw = Math.max(1, max) / 4
  const p = Math.pow(10, Math.floor(Math.log10(raw)))
  let step = 10 * p
  for (const m of [1, 2, 5, 10]) if (m * p >= raw) { step = m * p; break }
  const top = step * 4
  return { top, ticks: [1, 2, 3, 4].map((i) => i * step) }
}

/* ------------------------------------------------------------------ *
 * IST day axis
 * ------------------------------------------------------------------ */

function istToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
}

function istDays(count: number): string[] {
  const [y, m, d] = istToday().split('-').map(Number)
  const base = Date.UTC(y, m - 1, d)
  const out: string[] = []
  for (let i = count - 1; i >= 0; i--) out.push(new Date(base - i * 86400000).toISOString().slice(0, 10))
  return out
}

function dayLabel(key: string, withMonth = true): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', {
    day: 'numeric',
    ...(withMonth ? { month: 'short' } : {}),
    timeZone: 'UTC',
  })
}

/** "2 min ago", "3 h ago", "Yesterday", "12 Sep" for a SQLite UTC timestamp. */
function ago(sqlite: string): string {
  const t = new Date(sqlite.replace(' ', 'T') + 'Z').getTime()
  const s = Math.max(0, (Date.now() - t) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  if (s < 172800) return 'yesterday'
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })
}

/* ------------------------------------------------------------------ *
 * Card, tooltip, table view
 * ------------------------------------------------------------------ */

type Table = { columns: string[]; rows: (string | number)[][]; numeric?: number[] }

export function Card({
  title,
  definition,
  aside,
  table,
  children,
  className = '',
}: {
  title?: string
  /** One plain sentence saying exactly what the numbers mean. */
  definition?: string
  aside?: ReactNode
  table?: Table
  children: ReactNode
  className?: string
}) {
  const [showTable, setShowTable] = useState(false)

  return (
    <section className={`card p-5 sm:p-6 ${className}`}>
      {(title || aside || table) && (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h3 className="text-[1.02rem] font-semibold leading-tight">{title}</h3>}
            {definition && <p className="ink-3 mt-1 text-[0.78rem] leading-snug">{definition}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {aside}
            {table && (
              <button
                type="button"
                className="ghost"
                aria-pressed={showTable}
                onClick={() => setShowTable((v) => !v)}
              >
                {showTable ? 'Chart' : 'Table'}
              </button>
            )}
          </div>
        </div>
      )}

      {showTable && table ? (
        <div className="mt-4 overflow-x-auto">
          <table className="data">
            <thead>
              <tr>
                {table.columns.map((c, i) => (
                  <th key={c} className={table.numeric?.includes(i) ? 'n' : ''}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((v, j) => (
                    <td key={j} className={table.numeric?.includes(j) ? 'n num' : ''}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4">{children}</div>
      )}
    </section>
  )
}

type TipLine = { key?: string; label: string; value: string }
type TipState = { x: number; y: number; title: string; lines: TipLine[] }

function useTip() {
  const ref = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<TipState | null>(null)

  const show = (target: HTMLElement, title: string, lines: TipLine[]) => {
    const box = ref.current?.getBoundingClientRect()
    if (!box) return
    const r = target.getBoundingClientRect()
    setTip({ x: r.left - box.left + r.width / 2, y: r.top - box.top, title, lines })
  }
  const hide = () => setTip(null)

  return { ref, tip, show, hide }
}

function Tip({ tip, container }: { tip: TipState | null; container: HTMLDivElement | null }) {
  if (!tip) return null
  const width = container?.clientWidth ?? 320
  const left = Math.max(0, Math.min(tip.x - 76, width - 156))
  return (
    <div className="tip" style={{ left, top: tip.y - 8, transform: 'translateY(-100%)' }} role="status">
      <div className="ink-3 mb-1 text-[0.7rem]">{tip.title}</div>
      {tip.lines.map((l) => (
        <div key={l.label} className="row">
          <span className="flex items-center gap-1.5">
            {l.key && <span className="key" style={{ background: l.key }} />}
            <span className="ink-2">{l.label}</span>
          </span>
          <strong className="num">{l.value}</strong>
        </div>
      ))}
    </div>
  )
}

/** A swatch + label + value, the legend row used everywhere. */
function Legend({ color, label, value, shape = 'rect' }: { color: string; label: string; value?: string; shape?: 'rect' | 'line' }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[0.78rem]">
      <span
        className="inline-block shrink-0"
        style={
          shape === 'line'
            ? { width: 14, height: 2, borderRadius: 1, background: color }
            : { width: 10, height: 10, borderRadius: 3, background: color }
        }
      />
      <span className="ink-2">{label}</span>
      {value !== undefined && <span className="num">{value}</span>}
    </span>
  )
}

/* ------------------------------------------------------------------ *
 * Hero: the money
 * ------------------------------------------------------------------ */

export function Hero({ stats }: { stats: AdminStats }) {
  const days = istDays(30)
  const series = days.map((d) => stats.revenueDaily.find((r) => r.day === d)?.paise ?? 0)
  const max = Math.max(1, ...series)
  const W = 100
  const H = 100
  const pts = series.map((v, i) => [
    (i / (series.length - 1)) * W,
    H - (v / max) * (H - 6) - 3,
  ])
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  const area = `${line} L${W},${H} L0,${H} Z`
  const peak = series.indexOf(max)

  return (
    <section className="card relative overflow-hidden p-6 sm:p-8">
      <div className="text-[0.86rem] ink-2">Total collected</div>
      <div className="mt-1 flex items-baseline gap-1 leading-none">
        <span className="text-[1.6rem] font-medium text-gold-bright sm:text-[2.2rem]">₹</span>
        <span className="text-[2.9rem] font-semibold tracking-tight text-gold-bright sm:text-[3.9rem]">
          {(stats.collectedPaise / 100).toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      </div>
      <p className="ink-3 mt-2 max-w-md text-[0.78rem] leading-snug">
        Exact amount received through Razorpay across every successful payment. Refunded payments are
        not counted.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:max-w-sm">
        <div>
          <div className="ink-3 text-[0.74rem]">Today</div>
          <div className="mt-0.5 text-[1.15rem] font-semibold">{inr(stats.collectedTodayPaise)}</div>
        </div>
        <div>
          <div className="ink-3 text-[0.74rem]">Last 7 days</div>
          <div className="mt-0.5 text-[1.15rem] font-semibold">{inr(stats.collectedWeekPaise)}</div>
        </div>
      </div>

      {/* Thirty days of money, as a line. One series, so no legend: the caption names it. */}
      <div className="mt-6">
        <div className="flex items-baseline justify-between text-[0.72rem] ink-3">
          <span>Received per day, last 30 days</span>
          <span className="num">Peak {inrWhole(max)} on {dayLabel(days[peak])}</span>
        </div>
        <div className="relative mt-2 h-16">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full">
            <path d={area} fill="rgba(230,194,94,0.10)" />
            <path d={line} fill="none" stroke="#e6c25e" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          <span
            className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-bright ring-2"
            style={{ left: `${pts[pts.length - 1][0]}%`, top: `${pts[pts.length - 1][1]}%`, ['--tw-ring-color' as string]: 'var(--cs-surface)' }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[0.7rem] ink-3">
          <span>{dayLabel(days[0])}</span>
          <span>Today</span>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * KPI strip
 * ------------------------------------------------------------------ */

export function KpiStrip({ items }: { items: { label: string; value: number | string; note: string }[] }) {
  return (
    <section className="card grid grid-cols-2 divide-x divide-y divide-[color:var(--cs-hair)] overflow-hidden sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
      {items.map((k) => (
        <div key={k.label} className="p-4 sm:p-5">
          <div className="ink-2 text-[0.8rem]">{k.label}</div>
          <div className="mt-1 text-[1.7rem] font-semibold leading-none sm:text-[1.9rem]">{k.value}</div>
          <div className="ink-3 mt-1.5 text-[0.74rem] leading-snug">{k.note}</div>
        </div>
      ))}
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * Trend: passes per day (Basic / Festival) with accounts created as context
 * ------------------------------------------------------------------ */

export function TrendChart({ stats }: { stats: AdminStats }) {
  const { ref, tip, show, hide } = useTip()
  const days = istDays(30)
  const rows = days.map((day) => {
    const p = stats.passesDaily.find((r) => r.day === day)
    return {
      day,
      basic: p?.basic ?? 0,
      festival: p?.festival ?? 0,
      accounts: stats.accountsDaily.find((r) => r.day === day)?.n ?? 0,
    }
  })
  const { top, ticks } = niceAxis(Math.max(...rows.map((r) => Math.max(r.basic + r.festival, r.accounts))))

  // The context line in SVG so it can cross the columns without fighting them.
  const W = 100
  const H = 100
  const linePts = rows.map((r, i) => [
    ((i + 0.5) / rows.length) * W,
    H - (r.accounts / top) * H,
  ])
  const line = linePts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')

  const totalBasic = rows.reduce((s, r) => s + r.basic, 0)
  const totalFest = rows.reduce((s, r) => s + r.festival, 0)
  const totalAcc = rows.reduce((s, r) => s + r.accounts, 0)

  return (
    <Card
      title="Registrations, last 30 days"
      definition="Columns are passes bought each day; the line is accounts created the same day. The gap between them is people who signed up and have not paid yet."
      table={{
        columns: ['Day', 'Basic', 'Festival Pass', 'Accounts created'],
        numeric: [1, 2, 3],
        rows: rows.map((r) => [dayLabel(r.day), r.basic, r.festival, r.accounts]),
      }}
    >
      <div className="flex flex-wrap gap-x-5 gap-y-1.5">
        <Legend color="var(--cs-basic)" label="Basic" value={String(totalBasic)} />
        <Legend color="var(--cs-festival)" label="Festival Pass" value={String(totalFest)} />
        <Legend color="var(--cs-line)" label="Accounts created" value={String(totalAcc)} shape="line" />
      </div>

      <div ref={ref} className="relative mt-4 pl-8">
        {/* y axis */}
        <div className="absolute inset-y-0 left-0 w-7 text-right text-[0.66rem] ink-3">
          {ticks.map((t, i) => (
            <span key={t} className="num absolute right-1 -translate-y-1/2" style={{ top: `${100 - (i + 1) * 25}%` }}>
              {t}
            </span>
          ))}
        </div>

        <div className="relative h-44">
          {/* gridlines: hairline, solid, recessive */}
          {[25, 50, 75, 100].map((p) => (
            <div key={p} className="absolute inset-x-0" style={{ top: `${100 - p}%`, height: 1, background: 'var(--cs-grid)' }} />
          ))}
          <div className="absolute inset-x-0 bottom-0" style={{ height: 1, background: 'rgba(242,237,225,0.18)' }} />

          {/* columns */}
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {rows.map((r) => {
              const hasAny = r.basic + r.festival > 0
              return (
                <div
                  key={r.day}
                  tabIndex={0}
                  className="group relative flex h-full flex-1 flex-col justify-end outline-none"
                  onPointerEnter={(e) =>
                    show(e.currentTarget, dayLabel(r.day), [
                      { key: 'var(--cs-basic)', label: 'Basic', value: String(r.basic) },
                      { key: 'var(--cs-festival)', label: 'Festival Pass', value: String(r.festival) },
                      { key: 'var(--cs-line)', label: 'Accounts created', value: String(r.accounts) },
                    ])
                  }
                  onFocus={(e) =>
                    show(e.currentTarget, dayLabel(r.day), [
                      { key: 'var(--cs-basic)', label: 'Basic', value: String(r.basic) },
                      { key: 'var(--cs-festival)', label: 'Festival Pass', value: String(r.festival) },
                      { key: 'var(--cs-line)', label: 'Accounts created', value: String(r.accounts) },
                    ])
                  }
                  onPointerLeave={hide}
                  onBlur={hide}
                >
                  <div className="mx-auto flex w-full max-w-[24px] flex-col justify-end transition-opacity group-hover:opacity-85 group-focus-visible:opacity-85" style={{ height: '100%' }}>
                    {r.festival > 0 && (
                      <div
                        className="w-full rounded-t-[4px]"
                        style={{ height: `${(r.festival / top) * 100}%`, background: 'var(--cs-festival)', marginBottom: r.basic > 0 ? 2 : 0 }}
                      />
                    )}
                    {r.basic > 0 && (
                      <div
                        className={`w-full ${r.festival > 0 ? '' : 'rounded-t-[4px]'}`}
                        style={{ height: `${(r.basic / top) * 100}%`, background: 'var(--cs-basic)' }}
                      />
                    )}
                    {!hasAny && <div className="w-full" style={{ height: 2, background: 'rgba(242,237,225,0.12)' }} />}
                  </div>
                </div>
              )
            })}
          </div>

          {/* context line */}
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
            <path d={line} fill="none" stroke="var(--cs-line)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>

        <div className="mt-2 flex justify-between text-[0.7rem] ink-3">
          <span>{dayLabel(days[0])}</span>
          <span>{dayLabel(days[15])}</span>
          <span>Today</span>
        </div>

        <Tip tip={tip} container={ref.current} />
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ *
 * Funnel
 * ------------------------------------------------------------------ */

export function Funnel({ funnel }: { funnel: AdminStats['funnel'] }) {
  const stages = [
    { label: 'Made an account', n: funnel.accounts, color: 'var(--cs-f1)' },
    { label: 'Confirmed their email', n: funnel.verified, color: 'var(--cs-f2)' },
    { label: 'Uploaded a college ID', n: funnel.idUploaded, color: 'var(--cs-f3)' },
    { label: 'Paid Basic Registration', n: funnel.paid, color: 'var(--cs-f4)' },
    { label: 'Added the Festival Pass', n: funnel.festival, color: 'var(--cs-f5)' },
  ]
  const max = Math.max(1, funnel.accounts)

  return (
    <Card
      title="From account to pass"
      definition="Each step is how many people got that far. The percentage is the share of the step before, so the biggest drop shows where people stall."
      table={{
        columns: ['Step', 'People', 'Of previous step'],
        numeric: [1, 2],
        rows: stages.map((s, i) => [s.label, s.n, i === 0 ? '—' : `${pct(s.n, stages[i - 1].n)}%`]),
      }}
    >
      <ol className="space-y-3">
        {stages.map((s, i) => {
          const conv = i === 0 ? null : pct(s.n, stages[i - 1].n)
          return (
            <li key={s.label}>
              <div className="flex items-baseline justify-between gap-3 text-[0.82rem]">
                <span className="ink-2 min-w-0 truncate">{s.label}</span>
                <span className="flex shrink-0 items-baseline gap-2">
                  <strong className="num text-[0.92rem]">{s.n}</strong>
                  {conv !== null && <span className="ink-3 num text-[0.72rem]">{conv}%</span>}
                </span>
              </div>
              <div className="mt-1.5 h-2 rounded-[4px]" style={{ background: 'var(--cs-track)' }}>
                <div className="h-full rounded-[4px]" style={{ width: `${Math.max(1.5, (s.n / max) * 100)}%`, background: s.color }} />
              </div>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}

/* ------------------------------------------------------------------ *
 * Where the money came from
 * ------------------------------------------------------------------ */

export function Composition({ stats }: { stats: AdminStats }) {
  const c = stats.composition
  const total = Math.max(1, stats.collectedPaise)
  const parts = [
    { label: 'Basic Registration', paise: c.basicPaise, color: 'var(--cs-basic)' },
    { label: 'Festival Pass', paise: c.festivalPaise, color: 'var(--cs-festival)' },
    { label: 'Event entry fees', paise: c.eventFeesPaise, color: 'var(--cs-third)' },
    { label: 'Gateway charges paid by students', paise: c.gatewayPaise, color: 'var(--cs-deep)' },
  ].filter((p) => p.paise > 0)

  return (
    <Card
      title="Where the money came from"
      definition="The total collected, split by what it was paid for. Gateway charges are the Razorpay fee students pay on top; they pass straight through to Razorpay."
      table={{
        columns: ['Source', 'Amount', 'Share'],
        numeric: [1, 2],
        rows: parts.map((p) => [p.label, inr(p.paise), `${pct(p.paise, total)}%`]),
      }}
    >
      <div className="flex h-3.5 gap-[2px] overflow-hidden rounded-[4px]">
        {parts.map((p) => (
          <div key={p.label} title={`${p.label}: ${inr(p.paise)}`} style={{ width: `${(p.paise / total) * 100}%`, background: p.color, minWidth: p.paise > 0 ? 3 : 0 }} />
        ))}
      </div>
      <ul className="mt-4 space-y-2">
        {parts.map((p) => (
          <li key={p.label} className="flex items-baseline justify-between gap-3 text-[0.82rem]">
            <Legend color={p.color} label={p.label} />
            <span className="flex shrink-0 items-baseline gap-2">
              <strong className="num">{inr(p.paise)}</strong>
              <span className="ink-3 num w-9 text-right text-[0.72rem]">{pct(p.paise, total)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

/* ------------------------------------------------------------------ *
 * Momentum: this week against last
 * ------------------------------------------------------------------ */

/** The arrow and the word carry the direction; the colour only brightens a rise. */
function Delta({ now, before }: { now: number; before: number }) {
  if (before === 0 && now === 0) return <span className="ink-3 inline-flex items-center gap-1 text-[0.76rem]"><Minus size={12} /> no change</span>
  if (before === 0) return <span className="inline-flex items-center gap-1 text-[0.76rem]" style={{ color: 'var(--cs-festival)' }}><ArrowUpRight size={13} /> new this week</span>
  const d = Math.round(((now - before) / before) * 100)
  if (d === 0) return <span className="ink-3 inline-flex items-center gap-1 text-[0.76rem]"><Minus size={12} /> same as last week</span>
  const up = d > 0
  return (
    <span className={`inline-flex items-center gap-1 text-[0.76rem] ${up ? '' : 'ink-2'}`} style={up ? { color: 'var(--cs-festival)' } : undefined}>
      {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
      {Math.abs(d)}% {up ? 'up' : 'down'} on last week
    </span>
  )
}

export function Momentum({ momentum }: { momentum: AdminStats['momentum'] }) {
  const rows = [
    { label: 'Passes bought', now: momentum.passesLast7, before: momentum.passesPrev7 },
    { label: 'Accounts created', now: momentum.accountsLast7, before: momentum.accountsPrev7 },
  ]
  return (
    <Card
      title="This week"
      definition="The last 7 days compared with the 7 before them. A steady climb means the word is spreading; a drop is your cue to post."
      table={{ columns: ['Measure', 'Last 7 days', 'Previous 7 days'], numeric: [1, 2], rows: rows.map((r) => [r.label, r.now, r.before]) }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="rounded-xl p-4" style={{ background: 'var(--cs-surface-2)' }}>
            <div className="ink-2 text-[0.8rem]">{r.label}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-[1.8rem] font-semibold leading-none">{r.now}</span>
              <span className="ink-3 text-[0.76rem]">vs {r.before}</span>
            </div>
            <div className="mt-2"><Delta now={r.now} before={r.before} /></div>
          </div>
        ))}
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ *
 * Hour of day
 * ------------------------------------------------------------------ */

export function HourChart({ hourly }: { hourly: AdminStats['hourly'] }) {
  const { ref, tip, show, hide } = useTip()
  const hours = Array.from({ length: 24 }, (_, h) => ({ h, n: hourly.find((r) => r.hour === h)?.n ?? 0 }))
  const max = Math.max(1, ...hours.map((x) => x.n))
  const peak = hours.reduce((a, b) => (b.n > a.n ? b : a), hours[0])
  const label = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'am' : 'pm'}`
  const total = hours.reduce((s, x) => s + x.n, 0)

  return (
    <Card
      title="When people pay"
      definition="Passes bought by hour of the day, Indian time, over the whole campaign. Post announcements a little before the peak."
      aside={total > 0 ? <span className="ink-2 text-[0.76rem]">Peak <strong className="num">{label(peak.h)}</strong></span> : undefined}
      table={{ columns: ['Hour', 'Passes'], numeric: [1], rows: hours.filter((x) => x.n > 0).map((x) => [label(x.h), x.n]) }}
    >
      <div ref={ref} className="relative">
        <div className="flex h-24 items-end gap-[2px]">
          {hours.map((x) => (
            <div
              key={x.h}
              tabIndex={0}
              className="group relative flex h-full flex-1 items-end outline-none"
              onPointerEnter={(e) => show(e.currentTarget, label(x.h), [{ label: 'Passes', value: String(x.n) }])}
              onFocus={(e) => show(e.currentTarget, label(x.h), [{ label: 'Passes', value: String(x.n) }])}
              onPointerLeave={hide}
              onBlur={hide}
            >
              <div
                className="mx-auto w-full max-w-[24px] rounded-t-[4px] transition-opacity group-hover:opacity-85"
                style={{
                  height: x.n === 0 ? 2 : `${Math.max(4, (x.n / max) * 100)}%`,
                  background: x.n === 0 ? 'rgba(242,237,225,0.10)' : x.h === peak.h ? 'var(--cs-peak)' : 'var(--cs-bar)',
                }}
              />
            </div>
          ))}
        </div>
        {/* Each label sits under the centre of its own hour's column. */}
        <div className="relative mt-2 h-4 text-[0.7rem] ink-3">
          {[0, 6, 12, 18, 23].map((h) => (
            <span
              key={h}
              className="absolute -translate-x-1/2 whitespace-nowrap"
              style={{ left: `${((h + 0.5) / 24) * 100}%` }}
            >
              {label(h)}
            </span>
          ))}
        </div>
        <Tip tip={tip} container={ref.current} />
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ *
 * Payments health
 * ------------------------------------------------------------------ */

export function Payments({ payments }: { payments: AdminStats['payments'] }) {
  const attempts = payments.paid + payments.failed
  const rate = attempts > 0 ? Math.round((payments.paid / attempts) * 100) : null
  const max = Math.max(1, ...payments.methods.map((m) => m.n))
  const pretty = (m: string) => ({ upi: 'UPI', card: 'Card', netbanking: 'Net banking', wallet: 'Wallet', emi: 'EMI', unknown: 'Not recorded' })[m] ?? m

  return (
    <Card
      title="Payments"
      definition="How many payment attempts succeeded, and which methods people used. A low success rate usually means a bank or UPI app having a bad day."
      table={{ columns: ['Method', 'Payments'], numeric: [1], rows: payments.methods.map((m) => [pretty(m.method), m.n]) }}
    >
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <div>
          <div className="ink-3 text-[0.74rem]">Success rate</div>
          <div className="mt-0.5 text-[1.8rem] font-semibold leading-none">{rate === null ? '—' : `${rate}%`}</div>
        </div>
        <div className="flex gap-6 text-[0.8rem]">
          <span><strong className="num">{payments.paid}</strong> <span className="ink-3">paid</span></span>
          <span><strong className="num">{payments.failed}</strong> <span className="ink-3">failed</span></span>
          <span><strong className="num">{payments.refunded}</strong> <span className="ink-3">refunded</span></span>
        </div>
      </div>

      <ul className="mt-5 space-y-2.5">
        {payments.methods.length === 0 && <li className="ink-3 text-[0.82rem]">No payments yet.</li>}
        {payments.methods.map((m) => (
          <li key={m.method}>
            <div className="flex items-baseline justify-between text-[0.82rem]">
              <span className="ink-2">{pretty(m.method)}</span>
              <strong className="num">{m.n}</strong>
            </div>
            <div className="mt-1 h-1.5 rounded-[4px]" style={{ background: 'var(--cs-track)' }}>
              <div className="h-full rounded-[4px]" style={{ width: `${(m.n / max) * 100}%`, background: 'var(--cs-bar)' }} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}

/* ------------------------------------------------------------------ *
 * At this pace
 * ------------------------------------------------------------------ */

/**
 * A straight line from the last seven days to the first day of the fest.
 *
 * Deliberately not called a forecast: registrations bunch up near the
 * deadline and after every post. It answers a narrower question the committee
 * actually asks - "if nothing changes, where do we land?" - and says so.
 */
export function Pace({ stats, days }: { stats: AdminStats; days: number }) {
  const perDay = stats.momentum.passesLast7 / 7
  const left = Math.max(0, days)
  const projected = Math.round(stats.registered + perDay * left)
  const perDayText = perDay >= 10 ? Math.round(perDay).toString() : perDay.toFixed(1)

  return (
    <Card
      title="At this pace"
      definition="If the last seven days simply continue until the fest opens. A straight line, not a forecast: the real curve bends up after every post and near the deadline."
      table={{
        columns: ['Measure', 'Value'],
        numeric: [1],
        rows: [
          ['Passes per day, last 7 days', perDayText],
          ['Days to the fest', left],
          ['Registered today', stats.registered],
          ['Registered by the fest, at this pace', projected],
        ],
      }}
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl p-4" style={{ background: 'var(--cs-surface-2)' }}>
          <div className="ink-2 text-[0.8rem]">Passes a day</div>
          <div className="mt-1 text-[1.8rem] font-semibold leading-none">{perDayText}</div>
          <div className="ink-3 mt-1.5 text-[0.74rem]">average, last 7 days</div>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--cs-surface-2)' }}>
          <div className="ink-2 text-[0.8rem]">Days to go</div>
          <div className="mt-1 text-[1.8rem] font-semibold leading-none">{left}</div>
          <div className="ink-3 mt-1.5 text-[0.74rem]">until the fest opens</div>
        </div>
      </div>
      <div className="mt-4 rounded-xl px-4 py-3" style={{ background: 'var(--cs-attn-bg)', border: '1px solid var(--cs-attn-line)' }}>
        <div className="ink-2 text-[0.8rem]">Registered by the fest, at this pace</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-[1.6rem] font-semibold leading-none">{left > 0 ? projected : stats.registered}</span>
          <span className="ink-3 text-[0.76rem]">{left > 0 ? `from ${stats.registered} today` : 'the fest has started'}</span>
        </div>
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ *
 * Simple split bars (gender, year, events)
 * ------------------------------------------------------------------ */

export function SplitBars({
  title,
  definition,
  rows,
  empty,
  unit = 'people',
}: {
  title: string
  definition: string
  rows: { label: string; n: number }[]
  empty: string
  unit?: string
}) {
  const max = Math.max(1, ...rows.map((r) => r.n))
  const total = rows.reduce((s, r) => s + r.n, 0)
  return (
    <Card
      title={title}
      definition={definition}
      table={{ columns: ['Group', unit === 'people' ? 'People' : 'Entries', 'Share'], numeric: [1, 2], rows: rows.map((r) => [r.label, r.n, `${pct(r.n, total)}%`]) }}
    >
      {rows.length === 0 ? (
        <p className="ink-3 text-[0.82rem]">{empty}</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r) => (
            <li key={r.label}>
              <div className="flex items-baseline justify-between gap-3 text-[0.82rem]">
                <span className="ink-2 min-w-0 truncate">{r.label}</span>
                <span className="flex shrink-0 items-baseline gap-2">
                  <strong className="num">{r.n}</strong>
                  <span className="ink-3 num w-9 text-right text-[0.72rem]">{pct(r.n, total)}%</span>
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-[4px]" style={{ background: 'var(--cs-track)' }}>
                <div className="h-full rounded-[4px]" style={{ width: `${(r.n / max) * 100}%`, background: 'var(--cs-bar)' }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/* ------------------------------------------------------------------ *
 * Recent payments
 * ------------------------------------------------------------------ */

export function Recent({ recent }: { recent: AdminStats['recent'] }) {
  const what = (r: AdminStats['recent'][number]) =>
    r.kind === 'event' ? 'Event entry' : r.products.includes('delegate') ? (r.products.includes('basic') ? 'Basic + Festival Pass' : 'Festival Pass') : 'Basic Registration'

  return (
    <Card title="Latest payments" definition="The most recent successful payments, newest first.">
      {recent.length === 0 ? (
        <p className="ink-3 text-[0.82rem]">Nothing yet. The first payment will appear here.</p>
      ) : (
        <ul className="divide-y" style={{ borderColor: 'var(--cs-hair)' }}>
          {recent.map((r, i) => (
            <li key={`${r.publicCode}-${i}`} className="flex items-center justify-between gap-3 py-2.5 text-[0.84rem]" style={{ borderColor: 'var(--cs-hair)' }}>
              <div className="min-w-0">
                <div className="truncate">{r.name || <span className="ink-3">Name not given</span>}</div>
                <div className="ink-3 text-[0.72rem]">{what(r)}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="num font-medium">{inr(r.amountPaise)}</div>
                <div className="ink-3 text-[0.72rem]">{ago(r.paidAt)}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/** Exported for the axis helpers used by the page header. */
export { istToday, inrShort }
