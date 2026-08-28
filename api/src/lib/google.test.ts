/**
 * These build real signed tokens with a throwaway key that stands in for
 * Google, then check that each of the four gates does its job. The forged
 * cases matter more than the happy one: a sign-in that accepts a token it
 * shouldn't hands over someone else's account.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { clearKeyCache, verifyGoogleIdToken } from './google.ts'

const CLIENT_ID = '1234.apps.googleusercontent.com'
const KID = 'test-key-1'
const NOW = Date.UTC(2026, 7, 27, 12, 0, 0)

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const encodeJson = (value: unknown) =>
  b64url(new TextEncoder().encode(JSON.stringify(value)))

async function newPair(): Promise<CryptoKeyPair> {
  return (await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair
}

const pair = await newPair()

const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey)

/** Stands in for Google's published key set. */
const serveKeys = (async () =>
  new Response(JSON.stringify({ keys: [{ ...publicJwk, kid: KID, alg: 'RS256' }] }), {
    status: 200,
  })) as unknown as typeof fetch

const claims = {
  iss: 'https://accounts.google.com',
  aud: CLIENT_ID,
  sub: '110169484474386276334',
  email: 'Aarav.Sharma@example.edu',
  email_verified: true,
  name: 'Aarav Sharma',
  exp: Math.floor(NOW / 1000) + 3600,
}

async function makeToken(
  overrides: Record<string, unknown> = {},
  header: Record<string, unknown> = {},
): Promise<string> {
  const head = encodeJson({ alg: 'RS256', kid: KID, typ: 'JWT', ...header })
  const body = encodeJson({ ...claims, ...overrides })
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    pair.privateKey,
    new TextEncoder().encode(`${head}.${body}`),
  )
  return `${head}.${body}.${b64url(new Uint8Array(signature))}`
}

const verify = async (token: string, clientId = CLIENT_ID) => {
  clearKeyCache()
  return verifyGoogleIdToken(token, clientId, serveKeys, NOW)
}

test('google: accepts a genuine token and lowercases the address', async () => {
  const identity = await verify(await makeToken())
  assert.ok(identity)
  assert.equal(identity.sub, '110169484474386276334')
  // Stored lowercase, or the same person signing in twice becomes two accounts.
  assert.equal(identity.email, 'aarav.sharma@example.edu')
  assert.equal(identity.name, 'Aarav Sharma')
})

test('google: rejects a token issued for a different application', async () => {
  // Without the aud check, a valid Google token from any other website would
  // sign that person in here.
  const identity = await verify(await makeToken({ aud: 'someone-else.apps.googleusercontent.com' }))
  assert.equal(identity, null)
})

test('google: rejects a token from another issuer', async () => {
  assert.equal(await verify(await makeToken({ iss: 'https://accounts.evil.example' })), null)
})

test('google: rejects an expired token', async () => {
  assert.equal(await verify(await makeToken({ exp: Math.floor(NOW / 1000) - 1 })), null)
})

test('google: rejects a tampered payload', async () => {
  // Take a real token and swap the email for someone else's, keeping the
  // signature. This is the attack the signature check exists for.
  const token = await makeToken()
  const [head, , signature] = token.split('.')
  const forged = `${head}.${encodeJson({ ...claims, email: 'dean@aiimsrishikesh.edu.in' })}.${signature}`
  assert.equal(await verify(forged), null)
})

test('google: refuses alg "none"', async () => {
  const head = encodeJson({ alg: 'none', kid: KID, typ: 'JWT' })
  const body = encodeJson(claims)
  assert.equal(await verify(`${head}.${body}.`), null)
})

test('google: refuses an address Google has not verified', async () => {
  assert.equal(await verify(await makeToken({ email_verified: false })), null)
})

test('google: refuses a token signed with an unknown key', async () => {
  const other = await newPair()
  const head = encodeJson({ alg: 'RS256', kid: KID, typ: 'JWT' })
  const body = encodeJson(claims)
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    other.privateKey,
    new TextEncoder().encode(`${head}.${body}`),
  )
  assert.equal(await verify(`${head}.${body}.${b64url(new Uint8Array(signature))}`), null)
})

test('google: shrugs off malformed input rather than throwing', async () => {
  for (const bad of ['', 'not-a-token', 'a.b', 'a.b.c.d', '...']) {
    assert.equal(await verify(bad), null, `threw or accepted: ${bad}`)
  }
})
