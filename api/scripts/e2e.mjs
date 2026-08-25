/**
 * End-to-end test against the deployed API.
 *
 *   node scripts/e2e.mjs
 *
 * This drives the real Worker, the real D1 database and real Razorpay TEST
 * orders. It walks the whole journey a student takes, and then tries to cheat
 * it in every way I can think of.
 *
 * The one step no script can do is the human tapping through Razorpay's payment
 * screen — that needs a browser and a card. Everything on our side of that
 * moment is exercised here by signing the webhook exactly as Razorpay would.
 */

import { createHmac, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'

const API = process.env.API ?? 'https://pyrexia-api.pyrexia-api.workers.dev'

const env = Object.fromEntries(
  readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)

/* ---------- tiny test harness ---------- */

let passed = 0
let failed = 0
const failures = []

function check(name, condition, detail = '') {
  if (condition) {
    passed++
    console.log(`  \x1b[32m✔\x1b[0m ${name}`)
  } else {
    failed++
    failures.push(name)
    console.log(`  \x1b[31m✖ ${name}\x1b[0m ${detail}`)
  }
}

function section(title) {
  console.log(`\n\x1b[1m${title}\x1b[0m`)
}

async function api(path, init = {}) {
  const { token, ...rest } = init
  const res = await fetch(`${API}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  })
  const text = await res.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    body = text
  }
  return { status: res.status, body }
}

/** Sign a webhook exactly the way Razorpay's servers do. */
function signWebhook(bodyString) {
  return createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(bodyString).digest('hex')
}

async function sendWebhook(payload, { signature, tamperAfterSigning } = {}) {
  let body = JSON.stringify(payload)
  const sig = signature ?? signWebhook(body)
  if (tamperAfterSigning) body = tamperAfterSigning(body)

  const res = await fetch(`${API}/webhooks/razorpay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Razorpay-Signature': sig },
    body,
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

const capturedEvent = (orderId, paymentId, amountPaise) => ({
  event: 'payment.captured',
  payload: {
    payment: {
      entity: {
        id: paymentId,
        order_id: orderId,
        status: 'captured',
        amount: amountPaise,
        method: 'upi',
        // Razorpay's real fee on ₹450: 2% = ₹9.00, GST on that = ₹1.62
        fee: Math.round(amountPaise * 0.02),
        tax: Math.round(amountPaise * 0.02 * 0.18),
      },
    },
  },
})

const person = (over = {}) => ({
  name: 'Aarav Sharma',
  email: `e2e.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@example.edu`,
  phone: `9${Math.floor(100000000 + Math.random() * 899999999)}`,
  gender: 'Male',
  college: 'AIIMS Rishikesh',
  city: 'Rishikesh',
  course: 'MBBS',
  year: '3rd',
  emergencyName: 'Priya Sharma',
  emergencyPhone: `8${Math.floor(100000000 + Math.random() * 899999999)}`,
  ...over,
})

/* ================================================================= */

console.log(`\nTesting \x1b[36m${API}\x1b[0m\n${'─'.repeat(60)}`)

/* ---------- 1. the API is alive ---------- */

section('1. The API is up')
{
  const health = await api('/health')
  check('health check responds', health.status === 200, JSON.stringify(health.body))

  const products = await api('/api/products')
  const basic = products.body.products?.find((p) => p.id === 'basic')
  const delegate = products.body.products?.find((p) => p.id === 'delegate')

  check('Basic Registration is ₹450', basic?.amountPaise === 45000, `got ${basic?.amountPaise}`)
  check('Delegate add-on is ₹2,250', delegate?.amountPaise === 225000, `got ${delegate?.amountPaise}`)
  check('Delegate requires Basic first', delegate?.requires === 'basic')
}

/* ---------- 2. the form rejects nonsense ---------- */

section('2. Bad input never reaches the database')
{
  const bad = await api('/api/registrations', {
    method: 'POST',
    headers: { 'Idempotency-Key': randomUUID() },
    body: JSON.stringify({ ...person({ phone: '12345', email: 'not-an-email' }), products: ['basic'] }),
  })

  check('a broken form is refused', bad.status === 422, `status ${bad.status}`)
  check('it says which fields are wrong', !!bad.body.error?.fields?.phone && !!bad.body.error?.fields?.email)

  const typo = await api('/api/registrations', {
    method: 'POST',
    headers: { 'Idempotency-Key': randomUUID() },
    body: JSON.stringify({ ...person({ email: 'aarav@gmial.com', phone: '12345' }), products: ['basic'] }),
  })
  check(
    'a gmial.com typo is spotted and corrected',
    typo.body.error?.emailSuggestion === 'aarav@gmail.com',
    JSON.stringify(typo.body.error?.emailSuggestion),
  )

  const noProducts = await api('/api/registrations', {
    method: 'POST',
    headers: { 'Idempotency-Key': randomUUID() },
    body: JSON.stringify({ ...person(), products: [] }),
  })
  check('an empty order is refused', noProducts.status === 400)

  const delegateAlone = await api('/api/registrations', {
    method: 'POST',
    headers: { 'Idempotency-Key': randomUUID() },
    body: JSON.stringify({ ...person(), products: ['delegate'] }),
  })
  check('Delegate cannot be bought without Basic', delegateAlone.status === 400)

  const noKey = await api('/api/registrations', {
    method: 'POST',
    body: JSON.stringify({ ...person(), products: ['basic'] }),
  })
  check('a request with no idempotency key is refused', noKey.status === 400)
}

/* ---------- 3. a real Basic registration ---------- */

section('3. Aarav registers for Basic Registration')
let aarav, aaravOrder, aaravRzpOrder, aaravRegistrationId, aaravPublicCode

{
  const key = randomUUID()
  const payload = { ...person(), products: ['basic'] }
  aarav = payload

  const created = await api('/api/registrations', {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    body: JSON.stringify(payload),
  })

  check('registration is created', created.status === 201, JSON.stringify(created.body).slice(0, 200))
  check('he is charged exactly ₹450', created.body.checkout?.amountPaise === 45000)
  check('he gets a pass number to quote', /^PYX26-[0-9BCDFGHJKLMNPQRSTVWXYZ]{6}$/.test(created.body.publicCode ?? ''), created.body.publicCode)
  check('a real Razorpay order was created', /^order_/.test(created.body.checkout?.razorpayOrderId ?? ''), created.body.checkout?.razorpayOrderId)
  check('only the public key reaches the browser', created.body.checkout?.keyId?.startsWith('rzp_test_'))
  check('the secret key never appears in the response', !JSON.stringify(created.body).includes(env.RAZORPAY_KEY_SECRET))

  aaravOrder = created.body.orderId
  aaravRzpOrder = created.body.checkout?.razorpayOrderId
  aaravRegistrationId = created.body.registrationId
  aaravPublicCode = created.body.publicCode

  // The double-tap: same key, same body, sent again.
  const again = await api('/api/registrations', {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    body: JSON.stringify(payload),
  })
  check('tapping Register twice does not register him twice', again.body.orderId === aaravOrder, `${again.body.orderId} vs ${aaravOrder}`)
  check('the second tap creates no second Razorpay order', again.body.checkout?.razorpayOrderId === aaravRzpOrder)

  // Same key, different body — a genuine client bug we want surfaced.
  const mismatched = await api('/api/registrations', {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    body: JSON.stringify({ ...payload, name: 'Someone Else' }),
  })
  check('reusing a key for a different request is caught', mismatched.status === 409, `status ${mismatched.status}`)
}

/* ---------- 4. before payment, he has nothing ---------- */

section('4. Before paying, he owns nothing')
{
  const status = await api(`/api/orders/${aaravOrder}/status`)
  check('the order is not confirmed', status.body.confirmed === false)
  check('he has no tier yet', status.body.tier === 0)
}

/* ---------- 5. forged payments grant nothing ---------- */

section('5. Cheating the payment')
{
  const forgedCallback = await api('/api/checkout/verify', {
    method: 'POST',
    body: JSON.stringify({
      razorpay_order_id: aaravRzpOrder,
      razorpay_payment_id: 'pay_i_never_paid',
      razorpay_signature: 'a'.repeat(64),
    }),
  })
  check('a made-up "I paid" message is rejected', forgedCallback.status === 403, `status ${forgedCallback.status}`)

  const unsigned = await sendWebhook(capturedEvent(aaravRzpOrder, 'pay_fake', 45000), { signature: 'deadbeef' })
  check('a webhook with a bad signature is rejected', unsigned.status === 401)

  const tampered = await sendWebhook(capturedEvent(aaravRzpOrder, 'pay_fake2', 45000), {
    tamperAfterSigning: (b) => b.replace('45000', '270000'),
  })
  check('a webhook edited after signing is rejected', tampered.status === 401)

  const stillNothing = await api(`/api/orders/${aaravOrder}/status`)
  check('after all that, he still owns nothing', stillNothing.body.confirmed === false && stillNothing.body.tier === 0)
}

/* ---------- 6. the real payment lands ---------- */

section('6. Razorpay confirms the payment')
{
  const paymentId = `pay_e2e_${Date.now()}`
  const captured = await sendWebhook(capturedEvent(aaravRzpOrder, paymentId, 45000))
  check('a correctly signed webhook is accepted', captured.status === 200, JSON.stringify(captured.body))

  const status = await api(`/api/orders/${aaravOrder}/status`)
  check('the order is now confirmed', status.body.confirmed === true, JSON.stringify(status.body))
  check('he is a Basic holder, not a Delegate', status.body.tier === 0)

  // Razorpay retries. Sometimes for days.
  const retry = await sendWebhook(capturedEvent(aaravRzpOrder, paymentId, 45000))
  check('a repeated delivery of the same event is harmless', retry.status === 200)

  const afterRetry = await api(`/api/orders/${aaravOrder}/status`)
  check('he is still charged once, still tier 0', afterRetry.body.confirmed === true && afterRetry.body.tier === 0)
}

/* ---------- 7. registering again is refused ---------- */

section('7. He cannot pay twice by accident')
{
  const dup = await api('/api/registrations', {
    method: 'POST',
    headers: { 'Idempotency-Key': randomUUID() },
    body: JSON.stringify({ ...aarav, products: ['basic'] }),
  })
  check('a second registration on the same email is refused', dup.status === 409, `status ${dup.status}`)
  check('he is told to sign in and upgrade instead', /delegate card/i.test(dup.body.error?.message ?? ''), dup.body.error?.message)
}

/* ---------- 8. the upgrade ---------- */

section('8. He signs back in')
let aaravSession

{
  const anon = await api('/api/me')
  check('a stranger cannot read someone else’s account', anon.status === 401, `status ${anon.status}`)

  const unknown = await api('/api/auth/request', {
    method: 'POST',
    body: JSON.stringify({ identifier: 'nobody@nowhere.example' }),
  })
  check('an unknown email gets the same vague answer', unknown.body.sent === true)
  check('and no token is issued for it', !unknown.body.devToken)

  const requested = await api('/api/auth/request', {
    method: 'POST',
    body: JSON.stringify({ identifier: aarav.email }),
  })
  check('a sign-in link is issued for a real account', !!requested.body.devToken)

  const linkToken = requested.body.devToken

  const consumed = await api('/api/auth/consume', {
    method: 'POST',
    body: JSON.stringify({ token: linkToken }),
  })
  check('the link opens a session', consumed.status === 200 && !!consumed.body.token)
  aaravSession = consumed.body.token

  const reuse = await api('/api/auth/consume', {
    method: 'POST',
    body: JSON.stringify({ token: linkToken }),
  })
  check('the same link cannot be used twice', reuse.status === 401, `status ${reuse.status}`)

  const mine = await api('/api/me', { token: aaravSession })
  check('he can now see his own account', mine.status === 200 && mine.body.publicCode === aaravPublicCode)
  check('it shows him as Basic', mine.body.tier === 0 && mine.body.tierName === 'Basic Registration')
  check('and offers the Delegate Card as the next step', mine.body.available?.some((p) => p.id === 'delegate'))
  check('a pass has been issued to him', mine.body.hasPass === true)

  const garbage = await api('/api/me', { token: 'not-a-real-session-token' })
  check('a made-up session token is refused', garbage.status === 401)
}

section('9. His pass')
{
  const pass = await api('/api/me/pass', { token: aaravSession })
  check('the pass is signed and returned', pass.status === 200 && !!pass.body.token, JSON.stringify(pass.body).slice(0, 160))
  check('the QR payload has the right shape', /^PYX26\.[\w-]+\.[\w-]+$/.test(pass.body.token ?? ''))
  check('it fits comfortably in a QR code', (pass.body.token ?? '').length <= 128, `${(pass.body.token ?? '').length} chars`)
  check('it names the holder for the guard', pass.body.name === aarav.name)
  check('it says Basic for now', pass.body.tier === 0)

  const anon = await api('/api/me/pass')
  check('the pass is not readable without signing in', anon.status === 401)
}

section('10. In October he adds the Delegate Card')
let upgradeOrder, upgradeRzpOrder

{
  const noAuth = await api(`/api/registrations/${aaravRegistrationId}/upgrade`, {
    method: 'POST',
    headers: { 'Idempotency-Key': randomUUID() },
    body: JSON.stringify({ products: ['delegate'] }),
  })
  check('an upgrade cannot be started without signing in', noAuth.status === 401, `status ${noAuth.status}`)

  const upgrade = await api(`/api/registrations/${aaravRegistrationId}/upgrade`, {
    method: 'POST',
    token: aaravSession,
    headers: { 'Idempotency-Key': randomUUID() },
    body: JSON.stringify({ products: ['delegate'] }),
  })

  check('the upgrade order is created', upgrade.status === 201, JSON.stringify(upgrade.body).slice(0, 200))
  check('he pays only the ₹2,250 add-on, not ₹2,700 again', upgrade.body.checkout?.amountPaise === 225000, `got ${upgrade.body.checkout?.amountPaise}`)

  upgradeOrder = upgrade.body.orderId
  upgradeRzpOrder = upgrade.body.checkout?.razorpayOrderId

  const paid = await sendWebhook(capturedEvent(upgradeRzpOrder, `pay_upg_${Date.now()}`, 225000))
  check('the upgrade payment is accepted', paid.status === 200)

  const status = await api(`/api/orders/${upgradeOrder}/status`)
  check('he is now a Delegate', status.body.tier === 1, JSON.stringify(status.body))

  const buyAgain = await api(`/api/registrations/${aaravRegistrationId}/upgrade`, {
    method: 'POST',
    token: aaravSession,
    headers: { 'Idempotency-Key': randomUUID() },
    body: JSON.stringify({ products: ['delegate'] }),
  })
  check('he cannot buy the Delegate Card twice', buyAgain.status === 400, `status ${buyAgain.status}`)

  const pass = await api('/api/me/pass', { token: aaravSession })
  check('his pass now reads Delegate on the same pass id', pass.body.tier === 1, JSON.stringify(pass.body.tier))
}

/* ---------- 9. a first-time Delegate ---------- */

section('11. Someone else buys Delegate upfront')
{
  const created = await api('/api/registrations', {
    method: 'POST',
    headers: { 'Idempotency-Key': randomUUID() },
    body: JSON.stringify({ ...person({ name: 'Meera Nair' }), products: ['basic', 'delegate'] }),
  })

  check('both products in one order', created.status === 201, JSON.stringify(created.body).slice(0, 200))
  check('charged ₹2,700 in a single payment', created.body.checkout?.amountPaise === 270000, `got ${created.body.checkout?.amountPaise}`)
  check('the receipt lists Basic first, then Delegate', JSON.stringify(created.body.lines?.map((l) => l.productId)) === '["basic","delegate"]')

  const paid = await sendWebhook(capturedEvent(created.body.checkout.razorpayOrderId, `pay_meera_${Date.now()}`, 270000))
  check('her payment is accepted', paid.status === 200)

  const status = await api(`/api/orders/${created.body.orderId}/status`)
  check('she is a Delegate straight away', status.body.tier === 1, JSON.stringify(status.body))
}

/* ---------- 10. the amount guard ---------- */

section('12. A payment for the wrong amount grants nothing')
{
  const created = await api('/api/registrations', {
    method: 'POST',
    headers: { 'Idempotency-Key': randomUUID() },
    body: JSON.stringify({ ...person({ name: 'Rohan Underpay' }), products: ['basic'] }),
  })

  // Correctly signed, but claims only ₹1 was captured against a ₹450 order.
  const short = await sendWebhook(capturedEvent(created.body.checkout.razorpayOrderId, `pay_short_${Date.now()}`, 100))
  check('the webhook is acknowledged', short.status === 200)

  const status = await api(`/api/orders/${created.body.orderId}/status`)
  check('but nothing is granted for an underpayment', status.body.confirmed === false, JSON.stringify(status.body))
}

/* ================================================================= */

console.log(`\n${'─'.repeat(60)}`)
console.log(`\x1b[1m${passed} passed, ${failed} failed\x1b[0m`)
if (failed) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  • ${f}`)
  process.exit(1)
}
console.log('\x1b[32mEverything held.\x1b[0m\n')
