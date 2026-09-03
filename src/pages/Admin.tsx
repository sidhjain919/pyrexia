import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Download,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
} from 'lucide-react'

import { ApiError, api, downloadFile, type AdminRow, type AdminStats } from '../api/client'
import {
  Composition,
  Funnel,
  Hero,
  HourChart,
  KpiStrip,
  Momentum,
  Pace,
  Payments,
  Recent,
  SplitBars,
  TrendChart,
  inr,
  istToday,
} from '../admin/charts'
import NoticeComposer from '../admin/NoticeComposer'

/**
 * The admin dashboard: the ship's instrument panel.
 *
 * Read top to bottom in the order a committee member actually needs it:
 * anything that needs a hand today, then the money, then whether the campaign
 * is gaining or losing pace, then who is coming (for beds and buses), and last
 * the searchable list of people and the printable sheets.
 *
 * Every figure has a sentence under it saying exactly what it counts. Nothing
 * here is decorative: if a number cannot be explained in one line it is not on
 * the page.
 *
 * The page is not the security boundary: every endpoint behind it checks the
 * admins table itself, and typing this URL as a stranger gets you nothing. The
 * gate here exists so that a person who isn't an admin sees a sentence instead
 * of a broken screen.
 */

/** People per page in the searchable list; "Load more" fetches the next block. */
const PAGE = 50

/** First day of the fest, an IST calendar date. Keep in step with data/site.ts. */
const FEST_START = '2026-10-12'

function daysToFest(): number {
  const [y, m, d] = istToday().split('-').map(Number)
  const [fy, fm, fd] = FEST_START.split('-').map(Number)
  return Math.round((Date.UTC(fy, fm - 1, fd) - Date.UTC(y, m - 1, d)) / 86400000)
}

export default function Admin() {
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<AdminRow[]>([])
  const [total, setTotal] = useState(0)
  const [searching, setSearching] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const [busyExport, setBusyExport] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loadStats = useCallback(async () => {
    setRefreshing(true)
    try {
      setStats(await api.adminStats())
      setUpdatedAt(new Date())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the dashboard.')
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        await api.adminMe()
        setAllowed(true)
        await loadStats()
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          setAllowed(false)
          return
        }
        setAllowed(true)
        setError(err instanceof ApiError ? err.message : 'Could not load the dashboard.')
      }
    })()
  }, [loadStats])

  // First page for a query: replaces whatever was shown.
  const search = useCallback(async (q: string) => {
    setSearching(true)
    try {
      const res = await api.adminRegistrations({ q, limit: PAGE, offset: 0 })
      setRows(res.rows)
      setTotal(res.total)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Search failed.')
    } finally {
      setSearching(false)
    }
  }, [])

  // Next page: appended, so you can walk the whole list without narrowing.
  const loadMore = useCallback(async () => {
    setLoadingMore(true)
    try {
      const res = await api.adminRegistrations({ q: query, limit: PAGE, offset: rows.length })
      setRows((prev) => [...prev, ...res.rows])
      setTotal(res.total)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load more.')
    } finally {
      setLoadingMore(false)
    }
  }, [query, rows.length])

  useEffect(() => {
    // Debounced, because this fires on every keystroke and each one is a
    // database query behind a network hop.
    const timer = setTimeout(() => void search(query), query ? 300 : 0)
    return () => clearTimeout(timer)
  }, [query, search])

  const exportSheet = async (path: string, filename: string, label: string) => {
    setBusyExport(label)
    setNotice(null)
    try {
      await downloadFile(path, filename)
      setNotice(`${label} downloaded.`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That download failed.')
    } finally {
      setBusyExport(null)
    }
  }

  const resend = async (row: AdminRow) => {
    setNotice(null)
    try {
      await api.adminResend(row.id)
      setNotice(`Pass email sent again to ${row.email}.`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not resend.')
    }
  }

  /* ---------- gates ---------- */

  if (allowed === null) {
    return (
      <Shell>
        <div className="flex items-center gap-3 text-parchment/60">
          <Loader2 size={16} className="animate-spin" />
          Loading the dashboard…
        </div>
      </Shell>
    )
  }

  if (!allowed) {
    return (
      <Shell>
        <div className="max-w-md rounded-xl border border-gold/15 bg-navy/45 p-6">
          <ShieldAlert size={20} className="text-ember" />
          <h1 className="mt-3 font-display text-2xl text-offwhite">Crew only</h1>
          <p className="mt-2 text-[0.9rem] leading-relaxed text-parchment/60">
            This page is for the organising team. If you should have access, sign
            in with the address that was added as an admin.
          </p>
          <Link
            to="/sign-in?next=/admin"
            className="mt-5 inline-block rounded-full bg-gradient-to-b from-gold-bright to-gold-deep px-5 py-2.5 font-log text-[0.66rem] uppercase tracking-wide2 text-abyss"
          >
            Sign in
          </Link>
        </div>
      </Shell>
    )
  }

  /* ---------- the dashboard ---------- */

  const days = daysToFest()
  const alerts =
    stats && stats.stuckPayments > 0
      ? [
          {
            Icon: AlertTriangle,
            text: `${stats.stuckPayments} payment${stats.stuckPayments === 1 ? '' : 's'} started over thirty minutes ago and never finished. The sweep retries every fifteen minutes; if this stays, check Razorpay.`,
          },
        ]
      : []

  return (
    <Shell>
      <div className="console">
        {/* Header: the only place the brand face appears on this page. */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[0.8rem] ink-3">PYREXIA 2026</div>
            <h1 className="mt-1 font-display text-3xl text-offwhite sm:text-4xl">Ship’s log</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl px-4 py-2 text-right" style={{ background: 'var(--cs-surface)', border: '1px solid var(--cs-hair)' }}>
              <div className="text-[0.72rem] ink-3">{days > 0 ? 'Days to the fest' : days === 0 ? 'The fest is' : 'The fest was'}</div>
              <div className="text-[1.25rem] font-semibold leading-none">
                {days > 0 ? days : days === 0 ? 'today' : `${-days} days ago`}
              </div>
            </div>
            <button
              onClick={() => void loadStats()}
              disabled={refreshing}
              className="ghost inline-flex items-center gap-2 disabled:opacity-60"
              title={updatedAt ? `Updated ${updatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : undefined}
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              {updatedAt ? `Updated ${updatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Refresh'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-6 flex items-start gap-2 rounded-lg border border-coral/50 bg-coral/10 p-3 text-[0.85rem] text-coral">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {notice && (
          <div className="mt-6 rounded-lg border border-aqua/40 bg-aqua/10 p-3 text-[0.85rem] text-aqua">
            {notice}
          </div>
        )}

        {stats && (
          <div className={`transition-opacity ${refreshing ? 'opacity-70' : ''}`}>
            {/* Needs a hand today. Absent on a healthy day rather than reading zero. */}
            {alerts.length > 0 && (
              <ul className="mt-6 space-y-2">
                {alerts.map(({ Icon, text }) => (
                  <li key={text} className="flex items-start gap-3 rounded-xl px-4 py-3 text-[0.85rem]" style={{ background: 'var(--cs-attn-bg)', border: '1px solid var(--cs-attn-line)' }}>
                    <Icon size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--cs-festival)' }} />
                    <span className="ink-2">{text}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* The money. */}
            <div className="mt-6 grid gap-4 lg:grid-cols-5">
              <div className="lg:col-span-3"><Hero stats={stats} /></div>
              <div className="lg:col-span-2"><Composition stats={stats} /></div>
            </div>

            {/* The headline counts. */}
            <div className="mt-4">
              <KpiStrip
                items={[
                  { label: 'Registered', value: stats.registered, note: 'Paid the ₹500 Basic Registration' },
                  { label: 'Festival Pass', value: stats.delegates, note: `${stats.basicOnly} of the registered are on Basic only` },
                  { label: 'Accounts', value: stats.accounts, note: `${Math.max(0, stats.accounts - stats.registered)} have not paid yet` },
                  { label: 'Signed in today', value: stats.signedInToday, note: 'People who opened the site while signed in' },
                  { label: 'Event entries', value: stats.eventEntries, note: 'Confirmed entries across all events' },
                ]}
              />
            </div>

            {/* Pace. */}
            <div className="mt-4"><TrendChart stats={stats} /></div>

            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <Funnel funnel={stats.funnel} />
              <Momentum momentum={stats.momentum} />
              <HourChart hourly={stats.hourly} />
            </div>

            {/* Health and the desk. */}
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <Payments payments={stats.payments} />
              <Pace stats={stats} days={days} />
              <Recent recent={stats.recent} />
            </div>

            {/* Who is coming, for beds and buses. */}
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <SplitBars
                title="Gender"
                definition="Registered students by the gender they gave. Collected for accommodation allocation."
                rows={stats.gender}
                empty="Nobody has registered yet."
              />
              <SplitBars
                title="Year of study"
                definition="Registered students by year. Useful for pitching events and picking judges."
                rows={stats.years}
                empty="Nobody has registered yet."
              />
              <SplitBars
                title="Events"
                definition="Confirmed entries per event, most popular first."
                rows={stats.topEvents.map((e) => ({ label: e.event_name, n: e.n }))}
                empty="Event entry has not opened yet."
                unit="entries"
              />
            </div>
          </div>
        )}

        {/* ---------- downloads ---------- */}

        <div className="mt-10">
          <h2 className="text-[1.15rem] font-semibold">Downloads</h2>
          <p className="ink-3 mt-1 text-[0.82rem]">
            Three Excel workbooks. Registrations has two tabs: every login, then everyone who paid with
            what they entered on the form. Each sheet is stamped with the time it was made, so a list
            printed this morning is not mistaken for this afternoon’s.
          </p>

          <div className="mt-4 flex flex-wrap gap-2.5">
            {[
              ['Registrations', '/api/admin/export/registrations', 'registrations'],
              ['Payments', '/api/admin/export/payments', 'payments'],
              ['Events', '/api/admin/export/events', 'events'],
            ].map(([label, path, file]) => (
              <button
                key={label}
                onClick={() => void exportSheet(path, `pyrexia-${file}.xlsx`, label)}
                disabled={busyExport !== null}
                className="ghost inline-flex items-center gap-2 disabled:opacity-50"
              >
                {busyExport === label ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                {label}
              </button>
            ))}
          </div>
        </div>

        <NoticeComposer onError={setError} />

        {/* ---------- people ---------- */}

        <div className="mt-10">
          <h2 className="text-[1.15rem] font-semibold">People</h2>
          <p className="ink-3 mt-1 text-[0.82rem]">
            Everyone with an account, newest first. Search by name, email, mobile, college or registration number.
          </p>

          <div className="relative mt-4">
            <Search size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 ink-3" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people"
              aria-label="Search people"
              className="w-full rounded-full py-3 pl-11 pr-4 text-[0.9rem] outline-none placeholder:text-[color:var(--cs-ink-3)] focus:border-gold/50"
              style={{ background: 'var(--cs-surface)', border: '1px solid var(--cs-hair)', color: 'var(--cs-ink)' }}
            />
            {searching && <Loader2 size={15} className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin ink-3" />}
          </div>

          <div className="ink-3 mt-2 text-[0.76rem]">
            {total} {total === 1 ? 'person' : 'people'}{query && ' match'}
          </div>

          {/* A table this wide scrolls inside its own box rather than pushing
              the whole page sideways on a phone. */}
          <div className="card mt-4 overflow-x-auto">
            <table className="data w-full min-w-[46rem]">
              <thead>
                <tr>
                  {['Registration no', 'Name', 'Contact', 'College', 'Status', 'Paid', ''].map((h, i) => (
                    <th key={h || 'actions'} className={i === 5 ? 'n' : ''}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && !searching && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center">
                      {query ? 'Nobody matches that.' : 'No accounts yet.'}
                    </td>
                  </tr>
                )}

                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="num" style={{ color: 'var(--cs-ink)' }}>{row.publicCode}</td>
                    <td style={{ color: 'var(--cs-ink)' }}>
                      {row.name || <span className="ink-3">Not given</span>}
                    </td>
                    <td>
                      <div className="truncate">{row.email}</div>
                      {row.phone && <div className="num ink-3 text-[0.76rem]">{row.phone}</div>}
                    </td>
                    <td className="max-w-[14rem] truncate">
                      {row.college || <span className="ink-3">Not given</span>}
                    </td>
                    <td>
                      {/* Three real states, not two. Someone who only made an
                          account holds nothing, and calling that "Basic" was the
                          misleading thing this fixes. */}
                      {!row.registered ? (
                        <span className="ink-3 text-[0.78rem]">Not registered</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[0.78rem]" style={{ color: 'var(--cs-ink)' }}>
                          <span className="inline-block h-2 w-2 rounded-full" style={{ background: row.tier === 1 ? 'var(--cs-festival)' : 'var(--cs-basic)' }} />
                          {row.tier === 1 ? 'Festival Pass' : 'Basic'}
                        </span>
                      )}
                    </td>
                    <td className="n num">
                      {row.paidPaise > 0 ? inr(row.paidPaise) : <span className="ink-3">—</span>}
                    </td>
                    <td className="text-right">
                      {row.registered && (
                        <button onClick={() => void resend(row)} className="ghost !py-1 !text-[0.7rem]">
                          Resend pass
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {total > rows.length && (
            <div className="mt-4 flex justify-center">
              <button onClick={() => void loadMore()} disabled={loadingMore} className="ghost inline-flex items-center gap-2 disabled:opacity-50">
                {loadingMore && <Loader2 size={13} className="animate-spin" />}
                Load more ({rows.length} of {total})
              </button>
            </div>
          )}
        </div>
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section className="mx-auto min-h-[80svh] max-w-6xl px-5 pb-24 pt-[calc(var(--header-h,7rem)+2rem)] sm:px-8">{children}</section>
  )
}
