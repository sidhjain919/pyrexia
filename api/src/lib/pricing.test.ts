import { test } from 'node:test'
import assert from 'node:assert/strict'

import { CONVENIENCE_BPS, conveniencePaise, formatPaise, quote, type Product } from './pricing.ts'

const PRODUCTS = new Map<string, Product>([
  ['basic', { id: 'basic', name: 'Basic Registration', amount_paise: 50000, requires: null, active: 1, sort_order: 1 }],
  ['delegate', { id: 'delegate', name: 'Festival Pass', amount_paise: 220000, requires: 'basic', active: 1, sort_order: 2 }],
])

const ok = (r: ReturnType<typeof quote>) => {
  assert.equal(r.ok, true, `expected a quote, got ${JSON.stringify(r)}`)
  return r.ok ? r.quote : (undefined as never)
}
const failure = (r: ReturnType<typeof quote>) => {
  assert.equal(r.ok, false, 'expected a failure')
  return r.ok ? (undefined as never) : r.failure
}

test('Basic on its own is ₹500 before gateway charges', () => {
  const q = ok(quote(['basic'], PRODUCTS))
  assert.equal(q.subtotalPaise, 50000)
  assert.deepEqual(q.lines.map((l) => l.productId), ['basic'])
})

test('a first-time Delegate buys both in one order', () => {
  const q = ok(quote(['basic', 'delegate'], PRODUCTS))
  assert.equal(q.subtotalPaise, 270000)
  assert.deepEqual(q.lines.map((l) => l.amountPaise), [50000, 220000])
})

test('upgrading later costs only the add-on', () => {
  const q = ok(quote(['delegate'], PRODUCTS, new Set(['basic'])))
  assert.equal(q.subtotalPaise, 220000)
})

test('the gateway charge is added on top, never taken out of the fest share', () => {
  const q = ok(quote(['basic'], PRODUCTS))
  assert.equal(q.conveniencePaise, conveniencePaise(50000))
  assert.equal(q.totalPaise, q.subtotalPaise + q.conveniencePaise)
  // 2.36% of ₹500 is ₹11.80, and the fest keeps the whole ₹500.
  assert.equal(q.conveniencePaise, 1180)
  assert.equal(q.totalPaise, 51180)
})

test('the gateway charge grants nothing', () => {
  const q = ok(quote(['basic'], PRODUCTS))
  // Entitlements are issued per line item, so the fee must not be one.
  assert.deepEqual(q.lines.map((l) => l.productId), ['basic'])
})

test('a rounding remainder is charged, not absorbed', () => {
  // ₹120 at 2.36% is ₹2.832; the payer covers the third of a paisa.
  assert.equal(conveniencePaise(12000), 284)
  assert.equal(CONVENIENCE_BPS, 236)
})

test('buying in two goes costs the same as buying at once', () => {
  const upfront = ok(quote(['basic', 'delegate'], PRODUCTS)).subtotalPaise
  const staged =
    ok(quote(['basic'], PRODUCTS)).subtotalPaise +
    ok(quote(['delegate'], PRODUCTS, new Set(['basic']))).subtotalPaise

  assert.equal(upfront, staged, 'the upgrade path must never be a worse deal')
})

test('lines are ordered by the catalogue, not by the request', () => {
  const q = ok(quote(['delegate', 'basic'], PRODUCTS))
  assert.deepEqual(q.lines.map((l) => l.productId), ['basic', 'delegate'])
})

test('the Festival Pass cannot be bought without Basic', () => {
  const f = failure(quote(['delegate'], PRODUCTS))
  assert.deepEqual(f, { code: 'missing_prerequisite', productId: 'delegate', requires: 'basic' })
})

test('nobody is sold the same thing twice', () => {
  assert.deepEqual(failure(quote(['basic'], PRODUCTS, new Set(['basic']))), {
    code: 'already_owned',
    productId: 'basic',
  })
  assert.deepEqual(failure(quote(['basic', 'basic'], PRODUCTS)), {
    code: 'duplicate_product',
    productId: 'basic',
  })
})

test('unknown and inactive products are refused', () => {
  assert.deepEqual(failure(quote(['vip'], PRODUCTS)), {
    code: 'unknown_product',
    productId: 'vip',
  })

  const retired = new Map(PRODUCTS)
  retired.set('delegate', { ...PRODUCTS.get('delegate')!, active: 0 })
  assert.deepEqual(failure(quote(['basic', 'delegate'], retired)), {
    code: 'inactive_product',
    productId: 'delegate',
  })
})

test('an empty order is refused', () => {
  assert.deepEqual(failure(quote([], PRODUCTS)), { code: 'empty_order' })
})

test('a client cannot smuggle in an amount', () => {
  // Whatever shape a request takes, only the id is read; the price is ours.
  const hostile = ['basic'] as unknown as string[]
  ;(hostile as any).amountPaise = 1
  assert.equal(ok(quote(hostile, PRODUCTS)).subtotalPaise, 50000)
})

test('formatPaise renders rupees for display only', () => {
  assert.equal(formatPaise(50000), '₹500')
  assert.equal(formatPaise(270000), '₹2,700')
  assert.equal(formatPaise(43938), '₹439.38')
})

test('the payment mode is derived from the key, not from a flag somebody sets', () => {
  // A separate switch would be a second thing to remember, and the thing to
  // remember is exactly what fails. The key id already says which account the
  // money goes to, so that is what the banner reads.
  const mode = (keyId: string | undefined) =>
    keyId?.startsWith('rzp_live_') ? 'live' : 'test'

  assert.equal(mode('rzp_live_ABC123'), 'live')
  assert.equal(mode('rzp_test_ABC123'), 'test')
  // Anything unset or unrecognised is treated as test: the banner appearing
  // when it should not is a nuisance, missing when it should be there is a
  // fest that took no money for a day.
  assert.equal(mode(undefined), 'test')
  assert.equal(mode(''), 'test')
})
