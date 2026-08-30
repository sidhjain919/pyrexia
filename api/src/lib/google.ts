/**
 * Verifying a Google sign-in.
 *
 * The browser hands us an ID token: a JWT that Google signed. Everything we
 * are about to trust (this is Aarav, this is his address, Google checked it)
 * rests on that signature, so the token is checked in full before a single
 * field inside it is read.
 *
 * Four checks, and skipping any one of them makes the other three pointless:
 *
 *   signature  it really came from Google
 *   aud        it was issued for *our* application, not someone else's. Without
 *              this, anyone could take a valid Google token from any other site
 *              and sign in here as that person.
 *   iss        Google issued it
 *   exp        it has not expired
 *
 * We then require `email_verified` inside the token. Google can hold an
 * unverified address on an account, and an unverified address is exactly what
 * this whole feature exists to avoid.
 */

export type GoogleIdentity = {
  sub: string
  email: string
  name: string
  picture?: string
}

type Jwk = { kid: string; n: string; e: string; kty: string; alg?: string }

const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs'

/** Google rotates signing keys slowly; refetching per request would be rude. */
let cache: { keys: Jwk[]; expires: number } | null = null

function base64UrlToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

function decodeSegment(segment: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(segment)))
}

async function fetchKeys(fetchImpl: typeof fetch, force: boolean): Promise<Jwk[]> {
  const now = Date.now()
  if (!force && cache && cache.expires > now) return cache.keys

  const res = await fetchImpl(JWKS_URL)
  if (!res.ok) throw new Error(`google jwks ${res.status}`)
  const body = (await res.json()) as { keys: Jwk[] }

  cache = { keys: body.keys ?? [], expires: now + 60 * 60 * 1000 }
  return cache.keys
}

/** For tests, and for a deploy that should not inherit another test's cache. */
export function clearKeyCache(): void {
  cache = null
}

export async function verifyGoogleIdToken(
  token: string,
  clientId: string,
  fetchImpl: typeof fetch = fetch,
  now: number = Date.now(),
): Promise<GoogleIdentity | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  let header: Record<string, unknown>
  let payload: Record<string, unknown>
  try {
    header = decodeSegment(parts[0])
    payload = decodeSegment(parts[1])
  } catch {
    return null
  }

  // Only RS256. Accepting whatever the token names is the classic JWT hole -
  // "alg": "none" turns a signature check into a formality.
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') return null

  // An unknown kid usually means Google rotated keys, so refetch once before
  // giving up. A token forged with a made-up kid costs one wasted request.
  let keys = await fetchKeys(fetchImpl, false)
  let jwk = keys.find((k) => k.kid === header.kid)
  if (!jwk) {
    keys = await fetchKeys(fetchImpl, true)
    jwk = keys.find((k) => k.kid === header.kid)
  }
  if (!jwk) return null

  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  )

  const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    base64UrlToBytes(parts[2]) as unknown as ArrayBuffer,
    signed as unknown as ArrayBuffer,
  )
  if (!valid) return null

  // Issued for us, by Google, and still valid.
  if (payload.aud !== clientId) return null
  if (payload.iss !== 'accounts.google.com' && payload.iss !== 'https://accounts.google.com') {
    return null
  }
  if (typeof payload.exp !== 'number' || payload.exp * 1000 <= now) return null

  // Google will happily hold an unverified address on an account, and an
  // unverified address is the thing this feature exists to rule out.
  if (payload.email_verified !== true && payload.email_verified !== 'true') return null

  const sub = typeof payload.sub === 'string' ? payload.sub : ''
  const email = typeof payload.email === 'string' ? payload.email : ''
  if (!sub || !email) return null

  return {
    sub,
    email: email.trim().toLowerCase(),
    name: typeof payload.name === 'string' ? payload.name : '',
    picture: typeof payload.picture === 'string' ? payload.picture : undefined,
  }
}
