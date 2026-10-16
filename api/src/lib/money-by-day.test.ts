import { strict as assert } from 'node:assert'
import { test } from 'node:test'

import { moneyByDay } from './money-by-day.ts'

const order = (o: Partial<Parameters<typeof moneyByDay>[0][number]>) => ({
  day: '2026-10-12', kind: 'registration', method: 'upi', amount_paise: 0, convenience_paise: 0,
  event_entry_id: null, accommodation_booking_id: null, items: null, ...o,
})

test('splits each order by purpose and by channel, and both sum to the total', () => {
  const [day] = moneyByDay([
    // Online Basic + Festival Pass with the gateway fee passed on.
    order({ amount_paise: 330_000 + 7_788, convenience_paise: 7_788, items: 'basic:50000,delegate:280000' }),
    // Online event entry: no line items.
    order({ kind: 'event', amount_paise: 20_472, convenience_paise: 472, event_entry_id: 'e1' }),
    // Desk accommodation in cash.
    order({ kind: 'desk', method: 'cash', amount_paise: 150_000, accommodation_booking_id: 'b1' }),
    // Desk Festival Pass by UPI, discounted ₹200 off ₹2,700.
    order({ kind: 'desk', method: 'upi', amount_paise: 250_000, items: 'delegate:270000' }),
    // Desk event entry in cash.
    order({ kind: 'desk', method: 'cash', amount_paise: 10_000, event_entry_id: 'e2' }),
  ])

  assert.equal(day.payments, 5)
  assert.equal(day.basicPaise, 50_000)
  assert.equal(day.festivalPaise, 280_000 + 250_000)
  assert.equal(day.eventsPaise, 20_000 + 10_000)
  assert.equal(day.accommodationPaise, 150_000)
  assert.equal(day.gatewayPaise, 7_788 + 472)

  const purposes = day.basicPaise + day.festivalPaise + day.eventsPaise + day.accommodationPaise + day.gatewayPaise
  assert.equal(purposes, day.totalPaise)
  assert.equal(day.onlinePaise + day.cashPaise + day.upiPaise, day.totalPaise)
  assert.equal(day.cashPaise, 160_000)
  assert.equal(day.upiPaise, 250_000)
})

test('a discount on a two-item desk order splits in proportion and still sums exactly', () => {
  const [day] = moneyByDay([
    order({ kind: 'desk', method: 'cash', amount_paise: 300_001, items: 'basic:50000,delegate:270000' }),
  ])
  assert.equal(day.basicPaise + day.festivalPaise, 300_001)
  assert.equal(day.basicPaise, Math.round((300_001 * 50_000) / 320_000))
})

test('days come back newest first', () => {
  const days = moneyByDay([
    order({ day: '2026-10-11', amount_paise: 50_000, items: 'basic:50000' }),
    order({ day: '2026-10-13', amount_paise: 50_000, items: 'basic:50000' }),
    order({ day: '2026-10-12', amount_paise: 50_000, items: 'basic:50000' }),
  ])
  assert.deepEqual(days.map((d) => d.day), ['2026-10-13', '2026-10-12', '2026-10-11'])
})
