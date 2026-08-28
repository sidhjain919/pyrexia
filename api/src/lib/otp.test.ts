import { test } from 'node:test'
import assert from 'node:assert/strict'

import { cleanCode, codesMatch, generateCode, hashCode } from './otp.ts'

test('otp: generates six digits, and keeps leading zeros', () => {
  for (let i = 0; i < 500; i++) {
    const code = generateCode()
    assert.match(code, /^\d{6}$/, `bad code: ${code}`)
  }
})

test('otp: does not repeat itself', () => {
  // Not a randomness proof — just enough to catch a constant or a seeded
  // generator, which is the failure that would actually ship.
  const seen = new Set(Array.from({ length: 300 }, generateCode))
  assert.ok(seen.size > 290, `only ${seen.size} distinct codes in 300`)
})

test('otp: the hash is bound to one account', async () => {
  // The same code for two people must not produce the same hash, or a hash
  // captured from one account could be replayed against another.
  const a = await hashCode('reg-1', '123456')
  const b = await hashCode('reg-2', '123456')
  assert.notEqual(a, b)
})

test('otp: hashing is deterministic', async () => {
  assert.equal(await hashCode('reg-1', '123456'), await hashCode('reg-1', '123456'))
})

test('otp: the code never appears in its own hash', async () => {
  const hash = await hashCode('reg-1', '424242')
  assert.ok(!hash.includes('424242'))
})

test('otp: comparison is exact', () => {
  assert.equal(codesMatch('123456', '123456'), true)
  assert.equal(codesMatch('123456', '123457'), false)
  assert.equal(codesMatch('123456', '12345'), false)
  assert.equal(codesMatch('', ''), true)
})

test('otp: accepts a code however someone types it', () => {
  // People paste "123 456" and "123-456" from an email without thinking.
  assert.equal(cleanCode(' 123 456 '), '123456')
  assert.equal(cleanCode('123-456'), '123456')
  assert.equal(cleanCode('123456789'), '123456')
  assert.equal(cleanCode('abc'), '')
})
