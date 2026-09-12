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
import { fetchPayment, type RazorpayConfig, type RazorpayRefund } from './razorpay.ts'
import { requestSheetSyncForEntry } from '../jobs/sheets.ts'

export type RefundOutcome =
  /** Already in the ledger: nothing changed. */
  | 'seen'
  /** Recorded, but the order is not yet refunded in full. */
  | 'partial'
  /** The order is undone and what it bought is revoked. */
  | 'revoked'
  /**
   * The payment was on an order we had already marked failed or expired, so
   * nothing was ever granted and there is nothing to revoke: the refund is
   * booked against that order so the money is accounted for.
   */
  | 'written_off'
  /** No order carries this payment. Audited; nothing to undo. */
  | 'unmatched'

type OrderRow = {
  id: string
  registration_id: string
  amount_paise: number
  convenience_paise: number
  refunded_paise: number
  status: string
}

const ORDER_COLS = 'id, registration_id, amount_paise, convenience_paise, refunded_paise, status'

export async function applyRefund(
  env: Env,
  refund: RazorpayRefund,
  seenVia: 'webhook' | 'sweep',
  /** Needed only to look a stray payment up at Razorpay; the webhook path can pass it too. */
  cfg?: RazorpayConfig,
): Promise<RefundOutcome> {
  let order = await env.DB.prepare(`SELECT ${ORDER_COLS} FROM orders WHERE razorpay_payment_id = ?`)
    .bind(refund.payment_id)
    .first<OrderRow>()

  /*
   * No order carries this payment id. The first live refund was exactly this:
   * a student's third attempt on an order our webhook had already marked
   * failed captured, the capture webhook never arrived, and the committee
   * refunded by hand. The payment still belongs to one of our orders — Razorpay
   * knows which — so ask, and book the refund there.
   */
  let writtenOff = false
  /** What Razorpay knows about the payment, kept for the audit row if nothing matches. */
  let stray: Record<string, unknown> | null = null
  if (!order && cfg) {
    try {
      const payment = await fetchPayment(cfg, refund.payment_id)
      stray = {
        razorpayOrderId: payment.order_id ?? null,
        paymentStatus: payment.status,
        amountPaise: payment.amount,
        amountRefundedPaise: payment.amount_refunded ?? null,
        email: payment.email ?? null,
        contact: payment.contact ?? null,
        paidAtUnix: payment.created_at ?? null,
      }
      const byOrder = await env.DB.prepare(
        `SELECT ${ORDER_COLS} FROM orders WHERE razorpay_order_id = ?`,
      )
        .bind(payment.order_id)
        .first<OrderRow>()
      // Only an order that never granted anything can be written off here. A
      // paid order with a different payment id is a puzzle for a human.
      if (byOrder && byOrder.status !== 'paid') {
        order = byOrder
        writtenOff = true
      }
    } catch (err) {
      console.error('could not look up payment for refund', refund.id, err)
    }
  }

  if (!order) {
    console.warn('refund for a payment we never recorded', refund.id, refund.payment_id)
    await audit.record(env, {
      action: 'refund.create',
      entity: 'refund',
      entityId: refund.id,
      // Everything a human needs to find this money by hand: the order
      // Razorpay attached it to and who paid, since none of ours claims it.
      after: { paymentId: refund.payment_id, amountPaise: refund.amount, seenVia, outcome: 'unmatched', payment: stray },
    })
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
      paymentId: refund.payment_id,
      amountPaise: refund.amount,
      refundedPaise,
      owedPaise,
      seenVia,
      outcome: writtenOff ? 'written_off' : undone ? 'revoked' : 'partial',
    },
  })

  if (writtenOff) {
    // Nothing was granted on this order, so there is nothing to revoke: it is
    // marked refunded, pinned to the payment that was actually taken, and the
    // person's registration stays exactly where it was — pending.
    await env.DB.prepare(
      `UPDATE orders
          SET status = 'refunded', razorpay_payment_id = ?, refunded_paise = ?,
              updated_at = datetime('now')
        WHERE id = ?`,
    )
      .bind(refund.payment_id, refundedPaise, order.id)
      .run()
    return 'written_off'
  }

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

  const entry = await env.DB.prepare('SELECT event_entry_id FROM orders WHERE id = ?')
    .bind(order.id)
    .first<{ event_entry_id: string | null }>()
  await requestSheetSyncForEntry(env, entry?.event_entry_id)

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
