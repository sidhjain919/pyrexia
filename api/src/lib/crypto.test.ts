/**
 * A bug in here is the worst kind: silent at upload, discovered only when
 * somebody needs the file and it will not come back. These check the round
 * trip, and the two properties that make encryption worth doing at all -
 * that the stored bytes reveal nothing, and that altered bytes are refused.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { decryptBytes, encryptBytes, sha256Hex } from './crypto.ts'

const SECRET = 'a-test-secret-that-is-not-the-real-one'
const bytes = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer
const text = (b: ArrayBuffer) => new TextDecoder().decode(b)

test('crypto: a file comes back exactly as it went in', async () => {
  const original = bytes('aadhaar card scan, pretend this is a JPEG')
  const stored = await encryptBytes(SECRET, original)
  assert.equal(text(await decryptBytes(SECRET, stored.buffer as ArrayBuffer)), text(original))
})

test('crypto: the stored bytes do not contain the plaintext', async () => {
  const stored = await encryptBytes(SECRET, bytes('SECRET-ID-NUMBER-1234'))
  assert.ok(!new TextDecoder().decode(stored).includes('SECRET-ID-NUMBER'))
})

test('crypto: the same file encrypts differently every time', async () => {
  // A fresh nonce per file. Without it, two people uploading the same document
  // would produce identical blobs: which leaks that they match.
  const a = await encryptBytes(SECRET, bytes('same file'))
  const b = await encryptBytes(SECRET, bytes('same file'))
  assert.notEqual(new TextDecoder().decode(a), new TextDecoder().decode(b))
})

test('crypto: the wrong key does not decrypt', async () => {
  const stored = await encryptBytes(SECRET, bytes('private'))
  await assert.rejects(() => decryptBytes('a-different-secret', stored.buffer as ArrayBuffer))
})

test('crypto: an altered file is refused, not silently returned', async () => {
  // GCM authenticates as well as encrypts. Flipping one byte in the bucket
  // must fail loudly rather than hand back different bytes.
  const stored = await encryptBytes(SECRET, bytes('an identity document'))
  stored[stored.length - 3] ^= 0xff
  await assert.rejects(() => decryptBytes(SECRET, stored.buffer as ArrayBuffer))
})

test('crypto: a truncated blob is refused', async () => {
  const stored = await encryptBytes(SECRET, bytes('x'))
  await assert.rejects(() => decryptBytes(SECRET, stored.slice(0, 8).buffer as ArrayBuffer))
})

test('crypto: refuses to work with no key configured', async () => {
  await assert.rejects(() => encryptBytes('', bytes('x')), /not configured/)
})

test('crypto: the checksum is stable and is of the plaintext', async () => {
  const a = await sha256Hex(bytes('hello'))
  assert.equal(a, await sha256Hex(bytes('hello')))
  assert.notEqual(a, await sha256Hex(bytes('hello!')))
  assert.match(a, /^[0-9a-f]{64}$/)
})
