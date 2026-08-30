/**
 * Pricing.
 *
 * Every amount in the system originates here, read from the `products` table.
 * A request says which products it wants; it never says what they cost. This is
 * the difference between a payment system and a suggestion box.
 */

import type { Env } from '../types.ts'

export type Product = {
  id: string
  name: string
  amount_paise: number
  requires: string | null
  active: number
  sort_order: number
}

export type QuoteLine = { productId: string; name: string; amountPaise: number }

export type Quote = {
  lines: QuoteLine[]
  /** The line items alone. */
  subtotalPaise: number
  /** Added on top and charged to the payer. Grants nothing. */
  conveniencePaise: number
  /** What Razorpay is actually asked for. */
  totalPaise: number
}

/**
 * The payment gateway's cut, passed on to the payer.
 *
 * Razorpay takes 2% of the transaction and 18% GST on that fee, which is
 * 2.36% all in. The fest is run on a fixed budget and used to absorb this out
 * of the registration income; from 2026 it is added on top and shown as its
 * own line so nobody is surprised by the number on their statement.
 *
 * Basis points, so the arithmetic stays in integers all the way to Razorpay.
 * Change it here and every surface follows.
 */
export const CONVENIENCE_BPS = 236

export const CONVENIENCE_LABEL = 'Payment gateway charges'

/** Rounded up, so a rounding remainder is never taken out of the fest's share. */
export function conveniencePaise(subtotalPaise: number): number {
  return Math.ceil((subtotalPaise * CONVENIENCE_BPS) / 10000)
}

export type QuoteFailure =
  | { code: 'unknown_product'; productId: string }
  | { code: 'inactive_product'; productId: string }
  | { code: 'duplicate_product'; productId: string }
  /** Already owned: an upgrade must not re-sell what they hold. */
  | { code: 'already_owned'; productId: string }
  /** e.g. asking for `delegate` with no `basic` held and none in the order. */
  | { code: 'missing_prerequisite'; productId: string; requires: string }
  | { code: 'empty_order' }

export type QuoteResult =
  | { ok: true; quote: Quote }
  | { ok: false; failure: QuoteFailure }

export async function loadProducts(env: Env): Promise<Map<string, Product>> {
  const { results } = await env.DB.prepare(
    'SELECT id, name, amount_paise, requires, active, sort_order FROM products ORDER BY sort_order',
  ).all<Product>()
  return new Map(results.map((p) => [p.id, p]))
}

/**
 * Build a priced quote, or explain exactly why it can't be built.
 *
 * `owned` is the set of product ids the registration already holds live
 * entitlements for: empty for a first-time signup, `{'basic'}` for someone
 * coming back to add the Festival Pass.
 */
export function quote(
  requested: readonly string[],
  products: Map<string, Product>,
  owned: ReadonlySet<string> = new Set(),
): QuoteResult {
  if (requested.length === 0) return { ok: false, failure: { code: 'empty_order' } }

  const seen = new Set<string>()
  for (const id of requested) {
    if (seen.has(id)) return { ok: false, failure: { code: 'duplicate_product', productId: id } }
    seen.add(id)
  }

  const lines: QuoteLine[] = []

  for (const id of requested) {
    const product = products.get(id)
    if (!product) return { ok: false, failure: { code: 'unknown_product', productId: id } }
    if (!product.active) return { ok: false, failure: { code: 'inactive_product', productId: id } }
    if (owned.has(id)) return { ok: false, failure: { code: 'already_owned', productId: id } }

    // The prerequisite may be satisfied either by something already owned or by
    // something else in this same order: a first-time Delegate buys both at once.
    if (product.requires && !owned.has(product.requires) && !seen.has(product.requires)) {
      return {
        ok: false,
        failure: { code: 'missing_prerequisite', productId: id, requires: product.requires },
      }
    }

    lines.push({ productId: id, name: product.name, amountPaise: product.amount_paise })
  }

  // Keep the order stable regardless of how the request happened to be ordered,
  // so the receipt always reads Basic first.
  lines.sort(
    (a, b) => (products.get(a.productId)!.sort_order) - (products.get(b.productId)!.sort_order),
  )

  const subtotalPaise = lines.reduce((sum, l) => sum + l.amountPaise, 0)
  const convenience = conveniencePaise(subtotalPaise)

  return {
    ok: true,
    quote: {
      lines,
      subtotalPaise,
      conveniencePaise: convenience,
      totalPaise: subtotalPaise + convenience,
    },
  }
}

/** Product ids this registration currently holds. */
export async function ownedProducts(env: Env, registrationId: string): Promise<Set<string>> {
  const { results } = await env.DB.prepare(
    'SELECT product_id FROM entitlements WHERE registration_id = ? AND revoked_at IS NULL',
  )
    .bind(registrationId)
    .all<{ product_id: string }>()
  return new Set(results.map((r) => r.product_id))
}

/** Rupees for display. Never used for arithmetic. */
export function formatPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`
}
