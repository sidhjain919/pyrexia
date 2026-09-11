/**
 * Reconciliation sweep.
 *
 * The webhook is the source of truth, but it is delivered over a network and
 * networks lose things. Every fifteen minutes this asks Razorpay what actually
 * happened to any order we're still unsure about.
 *
 * The case it exists for: a student pays on 3G, the payment captures, and their
 * browser dies before the callback and our webhook delivery fails twice. They
 * are out ₹500 with nothing to show. This finds them without anyone filing a
 * complaint.
 */

import type { Env } from '../types.ts'
import { newId } from '../lib/ids.ts'
import { newPassId } from '../lib/pass.ts'
import * as audit from '../lib/audit.ts'
import { RazorpayError, fetchOrderPayments, fetchRefunds } from '../lib/razorpay.ts'
import { applyRefund } from '../lib/refunds.ts'

/** Give the webhook a fair chance before going looking. */
const GRACE_MINUTES = 30
/** Abandoned checkouts get closed off so the sweep doesn't grow without bound. */
const EXPIRE_AFTER_HOURS = 24
/** Bounded per run: a cron tick should finish quickly and predictably. */
const BATCH = 50
/**
 * How long a failed or expired order stays worth a second look.
 *
 * Razorpay lets a student retry on the same order after a failure, and the
 * retry's capture webhook is as losable as any other. An order we wrote off
 * as failed can therefore be sitting on real money. Fourteen days covers every
 * retry anyone is going to make; after that the order is genuinely dead.
 */
const RECHECK_DAYS = 14

export async function reconcileOrders(env: Env): Promise<void> {
  // Before the Razorpay secret is configured there is nothing to reconcile
  // against, and a cron that errors every fifteen minutes only buries the logs
  // that matter later.
  if (!env.RAZORPAY_KEY_SECRET) {
    console.log('reconcile skipped, RAZORPAY_KEY_SECRET not set')
    return
  }

  const cfg = {
    keyId: env.RAZORPAY_KEY_ID,
    keySecret: env.RAZORPAY_KEY_SECRET,
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
  }

  // Two populations, one question: has Razorpay captured money on this order
  // that we never heard about? `created` orders past the grace period are the
  // ordinary case. `failed` and `expired` ones are the retries — an order our
  // webhook marked failed at 10:05 on which the student paid at 10:06.
  const { results: stale } = await env.DB.prepare(
    `SELECT id, registration_id, razorpay_order_id, amount_paise, status, created_at
       FROM orders
      WHERE razorpay_order_id IS NOT NULL
        AND (
          (status = 'created' AND created_at < datetime('now', ?))
          OR (status IN ('failed', 'expired') AND created_at > datetime('now', ?)
              AND (failure_reason IS NULL OR failure_reason NOT LIKE 'razorpay % on recheck'))
        )
      ORDER BY created_at
      LIMIT ?`,
  )
    .bind(`-${GRACE_MINUTES} minutes`, `-${RECHECK_DAYS} days`, BATCH)
    .all<{
      id: string
      registration_id: string
      razorpay_order_id: string
      amount_paise: number
      status: string
      created_at: string
    }>()

  for (const order of stale) {
    try {
      const payments = await fetchOrderPayments(cfg, order.razorpay_order_id)
      const captured = payments.find((p) => p.status === 'captured' || p.status === 'refunded')

      if (captured) {
        // Captured and then refunded at the dashboard: nothing to grant. The
        // refund sweep books it against this order; settling it here would
        // issue a pass and send a confirmation to somebody who has their
        // money back.
        if (captured.status === 'refunded' || (captured.amount_refunded ?? 0) > 0) continue

        if (captured.amount !== order.amount_paise) {
          // Never grant on a mismatch: surface it for a human instead.
          await audit.record(env, {
            action: 'order.reconciled',
            entity: 'order',
            entityId: order.id,
            after: {
              outcome: 'amount_mismatch',
              expected: order.amount_paise,
              received: captured.amount,
            },
          })
          continue
        }

        await settle(env, order, captured)
        continue
      }

      // A failed or expired order with no capture is what it says it is.
      if (order.status !== 'created') continue

      // Nothing captured and it has been sitting long enough that nobody is
      // still at the checkout. Close it so the student can start again cleanly.
      const ageHours =
        (Date.now() - new Date(`${order.created_at.replace(' ', 'T')}Z`).getTime()) / 3_600_000

      if (ageHours > EXPIRE_AFTER_HOURS) {
        await env.DB.prepare(
          `UPDATE orders SET status = 'expired', updated_at = datetime('now')
            WHERE id = ? AND status = 'created'`,
        )
          .bind(order.id)
          .run()

        await audit.record(env, {
          action: 'order.reconciled',
          entity: 'order',
          entityId: order.id,
          after: { outcome: 'expired', ageHours: Math.round(ageHours) },
        })
      }
    } catch (err) {
      // One bad order must not stop the sweep; it will be picked up next tick.
      // A 4xx on a failed or expired order means Razorpay no longer has it,
      // which is the same as "no capture": note it and stop asking.
      const status = err instanceof RazorpayError ? err.status : null
      console.error('reconcile failed for', order.id, order.status, status, err instanceof Error ? err.message : err)
      if (order.status !== 'created' && status !== null && status >= 400 && status < 500) {
        await env.DB.prepare(
          `UPDATE orders SET failure_reason = COALESCE(failure_reason, ?), updated_at = datetime('now')
            WHERE id = ?`,
        )
          .bind(`razorpay ${status} on recheck`, order.id)
          .run()
      }
    }
  }
}

/**
 * Apply a capture the webhook never delivered.
 *
 * Every write here is guarded the same way the webhook's are, so if the webhook
 * turns up late the two cannot double-grant.
 */
async function settle(
  env: Env,
  order: { id: string; registration_id: string },
  payment: { id: string; amount: number; method?: string; fee?: number; tax?: number },
): Promise<void> {
  const { results: items } = await env.DB.prepare(
    'SELECT product_id FROM order_items WHERE order_id = ?',
  )
    .bind(order.id)
    .all<{ product_id: string }>()

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE orders
          SET status = 'paid',
              razorpay_payment_id = COALESCE(razorpay_payment_id, ?),
              method = COALESCE(method, ?),
              fee_paise = COALESCE(fee_paise, ?),
              tax_paise = COALESCE(tax_paise, ?),
              paid_at = COALESCE(paid_at, datetime('now')),
              updated_at = datetime('now')
        WHERE id = ? AND status != 'paid'`,
    ).bind(payment.id, payment.method ?? null, payment.fee ?? null, payment.tax ?? null, order.id),

    env.DB.prepare(
      `UPDATE registrations SET status = 'confirmed', updated_at = datetime('now')
        WHERE id = ? AND status = 'pending'`,
    ).bind(order.registration_id),

    ...items.map((item) =>
      env.DB.prepare(
        `INSERT OR IGNORE INTO entitlements (id, registration_id, product_id, order_id)
         VALUES (?, ?, ?, ?)`,
      ).bind(newId(), order.registration_id, item.product_id, order.id),
    ),
  ])

  const existingPass = await env.DB.prepare(
    'SELECT id FROM passes WHERE registration_id = ? AND revoked_at IS NULL',
  )
    .bind(order.registration_id)
    .first<{ id: string }>()

  if (!existingPass) {
    const tier = await env.DB.prepare(
      'SELECT tier FROM registration_tier WHERE registration_id = ?',
    )
      .bind(order.registration_id)
      .first<{ tier: number }>()

    const passId = newPassId()
    await env.DB.prepare(
      'INSERT INTO passes (id, registration_id, tier_floor, key_id) VALUES (?, ?, ?, ?)',
    )
      .bind(passId, order.registration_id, tier?.tier ?? 0, Number(env.PASS_KEY_ID ?? '1'))
      .run()

    await env.JOBS.send({ kind: 'pass.render_pdf', passId })
  }

  await audit.record(env, {
    action: 'order.reconciled',
    entity: 'order',
    entityId: order.id,
    after: {
      outcome: 'settled_from_razorpay',
      paymentId: payment.id,
      feePaise: payment.fee ?? null,
      taxPaise: payment.tax ?? null,
    },
  })

  await env.JOBS.send({
    kind: 'email.registration_confirmed',
    registrationId: order.registration_id,
    orderId: order.id,
  })
}

/* ------------------------------------------------------------------ *
 * Refunds the webhook never told us about
 * ------------------------------------------------------------------ */

/** How far back to look. Generous, because a missed webhook is not noticed the same day. */
const REFUND_LOOKBACK_DAYS = 30

/**
 * Ask Razorpay for every refund of the last month and make sure each one is
 * in the ledger.
 *
 * This exists because the first real refund was made on the dashboard and
 * never appeared here: the webhook handler was right, and the webhook did
 * not arrive. One list call a tick, however many orders there are, and the
 * ledger's primary key makes re-reading the same refunds every fifteen
 * minutes free.
 */
export async function reconcileRefunds(env: Env): Promise<void> {
  if (!env.RAZORPAY_KEY_SECRET) return

  const cfg = {
    keyId: env.RAZORPAY_KEY_ID,
    keySecret: env.RAZORPAY_KEY_SECRET,
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
  }

  let refunds
  try {
    refunds = await fetchRefunds(cfg, {
      fromUnix: Date.now() / 1000 - REFUND_LOOKBACK_DAYS * 86_400,
    })
  } catch (err) {
    console.error('refund sweep could not list refunds', err)
    return
  }

  for (const refund of refunds) {
    try {
      const outcome = await applyRefund(env, refund, 'sweep', cfg)
      if (outcome !== 'seen') console.log('refund sweep', refund.id, outcome)
    } catch (err) {
      console.error('refund sweep failed for', refund.id, err)
    }
  }
}
