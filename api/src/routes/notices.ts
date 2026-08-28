/**
 * The noticeboard.
 *
 * Two audiences from one table. Anyone can read what is published; only an
 * admin with the `notices` permission can write, and only they can see a draft.
 *
 * Three things this gets right that a naive version does not:
 *
 * **A notice can be written before it is shown.** `published` and `publish_at`
 * are separate, so a result can be typed up during an event and released when
 * it is official, rather than being written in a hurry afterwards.
 *
 * **A notice can expire.** "Bus leaves at 6pm" is wrong on the 17th, and a
 * board full of stale urgencies is one nobody reads.
 *
 * **The body is Markdown, rendered on the client.** Storing HTML from a form
 * would mean storing whatever someone pasted, and a fest committee pasting
 * from a Word document is exactly how a script tag reaches a public page.
 */

import { Hono } from 'hono'

import type { Env } from '../types.ts'
import { ApiError, readJson } from '../lib/http.ts'
import { newId } from '../lib/ids.ts'
import { readToken, resolveSession } from '../lib/session.ts'
import * as audit from '../lib/audit.ts'

export const notices = new Hono<{ Bindings: Env }>()

const CATEGORIES = ['announcement', 'schedule', 'result', 'urgent'] as const
type Category = (typeof CATEGORIES)[number]

const MAX_TITLE = 140
const MAX_BODY = 8000

type Row = {
  id: string
  slug: string
  title: string
  body_md: string
  category: string
  pinned: number
  publish_at: string
  expires_at: string | null
  published: number
  updated_at: string
}

const present = (r: Row) => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  body: r.body_md,
  category: r.category,
  pinned: !!r.pinned,
  publishAt: r.publish_at,
  expiresAt: r.expires_at,
  published: !!r.published,
  updatedAt: r.updated_at,
})

/**
 * A readable, unique URL fragment.
 *
 * Two notices called "Day 2 Schedule" must not collide, so a short suffix is
 * appended rather than failing the save — a committee member retyping a title
 * should never meet a database error.
 */
function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
  return `${base || 'notice'}-${Math.random().toString(36).slice(2, 7)}`
}

/* ------------------------------------------------------------------ *
 * Public
 * ------------------------------------------------------------------ */

notices.get('/notices', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, slug, title, body_md, category, pinned, publish_at, expires_at,
            published, updated_at
       FROM notices
      WHERE published = 1
        AND publish_at <= datetime('now')
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      ORDER BY pinned DESC, publish_at DESC
      LIMIT 100`,
  ).all<Row>()

  return c.json({ notices: results.map(present) })
})

/* ------------------------------------------------------------------ *
 * Writing
 * ------------------------------------------------------------------ */

const PRIVILEGED = new Set(['superadmin', 'core', 'finance'])

/** Same gate as the admin routes, and the same deliberately vague refusal. */
async function requireNoticeAdmin(c: { env: Env; req: { raw: Request } }) {
  const session = await resolveSession(c.env, readToken(c.req.raw.headers))
  if (!session) throw new ApiError('unauthorised', 'Sign in first.')

  const row = await c.env.DB.prepare(
    'SELECT id, email, role FROM admins WHERE lower(email) = ? AND active = 1',
  )
    .bind(session.email.toLowerCase())
    .first<{ id: string; email: string; role: string }>()

  if (!row || !PRIVILEGED.has(row.role)) {
    throw new ApiError('forbidden', 'You do not have access to this.')
  }
  return row
}

function readNotice(body: Record<string, unknown>) {
  const title = String(body.title ?? '').trim()
  const text = String(body.body ?? '').trim()
  const category = String(body.category ?? 'announcement')

  const fields: Record<string, string> = {}
  if (!title) fields.title = 'A notice needs a title.'
  else if (title.length > MAX_TITLE) fields.title = `Keep it under ${MAX_TITLE} characters.`
  if (!text) fields.body = 'A notice needs something to say.'
  else if (text.length > MAX_BODY) fields.body = 'That is too long for a notice.'
  if (!CATEGORIES.includes(category as Category)) fields.category = 'Unknown category.'

  if (Object.keys(fields).length) {
    throw new ApiError('validation_failed', 'Check these and try again.', { fields })
  }

  return {
    title,
    text,
    category,
    pinned: body.pinned ? 1 : 0,
    published: body.published ? 1 : 0,
    // An empty string from a cleared date input means "no expiry", not a date
    // of nothing — which SQLite would happily store and then compare wrongly.
    expiresAt: typeof body.expiresAt === 'string' && body.expiresAt.trim()
      ? body.expiresAt.trim()
      : null,
  }
}

/** Everything, drafts included — the admin list. */
notices.get('/admin/notices', async (c) => {
  await requireNoticeAdmin(c)

  const { results } = await c.env.DB.prepare(
    `SELECT id, slug, title, body_md, category, pinned, publish_at, expires_at,
            published, updated_at
       FROM notices ORDER BY pinned DESC, publish_at DESC LIMIT 200`,
  ).all<Row>()

  return c.json({ notices: results.map(present) })
})

notices.post('/admin/notices', async (c) => {
  const me = await requireNoticeAdmin(c)
  const input = readNotice((await readJson(c)) as Record<string, unknown>)

  const id = newId()
  await c.env.DB.prepare(
    `INSERT INTO notices
       (id, slug, title, body_md, category, pinned, published, expires_at, author_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      slugify(input.title),
      input.title,
      input.text,
      input.category,
      input.pinned,
      input.published,
      input.expiresAt,
      me.id,
    )
    .run()

  await audit.record(c.env, {
    action: 'notice.publish',
    entity: 'notice',
    entityId: id,
    actorId: me.id,
    actorEmail: me.email,
    after: { title: input.title, published: !!input.published },
  })

  return c.json({ id }, 201)
})

notices.patch('/admin/notices/:id', async (c) => {
  const me = await requireNoticeAdmin(c)
  const id = c.req.param('id')
  const input = readNotice((await readJson(c)) as Record<string, unknown>)

  const result = await c.env.DB.prepare(
    `UPDATE notices
        SET title = ?, body_md = ?, category = ?, pinned = ?, published = ?,
            expires_at = ?, updated_at = datetime('now')
      WHERE id = ?`,
  )
    .bind(
      input.title,
      input.text,
      input.category,
      input.pinned,
      input.published,
      input.expiresAt,
      id,
    )
    .run()

  if (!result.meta.changes) throw new ApiError('not_found', 'No such notice.')

  await audit.record(c.env, {
    action: 'notice.publish',
    entity: 'notice',
    entityId: id,
    actorId: me.id,
    actorEmail: me.email,
    after: { title: input.title, published: !!input.published },
  })

  return c.json({ ok: true })
})

notices.delete('/admin/notices/:id', async (c) => {
  const me = await requireNoticeAdmin(c)
  const id = c.req.param('id')

  const result = await c.env.DB.prepare('DELETE FROM notices WHERE id = ?').bind(id).run()
  if (!result.meta.changes) throw new ApiError('not_found', 'No such notice.')

  await audit.record(c.env, {
    action: 'notice.publish',
    entity: 'notice',
    entityId: id,
    actorId: me.id,
    actorEmail: me.email,
    after: { deleted: true },
  })

  return c.json({ ok: true })
})
