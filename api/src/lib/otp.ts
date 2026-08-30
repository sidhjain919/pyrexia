/**
 * Six-digit email verification codes.
 *
 * A code is a password that lives for ten minutes, so it gets the same
 * treatment as one: generated from a cryptographic source, stored only as a
 * hash, compared without leaking timing, and given a hard limit on guesses.
 *
 * The guess limit is the part that matters most. Six digits is a million
 * possibilities, which sounds like plenty until you notice that an unbounded
 * attacker gets a million tries: and with a ten-minute window and a fast
 * endpoint, a million tries is not long. Five attempts turns that into a
 * one-in-two-hundred-thousand chance.
 */

const CODE_LENGTH = 6
export const OTP_TTL_MINUTES = 10
export const MAX_OTP_ATTEMPTS = 5

/**
 * A six-digit code, uniformly distributed.
 *
 * `% 1_000_000` on a 32-bit random number would very slightly favour lower
 * codes, because 2^32 is not a multiple of a million. Rejecting the tail of
 * the range removes that bias. It matters less here than the guess limit does,
 * but it costs one loop.
 */
export function generateCode(): string {
  const limit = Math.floor(0xffffffff / 1_000_000) * 1_000_000
  const buffer = new Uint32Array(1)
  let value: number
  do {
    crypto.getRandomValues(buffer)
    value = buffer[0]
  } while (value >= limit)
  return String(value % 1_000_000).padStart(CODE_LENGTH, '0')
}

/**
 * Hash a code, salted with the account it belongs to.
 *
 * Plain SHA-256 is right here where it would be wrong for a password: the
 * input space is a million values and lives for ten minutes, so a slow hash
 * buys nothing an attacker can't outrun by simply enumerating. Binding the
 * registration id in means a stolen hash cannot be replayed against a
 * different account.
 */
export async function hashCode(registrationId: string, code: string): Promise<string> {
  const data = new TextEncoder().encode(`${registrationId}:${code}`)
  const digest = await crypto.subtle.digest('SHA-256', data as unknown as ArrayBuffer)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Compare in constant time, so a wrong code reveals nothing by how fast it fails. */
export function codesMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Normalise what someone typed: spaces, dashes and stray characters removed. */
export function cleanCode(input: string): string {
  return input.replace(/\D/g, '').slice(0, CODE_LENGTH)
}
