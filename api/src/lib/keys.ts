/**
 * Signing keys.
 *
 * The Ed25519 private key arrives as a base64url PKCS#8 secret and has to be
 * turned into a `CryptoKey` before it can sign anything. That import is not
 * free, so it is cached for the lifetime of the isolate — a Worker handling a
 * burst of registrations imports the key once, not once per request.
 *
 * The cache is keyed by the secret itself rather than by key id, so rotating
 * the secret can never leave a stale key in memory.
 */

const cache = new Map<string, CryptoKey>()

function fromBase64Url(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

/**
 * The private half. Import fails loudly rather than silently producing an
 * unusable key — a pass that can't be signed must stop the request, not
 * quietly issue something the gate will reject.
 */
export async function importSigningKey(secret: string): Promise<CryptoKey> {
  const hit = cache.get(secret)
  if (hit) return hit

  if (!secret) {
    throw new Error('PASS_SIGNING_KEY_V1 is not set — cannot issue passes')
  }

  const key = await crypto.subtle.importKey(
    'pkcs8',
    fromBase64Url(secret) as unknown as ArrayBuffer,
    { name: 'Ed25519' },
    false, // non-extractable: once imported it cannot be read back out
    ['sign'],
  )

  cache.set(secret, key)
  return key
}

/**
 * The public half, for verifying. The gate app holds its own copy; this exists
 * so the server can check its own work and so the manifest endpoint can hand
 * the key to a newly provisioned scanner.
 */
export async function importVerifyKey(rawBase64Url: string): Promise<CryptoKey> {
  const cacheKey = `pub:${rawBase64Url}`
  const hit = cache.get(cacheKey)
  if (hit) return hit

  const key = await crypto.subtle.importKey(
    'raw',
    fromBase64Url(rawBase64Url) as unknown as ArrayBuffer,
    { name: 'Ed25519' },
    true,
    ['verify'],
  )

  cache.set(cacheKey, key)
  return key
}
