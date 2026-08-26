/**
 * Passwords.
 *
 * Cloudflare Workers have no bcrypt or argon2, so this uses PBKDF2-HMAC-SHA256
 * from the built-in crypto — the standard choice on the platform.
 *
 * The stored format carries its own parameters:
 *
 *   pbkdf2$sha256$100000x6$<salt b64url>$<hash b64url>
 *                 ^^^^^^ iterations per round, and how many rounds
 *
 * That means the work factor can be raised later without invalidating a single
 * existing password: old hashes keep verifying against the settings they were
 * made with, and get re-hashed at the next successful sign-in.
 */

const ALGO = 'pbkdf2'
const DIGEST = 'sha256'

/**
 * Cloudflare Workers refuse more than 100,000 PBKDF2 iterations — anything
 * higher throws NotSupportedError. That is well under OWASP's 600,000 for
 * PBKDF2-SHA256, so rather than settle for a weaker hash we chain rounds: six
 * passes of 100,000, each feeding the previous output back in as the password.
 *
 * An attacker still has to do all 600,000 iterations per guess, so the work
 * factor is what OWASP asks for. The cost to us is roughly 350ms per sign-in,
 * which the rate limit on the login endpoint keeps from being a lever.
 */
const ITERATIONS = 100_000
const ROUNDS = 6
const SALT_BYTES = 16
const KEY_BITS = 256

const encoder = new TextEncoder()

function b64url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

async function derive(
  password: string,
  salt: Uint8Array,
  iterations: number,
  rounds: number,
): Promise<Uint8Array> {
  let material: Uint8Array = encoder.encode(password)

  for (let round = 0; round < rounds; round++) {
    const key = await crypto.subtle.importKey(
      'raw',
      material as unknown as ArrayBuffer,
      'PBKDF2',
      false,
      ['deriveBits'],
    )
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: salt as unknown as ArrayBuffer, iterations, hash: 'SHA-256' },
      key,
      KEY_BITS,
    )
    material = new Uint8Array(bits)
  }

  return material
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const hash = await derive(password, salt, ITERATIONS, ROUNDS)
  return `${ALGO}$${DIGEST}$${ITERATIONS}x${ROUNDS}$${b64url(salt)}$${b64url(hash)}`
}

/**
 * Constant-time verification.
 *
 * Returns false for anything malformed rather than throwing, so a corrupted
 * row can never turn a failed sign-in into a 500 that leaks its existence.
 */
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false

  const parts = stored.split('$')
  if (parts.length !== 5 || parts[0] !== ALGO || parts[1] !== DIGEST) return false

  // "100000x6" — iterations per round, and how many rounds. A bare number is
  // the older single-round form, still read so nothing already stored breaks.
  const [iterText, roundText] = parts[2].split('x')
  const iterations = Number(iterText)
  const rounds = roundText === undefined ? 1 : Number(roundText)

  if (!Number.isInteger(iterations) || iterations < 1000 || iterations > 1_000_000) return false
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 20) return false

  let salt: Uint8Array
  let expected: Uint8Array
  try {
    salt = fromB64url(parts[3])
    expected = fromB64url(parts[4])
  } catch {
    return false
  }
  if (salt.length === 0 || expected.length !== KEY_BITS / 8) return false

  const actual = await derive(password, salt, iterations, rounds)

  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ actual[i]
  return diff === 0
}

/** True when a stored hash was made with weaker settings and should be upgraded. */
export function needsRehash(stored: string | null): boolean {
  if (!stored) return false
  const parts = stored.split('$')
  if (parts.length !== 5) return true

  const [iterText, roundText] = parts[2].split('x')
  const total = Number(iterText) * (roundText === undefined ? 1 : Number(roundText))
  return !Number.isFinite(total) || total < ITERATIONS * ROUNDS
}

/* ------------------------------------------------------------------ *
 * Rules
 * ------------------------------------------------------------------ */

/**
 * Deliberately not a maze of character classes.
 *
 * Forced symbols and digits push people toward `Password1!` and a sticky note.
 * Length is what actually helps, so the floor is eight characters and the only
 * other rule blocks the handful of passwords that appear in every leaked list.
 */
const OBVIOUS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890',
  'qwerty123', 'iloveyou', 'admin123', 'welcome1', 'abc12345', 'pyrexia',
  'pyrexia2026', 'letmein1', '11111111', '00000000',
])

export function checkPassword(password: string): string | null {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Use at least 8 characters.'
  }
  if (password.length > 200) {
    return 'That password is too long.'
  }
  if (OBVIOUS.has(password.toLowerCase())) {
    return 'That password is too easy to guess. Try something else.'
  }
  if (/^(.)\1+$/.test(password)) {
    return 'That password is too easy to guess. Try something else.'
  }
  return null
}
