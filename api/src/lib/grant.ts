/**
 * Issuing a pass.
 *
 * One copy, three callers. This lived twice before, once in the Razorpay
 * webhook and once in the reconciliation sweep, as `issuePassIfNeeded` and
 * `issuePassIfMissing`: the same twenty lines, drifting apart. The desk would
 * have made it three, which is the point at which a rule about who gets a
 * pass stops being a rule and becomes three opinions.
 */

import type { Env } from '../types.ts'
import { newPassId } from './pass.ts'
import * as audit from './audit.ts'

/**
 * Issue a pass, once, per registration.
 *
 * `tier_floor` records what they hold at this moment. If they upgrade later
 * the row is untouched: the gate reads the current tier from the synced
 * manifest and takes whichever is higher, so an already-printed QR keeps
 * working.
 *
 * Safe to call twice. A registration that already has a live pass keeps it.
 */
export async function issuePassIfNeeded(env: Env, registrationId: string): Promise<void> {
  const existing = await env.DB.prepare(
    'SELECT id FROM passes WHERE registration_id = ? AND revoked_at IS NULL',
  )
    .bind(registrationId)
    .first<{ id: string }>()

  if (existing) return

  const tier = await env.DB.prepare(
    'SELECT tier FROM registration_tier WHERE registration_id = ?',
  )
    .bind(registrationId)
    .first<{ tier: number }>()

  const passId = newPassId()
  const keyId = Number(env.PASS_KEY_ID ?? '1')

  await env.DB.prepare(
    'INSERT INTO passes (id, registration_id, tier_floor, key_id) VALUES (?, ?, ?, ?)',
  )
    .bind(passId, registrationId, tier?.tier ?? 0, keyId)
    .run()

  await audit.record(env, {
    action: 'pass.issue',
    entity: 'pass',
    entityId: passId,
    after: { registrationId, tierFloor: tier?.tier ?? 0, keyId },
  })

  await env.JOBS.send({ kind: 'pass.render_pdf', passId })
}
