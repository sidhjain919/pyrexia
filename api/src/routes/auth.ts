/**
 * Signing in.
 *
 *   POST /api/auth/request      "email me a way back in"
 *   POST /api/auth/consume      spend a link or code, get a session
 *   POST /api/auth/logout
 *
 * Two things this deliberately does *not* do:
 *
 *  - It never says whether an email is registered. "If that email is
 *    registered, we've sent a link" is the same answer either way, so nobody
 *    can use this endpoint to work out who has bought a pass.
 *  - It never lets anyone in who hasn't paid. A pending registration has no
 *    account to sign in to.
 */

import { Hono } from 'hono'

import type { Env } from '../types.ts'
import { ApiError, clientIp, readJson } from '../lib/http.ts'
import { normaliseEmail, normalisePhone } from '../lib/validate.ts'
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

/** Requests per identifier per hour, counted in KV. */
const MAX_REQUESTS_PER_HOUR = 5

auth.post('/auth/request', async (c) => {
  const body = (await readJson(c)) as Record<string, unknown>
  const raw = String(body.identifier ?? '').trim()

  // A deliberately vague reply, returned on every path below.
  const vague = {
    sent: true,
    message: 'If that account exists, a sign-in link is on its way to the registered email.',
  }

  if (!raw) throw new ApiError('bad_request', 'Enter the email or mobile you registered with.')

  // Rate limit by what they typed, so guessing at emails is slow and boring.
  const bucket = `login:${await hashish(raw)}`
  const seen = Number((await c.env.KV.get(bucket)) ?? '0')
  if (seen >= MAX_REQUESTS_PER_HOUR) {
    throw new ApiError('rate_limited', 'Too many sign-in requests. Try again in an hour.')
  }
  await c.env.KV.put(bucket, String(seen + 1), { expirationTtl: 3600 })

  const email = normaliseEmail(raw)
  const phone = normalisePhone(raw)

  const registration = await c.env.DB.prepare(
    `SELECT id, name, email FROM registrations
      WHERE status = 'confirmed' AND (lower(email) = ? OR phone = ?) LIMIT 1`,
  )
    .bind(email, phone)
    .first<{ id: string; name: string; email: string }>()

  // No match: stop here, but return exactly the same thing as a match would.
  if (!registration) return c.json(vague)

  const token = await createLoginToken(c.env, registration.id, 'magic_link')

  await c.env.JOBS.send({
    kind: 'email.sign_in_link',
    registrationId: registration.id,
    token,
  })

  await audit.record(c.env, {
    action: 'auth.link_requested',
    entity: 'registration',
    entityId: registration.id,
    ip: clientIp(c),
  })

  // Outside production the link comes back in the response so the flow can be
  // tested before the mailer exists. This must never be reachable in prod.
  if (c.env.ENVIRONMENT !== 'production') {
    return c.json({ ...vague, devToken: token })
  }

  return c.json(vague)
})

auth.post('/auth/consume', async (c) => {
  const body = (await readJson(c)) as Record<string, unknown>
  const token = String(body.token ?? '').trim()

  if (!token) throw new ApiError('bad_request', 'Missing sign-in token.')

  let registrationId: string
  try {
    registrationId = await consumeLoginToken(c.env, token)
  } catch (err) {
    // Count the miss so a short code cannot be brute-forced.
    await recordFailedAttempt(c.env, token).catch(() => {})
    throw err
  }

  const session = await createSession(c.env, registrationId, c.req.header('User-Agent'))

  await audit.record(c.env, {
    action: 'auth.signed_in',
    entity: 'registration',
    entityId: registrationId,
    ip: clientIp(c),
  })

  c.header('Set-Cookie', sessionCookie(session))

  // The token is returned as well as set as a cookie: the site and the API are
  // on different domains today, where a cookie would be third-party and get
  // dropped. See the note in lib/session.ts.
  return c.json({ token: session, registrationId })
})

auth.post('/auth/logout', async (c) => {
  const token = readToken(c.req.raw.headers)
  if (token) await revokeSession(c.env, token)
  c.header('Set-Cookie', clearedCookie)
  return c.json({ ok: true })
})

/** Short, stable, non-reversible bucket key for rate limiting. */
async function hashish(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest).slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('')
}
