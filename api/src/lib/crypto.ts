/**
 * Encrypting identity documents at rest.
 *
 * A scanned Aadhaar card or a college ID is the most sensitive thing this
 * system will ever hold — far more damaging if leaked than an email address or
 * even a payment record, because it cannot be changed after the fact. So the
 * bytes in the bucket are ciphertext, and the key lives outside the bucket as
 * a Worker secret. Someone who obtains the storage still has nothing.
 *
 * AES-GCM, 256-bit, with a fresh random nonce per file stored in front of the
 * ciphertext. GCM rather than CBC because it authenticates as well as
 * encrypts: a file altered in the bucket fails to decrypt instead of quietly
 * returning different bytes.
 */

/** Never reuse a nonce with the same key — 12 random bytes per file. */
const NONCE_BYTES = 12

/**
 * Turn the configured secret into a key, whatever format it was written in.
 *
 * Hashing rather than decoding is deliberate: the secret may have been
 * generated as base64, hex or a passphrase, and guessing wrong would produce a
 * key that works until someone rotates it in a different format. SHA-256 gives
 * exactly 32 bytes from any of them, deterministically.
 */
async function keyFrom(secret: string): Promise<CryptoKey> {
  if (!secret) throw new Error('DOC_ENCRYPTION_KEY is not configured')

  const material = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(secret) as unknown as ArrayBuffer,
  )

  return crypto.subtle.importKey('raw', material, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ])
}

/** Nonce ‖ ciphertext, as one blob to store. */
export async function encryptBytes(secret: string, plain: ArrayBuffer): Promise<Uint8Array> {
  const key = await keyFrom(secret)
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES))

  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce as unknown as ArrayBuffer },
    key,
    plain,
  )

  const out = new Uint8Array(NONCE_BYTES + cipher.byteLength)
  out.set(nonce, 0)
  out.set(new Uint8Array(cipher), NONCE_BYTES)
  return out
}

/**
 * Reverse it.
 *
 * Throws on a wrong key or a tampered file rather than returning rubbish —
 * that is GCM's authentication tag doing its job, and the caller should treat
 * a failure here as "this file is not readable", never as "return it anyway".
 */
export async function decryptBytes(secret: string, stored: ArrayBuffer): Promise<ArrayBuffer> {
  if (stored.byteLength <= NONCE_BYTES) throw new Error('stored blob is too short')

  const key = await keyFrom(secret)
  const bytes = new Uint8Array(stored)

  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bytes.subarray(0, NONCE_BYTES) as unknown as ArrayBuffer },
    key,
    bytes.subarray(NONCE_BYTES) as unknown as ArrayBuffer,
  )
}

/** For the integrity column — lets a later audit prove a file is unchanged. */
export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
