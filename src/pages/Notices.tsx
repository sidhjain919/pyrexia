import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Loader2, Pin } from 'lucide-react'

import { ApiError, api, type Notice } from '../api/client'
import { ANNOUNCEMENT_CHANNEL, REGISTRATION_HELP } from '../data/site'
import { Markdown } from '../lib/markdown'
import { art } from '../lib/art'

/**
 * The public noticeboard.
 *
 * Pinned notices first, then newest. Anything expired is filtered out by the
 * server rather than dimmed here: a board that keeps yesterday's "bus leaves
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
    <section className="mx-auto min-h-[80svh] max-w-3xl px-5 pb-24 pt-[calc(var(--header-h,7rem)+2rem)] sm:px-8">
      {/* The board itself, planks and all. The page is the one people open
          every morning of the fest, and it used to look like a settings
          screen. */}
      <div className="relative">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${art.noticeBoard})`,
            backgroundSize: '100% 100%',
            backgroundRepeat: 'no-repeat',
            filter: 'drop-shadow(0 16px 36px rgba(0,0,0,0.55))',
          }}
        />
        {/* The planks run from near-black to bleached grey, and the bleached
            run goes straight through the middle of the board — which is where
            the type is. Pale text on it was legible over some planks and gone
            over others. This darkens the middle of the board only, leaving the
            grain and the rope corners as they are. */}
        <div
          aria-hidden
          className="absolute inset-x-[8%] inset-y-[12%] rounded-[2rem]"
          style={{
            background:
              'radial-gradient(70% 78% at 50% 50%, rgba(14,9,5,0.82) 0%, rgba(14,9,5,0.66) 55%, rgba(14,9,5,0) 100%)',
          }}
        />
        <div className="relative flex flex-col items-center justify-center px-8 py-12 text-center sm:px-14 sm:py-16">
          <div className="font-log text-[0.62rem] uppercase tracking-cinema text-gold-bright/90 [text-shadow:0_1px_6px_rgba(0,0,0,1)]">
            PYREXIA 2026
          </div>
          <h1 className="mt-2 font-display text-3xl text-offwhite [text-shadow:0_2px_10px_rgba(0,0,0,1)] sm:text-4xl">
            Noticeboard
          </h1>
          <p className="mt-3 max-w-md text-[0.9rem] leading-relaxed text-parchment [text-shadow:0_1px_8px_rgba(0,0,0,1)]">
            Schedule changes, results and announcements from the crew. Worth a look
            each morning of the fest.
          </p>
        </div>
      </div>

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

      {/* The board is checked when somebody is already looking for news, which
          is exactly the moment to offer the channel that pushes it to them.
          The brochure asks people to unmute it, so this says so too. */}
      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        <a
          href={ANNOUNCEMENT_CHANNEL.href}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-11 flex-col justify-center rounded-xl border border-gold/25 bg-navy/40 px-5 py-4 transition-colors hover:border-gold/60"
        >
          <span className="font-display text-[1rem] text-offwhite">
            {ANNOUNCEMENT_CHANNEL.label}
          </span>
          <span className="mt-1 text-[0.8rem] leading-relaxed text-parchment/60">
            {ANNOUNCEMENT_CHANNEL.note}
          </span>
        </a>
        <a
          href={`tel:${REGISTRATION_HELP.phone}`}
          className="flex min-h-11 flex-col justify-center rounded-xl border border-gold/15 bg-navy/40 px-5 py-4 transition-colors hover:border-gold/50"
        >
          <span className="font-display text-[1rem] text-offwhite">Registration trouble?</span>
          <span className="mt-1 text-[0.8rem] leading-relaxed text-parchment/60">
            {REGISTRATION_HELP.name} on {REGISTRATION_HELP.phone}, from the PR crew.
          </span>
        </a>
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
