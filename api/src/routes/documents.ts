/**
 * Identity documents.
 *
 * Students upload a government photo ID and a college ID so the registration
 * desk can check who is collecting a pass. Three rules shape everything here,
 * and all three exist because this is the most sensitive data we hold:
 *
 * **Encrypted before it is stored.** Nothing readable ever reaches the bucket.
 *
 * **Every view is logged.** An admin opening someone's Aadhaar card leaves an
 * audit entry with their name on it. Not a deterrent for an attacker — a
 * record for the people whose documents these are.
 *
 * **Deleted on a date fixed at upload.** The privacy policy promises removal
 * within thirty days of the fest, and `purge_after` is written when the file
 * arrives rather than left to somebody remembering.
 *
 * A student may replace or delete their own document until it is approved.
 * After that it is the desk's evidence and only an admin can act.
 */

import { Hono } from 'hono'

import type { Env } from '../types.ts'
import { ApiError, clientIp } from '../lib/http.ts'
import { newId } from '../lib/ids.ts'
import { decryptBytes, encryptBytes, sha256Hex } from '../lib/crypto.ts'
import { readToken, resolveSession } from '../lib/session.ts'
import * as audit from '../lib/audit.ts'

export const documents = new Hono<{ Bindings: Env }>()

const KINDS = ['aadhaar', 'student_id', 'photo'] as const
type Kind = (typeof KINDS)[number]

/** Generous for a phone photo, small enough that nobody stores a video. */
const MAX_BYTES = 5 * 1024 * 1024

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
])

/**
 * When this file gets deleted.
 *
 * Thirty days after the last day of the fest, which is what the privacy page
 * promises. Fixed at upload so the commitment does not depend on anyone
 * remembering in November.
 */
const PURGE_AFTER = '2026-11-15'

documents.post('/me/documents', async (c) => {
  const session = await resolveSession(c.env, readToken(c.req.raw.headers))
  if (!session) throw new ApiError('unauthorised', 'Sign in first.')

  const kind = String(c.req.query('kind') ?? '') as Kind
  if (!KINDS.includes(kind)) {
    throw new ApiError('bad_request', 'Say which document this is.')
  }

  const mime = c.req.header('Content-Type')?.split(';')[0]?.trim() ?? ''
  if (!ALLOWED_MIME.has(mime)) {
    throw new ApiError('bad_request', 'Upload a photo (JPG, PNG or HEIC) or a PDF.')
  }

  const plain = await c.req.arrayBuffer()
  if (plain.byteLength === 0) throw new ApiError('bad_request', 'That file is empty.')
  if (plain.byteLength > MAX_BYTES) {
    throw new ApiError('bad_request', 'That file is over 5 MB. A phone photo is usually enough.')
  }

  // Already approved? Then this is the desk's evidence and not the student's
  // to overwrite. Anything else — unsubmitted, pending, rejected — may be
  // replaced, which is how somebody fixes a blurred photo.
  const state = await c.env.DB.prepare('SELECT verification FROM registrations WHERE id = ?')
    .bind(session.registrationId)
    .first<{ verification: string }>()

  if (state?.verification === 'approved') {
    throw new ApiError('conflict', 'Your documents are already approved. Contact the crew to change them.')
  }

  const id = newId()
  const r2Key = `docs/${session.registrationId}/${id}`

  await c.env.DOCS.put(r2Key, await encryptBytes(c.env.DOC_ENCRYPTION_KEY, plain), {
    httpMetadata: { contentType: 'application/octet-stream' },
    customMetadata: { kind, registrationId: session.registrationId },
  })

  // One document of each kind per person. Replacing removes the old row and
  // its object, so a rejected blurred photo does not linger next to its
  // replacement confusing whoever checks.
  const previous = await c.env.DB.prepare(
    'SELECT id, r2_key FROM documents WHERE registration_id = ? AND kind = ?',
  )
    .bind(session.registrationId, kind)
    .all<{ id: string; r2_key: string }>()

  await c.env.DB.prepare(
    `INSERT INTO documents
       (id, registration_id, kind, r2_key, filename, mime, size_bytes, sha256, purge_after)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      session.registrationId,
      kind,
      r2Key,
      c.req.query('filename')?.slice(0, 120) ?? null,
      mime,
      plain.byteLength,
      await sha256Hex(plain),
      PURGE_AFTER,
    )
    .run()

  for (const old of previous.results) {
    await c.env.DOCS.delete(old.r2_key).catch(() => {})
    await c.env.DB.prepare('DELETE FROM documents WHERE id = ?').bind(old.id).run()
  }

  // Uploading puts the registration back in the queue to be looked at.
  await c.env.DB.prepare(
    `UPDATE registrations SET verification = 'pending', verification_note = NULL
      WHERE id = ? AND verification != 'approved'`,
  )
    .bind(session.registrationId)
    .run()

  return c.json({ id, kind, sizeBytes: plain.byteLength }, 201)
})

/** What this person has uploaded — metadata only, never the file. */
documents.get('/me/documents', async (c) => {
  const session = await resolveSession(c.env, readToken(c.req.raw.headers))
  if (!session) throw new ApiError('unauthorised', 'Sign in first.')

  const { results } = await c.env.DB.prepare(
    `SELECT id, kind, mime, size_bytes, uploaded_at FROM documents
      WHERE registration_id = ? AND purged_at IS NULL ORDER BY uploaded_at`,
  )
    .bind(session.registrationId)
    .all<Record<string, unknown>>()

  const state = await c.env.DB.prepare('SELECT verification, verification_note FROM registrations WHERE id = ?')
    .bind(session.registrationId)
    .first<{ verification: string; verification_note: string | null }>()

  return c.json({
    verification: state?.verification ?? 'unsubmitted',
    note: state?.verification_note ?? null,
    documents: results.map((r) => ({
      id: r.id,
      kind: r.kind,
      mime: r.mime,
      sizeBytes: r.size_bytes,
      uploadedAt: r.uploaded_at,
    })),
  })
})

documents.delete('/me/documents/:id', async (c) => {
  const session = await resolveSession(c.env, readToken(c.req.raw.headers))
  if (!session) throw new ApiError('unauthorised', 'Sign in first.')

  // Scoped to the session's own registration, so the id in the URL cannot
  // reach anybody else's file.
  const row = await c.env.DB.prepare(
    'SELECT id, r2_key FROM documents WHERE id = ? AND registration_id = ?',
  )
    .bind(c.req.param('id'), session.registrationId)
    .first<{ id: string; r2_key: string }>()

  if (!row) throw new ApiError('not_found', 'No such document.')

  const state = await c.env.DB.prepare('SELECT verification FROM registrations WHERE id = ?')
    .bind(session.registrationId)
    .first<{ verification: string }>()

  if (state?.verification === 'approved') {
    throw new ApiError('conflict', 'Approved documents cannot be removed here.')
  }

  await c.env.DOCS.delete(row.r2_key).catch(() => {})
  await c.env.DB.prepare('DELETE FROM documents WHERE id = ?').bind(row.id).run()

  return c.json({ ok: true })
})

/* ------------------------------------------------------------------ *
 * The desk
 * ------------------------------------------------------------------ */

const CAN_VERIFY = new Set(['superadmin', 'core', 'finance', 'verifier'])

async function requireVerifier(c: { env: Env; req: { raw: Request } }) {
  const session = await resolveSession(c.env, readToken(c.req.raw.headers))
  if (!session) throw new ApiError('unauthorised', 'Sign in first.')

  const row = await c.env.DB.prepare(
    'SELECT id, email, role FROM admins WHERE lower(email) = ? AND active = 1',
  )
    .bind(session.email.toLowerCase())
    .first<{ id: string; email: string; role: string }>()

  if (!row || !CAN_VERIFY.has(row.role)) {
    throw new ApiError('forbidden', 'You do not have access to this.')
  }
  return row
}

/**
 * Decrypt and return one document.
 *
 * Deliberately not a redirect to a signed bucket URL: the bytes must pass
 * through here to be decrypted, and routing every view through one place is
 * also what makes the audit entry below unavoidable.
 */
documents.get('/admin/documents/:id', async (c) => {
  const me = await requireVerifier(c)

  const row = await c.env.DB.prepare(
    'SELECT id, registration_id, kind, r2_key, mime FROM documents WHERE id = ? AND purged_at IS NULL',
  )
    .bind(c.req.param('id'))
    .first<{ id: string; registration_id: string; kind: string; r2_key: string; mime: string }>()

  if (!row) throw new ApiError('not_found', 'No such document.')

  const object = await c.env.DOCS.get(row.r2_key)
  if (!object) throw new ApiError('not_found', 'That file is no longer stored.')

  let plain: ArrayBuffer
  try {
    plain = await decryptBytes(c.env.DOC_ENCRYPTION_KEY, await object.arrayBuffer())
  } catch {
    // A failure here means the key changed or the object was altered. Saying
    // so plainly beats serving bytes nobody can vouch for.
    throw new ApiError('internal', 'That file could not be decrypted.')
  }

  await audit.record(c.env, {
    action: 'document.view',
    entity: 'document',
    entityId: row.id,
    actorId: me.id,
    actorEmail: me.email,
    ip: clientIp(c as never),
    after: { registrationId: row.registration_id, kind: row.kind },
  })

  return new Response(plain, {
    headers: {
      'Content-Type': row.mime || 'application/octet-stream',
      // Never cached, never stored by an intermediary, and shown rather than
      // downloaded so it does not end up in a volunteer's Downloads folder.
      'Content-Disposition': 'inline',
      'Cache-Control': 'no-store, private',
      'X-Content-Type-Options': 'nosniff',
    },
  })
})

documents.post('/admin/registrations/:id/verify', async (c) => {
  const me = await requireVerifier(c)
  const id = c.req.param('id')
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>

  const decision = String(body.decision ?? '')
  if (decision !== 'approved' && decision !== 'rejected') {
    throw new ApiError('bad_request', 'Decide approved or rejected.')
  }

  const note = typeof body.note === 'string' ? body.note.slice(0, 500) : null
  // A rejection without a reason is one the student cannot act on.
  if (decision === 'rejected' && !note) {
    throw new ApiError('bad_request', 'Say why, so they know what to fix.')
  }

  const result = await c.env.DB.prepare(
    'UPDATE registrations SET verification = ?, verification_note = ? WHERE id = ?',
  )
    .bind(decision, note, id)
    .run()

  if (!result.meta.changes) throw new ApiError('not_found', 'No such registration.')

  await audit.record(c.env, {
    action: 'verification.decide',
    entity: 'registration',
    entityId: id,
    actorId: me.id,
    actorEmail: me.email,
    after: { decision, note },
  })

  return c.json({ ok: true, verification: decision })
})
