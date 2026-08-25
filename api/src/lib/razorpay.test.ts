/**
 * Razorpay signature tests.
 *
 * The vectors below are computed with an independent HMAC implementation
 * (node:crypto) rather than by calling our own code, so these tests can catch
 * a wrong algorithm, a wrong message format, or a wrong encoding — not merely
 * confirm that our function agrees with itself.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'

import {
  createOrder,
  isHandledEvent,
  RazorpayError,
  timingSafeEqual,
  verifyCheckoutSignature,
  verifyWebhookSignature,
} from './razorpay.ts'

const KEY_SECRET = 'test_secret_do_not_use'
const WEBHOOK_SECRET = 'webhook_secret_do_not_use'

/** Independent reference implementation. */
const hmac = (secret: string, message: string) =>
  createHmac('sha256', secret).update(message).digest('hex')

const cfg = {
  keyId: 'rzp_test_abc',
  keySecret: KEY_SECRET,
  webhookSecret: WEBHOOK_SECRET,
}

/* ---------- checkout callback ---------- */

test('a genuine checkout signature verifies', async () => {
  const orderId = 'order_MNq8vKqQ1abcd'
  const paymentId = 'pay_MNq8xLrR2efgh'
  const signature = hmac(KEY_SECRET, `${orderId}|${paymentId}`)

  assert.equal(await verifyCheckoutSignature({ orderId, paymentId, signature }, KEY_SECRET), true)
})

test('signature is over order_id|payment_id, in that order', async () => {
  const orderId = 'order_A'
  const paymentId = 'pay_B'

  // Swapping the operands is the obvious implementation slip; it must fail.
  const reversed = hmac(KEY_SECRET, `${paymentId}|${orderId}`)
  assert.equal(
    await verifyCheckoutSignature({ orderId, paymentId, signature: reversed }, KEY_SECRET),
    false,
  )

  // As must dropping the separator.
  const noPipe = hmac(KEY_SECRET, `${orderId}${paymentId}`)
  assert.equal(
    await verifyCheckoutSignature({ orderId, paymentId, signature: noPipe }, KEY_SECRET),
    false,
  )
})

test('a signature from the wrong secret is rejected', async () => {
  const orderId = 'order_A'
  const paymentId = 'pay_B'
  const forged = hmac('attacker_guess', `${orderId}|${paymentId}`)

  assert.equal(
    await verifyCheckoutSignature({ orderId, paymentId, signature: forged }, KEY_SECRET),
    false,
  )
})

test('a signature for a different payment is rejected', async () => {
  // Someone replays a real signature from their own ₹450 payment against an
  // order they never paid for.
  const theirSignature = hmac(KEY_SECRET, 'order_theirs|pay_theirs')

  assert.equal(
    await verifyCheckoutSignature(
      { orderId: 'order_mine', paymentId: 'pay_mine', signature: theirSignature },
      KEY_SECRET,
    ),
    false,
  )
})

test('missing fields are rejected rather than treated as empty', async () => {
  for (const args of [
    { orderId: '', paymentId: 'pay_B', signature: 'x' },
    { orderId: 'order_A', paymentId: '', signature: 'x' },
    { orderId: 'order_A', paymentId: 'pay_B', signature: '' },
  ]) {
    assert.equal(await verifyCheckoutSignature(args, KEY_SECRET), false)
  }
})

/* ---------- webhook ---------- */

test('a genuine webhook signature verifies over the raw body', async () => {
  const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: {} } } })
  const signature = hmac(WEBHOOK_SECRET, body)

  assert.equal(await verifyWebhookSignature(body, signature, WEBHOOK_SECRET), true)
})

test('re-serialising the body breaks the signature', async () => {
  // The classic bug: parse the JSON, then verify against JSON.stringify(parsed).
  // Key order and spacing change, and the signature can never match.
  const raw = '{"event":"payment.captured","payload":{"a":1,"b":2}}'
  const signature = hmac(WEBHOOK_SECRET, raw)
  const reserialised = JSON.stringify(JSON.parse(raw))

  assert.equal(await verifyWebhookSignature(raw, signature, WEBHOOK_SECRET), true)

  const shuffled = '{"payload":{"b":2,"a":1},"event":"payment.captured"}'
  assert.equal(
    await verifyWebhookSignature(shuffled, signature, WEBHOOK_SECRET),
    false,
    're-ordered JSON must not verify — always hold on to the raw bytes',
  )
  assert.equal(reserialised.length, raw.length)
})

test('a webhook signed with the API secret rather than the webhook secret fails', async () => {
  // These are two different secrets in the Razorpay dashboard and mixing them
  // up silently accepts nothing — or, worse, accepts everything if unchecked.
  const body = '{"event":"payment.captured"}'
  const wrong = hmac(KEY_SECRET, body)

  assert.equal(await verifyWebhookSignature(body, wrong, WEBHOOK_SECRET), false)
})

test('a missing signature header is rejected', async () => {
  assert.equal(await verifyWebhookSignature('{}', null, WEBHOOK_SECRET), false)
  assert.equal(await verifyWebhookSignature('{}', '', WEBHOOK_SECRET), false)
})

test('a tampered body is rejected', async () => {
  const body = '{"event":"payment.captured","payload":{"payment":{"entity":{"amount":45000}}}}'
  const signature = hmac(WEBHOOK_SECRET, body)

  // Bump the amount to a Delegate Card after signing.
  const tampered = body.replace('45000', '270000')
  assert.equal(await verifyWebhookSignature(tampered, signature, WEBHOOK_SECRET), false)
})

/* ---------- constant-time compare ---------- */

test('timingSafeEqual matches exactly and rejects near misses', () => {
  const a = 'a'.repeat(64)
  assert.equal(timingSafeEqual(a, a), true)
  assert.equal(timingSafeEqual(a, 'a'.repeat(63) + 'b'), false, 'last character differs')
  assert.equal(timingSafeEqual(a, 'b' + 'a'.repeat(63)), false, 'first character differs')
  assert.equal(timingSafeEqual(a, 'a'.repeat(63)), false, 'shorter')
  assert.equal(timingSafeEqual(a, 'a'.repeat(65)), false, 'longer')
  assert.equal(timingSafeEqual('', ''), true)
})

/* ---------- events ---------- */

test('only the events we act on are handled', () => {
  assert.equal(isHandledEvent('payment.captured'), true)
  assert.equal(isHandledEvent('payment.failed'), true)
  assert.equal(isHandledEvent('refund.processed'), true)

  // Razorpay sends plenty we acknowledge and ignore.
  assert.equal(isHandledEvent('order.paid'), false)
  assert.equal(isHandledEvent('payment.authorized'), false)
  assert.equal(isHandledEvent('subscription.charged'), false)
})

/* ---------- order creation ---------- */

test('createOrder refuses an amount that is not positive paise', async () => {
  for (const amountPaise of [0, -45000, 450.5, NaN]) {
    await assert.rejects(
      () => createOrder(cfg, { amountPaise, receipt: 'r1' }),
      RangeError,
      `should reject ${amountPaise}`,
    )
  }
})

test('createOrder sends paise, INR and auto-capture', async () => {
  const original = globalThis.fetch
  let seen: { url: string; body: any; auth: string | null } | null = null

  globalThis.fetch = (async (url: string, init: RequestInit) => {
    seen = {
      url: String(url),
      body: JSON.parse(String(init.body)),
      auth: new Headers(init.headers).get('Authorization'),
    }
    return new Response(
      JSON.stringify({ id: 'order_x', amount: 45000, currency: 'INR', status: 'created' }),
      { status: 200 },
    )
  }) as typeof fetch

  try {
    const order = await createOrder(cfg, { amountPaise: 45000, receipt: 'ord_1' })
    assert.equal(order.id, 'order_x')

    assert.equal(seen!.url, 'https://api.razorpay.com/v1/orders')
    assert.equal(seen!.body.amount, 45000, 'paise, not rupees')
    assert.equal(seen!.body.currency, 'INR')
    assert.equal(seen!.body.receipt, 'ord_1', 'our own id must be traceable')
    assert.equal(seen!.body.payment_capture, 1, 'never leave a payment merely authorised')
    assert.ok(seen!.auth?.startsWith('Basic '))
  } finally {
    globalThis.fetch = original
  }
})

test('an API failure raises RazorpayError with the status and body', async () => {
  const original = globalThis.fetch
  globalThis.fetch = (async () =>
    new Response('{"error":{"description":"key mismatch"}}', { status: 401 })) as typeof fetch

  try {
    await assert.rejects(
      () => createOrder(cfg, { amountPaise: 45000, receipt: 'r' }),
      (err: unknown) => {
        if (!(err instanceof RazorpayError)) return false
        assert.equal(err.status, 401)
        assert.match(err.body, /key mismatch/)
        return true
      },
    )
  } finally {
    globalThis.fetch = original
  }
})
