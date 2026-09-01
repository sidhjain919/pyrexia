/**
 * Registration and checkout.
 *
 * The shape of the flow, and why:
 *
 *   POST /api/registrations           new person + order, returns a Razorpay order
 *   POST /api/registrations/:id/upgrade   an existing person adds the Festival Pass
 *   POST /api/checkout/verify         the browser's success callback
 *
 * Nothing here grants an entitlement. The callback in `/checkout/verify` proves
 * the payment is real and lets us show a success screen immediately, but the
 * webhook is what actually hands over a pass. Two reasons: the callback arrives
 * over a channel the user controls, and a browser that dies between paying and
 * calling back must still end up with a pass.
 */

import { Hono, type Context } from 'hono'

import type { Env } from '../types.ts'
import { ApiError, clientIp, readJson } from '../lib/http.ts'
import { newId, newOrderId, newPublicCode } from '../lib/ids.ts'
import { loadProducts, ownedProducts, quote } from '../lib/pricing.ts'
import { validateRegistration } from '../lib/validate.ts'
import * as idem from '../lib/idempotency.ts'
import * as audit from '../lib/audit.ts'
import { readToken, resolveSession } from '../lib/session.ts'
import { createOrder, razorpayConfig, verifyCheckoutSignature } from '../lib/razorpay.ts'

export const registrations = new Hono<{ Bindings: Env }>()

/* ------------------------------------------------------------------ *
 * Catalogue
 * ------------------------------------------------------------------ */

/** What the pricing UI reads, so the browser never hard-codes an amount. */
registrations.get('/products', async (c) => {
  const products = await loadProducts(c.env)
  return c.json({
    products: [...products.values()]
      .filter((p) => p.active)
      .map((p) => ({
        id: p.id,
        name: p.name,
        amountPaise: p.amount_paise,
        requires: p.requires,
      })),
  })
})

/**
 * The public keys that verify a pass.
 *
 * Deliberately public: a verification key can only *check* a seal, never make
 * one, so publishing it costs nothing. The guard app fetches this once when a
 * device is provisioned and then works offline forever.
 *
 * Serving it from here rather than hard-coding it anywhere is what stops the
 * published key drifting from the one actually signing passes.
 */
registrations.get('/pass-keys', (c) =>
  c.json({
    keys: [{ kid: Number(c.env.PASS_KEY_ID ?? '1'), publicKey: c.env.PASS_PUBLIC_KEY_V1 }].filter(
      (k) => !!k.publicKey,
    ),
  }),
)

/* ------------------------------------------------------------------ *
 * New registration
 * ------------------------------------------------------------------ */

/**
 * Buy Basic Registration (and optionally the Festival Pass with it).
 *
 * Requires an account. The row already exists, sign-up created it with the
 * detail columns empty: so this fills them in and opens an order, rather than
 * conjuring a person out of a form.
 */
/**
 * No paying from an address nobody has proved.
 *
 * The pass is delivered by email, so a typo here means someone pays and never
 * receives the thing they paid for: and from our side that is indistinguishable
 * from a person who just hasn't checked their inbox. Better to stop before the
 * money moves than to refund afterwards.
 */
async function requireVerifiedEmail(env: Env, registrationId: string): Promise<void> {
  const row = await env.DB.prepare('SELECT email_verified FROM registrations WHERE id = ?')
    .bind(registrationId)
    .first<{ email_verified: number }>()

  if (!row?.email_verified) {
    throw new ApiError('verification_required', 'Confirm your email address before paying.')
  }
}

/**
 * No paying without the college ID.
 *
 * The ₹500 is a student rate, and the student card is the only evidence we
 * ever see for it. Collected before the money rather than after: afterwards is
 * asking a favour of somebody who already has what they came for, and the desk
 * is then checking a claim nobody documented. The government photo ID is a
 * convenience for the desk and stays optional.
 *
 * Enforced here and not only in the form, because the form is JavaScript
 * somebody else's browser is running.
 */
async function requireStudentId(env: Env, registrationId: string): Promise<void> {
  const row = await env.DB.prepare(
    "SELECT 1 AS ok FROM documents WHERE registration_id = ? AND kind = 'student_id' LIMIT 1",
  )
    .bind(registrationId)
    .first<{ ok: number }>()

  if (!row) {
    throw new ApiError(
      'student_id_required',
      'Upload your college ID before paying. A photo from your phone is fine.',
    )
  }
}

registrations.post('/registrations', async (c) => {
  const endpoint = 'POST /registrations'
  const body = (await readJson(c)) as Record<string, unknown>
  const key = idem.requireKey(c.req.header('Idempotency-Key'))

  const session = await resolveSession(c.env, readToken(c.req.raw.headers))
  if (!session) {
    throw new ApiError('unauthorised', 'Sign in or create an account to register.')
  }

  await requireVerifiedEmail(c.env, session.registrationId)
  await requireStudentId(c.env, session.registrationId)

  const seen = await idem.check(c.env, { key, endpoint, body })
  if (seen.state === 'replay') {
    return c.json(seen.response.body as object, seen.response.statusCode as 200)
  }

  // The email comes from the account, never from this form, it is the login,
  // and letting a checkout rewrite it is how someone locks themselves out.
  const { ok, errors, value } = validateRegistration({ ...body, email: session.email })
  if (!ok) {
    throw new ApiError('validation_failed', 'Some details need another look.', { fields: errors })
  }

  const requested = Array.isArray(body.products) ? (body.products as string[]) : []
  if (!requested.every((p) => typeof p === 'string')) {
    throw new ApiError('bad_request', 'products must be a list of product ids.')
  }

  const owned = await ownedProducts(c.env, session.registrationId)
  if (owned.has('basic')) {
    throw new ApiError(
      'already_registered',
      'Your Basic Registration is already complete. Add the Festival Pass from your pass instead.',
    )
  }

  // A mobile number belongs to one human. Another confirmed registration
  // holding it means a typo or a shared phone, and either way it should stop
  // here rather than at the gate.
  const phoneClash = await c.env.DB.prepare(
    `SELECT public_code FROM registrations
      WHERE status = 'confirmed' AND phone = ? AND id != ? LIMIT 1`,
  )
    .bind(value.phone, session.registrationId)
    .first<{ public_code: string }>()

  if (phoneClash) {
    throw new ApiError('conflict', 'That mobile number is already on another registration.', {
      fields: { phone: 'Already registered.' },
    })
  }

  const products = await loadProducts(c.env)
  const priced = quote(requested, products, owned)
  if (!priced.ok) {
    throw new ApiError('bad_request', describeQuoteFailure(priced.failure), {
      extra: { reason: priced.failure },
    })
  }

  await idem.claim(c.env, { key, endpoint, body })

  try {
    const registrationId = session.registrationId
    const publicCode = session.publicCode
    const orderId = newOrderId()

    const rzpOrder = await createOrder(razorpayConfig(c.env), {
      amountPaise: priced.quote.totalPaise,
      receipt: orderId,
      notes: { registrationId, publicCode },
    })

    await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE registrations
            SET name = ?, phone = ?, gender = ?, college = ?, city = ?, course = ?, year = ?,
                emergency_name = ?, emergency_phone = ?, updated_at = datetime('now')
          WHERE id = ?`,
      ).bind(
        value.name,
        value.phone,
        value.gender || null,
        value.college,
        value.city,
        value.course,
        value.year,
        value.emergencyName,
        value.emergencyPhone,
        registrationId,
      ),
      c.env.DB.prepare(
        `INSERT INTO orders (id, registration_id, amount_paise, convenience_paise,
                             kind, razorpay_order_id, status)
         VALUES (?, ?, ?, ?, 'registration', ?, 'created')`,
      ).bind(
        orderId,
        registrationId,
        priced.quote.totalPaise,
        priced.quote.conveniencePaise,
        rzpOrder.id,
      ),
      ...priced.quote.lines.map((line) =>
        c.env.DB.prepare(
          'INSERT INTO order_items (id, order_id, product_id, amount_paise) VALUES (?, ?, ?, ?)',
        ).bind(newId(), orderId, line.productId, line.amountPaise),
      ),
    ])

    await audit.record(c.env, {
      action: 'registration.create',
      entity: 'registration',
      entityId: registrationId,
      after: { publicCode, products: requested, totalPaise: priced.quote.totalPaise },
      ip: clientIp(c),
    })

    const response = {
      registrationId,
      publicCode,
      orderId,
      checkout: {
        keyId: c.env.RAZORPAY_KEY_ID,
        razorpayOrderId: rzpOrder.id,
        amountPaise: priced.quote.totalPaise,
        currency: 'INR',
        name: value.name,
        email: session.email,
        phone: value.phone,
      },
      lines: priced.quote.lines,
      subtotalPaise: priced.quote.subtotalPaise,
      conveniencePaise: priced.quote.conveniencePaise,
      totalPaise: priced.quote.totalPaise,
    }

    await idem.remember(c.env, { key, endpoint, statusCode: 201, body: response })
    return c.json(response, 201)
  } catch (err) {
    await idem.release(c.env, { key, endpoint })
    throw err
  }
})

/* ------------------------------------------------------------------ *
 * Upgrade: adding the Festival Pass later
 * ------------------------------------------------------------------ */

/**
 * Adding the Festival Pass later.
 *
 * Two paths into the same handler:
 *   POST /api/me/upgrade                 : the one the site uses
 *   POST /api/registrations/:id/upgrade  : same thing, id spelled out
 *
 * Both resolve the buyer from the session, never from the URL. The `:id` form
 * exists only so a mismatch can be reported clearly instead of silently
 * charging the wrong account.
 */
const upgradeHandler = async (c: Context<{ Bindings: Env }>) => {
  const endpoint = 'POST /upgrade'
  const paramId = c.req.param('id')
  const body = (await readJson(c)) as Record<string, unknown>
  const key = idem.requireKey(c.req.header('Idempotency-Key'))

  // The buyer is whoever holds the session: never whoever is named in the URL.
  const session = await resolveSession(c.env, readToken(c.req.raw.headers))
  if (!session) throw new ApiError('unauthorised', 'Sign in to add the Festival Pass.')

  if (paramId && paramId !== 'me' && paramId !== session.registrationId) {
    throw new ApiError('forbidden', 'You can only upgrade your own registration.')
  }
  const registrationId = session.registrationId

  await requireVerifiedEmail(c.env, registrationId)

  const seen = await idem.check(c.env, { key, endpoint, body })
  if (seen.state === 'replay') {
    return c.json(seen.response.body as object, seen.response.statusCode as 200)
  }

  const registration = await c.env.DB.prepare(
    'SELECT id, public_code, name, email, phone, status FROM registrations WHERE id = ?',
  )
    .bind(registrationId)
    .first<{
      id: string
      public_code: string
      name: string
      email: string
      phone: string
      status: string
    }>()

  if (!registration) throw new ApiError('not_found', 'No such registration.')
  if (registration.status !== 'confirmed') {
    throw new ApiError(
      'payment_required',
      'Finish your Basic Registration before adding the Festival Pass.',
    )
  }

  const requested = Array.isArray(body.products) ? (body.products as string[]) : ['delegate']
  const products = await loadProducts(c.env)
  const owned = await ownedProducts(c.env, registrationId)
  const priced = quote(requested, products, owned)

  if (!priced.ok) {
    throw new ApiError('bad_request', describeQuoteFailure(priced.failure), {
      extra: { reason: priced.failure },
    })
  }

  await idem.claim(c.env, { key, endpoint, body })

  try {
    const orderId = newOrderId()
    const rzpOrder = await createOrder(razorpayConfig(c.env), {
      amountPaise: priced.quote.totalPaise,
      receipt: orderId,
      notes: { registrationId, publicCode: registration.public_code, kind: 'upgrade' },
    })

    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO orders (id, registration_id, amount_paise, convenience_paise,
                             kind, razorpay_order_id, status)
         VALUES (?, ?, ?, ?, 'registration', ?, 'created')`,
      ).bind(
        orderId,
        registrationId,
        priced.quote.totalPaise,
        priced.quote.conveniencePaise,
        rzpOrder.id,
      ),
      ...priced.quote.lines.map((line) =>
        c.env.DB.prepare(
          'INSERT INTO order_items (id, order_id, product_id, amount_paise) VALUES (?, ?, ?, ?)',
        ).bind(newId(), orderId, line.productId, line.amountPaise),
      ),
    ])

    await audit.record(c.env, {
      action: 'order.create',
      entity: 'order',
      entityId: orderId,
      after: { registrationId, products: requested, totalPaise: priced.quote.totalPaise },
      ip: clientIp(c),
    })

    const response = {
      registrationId,
      orderId,
      checkout: {
        keyId: c.env.RAZORPAY_KEY_ID,
        razorpayOrderId: rzpOrder.id,
        amountPaise: priced.quote.totalPaise,
        currency: 'INR',
        name: registration.name,
        email: registration.email,
        phone: registration.phone,
      },
      lines: priced.quote.lines,
      subtotalPaise: priced.quote.subtotalPaise,
      conveniencePaise: priced.quote.conveniencePaise,
      totalPaise: priced.quote.totalPaise,
    }

    await idem.remember(c.env, { key, endpoint, statusCode: 201, body: response })
    return c.json(response, 201)
  } catch (err) {
    await idem.release(c.env, { key, endpoint })
    throw err
  }
}

registrations.post('/me/upgrade', upgradeHandler)
registrations.post('/registrations/:id/upgrade', upgradeHandler)

/* ------------------------------------------------------------------ *
 * Checkout callback
 * ------------------------------------------------------------------ */

/**
 * The browser reports a successful payment.
 *
 * Verifying the signature here proves the payment is genuine, which is enough
 * to stop showing a spinner. It is deliberately *not* enough to issue a pass -
 * that happens in the webhook, so the two paths cannot disagree and a dead
 * browser cannot cost someone the thing they paid for.
 */
registrations.post('/checkout/verify', async (c) => {
  const body = (await readJson(c)) as Record<string, unknown>

  const razorpayOrderId = String(body.razorpay_order_id ?? '')
  const razorpayPaymentId = String(body.razorpay_payment_id ?? '')
  const signature = String(body.razorpay_signature ?? '')

  const valid = await verifyCheckoutSignature(
    { orderId: razorpayOrderId, paymentId: razorpayPaymentId, signature },
    c.env.RAZORPAY_KEY_SECRET,
  )

  if (!valid) {
    await audit.record(c.env, {
      action: 'order.failed',
      entity: 'order',
      entityId: razorpayOrderId,
      after: { reason: 'bad_checkout_signature' },
      ip: clientIp(c),
    })
    throw new ApiError('forbidden', 'That payment could not be verified.')
  }

  const order = await c.env.DB.prepare(
    `SELECT o.id, o.registration_id, o.status, r.public_code
       FROM orders o JOIN registrations r ON r.id = o.registration_id
      WHERE o.razorpay_order_id = ?`,
  )
    .bind(razorpayOrderId)
    .first<{ id: string; registration_id: string; status: string; public_code: string }>()

  if (!order) throw new ApiError('not_found', 'We have no record of that order.')

  // Record what the browser told us without granting anything on the strength
  // of it. `status` stays whatever the webhook has made it.
  await c.env.DB.prepare(
    `UPDATE orders
        SET razorpay_payment_id = COALESCE(razorpay_payment_id, ?),
            razorpay_signature  = ?,
            updated_at          = datetime('now')
      WHERE id = ?`,
  )
    .bind(razorpayPaymentId, signature, order.id)
    .run()

  return c.json({
    verified: true,
    registrationId: order.registration_id,
    publicCode: order.public_code,
    // The webhook may not have landed yet; the success screen should poll or
    // show "confirming…" rather than promising a pass that isn't issued.
    confirmed: order.status === 'paid',
  })
})

/* ------------------------------------------------------------------ *
 * Status polling
 * ------------------------------------------------------------------ */

registrations.get('/orders/:id/status', async (c) => {
  const order = await c.env.DB.prepare(
    'SELECT id, status, registration_id FROM orders WHERE id = ?',
  )
    .bind(c.req.param('id'))
    .first<{ id: string; status: string; registration_id: string }>()

  if (!order) throw new ApiError('not_found', 'No such order.')

  const tier = await c.env.DB.prepare(
    'SELECT tier FROM registration_tier WHERE registration_id = ?',
  )
    .bind(order.registration_id)
    .first<{ tier: number }>()

  return c.json({
    orderId: order.id,
    status: order.status,
    confirmed: order.status === 'paid',
    tier: tier?.tier ?? 0,
  })
})

/* ------------------------------------------------------------------ */

function describeQuoteFailure(f: import('../lib/pricing.ts').QuoteFailure): string {
  switch (f.code) {
    case 'unknown_product':
      return 'That registration type does not exist.'
    case 'inactive_product':
      return 'That registration type is no longer on sale.'
    case 'duplicate_product':
      return 'That registration type was listed twice.'
    case 'already_owned':
      return 'You already hold that: nothing more to pay.'
    case 'missing_prerequisite':
      return 'The Festival Pass sits on top of Basic Registration; you need both.'
    case 'empty_order':
      return 'Choose what you are registering for.'
  }
}
