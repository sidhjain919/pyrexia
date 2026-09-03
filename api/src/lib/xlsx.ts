/**
 * A tiny, dependency-free .xlsx writer.
 *
 * An .xlsx file is a ZIP archive of a handful of XML parts. Cloudflare Workers
 * have no zip library and no filesystem, so this builds both by hand: the XML
 * for one worksheet, and a stored-mode (uncompressed) ZIP around it with correct
 * CRC-32s and a central directory. Stored mode keeps the code small and needs no
 * deflate; the sheets here are a few thousand short rows, so size is a non-issue.
 *
 * Why a real .xlsx rather than CSV: amounts land in true numeric cells (so they
 * sum and sort in Excel), and because text lives in typed string cells, a value
 * beginning `=` or `+` is never interpreted as a formula — the CSV-injection
 * hazard simply does not exist here.
 *
 * Only what a printout sheet needs: one sheet, a title row, a header row, then
 * data. Numbers vs. text per cell. No styles, no shared strings — both are
 * optional in the spec and omitting them is what keeps this auditable.
 */

export type Cell = string | number | null | undefined

const enc = new TextEncoder()

/* ------------------------------------------------------------------ *
 * CRC-32 (the one checksum a ZIP entry cannot omit)
 * ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/* ------------------------------------------------------------------ *
 * XML
 * ------------------------------------------------------------------ */

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // Excel rejects most control characters outright; strip the ones that can
    // arrive in a pasted name or address rather than corrupting the whole file.
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
}

/** A1, B1 … Z1, AA1 … for a zero-based column index. */
function colRef(col: number): string {
  let s = ''
  let n = col
  do {
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return s
}

function cellXml(col: number, rowNum: number, value: Cell): string {
  const ref = `${colRef(col)}${rowNum}`
  if (value === null || value === undefined || value === '') return `<c r="${ref}"/>`
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}"><v>${value}</v></c>`
  }
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(String(value))}</t></is></c>`
}

function sheetXml(rows: Cell[][]): string {
  const body = rows
    .map((cells, r) => {
      const rowNum = r + 1
      const cellsXml = cells.map((v, c) => cellXml(c, rowNum, v)).join('')
      return `<row r="${rowNum}">${cellsXml}</row>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`
}

/** One tab in the workbook. */
export type Sheet = { name: string; rows: Cell[][] }

function contentTypes(count: number): string {
  const sheets = Array.from(
    { length: count },
    (_, i) =>
      `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets}</Types>`
}

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`

function workbookRels(count: number): string {
  const rels = Array.from(
    { length: count },
    (_, i) =>
      `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
  ).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`
}

function workbookXml(names: string[]): string {
  // Excel caps a sheet name at 31 chars, forbids : \ / ? * [ ], and needs
  // every tab to be unique.
  const seen = new Set<string>()
  const tabs = names
    .map((name, i) => {
      let safe = name.replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || `Sheet${i + 1}`
      while (seen.has(safe)) safe = `${safe.slice(0, 28)} ${i + 1}`
      seen.add(safe)
      return `<sheet name="${xmlEscape(safe)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`
    })
    .join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${tabs}</sheets></workbook>`
}

/* ------------------------------------------------------------------ *
 * ZIP (stored / no compression)
 * ------------------------------------------------------------------ */

type Entry = { name: string; data: Uint8Array; crc: number }

function u16(n: number): number[] {
  return [n & 0xff, (n >>> 8) & 0xff]
}
function u32(n: number): number[] {
  return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]
}

function zip(files: { name: string; content: string }[]): Uint8Array {
  const entries: Entry[] = files.map((f) => {
    const data = enc.encode(f.content)
    return { name: f.name, data, crc: crc32(data) }
  })

  const chunks: number[][] = []
  const central: number[][] = []
  let offset = 0

  for (const e of entries) {
    const nameBytes = enc.encode(e.name)
    // Local file header. Version 20, no flags, method 0 (stored), no mtime.
    const local = [
      ...u32(0x04034b50),
      ...u16(20),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(e.crc),
      ...u32(e.data.length),
      ...u32(e.data.length),
      ...u16(nameBytes.length),
      ...u16(0),
      ...nameBytes,
    ]
    chunks.push(local)
    chunks.push([...e.data])

    central.push([
      ...u32(0x02014b50),
      ...u16(20),
      ...u16(20),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(e.crc),
      ...u32(e.data.length),
      ...u32(e.data.length),
      ...u16(nameBytes.length),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(offset),
      ...nameBytes,
    ])

    offset += local.length + e.data.length
  }

  const centralStart = offset
  let centralSize = 0
  for (const c of central) centralSize += c.length

  const end = [
    ...u32(0x06054b50),
    ...u16(0),
    ...u16(0),
    ...u16(entries.length),
    ...u16(entries.length),
    ...u32(centralSize),
    ...u32(centralStart),
    ...u16(0),
  ]

  const total = offset + centralSize + end.length
  const out = new Uint8Array(total)
  let p = 0
  for (const c of chunks) {
    out.set(c, p)
    p += c.length
  }
  for (const c of central) {
    out.set(c, p)
    p += c.length
  }
  out.set(end, p)
  return out
}

/* ------------------------------------------------------------------ *
 * The one function callers use
 * ------------------------------------------------------------------ */

/**
 * Build an .xlsx as bytes, one tab per sheet.
 *
 * Each sheet's `rows` is its whole grid, top to bottom: pass the title row and
 * header row as the first entries. Numbers become numeric cells; everything
 * else is text.
 */
export function buildXlsx(sheets: Sheet[]): Uint8Array {
  const tabs = sheets.length ? sheets : [{ name: 'Sheet1', rows: [] }]
  return zip([
    { name: '[Content_Types].xml', content: contentTypes(tabs.length) },
    { name: '_rels/.rels', content: ROOT_RELS },
    { name: 'xl/workbook.xml', content: workbookXml(tabs.map((s) => s.name)) },
    { name: 'xl/_rels/workbook.xml.rels', content: workbookRels(tabs.length) },
    ...tabs.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, content: sheetXml(s.rows) })),
  ])
}

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** A ready-to-return Response with the right headers for a browser download. */
export function xlsxResponse(sheets: Sheet[], filename: string): Response {
  const body = buildXlsx(sheets)
  return new Response(body, {
    headers: {
      'Content-Type': XLSX_MIME,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
