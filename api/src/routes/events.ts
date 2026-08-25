/**
 * Event entry.
 *
 *   GET  /api/events/:name        what this event needs, and whether you're in
 *   POST /api/me/events           enter one
 *   DELETE /api/me/events/:name   withdraw
 *
 * No money changes hands here. Basic Registration already covers competing in
 * any event — that is the whole point of it — so the only gate is "do you hold
 * a live entitlement", checked against the session rather than a number the
 * visitor typed.
 */

import { Hono } from 'hono'

import type { Env } from '../types.ts'
import { ApiError, readJson } from '../lib/http.ts'
import { newEntryId } from '../lib/ids.ts'
import { EVENT_REGISTRATION_OPEN, allowsTeam, requiresTeam, resolveEvent } from '../data/events.ts'
import { readToken, resolveSession } from '../lib/session.ts'
import * as audit from '../lib/audit.ts'

export const events = new Hono<{ Bindings: Env }>()

/**
 * Public: describe an event and, if the caller happens to be signed in, tell
 * them where they stand with it.
 *
 * Deliberately readable without a session — someone browsing should be able to
 * see what an event asks for before deciding whether to register at all.
 */
events.get('/events/:name', async (c) => {
  const name = decodeURIComponent(c.req.param('name'))
  const resolved = resolveEvent(name)
  if (!resolved) throw new ApiError('not_found', "That event isn't on the chart.")

  const session = await resolveSession(c.env, readToken(c.req.raw.headers))

  let entered = false
  let eligible = false

  if (session) {
    const entitlement = await c.env.DB.prepare(
      `SELECT 1 AS ok FROM entitlements
        WHERE registration_id = ? AND product_id = 'basic' AND revoked_at IS NULL`,
    )
      .bind(session.registrationId)
      .first<{ ok: number }>()
    eligible = !!entitlement

    const existing = await c.env.DB.prepare(
      `SELECT 1 AS ok FROM event_entries
        WHERE registration_id = ? AND event_name = ? AND status = 'confirmed'`,
    )
      .bind(session.registrationId, name)
      .first<{ ok: number }>()
    entered = !!existing
  }

  return c.json({
    name: resolved.name,
    tag: resolved.tag,
    territory: { code: resolved.territory.code, name: resolved.territory.territory },
    open: EVENT_REGISTRATION_OPEN,
    form: {
      participation: resolved.form.participation,
      teamSize: resolved.form.teamSize ?? null,
      fields: resolved.form.fields,
      note: resolved.form.note ?? null,
      allowsTeam: allowsTeam(resolved.form),
      requiresTeam: requiresTeam(resolved.form),
    },
    signedIn: !!session,
    eligible,
    entered,
  })
})

/* ------------------------------------------------------------------ *
 * Entering
 * ------------------------------------------------------------------ */

events.post('/me/events', async (c) => {
  const session = await resolveSession(c.env, readToken(c.req.raw.headers))
  if (!session) throw new ApiError('unauthorised', 'Sign in to enter an event.')

  if (!EVENT_REGISTRATION_OPEN) {
    throw new ApiError('forbidden', 'Event entries are not open yet.')
  }

  const body = (await readJson(c)) as Record<string, unknown>
  const name = String(body.eventName ?? '').trim()

  const resolved = resolveEvent(name)
  if (!resolved) throw new ApiError('not_found', "That event isn't on the chart.")

  // Basic Registration is the only thing standing between a person and an
  // event. Checked here rather than trusted from the client.
  const entitlement = await c.env.DB.prepare(
    `SELECT 1 AS ok FROM entitlements
      WHERE registration_id = ? AND product_id = 'basic' AND revoked_at IS NULL`,
  )
    .bind(session.registrationId)
    .first<{ ok: number }>()

  if (!entitlement) {
    throw new ApiError(
      'payment_required',
      'Complete your Basic Registration before entering an event.',
    )
  }

  const asTeam = body.participation === 'team'
  const teamName = String(body.teamName ?? '').trim()
  const answers = (body.answers ?? {}) as Record<string, unknown>

  const fieldErrors: Record<string, string> = {}
  for (const field of resolved.form.fields) {
    const value = String(answers[field.id] ?? '').trim()
    if (field.required && !value) fieldErrors[field.id] = 'Required.'
    if (value.length > 1000) fieldErrors[field.id] = 'That answer is too long.'
  }

  if (requiresTeam(resolved.form) && !asTeam) {
    fieldErrors.participation = 'This event is entered as a team.'
  }
  if (asTeam && teamName.length < 2) {
    fieldErrors.teamName = 'Give your crew a name.'
  }
  if (Object.keys(fieldErrors).length) {
    throw new ApiError('validation_failed', 'Some answers need another look.', {
      fields: fieldErrors,
    })
  }

  const entryId = newEntryId()

  try {
    await c.env.DB.prepare(
      `INSERT INTO event_entries
         (id, registration_id, event_name, territory_code, participation, team_name, answers)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        entryId,
        session.registrationId,
        resolved.name,
        resolved.territory.code,
        asTeam ? 'team' : 'solo',
        asTeam ? teamName : null,
        JSON.stringify(
          Object.fromEntries(
            resolved.form.fields.map((f) => [f.id, String(answers[f.id] ?? '').trim()]),
          ),
        ),
      )
      .run()
  } catch {
    // The unique index on (registration_id, event_name) fired.
    throw new ApiError('conflict', `You're already entered for ${resolved.name}.`)
  }

  await audit.record(c.env, {
    action: 'event.enter',
    entity: 'event_entry',
    entityId: entryId,
    after: { registrationId: session.registrationId, eventName: resolved.name },
  })

  return c.json({ entryId, eventName: resolved.name, participation: asTeam ? 'team' : 'solo' }, 201)
})

events.delete('/me/events/:name', async (c) => {
  const session = await resolveSession(c.env, readToken(c.req.raw.headers))
  if (!session) throw new ApiError('unauthorised', 'Sign in first.')

  const name = decodeURIComponent(c.req.param('name'))

  const result = await c.env.DB.prepare(
    `UPDATE event_entries SET status = 'withdrawn'
      WHERE registration_id = ? AND event_name = ? AND status = 'confirmed'`,
  )
    .bind(session.registrationId, name)
    .run()

  if (!result.meta.changes) throw new ApiError('not_found', "You aren't entered for that.")

  await audit.record(c.env, {
    action: 'event.withdraw',
    entity: 'event_entry',
    entityId: name,
    after: { registrationId: session.registrationId },
  })

  return c.json({ ok: true })
})
