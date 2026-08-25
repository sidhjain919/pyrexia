/**
 * Generate the secrets PYREXIA mints for itself.
 *
 *   node scripts/generate-keys.mjs
 *
 * Three things come out:
 *
 *   PASS_SIGNING_KEY_V1  the Ed25519 private key that seals every pass. This is
 *                        the crown jewel — anyone holding it can mint a valid
 *                        Delegate pass for free, forever.
 *   PASS_PUBLIC_KEY_V1   its public half. Safe to print, commit, or ship in the
 *                        guard app. It can only *check* seals, never make them.
 *   SESSION_SECRET       signs login sessions.
 *   DOC_ENCRYPTION_KEY   encrypts identity documents at rest.
 *
 * Run this once for development and once more for production, and never let the
 * two be the same key. A leaked development key should not put real passes at
 * risk.
 */

import { webcrypto as crypto } from 'node:crypto'

const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const pair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])

const priv = b64url(await crypto.subtle.exportKey('pkcs8', pair.privateKey))
const pub = b64url(await crypto.subtle.exportKey('raw', pair.publicKey))

const random = (bytes) => b64url(crypto.getRandomValues(new Uint8Array(bytes)))

console.log(`
# ---------------------------------------------------------------
# Generated ${new Date().toISOString()}
# Paste the secret lines into .dev.vars (local) or set them with
#   wrangler secret put NAME
# Never commit them. Never paste them into a chat or an email.
# ---------------------------------------------------------------

PASS_SIGNING_KEY_V1=${priv}
SESSION_SECRET=${random(32)}
DOC_ENCRYPTION_KEY=${random(32)}

# Public half — safe to share. Goes into the guard app so it can verify
# passes offline. Keep a copy: you need it to check any pass ever issued
# with the key above.
PASS_PUBLIC_KEY_V1=${pub}
`)
