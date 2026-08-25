/**
 * PYREXIA 2026 — pass tokens.
 *
 * A pass QR does not *point at* a record; it *is* a signed statement. That
 * distinction is the whole security model:
 *
 *   - Forging one needs the Ed25519 private key, which lives only in the
 *     signing Worker's secret and never reaches a browser or a phone.
 *   - The gate app ships the *public* key, so it verifies authenticity with no
 *     network at all — which is exactly the situation at a gate in a crowd.
 *   - `kid` names the key, so a compromised key can be retired without
 *     invalidating every pass already printed.
 *
 * Wire format (87 bytes → ~116 base64url chars, a comfortable QR):
 *
 *   PYX26.<base64url payload>.<base64url signature>
 *
 * Payload, 23 bytes, big-endian:
 *
 *   0       version
 *   1       kid — signing key id
 *   2..17   passId, 16 random bytes
 *   18      tierFloor — the tier held when this pass was issued
 *   19..22  issuedAt, uint32, minutes since the Unix epoch
 *
 * `tierFloor` is a floor, not the truth. Someone who buys the Delegate Card in
 * October still holds a QR printed in September that says Basic, and reissuing
 * it is no help — they already have the old one on paper. So the gate takes the
 * greater of this floor and the tier in its synced manifest. The floor keeps a
 * brand-new pass working before any device has synced it; the manifest lets an
 * upgrade bought at 8pm work at the 9pm gate.
 */

export const PASS_PREFIX = 'PYX26'
export const PASS_VERSION = 1

const PAYLOAD_BYTES = 23
const SIGNATURE_BYTES = 64
const ID_OFFSET = 2
const ID_BYTES = 16

export type Tier = 0 | 1

export type PassPayload = {
  version: number
  kid: number
  /** 32 lowercase hex characters. */
  passId: string
  tierFloor: Tier
  /** Whole minutes since the Unix epoch. */
  issuedAt: number
}

export type VerifyFailure =
  /** Not a pass token at all — wrong prefix or shape. */
  | 'malformed'
  /** A version this build does not know how to read. */
  | 'unsupported_version'
  /** Signed with a key id we hold no public key for. */
  | 'unknown_key'
  /** Cryptographically invalid — forged, corrupted, or altered in transit. */
  | 'bad_signature'

export type VerifyResult =
  | { valid: true; payload: PassPayload }
  | { valid: false; reason: VerifyFailure }

/* ------------------------------------------------------------------ *
 * base64url — no padding, URL and QR safe
 * ------------------------------------------------------------------ */

export function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromBase64Url(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

/* ------------------------------------------------------------------ *
 * Pass ids
 * ------------------------------------------------------------------ */

/**
 * 128 bits from the CSPRNG. Sequential ids would let anyone walk the pass
 * space; these are not enumerable even with the whole fest's worth of samples.
 */
export function newPassId(): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(ID_BYTES)))
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length !== ID_BYTES * 2 || !/^[0-9a-f]+$/.test(hex)) {
    throw new TypeError(`passId must be ${ID_BYTES * 2} lowercase hex characters`)
  }
  const out = new Uint8Array(ID_BYTES)
  for (let i = 0; i < ID_BYTES; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

/* ------------------------------------------------------------------ *
 * Encoding
 * ------------------------------------------------------------------ */

export function encodePayload(p: PassPayload): Uint8Array {
  if (!Number.isInteger(p.kid) || p.kid < 0 || p.kid > 255) {
    throw new RangeError('kid must fit in one byte')
  }
  if (p.tierFloor !== 0 && p.tierFloor !== 1) {
    throw new RangeError('tierFloor must be 0 or 1')
  }
  if (!Number.isInteger(p.issuedAt) || p.issuedAt < 0 || p.issuedAt > 0xffffffff) {
    throw new RangeError('issuedAt must be a uint32 of minutes')
  }

  const bytes = new Uint8Array(PAYLOAD_BYTES)
  bytes[0] = p.version
  bytes[1] = p.kid
  bytes.set(hexToBytes(p.passId), ID_OFFSET)
  bytes[18] = p.tierFloor
  new DataView(bytes.buffer).setUint32(19, p.issuedAt, false)
  return bytes
}

export function decodePayload(bytes: Uint8Array): PassPayload {
  if (bytes.length !== PAYLOAD_BYTES) throw new RangeError('payload must be 23 bytes')
  return {
    version: bytes[0],
    kid: bytes[1],
    passId: bytesToHex(bytes.slice(ID_OFFSET, ID_OFFSET + ID_BYTES)),
    tierFloor: (bytes[18] === 1 ? 1 : 0) as Tier,
    issuedAt: new DataView(bytes.buffer, bytes.byteOffset).getUint32(19, false),
  }
}

/** Whole minutes since the epoch, the unit `issuedAt` is stored in. */
export function nowInMinutes(at: Date = new Date()): number {
  return Math.floor(at.getTime() / 60000)
}

/* ------------------------------------------------------------------ *
 * Signing and verifying
 * ------------------------------------------------------------------ */

const ED25519 = { name: 'Ed25519' } as const

/**
 * Mint a pass token. Only ever called inside the signing Worker — the private
 * key must not exist anywhere a request handler can reach it.
 */
export async function signPass(payload: PassPayload, privateKey: CryptoKey): Promise<string> {
  const bytes = encodePayload(payload)
  const sig = new Uint8Array(await crypto.subtle.sign(ED25519, privateKey, bytes))
  return `${PASS_PREFIX}.${toBase64Url(bytes)}.${toBase64Url(sig)}`
}

/**
 * Check a scanned token against the public keys the device holds.
 *
 * This answers exactly one question — "did we issue this?" — and deliberately
 * no others. Whether the pass is revoked, already used today, or good enough
 * for *this* gate are all questions about current state, answered against the
 * synced manifest by `decidePassAtGate`. Keeping them apart is what lets this
 * function run offline.
 */
export async function verifyPass(
  token: string,
  publicKeys: Map<number, CryptoKey>,
): Promise<VerifyResult> {
  const parts = token.trim().split('.')
  if (parts.length !== 3 || parts[0] !== PASS_PREFIX) {
    return { valid: false, reason: 'malformed' }
  }

  let payloadBytes: Uint8Array
  let signature: Uint8Array
  try {
    payloadBytes = fromBase64Url(parts[1])
    signature = fromBase64Url(parts[2])
  } catch {
    return { valid: false, reason: 'malformed' }
  }

  if (payloadBytes.length !== PAYLOAD_BYTES || signature.length !== SIGNATURE_BYTES) {
    return { valid: false, reason: 'malformed' }
  }

  const payload = decodePayload(payloadBytes)
  if (payload.version !== PASS_VERSION) {
    return { valid: false, reason: 'unsupported_version' }
  }

  const key = publicKeys.get(payload.kid)
  if (!key) return { valid: false, reason: 'unknown_key' }

  const ok = await crypto.subtle.verify(ED25519, key, signature, payloadBytes)
  return ok ? { valid: true, payload } : { valid: false, reason: 'bad_signature' }
}

/* ------------------------------------------------------------------ *
 * The gate decision
 * ------------------------------------------------------------------ */

/** One row of the signed manifest the scanner syncs before a shift. */
export type ManifestEntry = {
  passId: string
  name: string
  college?: string
  photoUrl?: string
  /** Current tier — this is what makes upgrades work without a reissue. */
  tier: Tier
  revoked: boolean
}

export type GateConfig = {
  gateId: string
  /** Star Night gates carry [1] only. */
  allowedTiers: Tier[]
  allowReentry: boolean
}

export type ScanOutcome =
  | 'ok'
  | 'duplicate'
  | 'wrong_tier'
  | 'revoked'
  | 'invalid_signature'
  | 'unknown_pass'

export type GateDecision = {
  outcome: ScanOutcome
  /** The tier actually applied — max(signed floor, manifest). */
  tier: Tier
  entry?: ManifestEntry
  /** Set when a stale manifest might be the reason for a rejection. */
  recheckOnline?: boolean
}

/**
 * Decide what the guard sees, given a verified token and what the device knows.
 * Pure and synchronous so the scanner can call it the instant the camera reads
 * a code, with no await and no network.
 */
export function decidePassAtGate(args: {
  verified: VerifyResult
  manifest: Map<string, ManifestEntry>
  gate: GateConfig
  /** Successful entries already recorded for this pass at this gate today. */
  entriesToday: number
}): GateDecision {
  const { verified, manifest, gate, entriesToday } = args

  if (!verified.valid) {
    return { outcome: 'invalid_signature', tier: 0 }
  }

  const { passId, tierFloor } = verified.payload
  const entry = manifest.get(passId)

  // Take the better of what was signed and what we have since been told. A pass
  // issued minutes ago may not be in the manifest at all; trust its floor.
  const tier = Math.max(tierFloor, entry?.tier ?? 0) as Tier

  if (entry?.revoked) {
    return { outcome: 'revoked', tier, entry }
  }

  if (!gate.allowedTiers.includes(tier)) {
    return {
      outcome: 'wrong_tier',
      tier,
      entry,
      // The upgrade may have cleared after this device last synced, so offer
      // the online recheck rather than turning away a paying delegate.
      recheckOnline: !entry || tier < Math.max(...gate.allowedTiers),
    }
  }

  if (!gate.allowReentry && entriesToday > 0) {
    return { outcome: 'duplicate', tier, entry }
  }

  // Signature is good and the gate admits this tier. An unknown pass is still
  // let through on the strength of the signature — only the guard's screen is
  // poorer for it, showing no photo to check against.
  if (!entry) {
    return { outcome: 'ok', tier, recheckOnline: true }
  }

  return { outcome: 'ok', tier, entry }
}
