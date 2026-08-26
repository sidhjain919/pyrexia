/**
 * The one thing worth testing here is that our signature matches AWS's.
 *
 * AWS publishes a worked example of the signing process with the intermediate
 * signing key spelled out in hex. Checking against it means that when SES
 * returns 403 we can be certain it is about permissions or an unverified
 * sender, and stop looking at this file.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { deriveSigningKey, signRequest } from './sigv4.ts'

const hex = (b: ArrayBuffer) =>
  [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')

const base = {
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
  region: 'ap-south-1',
  service: 'ses',
  host: 'email.ap-south-1.amazonaws.com',
  path: '/v2/email/outbound-emails',
  now: new Date('2026-08-27T10:15:30Z'),
}

test('sigv4: derives the signing key AWS documents', async () => {
  // From "Examples of the complete Signature Version 4 signing process" in the
  // AWS General Reference. The hex below is AWS's own published answer.
  const key = await deriveSigningKey(
    'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
    '20150830',
    'us-east-1',
    'iam',
  )
  assert.equal(
    hex(key),
    'c4afb1cc5771d871763a393e44b703571b55cc28424d1a5e86da6ed3c154a4b9',
  )
})

test('sigv4: produces the header shape SES parses', async () => {
  const signed = await signRequest({ ...base, body: '{"a":1}' })

  assert.equal(signed.url, 'https://email.ap-south-1.amazonaws.com/v2/email/outbound-emails')
  assert.equal(signed.headers['X-Amz-Date'], '20260827T101530Z')
  assert.ok(
    signed.headers.Authorization.includes(
      'Credential=AKIAIOSFODNN7EXAMPLE/20260827/ap-south-1/ses/aws4_request',
    ),
  )
  assert.ok(signed.headers.Authorization.includes('SignedHeaders=content-type;host;x-amz-date'))
  // A full 64-character signature, not an empty or truncated one.
  assert.match(signed.headers.Authorization, /Signature=[0-9a-f]{64}$/)
})

test('sigv4: signs the body, so a tampered body fails', async () => {
  const a = await signRequest({ ...base, body: '{"to":"real@example.com"}' })
  const b = await signRequest({ ...base, body: '{"to":"attacker@example.com"}' })
  assert.notEqual(a.headers.Authorization, b.headers.Authorization)
})

test('sigv4: is deterministic for the same request at the same instant', async () => {
  const a = await signRequest({ ...base, body: '{"a":1}' })
  const b = await signRequest({ ...base, body: '{"a":1}' })
  assert.equal(a.headers.Authorization, b.headers.Authorization)
})

test('sigv4: changes day to day, so an old signature cannot be replayed', async () => {
  const a = await signRequest({ ...base, body: '{"a":1}' })
  const b = await signRequest({
    ...base,
    body: '{"a":1}',
    now: new Date('2026-08-28T10:15:30Z'),
  })
  assert.notEqual(a.headers.Authorization, b.headers.Authorization)
})
