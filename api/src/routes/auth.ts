/**
 * Accounts.
 *
 *   POST /api/auth/signup    email + password → account, signed in
 *   POST /api/auth/login     email + password → signed in
 *   POST /api/auth/forgot    email → a reset link
 *   POST /api/auth/reset     token + new password → signed in
 *   POST /api/auth/logout
 *
 * An account is only an email and a password. Everything else — name, college,
 * emergency contact — is collected when the pass is bought, so signing up is
 * two fields rather than a second long form.
 *
 * Two things this deliberately does *not* do:
 *
 *  - Say whether an address is registered. Sign-up and forgot-password both
 *    answer identically either way, so neither can be used to work out who has
 *    bought a pass.
 *  - Treat an account as a fest registration. Having one means nothing until
 *    Basic Registration is paid for, and every surface says so.
 */

import { Hono } from 'hono'

import type { Env } from '../types.ts'
import { ApiError, clientIp, readJson } from '../lib/http.ts'
import { newId, newPublicCode } from '../lib/ids.ts'
import { normaliseEmail } from '../lib/validate.ts'
import { checkPassword, hashPassword, needsRehash, verifyPassword } from '../lib/password.ts'
import * as audit from '../lib/audit.ts'
import {
  clearedCookie,
  consumeLoginToken,
  createLoginToken,
  createSession,
  readToken,
  recordFailedAttempt,
  revokeSession,
  sessionCookie,
} from '../lib/session.ts'

export const auth = new Hono<{ Bindings: Env }>()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Sign-in attempts per address per hour. The real defence against guessing. */
const MAX_LOGIN_ATTEMPTS = 10
/** Reset emails per address per hour. */
const MAX_RESET_REQUESTS = 5

async function bucketKey(prefix: string, value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  const short = Array.from(new Uint8Array(digest).slice(0, 8), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('')
  return `${prefix}:${short}`
}

async function rateLimit(env: Env, key: string, max: number): Promise<void> {
  const seen = Number((await env.KV.get(key)) ?? '0')
  if (seen >= max) {
    throw new ApiError('rate_limited', 'Too many attempts. Try again in an hour.')
  }
  await env.KV.put(key, String(seen + 1), { expirationTtl: 3600 })
}

/** Everything the browser needs to know about who it is now. */
async function signedInResponse(env: Env, registrationId: string, userAgent?: string) {
  const token = await createSession(env, registrationId, userAgent)

  const row = await env.DB.prepare(
    `SELECT r.public_code, r.name, r.email, r.status,
            EXISTS (SELECT 1 FROM entitlements e
                     WHERE e.registration_id = r.id AND e.revoked_at IS NULL) AS has_paid
       FROM registrations r WHERE r.id = ?`,
  )
    .bind(registrationId)
    .first<{ public_code: string; name: string; email: string; status: string; has_paid: number }>()

  return {
    token,
    account: {
      email: row?.email ?? '',
      name: row?.name || null,
      publicCode: row?.public_code ?? null,
      // The distinction the whole design rests on: an account is not a
      // registration, and the UI has to shout about it until this is true.
      hasRegistration: !!row?.has_paid,
    },
  }
}

/* ------------------------------------------------------------------ *
 * Sign up
 * ------------------------------------------------------------------ */

auth.post('/auth/signup', async (c) => {
  const body = (await readJson(c)) as Record<string, unknown>
  const email = normaliseEmail(String(body.email ?? ''))
  const password = String(body.password ?? '')

  const fields: Record<string, string> = {}
  if (!EMAIL_RE.test(email)) fields.email = 'A valid email, please.'
  const passwordProblem = checkPassword(password)
  if (passwordProblem) fields.password = passwordProblem
  if (Object.keys(fields).length) {
    throw new ApiError('validation_failed', 'Check these and try again.', { fields })
  }

  await rateLimit(c.env, await bucketKey('signup', email), MAX_RESET_REQUESTS)

  const existing = await c.env.DB.prepare(
    'SELECT id, password_hash FROM registrations WHERE lower(email) = ?',
  )
    .bind(email)
    .first<{ id: string; password_hash: string | null }>()

  if (existing) {
    // Someone who registered before passwords existed has a row but no
    // password. Rather than telling them an account exists — which leaks who
    // has paid — point everyone at the same recovery flow.
    throw new ApiError(
      'conflict',
      'There is already an account with that email. Sign in, or use "Forgot password".',
      { fields: { email: 'Already in use.' } },
    )
  }

  const id = newId()
  await c.env.DB.prepare(
    `INSERT INTO registrations
       (id, public_code, name, email, phone, college, city, course, year,
        emergency_name, emergency_phone, password_hash, status)
     VALUES (?, ?, '', ?, '', '', '', '', '', '', '', ?, 'pending')`,
  )
    .bind(id, newPublicCode(), email, await hashPassword(password))
    .run()

  await audit.record(c.env, {
    action: 'account.created',
    entity: 'registration',
    entityId: id,
    ip: clientIp(c),
  })

  const res = await signedInResponse(c.env, id, c.req.header('User-Agent'))
  c.header('Set-Cookie', sessionCookie(res.token))
  return c.json(res, 201)
})

/* ------------------------------------------------------------------ *
 * Sign in
 * ------------------------------------------------------------------ */

auth.post('/auth/login', async (c) => {
  const body = (await readJson(c)) as Record<string, unknown>
  const email = normaliseEmail(String(body.email ?? ''))
  const password = String(body.password ?? '')

  if (!email || !password) {
    throw new ApiError('bad_request', 'Enter your email and password.')
  }

  await rateLimit(c.env, await bucketKey('login', email), MAX_LOGIN_ATTEMPTS)

  const row = await c.env.DB.prepare(
    'SELECT id, password_hash FROM registrations WHERE lower(email) = ?',
  )
    .bind(email)
    .first<{ id: string; password_hash: string | null }>()

  const ok = await verifyPassword(password, row?.password_hash ?? null)

  // One message for "no such account" and "wrong password" alike. Two would
  // turn this endpoint into a way of checking who has an account.
  if (!row || !ok) {
    throw new ApiError('unauthorised', 'That email and password don’t match.')
  }

  // Quietly upgrade a hash made with older settings.
  if (needsRehash(row.password_hash)) {
    await c.env.DB
      .prepare('UPDATE registrations SET password_hash = ? WHERE id = ?')
      .bind(await hashPassword(password), row.id)
      .run()
      .catch(() => {})
  }

  await audit.record(c.env, {
    action: 'auth.signed_in',
    entity: 'registration',
    entityId: row.id,
    ip: clientIp(c),
  })

  const res = await signedInResponse(c.env, row.id, c.req.header('User-Agent'))
  c.header('Set-Cookie', sessionCookie(res.token))
  return c.json(res)
})

/* ------------------------------------------------------------------ *
 * Forgotten passwords
 * ------------------------------------------------------------------ */

auth.post('/auth/forgot', async (c) => {
  const body = (await readJson(c)) as Record<string, unknown>
  const email = normaliseEmail(String(body.email ?? ''))

  const vague = {
    sent: true,
    message: 'If there is an account with that email, a reset link is on its way.',
  }

  if (!EMAIL_RE.test(email)) {
    throw new ApiError('bad_request', 'Enter the email you signed up with.')
  }

  await rateLimit(c.env, await bucketKey('forgot', email), MAX_RESET_REQUESTS)

  const row = await c.env.DB.prepare(
    'SELECT id FROM registrations WHERE lower(email) = ?',
  )
    .bind(email)
    .first<{ id: string }>()

  if (!row) return c.json(vague)

  const token = await createLoginToken(c.env, row.id, 'magic_link')
  await c.env.JOBS.send({ kind: 'email.reset_password', registrationId: row.id, token })

  await audit.record(c.env, {
    action: 'auth.reset_requested',
    entity: 'registration',
    entityId: row.id,
    ip: clientIp(c),
  })

  // Outside production the token comes back so the flow is testable before the
  // mailer is switched on. Unreachable once ENVIRONMENT is "production".
  if (c.env.ENVIRONMENT !== 'production') return c.json({ ...vague, devToken: token })
  return c.json(vague)
})

auth.post('/auth/reset', async (c) => {
  const body = (await readJson(c)) as Record<string, unknown>
  const token = String(body.token ?? '').trim()
  const password = String(body.password ?? '')

  if (!token) throw new ApiError('bad_request', 'Missing reset token.')

  const problem = checkPassword(password)
  if (problem) {
    throw new ApiError('validation_failed', 'Check this and try again.', {
      fields: { password: problem },
    })
  }

  let registrationId: string
  try {
    registrationId = await consumeLoginToken(c.env, token)
  } catch (err) {
    await recordFailedAttempt(c.env, token).catch(() => {})
    throw err
  }

  await c.env.DB.prepare('UPDATE registrations SET password_hash = ? WHERE id = ?')
    .bind(await hashPassword(password), registrationId)
    .run()

  // A password change ends every other session. Someone resetting because they
  // think they were compromised expects exactly that.
  await c.env.DB.prepare(
    "UPDATE sessions SET revoked_at = datetime('now') WHERE registration_id = ? AND revoked_at IS NULL",
  )
    .bind(registrationId)
    .run()

  await audit.record(c.env, {
    action: 'auth.password_reset',
    entity: 'registration',
    entityId: registrationId,
    ip: clientIp(c),
  })

  const res = await signedInResponse(c.env, registrationId, c.req.header('User-Agent'))
  c.header('Set-Cookie', sessionCookie(res.token))
  return c.json(res)
})

/* ------------------------------------------------------------------ *
 * One-tap links from email
 * ------------------------------------------------------------------ */

/**
 * The link in a confirmation email. Not the front door any more — just a
 * convenience for opening a pass on a phone that isn't signed in.
 */
auth.post('/auth/consume', async (c) => {
  const body = (await readJson(c)) as Record<string, unknown>
  const token = String(body.token ?? '').trim()
  if (!token) throw new ApiError('bad_request', 'Missing sign-in token.')

  let registrationId: string
  try {
    registrationId = await consumeLoginToken(c.env, token)
  } catch (err) {
    await recordFailedAttempt(c.env, token).catch(() => {})
    throw err
  }

  await audit.record(c.env, {
    action: 'auth.signed_in',
    entity: 'registration',
    entityId: registrationId,
    ip: clientIp(c),
  })

  const res = await signedInResponse(c.env, registrationId, c.req.header('User-Agent'))
  c.header('Set-Cookie', sessionCookie(res.token))
  return c.json(res)
})

auth.post('/auth/logout', async (c) => {
  const token = readToken(c.req.raw.headers)
  if (token) await revokeSession(c.env, token)
  c.header('Set-Cookie', clearedCookie)
  return c.json({ ok: true })
})
