/**
 * Reconciliation sweep.
 *
 * The webhook is the source of truth, but it is delivered over a network and
 * networks lose things. Every fifteen minutes this asks Razorpay what actually
 * happened to any order we're still unsure about.
 *
 * The case it exists for: a student pays on 3G, the payment captures, and their
 * browser dies before the callback and our webhook delivery fails twice. They
 * are out ₹450 with nothing to show. This finds them without anyone filing a
 * complaint.
 */

import type { Env } from '../types.ts'
import { newId } from '../lib/ids.ts'
import { newPassId } from '../lib/pass.ts'
import * as audit from '../lib/audit.ts'
import { fetchOrderPayments } from '../lib/razorpay.ts'

/** Give the webhook a fair chance before going looking. */
const GRACE_MINUTES = 30
/** Abandoned checkouts get closed off so the sweep doesn't grow without bound. */
const EXPIRE_AFTER_HOURS = 24
/** Bounded per run: a cron tick should finish quickly and predictably. */
const BATCH = 50

export async function reconcileOrders(env: Env): Promise<void> {
  // Before the Razorpay secret is configured there is nothing to reconcile
  // against, and a cron that errors every fifteen minutes only buries the logs
  // that matter later.
  if (!env.RAZORPAY_KEY_SECRET) {
    console.log('reconcile skipped — RAZORPAY_KEY_SECRET not set')
    return
  }

  const cfg = {
    keyId: env.RAZORPAY_KEY_ID,
    keySecret: env.RAZORPAY_KEY_SECRET,
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
  }

  const { results: stale } = await env.DB.prepare(
    `SELECT id, registration_id, razorpay_order_id, amount_paise, created_at
       FROM orders
      WHERE status = 'created'
        AND razorpay_order_id IS NOT NULL
        AND created_at < datetime('now', ?)
      ORDER BY created_at
      LIMIT ?`,
  )
    .bind(`-${GRACE_MINUTES} minutes`, BATCH)
    .all<{
      id: string
      registration_id: string
      razorpay_order_id: string
      amount_paise: number
      created_at: string
    }>()

  for (const order of stale) {
    try {
      const payments = await fetchOrderPayments(cfg, order.razorpay_order_id)
      const captured = payments.find((p) => p.status === 'captured')

      if (captured) {
        if (captured.amount !== order.amount_paise) {
          // Never grant on a mismatch — surface it for a human instead.
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
      console.error('reconcile failed for', order.id, err)
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
