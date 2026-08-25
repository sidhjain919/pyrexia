/**
 * HTTP helpers.
 *
 * One rule runs through this file: an error a person will read says what went
 * wrong and what to do about it, while an error a machine will read carries a
 * stable `code`. Internal detail — SQL, stack traces, secrets — never crosses
 * the boundary.
 */

import type { Context } from 'hono'

export type ErrorCode =
  | 'bad_request'
  | 'validation_failed'
  | 'not_found'
  | 'conflict'
  | 'already_registered'
  | 'payment_required'
  | 'unauthorised'
  | 'forbidden'
  | 'rate_limited'
  | 'idempotency_mismatch'
  | 'upstream_failed'
  | 'internal'

const STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  validation_failed: 422,
  not_found: 404,
  conflict: 409,
  already_registered: 409,
  payment_required: 402,
  unauthorised: 401,
  forbidden: 403,
  rate_limited: 429,
  idempotency_mismatch: 409,
  upstream_failed: 502,
  internal: 500,
}

export class ApiError extends Error {
  readonly code: ErrorCode
  readonly fields?: Record<string, string>
  readonly extra?: Record<string, unknown>

  constructor(
    code: ErrorCode,
    message: string,
    opts: { fields?: Record<string, string>; extra?: Record<string, unknown> } = {},
  ) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.fields = opts.fields
    this.extra = opts.extra
  }

  get status(): number {
    return STATUS[this.code]
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.fields ? { fields: this.fields } : {}),
        ...(this.extra ?? {}),
      },
    }
  }
}

/** Read a JSON body without letting a malformed one become a 500. */
export async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json()
  } catch {
    throw new ApiError('bad_request', 'Expected a JSON body.')
  }
}

/**
 * The raw request body, as text.
 *
 * Webhook signatures are computed over the exact bytes that were sent, so the
 * raw string must be kept and reused — never re-serialised from a parsed object.
 */
export async function readRaw(c: Context): Promise<string> {
  return await c.req.text()
}

export function clientIp(c: Context): string {
  return (
    c.req.header('CF-Connecting-IP') ??
    c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'unknown'
  )
}
