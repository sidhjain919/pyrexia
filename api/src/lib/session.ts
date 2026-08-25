/**
 * Sessions and passwordless sign-in.
 *
 * Nobody signs up. Paying *is* signing up — by the time someone finishes Basic
 * Registration we already hold their name, email and phone, so making them fill
 * a second form to "create an account" would be friction for nothing.
 *
 * Getting back in later is a link in their confirmation email, or a code sent
 * to that email if they've lost it. No passwords: a student will not remember
 * one they set once in September, and a forgotten-password flow is just this
 * flow with extra steps.
 *
 * Nothing here is stored in a form that can be replayed. Both the login token
 * and the session token are kept only as SHA-256 hashes, so a database leak
 * hands an attacker no way into anyone's account.
 */

import type { Env } from '../types.ts'
import { newSecretToken, sha256Hex } from './ids.ts'
import { ApiError } from './http.ts'

/** A recovery link is short-lived on purpose — it is a password reset. */
const LINK_TTL_MINUTES = 30
/**
 * The link inside the confirmation email is a different animal. That email says
 * "keep this" and people open it in December. Thirty minutes and one use would
 * make it dead on arrival for anyone who didn't tap immediately, so it lives as
 * long as a session and can be reopened.
 *
 * The trade is that it becomes a bearer credential sitting in an inbox — which
 * is the same bargain every ticket email makes, and why buying an upgrade
 * re-checks rather than trusting the session alone.
 */
const PASS_LINK_TTL_DAYS = 120
/** Sessions last a season, so most people sign in exactly once. */
const SESSION_TTL_DAYS = 90
/** Someone guessing at codes gets a handful of tries, not unlimited. */
const MAX_ATTEMPTS = 5

export type Session = {
  registrationId: string
  publicCode: string
  name: string
  email: string
}

/* ------------------------------------------------------------------ *
 * Magic links
 * ------------------------------------------------------------------ */

/**
 * Mint a single-use sign-in token.
 *
 * Returns the raw token, which is the *only* time it exists in readable form —
 * it goes straight into an email and we keep nothing but its hash.
 */
export type TokenPurpose = 'magic_link' | 'otp' | 'pass_link'

export async function createLoginToken(
  env: Env,
  registrationId: string,
  purpose: TokenPurpose = 'magic_link',
): Promise<string> {
  const token = purpose === 'otp' ? sixDigitCode() : newSecretToken()
  const ttl =
    purpose === 'pass_link' ? `+${PASS_LINK_TTL_DAYS} days` : `+${LINK_TTL_MINUTES} minutes`

  await env.DB.prepare(
    `INSERT INTO login_tokens (token_hash, registration_id, purpose, expires_at)
     VALUES (?, ?, ?, datetime('now', ?))`,
  )
    .bind(await sha256Hex(token), registrationId, purpose, ttl)
    .run()

  return token
}

function sixDigitCode(): string {
  // Rejection sampling so every code is equally likely — a modulo here would
  // make some codes measurably more common than others.
  const max = 1_000_000
  const limit = Math.floor(0xffffffff / max) * max
  let n: number
  do {
    n = crypto.getRandomValues(new Uint32Array(1))[0]
  } while (n >= limit)
  return String(n % max).padStart(6, '0')
}

/**
 * Spend a login token and open a session.
 *
 * The token is marked used inside the same statement that checks it is unused,
 * so two simultaneous clicks on the same link cannot both succeed.
 */
export async function consumeLoginToken(env: Env, token: string): Promise<string> {
  const hash = await sha256Hex(token)

  const row = await env.DB.prepare(
    `SELECT registration_id, purpose, expires_at, used_at, attempts
       FROM login_tokens WHERE token_hash = ?`,
  )
    .bind(hash)
    .first<{
      registration_id: string
      purpose: string
      expires_at: string
      used_at: string | null
      attempts: number
    }>()

  if (!row) {
    throw new ApiError('unauthorised', 'That link is not valid. Ask for a new one.')
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    throw new ApiError('unauthorised', 'Too many attempts. Ask for a new link.')
  }

  const reusable = row.purpose === 'pass_link'

  if (!reusable && row.used_at) {
    throw new ApiError('unauthorised', 'That link has already been used. Ask for a new one.')
  }

  // A pass link records when it was last opened but is not spent by opening;
  // a recovery link is consumed by the same statement that checks it, so two
  // simultaneous clicks cannot both succeed.
  const spent = await env.DB.prepare(
    reusable
      ? `UPDATE login_tokens SET used_at = datetime('now')
          WHERE token_hash = ? AND expires_at > datetime('now')`
      : `UPDATE login_tokens SET used_at = datetime('now')
          WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')`,
  )
    .bind(hash)
    .run()

  if (!spent.meta.changes) {
    throw new ApiError('unauthorised', 'That link has expired. Ask for a new one.')
  }

  return row.registration_id
}

/** Record a wrong guess, so a brute-force run against a 6-digit code runs out. */
export async function recordFailedAttempt(env: Env, token: string): Promise<void> {
  await env.DB.prepare(
    'UPDATE login_tokens SET attempts = attempts + 1 WHERE token_hash = ?',
  )
    .bind(await sha256Hex(token))
    .run()
}

/* ------------------------------------------------------------------ *
 * Sessions
 * ------------------------------------------------------------------ */

export async function createSession(
  env: Env,
  registrationId: string,
  userAgent?: string,
): Promise<string> {
  const token = newSecretToken()

  await env.DB.prepare(
    `INSERT INTO sessions (token_hash, registration_id, expires_at, user_agent)
     VALUES (?, ?, datetime('now', ?), ?)`,
  )
    .bind(await sha256Hex(token), registrationId, `+${SESSION_TTL_DAYS} days`, userAgent ?? null)
    .run()

  return token
}

/**
 * Resolve a token to the person holding it, or null.
 *
 * Returns null rather than throwing, so callers can decide whether a route is
 * genuinely protected or merely personalised.
 */
export async function resolveSession(env: Env, token: string | null): Promise<Session | null> {
  if (!token) return null

  const row = await env.DB.prepare(
    `SELECT s.registration_id, r.public_code, r.name, r.email
       FROM sessions s JOIN registrations r ON r.id = s.registration_id
      WHERE s.token_hash = ?
        AND s.revoked_at IS NULL
        AND s.expires_at > datetime('now')`,
  )
    .bind(await sha256Hex(token))
    .first<{ registration_id: string; public_code: string; name: string; email: string }>()

  if (!row) return null

  // Fire and forget — a failed heartbeat should never fail the request.
  env.DB.prepare("UPDATE sessions SET last_seen_at = datetime('now') WHERE token_hash = ?")
    .bind(await sha256Hex(token))
    .run()
    .catch(() => {})

  return {
    registrationId: row.registration_id,
    publicCode: row.public_code,
    name: row.name,
    email: row.email,
  }
}

export async function revokeSession(env: Env, token: string): Promise<void> {
  await env.DB.prepare(
    "UPDATE sessions SET revoked_at = datetime('now') WHERE token_hash = ?",
  )
    .bind(await sha256Hex(token))
    .run()
}

/* ------------------------------------------------------------------ *
 * Reading the token off a request
 * ------------------------------------------------------------------ */

/**
 * Accept either a bearer token or a cookie.
 *
 * Right now the site is on github.io and the API on workers.dev — different
 * sites, so an httpOnly cookie would be a third-party cookie and Safari would
 * drop it. Bearer tokens work everywhere today. Once both live under one
 * domain (`pyrexia.in` and `api.pyrexia.in`) the cookie becomes first-party and
 * becomes the better option, so both are supported from the start.
 */
export function readToken(headers: Headers): string | null {
  const auth = headers.get('Authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim() || null

  const cookie = headers.get('Cookie')
  if (!cookie) return null
  const match = cookie.match(/(?:^|;\s*)pyx_session=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

export function sessionCookie(token: string): string {
  const maxAge = SESSION_TTL_DAYS * 24 * 60 * 60
  return `pyx_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${maxAge}`
}

export const clearedCookie = 'pyx_session=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0'
