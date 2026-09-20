import { useCallback, useEffect, useState } from 'react'
import { BedDouble, Loader2, Lock, LockOpen } from 'lucide-react'

import { ApiError, api, type AccommodationAdmin } from '../api/client'

/**
 * The accommodation desk, as the committee sees it.
 *
 * Three things, in the order they are asked for:
 *
 *   the switch    : are we taking bookings, and what do we say if not.
 *   occupancy     : how many people per room type, and the rooms that implies.
 *   the arrivals  : who lands on which day, for staffing check-in.
 *
 * Deliberately not a capacity model. Nothing here counts beds down to zero or
 * refuses the n+1th booking: how many rooms exist is negotiated with the
 * hospitality partners week to week and has never been a number this database
 * could know. The switch is the committee saying "we are full"; the occupancy
 * table is what tells them when to say it.
 *
 * The full rooming list lives in the Accommodation workbook rather than here.
 * A booking is read at a desk off a printed sheet, not off a phone.
 */
export default function AccommodationBoard({ onError }: { onError: (msg: string) => void }) {
  const [data, setData] = useState<AccommodationAdmin | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await api.adminAccommodation()
      setData(res)
      setNote(res.settings.note ?? '')
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Could not load the accommodation desk.')
    }
  }, [onError])

  useEffect(() => {
    void load()
  }, [load])

  const flip = async (open: boolean) => {
    setBusy(true)
    setSaved(null)
    try {
      await api.adminSetAccommodation(open, note.trim() || undefined)
      setSaved(
        open
          ? 'Bookings are open. The Harbour form is taking payments.'
          : 'Bookings are closed. The form shows your note instead.',
      )
      await load()
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Could not change that.')
    } finally {
      setBusy(false)
    }
  }

  if (!data) {
    return (
      <div className="mt-10">
        <h2 className="text-[1.15rem] font-semibold">Accommodation</h2>
        <Loader2 size={16} className="ink-3 mt-3 animate-spin" />
      </div>
    )
  }

  const { settings, occupancy, arrivals, totals } = data
  const open = settings.open

  return (
    <div className="mt-10">
      <h2 className="text-[1.15rem] font-semibold">Accommodation</h2>
      <p className="ink-3 mt-1 text-[0.82rem]">
        {totals.people === 0
          ? 'Nobody has booked a bed yet.'
          : `${totals.people} ${totals.people === 1 ? 'person has' : 'people have'} booked a bed, ` +
            `${rupees(totals.collectedPaise)} collected for rooms. Gateway charges and the ` +
            `₹500 cash deposits are not in that figure.`}
      </p>

      {/* ---------- the switch ---------- */}

      <div className="card mt-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <BedDouble size={16} style={{ color: 'var(--cs-third)' }} />
            <span className="text-[0.92rem] font-medium">
              Bookings are {open ? 'open' : 'closed'}
            </span>
          </div>

          <button
            onClick={() => void flip(!open)}
            disabled={busy}
            className="ghost inline-flex items-center gap-2 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 size={13} className="animate-spin" />
            ) : open ? (
              <Lock size={13} />
            ) : (
              <LockOpen size={13} />
            )}
            {open ? 'Close bookings' : 'Open bookings'}
          </button>
        </div>

        <label className="mt-4 block">
          <span className="ink-3 text-[0.74rem]">
            What the site says while closed. Leave it blank for the default. "Full" and "not open
            yet" read very differently to somebody on the page at midnight.
          </span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            placeholder="e.g. All beds are taken. Ring a coordinator if you are stuck."
            className="mt-1.5 w-full rounded-lg px-3 py-2 text-[0.86rem] outline-none"
            style={{
              background: 'var(--cs-surface-2)',
              border: '1px solid var(--cs-hair)',
              color: 'var(--cs-ink)',
            }}
          />
        </label>

        {settings.updatedBy && (
          <p className="ink-3 mt-2 text-[0.74rem]">
            Last changed by {settings.updatedBy}, {settings.updatedAt} UTC.
          </p>
        )}
        {saved && (
          <p className="mt-2 text-[0.78rem]" style={{ color: 'var(--cs-festival)' }}>
            {saved}
          </p>
        )}
      </div>

      {/* ---------- occupancy ---------- */}

      {occupancy.length > 0 && (
        <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="card p-5">
            <div className="text-[0.92rem] font-medium">Rooms to have ready</div>
            <p className="ink-3 mt-1 text-[0.76rem]">
              Rounded up: four people wanting a three-seater is two rooms.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="data w-full">
                <thead>
                  <tr>
                    <th>Gender</th>
                    <th>Room</th>
                    <th className="n">People</th>
                    <th className="n">Rooms</th>
                    <th className="n">Collected</th>
                  </tr>
                </thead>
                <tbody>
                  {occupancy.map((o) => (
                    <tr key={`${o.gender}-${o.room}`}>
                      <td className="capitalize">{o.gender}</td>
                      <td>{o.room}</td>
                      <td className="n num">{o.people}</td>
                      <td className="n num" style={{ color: 'var(--cs-festival)' }}>
                        {o.rooms}
                      </td>
                      <td className="n num">{rupees(o.collectedPaise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card p-5">
            <div className="text-[0.92rem] font-medium">Arrivals</div>
            <p className="ink-3 mt-1 text-[0.76rem]">Who lands on which day, for the check-in desk.</p>
            <table className="data mt-3 w-full">
              <thead>
                <tr>
                  <th>Day</th>
                  <th className="n">People</th>
                </tr>
              </thead>
              <tbody>
                {arrivals.map((a) => (
                  <tr key={a.date}>
                    <td>{a.date}</td>
                    <td className="n num">{a.people}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

/** Paise as whole rupees. Nothing here needs the paise. */
function rupees(paise: number): string {
  return `₹${Math.round(paise / 100).toLocaleString('en-IN')}`
}
