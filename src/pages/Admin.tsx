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

import { ApiError, api, downloadCsv, type AdminRow, type AdminStats } from '../api/client'
import { DailyBars, MoneyPanel, RankedBars, StatTile } from '../admin/charts'
import NoticeComposer from '../admin/NoticeComposer'

/**
 * The admin dashboard.
 *
 * This is scanned rather than read, so the order is by urgency and not by
 * importance in the abstract: anything wrong first, then the money, then the
 * shape of who is coming, then the searchable list of people.
 *
 * The page is not the security boundary: every endpoint behind it checks the
 * admins table itself, and typing this URL as a stranger gets you nothing. The
 * gate here exists so that a person who isn't an admin sees a sentence instead
 * of a broken screen.
 */

export default function Admin() {
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<AdminRow[]>([])
  const [total, setTotal] = useState(0)
  const [searching, setSearching] = useState(false)

  const [busyExport, setBusyExport] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        await api.adminMe()
        setAllowed(true)
        setStats(await api.adminStats())
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          setAllowed(false)
          return
        }
        setAllowed(true)
        setError(err instanceof ApiError ? err.message : 'Could not load the dashboard.')
      }
    })()
  }, [])

  const search = useCallback(async (q: string) => {
    setSearching(true)
    try {
      const res = await api.adminRegistrations({ q, limit: 25 })
      setRows(res.rows)
      setTotal(res.total)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Search failed.')
    } finally {
      setSearching(false)
    }
  }, [])

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
      await downloadCsv(path, filename)
      setNotice(`${label} downloaded.`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That export failed.')
    } finally {
      setBusyExport(null)
    }
  }

  const resend = async (row: AdminRow) => {
    setNotice(null)
    try {
      await api.adminResend(row.id)
      setNotice(`Pass email resent to ${row.email}.`)
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

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-log text-[0.6rem] uppercase tracking-cinema text-gold/70">
            PYREXIA 2026
          </div>
          <h1 className="mt-2 font-display text-3xl text-offwhite sm:text-4xl">Ship’s log</h1>
        </div>
        <button
          onClick={() => void (async () => setStats(await api.adminStats()))()}
          className="flex items-center gap-2 rounded-full border border-gold/25 px-4 py-2 font-log text-[0.62rem] uppercase tracking-wide2 text-parchment/70 transition-colors hover:border-gold/50 hover:text-gold-bright"
        >
          <RefreshCw size={13} />
          Refresh
        </button>
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
        <>
          {/* Anything broken goes above everything else. It is absent on a
              healthy day rather than sitting there permanently reading zero. */}
          {stats.stuckPayments > 0 && (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-ember/40 bg-ember/10 p-4">
              <AlertTriangle size={17} className="mt-0.5 shrink-0 text-ember" />
              <div>
                <div className="font-log text-[0.62rem] uppercase tracking-wide2 text-ember">
                  {stats.stuckPayments} payment{stats.stuckPayments === 1 ? '' : 's'} unresolved
                </div>
                <p className="mt-1 text-[0.85rem] leading-relaxed text-parchment/65">
                  Started over thirty minutes ago and never finished. The
                  reconciliation sweep retries these every fifteen minutes; if a
                  number sits here for hours, check the Razorpay dashboard.
                </p>
              </div>
            </div>
          )}

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
            <MoneyPanel
              collectedPaise={stats.collectedPaise}
              feesPaise={stats.feesPaise}
              netPaise={stats.netPaise}
            />
            <DailyBars daily={stats.daily} />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Registered"
              value={stats.registered}
              hint="Paid Basic Registration"
              tone="good"
            />
            <StatTile
              label="Festival Passes"
              value={stats.delegates}
              hint="Full programme access"
            />
            <StatTile
              label="Accounts"
              value={stats.accounts}
              hint={`${stats.accounts - stats.registered} yet to pay`}
            />
            <StatTile
              label="Event entries"
              value={stats.eventEntries}
              hint="Across all events"
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <RankedBars
              title="Colleges"
              empty="No colleges yet. This fills in as people register."
              rows={stats.colleges.map((c) => ({ label: c.college, n: c.n }))}
            />
            <RankedBars
              title="Events"
              empty="Event registration hasn’t opened yet."
              rows={stats.topEvents.map((e) => ({ label: e.event_name, n: e.n }))}
            />
          </div>
        </>
      )}

      {/* ---------- exports ---------- */}

      <div className="mt-10">
        <h2 className="font-display text-xl text-offwhite">Print-outs</h2>
        <p className="mt-1.5 text-[0.85rem] text-parchment/50">
          Every sheet carries the time it was made, because a list printed this
          morning won’t have this afternoon’s arrivals on it.
        </p>

        <div className="mt-4 flex flex-wrap gap-2.5">
          {[
            ['Everyone', '/api/admin/export/registrations', 'registrations'],
            ['Delegates', '/api/admin/export/delegates', 'delegates'],
            ['Payments', '/api/admin/export/payments', 'payments'],
          ].map(([label, path, file]) => (
            <button
              key={label}
              onClick={() => void exportSheet(path, `pyrexia-${file}.csv`, label)}
              disabled={busyExport !== null}
              className="flex items-center gap-2 rounded-full border border-gold/25 px-4 py-2.5 font-log text-[0.62rem] uppercase tracking-wide2 text-parchment/75 transition-colors hover:border-gold/50 hover:text-gold-bright disabled:opacity-50"
            >
              {busyExport === label ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Download size={13} />
              )}
              {label}
            </button>
          ))}
        </div>
      </div>

      <NoticeComposer onError={setError} />

      {/* ---------- people ---------- */}

      <div className="mt-10">
        <h2 className="font-display text-xl text-offwhite">People</h2>

        <div className="relative mt-4">
          <Search
            size={15}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-parchment/35"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, email, mobile, college or registration number"
            className="w-full rounded-full border border-gold/20 bg-navy/40 py-3 pl-11 pr-4 text-[0.9rem] text-offwhite placeholder:text-parchment/30 focus:border-gold/50 focus:outline-none"
          />
          {searching && (
            <Loader2
              size={15}
              className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-parchment/40"
            />
          )}
        </div>

        <div className="mt-2 font-log text-[0.58rem] uppercase tracking-wide2 text-parchment/35">
          {total} {total === 1 ? 'person' : 'people'}
          {query && ' matching'}
        </div>

        {/* A table this wide scrolls inside its own box rather than pushing
            the whole page sideways on a phone. */}
        <div className="mt-4 overflow-x-auto rounded-xl border border-gold/12">
          <table className="w-full min-w-[46rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-gold/12 bg-navy/60">
                {['Reg. no', 'Name', 'Contact', 'College', 'Tier', 'Paid', ''].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 font-log text-[0.55rem] uppercase tracking-wide2 text-parchment/40"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !searching && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[0.88rem] text-parchment/45">
                    {query ? 'Nobody matches that.' : 'No registrations yet.'}
                  </td>
                </tr>
              )}

              {rows.map((row) => (
                <tr key={row.id} className="border-b border-gold/8 last:border-0">
                  <td className="px-4 py-3 font-log text-[0.68rem] tabular-nums text-gold-bright">
                    {row.publicCode}
                  </td>
                  <td className="px-4 py-3 text-[0.88rem] text-offwhite">
                    {row.name || <span className="text-parchment/35">not given</span>}
                  </td>
                  <td className="px-4 py-3 text-[0.82rem] text-parchment/65">
                    <div className="truncate">{row.email}</div>
                    {row.phone && <div className="tabular-nums text-parchment/45">{row.phone}</div>}
                  </td>
                  <td className="max-w-[14rem] truncate px-4 py-3 text-[0.82rem] text-parchment/65">
                    {row.college || <span className="text-parchment/35">not given</span>}
                  </td>
                  <td className="px-4 py-3">
                    {/* The word, not just a colour: a tier you can only see
                        by hue is no use to half the team. */}
                    <span
                      className={`rounded-full px-2.5 py-1 font-log text-[0.55rem] uppercase tracking-wide2 ${
                        row.tier === 1
                          ? 'bg-gold/15 text-gold-bright'
                          : 'bg-parchment/8 text-parchment/60'
                      }`}
                    >
                      {row.tier === 1 ? 'Festival Pass' : 'Basic'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[0.85rem] tabular-nums text-parchment/75">
                    ₹{(row.paidPaise / 100).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => void resend(row)}
                      className="font-log text-[0.55rem] uppercase tracking-wide2 text-parchment/45 transition-colors hover:text-gold-bright"
                    >
                      Resend pass
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {total > rows.length && (
          <p className="mt-3 text-[0.8rem] text-parchment/40">
            Showing the first {rows.length}. Narrow the search, or download the
            full sheet above.
          </p>
        )}
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section className="mx-auto min-h-[80svh] max-w-6xl px-5 pb-24 pt-[calc(var(--header-h,7rem)+2rem)] sm:px-8">{children}</section>
  )
}
