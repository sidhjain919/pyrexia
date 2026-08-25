/**
 * Pass token tests.
 *
 * These are the tests that matter most in the whole codebase: everything here
 * is about someone not getting into a Star Night they didn't pay for, or a
 * paying delegate not being turned away at the door.
 *
 * Run with:  npm test
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  decidePassAtGate,
  decodePayload,
  encodePayload,
  fromBase64Url,
  newPassId,
  nowInMinutes,
  PASS_VERSION,
  signPass,
  toBase64Url,
  verifyPass,
  type ManifestEntry,
  type PassPayload,
  type Tier,
} from './pass.ts'

/* ---------- helpers ---------- */

async function keypair() {
  return (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair
}

function payload(over: Partial<PassPayload> = {}): PassPayload {
  return {
    version: PASS_VERSION,
    kid: 1,
    passId: newPassId(),
    tierFloor: 0,
    issuedAt: nowInMinutes(),
    ...over,
  }
}

const manifestOf = (...rows: ManifestEntry[]) =>
  new Map(rows.map((r) => [r.passId, r]))

const holder = (passId: string, over: Partial<ManifestEntry> = {}): ManifestEntry => ({
  passId,
  name: 'Aarav Sharma',
  college: 'AIIMS Rishikesh',
  tier: 0,
  revoked: false,
  ...over,
})

const GATE_MAIN = { gateId: 'main', allowedTiers: [0, 1] as Tier[], allowReentry: false }
const GATE_STAR = { gateId: 'star', allowedTiers: [1] as Tier[], allowReentry: false }

/* ---------- encoding ---------- */

test('base64url round-trips arbitrary bytes without padding', () => {
  for (const len of [1, 22, 23, 64, 87]) {
    const bytes = crypto.getRandomValues(new Uint8Array(len))
    const encoded = toBase64Url(bytes)
    assert.doesNotMatch(encoded, /[+/=]/, 'must be URL and QR safe')
    assert.deepEqual(fromBase64Url(encoded), bytes)
  }
})

test('payload round-trips every field exactly', () => {
  const p = payload({ kid: 7, tierFloor: 1, issuedAt: 29_783_333 })
  const decoded = decodePayload(encodePayload(p))
  assert.deepEqual(decoded, p)
})

test('payload is 23 bytes and the token stays QR-sized', async () => {
  const { privateKey } = await keypair()
  assert.equal(encodePayload(payload()).length, 23)

  const token = await signPass(payload(), privateKey)
  assert.ok(token.length <= 128, `token was ${token.length} chars`)
  assert.match(token, /^PYX26\.[\w-]+\.[\w-]+$/)
})

test('encoding rejects values that cannot be represented', () => {
  assert.throws(() => encodePayload(payload({ kid: 256 })), RangeError)
  assert.throws(() => encodePayload(payload({ tierFloor: 2 as Tier })), RangeError)
  assert.throws(() => encodePayload(payload({ issuedAt: 2 ** 32 })), RangeError)
  assert.throws(() => encodePayload(payload({ passId: 'nothex' })), TypeError)
})

test('pass ids are 128 random bits, not a sequence', () => {
  const ids = new Set(Array.from({ length: 500 }, newPassId))
  assert.equal(ids.size, 500, 'collisions in 500 draws means the source is not random')
  for (const id of ids) assert.match(id, /^[0-9a-f]{32}$/)
})

/* ---------- signing ---------- */

test('a pass we signed verifies', async () => {
  const { privateKey, publicKey } = await keypair()
  const p = payload({ tierFloor: 1 })
  const result = await verifyPass(await signPass(p, privateKey), new Map([[1, publicKey]]))

  assert.equal(result.valid, true)
  assert.deepEqual(result.valid && result.payload, p)
})

test('a pass signed by a different key is rejected', async () => {
  const real = await keypair()
  const attacker = await keypair()

  // The attacker knows the format perfectly and mints a Delegate pass.
  const forged = await signPass(payload({ tierFloor: 1 }), attacker.privateKey)
  const result = await verifyPass(forged, new Map([[1, real.publicKey]]))

  assert.deepEqual(result, { valid: false, reason: 'bad_signature' })
})

test('upgrading the tier byte breaks the signature', async () => {
  const { privateKey, publicKey } = await keypair()
  const token = await signPass(payload({ tierFloor: 0 }), privateKey)

  // Flip byte 18 from Basic to Delegate and re-encode — the exact attack a
  // Basic holder would try to get into a Star Night.
  const [prefix, body, sig] = token.split('.')
  const bytes = fromBase64Url(body)
  bytes[18] = 1
  const tampered = `${prefix}.${toBase64Url(bytes)}.${sig}`

  const result = await verifyPass(tampered, new Map([[1, publicKey]]))
  assert.deepEqual(result, { valid: false, reason: 'bad_signature' })
})

test('swapping in someone else’s pass id breaks the signature', async () => {
  const { privateKey, publicKey } = await keypair()
  const token = await signPass(payload(), privateKey)

  const [prefix, body, sig] = token.split('.')
  const bytes = fromBase64Url(body)
  bytes.set(fromBase64Url(toBase64Url(crypto.getRandomValues(new Uint8Array(16)))), 2)
  const result = await verifyPass(`${prefix}.${toBase64Url(bytes)}.${sig}`, new Map([[1, publicKey]]))

  assert.deepEqual(result, { valid: false, reason: 'bad_signature' })
})

test('an unknown key id is refused rather than trusted', async () => {
  const { privateKey, publicKey } = await keypair()
  const token = await signPass(payload({ kid: 9 }), privateKey)
  const result = await verifyPass(token, new Map([[1, publicKey]]))

  assert.deepEqual(result, { valid: false, reason: 'unknown_key' })
})

test('key rotation keeps old passes working', async () => {
  const oldKey = await keypair()
  const newKey = await keypair()
  const devices = new Map([
    [1, oldKey.publicKey],
    [2, newKey.publicKey],
  ])

  const printedInSeptember = await signPass(payload({ kid: 1 }), oldKey.privateKey)
  const issuedToday = await signPass(payload({ kid: 2 }), newKey.privateKey)

  assert.equal((await verifyPass(printedInSeptember, devices)).valid, true)
  assert.equal((await verifyPass(issuedToday, devices)).valid, true)
})

test('junk from the camera is malformed, never a crash', async () => {
  const { publicKey } = await keypair()
  const keys = new Map([[1, publicKey]])

  for (const junk of [
    '',
    'hello world',
    'PYX26.only-two-parts',
    'WRONG.aaaa.bbbb',
    'PYX26...',
    'PYX26.@@@@.@@@@',
    'PYX26.' + toBase64Url(new Uint8Array(5)) + '.' + toBase64Url(new Uint8Array(64)),
  ]) {
    const result = await verifyPass(junk, keys)
    assert.equal(result.valid, false, `should reject: ${junk}`)
  }
})

test('a future format version is refused, not guessed at', async () => {
  const { privateKey, publicKey } = await keypair()
  const token = await signPass(payload({ version: 2 }), privateKey)
  const result = await verifyPass(token, new Map([[1, publicKey]]))

  assert.deepEqual(result, { valid: false, reason: 'unsupported_version' })
})

/* ---------- the gate decision ---------- */

test('a valid Basic pass gets into the main gate', async () => {
  const { privateKey, publicKey } = await keypair()
  const p = payload()
  const verified = await verifyPass(await signPass(p, privateKey), new Map([[1, publicKey]]))

  const decision = decidePassAtGate({
    verified,
    manifest: manifestOf(holder(p.passId)),
    gate: GATE_MAIN,
    entriesToday: 0,
  })

  assert.equal(decision.outcome, 'ok')
  assert.equal(decision.entry?.name, 'Aarav Sharma')
})

test('a Basic pass is turned away from a Star Night gate', async () => {
  const { privateKey, publicKey } = await keypair()
  const p = payload()
  const verified = await verifyPass(await signPass(p, privateKey), new Map([[1, publicKey]]))

  const decision = decidePassAtGate({
    verified,
    manifest: manifestOf(holder(p.passId, { tier: 0 })),
    gate: GATE_STAR,
    entriesToday: 0,
  })

  assert.equal(decision.outcome, 'wrong_tier')
  assert.equal(decision.tier, 0)
  assert.equal(decision.recheckOnline, true, 'the upgrade may just not have synced yet')
})

test('an upgrade bought after printing works on the old QR', async () => {
  const { privateKey, publicKey } = await keypair()

  // Printed in September, when they only held Basic.
  const p = payload({ tierFloor: 0 })
  const verified = await verifyPass(await signPass(p, privateKey), new Map([[1, publicKey]]))

  // Bought the Delegate Card last night; the manifest knows even though the
  // paper in their hand still says Basic.
  const decision = decidePassAtGate({
    verified,
    manifest: manifestOf(holder(p.passId, { tier: 1 })),
    gate: GATE_STAR,
    entriesToday: 0,
  })

  assert.equal(decision.outcome, 'ok')
  assert.equal(decision.tier, 1)
})

test('the manifest can never quietly downgrade a signed pass', async () => {
  const { privateKey, publicKey } = await keypair()

  // Signed as Delegate; a stale or tampered manifest claims Basic.
  const p = payload({ tierFloor: 1 })
  const verified = await verifyPass(await signPass(p, privateKey), new Map([[1, publicKey]]))

  const decision = decidePassAtGate({
    verified,
    manifest: manifestOf(holder(p.passId, { tier: 0 })),
    gate: GATE_STAR,
    entriesToday: 0,
  })

  assert.equal(decision.outcome, 'ok', 'the signed floor must win')
  assert.equal(decision.tier, 1)
})

test('a pass too new to be in the manifest still gets in on its signature', async () => {
  const { privateKey, publicKey } = await keypair()
  const p = payload({ tierFloor: 1 })
  const verified = await verifyPass(await signPass(p, privateKey), new Map([[1, publicKey]]))

  const decision = decidePassAtGate({
    verified,
    manifest: new Map(),
    gate: GATE_STAR,
    entriesToday: 0,
  })

  assert.equal(decision.outcome, 'ok')
  assert.equal(decision.entry, undefined, 'no photo to show, but not turned away')
  assert.equal(decision.recheckOnline, true)
})

test('a second scan on the same day is a duplicate', async () => {
  const { privateKey, publicKey } = await keypair()
  const p = payload()
  const verified = await verifyPass(await signPass(p, privateKey), new Map([[1, publicKey]]))

  const decision = decidePassAtGate({
    verified,
    manifest: manifestOf(holder(p.passId)),
    gate: GATE_MAIN,
    entriesToday: 1,
  })

  assert.equal(decision.outcome, 'duplicate')
})

test('re-entry gates let the same pass back in', async () => {
  const { privateKey, publicKey } = await keypair()
  const p = payload()
  const verified = await verifyPass(await signPass(p, privateKey), new Map([[1, publicKey]]))

  const decision = decidePassAtGate({
    verified,
    manifest: manifestOf(holder(p.passId)),
    gate: { ...GATE_MAIN, allowReentry: true },
    entriesToday: 3,
  })

  assert.equal(decision.outcome, 'ok')
})

test('a revoked pass is refused even offline', async () => {
  const { privateKey, publicKey } = await keypair()
  const p = payload({ tierFloor: 1 })
  const verified = await verifyPass(await signPass(p, privateKey), new Map([[1, publicKey]]))

  const decision = decidePassAtGate({
    verified,
    manifest: manifestOf(holder(p.passId, { tier: 1, revoked: true })),
    gate: GATE_STAR,
    entriesToday: 0,
  })

  assert.equal(decision.outcome, 'revoked')
})

test('revocation beats the signed floor', async () => {
  const { privateKey, publicKey } = await keypair()

  // Refunded after issue: the token is still cryptographically perfect.
  const p = payload({ tierFloor: 1 })
  const verified = await verifyPass(await signPass(p, privateKey), new Map([[1, publicKey]]))

  const decision = decidePassAtGate({
    verified,
    manifest: manifestOf(holder(p.passId, { tier: 1, revoked: true })),
    gate: GATE_MAIN,
    entriesToday: 0,
  })

  assert.equal(decision.outcome, 'revoked')
})

test('a forged token never reaches the tier logic', async () => {
  const real = await keypair()
  const attacker = await keypair()

  const forged = await signPass(payload({ tierFloor: 1 }), attacker.privateKey)
  const verified = await verifyPass(forged, new Map([[1, real.publicKey]]))

  const decision = decidePassAtGate({
    verified,
    // Even with a manifest that would happily admit them.
    manifest: manifestOf(holder(decodePayload(fromBase64Url(forged.split('.')[1])).passId, { tier: 1 })),
    gate: GATE_STAR,
    entriesToday: 0,
  })

  assert.equal(decision.outcome, 'invalid_signature')
  assert.equal(decision.tier, 0)
})
