import { strict as assert } from 'node:assert'
import { test } from 'node:test'

import {
  ALLOWED_DAYS,
  arrivalDatesFor,
  departureDate,
  festDate,
  priceStay,
  roomLabel,
  roomTypeById,
  roomTypesFor,
  ROOM_TYPES,
  SECURITY_DEPOSIT_RUPEES,
} from './accommodation.ts'

/**
 * The rate card is the other file where a typo costs somebody money, and this
 * one costs it per day. The figures below are transcribed from the 2026
 * official accommodation rate schedule rather than from the code they are
 * checking, which is the only way this test is worth running.
 */

/** [room type id, per-day rupees, whole-fest rupees as the schedule prints it] */
const SCHEDULE: readonly (readonly [string, number, number])[] = [
  ['boys-2-ac', 800, 4000],
  ['boys-2-nonac', 750, 3750],
  ['boys-3-ac', 700, 3500],
  ['boys-3-nonac', 600, 3000],
  ['boys-4-ac', 550, 2750],
  ['boys-4-nonac', 500, 2500],
  ['boys-5-ac', 450, 2250],
  ['boys-5-nonac', 400, 2000],

  ['girls-2-ac', 800, 4000],
  ['girls-2-nonac', 750, 3750],
  ['girls-3-ac', 700, 3500],
  ['girls-3-nonac', 600, 3000],
  ['girls-4-ac', 550, 2750],
  ['girls-4-nonac', 500, 2500],
]

test('every rate matches the published schedule, to the rupee', () => {
  for (const [id, perDay] of SCHEDULE) {
    const room = roomTypeById(id)
    assert.ok(room, `${id} is missing from the rate card`)
    assert.equal(room.ratePaise, perDay * 100, `${id} is priced wrong`)
  }
  // Nothing in the card that is not in the schedule, either.
  assert.equal(ROOM_TYPES.length, SCHEDULE.length)
})

test('a five-day stay costs exactly what the schedule prints for the whole fest', () => {
  for (const [id, , wholeFest] of SCHEDULE) {
    const priced = priceStay(id, 5, '2026-10-12')
    assert.ok(priced, `${id} could not be priced for five days`)
    assert.equal(priced.feePaise, wholeFest * 100, `${id} five-day total is wrong`)
  }
})

test('the girls block has no five-bed room, the boys block does', () => {
  assert.equal(roomTypesFor('girls').length, 6)
  assert.equal(roomTypesFor('boys').length, 8)
  assert.equal(roomTypeById('girls-5-ac'), null)
  assert.equal(roomTypeById('girls-5-nonac'), null)
  assert.ok(roomTypeById('boys-5-nonac'))
})

test('a stay is priced per day, so four days is four days', () => {
  // ₹700 a day, AC, three to a room.
  assert.equal(priceStay('boys-3-ac', 4, '2026-10-12')?.feePaise, 280000)
  assert.equal(priceStay('boys-3-ac', 5, '2026-10-12')?.feePaise, 350000)
  // The per-day rate is snapshotted alongside the total, so a receipt can
  // show its working.
  assert.equal(priceStay('boys-3-ac', 4, '2026-10-12')?.ratePaise, 70000)
})

test('a room the rate card does not let cannot be priced', () => {
  for (const id of ['', 'girls-5-ac', 'boys-6-ac', 'boys-3-AC', 'nonsense', '../boys-3-ac']) {
    assert.equal(priceStay(id, 5, '2026-10-12'), null, `${id} was priced`)
  }
})

test('a stay length nobody sells cannot be priced', () => {
  for (const days of [0, 1, 2, 3, 6, 50, -4, 4.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(priceStay('boys-3-ac', days, '2026-10-12'), null, `${days} days was priced`)
  }
  // And the two that are sold, are.
  for (const days of ALLOWED_DAYS) {
    assert.ok(priceStay('boys-3-ac', days, '2026-10-12'))
  }
})

test('a five-day stay can only begin on the first day of the fest', () => {
  assert.deepEqual(arrivalDatesFor(5), ['2026-10-12'])
  assert.equal(priceStay('boys-3-ac', 5, '2026-10-13'), null)
})

test('a four-day stay can begin on either of the first two days', () => {
  assert.deepEqual(arrivalDatesFor(4), ['2026-10-12', '2026-10-13'])
  assert.ok(priceStay('boys-3-ac', 4, '2026-10-13'))
  // But not on a day that would run the stay past the end of the fest.
  assert.equal(priceStay('boys-3-ac', 4, '2026-10-14'), null)
})

test('an arrival date outside the fest is refused however plausible it looks', () => {
  for (const date of ['2026-10-11', '2026-10-17', '2026-11-12', '', 'tomorrow', '2026-10-12 ']) {
    assert.equal(priceStay('boys-3-ac', 5, date), null, `${date} was accepted`)
  }
})

test('departure is the last night, not the day after it', () => {
  // Five days from the 12th is the 12th to the 16th inclusive, which is the
  // whole fest and the last day of it.
  assert.equal(departureDate('2026-10-12', 5), '2026-10-16')
  assert.equal(departureDate('2026-10-12', 4), '2026-10-15')
  assert.equal(departureDate('2026-10-13', 4), '2026-10-16')
  assert.equal(departureDate('not-a-day', 5), null)
})

test('dates are formatted by lookup, never by parsing, so no timezone can shift them', () => {
  assert.equal(festDate('2026-10-12'), '12 October')
  assert.equal(festDate('2026-10-16'), '16 October')
  // Anything unrecognised is passed through rather than turned into a guess.
  assert.equal(festDate('2026-12-25'), '2026-12-25')
  assert.equal(festDate(null), '')
})

test('room labels read the way the desk says them out loud', () => {
  assert.equal(roomLabel({ sharing: 2, ac: true }), '2 seater · AC')
  assert.equal(roomLabel({ sharing: 5, ac: false }), '5 seater · Non-AC')
})

test('the security deposit is a round number of rupees, and never in paise', () => {
  // It is quoted to students as cash in hand, so it must not drift into the
  // paise convention the rest of the money here follows.
  assert.equal(SECURITY_DEPOSIT_RUPEES, 500)
})

test('every room type id is unique and url-safe', () => {
  const ids = ROOM_TYPES.map((r) => r.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const id of ids) assert.match(id, /^[a-z0-9-]+$/)
})
