import { useEffect, useState } from 'react'
import { Eye, EyeOff, Loader2, Pin, Plus, Trash2 } from 'lucide-react'

import { ApiError, api, type Notice, type NoticeInput } from '../api/client'
import { Markdown } from '../lib/markdown'

/**
 * Writing notices, from the admin page.
 *
 * A draft is the default. Somebody typing a result mid-event should be able to
 * save it and release it when it is official, rather than composing under
 * pressure in a box that publishes the moment they hit save.
 *
 * The live preview is not decoration: the body is Markdown, and without seeing
 * the result people paste formatting that renders as literal asterisks on a
 * public page.
 */

const EMPTY: NoticeInput = {
  title: '',
  body: '',
  category: 'announcement',
  pinned: false,
  published: false,
  expiresAt: null,
}

const CATEGORIES: { value: Notice['category']; label: string }[] = [
  { value: 'announcement', label: 'Announcement' },
  { value: 'schedule', label: 'Schedule' },
  { value: 'result', label: 'Result' },
  { value: 'urgent', label: 'Urgent' },
]

export default function NoticeComposer({ onError }: { onError: (message: string) => void }) {
  const [notices, setNotices] = useState<Notice[]>([])
  const [draft, setDraft] = useState<NoticeInput>(EMPTY)
  const [editing, setEditing] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const load = async () => {
    try {
      setNotices((await api.adminNotices()).notices)
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Could not load notices.')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const save = async () => {
    setBusy(true)
    setErrors({})
    try {
      if (editing) await api.updateNotice(editing, draft)
      else await api.createNotice(draft)
      setDraft(EMPTY)
      setEditing(null)
      setOpen(false)
      await load()
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields)
      else onError(err instanceof ApiError ? err.message : 'Could not save that notice.')
    } finally {
      setBusy(false)
    }
  }

  const edit = (notice: Notice) => {
    setDraft({
      title: notice.title,
      body: notice.body,
      category: notice.category,
      pinned: notice.pinned,
      published: notice.published,
      expiresAt: notice.expiresAt,
    })
    setEditing(notice.id)
    setOpen(true)
  }

  const remove = async (notice: Notice) => {
    // Deleting a notice is not recoverable and the list gives no undo, so it
    // asks first. Publishing and unpublishing do not — those are reversible.
    if (!confirm(`Delete “${notice.title}”? This cannot be undone.`)) return
    try {
      await api.deleteNotice(notice.id)
      await load()
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Could not delete that notice.')
    }
  }

  const togglePublished = async (notice: Notice) => {
    try {
      await api.updateNotice(notice.id, {
        title: notice.title,
        body: notice.body,
        category: notice.category,
        pinned: notice.pinned,
        published: !notice.published,
        expiresAt: notice.expiresAt,
      })
      await load()
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Could not change that notice.')
    }
  }

  const field =
    'w-full rounded-lg border border-gold/20 bg-navy/40 px-3.5 py-2.5 text-[0.9rem] text-offwhite placeholder:text-parchment/30 focus:border-gold/50 focus:outline-none'

  return (
    <div className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-offwhite">Noticeboard</h2>
          <p className="mt-1 text-[0.85rem] text-parchment/50">
            Published notices appear at{' '}
            <a href="/notices" className="text-gold-bright underline underline-offset-2">
              /notices
            </a>
            . Drafts stay here.
          </p>
        </div>
        <button
          onClick={() => {
            setDraft(EMPTY)
            setEditing(null)
            setOpen((v) => !v)
          }}
          className="flex items-center gap-2 rounded-full border border-gold/25 px-4 py-2 font-log text-[0.62rem] uppercase tracking-wide2 text-parchment/75 transition-colors hover:border-gold/50 hover:text-gold-bright"
        >
          <Plus size={13} />
          {open ? 'Close' : 'Write a notice'}
        </button>
      </div>

      {open && (
        <div className="mt-5 rounded-xl border border-gold/15 bg-navy/45 p-5 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label className="font-log text-[0.55rem] uppercase tracking-wide2 text-parchment/45">
                  Title
                </label>
                <input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="Day 2 schedule has changed"
                  className={`mt-1.5 ${field} ${errors.title ? 'border-coral/60' : ''}`}
                />
                {errors.title && (
                  <p className="mt-1 text-[0.78rem] text-coral">{errors.title}</p>
                )}
              </div>

              <div>
                <label className="font-log text-[0.55rem] uppercase tracking-wide2 text-parchment/45">
                  Body · Markdown
                </label>
                <textarea
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  rows={9}
                  placeholder={'**Bold**, *italic*, and\n- bullet points\n\n[A link](https://example.com)'}
                  className={`mt-1.5 resize-y ${field} ${errors.body ? 'border-coral/60' : ''}`}
                />
                {errors.body && <p className="mt-1 text-[0.78rem] text-coral">{errors.body}</p>}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-log text-[0.55rem] uppercase tracking-wide2 text-parchment/45">
                    Category
                  </label>
                  <select
                    value={draft.category}
                    onChange={(e) =>
                      setDraft({ ...draft, category: e.target.value as Notice['category'] })
                    }
                    className={`mt-1.5 ${field}`}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value} className="bg-navy">
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-log text-[0.55rem] uppercase tracking-wide2 text-parchment/45">
                    Hide after · optional
                  </label>
                  <input
                    type="date"
                    value={draft.expiresAt?.slice(0, 10) ?? ''}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        // End of that day, so a notice set to expire on the
                        // 14th is still up all through the 14th.
                        expiresAt: e.target.value ? `${e.target.value} 23:59:59` : null,
                      })
                    }
                    className={`mt-1.5 ${field}`}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-4 pt-1">
                <label className="flex items-center gap-2 text-[0.85rem] text-parchment/70">
                  <input
                    type="checkbox"
                    checked={draft.pinned}
                    onChange={(e) => setDraft({ ...draft, pinned: e.target.checked })}
                    className="accent-gold"
                  />
                  Pin to the top
                </label>
                <label className="flex items-center gap-2 text-[0.85rem] text-parchment/70">
                  <input
                    type="checkbox"
                    checked={draft.published}
                    onChange={(e) => setDraft({ ...draft, published: e.target.checked })}
                    className="accent-gold"
                  />
                  Publish now
                </label>
              </div>
            </div>

            {/* Markdown is unforgiving if you cannot see it. */}
            <div className="rounded-lg border border-gold/10 bg-abyss/40 p-4">
              <div className="font-log text-[0.55rem] uppercase tracking-wide2 text-parchment/35">
                Preview
              </div>
              <h3 className="mt-3 font-display text-lg text-offwhite">
                {draft.title || 'Your title'}
              </h3>
              <div className="mt-2">
                <Markdown source={draft.body || '_Nothing written yet._'} />
              </div>
            </div>
          </div>

          <button
            onClick={() => void save()}
            disabled={busy}
            className="mt-5 flex items-center gap-2 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep px-6 py-2.5 font-log text-[0.66rem] uppercase tracking-wide2 text-abyss disabled:opacity-50"
          >
            {busy && <Loader2 size={13} className="animate-spin" />}
            {editing ? 'Save changes' : draft.published ? 'Publish' : 'Save as draft'}
          </button>
        </div>
      )}

      <div className="mt-5 space-y-2.5">
        {notices.length === 0 && (
          <p className="text-[0.85rem] text-parchment/45">No notices written yet.</p>
        )}

        {notices.map((notice) => (
          <div
            key={notice.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-gold/12 bg-navy/35 px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {notice.pinned && <Pin size={11} className="shrink-0 text-gold/60" />}
                <span className="truncate text-[0.9rem] text-offwhite">{notice.title}</span>
              </div>
              <div className="mt-0.5 font-log text-[0.55rem] uppercase tracking-wide2 text-parchment/35">
                {notice.category}
                {' · '}
                {/* The word, not a colour — a draft must never be mistaken for live. */}
                {notice.published ? 'Live' : 'Draft'}
                {notice.expiresAt ? ' · expires' : ''}
              </div>
            </div>

            <button
              onClick={() => void togglePublished(notice)}
              title={notice.published ? 'Unpublish' : 'Publish'}
              className="rounded-full border border-gold/20 p-2 text-parchment/55 transition-colors hover:border-gold/45 hover:text-gold-bright"
            >
              {notice.published ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
            <button
              onClick={() => edit(notice)}
              className="font-log text-[0.55rem] uppercase tracking-wide2 text-parchment/55 transition-colors hover:text-gold-bright"
            >
              Edit
            </button>
            <button
              onClick={() => void remove(notice)}
              title="Delete"
              className="rounded-full border border-coral/25 p-2 text-coral/70 transition-colors hover:border-coral/60 hover:text-coral"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
