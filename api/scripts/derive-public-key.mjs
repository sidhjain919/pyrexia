/**
 * Derive the public half from the private signing key actually in use.
 *
 * This exists because I published a public key from a keypair that was then
 * thrown away and regenerated — the two drifted, and every pass failed to
 * verify. Never transcribe a public key from a generation run; always derive it
 * from the private key that is really deployed.
 */
import { createPrivateKey, createPublicKey } from 'node:crypto'
import { readFileSync } from 'node:fs'

const vars = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8')
const priv = vars.match(/^PASS_SIGNING_KEY_V1=(.+)$/m)?.[1]?.trim()
if (!priv) throw new Error('PASS_SIGNING_KEY_V1 not found in .dev.vars')

const keyObject = createPrivateKey({
  key: Buffer.from(priv.replace(/-/g, '+').replace(/_/g, '/'), 'base64'),
  format: 'der',
  type: 'pkcs8',
})

// Export the public half as raw 32 bytes: SPKI wraps it in a 12-byte header.
const spki = createPublicKey(keyObject).export({ format: 'der', type: 'spki' })
const raw = spki.subarray(spki.length - 32)

const b64url = raw.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
console.log(b64url)
