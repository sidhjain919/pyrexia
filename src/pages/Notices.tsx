import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Loader2, Pin } from 'lucide-react'

import { ApiError, api, type Notice } from '../api/client'
import { Markdown } from '../lib/markdown'

/**
 * The public noticeboard.
 *
 * Pinned notices first, then newest. Anything expired is filtered out by the
 * server rather than dimmed here — a board that keeps yesterday's "bus leaves
 * at 6pm" is a board people stop reading.
 *
 * Urgent notices are marked with a word and a border, not colour alone.
 */

const LABEL: Record<string, string> = {
  announcement: 'Announcement',
  schedule: 'Schedule',
  result: 'Result',
  urgent: 'Urgent',
}

export default function Notices() {
  const [notices, setNotices] = useState<Notice[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        setNotices((await api.notices()).notices)
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not load the noticeboard.')
      }
    })()
  }, [])

  return (
    <section className="mx-auto min-h-[80svh] max-w-3xl px-5 py-24 sm:px-8">
      <div className="font-log text-[0.62rem] uppercase tracking-cinema text-gold/70">
        PYREXIA 2026
      </div>
      <h1 className="mt-3 font-display text-3xl text-offwhite sm:text-4xl">Noticeboard</h1>
      <p className="mt-3 max-w-xl text-[0.94rem] leading-relaxed text-parchment/60">
        Schedule changes, results and announcements from the crew. Worth a look
        each morning of the fest.
      </p>

      {error && (
        <div className="mt-8 flex items-start gap-2 rounded-lg border border-coral/50 bg-coral/10 p-3 text-[0.85rem] text-coral">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {notices === null && !error && (
        <div className="mt-10 flex items-center gap-3 text-parchment/50">
          <Loader2 size={16} className="animate-spin" />
          Loading…
        </div>
      )}

      {notices?.length === 0 && (
        <div className="mt-10 rounded-xl border border-gold/15 bg-navy/40 p-8 text-center">
          <p className="text-[0.94rem] text-parchment/60">
            Nothing posted yet. Notices will appear here once the fest is closer.
          </p>
        </div>
      )}

      <div className="mt-10 space-y-5">
        {notices?.map((notice) => (
          <article
            key={notice.id}
            className={`rounded-xl border p-5 sm:p-6 ${
              notice.category === 'urgent'
                ? 'border-coral/45 bg-coral/[0.07]'
                : 'border-gold/15 bg-navy/40'
            }`}
          >
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={`rounded-full px-2.5 py-1 font-log text-[0.55rem] uppercase tracking-wide2 ${
                  notice.category === 'urgent'
                    ? 'bg-coral/20 text-coral'
                    : 'bg-gold/12 text-gold-bright'
                }`}
              >
                {LABEL[notice.category] ?? notice.category}
              </span>

              {notice.pinned && (
                <span className="flex items-center gap-1 font-log text-[0.55rem] uppercase tracking-wide2 text-parchment/45">
                  <Pin size={11} />
                  Pinned
                </span>
              )}

              <time
                className="ml-auto font-log text-[0.58rem] uppercase tracking-wide2 text-parchment/40"
                dateTime={notice.publishAt}
              >
                {new Date(notice.publishAt.replace(' ', 'T') + 'Z').toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                })}
              </time>
            </div>

            <h2 className="mt-3 font-display text-xl text-offwhite">{notice.title}</h2>

            <div className="mt-3">
              <Markdown source={notice.body} />
            </div>
          </article>
        ))}
      </div>

      <Link
        to="/"
        className="mt-12 inline-block font-log text-[0.62rem] uppercase tracking-wide2 text-parchment/40 hover:text-gold-bright"
      >
        ← Back to the island
      </Link>
    </section>
  )
}
