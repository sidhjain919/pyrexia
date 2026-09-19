import { useCallback, useEffect, useState } from 'react'
import { BookOpen, ChevronDown, ExternalLink, Loader2, Lock, LockOpen } from 'lucide-react'

import { ApiError, api, type OpeningRow } from '../api/client'
import { refreshOpenings } from '../registration/useOpenings'
import { territories } from '../data/events'
import { asset } from '../lib/asset'

/**
 * The registration switchboard.
 *
 * One card per vertical with a master switch, and under it a switch for every
 * event. Opening entries used to mean editing a constant and waiting for a
 * deploy, which is fine on a Tuesday afternoon and useless at nine in the
 * evening when a coordinator has just signed off their rulebook. Every flip is
 * written to the audit log with who did it, so the accountability the commit
 * was really providing is still there.
 *
 * The two layers exist because they answer different questions. The master
 * switch is "is Velocity taking entries", and closing it shuts eleven sports at
 * once. An event's own switch is "is women's doubles full", and closing it shuts
 * that one card and leaves the ten beside it alone. An event is open only
 * when both say so, which the card makes visible: a shut vertical greys its
 * whole list.
 */
export default function OpeningsBoard({ onError }: { onError: (msg: string) => void }) {
  const [rows, setRows] = useState<OpeningRow[] | null>(null)
  /** The vertical id, or the event name, currently being flipped. */
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  /** Which cards have their event list unfolded. */
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    try {
      const res = await api.adminOpenings()
      setRows(res.territories)
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Could not load the registration switches.')
    }
  }, [onError])

  useEffect(() => {
    void load()
  }, [load])

  const toggleTerritory = async (row: OpeningRow) => {
    const next = !row.open
    setBusy(row.id)
    setNote(null)
    // Moved before the request answers, then corrected from the reload: a
    // switch that does nothing for half a second gets pressed twice.
    setRows((prev) => prev?.map((r) => (r.id === row.id ? { ...r, open: next } : r)) ?? prev)
    try {
      await api.adminSetOpening({ territoryId: row.id }, next)
      setNote(
        next
          ? `${row.code} is open. Its ${row.events} event${row.events === 1 ? '' : 's'} are taking entries now.`
          : `${row.code} is closed. Its cards read "Coming Soon" again.`,
      )
      // The public grid caches this answer for the page's lifetime, so drop it.
      refreshOpenings()
      await load()
    } catch (err) {
      setRows((prev) => prev?.map((r) => (r.id === row.id ? { ...r, open: row.open } : r)) ?? prev)
      onError(err instanceof ApiError ? err.message : 'Could not change that.')
    } finally {
      setBusy(null)
    }
  }

  const toggleEvent = async (row: OpeningRow, eventName: string, current: boolean) => {
    const next = !current
    setBusy(eventName)
    setNote(null)
    const patch = (open: boolean) => (prev: OpeningRow[] | null) =>
      prev?.map((r) =>
        r.id === row.id
          ? { ...r, eventList: r.eventList.map((e) => (e.name === eventName ? { ...e, open } : e)) }
          : r,
      ) ?? prev
    setRows(patch(next))
    try {
      await api.adminSetOpening({ eventName }, next)
      setNote(
        next
          ? `${eventName} is open again.`
          : `${eventName} is closed. Its card reads "Coming Soon"; the rest of ${row.code} is unaffected.`,
      )
      refreshOpenings()
      await load()
    } catch (err) {
      setRows(patch(current))
      onError(err instanceof ApiError ? err.message : 'Could not change that.')
    } finally {
      setBusy(null)
    }
  }

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const openCount = rows?.filter((r) => r.open).length ?? 0
  const closedEvents = rows?.reduce((n, r) => n + r.eventList.filter((e) => !e.open).length, 0) ?? 0

  return (
    <div className="mt-10">
      <h2 className="text-[1.15rem] font-semibold">Registration switches</h2>
      <p className="ink-3 mt-1 text-[0.82rem]">
        A master switch per vertical, and one for every event under it. Open a vertical and every
        event under it starts taking entries on the site immediately; close a single event and only
        that card reads “Coming Soon”. Entries already paid for are never affected: closing only
        stops new ones. Every change is logged against your name.
      </p>

      {note && (
        <div className="mt-4 rounded-lg border border-aqua/40 bg-aqua/10 p-3 text-[0.85rem] text-aqua">
          {note}
        </div>
      )}

      {rows === null ? (
        <div className="ink-3 mt-4 flex items-center gap-2 text-[0.85rem]">
          <Loader2 size={14} className="animate-spin" /> Loading the switches…
        </div>
      ) : (
        <>
          <div className="ink-3 mt-4 text-[0.76rem]">
            {openCount} of {rows.length} verticals open
            {closedEvents > 0 && ` · ${closedEvents} event${closedEvents === 1 ? '' : 's'} closed individually`}
          </div>

          <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((row) => {
              const rulebook = territories.find((t) => t.id === row.id)?.rulebook
              const working = busy === row.id
              const unfolded = expanded.has(row.id)
              const shut = row.eventList.filter((e) => !e.open).length
              return (
                <div key={row.id} className="card flex flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[0.98rem] font-semibold" style={{ color: 'var(--cs-ink)' }}>
                        {row.code}
                      </div>
                      <div className="ink-3 truncate text-[0.76rem]">{row.subtitle}</div>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2.5 py-1 text-[0.68rem] uppercase tracking-wide"
                      style={{
                        background: row.open ? 'var(--cs-attn-bg)' : 'transparent',
                        border: `1px solid ${row.open ? 'var(--cs-attn-line)' : 'var(--cs-hair)'}`,
                        color: row.open ? 'var(--cs-festival)' : 'var(--cs-ink-3)',
                      }}
                    >
                      {row.open ? 'Open' : 'Closed'}
                    </span>
                  </div>

                  <div className="ink-3 text-[0.74rem]">
                    {row.events} event{row.events === 1 ? '' : 's'}
                    {shut > 0 && row.open && ` · ${shut} closed`}
                    {row.updatedAt && (
                      <>
                        {' · '}
                        {row.open ? 'opened' : 'closed'} {shortDate(row.updatedAt)}
                        {row.updatedBy && !row.updatedBy.startsWith('migration:') && ` by ${row.updatedBy}`}
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void toggleTerritory(row)}
                      disabled={working}
                      aria-pressed={row.open}
                      className="ghost inline-flex flex-1 items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {working ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : row.open ? (
                        <Lock size={13} />
                      ) : (
                        <LockOpen size={13} />
                      )}
                      {row.open ? 'Close all' : 'Open all'}
                    </button>

                    {rulebook && (
                      <a
                        href={asset(`rulebooks/${rulebook}`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`${row.code} rulebook (PDF)`}
                        className="ghost inline-flex items-center gap-1.5"
                      >
                        <BookOpen size={13} />
                      </a>
                    )}
                    <a
                      href={`${import.meta.env.BASE_URL}#events`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Open the ${row.code} entry forms as a visitor sees them`}
                      className="ghost inline-flex items-center gap-1.5"
                    >
                      <ExternalLink size={13} />
                    </a>
                  </div>

                  {/* The per-event switches, folded by default: eleven verticals
                      of seventy switches is a wall, and the master switch is
                      what most visits are for. */}
                  <button
                    onClick={() => toggleExpanded(row.id)}
                    aria-expanded={unfolded}
                    className="ink-3 -mb-1 inline-flex items-center gap-1.5 self-start text-[0.74rem] hover:underline"
                  >
                    <ChevronDown
                      size={13}
                      className={`transition-transform ${unfolded ? 'rotate-180' : ''}`}
                    />
                    {unfolded ? 'Hide' : 'Show'} the {row.events} event{row.events === 1 ? '' : 's'}
                  </button>

                  {unfolded && (
                    <ul
                      className="divide-y"
                      style={{ borderTop: '1px solid var(--cs-hair)', opacity: row.open ? 1 : 0.5 }}
                    >
                      {row.eventList.map((e) => {
                        const flipping = busy === e.name
                        return (
                          <li
                            key={e.name}
                            className="flex items-center justify-between gap-3 py-2"
                            style={{ borderColor: 'var(--cs-hair)' }}
                          >
                            <div className="min-w-0">
                              <div className="truncate text-[0.84rem]" style={{ color: 'var(--cs-ink)' }}>
                                {e.name}
                              </div>
                              {e.updatedAt && (
                                <div className="ink-3 truncate text-[0.68rem]">
                                  {e.open ? 'opened' : 'closed'} {shortDate(e.updatedAt)}
                                  {e.updatedBy && ` by ${e.updatedBy}`}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => void toggleEvent(row, e.name, e.open)}
                              disabled={flipping || !row.open}
                              aria-pressed={e.open}
                              title={
                                !row.open
                                  ? `Open ${row.code} first`
                                  : e.open
                                    ? `Close ${e.name}`
                                    : `Open ${e.name}`
                              }
                              className="ghost inline-flex shrink-0 items-center gap-1.5 !py-1 !text-[0.7rem] disabled:opacity-40"
                            >
                              {flipping ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : e.open ? (
                                <Lock size={12} />
                              ) : (
                                <LockOpen size={12} />
                              )}
                              {e.open ? 'Close' : 'Open'}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

/** "9 Sep, 21:40" in IST, which is the only clock the committee is reading. */
function shortDate(sqlUtc: string): string {
  const d = new Date(sqlUtc.replace(' ', 'T') + 'Z')
  if (Number.isNaN(d.getTime())) return sqlUtc
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
