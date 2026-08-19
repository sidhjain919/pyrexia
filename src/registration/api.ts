/**
 * THE SWAP POINT.
 *
 * Every screen talks to `api`, and nothing else knows how registrations are
 * stored or how money moves. To go live, write a second object with the same
 * `RegistrationApi` shape against Supabase / Firebase / your own server and
 * change the single export at the bottom of this file. No component changes.
 *
 * What the real implementation MUST do server-side, and this mock deliberately
 * only pretends to do:
 *   - decide the amount (never trust a client-supplied price)
 *   - create the Razorpay order with the secret key
 *   - verify `razorpay_signature` with HMAC-SHA256 before marking a pass paid
 *   - store Aadhaar / student-ID files in a PRIVATE bucket, admin-read only,
 *     served through short-lived signed URLs — never public objects
 *   - mint the QR payload as a signed token the scanner can verify offline
 */

import { DELEGATE_PASSES } from '../data/registration'
import {
  RegistrationError,
  type Delegate,
  type DelegateInput,
  type DocumentKind,
  type DocumentRef,
  type EventEntry,
  type EventEntryInput,
  type PaymentOrder,
  type PaymentResult,
} from './types'

export interface RegistrationApi {
  /** Look a delegate up by pass number, email or phone. Returns null when there's no match. */
  findDelegate(query: { delegateId?: string; email?: string; phone?: string }): Promise<Delegate | null>
  /** Store an uploaded identity document and return the reference to attach to the application. */
  uploadDocument(file: File, kind: DocumentKind): Promise<DocumentRef>
  /** Create the pending delegate record and the payment order to pay for it. */
  createDelegate(input: DelegateInput): Promise<{ delegate: Delegate; order: PaymentOrder }>
  /** Verify the payment and flip the pass to `confirmed`. */
  confirmDelegatePayment(delegateId: string, payment: PaymentResult): Promise<Delegate>
  /** Enter a confirmed delegate into one event. */
  registerForEvent(input: EventEntryInput): Promise<EventEntry>
  /** Everything this delegate has already entered — used to block double entries. */
  listEntries(delegateId: string): Promise<EventEntry[]>
}

/* ------------------------------------------------------------------ *
 * Mock adapter — localStorage, no network, no money
 * ------------------------------------------------------------------ */

const KEY_DELEGATES = 'pyrexia26.delegates'
const KEY_ENTRIES = 'pyrexia26.entries'
const KEY_DOCS = 'pyrexia26.documents'

/** Ambient hint that nothing here is real, surfaced in the UI. */
export const IS_MOCK_BACKEND = true

function read<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T[]) : []
  } catch {
    return []
  }
}

function write<T>(key: string, rows: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(rows))
  } catch {
    /* private mode / quota — the mock just forgets */
  }
}

/** Crockford-ish base32, no vowels, so a pass number can't spell anything and can't be misread. */
const ALPHABET = '0123456789BCDFGHJKLMNPQRSTVWXYZ'
function code(len: number) {
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

const norm = (s: string) => s.trim().toLowerCase()

export const mockApi: RegistrationApi = {
  async findDelegate(query) {
    await wait(450)
    const rows = read<Delegate>(KEY_DELEGATES)
    const id = query.delegateId ? norm(query.delegateId) : null
    const email = query.email ? norm(query.email) : null
    const phone = query.phone ? query.phone.replace(/\D/g, '') : null
    return (
      rows.find(
        (d) =>
          (id && norm(d.delegateId) === id) ||
          (email && norm(d.email) === email) ||
          (phone && d.phone.replace(/\D/g, '') === phone),
      ) ?? null
    )
  },

  async uploadDocument(file, kind) {
    await wait(700)
    if (file.size > 8 * 1024 * 1024) {
      throw new RegistrationError('That file is over 8 MB — please compress it.', 'upload_failed')
    }
    const ref: DocumentRef = {
      ref: `mock://${kind}/${code(10)}`,
      filename: file.name,
      size: file.size,
      mime: file.type,
    }
    // Metadata only. The mock never persists the file bytes — an identity
    // document has no business sitting in localStorage.
    write(KEY_DOCS, [...read<DocumentRef>(KEY_DOCS), ref])
    return ref
  },

  async createDelegate(input) {
    await wait(600)
    const rows = read<Delegate>(KEY_DELEGATES)
    const clash = rows.find(
      (d) =>
        d.status === 'confirmed' &&
        (norm(d.email) === norm(input.email) || d.phone.replace(/\D/g, '') === input.phone.replace(/\D/g, '')),
    )
    if (clash) {
      throw new RegistrationError(
        `A confirmed pass already exists for that email or phone (${clash.delegateId}).`,
        'duplicate',
      )
    }

    const pass = DELEGATE_PASSES.find((p) => p.id === input.passId)
    if (!pass) throw new RegistrationError('Unknown pass type.', 'not_found')

    const delegateId = `PYX26-${code(6)}`
    const delegate: Delegate = {
      ...input,
      delegateId,
      status: 'pending_payment',
      createdAt: new Date().toISOString(),
      amount: pass.amount,
      // The real backend signs this. Anything unsigned is trivially forgeable,
      // so the scanner must verify, not just parse.
      qrPayload: `PYREXIA26|${delegateId}|${input.passId}|mock`,
    }
    write(KEY_DELEGATES, [...rows, delegate])

    return {
      delegate,
      order: { orderId: `order_mock_${code(12)}`, amount: pass.amount, currency: 'INR' },
    }
  },

  async confirmDelegatePayment(delegateId, payment) {
    await wait(500)
    const rows = read<Delegate>(KEY_DELEGATES)
    const i = rows.findIndex((d) => d.delegateId === delegateId)
    if (i < 0) throw new RegistrationError('That pass is no longer on the manifest.', 'not_found')
    rows[i] = {
      ...rows[i],
      status: 'confirmed',
      paidAt: new Date().toISOString(),
      qrPayload: `PYREXIA26|${delegateId}|${rows[i].passId}|${payment.paymentId}`,
    }
    write(KEY_DELEGATES, rows)
    return rows[i]
  },

  async registerForEvent(input) {
    await wait(600)
    const delegate = await mockApi.findDelegate({ delegateId: input.delegateId })
    if (!delegate) throw new RegistrationError('No pass found for that number.', 'not_found')
    if (delegate.status !== 'confirmed') {
      throw new RegistrationError(
        'That pass has not been paid for yet — complete the delegate payment first.',
        'not_confirmed',
      )
    }

    const rows = read<EventEntry>(KEY_ENTRIES)
    if (rows.some((e) => e.delegateId === input.delegateId && e.eventName === input.eventName)) {
      throw new RegistrationError(`You're already entered for ${input.eventName}.`, 'duplicate')
    }

    const entry: EventEntry = {
      ...input,
      entryId: `ENT-${code(8)}`,
      createdAt: new Date().toISOString(),
    }
    write(KEY_ENTRIES, [...rows, entry])
    return entry
  },

  async listEntries(delegateId) {
    await wait(250)
    return read<EventEntry>(KEY_ENTRIES).filter((e) => e.delegateId === delegateId)
  },
}

/** Swap this line for the real adapter when the backend is live. */
export const api: RegistrationApi = mockApi
