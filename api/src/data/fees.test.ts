import { strict as assert } from 'node:assert'
import { test } from 'node:test'

import { EVENT_FEES, feeFor, priceEntry } from './fees.ts'
import { registerableEvents, resolveEvent } from './events.ts'

/**
 * The fee table is the one file in this project where a typo costs somebody
 * money. These tests are less about the arithmetic than about the shapes that
 * make the arithmetic possible: a band id that doesn't exist, a per-head price
 * that forgets to multiply, a fee attached to an event nobody can enter.
 */

test('a single-band event needs no variant id to be priced', () => {
  const priced = priceEntry('Squid Game', null)
  assert.equal(priced?.amountPaise, 8000)
  assert.equal(priced?.id, 'standard')
})

test('a multi-band event refuses to guess which band applies', () => {
  assert.equal(priceEntry('Evening Amore', null), null)
  assert.equal(priceEntry('Evening Amore', 'not-a-band'), null)
  assert.equal(priceEntry('Evening Amore', 'single-boys')?.amountPaise, 18000)
})

test('a per-head band multiplies by the crew, a flat one does not', () => {
  // Nritya Sangam: solo ₹250, duet ₹400, group ₹100 a head.
  assert.equal(priceEntry('Nritya Sangam', 'group', 8)?.amountPaise, 80000)
  assert.equal(priceEntry('Nritya Sangam', 'group', 8)?.unitPaise, 10000)
  assert.equal(priceEntry('Nritya Sangam', 'group', 8)?.headCount, 8)

  // The duet band is a flat price: eight people would still pay ₹400, which is
  // exactly why the rulebook caps a duet at two.
  assert.equal(priceEntry('Nritya Sangam', 'duet', 8)?.amountPaise, 40000)
  assert.equal(priceEntry('Nritya Sangam', 'duet', 8)?.headCount, 1)
})

test('a nonsense head count can never price an entry at zero or below', () => {
  for (const heads of [0, -5, 0.4, Number.NaN]) {
    const priced = priceEntry('Street Blaze', 'group', heads)
    assert.equal(priced?.amountPaise, 9000, `heads=${heads}`)
  }
})

test('an event with no fee row is free, not broken', () => {
  // Battle of Bands charges ₹2000 a band, but only after the screening round,
  // so entering costs nothing and there is deliberately no row for it.
  assert.equal(feeFor('Battle of Bands'), null)
  assert.equal(priceEntry('Battle of Bands', 'standard'), null)
})

test('every priced event is one a delegate can actually enter', () => {
  const enterable = new Set(registerableEvents.map((e) => e.name))
  for (const name of Object.keys(EVENT_FEES)) {
    assert.ok(enterable.has(name), `${name} has a fee but is not on the chart`)
  }
})

test('no Thunderbolt bracket is priced here, they are paid on the crew’s own form', () => {
  for (const e of registerableEvents) {
    if (e.territory.id !== 'thunderbolt') continue
    assert.equal(feeFor(e.name), null, `${e.name} must not be priced on the site`)
    assert.ok(resolveEvent(e.name)?.externalForm, `${e.name} must carry its form link`)
  }
})

test('band ids are unique within an event', () => {
  for (const [name, fee] of Object.entries(EVENT_FEES)) {
    const ids = fee.variants.map((v) => v.id)
    assert.equal(new Set(ids).size, ids.length, `${name} has a duplicate band id`)
    assert.ok(ids.length > 0, `${name} has no bands`)
  }
})

test('every fee is a whole number of paise above zero', () => {
  for (const [name, fee] of Object.entries(EVENT_FEES)) {
    for (const v of fee.variants) {
      assert.ok(Number.isInteger(v.amountPaise), `${name}/${v.id} is not whole paise`)
      assert.ok(v.amountPaise > 0, `${name}/${v.id} costs nothing`)
    }
  }
})

test('a team-only event is never priced per head without room for a team', () => {
  for (const [name, fee] of Object.entries(EVENT_FEES)) {
    if (!fee.variants.some((v) => v.perHead)) continue
    const form = resolveEvent(name)?.form
    assert.ok(form?.teamSize, `${name} is priced per head but takes no team`)
  }
})
