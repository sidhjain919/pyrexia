/**
 * Star Night stickers: reading a scan, and which night it belongs to.
 *
 * Pure on purpose. The scanner page, the gate route and the tests all need to
 * agree on what counts as a sticker and when a night ends, and a rule that
 * lives in three places drifts.
 */

/** Printed by scripts/print-stickers.mjs. The QR says `PX-` + 10 characters. */
export const STICKER_PREFIX = 'PX-'
const CODE = /^[0-9A-HJKMNP-TV-Z]{10}$/

/** What a scanner read, sorted into the only three things it can be. */
export type Scanned =
  | { kind: 'sticker'; code: string }
  /** The online pass from somebody's phone. Identifies a person; never admits one. */
  | { kind: 'online_pass'; token: string }
  | { kind: 'unknown' }

/**
 * Read a QR payload or a code somebody typed off a damaged sticker.
 *
 * Typing is forgiving the way Crockford base32 is meant to be: case, spaces
 * and dashes are ignored, and O, I and L are read as the digits they look
 * like, because those letters were never printed.
 */
export function readScan(raw: string): Scanned {
  const text = raw.trim()
  if (text.startsWith('PYX26.')) return { kind: 'online_pass', token: text }

  let body = text.toUpperCase()
  if (body.startsWith(STICKER_PREFIX)) body = body.slice(STICKER_PREFIX.length)
  body = body.replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1')

  return CODE.test(body) ? { kind: 'sticker', code: body } : { kind: 'unknown' }
}

/**
 * The fest night a moment belongs to, as an IST date.
 *
 * The night turns over at 06:00 IST rather than at midnight, so somebody
 * scanned at 00:30 is counted toward the concert they are actually at. 06:00
 * IST is 00:30 UTC, so the night is simply the UTC date half an hour ago.
 *
 * This is the whole of the nightly "reset": an entry is keyed by night, and a
 * new night is a new key. Nothing is cleared, so nothing can fail to clear.
 */
export function festNight(at: Date = new Date()): string {
  return new Date(at.getTime() - 30 * 60_000).toISOString().slice(0, 10)
}

/**
 * When an offline scan really happened.
 *
 * A phone that lost signal queues its scans and sends them later, possibly
 * after 06:00. The night must come from when the guard scanned, not from when
 * the request landed, or a late-night queue is booked to the next concert.
 * The phone's clock is believed only within reason: not in the future, and
 * not from before the night could have started.
 */
export function scanMoment(clientIso: unknown, now: Date = new Date()): Date {
  if (typeof clientIso !== 'string') return now
  const at = new Date(clientIso)
  const t = at.getTime()
  if (!Number.isFinite(t)) return now
  if (t > now.getTime() + 5 * 60_000) return now
  if (t < now.getTime() - 18 * 3_600_000) return now
  return at
}

/** e.g. `No. 00412`, as printed under the code. */
export function serialLabel(serial: number): string {
  return `No. ${String(serial).padStart(5, '0')}`
}
