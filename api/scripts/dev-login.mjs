#!/usr/bin/env node
/**
 * Seed a signed-in account in the LOCAL D1, for looking at the site yourself.
 *
 * Signing in for real needs an email round trip through SES, which is a lot of
 * moving parts to stand up just to check whether a button looks right. This
 * writes a confirmed registration, a paid Basic Registration, an admin row and
 * a session straight into the local database, then prints the one line you
 * paste into the browser console to become that person.
 *
 *   node scripts/dev-login.mjs                 # test@pyrexia.local, admin
 *   node scripts/dev-login.mjs you@example.com
 *
 * Local only, on purpose: it talks to `wrangler d1 --local` and there is no
 * flag to point it anywhere else. Nothing here should ever touch production.
 */

import { execFileSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

const email = (process.argv[2] ?? 'test@pyrexia.local').toLowerCase()
const token = 'pyxdev_' + randomBytes(24).toString('hex')
const hash = createHash('sha256').update(token).digest('hex')
const id = 'dev_' + createHash('sha256').update(email).digest('hex').slice(0, 12)

const sql = `
INSERT OR REPLACE INTO registrations
  (id, public_code, name, email, phone, gender, college, city, course, year,
   emergency_name, emergency_phone, status, verification)
VALUES
  ('${id}', 'PYX26-DEV${id.slice(-3).toUpperCase()}', 'Dev Voyager', '${email}', '9000000000',
   'prefer_not_to_say', 'AIIMS Rishikesh', 'Rishikesh', 'MBBS', '2nd Year',
   'Emergency Contact', '9000000001', 'confirmed', 'approved');

INSERT OR REPLACE INTO orders (id, registration_id, amount_paise, status, paid_at)
VALUES ('ord_${id}', '${id}', 50000, 'paid', datetime('now'));

INSERT OR REPLACE INTO entitlements (id, registration_id, product_id, order_id, granted_at)
VALUES ('ent_${id}', '${id}', 'basic', 'ord_${id}', datetime('now'));

INSERT OR REPLACE INTO admins (id, email, name, role, active)
VALUES ('adm_${id}', '${email}', 'Dev Admin', 'superadmin', 1);

DELETE FROM sessions WHERE registration_id = '${id}';
INSERT INTO sessions (token_hash, registration_id, expires_at)
VALUES ('${hash}', '${id}', datetime('now', '+30 days'));
`

const dir = mkdtempSync(join(tmpdir(), 'pyx-dev-'))
const file = join(dir, 'dev-login.sql')
writeFileSync(file, sql, 'utf8')

// Node refuses to spawn `npx.cmd` on Windows without a shell, and going
// through a shell means quoting a path that may contain spaces. Running
// wrangler's own entrypoint under this node avoids both.
// `wrangler/bin/wrangler.js` is not in the package's `exports`, so resolve the
// package root first and join the path the `bin` field points at.
const require_ = createRequire(import.meta.url)
const wrangler = join(
  dirname(require_.resolve('wrangler/package.json')),
  'bin',
  'wrangler.js',
)

try {
  execFileSync(
    process.execPath,
    [wrangler, 'd1', 'execute', 'pyrexia', '--local', '--file', file],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  )
} finally {
  rmSync(dir, { recursive: true, force: true })
}

const account = JSON.stringify({
  email,
  name: 'Dev Voyager',
  publicCode: 'PYX26-DEV' + id.slice(-3).toUpperCase(),
  hasRegistration: true,
})

console.log(`
Seeded ${email} in the local database:
  • Basic Registration paid, so every event form is open to it
  • superadmin, so /admin and the registration switches work

Open http://localhost:5173, then paste this into the browser console and reload:

localStorage.setItem('pyrexia.session', '${token}'); localStorage.setItem('pyrexia.account', '${account.replace(/'/g, "\\'")}'); location.reload()
`)
