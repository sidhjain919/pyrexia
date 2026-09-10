import { useCallback, useEffect, useState } from 'react'
import { BookOpen, ExternalLink, Loader2, Lock, LockOpen } from 'lucide-react'

import { ApiError, api, type OpeningRow } from '../api/client'
import { refreshOpenings } from '../registration/useOpenings'
import { territories } from '../data/events'
import { asset } from '../lib/asset'

/**
 * The registration switchboard.
 *
 * One row per vertical, one switch each. Opening entries used to mean editing
 * a constant and waiting for a deploy, which is fine on a Tuesday afternoon
 * and useless at nine in the evening when a coordinator has just signed off
 * their rulebook. Every flip is written to the audit log with who did it, so
 * the accountability the commit was really providing is still there.
 *
 * Closing is the same switch, and matters just as much: a category that has
 * filled up, or one that needs to pause while a fixture is re-drawn, goes back
 * to "Coming Soon" the moment somebody presses it.
 */
export default function OpeningsBoard({ onError }: { onError: (msg: string) => void }) {
  const [rows, setRows] = useState<OpeningRow[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

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

  const toggle = async (row: OpeningRow) => {
    const next = !row.open
    setBusy(row.id)
    setNote(null)
    // Moved before the request answers, then corrected from the reload: a
    // switch that does nothing for half a second gets pressed twice.
    setRows((prev) => prev?.map((r) => (r.id === row.id ? { ...r, open: next } : r)) ?? prev)
    try {
      await api.adminSetOpening(row.id, next)
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

  const openCount = rows?.filter((r) => r.open).length ?? 0

  return (
    <div className="mt-10">
      <h2 className="text-[1.15rem] font-semibold">Registration switches</h2>
      <p className="ink-3 mt-1 text-[0.82rem]">
        One switch per vertical. Open it and every event under it starts taking entries on the site
        immediately; close it and those cards go back to “Coming Soon”. Entries already paid for are
        never affected — closing only stops new ones. Every change is logged against your name.
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
          </div>

          <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((row) => {
              const rulebook = territories.find((t) => t.id === row.id)?.rulebook
              const working = busy === row.id
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
                    {row.updatedAt && (
                      <>
                        {' · '}
                        {row.open ? 'opened' : 'closed'} {shortDate(row.updatedAt)}
                        {row.updatedBy && !row.updatedBy.startsWith('migration:') && ` by ${row.updatedBy}`}
                      </>
                    )}
                  </div>

                  <div className="mt-auto flex items-center gap-2">
                    <button
                      onClick={() => void toggle(row)}
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
                      {row.open ? 'Close entries' : 'Open entries'}
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
