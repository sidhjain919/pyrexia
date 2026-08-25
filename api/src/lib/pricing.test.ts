import { test } from 'node:test'
import assert from 'node:assert/strict'

import { formatPaise, quote, type Product } from './pricing.ts'

const PRODUCTS = new Map<string, Product>([
  ['basic', { id: 'basic', name: 'Basic Registration', amount_paise: 45000, requires: null, active: 1, sort_order: 1 }],
  ['delegate', { id: 'delegate', name: 'Delegate Card', amount_paise: 225000, requires: 'basic', active: 1, sort_order: 2 }],
])

const ok = (r: ReturnType<typeof quote>) => {
  assert.equal(r.ok, true, `expected a quote, got ${JSON.stringify(r)}`)
  return r.ok ? r.quote : (undefined as never)
}
const failure = (r: ReturnType<typeof quote>) => {
  assert.equal(r.ok, false, 'expected a failure')
  return r.ok ? (undefined as never) : r.failure
}

test('Basic on its own is ₹450', () => {
  const q = ok(quote(['basic'], PRODUCTS))
  assert.equal(q.totalPaise, 45000)
  assert.deepEqual(q.lines.map((l) => l.productId), ['basic'])
})

test('a first-time Delegate pays ₹2,700 in one order', () => {
  const q = ok(quote(['basic', 'delegate'], PRODUCTS))
  assert.equal(q.totalPaise, 270000)
  assert.deepEqual(q.lines.map((l) => l.amountPaise), [45000, 225000])
})

test('upgrading later costs only the ₹2,250 add-on', () => {
  const q = ok(quote(['delegate'], PRODUCTS, new Set(['basic'])))
  assert.equal(q.totalPaise, 225000)
})

test('buying in two goes costs the same as buying at once', () => {
  const upfront = ok(quote(['basic', 'delegate'], PRODUCTS)).totalPaise
  const staged =
    ok(quote(['basic'], PRODUCTS)).totalPaise +
    ok(quote(['delegate'], PRODUCTS, new Set(['basic']))).totalPaise

  assert.equal(upfront, staged, 'the upgrade path must never be a worse deal')
})

test('lines are ordered by the catalogue, not by the request', () => {
  const q = ok(quote(['delegate', 'basic'], PRODUCTS))
  assert.deepEqual(q.lines.map((l) => l.productId), ['basic', 'delegate'])
})

test('the Delegate Card cannot be bought without Basic', () => {
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
  assert.equal(ok(quote(hostile, PRODUCTS)).totalPaise, 45000)
})

test('formatPaise renders rupees for display only', () => {
  assert.equal(formatPaise(45000), '₹450')
  assert.equal(formatPaise(270000), '₹2,700')
  assert.equal(formatPaise(43938), '₹439.38')
})
