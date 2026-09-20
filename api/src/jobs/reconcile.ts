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
import * as audit from '../lib/audit.ts'
import { issuePassIfNeeded } from '../lib/grant.ts'
import { RazorpayError, fetchOrderPayments, fetchRefunds } from '../lib/razorpay.ts'
import { applyRefund } from '../lib/refunds.ts'
import { requestAccommodationSheetSync, requestSheetSyncForEntry } from './sheets.ts'

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
  // ordinary case. `failed` and `expired` ones are the retries: an order our
  // webhook marked failed at 10:05 on which the student paid at 10:06.
  const { results: stale } = await env.DB.prepare(
    `SELECT id, registration_id, razorpay_order_id, amount_paise, status, created_at,
            kind, event_entry_id, accommodation_booking_id
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
      kind: string
      event_entry_id: string | null
      accommodation_booking_id: string | null
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
  order: {
    id: string
    registration_id: string
    kind: string
    event_entry_id: string | null
    accommodation_booking_id: string | null
  },
  payment: { id: string; amount: number; method?: string; fee?: number; tax?: number },
): Promise<void> {
  const { results: items } = await env.DB.prepare(
    'SELECT product_id FROM order_items WHERE order_id = ?',
  )
    .bind(order.id)
    .all<{ product_id: string }>()

  // An entry order buys a place in one event rather than an entitlement, so
  // settling it means confirming that entry, exactly as the webhook does.
  // Without this the money was recorded and the student was never entered.
  const isEntry = order.kind === 'event' && !!order.event_entry_id
  // Same shape as an entry: no line items, nothing granted, one pending row
  // to confirm. Without this the money was recorded and nobody got a bed.
  const isBooking = order.kind === 'accommodation' && !!order.accommodation_booking_id

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

    // OR IGNORE, so a clash with a place already held in the same band can
    // never roll back the batch and leave captured money unrecorded.
    ...(isEntry
      ? [
          env.DB.prepare(
            `UPDATE OR IGNORE event_entries SET status = 'confirmed'
              WHERE id = ? AND status = 'pending'`,
          ).bind(order.event_entry_id),
        ]
      : []),

    ...(isBooking
      ? [
          env.DB.prepare(
            `UPDATE OR IGNORE accommodation_bookings
                SET status = 'confirmed', updated_at = datetime('now')
              WHERE id = ? AND status = 'pending'`,
          ).bind(order.accommodation_booking_id),
        ]
      : []),
  ])

  // Only an order that bought products issues a pass. Neither an entry nor a
  // bed does: the pass came with the registration. Tested positively, so a
  // fourth kind of order cannot quietly inherit the pass-issuing branch.
  if (isEntry) await requestSheetSyncForEntry(env, order.event_entry_id)
  else if (!isBooking) await issuePassIfNeeded(env, order.registration_id)

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

  // Same routing as the webhook, for the same reason: an entry settled by the
  // sweep must not be announced as a Festival Pass upgrade either.
  if (isBooking) {
    await requestAccommodationSheetSync(env)
    await env.JOBS.send({
      kind: 'email.accommodation_confirmed',
      registrationId: order.registration_id,
      bookingId: order.accommodation_booking_id!,
    })
  } else if (isEntry) {
    await env.JOBS.send({
      kind: 'email.event_entered',
      registrationId: order.registration_id,
      entryId: order.event_entry_id!,
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
 * Entries whose order is paid but which were never confirmed.
 *
 * Before `settle` confirmed entries, a capture recovered by the sweep left the
 * order paid and its entry pending: the student had paid and was not in the
 * event. The webhook confirms both in one batch, so a paid order with a pending
 * entry has no other cause; this finds any left over and confirms them.
 *
 * OR IGNORE: should the same person already hold a confirmed place in that
 * band, the unique index keeps the older one and this entry stays pending for
 * a human to refund, rather than failing the whole statement every sweep.
 */
export async function repairUnconfirmedEntries(env: Env): Promise<void> {
  const { results } = await env.DB.prepare(
    `UPDATE OR IGNORE event_entries SET status = 'confirmed'
      WHERE status = 'pending'
        AND id IN (SELECT event_entry_id FROM orders
                    WHERE kind = 'event' AND status = 'paid' AND event_entry_id IS NOT NULL)
      RETURNING id, registration_id, event_name`,
  ).all<{ id: string; registration_id: string; event_name: string }>()

  for (const entry of results) {
    await audit.record(env, {
      action: 'order.reconciled',
      entity: 'event_entry',
      entityId: entry.id,
      after: {
        outcome: 'entry_confirmed_after_paid_order',
        registrationId: entry.registration_id,
        eventName: entry.event_name,
      },
    })
    await requestSheetSyncForEntry(env, entry.id)
    // This path confirms an entry nothing else did, so nothing else has told
    // the entrant they are in. Reaching here twice is not possible: the UPDATE
    // only matches a pending row, and it has just stopped being one.
    await env.JOBS.send({
      kind: 'email.event_entered',
      registrationId: entry.registration_id,
      entryId: entry.id,
    })
  }
  if (results.length) console.log('confirmed entries left pending on paid orders', results.length)
}

/**
 * Bookings whose order is paid but which were never confirmed.
 *
 * The accommodation counterpart of `repairUnconfirmedEntries`, and it exists
 * for the same reason: a paid order beside a pending booking means somebody
 * paid for a bed the desk has no record of them holding, which is a problem
 * that surfaces at eleven at night with their luggage in the corridor.
 *
 * OR IGNORE: if they somehow already hold a confirmed booking, the unique
 * index keeps it and this row stays pending for a human to refund, rather
 * than failing the statement on every sweep from now until the fest.
 */
export async function repairUnconfirmedBookings(env: Env): Promise<void> {
  const { results } = await env.DB.prepare(
    `UPDATE OR IGNORE accommodation_bookings
        SET status = 'confirmed', updated_at = datetime('now')
      WHERE status = 'pending'
        AND id IN (SELECT accommodation_booking_id FROM orders
                    WHERE kind = 'accommodation' AND status = 'paid'
                      AND accommodation_booking_id IS NOT NULL)
      RETURNING id, registration_id, public_code`,
  ).all<{ id: string; registration_id: string; public_code: string }>()

  for (const booking of results) {
    await audit.record(env, {
      action: 'order.reconciled',
      entity: 'accommodation_booking',
      entityId: booking.id,
      after: {
        outcome: 'booking_confirmed_after_paid_order',
        registrationId: booking.registration_id,
        code: booking.public_code,
      },
    })
    await env.JOBS.send({
      kind: 'email.accommodation_confirmed',
      registrationId: booking.registration_id,
      bookingId: booking.id,
    })
    await requestAccommodationSheetSync(env)
  }
  if (results.length) console.log('confirmed bookings left pending on paid orders', results.length)
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
