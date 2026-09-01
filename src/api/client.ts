/**
 * The API client.
 *
 * Everything the site knows about the backend goes through here. Two things it
 * takes care of that are easy to get wrong scattered across components:
 *
 * **Idempotency keys.** Any request that could take money carries one, so a
 * student double-tapping Register on a slow connection gets the same order back
 * rather than a second charge. The key is generated once per attempt and reused
 * across retries of that same attempt.
 *
 * **The session token.** Kept in localStorage rather than a cookie, because the
 * site and the API sit on different domains today and Safari drops third-party
 * cookies. Once both live under one domain this moves to an httpOnly cookie,
 * which the backend already supports.
 */

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ??
  'https://pyrexia-api.pyrexia-api.workers.dev'

const SESSION_KEY = 'pyrexia.session'
const ACCOUNT_KEY = 'pyrexia.account'

/* ------------------------------------------------------------------ *
 * Admin
 * ------------------------------------------------------------------ */

export type AdminStats = {
  accounts: number
  registered: number
  basicOnly: number
  delegates: number
  eventEntries: number
  passes: number
  stuckPayments: number
  collectedPaise: number
  feesPaise: number
  netPaise: number
  daily: { day: string; n: number }[]
  colleges: { college: string; n: number }[]
  topEvents: { event_name: string; n: number }[]
}

export type MyDocument = {
  id: string
  kind: 'aadhaar' | 'student_id' | 'photo'
  mime: string
  sizeBytes: number
  uploadedAt: string
}

export type Notice = {
  id: string
  slug: string
  title: string
  body: string
  category: 'announcement' | 'schedule' | 'result' | 'urgent'
  pinned: boolean
  publishAt: string
  expiresAt: string | null
  published: boolean
  updatedAt: string
}

export type NoticeInput = {
  title: string
  body: string
  category: Notice['category']
  pinned: boolean
  published: boolean
  expiresAt?: string | null
}

export type AdminRow = {
  id: string
  publicCode: string
  name: string | null
  email: string
  phone: string | null
  college: string | null
  course: string | null
  year: string | null
  status: string
  verification: string
  tier: 0 | 1
  entries: number
  paidPaise: number
  createdAt: string
}

/* ------------------------------------------------------------------ *
 * Session
 * ------------------------------------------------------------------ */

export function getSession(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY)
  } catch {
    // Private browsing, or storage disabled. Not fatal, they just can't stay
    // signed in between visits.
    return null
  }
}

/**
 * Who is signed in, for display only.
 *
 * The server is still the authority on everything that matters; this is the
 * name in the header and nothing else. Stored alongside the token so the
 * header can greet someone on first paint rather than after a round trip.
 */
export type Account = {
  email: string
  name: string | null
  publicCode: string | null
  hasRegistration: boolean
}

export function getAccount(): Account | null {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY)
    return raw ? (JSON.parse(raw) as Account) : null
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ *
 * Auth as something you can subscribe to
 * ------------------------------------------------------------------ *
 *
 * Reading the token once per mount was wrong in the one case that matters:
 * signing out navigates, and navigating does not remount the header, so it
 * went on offering My Pass to somebody who no longer had one. The state now
 * lives in a tiny store every surface reads from, and every write to it tells
 * the subscribers.
 */

export type AuthState = { signedIn: boolean; account: Account | null }

let snapshot: AuthState = { signedIn: !!getSession(), account: getAccount() }
const listeners = new Set<() => void>()

function refresh(): void {
  const signedIn = !!getSession()
  const account = getAccount()
  // A new object every time would make useSyncExternalStore loop forever.
  if (
    signedIn === snapshot.signedIn &&
    account?.email === snapshot.account?.email &&
    account?.name === snapshot.account?.name &&
    account?.hasRegistration === snapshot.account?.hasRegistration
  ) {
    return
  }
  snapshot = { signedIn, account }
  for (const listener of listeners) listener()
}

export function subscribeAuth(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function authSnapshot(): AuthState {
  return snapshot
}

// Signing out in one tab should sign out in the others.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === SESSION_KEY || e.key === ACCOUNT_KEY || e.key === null) refresh()
  })
}

export function setSession(token: string, account?: Account | null): void {
  try {
    localStorage.setItem(SESSION_KEY, token)
    if (account) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account))
  } catch {
    /* ignore */
  }
  refresh()
}

/** Update the cached display name without touching the session. */
export function rememberAccount(account: Partial<Account>): void {
  try {
    const merged = { ...(getAccount() ?? {}), ...account } as Account
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(merged))
  } catch {
    /* ignore */
  }
  refresh()
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY)
    localStorage.removeItem(ACCOUNT_KEY)
  } catch {
    /* ignore */
  }
  refresh()
}

/* ------------------------------------------------------------------ *
 * Errors
 * ------------------------------------------------------------------ */

export type FieldErrors = Record<string, string>

export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly fields?: FieldErrors
  /** e.g. a suggested email correction, or the public code of an existing registration. */
  readonly extra: Record<string, unknown>

  constructor(
    message: string,
    code: string,
    status: number,
    fields?: FieldErrors,
    extra: Record<string, unknown> = {},
  ) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.fields = fields
    this.extra = extra
  }
}

/* ------------------------------------------------------------------ *
 * Fetch
 * ------------------------------------------------------------------ */

type Options = {
  method?: string
  body?: unknown
  /** Sends the session token. */
  auth?: boolean
  idempotencyKey?: string
}

async function request<T>(path: string, options: Options = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  if (options.auth) {
    const token = getSession()
    if (token) headers.Authorization = `Bearer ${token}`
  }
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey

  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiError(
      'Could not reach the island. Check your connection and try again.',
      'network',
      0,
    )
  }

  const text = await res.text()
  let payload: unknown
  try {
    payload = text ? JSON.parse(text) : {}
  } catch {
    payload = {}
  }

  if (!res.ok) {
    const err = (payload as { error?: Record<string, unknown> }).error ?? {}
    const { code, message, fields, ...extra } = err as {
      code?: string
      message?: string
      fields?: FieldErrors
    }
    throw new ApiError(
      message ?? 'Something went wrong on the crossing.',
      code ?? 'unknown',
      res.status,
      fields,
      extra as Record<string, unknown>,
    )
  }

  return payload as T
}

/** A fresh key per checkout attempt. Reused if that attempt is retried. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID()
}

/* ------------------------------------------------------------------ *
 * Shapes
 * ------------------------------------------------------------------ */

export type Product = {
  id: string
  name: string
  amountPaise: number
  requires: string | null
}

export type Checkout = {
  keyId: string
  razorpayOrderId: string
  amountPaise: number
  currency: string
  name: string
  email: string
  phone: string
}

export type EventEntryCreated = {
  entryId: string
  eventName: string
  participation: 'solo' | 'team'
  /** Present only when the event charges. */
  orderId?: string
  checkout: Checkout | null
  subtotalPaise?: number
  conveniencePaise?: number
  totalPaise?: number
  feeLabel?: string
}

export type OrderCreated = {
  registrationId: string
  publicCode?: string
  orderId: string
  checkout: Checkout
  lines: { productId: string; name: string; amountPaise: number }[]
  /** The line items alone, before the gateway's cut. */
  subtotalPaise: number
  /** Added on top and charged to the payer. */
  conveniencePaise: number
  totalPaise: number
}

export type Me = {
  publicCode: string
  name: string
  email: string
  phone: string
  college: string
  city: string
  course: string
  year: string
  tier: 0 | 1
  tierName: string
  owns: string[]
  available: { id: string; name: string; amountPaise: number }[]
  verification: { state: string; note: string | null }
  hasRegistration: boolean
  hasPass: boolean
  entries: {
    eventName: string
    territoryCode: string
    participation: string
    teamName: string | null
    enteredAt: string
  }[]
}

export type PassView = {
  token: string
  passId: string
  publicCode: string
  name: string
  college: string
  tier: 0 | 1
  tierName: string
}

export type RegistrationInput = {
  name: string
  phone: string
  gender: string
  college: string
  city: string
  course: string
  year: string
  emergencyName: string
  emergencyPhone: string
}

/* ------------------------------------------------------------------ *
 * Endpoints
 * ------------------------------------------------------------------ */

export type AuthResult = {
  token: string
  /** An account is not a registration: `hasRegistration` says whether the ₹500 is paid. */
  account: Account
}

/** One price band for an event. `standard` when everyone pays the same. */
export type FeeVariant = { id: string; label: string; amountPaise: number }

export type EventInfo = {
  name: string
  tag: string
  territory: { code: string; name: string }
  open: boolean
  /** null when the event costs nothing to enter. */
  fee: { unit: 'person' | 'team'; variants: FeeVariant[] } | null
  form: {
    participation: string
    teamSize: { min: number; max: number } | null
    fields: { id: string; label: string; type: string; required?: boolean; options?: string[]; placeholder?: string; help?: string }[]
    note: string | null
    allowsTeam: boolean
    requiresTeam: boolean
  }
  signedIn: boolean
  eligible: boolean
  entered: boolean
}

export const api = {
  products: () => request<{ products: Product[] }>('/api/products').then((r) => r.products),

  /** 'test' means the gateway takes no money. The site says so, loudly. */
  paymentMode: () =>
    request<{ paymentMode: 'test' | 'live' }>('/api/config').then((r) => r.paymentMode),

  /**
   * `auth: true` is not optional here.
   *
   * `POST /registrations` requires a session — it fills in the detail columns
   * on the row that signing up already created, and it reads the email off the
   * session rather than the form. Without the bearer token the server saw an
   * anonymous request and answered "Sign in or create an account to register",
   * which is what everybody hit on the last step of checkout while plainly
   * signed in.
   */
  register: (input: RegistrationInput & { products: string[] }, idempotencyKey: string) =>
    request<OrderCreated>('/api/registrations', {
      method: 'POST',
      body: input,
      auth: true,
      idempotencyKey,
    }),

  upgrade: (_ignored: string, products: string[], idempotencyKey: string) =>
    request<OrderCreated>('/api/me/upgrade', {
      method: 'POST',
      body: { products },
      auth: true,
      idempotencyKey,
    }),

  /**
   * Tell the server the browser saw a successful payment.
   *
   * This makes the success screen instant. It does not grant anything, the
   * webhook does that: so the UI still polls `orderStatus` until confirmed.
   */
  verifyCheckout: (payload: {
    razorpay_order_id: string
    razorpay_payment_id: string
    razorpay_signature: string
  }) =>
    request<{ verified: boolean; registrationId: string; publicCode: string; confirmed: boolean }>(
      '/api/checkout/verify',
      { method: 'POST', body: payload },
    ),

  orderStatus: (orderId: string) =>
    request<{ orderId: string; status: string; confirmed: boolean; tier: 0 | 1 }>(
      `/api/orders/${orderId}/status`,
    ),

  /**
   * Creates the account but does *not* sign anyone in, an address has to be
   * proved before it can be paid from, because the pass arrives by email and a
   * typo means someone pays and never receives what they bought.
   */
  signUp: (email: string, password: string) =>
    request<{ verificationRequired: true; email: string; expiresInMinutes: number }>(
      '/api/auth/signup',
      { method: 'POST', body: { email, password } },
    ),

  verifyEmail: (email: string, code: string) =>
    request<AuthResult>('/api/auth/verify', { method: 'POST', body: { email, code } }),

  resendCode: (email: string) =>
    request<{ sent: boolean; expiresInMinutes: number }>('/api/auth/resend', {
      method: 'POST',
      body: { email },
    }),

  /** The ID token from Google's button. The server does every check on it. */
  googleSignIn: (credential: string) =>
    request<AuthResult>('/api/auth/google', { method: 'POST', body: { credential } }),

  signIn: (email: string, password: string) =>
    request<AuthResult>('/api/auth/login', { method: 'POST', body: { email, password } }),

  forgotPassword: (email: string) =>
    request<{ sent: boolean; message: string; devToken?: string }>('/api/auth/forgot', {
      method: 'POST',
      body: { email },
    }),

  resetPassword: (token: string, password: string) =>
    request<AuthResult>('/api/auth/reset', { method: 'POST', body: { token, password } }),

  /** The one-tap link from a confirmation email: a convenience, not the front door. */
  consumeSignIn: (token: string) =>
    request<AuthResult>('/api/auth/consume', { method: 'POST', body: { token } }),

  signOut: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST', auth: true }),

  /** Answers 403 for anyone not in the admins table, the page uses it as the gate. */
  adminMe: () => request<{ email: string; name: string | null }>('/api/admin/me', { auth: true }),

  adminStats: () => request<AdminStats>('/api/admin/stats', { auth: true }),

  /** Published, unexpired notices. No session needed, this is the public board. */
  notices: () => request<{ notices: Notice[] }>('/api/notices'),

  myDocuments: () =>
    request<{
      verification: 'unsubmitted' | 'pending' | 'approved' | 'rejected'
      note: string | null
      documents: MyDocument[]
    }>('/api/me/documents', { auth: true }),

  deleteDocument: (id: string) =>
    request<{ ok: boolean }>(`/api/me/documents/${id}`, { method: 'DELETE', auth: true }),

  /** Everything including drafts. */
  adminNotices: () => request<{ notices: Notice[] }>('/api/admin/notices', { auth: true }),

  createNotice: (input: NoticeInput) =>
    request<{ id: string }>('/api/admin/notices', { method: 'POST', body: input, auth: true }),

  updateNotice: (id: string, input: NoticeInput) =>
    request<{ ok: boolean }>(`/api/admin/notices/${id}`, {
      method: 'PATCH',
      body: input,
      auth: true,
    }),

  deleteNotice: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/notices/${id}`, { method: 'DELETE', auth: true }),

  adminRegistrations: (query: { q?: string; limit?: number; offset?: number } = {}) => {
    const params = new URLSearchParams()
    if (query.q) params.set('q', query.q)
    params.set('limit', String(query.limit ?? 25))
    params.set('offset', String(query.offset ?? 0))
    return request<{ total: number; offset: number; limit: number; rows: AdminRow[] }>(
      `/api/admin/registrations?${params}`,
      { auth: true },
    )
  },

  adminRegistration: (id: string) =>
    request<Record<string, unknown>>(`/api/admin/registrations/${id}`, { auth: true }),

  adminFixEmail: (id: string, email: string) =>
    request<{ ok: boolean; email: string }>(`/api/admin/registrations/${id}/email`, {
      method: 'POST',
      body: { email },
      auth: true,
    }),

  adminResend: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/registrations/${id}/resend`, {
      method: 'POST',
      auth: true,
    }),

  me: () => request<Me>('/api/me', { auth: true }),

  pass: () => request<PassView>('/api/me/pass', { auth: true }),

  event: (name: string) =>
    request<EventInfo>(`/api/events/${encodeURIComponent(name)}`, { auth: true }),

  /**
   * Enter one event.
   *
   * A free event comes back with `checkout: null` and the entry is already
   * made. A paid one comes back with a Razorpay order: the entry exists but is
   * pending until the webhook lands, so the caller opens checkout and then
   * waits on `orderStatus`.
   */
  enterEvent: (payload: {
    eventName: string
    participation: 'solo' | 'team'
    teamName?: string
    feeVariant?: string
    answers: Record<string, string>
  }) =>
    request<EventEntryCreated>('/api/me/events', {
      method: 'POST',
      body: payload,
      auth: true,
    }),
}

/** True when a session token is stored. Cheap enough to call on every render. */
export function isSignedIn(): boolean {
  return !!getSession()
}

/**
 * Wait for the webhook to land.
 *
 * After Razorpay's window closes, the pass is issued by a server-to-server call
 * that usually arrives within a second or two but is not instant. Polling here
 * keeps the student on a "confirming…" screen rather than showing them a
 * half-finished account.
 */
export async function waitForConfirmation(
  orderId: string,
  { attempts = 20, intervalMs = 1500 } = {},
): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    try {
      const status = await api.orderStatus(orderId)
      if (status.confirmed) return true
      if (status.status === 'failed' || status.status === 'expired') return false
    } catch {
      // Keep trying: a blip here shouldn't end the wait.
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return false
}

/**
 * Download one of the CSV sheets.
 *
 * A plain link cannot carry the session header, and the export routes are
 * behind the admin check: so the file is fetched, then handed to the browser
 * as a blob. The object URL is revoked straight after; without that, every
 * download in a long admin session stays in memory until the tab closes.
 */
export async function downloadCsv(path: string, filename: string): Promise<void> {
  const token = getSession()
  const res = await fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

  if (!res.ok) {
    throw new ApiError(
      res.status === 403 ? 'You do not have access to this.' : 'That export failed.',
      res.status === 403 ? 'forbidden' : 'internal',
      res.status,
    )
  }

  const url = URL.createObjectURL(await res.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/**
 * Upload one identity document.
 *
 * Sent as the raw body rather than multipart: there is exactly one file, the
 * server needs its bytes and its type and nothing else, and a form boundary
 * would only be something else to parse. The kind travels in the query string
 * because the body is entirely the file.
 */
export async function uploadDocument(
  kind: MyDocument['kind'],
  file: File,
): Promise<{ id: string }> {
  const token = getSession()
  const params = new URLSearchParams({ kind, filename: file.name.slice(0, 120) })

  const res = await fetch(`${BASE}/api/me/documents?${params}`, {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: file,
  })

  const body = (await res.json().catch(() => ({}))) as {
    id?: string
    error?: { code?: string; message?: string }
  }

  if (!res.ok) {
    throw new ApiError(
      body.error?.message ?? 'That upload failed.',
      body.error?.code ?? 'internal',
      res.status,
    )
  }

  return { id: body.id ?? '' }
}
