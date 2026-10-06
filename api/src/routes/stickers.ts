/**
 * Star Night stickers: activating them at the desk, and scanning them at the
 * concert gate.
 *
 *   POST /api/devices/pair                 a phone presents its pairing code
 *
 *   GET  /api/stickers/whoami              who this screen belongs to
 *   POST /api/stickers/identify            find a Festival Pass holder
 *   POST /api/stickers/activate            stick a sticker on them
 *   GET  /api/stickers/lookup              whose sticker is this, and where has it been
 *   POST /api/stickers/void                supervisor: a lost pass, or a lost sheet
 *   GET  /api/stickers/overview            supervisor: tonight at the gates
 *   GET  /api/stickers/devices             supervisor: the paired phones
 *   POST /api/stickers/devices             supervisor: pair a new one
 *   POST /api/stickers/devices/:id/repair  supervisor: a fresh link for a phone that lost its pairing
 *   POST /api/stickers/devices/:id/revoke  supervisor: unpair one
 *
 *   GET  /api/gate/me                      the guard's screen, on load
 *   GET  /api/gate/manifest                everything a gate needs to work offline
 *   POST /api/gate/scan                    let them in, or don't
 *
 * Three kinds of caller, and none of them is a desk volunteer's own account:
 *
 *  - **Supervisors** sign in as themselves. An admin with a supervising role
 *    (superadmin, core, gate_supervisor) can do everything here.
 *  - **Desk devices** are phones or laptops a supervisor paired for activation.
 *    They find a Festival Pass holder and activate a sticker, nothing else.
 *    Making the volunteers admins instead would hand each of them the whole
 *    registration list, which a counter does not need.
 *  - **Gate devices** are the guards' phones. They scan, and that is all.
 *
 * Both kinds of device are rows in `guards`, told apart by `gate_id`: a gate
 * phone belongs to a gate, a desk device to none. A device signs in once, by
 * a single-use code that lives fifteen minutes, and holds a bearer token from
 * then on. Only its hash is stored, and a supervisor can revoke it from their
 * own phone the moment one goes missing.
 */

import { Hono, type Context } from 'hono'

import type { Env } from '../types.ts'
import { ApiError, clientIp, readJson } from '../lib/http.ts'
import { newId, newSecretToken, randomCode, sha256Hex } from '../lib/ids.ts'
import { importVerifyKey } from '../lib/keys.ts'
import { verifyPass } from '../lib/pass.ts'
import { readToken, resolveSession } from '../lib/session.ts'
import { festNight, readScan, scanMoment, serialLabel } from '../lib/stickers.ts'
import { normalisePhone } from '../lib/validate.ts'
import * as audit from '../lib/audit.ts'

/** Who is using a staff screen. */
type Staff = {
  kind: 'supervisor' | 'desk'
  /** An admin id, or a device's `guards` id. */
  id: string
  /** What goes in `activated_by` and the audit log. */
  label: string
  supervisor: boolean
}

type Device = { id: string; name: string; gateId: string | null; gateName: string | null }

type Vars = { staff: Staff; device: Device }

export const stickers = new Hono<{ Bindings: Env; Variables: Vars }>()

const SUPERVISING_ROLES = new Set(['superadmin', 'core', 'gate_supervisor'])

/** Device tokens carry a prefix so they are never mistaken for a session. */
const DEVICE_PREFIX = 'dvc_'
/** Pairing codes live this long and work once. */
const PAIR_MINUTES = 15

/** When a guard's pairing code stops working. Codes from before 0018 have no expiry column. */
const PAIR_DEADLINE = `COALESCE(g.pair_expires_at, datetime(g.created_at, '+${PAIR_MINUTES} minutes'))`

/**
 * Somebody was let in: the server admitted them, or a phone without signal
 * did and the server learnt of it afterwards. Every count of people through
 * a gate uses this, never `result = 'ok'` alone, or an offline admission of a
 * copied sticker drops out of the headcount and turns up as a refusal.
 */
const LET_IN = `(result = 'ok' OR admitted_offline = 1)`
const LET_IN_SS = `(ss.result = 'ok' OR ss.admitted_offline = 1)`

/* ------------------------------------------------------------------ *
 * Who is calling
 * ------------------------------------------------------------------ */

function bearer(c: Context): string | null {
  const header = c.req.header('Authorization') ?? ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null
}

async function deviceFor(env: Env, token: string | null): Promise<Device | null> {
  if (!token?.startsWith(DEVICE_PREFIX)) return null
  const row = await env.DB.prepare(
    `SELECT g.id, g.name, g.gate_id, gt.name AS gate_name
       FROM guards g LEFT JOIN gates gt ON gt.id = g.gate_id
      WHERE g.device_token_hash = ? AND g.active = 1`,
  )
    .bind(await sha256Hex(token))
    .first<{ id: string; name: string; gate_id: string | null; gate_name: string | null }>()
  return row ? { id: row.id, name: row.name, gateId: row.gate_id, gateName: row.gate_name } : null
}

stickers.use('/stickers/*', async (c, next) => {
  const token = bearer(c)

  if (token?.startsWith(DEVICE_PREFIX)) {
    const device = await deviceFor(c.env, token)
    // A gate phone has no business at the desk: it scans, and that is all.
    if (!device || device.gateId) throw new ApiError('unauthorised', 'This device is not paired for the desk.')
    c.set('staff', { kind: 'desk', id: device.id, label: `desk:${device.name}`, supervisor: false })
    return next()
  }

  const session = await resolveSession(c.env, token ?? readToken(c.req.raw.headers))
  if (!session) throw new ApiError('unauthorised', 'Sign in first.')

  const row = await c.env.DB.prepare(
    'SELECT id, email, role FROM admins WHERE lower(email) = ? AND active = 1',
  )
    .bind(session.email.toLowerCase())
    .first<{ id: string; email: string; role: string }>()

  if (!row || !SUPERVISING_ROLES.has(row.role)) {
    throw new ApiError('forbidden', 'You do not have access to this.')
  }

  c.set('staff', { kind: 'supervisor', id: row.id, label: row.email, supervisor: true })
  await next()
})

stickers.use('/gate/*', async (c, next) => {
  const device = await deviceFor(c.env, bearer(c))
  if (!device?.gateId) throw new ApiError('unauthorised', 'This phone is not paired for a gate.')
  c.set('device', device)
  await next()
})

function pairUrl(env: Env, code: string): string {
  return `${env.SITE_URL.replace(/\/$/, '')}/scan?pair=${code}`
}

function requireSupervisor(c: Context<{ Bindings: Env; Variables: Vars }>): Staff {
  const staff = c.get('staff')
  if (!staff.supervisor) throw new ApiError('forbidden', 'Only a supervisor can do that.')
  return staff
}

/** A device has no email; its label (`desk:Counter 2`) stands in for one. */
function actor(staff: Staff) {
  return { actorId: staff.id, actorEmail: staff.label }
}

/* ------------------------------------------------------------------ *
 * People and stickers, as the screens see them
 * ------------------------------------------------------------------ */

type PersonRow = {
  id: string
  public_code: string
  name: string
  college: string | null
  gender: string | null
  email: string
  phone: string | null
  tier: number
  sticker_code: string | null
  sticker_serial: number | null
}

const PERSON_SQL = `
  SELECT r.id, r.public_code, r.name, r.college, r.gender, r.email, r.phone, t.tier,
         s.code AS sticker_code, s.serial AS sticker_serial
    FROM registrations r
    JOIN registration_tier t ON t.registration_id = r.id
    LEFT JOIN stickers s ON s.registration_id = r.id AND s.status = 'active'`

function personView(p: PersonRow) {
  return {
    registrationId: p.id,
    publicCode: p.public_code,
    name: p.name,
    college: p.college,
    gender: p.gender,
    email: p.email,
    phone: p.phone,
    festivalPass: p.tier === 1,
    sticker: p.sticker_code
      ? { code: p.sticker_code, serial: p.sticker_serial, label: serialLabel(p.sticker_serial ?? 0) }
      : null,
  }
}

/**
 * Find somebody from whatever the desk has: their online pass QR held up on a
 * phone, their PYX26 number, their email, or their mobile.
 *
 * The online pass is checked against our public key before it is believed. A
 * screenshot of a real one still identifies its real owner, which is fine:
 * the volunteer is looking at the person and reading the name back to them.
 */
async function findPerson(env: Env, query: string): Promise<PersonRow | null> {
  const q = query.trim()
  if (!q) throw new ApiError('bad_request', 'Scan their pass, or type an email, mobile or PYX26 number.')

  const scanned = readScan(q)
  if (scanned.kind === 'online_pass') {
    const kid = Number(env.PASS_KEY_ID ?? '1')
    const keys = new Map([[kid, await importVerifyKey(env.PASS_PUBLIC_KEY_V1)]])
    const verified = await verifyPass(scanned.token, keys)
    if (!verified.valid) throw new ApiError('invalid_code', 'That QR is not a genuine PYREXIA pass.')
    return env.DB.prepare(`${PERSON_SQL} JOIN passes p ON p.registration_id = r.id
                            WHERE p.id = ? AND p.revoked_at IS NULL`)
      .bind(verified.payload.passId)
      .first<PersonRow>()
  }

  if (scanned.kind === 'sticker') {
    throw new ApiError('bad_request', "That's a sticker. Find the person first: scan their online pass, or type their email or mobile.")
  }

  if (/^PYX26-[0-9A-Z]{6}$/i.test(q)) {
    return env.DB.prepare(`${PERSON_SQL} WHERE r.public_code = ?`).bind(q.toUpperCase()).first<PersonRow>()
  }

  if (q.includes('@')) {
    return env.DB.prepare(`${PERSON_SQL} WHERE lower(r.email) = ?`).bind(q.toLowerCase()).first<PersonRow>()
  }

  const phone = normalisePhone(q)
  if (/^\d{10}$/.test(phone)) {
    // A number can sit on an abandoned account as well as a paid one; the
    // Festival Pass holder is the one the desk is looking for.
    return env.DB.prepare(`${PERSON_SQL} WHERE r.phone = ? ORDER BY t.tier DESC, r.status = 'confirmed' DESC LIMIT 1`)
      .bind(phone)
      .first<PersonRow>()
  }

  throw new ApiError('bad_request', 'Scan their pass, or type an email, a 10-digit mobile, or a PYX26 number.')
}

type StickerRow = {
  code: string
  serial: number
  batch: string
  status: 'stock' | 'active' | 'void'
  registration_id: string | null
  activated_at: string | null
  activated_by: string | null
  voided_at: string | null
  voided_by: string | null
  void_reason: string | null
}

/** A scanned or typed sticker, or a sentence the desk can act on. */
async function stickerFrom(env: Env, raw: unknown): Promise<StickerRow> {
  const scanned = readScan(String(raw ?? ''))
  if (scanned.kind === 'online_pass') {
    throw new ApiError('bad_request', "That's their online pass. Scan the sticker on the card.")
  }
  if (scanned.kind !== 'sticker') {
    throw new ApiError('bad_request', 'That is not a PYREXIA sticker. Scan it again, or type the 10 characters under the QR.')
  }
  const row = await env.DB.prepare('SELECT * FROM stickers WHERE code = ?').bind(scanned.code).first<StickerRow>()
  if (!row) throw new ApiError('not_found', 'That code is not one of our stickers. Check the characters under the QR.')
  return row
}

/* ------------------------------------------------------------------ *
 * Pairing a device
 * ------------------------------------------------------------------ */

stickers.post('/devices/pair', async (c) => {
  const body = (await readJson(c)) as Record<string, unknown>
  const code = String(body.code ?? '').trim().toUpperCase().replace(/[\s-]/g, '')
  if (!/^[0-9A-Z]{8}$/.test(code)) throw new ApiError('invalid_code', 'That pairing code is 8 characters.')

  const token = DEVICE_PREFIX + newSecretToken()

  // One statement, so two phones racing for the same code cannot both win.
  const row = await c.env.DB.prepare(
    `UPDATE guards AS g SET device_token_hash = ?, active = 1, last_seen_at = datetime('now'), pair_expires_at = NULL
      WHERE g.device_token_hash = ? AND g.active = 0
        AND ${PAIR_DEADLINE} > datetime('now')
      RETURNING id, name, gate_id`,
  )
    .bind(await sha256Hex(token), `pair:${await sha256Hex(code)}`)
    .first<{ id: string; name: string; gate_id: string | null }>()

  if (!row) {
    throw new ApiError('invalid_code', 'That code has expired or was already used. Ask the supervisor for a new one.')
  }

  const gate = row.gate_id
    ? await c.env.DB.prepare('SELECT name FROM gates WHERE id = ?').bind(row.gate_id).first<{ name: string }>()
    : null

  await audit.record(c.env, {
    action: 'gate.device_pair',
    entity: 'guard',
    entityId: row.id,
    actorId: row.id,
    after: { name: row.name, gate: gate?.name ?? null },
    ip: clientIp(c),
  })

  return c.json({ token, kind: row.gate_id ? 'gate' : 'desk', name: row.name, gate: gate?.name ?? null })
})

/* ------------------------------------------------------------------ *
 * The desk
 * ------------------------------------------------------------------ */

stickers.get('/stickers/whoami', (c) => {
  const staff = c.get('staff')
  return c.json({ kind: staff.kind, label: staff.label, supervisor: staff.supervisor, night: festNight() })
})

stickers.post('/stickers/identify', async (c) => {
  const body = (await readJson(c)) as Record<string, unknown>
  const person = await findPerson(c.env, String(body.query ?? ''))
  if (!person) throw new ApiError('not_found', 'Nobody is registered with that.')
  return c.json({ person: personView(person) })
})

/**
 * Activate a sticker for a Festival Pass holder.
 *
 * Everything that could go wrong at a counter has its own sentence, because
 * each one is a different thing for the volunteer to do next. Activating the
 * same sticker for the same person twice is not an error: a double tap on a
 * slow connection should look like success, because it was.
 *
 * `replace` is for a lost pass, and only a supervisor may send it: the old
 * sticker is voided in the same transaction, so there is never a moment when
 * the person holds two.
 */
stickers.post('/stickers/activate', async (c) => {
  const staff = c.get('staff')
  const body = (await readJson(c)) as Record<string, unknown>
  const registrationId = String(body.registrationId ?? '')
  const replace = body.replace === true

  const sticker = await stickerFrom(c.env, body.sticker)
  const person = await c.env.DB.prepare(`${PERSON_SQL} WHERE r.id = ?`).bind(registrationId).first<PersonRow>()
  if (!person) throw new ApiError('not_found', 'Find the person again: that registration was not found.')

  const label = serialLabel(sticker.serial)

  if (sticker.status === 'active' && sticker.registration_id === person.id) {
    return c.json({ person: personView(person), already: true })
  }
  if (sticker.status === 'active') {
    const holder = await c.env.DB.prepare('SELECT name, public_code FROM registrations WHERE id = ?')
      .bind(sticker.registration_id)
      .first<{ name: string; public_code: string }>()
    throw new ApiError(
      'conflict',
      `${label} is already activated for ${holder?.name ?? 'somebody else'} (${holder?.public_code ?? 'unknown'}). Use a fresh sticker.`,
    )
  }
  if (sticker.status === 'void') {
    throw new ApiError('conflict', `${label} was voided${sticker.void_reason ? ` (${sticker.void_reason})` : ''}. Peel it off and use a fresh sticker.`)
  }

  if (person.tier !== 1) {
    throw new ApiError(
      'forbidden',
      `${person.name} (${person.public_code}) does not hold the Festival Pass, so gets no sticker. Sell them the Festival Pass first.`,
    )
  }

  if (person.sticker_code && !replace) {
    throw new ApiError(
      'conflict',
      `${person.name} already has ${serialLabel(person.sticker_serial ?? 0)}. If their pass is lost, a supervisor replaces it.`,
      { extra: { existing: { code: person.sticker_code, serial: person.sticker_serial } } },
    )
  }
  if (person.sticker_code && replace) requireSupervisor(c)

  const statements: D1PreparedStatement[] = []
  if (person.sticker_code) {
    statements.push(
      c.env.DB.prepare(
        `UPDATE stickers SET status = 'void', voided_at = datetime('now'), voided_by = ?,
                void_reason = 'replaced by ' || ?
          WHERE code = ? AND status = 'active'`,
      ).bind(staff.label, label, person.sticker_code),
    )
  }
  statements.push(
    c.env.DB.prepare(
      `UPDATE stickers SET status = 'active', registration_id = ?, activated_at = datetime('now'), activated_by = ?
        WHERE code = ? AND status = 'stock'`,
    ).bind(person.id, staff.label, sticker.code),
  )

  let changed = 0
  try {
    const results = await c.env.DB.batch(statements)
    changed = results[results.length - 1].meta.changes ?? 0
  } catch (err) {
    // The one-sticker-per-person index lost a race with another counter.
    console.error('sticker activation failed', err)
    throw new ApiError('conflict', `${person.name} was just given a sticker at another counter. Look them up again.`)
  }
  if (changed !== 1) {
    throw new ApiError('conflict', `${label} was just used at another counter. Use a fresh sticker.`)
  }

  if (person.sticker_code) {
    await audit.record(c.env, {
      ...actor(staff),
      action: 'sticker.void',
      entity: 'sticker',
      entityId: person.sticker_code,
      after: { reason: `replaced by ${label}`, registrationId: person.id },
      ip: clientIp(c),
    })
  }
  await audit.record(c.env, {
    ...actor(staff),
    action: 'sticker.activate',
    entity: 'sticker',
    entityId: sticker.code,
    after: { serial: sticker.serial, registrationId: person.id, publicCode: person.public_code },
    ip: clientIp(c),
  })

  const updated = await c.env.DB.prepare(`${PERSON_SQL} WHERE r.id = ?`).bind(person.id).first<PersonRow>()
  return c.json({ person: personView(updated ?? person), already: false, replaced: person.sticker_code ? serialLabel(person.sticker_serial ?? 0) : null }, 201)
})

/** Whose sticker is this, and where has it been. */
stickers.get('/stickers/lookup', async (c) => {
  const sticker = await stickerFrom(c.env, c.req.query('scan'))

  const [holder, scans] = await Promise.all([
    sticker.registration_id
      ? c.env.DB.prepare(`${PERSON_SQL} WHERE r.id = ?`).bind(sticker.registration_id).first<PersonRow>()
      : null,
    c.env.DB.prepare(
      `SELECT ss.night, ss.result, ss.admitted_offline, ss.client_scanned_at, gt.name AS gate
         FROM sticker_scans ss LEFT JOIN gates gt ON gt.id = ss.gate_id
        WHERE ss.sticker_code = ? ORDER BY ss.client_scanned_at DESC LIMIT 30`,
    ).bind(sticker.code).all<{
      night: string; result: string; admitted_offline: number; client_scanned_at: string; gate: string | null
    }>(),
  ])

  return c.json({
    sticker: {
      code: sticker.code,
      serial: sticker.serial,
      label: serialLabel(sticker.serial),
      batch: sticker.batch,
      status: sticker.status,
      activatedAt: sticker.activated_at,
      activatedBy: sticker.activated_by,
      voidedAt: sticker.voided_at,
      voidedBy: sticker.voided_by,
      voidReason: sticker.void_reason,
    },
    holder: holder ? personView(holder) : null,
    scans: scans.results.map((s) => ({
      night: s.night,
      result: s.result,
      /** The phone let them in without signal; `result` is what the server made of it later. */
      admittedOffline: s.admitted_offline === 1,
      at: s.client_scanned_at,
      gate: s.gate,
    })),
  })
})

/* ------------------------------------------------------------------ *
 * Supervisors
 * ------------------------------------------------------------------ */

/**
 * Void one sticker, or a run of serials.
 *
 * One sticker: a pass reported lost, before its owner is back at the desk for
 * a replacement. A run: a sheet that went missing before it was cut, which
 * voids only what was still in stock, never somebody's live sticker.
 */
stickers.post('/stickers/void', async (c) => {
  const staff = requireSupervisor(c)
  const body = (await readJson(c)) as Record<string, unknown>
  const reason = String(body.reason ?? '').trim().slice(0, 200)
  if (reason.length < 3) throw new ApiError('validation_failed', 'Say why.', { fields: { reason: 'Why it is being voided.' } })

  if (body.from != null || body.to != null) {
    const from = Number(body.from)
    const to = Number(body.to)
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from || to - from > 500) {
      throw new ApiError('validation_failed', 'A run of at most 500 serials, lowest first.')
    }
    const res = await c.env.DB.prepare(
      `UPDATE stickers SET status = 'void', voided_at = datetime('now'), voided_by = ?, void_reason = ?
        WHERE serial BETWEEN ? AND ? AND status = 'stock'`,
    ).bind(staff.label, reason, from, to).run()
    await audit.record(c.env, {
      ...actor(staff),
      action: 'sticker.void',
      entity: 'sticker',
      entityId: `serials ${from}-${to}`,
      after: { reason, voided: res.meta.changes },
      ip: clientIp(c),
    })
    return c.json({ voided: res.meta.changes ?? 0 })
  }

  const sticker = await stickerFrom(c.env, body.sticker)
  if (sticker.status === 'void') return c.json({ voided: 0 })

  await c.env.DB.prepare(
    `UPDATE stickers SET status = 'void', voided_at = datetime('now'), voided_by = ?, void_reason = ?
      WHERE code = ?`,
  ).bind(staff.label, reason, sticker.code).run()
  await audit.record(c.env, {
    ...actor(staff),
    action: 'sticker.void',
    entity: 'sticker',
    entityId: sticker.code,
    before: { status: sticker.status, registrationId: sticker.registration_id },
    after: { reason },
    ip: clientIp(c),
  })
  return c.json({ voided: 1 })
})

stickers.get('/stickers/overview', async (c) => {
  requireSupervisor(c)
  const night = festNight()

  const [counts, gates, refused, nights, holders, twice] = await Promise.all([
    c.env.DB.prepare('SELECT status, count(*) AS n FROM stickers GROUP BY status').all<{ status: string; n: number }>(),
    c.env.DB.prepare(
      `SELECT coalesce(gt.name, '?') AS gate, count(*) AS n
         FROM sticker_scans ss LEFT JOIN gates gt ON gt.id = ss.gate_id
        WHERE ss.night = ? AND ${LET_IN_SS} GROUP BY gt.name ORDER BY n DESC`,
    ).bind(night).all<{ gate: string; n: number }>(),
    c.env.DB.prepare(
      `SELECT result, count(*) AS n FROM sticker_scans
        WHERE night = ? AND NOT ${LET_IN} GROUP BY result`,
    ).bind(night).all<{ result: string; n: number }>(),
    c.env.DB.prepare(
      `SELECT night, count(*) AS n FROM sticker_scans WHERE ${LET_IN}
        GROUP BY night ORDER BY night`,
    ).all<{ night: string; n: number }>(),
    c.env.DB.prepare(
      `SELECT count(*) AS n FROM registration_tier t
        WHERE t.tier = 1 AND NOT EXISTS (
          SELECT 1 FROM stickers s WHERE s.registration_id = t.registration_id AND s.status = 'active')`,
    ).first<{ n: number }>(),
    // Let in by a phone without signal, though the server says no: almost
    // always a copied sticker used at two gates during an outage. Shown with
    // the first entry beside it, so the supervisor can see whose pass was
    // copied and cancel it before the next night.
    c.env.DB.prepare(
      `SELECT ss.sticker_code AS code, ss.result, ss.client_scanned_at AS at, gt.name AS gate, g.name AS guard,
              s.serial, r.name, r.public_code,
              f.client_scanned_at AS first_at, fg.name AS first_gate
         FROM sticker_scans ss
         LEFT JOIN gates gt ON gt.id = ss.gate_id
         LEFT JOIN guards g ON g.id = ss.guard_id
         LEFT JOIN stickers s ON s.code = ss.sticker_code
         LEFT JOIN registrations r ON r.id = s.registration_id
         LEFT JOIN sticker_scans f ON f.sticker_code = ss.sticker_code AND f.night = ss.night AND f.result = 'ok'
         LEFT JOIN gates fg ON fg.id = f.gate_id
        WHERE ss.night = ? AND ss.admitted_offline = 1 AND ss.result != 'ok'
        ORDER BY ss.client_scanned_at DESC LIMIT 100`,
    ).bind(night).all<{
      code: string | null; result: string; at: string; gate: string | null; guard: string | null
      serial: number | null; name: string | null; public_code: string | null
      first_at: string | null; first_gate: string | null
    }>(),
  ])

  const byStatus = Object.fromEntries(counts.results.map((r) => [r.status, r.n]))
  return c.json({
    night,
    stickers: { stock: byStatus.stock ?? 0, active: byStatus.active ?? 0, void: byStatus.void ?? 0 },
    festivalPassWithoutSticker: holders?.n ?? 0,
    tonight: {
      admitted: gates.results.reduce((sum, g) => sum + g.n, 0),
      byGate: gates.results,
      refused: refused.results,
      letInTwice: twice.results.map((t) => ({
        code: t.code,
        label: t.serial ? serialLabel(t.serial) : null,
        name: t.name,
        publicCode: t.public_code,
        /** Why the server would have refused it: usually `duplicate`. */
        result: t.result,
        at: t.at,
        gate: t.gate,
        guard: t.guard,
        firstAt: t.first_at,
        firstGate: t.first_gate,
      })),
    },
    nights: nights.results,
  })
})

stickers.get('/stickers/devices', async (c) => {
  requireSupervisor(c)
  const rows = await c.env.DB.prepare(
    `SELECT g.id, g.name, gt.name AS gate, g.active, g.created_at, g.last_seen_at,
            ${PAIR_DEADLINE} > datetime('now') AS code_live,
            (SELECT count(*) FROM sticker_scans ss
              WHERE ss.guard_id = g.id AND ss.night = ? AND ${LET_IN_SS}) AS admitted_tonight
       FROM guards g LEFT JOIN gates gt ON gt.id = g.gate_id
      WHERE g.active = 1
         -- Waiting for its code to be used. A phone that was paired before and
         -- is waiting on a re-pair stays listed after the code runs out, so the
         -- supervisor can send another; one that never paired drops off.
         OR (g.device_token_hash LIKE 'pair:%'
             AND (${PAIR_DEADLINE} > datetime('now') OR g.last_seen_at IS NOT NULL))
      ORDER BY gt.name IS NULL, gt.name, g.name`,
  ).bind(festNight()).all<{
    id: string; name: string; gate: string | null; active: number; code_live: number
    created_at: string; last_seen_at: string | null; admitted_tonight: number
  }>()

  const gates = await c.env.DB.prepare('SELECT name FROM gates WHERE active = 1 ORDER BY name').all<{ name: string }>()

  return c.json({
    devices: rows.results.map((d) => ({
      id: d.id,
      name: d.name,
      kind: d.gate ? 'gate' : 'desk',
      gate: d.gate,
      paired: d.active === 1,
      /** For a phone that is not paired: is its code still usable, or does it need a new one? */
      pairing: d.active === 1 ? null : d.code_live ? 'waiting' : 'expired',
      createdAt: d.created_at,
      lastSeenAt: d.last_seen_at,
      admittedTonight: d.admitted_tonight,
    })),
    gates: gates.results.map((g) => g.name),
  })
})

/**
 * Pair a new phone: a gate phone when a gate is named, a desk device when not.
 *
 * The code is shown on the supervisor's screen as a QR and as text, and the
 * new phone opens it within fifteen minutes or it is dead. Gates are made the
 * first time they are named; there are only ever a handful.
 */
stickers.post('/stickers/devices', async (c) => {
  const staff = requireSupervisor(c)
  const body = (await readJson(c)) as Record<string, unknown>
  const name = String(body.name ?? '').trim().replace(/\s+/g, ' ').slice(0, 60)
  const gateName = String(body.gate ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)
  if (name.length < 2) {
    throw new ApiError('validation_failed', 'Name it.', { fields: { name: "The guard's name, or which desk it is." } })
  }

  let gateId: string | null = null
  if (gateName) {
    gateId = `gate_${gateName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`
    // Star Nights admit the Festival Pass only, and once a night.
    await c.env.DB.prepare(
      `INSERT OR IGNORE INTO gates (id, name, allowed_tiers, allow_reentry) VALUES (?, ?, '[1]', 0)`,
    ).bind(gateId, gateName).run()
  }

  const code = randomCode(8)
  const id = newId()
  // No PIN: the code is single-use and short-lived, and a lost phone is
  // revoked from the supervisor's screen. A PIN on a guard's phone at a
  // concert gate is a PIN written on the back of it.
  await c.env.DB.prepare(
    `INSERT INTO guards (id, name, device_token_hash, pin_hash, gate_id, active, pair_expires_at)
     VALUES (?, ?, ?, '', ?, 0, datetime('now', '+${PAIR_MINUTES} minutes'))`,
  ).bind(id, name, `pair:${await sha256Hex(code)}`, gateId).run()

  await audit.record(c.env, {
    ...actor(staff),
    action: 'guard.issue_device',
    entity: 'guard',
    entityId: id,
    after: { name, gate: gateName || null },
    ip: clientIp(c),
  })

  return c.json({
    id,
    code,
    url: pairUrl(c.env, code),
    expiresInMinutes: PAIR_MINUTES,
  }, 201)
})

/**
 * A fresh pairing link for a phone that is already set up.
 *
 * For a guard whose phone lost its pairing (browser data cleared, the scanner
 * opened in another browser, a new phone): the supervisor sends the link over
 * WhatsApp and the guard taps it where they stand. It stays the same guard on
 * the same gate, so tonight's count carries on. Whatever phone held the old
 * pairing is signed out the moment this is made, which is also what a
 * supervisor wants when a phone has gone missing and its guard has another.
 */
stickers.post('/stickers/devices/:id/repair', async (c) => {
  const staff = requireSupervisor(c)
  const id = c.req.param('id')
  const code = randomCode(8)

  const row = await c.env.DB.prepare(
    `UPDATE guards SET device_token_hash = ?, active = 0,
            pair_expires_at = datetime('now', '+${PAIR_MINUTES} minutes')
      WHERE id = ? AND device_token_hash NOT LIKE 'revoked:%'
      RETURNING id, name`,
  ).bind(`pair:${await sha256Hex(code)}`, id).first<{ id: string; name: string }>()

  if (!row) throw new ApiError('not_found', 'That phone was unpaired for good. Pair a new one instead.')

  await audit.record(c.env, {
    ...actor(staff),
    action: 'guard.issue_device',
    entity: 'guard',
    entityId: id,
    after: { name: row.name, repair: true },
    ip: clientIp(c),
  })

  return c.json({ id, code, url: pairUrl(c.env, code), expiresInMinutes: PAIR_MINUTES })
})

stickers.post('/stickers/devices/:id/revoke', async (c) => {
  const staff = requireSupervisor(c)
  const id = c.req.param('id')
  // The token hash is overwritten, not just flagged, so the device can never
  // come back even if somebody flips `active` by hand.
  await c.env.DB.prepare(
    `UPDATE guards SET active = 0, device_token_hash = 'revoked:' || id WHERE id = ?`,
  ).bind(id).run()
  await audit.record(c.env, {
    ...actor(staff),
    action: 'gate.device_revoke',
    entity: 'guard',
    entityId: id,
    ip: clientIp(c),
  })
  return c.json({ ok: true })
})

/* ------------------------------------------------------------------ *
 * The gate
 * ------------------------------------------------------------------ */

async function admittedHere(env: Env, gateId: string, night: string): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT count(*) AS n FROM sticker_scans WHERE night = ? AND gate_id = ? AND ${LET_IN}`,
  ).bind(night, gateId).first<{ n: number }>()
  return row?.n ?? 0
}

stickers.get('/gate/me', async (c) => {
  const device = c.get('device')
  const night = festNight()
  await c.env.DB.prepare(`UPDATE guards SET last_seen_at = datetime('now') WHERE id = ?`).bind(device.id).run()
  return c.json({ name: device.name, gate: device.gateName, night, admittedHere: await admittedHere(c.env, device.gateId!, night) })
})

/**
 * Everything a gate needs to keep working when the network does not.
 *
 * Every live sticker with the name the guard checks against, and every one
 * already admitted tonight at any gate. The phone refreshes this while it is
 * online; offline, it decides from its last copy and queues what it admitted.
 * The one thing it cannot know offline is that another gate admitted the same
 * sticker since the last refresh, which is why it refreshes often and why the
 * server books those as duplicates when the queue lands.
 */
stickers.get('/gate/manifest', async (c) => {
  const night = festNight()
  const [live, entered] = await Promise.all([
    c.env.DB.prepare(
      `SELECT s.code, s.serial, r.name, r.college, r.gender
         FROM stickers s
         JOIN registrations r ON r.id = s.registration_id
         JOIN registration_tier t ON t.registration_id = s.registration_id
        WHERE s.status = 'active' AND t.tier = 1`,
    ).all<{ code: string; serial: number; name: string; college: string | null; gender: string | null }>(),
    c.env.DB.prepare(
      `SELECT DISTINCT sticker_code FROM sticker_scans WHERE night = ? AND ${LET_IN}`,
    ).bind(night).all<{ sticker_code: string }>(),
  ])
  return c.json({
    night,
    at: new Date().toISOString(),
    // Arrays rather than objects: this is downloaded every couple of minutes
    // on a concert's worth of congested mobile data.
    stickers: live.results.map((s) => [s.code, s.serial, s.name, s.college ?? '', s.gender ?? '']),
    entered: entered.results.map((e) => e.sticker_code),
  })
})

type Outcome = 'ok' | 'duplicate' | 'not_active' | 'void' | 'no_festival_pass' | 'unknown' | 'online_pass'

/**
 * One scan at a Star Night gate.
 *
 * The phone sends its own id for each scan. If the request is retried after
 * the server already admitted somebody (the response was lost on a bad
 * connection), the retry finds that row and answers "admitted" again instead
 * of turning the person it just let in into a red ALREADY ENTERED.
 *
 * A scan sent from the phone's offline queue carries the time it really
 * happened, and is booked to that night.
 */
stickers.post('/gate/scan', async (c) => {
  const device = c.get('device')
  const body = (await readJson(c)) as Record<string, unknown>
  const offline = body.offline === true
  const moment = offline ? scanMoment(body.clientScannedAt, body.clientNow) : new Date()
  const night = festNight(moment)
  const scanId = typeof body.scanId === 'string' && /^[0-9a-f-]{36}$/i.test(body.scanId)
    ? `scan_${body.scanId.toLowerCase()}`
    : newId()

  const prior = await c.env.DB.prepare('SELECT result, sticker_code, admitted_offline FROM sticker_scans WHERE id = ?')
    .bind(scanId)
    .first<{ result: Outcome; sticker_code: string | null; admitted_offline: number }>()

  // The phone gave up waiting on this very request, let the person in from
  // its own list, and is now sending it from its queue. The request did land
  // the first time, so the row exists; what it lacks is the fact that the
  // phone admitted them regardless of what the row says. Without this, a
  // copied pass admitted that way would be missing from "let in twice".
  if (prior && offline && !prior.admitted_offline) {
    await c.env.DB.prepare('UPDATE sticker_scans SET admitted_offline = 1 WHERE id = ?').bind(scanId).run()
  }

  const parsed = readScan(String(body.scan ?? ''))

  // The online pass identifies somebody at the desk. At the concert it would
  // let one Festival Pass in twice, once on the card and once on a phone.
  if (parsed.kind === 'online_pass') {
    return c.json({ outcome: 'online_pass' satisfies Outcome, night })
  }

  // Only admissions are queued, so a queued scan is somebody the phone already
  // let through. Whatever the server now decides, that person is inside.
  const record = (result: Outcome, code: string | null) =>
    c.env.DB.prepare(
      `INSERT OR IGNORE INTO sticker_scans
         (id, sticker_code, night, result, gate_id, guard_id, client_scanned_at, admitted_offline)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(scanId, code, night, result, device.gateId, device.id, moment.toISOString(), offline ? 1 : 0)

  const finish = async (outcome: Outcome, extra: Record<string, unknown> = {}) =>
    c.json({ outcome, night, admittedHere: await admittedHere(c.env, device.gateId!, night), ...extra })

  if (parsed.kind !== 'sticker') {
    if (!prior) await record('unknown', null).run()
    return finish('unknown')
  }

  const row = await c.env.DB.prepare(
    `SELECT s.code, s.serial, s.status, r.name, r.college, r.gender, r.public_code, t.tier
       FROM stickers s
       LEFT JOIN registrations r ON r.id = s.registration_id
       LEFT JOIN registration_tier t ON t.registration_id = s.registration_id
      WHERE s.code = ?`,
  ).bind(parsed.code).first<{
    code: string; serial: number; status: string; name: string | null; college: string | null
    gender: string | null; public_code: string | null; tier: number | null
  }>()

  if (!row) {
    if (!prior) await record('unknown', null).run()
    return finish('unknown')
  }

  const sticker = { serial: row.serial, label: serialLabel(row.serial) }
  const person = row.name
    ? { name: row.name, college: row.college, gender: row.gender, publicCode: row.public_code }
    : null

  const refuse = async (outcome: Outcome) => {
    if (!prior) await record(outcome, row.code).run()
    return finish(outcome, { sticker, person })
  }

  if (row.status === 'stock') return refuse('not_active')
  if (row.status === 'void') return refuse('void')
  // Refunded since it was activated.
  if (row.tier !== 1) return refuse('no_festival_pass')

  if (prior?.result === 'ok') return finish('ok', { sticker, person })

  let admitted = false
  if (!prior) {
    // The unique index on (sticker, night) for admitted scans is the rule: of
    // two gates scanning the same sticker at once, exactly one row lands.
    const res = await record('ok', row.code).run()
    admitted = (res.meta.changes ?? 0) === 1
  }
  if (admitted) return finish('ok', { sticker, person })

  const first = await c.env.DB.prepare(
    `SELECT ss.client_scanned_at, ss.guard_id, gt.name AS gate
       FROM sticker_scans ss LEFT JOIN gates gt ON gt.id = ss.gate_id
      WHERE ss.sticker_code = ? AND ss.night = ? AND ss.result = 'ok'`,
  ).bind(row.code, night).first<{ client_scanned_at: string; guard_id: string | null; gate: string | null }>()

  if (!prior) await record('duplicate', row.code).run()

  return finish('duplicate', {
    sticker,
    person,
    first: first
      ? { at: first.client_scanned_at, gate: first.gate, byThisPhone: first.guard_id === device.id }
      : null,
  })
})
