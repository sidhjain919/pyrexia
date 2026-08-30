/**
 * Identifiers.
 *
 * Two kinds, and keeping them apart matters:
 *
 *  - Internal ids are uuid v4. Nothing is ever looked up by a number a person
 *    could guess or increment.
 *  - The public code (`PYX26-4KD9TQ`) exists to be read aloud on a phone and
 *    printed on a pass. It is deliberately *not* a credential: knowing someone's
 *    code must never let you act as them.
 */

/**
 * Crockford-ish base32 with the vowels removed.
 *
 * No vowels means a code can never spell a word, which matters when six random
 * characters go out to ten thousand students. Dropping A, E, I, O and U also
 * removes the 0/O and 1/I confusions when someone reads a code down a bad line.
 */
const ALPHABET = '0123456789BCDFGHJKLMNPQRSTVWXYZ'

export function randomCode(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  let out = ''
  // Rejection-free modulo is fine here: 256 % 31 leaves a bias under 1%, which
  // costs nothing when the value carries no authority.
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length]
  return out
}

/** e.g. `PYX26-4KD9TQ`. Uniqueness is enforced by the database, not by hope. */
export function newPublicCode(): string {
  return `PYX26-${randomCode(6)}`
}

export function newId(): string {
  return crypto.randomUUID()
}

/** Order ids carry their own prefix so a Razorpay receipt is readable at a glance. */
export function newOrderId(): string {
  return `ord_${randomCode(12)}`
}

export function newEntryId(): string {
  return `ent_${randomCode(10)}`
}

/**
 * SHA-256, hex. Used wherever a token must be storable without being replayable
 *, session cookies, magic links, guard device tokens.
 */
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** 256 bits of URL-safe randomness, for session and magic-link tokens. */
export function newSecretToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
