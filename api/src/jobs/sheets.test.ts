/**
 * The event sheets: what lands in a row, and how the server reads the Apps
 * Script's answers. Nothing here talks to Google.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  ACCOMMODATION_SHEET,
  SEPARATE_SHEET_VERTICALS,
  buildAccommodationGrid,
  buildGrid,
  sheetEvents,
  toIst,
} from './sheets.ts'
import { SheetsScriptError, sheetUrl, writeSheet } from '../lib/sheets.ts'
import { buildXlsx } from '../lib/xlsx.ts'

const entry = (over: Record<string, unknown> = {}) => ({
  event_name: 'Badminton',
  public_code: 'PYX26-AAAAAA',
  name: 'Meera Rao',
  phone: '09876543210',
  email: 'meera@example.com',
  college: 'AIIMS Rishikesh',
  course: 'MBBS',
  year: '2',
  participation: 'solo',
  team_name: null,
  members: '[]',
  head_count: 1,
  answers: '{}',
  fee_paise: 27500,
  fee_variant: 'womens-singles',
  created_at: '2026-09-13 15:34:10',
  ...over,
})

test('entry times are shown in IST', () => {
  assert.equal(toIst('2026-09-13 15:34:10'), '2026-09-13 21:04')
  assert.equal(toIst('2026-09-13 20:00:00'), '2026-09-14 01:30')
  assert.equal(toIst('not a date'), 'not a date')
})

test('a banded team event gets category and squad columns', () => {
  const grid = buildGrid('Badminton', [
    entry(),
    entry({
      name: 'Arjun', participation: 'team', team_name: 'Smashers', head_count: 2,
      members: JSON.stringify([{ name: 'Kabir', phone: '9000000000' }]),
      fee_variant: 'mixed-doubles', fee_paise: 55000,
    }),
  ])
  const [headers, first, second] = grid
  const col = (row: unknown[], h: string) => row[headers.indexOf(h)]

  assert.equal(grid.length, 3)
  assert.equal(col(first, '#'), 1)
  assert.equal(col(first, 'Category'), "Women's singles")
  assert.equal(col(first, 'Solo/Team'), 'Solo')
  // Sent as text, so the script keeps the leading zero.
  assert.equal(col(first, 'Mobile'), '09876543210')
  assert.equal(col(first, 'Fee (INR)'), 275)
  assert.equal(col(second, 'Team-mates'), 'Kabir (9000000000)')
  assert.equal(col(second, 'Category'), 'Mixed doubles')
  assert.equal(col(second, 'Entered on (IST)'), '2026-09-13 21:04')
  for (const row of grid) assert.equal(row.length, headers.length)
})

test("an event's own questions become columns", () => {
  const withFields = sheetEvents.find((e) => e.name === 'Tarang')
  assert.ok(withFields, 'Tarang should get a sheet')
  const grid = buildGrid('Tarang', [entry({ event_name: 'Tarang', answers: '{"performanceTitle":"Raag Yaman"}' })])
  assert.ok(grid[0].length > 9)
  assert.ok(grid[1].includes('Raag Yaman'))
})

test('an event with no entries still has its header row', () => {
  assert.equal(buildGrid('Nukkad Natak', []).length, 1)
})

test('events on external forms get no sheet', () => {
  const names = sheetEvents.map((e) => e.name)
  assert.equal(names.length, 60)
  assert.ok(!names.includes('BGMI'))
  assert.ok(!names.includes('Battle of Bands'))
  assert.equal(new Set(names).size, names.length)
})

test('only Velocity events get a spreadsheet each; the rest are tabs of their vertical', () => {
  const own = sheetEvents.filter((e) => SEPARATE_SHEET_VERTICALS.has(e.territory.id))
  assert.equal(own.length, 11)
  assert.ok(own.every((e) => e.territory.code === 'Velocity'))
  const verticals = new Set(sheetEvents.filter((e) => !SEPARATE_SHEET_VERTICALS.has(e.territory.id)).map((e) => e.territory.code))
  assert.deepEqual([...verticals].sort(), ['Alfresco', 'Chorea', 'Chronos', 'Kalakriti', 'Littmania', 'Sinfonia', 'Thespians'])
})

test('a sheet link opens the spreadsheet, or one tab of it', () => {
  assert.equal(sheetUrl('abc', 123456), 'https://docs.google.com/spreadsheets/d/abc/edit#gid=123456')
  assert.equal(sheetUrl('abc', 0), 'https://docs.google.com/spreadsheets/d/abc/edit#gid=0')
  assert.equal(sheetUrl('abc'), 'https://docs.google.com/spreadsheets/d/abc/edit')
})

test('a link cell becomes a HYPERLINK formula with quotes escaped', () => {
  const bytes = buildXlsx([{ name: 'T', rows: [[{ link: 'https://docs.google.com/x?a="b"&c', text: 'Open' }]] }])
  const xml = new TextDecoder().decode(bytes)
  assert.ok(xml.includes('<f>HYPERLINK(&quot;https://docs.google.com/x?a=&quot;&quot;b&quot;&quot;&amp;c&quot;,&quot;Open&quot;)</f>'))
})

test('the script client tells a stale write, a refusal and an outage apart', async () => {
  const cfg = { url: 'https://script.example/exec', secret: 's' }
  const real = globalThis.fetch
  const answer = (status: number, body: string) => {
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      assert.equal(JSON.parse(String(init?.body)).secret, 's')
      return new Response(body, { status })
    }) as typeof fetch
  }
  const failure = async () => {
    try {
      await writeSheet(cfg, 'id', 0, [['a']], 1)
    } catch (err) {
      assert.ok(err instanceof SheetsScriptError)
      return err
    }
    assert.fail('expected a failure')
  }
  try {
    answer(200, '{"ok":true}')
    assert.equal(await writeSheet(cfg, 'id', 0, [['a']], 1), true)
    answer(200, '{"ok":true,"skipped":true}')
    assert.equal(await writeSheet(cfg, 'id', 0, [['a']], 1), false)
    answer(200, '{"ok":false,"error":"busy","retry":true}')
    assert.equal((await failure()).retryable, true)
    answer(200, '{"ok":false,"error":"forbidden"}')
    assert.equal((await failure()).retryable, false)
    // A Google sign-in page: the deployment isn't open to "Anyone".
    answer(200, '<!doctype html><title>Sign in</title>')
    assert.equal((await failure()).retryable, false)
    answer(503, 'unavailable')
    assert.equal((await failure()).retryable, true)
  } finally {
    globalThis.fetch = real
  }
})


/* ------------------------------------------------------------------ *
 * The rooming list
 * ------------------------------------------------------------------ */

const booking = (over: Record<string, unknown> = {}) => ({
  public_code: 'STAY-AAAAAA',
  gender: 'girls',
  sharing: 3,
  ac: 1,
  days: 4,
  arrival_date: '2026-10-13',
  arrival_time: 'late evening',
  name: 'Asha Rao',
  email: 'asha@example.com',
  phone: '9876543210',
  college: 'AIIMS Rishikesh',
  course: 'MBBS 2023',
  fee_paise: 280000,
  created_at: '2026-09-20 06:15:00',
  delegate_code: 'PYX26-DEV5FB',
  ...over,
})

test('the rooming list is ordered the way a room is allocated', () => {
  // Deliberately shuffled, and deliberately not in booking order: the desk
  // reads this while deciding who goes where, so gender, then size, then AC.
  const grid = buildAccommodationGrid([
    booking({ public_code: 'A', gender: 'girls', sharing: 4, ac: 0 }),
    booking({ public_code: 'B', gender: 'boys', sharing: 2, ac: 1 }),
    booking({ public_code: 'C', gender: 'girls', sharing: 3, ac: 0 }),
    booking({ public_code: 'D', gender: 'girls', sharing: 3, ac: 1 }),
  ] as never)

  assert.deepEqual(
    grid.slice(1).map((r) => r[1]),
    ['B', 'D', 'C', 'A'],
    'boys first, then girls by room size, AC before non-AC',
  )
})

test('a booking row carries what the desk needs to check somebody in', () => {
  const [headers, row] = buildAccommodationGrid([booking()] as never)

  const col = (name: string) => row[headers.indexOf(name)]
  assert.equal(col('Reference'), 'STAY-AAAAAA')
  assert.equal(col('Registration No'), 'PYX26-DEV5FB')
  assert.equal(col('Room'), '3 seater')
  assert.equal(col('AC'), 'AC')
  assert.equal(col('Nights'), 4)
  assert.equal(col('Arriving'), '2026-10-13')
  assert.equal(col('Mobile'), '9876543210')
  // Rupees as a number, so the column sums in the spreadsheet.
  assert.equal(col('Paid for room (INR)'), 2800)
  // IST, like every other time the committee reads.
  assert.equal(col('Booked on (IST)'), '2026-09-20 11:45')
})

test('non-AC and an empty arrival time do not print as blanks or booleans', () => {
  const [headers, row] = buildAccommodationGrid([
    booking({ ac: 0, arrival_time: null }),
  ] as never)
  assert.equal(row[headers.indexOf('AC')], 'Non-AC')
  assert.equal(row[headers.indexOf('Arrival time')], '')
})

test('an empty rooming list still has its header row', () => {
  const grid = buildAccommodationGrid([])
  assert.equal(grid.length, 1)
  assert.ok(grid[0].includes('Reference'))
})

test('the reserved name cannot collide with a real event', () => {
  assert.ok(ACCOMMODATION_SHEET.startsWith('__'))
  assert.ok(!sheetEvents.some((e) => e.name === ACCOMMODATION_SHEET))
})
