/**
 * Razorpay webhooks: the source of truth for money.
 *
 * This is the only place in the codebase that grants an entitlement or issues a
 * pass. Everything else observes; this decides.
 *
 * Three properties it has to hold:
 *
 *  - **Verified.** The signature is checked against the raw bytes before the
 *    body is even parsed. An unsigned request is not read, let alone acted on.
 *  - **Idempotent.** Razorpay retries, sometimes for days. Granting is guarded
 *    by unique constraints, so the second and fiftieth delivery change nothing.
 *  - **Fast.** Razorpay retries anything slow. Emails and PDFs go on the queue;
 *    this handler only writes rows.
 */

import { Hono } from 'hono'

import type { Env } from '../types.ts'
import { readRaw } from '../lib/http.ts'
import { newId } from '../lib/ids.ts'
import { newPassId } from '../lib/pass.ts'
import * as audit from '../lib/audit.ts'
import { isHandledEvent, razorpayConfig, verifyWebhookSignature, type WebhookEvent } from '../lib/razorpay.ts'
import { applyRefund } from '../lib/refunds.ts'
import { requestSheetSyncForEntry } from '../jobs/sheets.ts'

export const webhooks = new Hono<{ Bindings: Env }>()

webhooks.post('/razorpay', async (c) => {
  // The raw body, kept exactly as sent. Parsing first and re-serialising would
  // reorder keys and the signature would never match again.
  const raw = await readRaw(c)
  const signature = c.req.header('X-Razorpay-Signature') ?? null

  const valid = await verifyWebhookSignature(raw, signature, c.env.RAZORPAY_WEBHOOK_SECRET)
  if (!valid) {
    // Deliberately terse: an attacker probing this endpoint learns nothing.
    console.warn('rejected webhook with bad signature')
    return c.json({ ok: false }, 401)
  }

  let event: WebhookEvent
  try {
    event = JSON.parse(raw) as WebhookEvent
  } catch {
    return c.json({ ok: false }, 400)
  }

  // Acknowledge everything we don't act on. A 200 stops Razorpay retrying an
  // event we were never going to care about.
  if (!isHandledEvent(event.event)) {
    return c.json({ ok: true, ignored: event.event })
  }

  try {
    switch (event.event) {
      case 'payment.captured':
        await onPaymentCaptured(c.env, event)
        break
      case 'payment.failed':
        await onPaymentFailed(c.env, event)
        break
      case 'refund.created':
      case 'refund.processed':
        if (event.payload.refund?.entity) {
          await applyRefund(c.env, event.payload.refund.entity, 'webhook', razorpayConfig(c.env))
        }
        break
    }
  } catch (err) {
    // A 500 asks Razorpay to retry, which is what we want for a transient
    // failure: better a duplicate delivery into idempotent code than a
    // payment that never becomes a pass.
    console.error('webhook handler failed', event.event, err)
    return c.json({ ok: false }, 500)
  }

  return c.json({ ok: true })
})

/* ------------------------------------------------------------------ *
 * payment.captured, the only path that grants anything
 * ------------------------------------------------------------------ */

async function onPaymentCaptured(env: Env, event: WebhookEvent): Promise<void> {
  const payment = event.payload.payment?.entity
  if (!payment) return

  const order = await env.DB.prepare(
    `SELECT id, registration_id, amount_paise, status, kind, event_entry_id,
            accommodation_booking_id
       FROM orders WHERE razorpay_order_id = ?`,
  )
    .bind(payment.order_id)
    .first<{
      id: string
      registration_id: string
      amount_paise: number
      status: string
      kind: string
      event_entry_id: string | null
      accommodation_booking_id: string | null
    }>()

  if (!order) {
    console.error('captured payment for an unknown order', payment.order_id)
    return
  }

  // Already settled by an earlier delivery of this same event. Nothing to do,
  // and importantly nothing to double.
  if (order.status === 'paid') return

  // Guard against a captured amount that doesn't match what we asked for. This
  // should be impossible: Razorpay charges what the order said, but if it
  // ever isn't, we want it visible rather than silently granting a pass.
  if (payment.amount !== order.amount_paise) {
    await audit.record(env, {
      action: 'order.failed',
      entity: 'order',
      entityId: order.id,
      after: {
        reason: 'amount_mismatch',
        expected: order.amount_paise,
        received: payment.amount,
        paymentId: payment.id,
      },
    })
    console.error('amount mismatch on', order.id, order.amount_paise, payment.amount)
    return
  }

  const items = await env.DB.prepare(
    'SELECT product_id FROM order_items WHERE order_id = ?',
  )
    .bind(order.id)
    .all<{ product_id: string }>()

  /*
   * An entry order buys one place in one event. It has no line items, so it
   * grants no entitlements; what it does is turn a pending entry into a
   * confirmed one. Guarded by the status check so a repeat delivery of the
   * same webhook is a no-op rather than a second confirmation.
   */
  const entryStatements: D1PreparedStatement[] =
    order.kind === 'event' && order.event_entry_id
      ? [
          env.DB.prepare(
            `UPDATE event_entries SET status = 'confirmed'
              WHERE id = ? AND status = 'pending'`,
          ).bind(order.event_entry_id),
        ]
      : []

  /*
   * An accommodation order buys a bed. Like an entry order it has no line
   * items and grants no entitlement; what it does is turn a pending booking
   * into a confirmed one. The status guard makes a repeat delivery a no-op.
   */
  const bookingStatements: D1PreparedStatement[] =
    order.kind === 'accommodation' && order.accommodation_booking_id
      ? [
          env.DB.prepare(
            `UPDATE accommodation_bookings
                SET status = 'confirmed', updated_at = datetime('now')
              WHERE id = ? AND status = 'pending'`,
          ).bind(order.accommodation_booking_id),
        ]
      : []

  const statements: D1PreparedStatement[] = [
    // The unique index on razorpay_payment_id means a concurrent duplicate
    // delivery loses here rather than granting a second time.
    env.DB.prepare(
      `UPDATE orders
          SET status = 'paid',
              razorpay_payment_id = ?,
              method = ?,
              fee_paise = ?,
              tax_paise = ?,
              webhook_payload = ?,
              paid_at = datetime('now'),
              updated_at = datetime('now')
        WHERE id = ? AND status != 'paid'`,
    ).bind(
      payment.id,
      payment.method ?? null,
      payment.fee ?? null,
      payment.tax ?? null,
      JSON.stringify(event),
      order.id,
    ),

    env.DB.prepare(
      `UPDATE registrations
          SET status = 'confirmed', updated_at = datetime('now')
        WHERE id = ? AND status = 'pending'`,
    ).bind(order.registration_id),

    // One entitlement per line item. `idx_ent_unique` makes a repeat delivery
    // a no-op rather than a second grant.
    ...items.results.map((item) =>
      env.DB.prepare(
        `INSERT OR IGNORE INTO entitlements (id, registration_id, product_id, order_id)
         VALUES (?, ?, ?, ?)`,
      ).bind(newId(), order.registration_id, item.product_id, order.id),
    ),

    ...entryStatements,
    ...bookingStatements,
  ]

  await env.DB.batch(statements)

  // Only an order that bought products issues a pass. Tested by what the
  // order *is* rather than by what it is not: this used to read `!== 'event'`,
  // which was true for every kind that had not been invented yet, and would
  // have minted a festival pass for anyone who booked a bed.
  if (order.kind === 'event') await requestSheetSyncForEntry(env, order.event_entry_id)
  else if (order.kind !== 'accommodation') await issuePassIfNeeded(env, order.registration_id)

  await audit.record(env, {
    action: 'order.paid',
    entity: 'order',
    entityId: order.id,
    after: {
      paymentId: payment.id,
      amountPaise: payment.amount,
      // Recorded rather than assumed: after the first live payment this is how
      // we learn the real effective rate on this account.
      feePaise: payment.fee ?? null,
      taxPaise: payment.tax ?? null,
      method: payment.method ?? null,
      products: items.results.map((i) => i.product_id),
    },
  })

  // One email per kind of thing bought. Routed on `kind` rather than left to
  // the registration mail to work out: that handler decides between "you're
  // aboard" and "upgrade confirmed" by whether the order has line items and
  // follows an earlier one, and an event entry has neither items nor a first
  // order, so every paid entry used to be announced as a Festival Pass
  // upgrade to somebody who had just paid for badminton.
  if (order.kind === 'accommodation' && order.accommodation_booking_id) {
    // The receipt the hostel desk asks to see at check-in, which is a
    // different document from a registration confirmation.
    await env.JOBS.send({
      kind: 'email.accommodation_confirmed',
      registrationId: order.registration_id,
      bookingId: order.accommodation_booking_id,
    })
  } else if (order.kind === 'event' && order.event_entry_id) {
    await env.JOBS.send({
      kind: 'email.event_entered',
      registrationId: order.registration_id,
      entryId: order.event_entry_id,
    })
  } else {
    await env.JOBS.send({
      kind: 'email.registration_confirmed',
      registrationId: order.registration_id,
      orderId: order.id,
    })
  }
}

/**
 * Issue a pass, once, per registration.
 *
 * `tier_floor` records what they hold right now. If they upgrade later this row
 * is untouched: the gate reads the current tier from the synced manifest and
 * takes whichever is higher, so an already-printed QR keeps working.
 */
async function issuePassIfNeeded(env: Env, registrationId: string): Promise<void> {
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

/* ------------------------------------------------------------------ *
 * payment.failed
 * ------------------------------------------------------------------ */

async function onPaymentFailed(env: Env, event: WebhookEvent): Promise<void> {
  const payment = event.payload.payment?.entity
  if (!payment) return

  const order = await env.DB.prepare(
    'SELECT id, registration_id, status FROM orders WHERE razorpay_order_id = ?',
  )
    .bind(payment.order_id)
    .first<{ id: string; registration_id: string; status: string }>()

  if (!order) return
  // A failed attempt after a successful one changes nothing, people retry, and
  // the first success is what counts.
  if (order.status === 'paid') return

  await env.DB.prepare(
    `UPDATE orders
        SET status = 'failed',
            failure_reason = ?,
            webhook_payload = ?,
            updated_at = datetime('now')
      WHERE id = ? AND status = 'created'`,
  )
    .bind(payment.error_description ?? 'unknown', JSON.stringify(event), order.id)
    .run()

  await audit.record(env, {
    action: 'order.failed',
    entity: 'order',
    entityId: order.id,
    after: { paymentId: payment.id, reason: payment.error_description ?? 'unknown' },
  })

  await env.JOBS.send({
    kind: 'email.payment_failed',
    registrationId: order.registration_id,
    orderId: order.id,
  })
}
