import { test } from 'node:test'
import assert from 'node:assert/strict'

import { festNight, readScan, scanMoment, serialLabel } from './stickers.ts'

test('a printed sticker reads as its code', () => {
  assert.deepEqual(readScan('PX-K7M2Q9XA3F'), { kind: 'sticker', code: 'K7M2Q9XA3F' })
})

test('a typed code is forgiven its case, spaces, dashes and look-alike letters', () => {
  assert.deepEqual(readScan(' k7m2q 9xa3f '), { kind: 'sticker', code: 'K7M2Q9XA3F' })
  assert.deepEqual(readScan('px-K7M2Q-9XA3F'), { kind: 'sticker', code: 'K7M2Q9XA3F' })
  assert.deepEqual(readScan('O1LI0 ABCDE'), { kind: 'sticker', code: '01110ABCDE' })
})

test('the online pass is told apart, never mistaken for a sticker', () => {
  assert.equal(readScan('PYX26.abc.def').kind, 'online_pass')
})

test('anything else is unknown', () => {
  for (const s of ['', 'hello', 'PX-SHORT', 'PX-K7M2Q9XA3FF', 'https://example.com', 'PX-K7M2Q9XA3U']) {
    assert.equal(readScan(s).kind, 'unknown', s)
  }
})

test('the night turns over at 06:00 IST, not at midnight', () => {
  // 12 Oct, 21:00 IST
  assert.equal(festNight(new Date('2026-10-12T15:30:00Z')), '2026-10-12')
  // 13 Oct, 00:30 IST: still the concert of the 12th
  assert.equal(festNight(new Date('2026-10-12T19:00:00Z')), '2026-10-12')
  // 13 Oct, 05:59 IST
  assert.equal(festNight(new Date('2026-10-13T00:29:00Z')), '2026-10-12')
  // 13 Oct, 06:00 IST: a new night
  assert.equal(festNight(new Date('2026-10-13T00:30:00Z')), '2026-10-13')
})

test("a queued scan keeps the phone's time, within reason", () => {
  const now = new Date('2026-10-13T01:00:00Z') // 06:30 IST, the morning after
  const lateLastNight = '2026-10-12T19:00:00Z'
  assert.equal(festNight(scanMoment(lateLastNight, undefined, now)), '2026-10-12')
  assert.equal(scanMoment('2026-10-14T00:00:00Z', undefined, now), now) // the future
  assert.equal(scanMoment('2026-10-10T00:00:00Z', undefined, now), now) // days ago
  assert.equal(scanMoment('nonsense', undefined, now), now)
  assert.equal(scanMoment(undefined, undefined, now), now)
})

test('a queue that syncs the next evening is still booked to its own night', () => {
  const now = new Date('2026-10-13T13:30:00Z') // 19:00 IST the next day
  const at = scanMoment('2026-10-12T15:00:00Z', '2026-10-13T13:30:00Z', now) // 20:30 IST the night before
  assert.equal(festNight(at), '2026-10-12')
})

test("a phone whose clock is wrong is corrected by what it thinks 'now' is", () => {
  const now = new Date('2026-10-12T16:00:00Z') // 21:30 IST
  // The phone is a day and two hours slow: it scanned at what it calls
  // 11 Oct 13:50Z and sends the queue at what it calls 11 Oct 14:00Z.
  const at = scanMoment('2026-10-11T13:50:00Z', '2026-10-11T14:00:00Z', now)
  assert.equal(at.toISOString(), '2026-10-12T15:50:00.000Z')
  assert.equal(festNight(at), '2026-10-12')
})

test('serials print as on the sticker', () => {
  assert.equal(serialLabel(412), 'No. 00412')
})
