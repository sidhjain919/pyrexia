/**
 * Idempotency.
 *
 * The scenario this exists for: a student on a bad connection taps Register,
 * sees nothing happen, and taps again. Without this they get two registrations
 * and: once payment is wired up: a real chance of paying twice.
 *
 * A client sends `Idempotency-Key` with a value unique to that attempt. The
 * first request does the work and we store its response; a repeat of the same
 * key replays that stored response verbatim instead of doing the work again.
 *
 * The request body is hashed alongside the key, so reusing a key for a
 * *different* request is caught rather than silently answered with someone
 * else's result.
 */

import type { Env } from '../types.ts'
import { ApiError } from './http.ts'
import { sha256Hex } from './ids.ts'

export type StoredResponse = {
  statusCode: number
  body: unknown
}

export type IdempotencyCheck =
  /** Nothing stored: go do the work, then call `remember`. */
  | { state: 'fresh' }
  /** Seen before with the same body: replay this instead of working again. */
  | { state: 'replay'; response: StoredResponse }

/**
 * Keys are scoped per endpoint so the same key on two different routes cannot
 * collide. Only accepts a plausible key, an empty or absurd one is a client bug
 * worth surfacing rather than quietly ignoring.
 */
export function requireKey(header: string | undefined): string {
  const key = (header ?? '').trim()
  if (key.length < 8 || key.length > 200) {
    throw new ApiError(
      'bad_request',
      'This request needs an Idempotency-Key header of 8 to 200 characters.',
    )
  }
  return key
}

export async function check(
  env: Env,
  args: { key: string; endpoint: string; body: unknown },
): Promise<IdempotencyCheck> {
  const requestHash = await sha256Hex(JSON.stringify(args.body ?? null))

  const row = await env.DB.prepare(
    'SELECT request_hash, response_json, status_code FROM idempotency_keys WHERE key = ? AND endpoint = ?',
  )
    .bind(args.key, args.endpoint)
    .first<{ request_hash: string; response_json: string | null; status_code: number | null }>()

  if (!row) return { state: 'fresh' }

  if (row.request_hash !== requestHash) {
    throw new ApiError(
      'idempotency_mismatch',
      'That idempotency key was already used for a different request.',
    )
  }

  // Present but unfinished: the first attempt is still in flight, or died
  // partway. Telling the client to retry shortly is safer than racing it.
  if (row.response_json === null) {
    throw new ApiError('conflict', 'That request is still being processed. Try again in a moment.')
  }

  return {
    state: 'replay',
    response: { statusCode: row.status_code ?? 200, body: JSON.parse(row.response_json) },
  }
}

/**
 * Claim a key before doing any work.
 *
 * The INSERT is the lock: two concurrent requests race here, and the loser is
 * told to retry rather than both proceeding to create a registration.
 */
export async function claim(
  env: Env,
  args: { key: string; endpoint: string; body: unknown },
): Promise<void> {
  const requestHash = await sha256Hex(JSON.stringify(args.body ?? null))
  try {
    await env.DB.prepare(
      'INSERT INTO idempotency_keys (key, endpoint, request_hash) VALUES (?, ?, ?)',
    )
      .bind(args.key, args.endpoint, requestHash)
      .run()
  } catch {
    // The unique constraint fired: someone else claimed it microseconds ago.
    throw new ApiError('conflict', 'That request is already being processed.')
  }
}

export async function remember(
  env: Env,
  args: { key: string; endpoint: string; statusCode: number; body: unknown },
): Promise<void> {
  await env.DB.prepare(
    'UPDATE idempotency_keys SET response_json = ?, status_code = ? WHERE key = ? AND endpoint = ?',
  )
    .bind(JSON.stringify(args.body), args.statusCode, args.key, args.endpoint)
    .run()
}

/**
 * Release a claim that never produced a response.
 *
 * Called when the work throws, so a transient failure doesn't leave the student
 * permanently unable to retry with the same key.
 */
export async function release(env: Env, args: { key: string; endpoint: string }): Promise<void> {
  await env.DB.prepare(
    'DELETE FROM idempotency_keys WHERE key = ? AND endpoint = ? AND response_json IS NULL',
  )
    .bind(args.key, args.endpoint)
    .run()
}
