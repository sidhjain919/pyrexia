/**
 * Refunds: what a refund made on the Razorpay dashboard does to a registration.
 *
 * One function, reached from two directions. The webhook calls it the moment
 * Razorpay says a refund exists; the fifteen-minute sweep calls it for every
 * refund Razorpay lists, in case the webhook never arrived. Both hand over the
 * same shape and neither needs to know about the other: the `refunds` table
 * is keyed by Razorpay's id, so a refund seen twice is written once.
 *
 * What a refund undoes is decided by amount, not by the fact of it. The
 * committee refunds the fest's share and Razorpay keeps its fee, so the number
 * that comes back is never the number that was charged. An order is undone
 * when what has come back reaches what the fest was actually owed; anything
 * smaller is recorded, audited, and left standing — a partial refund of a
 * gateway charge must not cancel somebody's pass.
 */

import type { Env } from '../types.ts'
import * as audit from './audit.ts'
import type { RazorpayRefund } from './razorpay.ts'

export type RefundOutcome =
  /** Already in the ledger: nothing changed. */
  | 'seen'
  /** Recorded, but the order is not yet refunded in full. */
  | 'partial'
  /** The order is undone and what it bought is revoked. */
  | 'revoked'
  /** No order carries this payment id. Logged; nothing to undo. */
  | 'unmatched'

export async function applyRefund(
  env: Env,
  refund: RazorpayRefund,
  seenVia: 'webhook' | 'sweep',
): Promise<RefundOutcome> {
  const order = await env.DB.prepare(
    `SELECT id, registration_id, amount_paise, convenience_paise, refunded_paise, status
       FROM orders WHERE razorpay_payment_id = ?`,
  )
    .bind(refund.payment_id)
    .first<{
      id: string
      registration_id: string
      amount_paise: number
      convenience_paise: number
      refunded_paise: number
      status: string
    }>()

  if (!order) {
    console.warn('refund for a payment we never recorded', refund.id, refund.payment_id)
    return 'unmatched'
  }

  // The ledger is the idempotency guard. `INSERT OR IGNORE` on the primary
  // key means the second path to notice this refund writes nothing and stops.
  const inserted = await env.DB.prepare(
    `INSERT OR IGNORE INTO refunds (id, order_id, payment_id, amount_paise, status, seen_via)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(refund.id, order.id, refund.payment_id, refund.amount, refund.status, seenVia)
    .run()
  if (!inserted.meta.changes) return 'seen'

  const refundedPaise = order.refunded_paise + refund.amount
  // The fest's share: the gateway charge was Razorpay's and is not refunded.
  const owedPaise = order.amount_paise - order.convenience_paise
  const undone = refundedPaise >= owedPaise

  await audit.record(env, {
    action: 'refund.create',
    entity: 'order',
    entityId: order.id,
    after: {
      refundId: refund.id,
      amountPaise: refund.amount,
      refundedPaise,
      owedPaise,
      seenVia,
      outcome: undone ? 'revoked' : 'partial',
    },
  })

  if (!undone) {
    await env.DB.prepare(
      `UPDATE orders SET refunded_paise = ?, updated_at = datetime('now') WHERE id = ?`,
    )
      .bind(refundedPaise, order.id)
      .run()
    return 'partial'
  }

  // Revoke what this order bought. An event entry order confirms an entry
  // rather than granting an entitlement, so its entry is withdrawn instead.
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE orders
          SET status = 'refunded', refunded_paise = ?, updated_at = datetime('now')
        WHERE id = ?`,
    ).bind(refundedPaise, order.id),
    env.DB.prepare(
      `UPDATE entitlements
          SET revoked_at = datetime('now'), revoked_reason = 'refunded'
        WHERE order_id = ? AND revoked_at IS NULL`,
    ).bind(order.id),
    env.DB.prepare(
      `UPDATE event_entries SET status = 'withdrawn'
        WHERE id = (SELECT event_entry_id FROM orders WHERE id = ?)
          AND status IN ('confirmed', 'pending')`,
    ).bind(order.id),
  ])

  // Only kill the pass if nothing is left standing: a refunded Festival Pass
  // upgrade should leave a Basic holder still able to walk in.
  const remaining = await env.DB.prepare(
    'SELECT count(*) AS n FROM entitlements WHERE registration_id = ? AND revoked_at IS NULL',
  )
    .bind(order.registration_id)
    .first<{ n: number }>()

  if ((remaining?.n ?? 0) === 0) {
    const pass = await env.DB.prepare(
      'SELECT id FROM passes WHERE registration_id = ? AND revoked_at IS NULL',
    )
      .bind(order.registration_id)
      .first<{ id: string }>()

    await env.DB.batch([
      env.DB.prepare(
        `UPDATE passes
            SET revoked_at = datetime('now'), revoked_reason = 'refunded'
          WHERE registration_id = ? AND revoked_at IS NULL`,
      ).bind(order.registration_id),
      env.DB.prepare(
        `UPDATE registrations SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`,
      ).bind(order.registration_id),
    ])

    if (pass) {
      await audit.record(env, {
        action: 'pass.revoke',
        entity: 'pass',
        entityId: pass.id,
        after: { registrationId: order.registration_id, reason: 'refunded', refundId: refund.id },
      })
    }
  }

  await audit.record(env, {
    action: 'entitlement.revoke',
    entity: 'order',
    entityId: order.id,
    after: { refundId: refund.id, amountPaise: refund.amount, remaining: remaining?.n ?? 0 },
  })

  return 'revoked'
}
