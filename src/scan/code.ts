/**
 * The scanner's copy of the server's rules for reading a sticker and naming a
 * night (api/src/lib/stickers.ts). The gate needs them offline, which is the
 * only reason they exist twice; change one and change the other.
 */

const CODE = /^[0-9A-HJKMNP-TV-Z]{10}$/

export function isOnlinePass(raw: string): boolean {
  return raw.trim().startsWith('PYX26.')
}

/** The 10-character code on a sticker, from a QR or from somebody's typing. */
export function stickerCode(raw: string): string | null {
  let body = raw.trim().toUpperCase()
  if (body.startsWith('PX-')) body = body.slice(3)
  body = body.replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1')
  return CODE.test(body) ? body : null
}

/** The IST date of the concert a moment belongs to; nights turn over at 06:00 IST. */
export function festNight(at: Date = new Date()): string {
  return new Date(at.getTime() - 30 * 60_000).toISOString().slice(0, 10)
}

/** e.g. 8:14 PM, in the fest's time zone whatever the phone thinks. */
export function istTime(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })
}

export function nightLabel(night: string): string {
  const d = new Date(`${night}T12:00:00Z`)
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}
