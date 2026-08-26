import { test } from 'node:test'
import assert from 'node:assert/strict'

import { checkPassword, hashPassword, needsRehash, verifyPassword } from './password.ts'

test('a password verifies against its own hash', async () => {
  const stored = await hashPassword('correct horse battery')
  assert.equal(await verifyPassword('correct horse battery', stored), true)
})

test('a wrong password does not', async () => {
  const stored = await hashPassword('correct horse battery')
  assert.equal(await verifyPassword('correct horse batteryy', stored), false)
  assert.equal(await verifyPassword('Correct horse battery', stored), false, 'case matters')
  assert.equal(await verifyPassword('', stored), false)
})

test('the same password hashes differently every time', async () => {
  const a = await hashPassword('same password')
  const b = await hashPassword('same password')
  assert.notEqual(a, b, 'a missing salt would make these identical')
  assert.equal(await verifyPassword('same password', a), true)
  assert.equal(await verifyPassword('same password', b), true)
})

test('the stored form carries its own parameters', async () => {
  const stored = await hashPassword('x'.repeat(12))
  const [algo, digest, work] = stored.split('$')
  assert.equal(algo, 'pbkdf2')
  assert.equal(digest, 'sha256')
  assert.equal(stored.split('$').length, 5)

  // Workers cap a single PBKDF2 call at 100,000, so the work factor is spread
  // across rounds. What matters is the product.
  const [iter, rounds] = work.split('x').map(Number)
  assert.ok(iter <= 100_000, `a single call must stay under the Workers cap, got ${iter}`)
  assert.ok(iter * rounds >= 600_000, `effective work was only ${iter * rounds}`)
})

test('the plaintext never appears in the stored value', async () => {
  const stored = await hashPassword('SuperSecret2026')
  assert.doesNotMatch(stored, /SuperSecret/i)
})

test('a corrupted or missing hash fails rather than throwing', async () => {
  for (const bad of [null, '', 'nonsense', 'pbkdf2$sha256$210000$onlyfour',
    'pbkdf2$md5$210000$aaaa$bbbb', 'pbkdf2$sha256$abc$aaaa$bbbb',
    'pbkdf2$sha256$1$aaaa$bbbb', 'bcrypt$sha256$210000$aaaa$bbbb']) {
    assert.equal(await verifyPassword('anything', bad), false, `should reject: ${bad}`)
  }
})

test('a weaker stored hash is flagged for upgrade', async () => {
  const stored = await hashPassword('a good password')
  assert.equal(needsRehash(stored), false)

  // The single-round form some other tool might have written.
  assert.equal(needsRehash(stored.replace(/\$100000x6\$/, '$100000$')), true)
  assert.equal(needsRehash(stored.replace(/\$100000x6\$/, '$100000x2$')), true)
  assert.equal(needsRehash('garbage'), true)
})

test('a single round never exceeds what Workers allow', async () => {
  // The bug this guards: 210,000 in one call throws NotSupportedError on
  // Cloudflare, which surfaced as a 500 on every sign-up.
  const stored = await hashPassword('anything at all')
  const perCall = Number(stored.split('$')[2].split('x')[0])
  assert.ok(perCall <= 100_000, `${perCall} would throw on Workers`)
})

test('password rules block only what is worth blocking', () => {
  assert.equal(checkPassword('shortie'), 'Use at least 8 characters.')
  assert.match(checkPassword('password') ?? '', /easy to guess/)
  assert.match(checkPassword('PYREXIA2026') ?? '', /easy to guess/)
  assert.match(checkPassword('aaaaaaaaaa') ?? '', /easy to guess/)
  assert.equal(checkPassword('x'.repeat(300)), 'That password is too long.')

  // No forced symbols or digits: length is what helps, and character-class
  // rules just produce Password1!
  assert.equal(checkPassword('my fest password'), null)
  assert.equal(checkPassword('rishikesh2026'), null)
  assert.equal(checkPassword('aarav sharma!'), null)
})
