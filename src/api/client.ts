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
  email: string
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

export const api = {
  products: () => request<{ products: Product[] }>('/api/products').then((r) => r.products),

  register: (input: RegistrationInput & { products: string[] }, idempotencyKey: string) =>
    request<OrderCreated>('/api/registrations', {
      method: 'POST',
      body: input,
      idempotencyKey,
    }),

  upgrade: (registrationId: string, products: string[], idempotencyKey: string) =>
    request<OrderCreated>(`/api/registrations/${registrationId}/upgrade`, {
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

  requestSignIn: (identifier: string) =>
    request<{ sent: boolean; message: string; devToken?: string }>('/api/auth/request', {
      method: 'POST',
      body: { identifier },
    }),

  consumeSignIn: (token: string) =>
    request<{ token: string; registrationId: string }>('/api/auth/consume', {
      method: 'POST',
      body: { token },
    }),

  signOut: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST', auth: true }),

  me: () => request<Me>('/api/me', { auth: true }),

  pass: () => request<PassView>('/api/me/pass', { auth: true }),
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
