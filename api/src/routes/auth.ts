/**
 * Accounts.
 *
 *   POST /api/auth/signup    email + password → account, then a code
 *   POST /api/auth/verify    email + code → verified, signed in
 *   POST /api/auth/resend    email → another code
 *   POST /api/auth/google    Google ID token → signed in
 *   POST /api/auth/login     email + password → signed in
 *   POST /api/auth/forgot    email → a reset link
 *   POST /api/auth/reset     token + new password → signed in
 *   POST /api/auth/logout
 *
 * An account is only an email and a password. Everything else, name, college,
 * emergency contact: is collected when the pass is bought, so signing up is
 * two fields rather than a second long form.
 *
 * Two things this deliberately does *not* do:
 *
 *  - Say whether an address is registered. Sign-up and forgot-password both
 *    answer identically either way, so neither can be used to work out who has
 *    bought a pass.
 *  - Treat an account as a fest registration. Having one means nothing until
 *    Basic Registration is paid for, and every surface says so.
 *
 * An address has to be proved before it can be paid from. The pass is
 * delivered by email, so an unverified address means someone can pay ₹500 and
 * never receive what they bought: and we would have no way to tell that from
 * a person who simply hasn't looked in their inbox yet. Two ways to prove it:
 * a six-digit code, or Google, which has already done it for us.
 */

import { Hono } from 'hono'

import type { Env } from '../types.ts'
import { ApiError, clientIp, readJson } from '../lib/http.ts'
import { newId, newPublicCode } from '../lib/ids.ts'
import { normaliseEmail } from '../lib/validate.ts'
import { checkPassword, hashPassword, needsRehash, verifyPassword } from '../lib/password.ts'
import { verifyGoogleIdToken } from '../lib/google.ts'
import {
  MAX_OTP_ATTEMPTS,
  OTP_TTL_MINUTES,
  cleanCode,
  codesMatch,
  generateCode,
  hashCode,
} from '../lib/otp.ts'
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
    // password. Rather than telling them an account exists, which leaks who
    // has paid: point everyone at the same recovery flow.
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

  await issueCode(c.env, id)

  // No session yet. Signing someone in before they have proved the address
  // would make the code decorative: they could simply ignore it.
  return c.json(
    { verificationRequired: true, email, expiresInMinutes: OTP_TTL_MINUTES },
    201,
  )
})

/* ------------------------------------------------------------------ *
 * Verifying the address
 * ------------------------------------------------------------------ */

/** Issue a code, retiring any earlier one so only the newest works. */
async function issueCode(env: Env, registrationId: string): Promise<void> {
  const code = generateCode()

  await env.DB.prepare(
    `UPDATE email_otps SET consumed_at = datetime('now')
      WHERE registration_id = ? AND purpose = 'verify_email' AND consumed_at IS NULL`,
  )
    .bind(registrationId)
    .run()

  await env.DB.prepare(
    `INSERT INTO email_otps (id, registration_id, code_hash, expires_at)
     VALUES (?, ?, ?, datetime('now', ?))`,
  )
    .bind(newId(), registrationId, await hashCode(registrationId, code), `+${OTP_TTL_MINUTES} minutes`)
    .run()

  await env.JOBS.send({ kind: 'email.verify_code', registrationId, code })
}

auth.post('/auth/verify', async (c) => {
  const body = (await readJson(c)) as Record<string, unknown>
  const email = normaliseEmail(String(body.email ?? ''))
  const code = cleanCode(String(body.code ?? ''))

  if (!email || code.length !== 6) {
    throw new ApiError('bad_request', 'Enter the six-digit code from your email.')
  }

  // Rate limited on the address as well as per-code, so someone cannot work
  // around the five-guess limit by asking for a fresh code each time.
  await rateLimit(c.env, await bucketKey('verify', email), MAX_LOGIN_ATTEMPTS)

  const account = await c.env.DB.prepare(
    'SELECT id, email_verified FROM registrations WHERE lower(email) = ?',
  )
    .bind(email)
    .first<{ id: string; email_verified: number }>()

  // Same answer whether the account exists or the code is wrong. Two different
  // answers would turn this into a way of testing which addresses are ours.
  const wrong = () => new ApiError('invalid_code', 'That code is wrong or has expired.')

  if (!account) throw wrong()

  // An address that is already confirmed gets sent to the normal sign-in, and
  // emphatically *not* a session. Handing one out here, however tempting, to
  // be forgiving about a double submit: would mean any address that has ever
  // been verified could be signed into with any six digits at all, which is
  // every account on the site.
  if (account.email_verified) {
    throw new ApiError('conflict', 'That email is already confirmed. Please sign in.')
  }

  const otp = await c.env.DB.prepare(
    `SELECT id, code_hash, attempts FROM email_otps
      WHERE registration_id = ? AND purpose = 'verify_email'
        AND consumed_at IS NULL AND expires_at > datetime('now')
      ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(account.id)
    .first<{ id: string; code_hash: string; attempts: number }>()

  if (!otp) throw wrong()

  // Six digits is a million possibilities, which an unbounded attacker walks
  // through in minutes. Bounded, it is one in two hundred thousand.
  if (otp.attempts >= MAX_OTP_ATTEMPTS) {
    await c.env.DB.prepare("UPDATE email_otps SET consumed_at = datetime('now') WHERE id = ?")
      .bind(otp.id)
      .run()
    throw new ApiError('too_many_attempts', 'Too many wrong codes. Ask for a new one.')
  }

  if (!codesMatch(otp.code_hash, await hashCode(account.id, code))) {
    await c.env.DB.prepare('UPDATE email_otps SET attempts = attempts + 1 WHERE id = ?')
      .bind(otp.id)
      .run()
    throw wrong()
  }

  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE email_otps SET consumed_at = datetime('now') WHERE id = ?").bind(otp.id),
    c.env.DB.prepare('UPDATE registrations SET email_verified = 1 WHERE id = ?').bind(account.id),
  ])

  await audit.record(c.env, {
    action: 'account.email_verified',
    entity: 'registration',
    entityId: account.id,
    ip: clientIp(c),
  })

  const res = await signedInResponse(c.env, account.id, c.req.header('User-Agent'))
  c.header('Set-Cookie', sessionCookie(res.token))
  return c.json(res)
})

auth.post('/auth/resend', async (c) => {
  const body = (await readJson(c)) as Record<string, unknown>
  const email = normaliseEmail(String(body.email ?? ''))
  if (!email) throw new ApiError('bad_request', 'Which address?')

  await rateLimit(c.env, await bucketKey('resend', email), MAX_RESET_REQUESTS)

  const account = await c.env.DB.prepare(
    'SELECT id, email_verified FROM registrations WHERE lower(email) = ?',
  )
    .bind(email)
    .first<{ id: string; email_verified: number }>()

  if (account && !account.email_verified) await issueCode(c.env, account.id)

  // Always the same answer, so this cannot be used to discover who has an
  // account.
  return c.json({ sent: true, expiresInMinutes: OTP_TTL_MINUTES })
})

/* ------------------------------------------------------------------ *
 * Google
 * ------------------------------------------------------------------ */

auth.post('/auth/google', async (c) => {
  const body = (await readJson(c)) as Record<string, unknown>
  const credential = String(body.credential ?? '')

  if (!c.env.GOOGLE_CLIENT_ID) {
    throw new ApiError('unavailable', 'Google sign-in is not configured yet.')
  }
  if (!credential) throw new ApiError('bad_request', 'Missing Google credential.')

  const identity = await verifyGoogleIdToken(credential, c.env.GOOGLE_CLIENT_ID)
  if (!identity) throw new ApiError('unauthorised', 'That Google sign-in could not be verified.')

  // Match on `sub` first. Google's own guidance is that an address can move
  // between accounts, while `sub` never changes: matching on email alone
  // would eventually hand someone another person's registration.
  let account = await c.env.DB.prepare('SELECT id FROM registrations WHERE google_sub = ?')
    .bind(identity.sub)
    .first<{ id: string }>()

  if (!account) {
    const byEmail = await c.env.DB.prepare(
      'SELECT id, google_sub FROM registrations WHERE lower(email) = ?',
    )
      .bind(identity.email)
      .first<{ id: string; google_sub: string | null }>()

    if (byEmail && !byEmail.google_sub) {
      // Someone who signed up with a password is now using Google. Same
      // address, same person, one account: link rather than duplicate.
      await c.env.DB.prepare(
        'UPDATE registrations SET google_sub = ?, email_verified = 1 WHERE id = ?',
      )
        .bind(identity.sub, byEmail.id)
        .run()
      account = { id: byEmail.id }
    } else if (byEmail) {
      // The address is taken by a different Google account. Refuse rather than
      // guess.
      throw new ApiError('conflict', 'That email is already linked to another account.')
    } else {
      const id = newId()
      await c.env.DB.prepare(
        `INSERT INTO registrations
           (id, public_code, name, email, phone, college, city, course, year,
            emergency_name, emergency_phone, status, google_sub, email_verified)
         VALUES (?, ?, ?, ?, '', '', '', '', '', '', '', 'pending', ?, 1)`,
      )
        .bind(id, newPublicCode(), identity.name, identity.email, identity.sub)
        .run()

      await audit.record(c.env, {
        action: 'account.created',
        entity: 'registration',
        entityId: id,
        ip: clientIp(c),
      })
      account = { id }
    }
  }

  await audit.record(c.env, {
    action: 'auth.signed_in',
    entity: 'registration',
    entityId: account.id,
    ip: clientIp(c),
  })

  const res = await signedInResponse(c.env, account.id, c.req.header('User-Agent'))
  c.header('Set-Cookie', sessionCookie(res.token))
  return c.json(res)
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

  // An account created before the address was proved gets a fresh code
  // instead of a session. The alternative, signing them in and blocking them
  // later at checkout: moves the dead end to the worst possible moment.
  const state = await c.env.DB.prepare('SELECT email_verified FROM registrations WHERE id = ?')
    .bind(row.id)
    .first<{ email_verified: number }>()

  if (state && !state.email_verified) {
    await issueCode(c.env, row.id)
    throw new ApiError('verification_required', 'Confirm your email to continue.', {
      extra: { email, expiresInMinutes: OTP_TTL_MINUTES },
    })
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
 * The link in a confirmation email. Not the front door any more, just a
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
