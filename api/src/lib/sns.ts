/**
 * Verifying that a notification really came from Amazon SNS.
 *
 * SES reports bounces and complaints by POSTing to a URL of ours. Anyone can
 * POST to a URL, and a forged bounce would let a stranger stop us emailing any
 * address they chose: so every message is checked against Amazon's signature
 * before it is believed.
 *
 * The awkward part is that Amazon signs with an X.509 certificate, and
 * WebCrypto imports public keys, not certificates. So `publicKeyFromCert`
 * walks the certificate's DER structure far enough to lift out the
 * SubjectPublicKeyInfo, which is the part WebCrypto understands. It is less
 * frightening than it sounds: DER is nested tag-length-value triples, and we
 * are looking for the one that carries an RSA key.
 */

const RSA_OID = [0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01]

/** One tag-length-value triple, and where the next one starts. */
type Tlv = { tag: number; start: number; end: number; contentStart: number }

function readTlv(bytes: Uint8Array, offset: number): Tlv {
  const tag = bytes[offset]
  let i = offset + 1
  let length = bytes[i++]

  // Lengths above 127 are given as a count of following length bytes.
  if (length & 0x80) {
    const count = length & 0x7f
    length = 0
    for (let n = 0; n < count; n++) length = length * 256 + bytes[i++]
  }

  return { tag, start: offset, contentStart: i, end: i + length }
}

function children(bytes: Uint8Array, parent: Tlv): Tlv[] {
  const out: Tlv[] = []
  let i = parent.contentStart
  while (i < parent.end) {
    const tlv = readTlv(bytes, i)
    out.push(tlv)
    i = tlv.end
  }
  return out
}

/** Does this SEQUENCE describe an RSA key? */
function isRsaAlgorithm(bytes: Uint8Array, tlv: Tlv): boolean {
  if (tlv.tag !== 0x30) return false
  const inner = children(bytes, tlv)
  const oid = inner[0]
  if (!oid || oid.tag !== 0x06) return false
  const value = bytes.subarray(oid.contentStart, oid.end)
  return (
    value.length === RSA_OID.length && RSA_OID.every((b, i) => value[i] === b)
  )
}

/** Pull the importable public key out of a PEM certificate. */
export async function publicKeyFromCert(pem: string, hash: string): Promise<CryptoKey> {
  const base64 = pem
    .replace(/-----[A-Z ]+-----/g, '')
    .replace(/\s+/g, '')
  const der = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))

  // Certificate → tbsCertificate → … → subjectPublicKeyInfo. Rather than
  // counting fields (whose number depends on the certificate version), find
  // the SEQUENCE whose own first child says "this is an RSA key".
  const certificate = readTlv(der, 0)
  const tbs = children(der, certificate)[0]
  if (!tbs) throw new Error('certificate has no tbsCertificate')

  const spki = children(der, tbs).find((field) => {
    if (field.tag !== 0x30) return false
    const first = children(der, field)[0]
    return first ? isRsaAlgorithm(der, first) : false
  })

  if (!spki) throw new Error('no RSA public key in certificate')

  return crypto.subtle.importKey(
    'spki',
    der.subarray(spki.start, spki.end) as unknown as ArrayBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash },
    false,
    ['verify'],
  )
}

export type SnsMessage = {
  Type: string
  MessageId: string
  TopicArn: string
  Subject?: string
  Message: string
  Timestamp: string
  SignatureVersion: string
  Signature: string
  SigningCertURL: string
  SubscribeURL?: string
  Token?: string
}

/**
 * The exact bytes Amazon signed.
 *
 * Field order is fixed by Amazon and is not alphabetical by accident, it is
 * simply what their signer does. A field that is absent is skipped rather than
 * sent empty, which is why `Subject` is conditional.
 */
function canonicalString(message: SnsMessage): string {
  const fields =
    message.Type === 'Notification'
      ? (['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type'] as const)
      : (['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type'] as const)

  let out = ''
  for (const field of fields) {
    const value = (message as Record<string, unknown>)[field]
    if (value === undefined || value === null) continue
    out += `${field}\n${String(value)}\n`
  }
  return out
}

/**
 * Only Amazon's own hosts may be asked for a signing certificate.
 *
 * Without this the SigningCertURL: a field the sender controls, would make
 * the check circular: an attacker would point it at their own certificate and
 * sign with the matching key.
 */
function isAmazonCertUrl(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  return (
    parsed.protocol === 'https:' &&
    /(^|\.)amazonaws\.com$/.test(parsed.hostname) &&
    parsed.pathname.endsWith('.pem')
  )
}

export async function verifySnsMessage(
  message: SnsMessage,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!isAmazonCertUrl(message.SigningCertURL)) return false

  // Version 1 signs with SHA-1, version 2 with SHA-256. Anything else is not
  // something Amazon produces.
  const hash =
    message.SignatureVersion === '1'
      ? 'SHA-1'
      : message.SignatureVersion === '2'
        ? 'SHA-256'
        : null
  if (!hash) return false

  let key: CryptoKey
  try {
    const res = await fetchImpl(message.SigningCertURL)
    if (!res.ok) return false
    key = await publicKeyFromCert(await res.text(), hash)
  } catch {
    return false
  }

  let signature: Uint8Array
  try {
    signature = Uint8Array.from(atob(message.Signature), (c) => c.charCodeAt(0))
  } catch {
    return false
  }

  return crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    signature as unknown as ArrayBuffer,
    new TextEncoder().encode(canonicalString(message)) as unknown as ArrayBuffer,
  )
}
