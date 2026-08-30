/**
 * Razorpay: orders, and the two signatures that stand between us and someone
 * granting themselves a pass for free.
 *
 * Three rules this module exists to enforce:
 *
 *  1. The amount is decided here, from our own product table. A browser tells
 *     us which product it wants and nothing else; a client that can name its
 *     own price eventually will.
 *  2. The webhook is the source of truth, not the browser's success callback.
 *     The callback runs the success animation; the webhook grants the
 *     entitlement.
 *  3. Signatures are compared in constant time. A `===` on a hex digest leaks
 *     the answer a byte at a time to anyone patient enough to measure.
 */

/** Razorpay speaks paise, same as our database. No floats anywhere. */
export type Paise = number

export type RazorpayConfig = {
  keyId: string
  keySecret: string
  webhookSecret: string
}

/**
 * The credentials, read from the environment.
 *
 * Lives here rather than being redefined per route: two copies is one copy too
 * many for the thing that signs money.
 */
export function razorpayConfig(env: {
  RAZORPAY_KEY_ID: string
  RAZORPAY_KEY_SECRET: string
  RAZORPAY_WEBHOOK_SECRET: string
}): RazorpayConfig {
  return {
    keyId: env.RAZORPAY_KEY_ID,
    keySecret: env.RAZORPAY_KEY_SECRET,
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
  }
}

export type CreatedOrder = {
  id: string
  amount: Paise
  currency: string
  status: string
  receipt?: string
}

export class RazorpayError extends Error {
  readonly status: number
  readonly body: string

  constructor(message: string, status: number, body: string) {
    super(message)
    this.name = 'RazorpayError'
    this.status = status
    this.body = body
  }
}

const API = 'https://api.razorpay.com/v1'

/* ------------------------------------------------------------------ *
 * Signatures
 * ------------------------------------------------------------------ */

const encoder = new TextEncoder()

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)))
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Constant-time string comparison.
 *
 * Length is deliberately folded into the accumulator rather than short-circuited
 * on, so a wrong-length signature costs the same as a wrong-value one.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length)
  let diff = a.length ^ b.length
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  }
  return diff === 0
}

/**
 * Verify the signature Checkout hands back in the browser.
 *
 * Razorpay signs `order_id|payment_id` with the key secret. Passing this means
 * the payment is real: but it arrives over a channel the user controls, so
 * treat it as good enough to show a success screen and never as authority to
 * grant an entitlement. That is the webhook's job.
 */
export async function verifyCheckoutSignature(
  args: { orderId: string; paymentId: string; signature: string },
  keySecret: string,
): Promise<boolean> {
  if (!args.orderId || !args.paymentId || !args.signature) return false
  const expected = await hmacSha256Hex(keySecret, `${args.orderId}|${args.paymentId}`)
  return timingSafeEqual(expected, args.signature)
}

/**
 * Verify a webhook.
 *
 * `rawBody` must be the exact bytes Razorpay sent, read the body as text once
 * and hand that same string here. Parsing to JSON and re-serialising changes
 * key order and whitespace, and the signature will never match again. This is
 * the single most common way this integration is got wrong.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  webhookSecret: string,
): Promise<boolean> {
  if (!signature) return false
  const expected = await hmacSha256Hex(webhookSecret, rawBody)
  return timingSafeEqual(expected, signature)
}

/* ------------------------------------------------------------------ *
 * API
 * ------------------------------------------------------------------ */

function authHeader(cfg: RazorpayConfig): string {
  return `Basic ${btoa(`${cfg.keyId}:${cfg.keySecret}`)}`
}

async function call<T>(cfg: RazorpayConfig, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(cfg),
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  const body = await res.text()
  if (!res.ok) {
    throw new RazorpayError(`Razorpay ${init?.method ?? 'GET'} ${path} failed`, res.status, body)
  }
  return JSON.parse(body) as T
}

/**
 * Create an order.
 *
 * `amountPaise` is always read from our products table by the caller, this
 * function has no opinion, but nothing upstream should ever be taking it from
 * a request body.
 */
export async function createOrder(
  cfg: RazorpayConfig,
  args: {
    amountPaise: Paise
    /** Our own order id, so a Razorpay record can always be traced back. */
    receipt: string
    notes?: Record<string, string>
  },
): Promise<CreatedOrder> {
  if (!Number.isInteger(args.amountPaise) || args.amountPaise <= 0) {
    throw new RangeError('amountPaise must be a positive integer')
  }

  return call<CreatedOrder>(cfg, '/orders', {
    method: 'POST',
    body: JSON.stringify({
      amount: args.amountPaise,
      currency: 'INR',
      receipt: args.receipt,
      notes: args.notes ?? {},
      // Capture automatically: a payment left authorised but uncaptured is
      // money the student has parted with and we have not taken.
      payment_capture: 1,
    }),
  })
}

export type RazorpayPayment = {
  id: string
  order_id: string
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed'
  amount: Paise
  method?: string
  /** Present once captured. This is how we learn our real effective rate. */
  fee?: Paise
  tax?: Paise
  error_description?: string
}

export async function fetchPayment(
  cfg: RazorpayConfig,
  paymentId: string,
): Promise<RazorpayPayment> {
  return call<RazorpayPayment>(cfg, `/payments/${paymentId}`)
}

/**
 * Every payment attached to one of our orders.
 *
 * The reconciliation sweep uses this: for an order still unresolved after 30
 * minutes, ask Razorpay what actually happened rather than trusting our own
 * record. This is what rescues the student whose browser died after paying.
 */
export async function fetchOrderPayments(
  cfg: RazorpayConfig,
  razorpayOrderId: string,
): Promise<RazorpayPayment[]> {
  const res = await call<{ items: RazorpayPayment[] }>(cfg, `/orders/${razorpayOrderId}/payments`)
  return res.items ?? []
}

export async function refundPayment(
  cfg: RazorpayConfig,
  paymentId: string,
  args: { amountPaise?: Paise; notes?: Record<string, string> } = {},
): Promise<{ id: string; status: string; amount: Paise }> {
  return call(cfg, `/payments/${paymentId}/refund`, {
    method: 'POST',
    body: JSON.stringify({
      ...(args.amountPaise !== undefined ? { amount: args.amountPaise } : {}),
      notes: args.notes ?? {},
      speed: 'normal',
    }),
  })
}

/* ------------------------------------------------------------------ *
 * Webhook payloads
 * ------------------------------------------------------------------ */

export type WebhookEvent = {
  event: string
  payload: {
    payment?: { entity: RazorpayPayment }
    refund?: { entity: { id: string; payment_id: string; amount: Paise; status: string } }
  }
}

/** The events we act on. Everything else is acknowledged and ignored. */
export const HANDLED_EVENTS = [
  'payment.captured',
  'payment.failed',
  'refund.processed',
] as const

export type HandledEvent = (typeof HANDLED_EVENTS)[number]

export function isHandledEvent(event: string): event is HandledEvent {
  return (HANDLED_EVENTS as readonly string[]).includes(event)
}
