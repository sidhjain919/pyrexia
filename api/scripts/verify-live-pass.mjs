/**
 * Take a pass minted by the live server and put it through the gate logic,
 * using only the PUBLIC key — exactly what a guard's phone will do, offline.
 */
import { randomUUID, webcrypto } from 'node:crypto'
import { verifyPass, decidePassAtGate } from '../src/lib/pass.ts'

globalThis.crypto ??= webcrypto
const API = 'https://pyrexia-api.pyrexia-api.workers.dev'

const j = async (p, init = {}) => {
  const r = await fetch(API + p, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
  return r.json()
}

// A fresh Delegate, paid for end to end.
const person = {
  name: 'Gate Test', email: `gate.${Date.now()}@example.edu`,
  phone: `9${Math.floor(1e8 + Math.random() * 9e8)}`, gender: 'Other',
  college: 'AIIMS Rishikesh', city: 'Rishikesh', course: 'MBBS', year: '2nd',
  emergencyName: 'Contact', emergencyPhone: `8${Math.floor(1e8 + Math.random() * 9e8)}`,
}

const reg = await j('/api/registrations', {
  method: 'POST', headers: { 'Idempotency-Key': randomUUID() },
  body: JSON.stringify({ ...person, products: ['basic', 'delegate'] }),
})

const { createHmac } = await import('node:crypto')
const { readFileSync } = await import('node:fs')
const secret = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8')
  .match(/^RAZORPAY_WEBHOOK_SECRET=(.+)$/m)[1].trim()

const evt = JSON.stringify({
  event: 'payment.captured',
  payload: { payment: { entity: {
    id: `pay_gate_${Date.now()}`, order_id: reg.checkout.razorpayOrderId,
    status: 'captured', amount: 270000, method: 'upi', fee: 5400, tax: 972 } } },
})
await fetch(`${API}/webhooks/razorpay`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json',
    'X-Razorpay-Signature': createHmac('sha256', secret).update(evt).digest('hex') },
  body: evt,
})

const link = await j('/api/auth/request', {
  method: 'POST', body: JSON.stringify({ identifier: person.email }),
})
const sess = await j('/api/auth/consume', {
  method: 'POST', body: JSON.stringify({ token: link.devToken }),
})
const pass = await j('/api/me/pass', { headers: { Authorization: `Bearer ${sess.token}` } })

console.log(`\nPass minted by the live server for ${pass.name}`)
console.log(`  ${pass.token}`)
console.log(`  ${pass.token.length} characters, tier ${pass.tier} (${pass.tierName})\n`)

// --- now act as the guard's phone: public key only, no network ---
// Exactly what a guard's phone does when it is provisioned: ask the server
// for the verification keys, then never need the network again.
const { keys: published } = await j('/api/pass-keys')
console.log(`fetched ${published.length} verification key(s) from the server`)

const keys = new Map()
for (const k of published) {
  keys.set(
    k.kid,
    await webcrypto.subtle.importKey(
      'raw',
      Buffer.from(k.publicKey.replace(/-/g, '+').replace(/_/g, '/'), 'base64'),
      { name: 'Ed25519' }, true, ['verify'],
    ),
  )
}

const verified = await verifyPass(pass.token, keys)
console.log('offline signature check:', verified.valid ? '\x1b[32mVALID\x1b[0m' : `\x1b[31m${verified.reason}\x1b[0m`)

const manifest = new Map([[pass.passId, {
  passId: pass.passId, name: pass.name, college: pass.college,
  tier: pass.tier, revoked: false,
}]])

for (const gate of [
  { gateId: 'main', allowedTiers: [0, 1], allowReentry: false },
  { gateId: 'star-night', allowedTiers: [1], allowReentry: false },
]) {
  const first = decidePassAtGate({ verified, manifest, gate, entriesToday: 0 })
  const second = decidePassAtGate({ verified, manifest, gate, entriesToday: 1 })
  console.log(`  ${gate.gateId.padEnd(12)} first scan: ${first.outcome.padEnd(10)} second scan: ${second.outcome}`)
}

// And a Basic holder at the Star Night gate.
const basicOnly = new Map([[pass.passId, { ...manifest.get(pass.passId), tier: 0 }]])
const downgraded = await verifyPass(pass.token, keys)
console.log(`\n  (a Basic pass at star-night would be: ${
  decidePassAtGate({
    verified: { valid: true, payload: { ...downgraded.payload, tierFloor: 0 } },
    manifest: basicOnly,
    gate: { gateId: 'star-night', allowedTiers: [1], allowReentry: false },
    entriesToday: 0,
  }).outcome
})\n`)
