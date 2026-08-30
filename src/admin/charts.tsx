/**
 * The small charts on the admin page.
 *
 * Design decisions worth stating, because they are easy to undo by accident:
 *
 * **One hue, not many.** Every chart here shows a single series, sign-ups per
 * day, entries per event. A single series needs no legend and no categorical
 * palette; the title names it. Gold carries magnitude, light for the peak and
 * dimmer below it, so the eye finds the biggest bar without reading a number.
 *
 * **Status colours are reserved.** Coral and ember mean something is wrong.
 * They are never used as a decorative series colour, or they stop meaning
 * anything when something actually breaks.
 *
 * **Text never wears the series colour.** Values and labels stay in parchment;
 * the bar beside them carries the identity. Coloured text on a coloured mark
 * is how a chart becomes unreadable for anyone who doesn't see the hue.
 *
 * No chart library: these are three shapes, and a dependency to draw a
 * rectangle would cost more than it saves.
 */

/* Gold ramp, dark to bright: the scale magnitude is read from. */
const GOLD_DIM = '#9e7427'
const GOLD_MID = '#c89b3c'
const GOLD_TOP = '#e6c25e'

/** Bars grow brighter towards the peak, so the maximum reads without a label. */
function shade(value: number, max: number): string {
  if (max <= 0) return GOLD_DIM
  const ratio = value / max
  return ratio > 0.85 ? GOLD_TOP : ratio > 0.45 ? GOLD_MID : GOLD_DIM
}

const inr = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

/* ------------------------------------------------------------------ *
 * Stat tile
 * ------------------------------------------------------------------ */

export function StatTile({
  label,
  value,
  hint,
  tone = 'normal',
}: {
  label: string
  value: string | number
  hint?: string
  tone?: 'normal' | 'good' | 'warn' | 'bad'
}) {
  // Tone changes the rule above the number, never the number itself, a
  // figure in alarm-red is hard to read and impossible for some people to
  // distinguish. The word in the hint carries the meaning.
  const rule =
    tone === 'bad'
      ? 'bg-coral'
      : tone === 'warn'
        ? 'bg-ember'
        : tone === 'good'
          ? 'bg-aqua'
          : 'bg-gold/40'

  return (
    <div className="rounded-xl border border-gold/12 bg-navy/45 p-4">
      <div className={`h-0.5 w-8 rounded-full ${rule}`} />
      <div className="mt-3 font-log text-[0.58rem] uppercase tracking-wide2 text-parchment/45">
        {label}
      </div>
      <div className="mt-1.5 font-display text-2xl tabular-nums text-offwhite sm:text-[1.75rem]">
        {value}
      </div>
      {hint && <div className="mt-1 text-[0.74rem] leading-snug text-parchment/45">{hint}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Money
 * ------------------------------------------------------------------ */

export function MoneyPanel({
  collectedPaise,
  feesPaise,
  netPaise,
}: {
  collectedPaise: number
  feesPaise: number
  netPaise: number
}) {
  return (
    <div className="rounded-xl border border-gold/15 bg-navy/45 p-5 sm:p-6">
      <div className="font-log text-[0.58rem] uppercase tracking-wide2 text-parchment/45">
        Collected
      </div>
      {/* A single headline number is a stat, not a chart, there is nothing
          here to compare it against. */}
      <div className="mt-2 font-display text-4xl tabular-nums text-gold-bright sm:text-5xl">
        {inr(collectedPaise)}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 border-t border-gold/10 pt-4">
        <div>
          <div className="font-log text-[0.55rem] uppercase tracking-wide2 text-parchment/40">
            Razorpay fees
          </div>
          <div className="mt-1 text-[0.95rem] tabular-nums text-parchment/75">
            −{inr(feesPaise)}
          </div>
        </div>
        <div>
          <div className="font-log text-[0.55rem] uppercase tracking-wide2 text-parchment/40">
            Reaches us
          </div>
          <div className="mt-1 text-[0.95rem] tabular-nums text-offwhite">{inr(netPaise)}</div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Registrations per day
 * ------------------------------------------------------------------ */

export function DailyBars({ daily }: { daily: { day: string; n: number }[] }) {
  // Days with no sign-ups have no row in the data, but a gap in a time series
  // has to be visible as a gap: otherwise a quiet Tuesday silently vanishes
  // and the shape of the fortnight is a lie.
  const days: { day: string; n: number }[] = []
  const today = new Date()
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    days.push({ day: key, n: daily.find((r) => r.day === key)?.n ?? 0 })
  }

  const max = Math.max(1, ...days.map((d) => d.n))
  const total = days.reduce((sum, d) => sum + d.n, 0)

  return (
    <div className="rounded-xl border border-gold/15 bg-navy/45 p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-lg text-offwhite">Registrations</h3>
        <span className="font-log text-[0.58rem] uppercase tracking-wide2 text-parchment/40">
          Last 14 days
        </span>
      </div>

      {total === 0 ? (
        <p className="mt-6 text-[0.85rem] text-parchment/45">
          Nobody has registered in the last fortnight.
        </p>
      ) : (
        <>
          {/* 2px gaps between bars, so adjacent columns never merge. */}
          <div className="mt-6 flex h-28 items-end gap-[2px]">
            {days.map((d) => (
              <div
                key={d.day}
                className="group relative flex-1"
                style={{ height: '100%' }}
                title={`${new Date(d.day).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                })} · ${d.n} registration${d.n === 1 ? '' : 's'}`}
              >
                <div className="absolute inset-x-0 bottom-0 top-0 flex items-end">
                  <div
                    // Anchored to the baseline with a rounded top only, a
                    // floating rounded pill misreads its own value.
                    className="w-full rounded-t transition-opacity group-hover:opacity-80"
                    style={{
                      // A zero day still shows a hairline, so it reads as a
                      // measured nothing rather than missing data.
                      height: d.n === 0 ? '2px' : `${Math.max(6, (d.n / max) * 100)}%`,
                      background: d.n === 0 ? 'rgba(232,213,174,0.14)' : shade(d.n, max),
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-2 flex justify-between font-log text-[0.55rem] uppercase tracking-wide2 text-parchment/35">
            <span>
              {new Date(days[0].day).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
              })}
            </span>
            <span className="tabular-nums text-parchment/55">{total} in total</span>
            <span>Today</span>
          </div>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Ranked lists
 * ------------------------------------------------------------------ */

export function RankedBars({
  title,
  empty,
  rows,
}: {
  title: string
  empty: string
  rows: { label: string; n: number }[]
}) {
  const max = Math.max(1, ...rows.map((r) => r.n))

  return (
    <div className="rounded-xl border border-gold/15 bg-navy/45 p-5 sm:p-6">
      <h3 className="font-display text-lg text-offwhite">{title}</h3>

      {rows.length === 0 ? (
        <p className="mt-5 text-[0.85rem] text-parchment/45">{empty}</p>
      ) : (
        <div className="mt-5 space-y-3">
          {rows.map((row) => (
            <div key={row.label}>
              <div className="flex items-baseline justify-between gap-3">
                {/* Long college names truncate rather than wrapping into two
                    lines and breaking the rhythm of the list. */}
                <span className="min-w-0 truncate text-[0.85rem] text-parchment/80">
                  {row.label}
                </span>
                <span className="shrink-0 text-[0.85rem] tabular-nums text-parchment/55">
                  {row.n}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-parchment/8">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(3, (row.n / max) * 100)}%`,
                    background: shade(row.n, max),
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
