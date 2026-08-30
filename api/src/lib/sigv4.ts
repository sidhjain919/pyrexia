/**
 * Signature Version 4, the way AWS wants requests signed.
 *
 * We need this for exactly one call: handing an email to SES, and pulling in
 * the AWS SDK to make it would cost more than the whole rest of this Worker.
 * So it is written out: four hashes and a chain of HMACs.
 *
 * The shape below is AWS's, not ours, and every part of it is load-bearing.
 * A signature is over a *canonical* form of the request, headers lowercased
 * and sorted, whitespace collapsed: so that both sides derive the same string
 * from the same request. Get one byte wrong and AWS returns 403 with no clue
 * which byte, which is why each step here says what it is doing.
 */

const enc = new TextEncoder()

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function sha256(data: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(data)))
}

async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey(
    'raw',
    key as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return crypto.subtle.sign('HMAC', k, enc.encode(data))
}

/**
 * Narrow the secret to one day, one region, one service.
 *
 * Exported only so the tests can check it against the derivation AWS publishes
 * a known answer for. If this is right, a 403 from SES is a permissions or
 * verification problem rather than a signing bug, which is worth being able
 * to say with certainty.
 */
export async function deriveSigningKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Promise<ArrayBuffer> {
  let key: ArrayBuffer | Uint8Array = enc.encode(`AWS4${secretAccessKey}`)
  for (const part of [dateStamp, region, service, 'aws4_request']) {
    key = await hmac(key, part)
  }
  return key as ArrayBuffer
}

export type SignedRequest = { url: string; headers: Record<string, string>; body: string }

/**
 * Sign a POST.
 *
 * `now` is injectable because a signature is only valid within fifteen minutes
 * of its timestamp: which makes it untestable unless the clock can be pinned.
 */
export async function signRequest(opts: {
  accessKeyId: string
  secretAccessKey: string
  region: string
  service: string
  host: string
  path: string
  body: string
  contentType?: string
  now?: Date
}): Promise<SignedRequest> {
  const {
    accessKeyId, secretAccessKey, region, service, host, path, body,
    contentType = 'application/json',
    now = new Date(),
  } = opts

  // 20260827T101530Z and 20260827: AWS wants both, and derives the second
  // from the first, so they must never be computed from two separate clocks.
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const dateStamp = amzDate.slice(0, 8)

  const payloadHash = await sha256(body)

  // Only these three are signed. Signing more is allowed but every signed
  // header must then survive the journey byte-identical, and intermediaries
  // rewrite things like content-length.
  const canonicalHeaders =
    `content-type:${contentType}\n` + `host:${host}\n` + `x-amz-date:${amzDate}\n`
  const signedHeaders = 'content-type;host;x-amz-date'

  const canonicalRequest = [
    'POST',
    path,
    '', // no query string
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')

  const scope = `${dateStamp}/${region}/${service}/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    await sha256(canonicalRequest),
  ].join('\n')

  // Derived, not stored: a leaked signing key is useless tomorrow.
  const key = await deriveSigningKey(secretAccessKey, dateStamp, region, service)
  const signature = hex(await hmac(key, stringToSign))

  return {
    url: `https://${host}${path}`,
    headers: {
      'Content-Type': contentType,
      'X-Amz-Date': amzDate,
      Authorization:
        `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    body,
  }
}
