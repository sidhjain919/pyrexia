/**
 * Mint a batch of Star Night stickers and lay them out for printing.
 *
 *   node scripts/print-stickers.mjs --batch A --count 3010 --start 1
 *
 * Three files come out in stickers-out/ (gitignored):
 *
 *   <batch>.pdf   A4 sheets, 35 stickers each, black on white, with cut marks
 *                 in the margins. Print at 100% / "actual size", never "fit to
 *                 page", or the cut marks stop lining up.
 *   <batch>.sql   the same codes as `stock` rows. Apply it BEFORE handing the
 *                 PDF to the printer: a sticker whose code is not in the
 *                 database scans as unknown at every gate, forever.
 *                   npx wrangler d1 execute pyrexia --remote --file stickers-out/A.sql
 *   <batch>.csv   serial,code, for whoever counts the stock.
 *
 * `--start` is the first serial. Serials are unique across all batches, so a
 * second batch starts where the last one ended: ask the database for
 * `SELECT max(serial) FROM stickers`.
 *
 * The PDF is written by hand rather than through a library: a QR code is only
 * filled squares, and the only text is in a built-in PDF font, so the whole
 * thing is a few rectangles and two Tj operators per sticker.
 */

import { randomInt } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'
import QRCode from 'qrcode'

/* ------------------------------------------------------------------ *
 * Arguments
 * ------------------------------------------------------------------ */

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? fallback : process.argv[i + 1]
}

const batch = arg('batch')
const count = Number(arg('count'))
const start = Number(arg('start', '1'))
const outDir = arg('out', 'stickers-out')

if (!batch || !/^[A-Za-z0-9_-]{1,20}$/.test(batch) || !Number.isInteger(count) || count < 1 || !Number.isInteger(start) || start < 1) {
  console.error('usage: node scripts/print-stickers.mjs --batch A --count 3010 [--start 1] [--out stickers-out]')
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })
const base = join(outDir, batch)
if (existsSync(`${base}.pdf`) || existsSync(`${base}.sql`)) {
  // Re-running would mint different codes under the same name, and whichever
  // set did not reach the database would print as stickers that never work.
  console.error(`${base}.pdf or .sql already exists. Pick a new --batch, or delete them if they were never used.`)
  process.exit(1)
}

/* ------------------------------------------------------------------ *
 * Codes
 * ------------------------------------------------------------------ */

/**
 * Crockford base32: no I, L, O or U, so nothing on the printed line can be
 * misread as something else. Upper case and digits only, which keeps the QR in
 * alphanumeric mode and therefore at the smallest size, 21 x 21.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const CODE_LENGTH = 10
/** What the QR says, so the scanner tells a sticker from an online pass (`PYX26.`). */
const PREFIX = 'PX-'

const codes = new Set()
while (codes.size < count) {
  let c = ''
  for (let i = 0; i < CODE_LENGTH; i++) c += ALPHABET[randomInt(32)]
  codes.add(c)
}
const stickers = [...codes].map((code, i) => ({ serial: start + i, code }))

/* ------------------------------------------------------------------ *
 * Layout, in millimetres from the top-left of the sheet
 * ------------------------------------------------------------------ */

const PAGE_W = 210
const PAGE_H = 297
const COLS = 5
const ROWS = 7
const CELL_W = 35
const CELL_H = 40
/** No gutters: one guillotine cut separates two neighbours. */
const LEFT = (PAGE_W - COLS * CELL_W) / 2
const TOP = (PAGE_H - ROWS * CELL_H) / 2
/**
 * 1 mm per module. A version-1 code is 21 modules, plus the 4-module white
 * border the standard asks for on every side, so 29 mm of the 35 mm cell. The
 * border is part of the sticker, which matters: the pass underneath may be
 * dark or patterned, and a QR with no white around it does not scan.
 */
const MODULE = 1
const QUIET = 4
const QR_TOP = 2

const PER_PAGE = COLS * ROWS
const pages = Math.ceil(stickers.length / PER_PAGE)

const pt = (mm) => (mm * 72) / 25.4
const n = (v) => Number(v.toFixed(3)).toString()
/** PDF space runs bottom-up. */
const X = (mm) => n(pt(mm))
const Y = (mm) => n(pt(PAGE_H - mm))

/** Courier is monospaced, 0.6 em per glyph, so centring needs no metrics table. */
function centredText(font, sizePt, text, cxMm, baselineMm) {
  const widthPt = text.length * 0.6 * sizePt
  return `BT /${font} ${sizePt} Tf ${n(pt(cxMm) - widthPt / 2)} ${Y(baselineMm)} Td (${text}) Tj ET\n`
}

function leftText(font, sizePt, text, xMm, baselineMm) {
  return `BT /${font} ${sizePt} Tf ${X(xMm)} ${Y(baselineMm)} Td (${text}) Tj ET\n`
}

function qrOps(qr, xMm, yMm) {
  const size = qr.modules.size
  let ops = ''
  for (let r = 0; r < size; r++) {
    // One rectangle per run of dark modules rather than per module: a fifth of
    // the operators, and no hairline seams between neighbours in a viewer.
    let c = 0
    while (c < size) {
      if (!qr.modules.get(r, c)) { c++; continue }
      const from = c
      while (c < size && qr.modules.get(r, c)) c++
      const x = xMm + from * MODULE
      const yBottom = yMm + (r + 1) * MODULE
      // A hair taller than a module so the rows overlap instead of touching.
      ops += `${X(x)} ${Y(yBottom)} ${n(pt((c - from) * MODULE))} ${n(pt(MODULE) + 0.02)} re\n`
    }
  }
  return ops + 'f\n'
}

function cutMarks() {
  // Short lines in the margins only, on every grid line. Nothing is drawn
  // inside the grid, so a cut that lands a millimetre off leaves no stray ink.
  let ops = '0.25 w\n'
  const gap = 1.5
  for (let c = 0; c <= COLS; c++) {
    const x = LEFT + c * CELL_W
    ops += `${X(x)} ${Y(1.5)} m ${X(x)} ${Y(TOP - gap)} l S\n`
    ops += `${X(x)} ${Y(TOP + ROWS * CELL_H + gap)} m ${X(x)} ${Y(PAGE_H - 1.5)} l S\n`
  }
  for (let r = 0; r <= ROWS; r++) {
    const y = TOP + r * CELL_H
    ops += `${X(1.5)} ${Y(y)} m ${X(LEFT - gap)} ${Y(y)} l S\n`
    ops += `${X(LEFT + COLS * CELL_W + gap)} ${Y(y)} m ${X(PAGE_W - 1.5)} ${Y(y)} l S\n`
  }
  return ops
}

/** Groups of five read back over a phone call far better than ten in a row. */
const spaced = (code) => `${code.slice(0, 5)} ${code.slice(5)}`

function pageContent(pageIndex) {
  const onPage = stickers.slice(pageIndex * PER_PAGE, (pageIndex + 1) * PER_PAGE)
  let ops = '0 g 0 G\n' + cutMarks()

  for (const [i, s] of onPage.entries()) {
    const col = i % COLS
    const row = Math.floor(i / COLS)
    const cellX = LEFT + col * CELL_W
    const cellY = TOP + row * CELL_H

    const qr = QRCode.create(PREFIX + s.code, { errorCorrectionLevel: 'Q' })
    const span = (qr.modules.size + 2 * QUIET) * MODULE
    const qrX = cellX + (CELL_W - span) / 2 + QUIET * MODULE
    const qrY = cellY + QR_TOP + QUIET * MODULE
    ops += qrOps(qr, qrX, qrY)

    const cx = cellX + CELL_W / 2
    const textTop = cellY + QR_TOP + span
    ops += centredText('F1', 10, spaced(s.code), cx, textTop + 3.2)
    ops += centredText('F2', 6.5, `No. ${String(s.serial).padStart(5, '0')}`, cx, textTop + 6.2)
  }

  // Stock control, in the bottom margin under the first column.
  const first = onPage[0].serial
  const last = onPage[onPage.length - 1].serial
  ops += leftText('F2', 5.5, `${batch}  sheet ${pageIndex + 1}/${pages}  No. ${first}-${last}`, LEFT + 1, PAGE_H - 3)
  return ops
}

/* ------------------------------------------------------------------ *
 * PDF
 * ------------------------------------------------------------------ */

function buildPdf() {
  const chunks = []
  const offsets = []
  let length = 0
  const push = (b) => {
    const buf = typeof b === 'string' ? Buffer.from(b, 'latin1') : b
    chunks.push(buf)
    length += buf.length
  }
  const object = (id, body) => {
    offsets[id] = length
    push(`${id} 0 obj\n`)
    for (const part of [].concat(body)) push(part)
    push('\nendobj\n')
  }

  // 1 catalog, 2 page tree, 3-4 fonts, then a page and its content per sheet.
  const pageIds = Array.from({ length: pages }, (_, i) => 5 + i * 2)

  push('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n')
  object(1, '<< /Type /Catalog /Pages 2 0 R >>')
  object(2, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages} >>`)
  object(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>')
  object(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>')

  for (let p = 0; p < pages; p++) {
    const pageId = pageIds[p]
    const data = deflateSync(Buffer.from(pageContent(p), 'latin1'))
    object(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(pt(PAGE_W))} ${n(pt(PAGE_H))}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageId + 1} 0 R >>`,
    )
    object(pageId + 1, [`<< /Length ${data.length} /Filter /FlateDecode >>\nstream\n`, data, '\nendstream'])
  }

  const total = 5 + pages * 2
  const xref = length
  push(`xref\n0 ${total}\n0000000000 65535 f \n`)
  for (let id = 1; id < total; id++) push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`)
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  return Buffer.concat(chunks)
}

/* ------------------------------------------------------------------ *
 * Out
 * ------------------------------------------------------------------ */

const sql = ['-- Star Night stickers, batch ' + batch + ', generated ' + new Date().toISOString()]
for (let i = 0; i < stickers.length; i += 100) {
  const rows = stickers.slice(i, i + 100).map((s) => `('${s.code}', ${s.serial}, '${batch}')`)
  sql.push(`INSERT INTO stickers (code, serial, batch) VALUES\n${rows.join(',\n')};`)
}

writeFileSync(`${base}.pdf`, buildPdf())
writeFileSync(`${base}.sql`, sql.join('\n\n') + '\n')
writeFileSync(`${base}.csv`, 'serial,code\n' + stickers.map((s) => `${s.serial},${s.code}`).join('\n') + '\n')

const last = stickers[stickers.length - 1].serial
console.log(`Batch ${batch}: ${count} stickers, No. ${start}-${last}, ${pages} A4 sheets.`)
console.log(`  ${base}.pdf  ${base}.sql  ${base}.csv`)
console.log(`Apply ${base}.sql to the database before the PDF goes to the printer.`)
console.log(`The next batch starts at --start ${last + 1}.`)
