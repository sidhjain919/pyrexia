/**
 * My Voyage — everything a signed-in person can see about themselves.
 *
 *   GET /api/me        who they are, what they own, what's left to buy
 *   GET /api/me/pass   the signed pass token their phone turns into a QR
 *
 * Both are strictly scoped to the session. There is no `?registrationId=`
 * anywhere in this file on purpose: the only person you can ever look up is
 * yourself.
 */

import { Hono } from 'hono'

import type { Env } from '../types.ts'
import { ApiError } from '../lib/http.ts'
import { importSigningKey } from '../lib/keys.ts'
import { signPass, PASS_VERSION, type Tier } from '../lib/pass.ts'
import { loadProducts, ownedProducts } from '../lib/pricing.ts'
import { readToken, resolveSession, type Session } from '../lib/session.ts'

export const me = new Hono<{ Bindings: Env; Variables: { session: Session } }>()

/** Every route below this line requires a valid session. */
me.use('/me/*', async (c, next) => {
  const session = await resolveSession(c.env, readToken(c.req.raw.headers))
  if (!session) throw new ApiError('unauthorised', 'Sign in to see this.')
  c.set('session', session)
  await next()
})

me.get('/me', async (c) => {
  const session = c.get('session')

  const registration = await c.env.DB.prepare(
    `SELECT r.public_code, r.name, r.email, r.phone, r.college, r.city, r.course, r.year,
            r.verification, r.verification_note, t.tier
       FROM registrations r JOIN registration_tier t ON t.registration_id = r.id
      WHERE r.id = ?`,
  )
    .bind(session.registrationId)
    .first<{
      public_code: string
      name: string
      email: string
      phone: string
      college: string
      city: string
      course: string
      year: string
      verification: string
      verification_note: string | null
      tier: number
    }>()

  if (!registration) throw new ApiError('not_found', 'That registration no longer exists.')

  const owned = await ownedProducts(c.env, session.registrationId)
  const products = await loadProducts(c.env)

  // What they could still buy: active, not already owned, prerequisites met.
  const available = [...products.values()]
    .filter((p) => p.active && !owned.has(p.id) && (!p.requires || owned.has(p.requires)))
    .map((p) => ({ id: p.id, name: p.name, amountPaise: p.amount_paise }))

  const { results: entries } = await c.env.DB.prepare(
    `SELECT event_name, territory_code, participation, team_name, created_at
       FROM event_entries
      WHERE registration_id = ? AND status = 'confirmed'
      ORDER BY created_at`,
  )
    .bind(session.registrationId)
    .all<{
      event_name: string
      territory_code: string
      participation: string
      team_name: string | null
      created_at: string
    }>()

  const pass = await c.env.DB.prepare(
    'SELECT id FROM passes WHERE registration_id = ? AND revoked_at IS NULL',
  )
    .bind(session.registrationId)
    .first<{ id: string }>()

  return c.json({
    publicCode: registration.public_code,
    name: registration.name,
    email: registration.email,
    phone: registration.phone,
    college: registration.college,
    city: registration.city,
    course: registration.course,
    year: registration.year,
    tier: registration.tier,
    tierName: registration.tier === 1 ? 'Delegate' : 'Basic Registration',
    owns: [...owned],
    available,
    verification: {
      state: registration.verification,
      note: registration.verification_note,
    },
    hasPass: !!pass,
    entries: entries.map((e) => ({
      eventName: e.event_name,
      territoryCode: e.territory_code,
      participation: e.participation,
      teamName: e.team_name,
      enteredAt: e.created_at,
    })),
  })
})

/**
 * The pass.
 *
 * The token is signed on every request rather than stored, so the signing key
 * only ever exists in memory during a request and a just-revoked pass stops
 * being handed out immediately.
 *
 * But it is signed from *fixed* inputs — the pass id and its original issue
 * time — so the result is byte-for-byte identical every time. A QR someone
 * downloaded in September matches the one on screen in October exactly.
 *
 * The one thing that does change it is an upgrade: the tier byte flips, so the
 * code differs before and after. Both still work, because the gate takes
 * whichever tier is higher between the signed floor and its synced list.
 */
me.get('/me/pass', async (c) => {
  const session = c.get('session')

  const row = await c.env.DB.prepare(
    `SELECT p.id, p.key_id, p.tier_floor, p.revoked_at, p.revoked_reason,
            CAST(strftime('%s', p.issued_at) AS INTEGER) / 60 AS issued_minute,
            r.name, r.college, r.public_code, t.tier
       FROM passes p
       JOIN registrations r ON r.id = p.registration_id
       JOIN registration_tier t ON t.registration_id = p.registration_id
      WHERE p.registration_id = ?
      ORDER BY p.issued_at DESC LIMIT 1`,
  )
    .bind(session.registrationId)
    .first<{
      id: string
      key_id: number
      tier_floor: number
      issued_minute: number
      revoked_at: string | null
      revoked_reason: string | null
      name: string
      college: string
      public_code: string
      tier: number
    }>()

  if (!row) {
    throw new ApiError(
      'payment_required',
      'No pass yet — complete your Basic Registration and it will appear here.',
    )
  }

  if (row.revoked_at) {
    throw new ApiError('forbidden', 'This pass has been cancelled.', {
      extra: { reason: row.revoked_reason },
    })
  }

  const signingKey = await importSigningKey(c.env.PASS_SIGNING_KEY_V1)

  const token = await signPass(
    {
      version: PASS_VERSION,
      kid: row.key_id,
      passId: row.id,
      // Sign the *current* tier so a freshly-fetched QR reflects an upgrade
      // straight away, without waiting for a gate to sync its manifest.
      tierFloor: Math.max(row.tier_floor, row.tier) as Tier,
      // The pass's own issue time, never "now". Stamping the current minute
      // made the QR image different on every open — same meaning, but a
      // downloaded copy no longer matched what the screen showed, which reads
      // as one of them being wrong. Now the code is byte-identical every time
      // and changes only when the tier genuinely changes.
      issuedAt: row.issued_minute,
    },
    signingKey,
  )

  return c.json({
    token,
    passId: row.id,
    publicCode: row.public_code,
    name: row.name,
    college: row.college,
    tier: row.tier,
    tierName: row.tier === 1 ? 'Delegate' : 'Basic Registration',
  })
})
