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
    // Private browsing, or storage disabled. Not fatal — they just can't stay
    // signed in between visits.
    return null
  }
}

export function setSession(token: string): void {
  try {
    localStorage.setItem(SESSION_KEY, token)
  } catch {
    /* ignore */
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
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

export type OrderCreated = {
  registrationId: string
  publicCode?: string
  orderId: string
  checkout: Checkout
  lines: { productId: string; name: string; amountPaise: number }[]
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
  account: {
    email: string
    name: string | null
    publicCode: string | null
    /** An account is not a registration. This says whether the ₹450 is paid. */
    hasRegistration: boolean
  }
}

export type EventInfo = {
  name: string
  tag: string
  territory: { code: string; name: string }
  open: boolean
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

  register: (input: RegistrationInput & { products: string[] }, idempotencyKey: string) =>
    request<OrderCreated>('/api/registrations', {
      method: 'POST',
      body: input,
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
   * This makes the success screen instant. It does not grant anything — the
   * webhook does that — so the UI still polls `orderStatus` until confirmed.
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
   * Creates the account but does *not* sign anyone in — an address has to be
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

  /** The one-tap link from a confirmation email — a convenience, not the front door. */
  consumeSignIn: (token: string) =>
    request<AuthResult>('/api/auth/consume', { method: 'POST', body: { token } }),

  signOut: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST', auth: true }),

  /** Answers 403 for anyone not in the admins table — the page uses it as the gate. */
  adminMe: () => request<{ email: string; name: string | null }>('/api/admin/me', { auth: true }),

  adminStats: () => request<AdminStats>('/api/admin/stats', { auth: true }),

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

  enterEvent: (payload: {
    eventName: string
    participation: 'solo' | 'team'
    teamName?: string
    answers: Record<string, string>
  }) => request<{ entryId: string; eventName: string }>('/api/me/events', {
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
      // Keep trying — a blip here shouldn't end the wait.
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return false
}

/**
 * Download one of the CSV sheets.
 *
 * A plain link cannot carry the session header, and the export routes are
 * behind the admin check — so the file is fetched, then handed to the browser
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
