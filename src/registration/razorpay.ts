/**
 * Opening Razorpay Checkout.
 *
 * The key id and order id both come from our own server, never from anything
 * in this file. A browser that could choose its own order could choose its own
 * price, so this module's only job is to open a window someone else specified.
 *
 * What comes back is a claim, not a proof. It goes to `/api/checkout/verify`,
 * which checks the signature and lets the success screen stop spinning; the
 * pass itself is issued by Razorpay's webhook to our server. That's why a
 * browser closing at the wrong moment costs nobody their registration.
 */

import type { Checkout } from '../api/client'

const SDK = 'https://checkout.razorpay.com/v1/checkout.js'

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void }
  }
}

export type CheckoutResult = {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

export class PaymentCancelled extends Error {
  constructor() {
    super('Payment was cancelled before it completed.')
    this.name = 'PaymentCancelled'
  }
}

export class PaymentUnavailable extends Error {
  constructor(message = 'Could not reach the payment gateway.') {
    super(message)
    this.name = 'PaymentUnavailable'
  }
}

let sdkPromise: Promise<void> | null = null

function loadSdk(): Promise<void> {
  if (window.Razorpay) return Promise.resolve()
  if (!sdkPromise) {
    sdkPromise = new Promise<void>((resolve, reject) => {
      const el = document.createElement('script')
      el.src = SDK
      el.async = true
      el.onload = () => resolve()
      el.onerror = () => {
        // Clear the cache so a later attempt can retry rather than being stuck
        // on a promise that will never resolve.
        sdkPromise = null
        reject(new PaymentUnavailable())
      }
      document.head.appendChild(el)
    })
  }
  return sdkPromise
}

export async function openCheckout(checkout: Checkout): Promise<CheckoutResult> {
  await loadSdk()
  if (!window.Razorpay) throw new PaymentUnavailable()

  return new Promise<CheckoutResult>((resolve, reject) => {
    const rz = new window.Razorpay!({
      key: checkout.keyId,
      order_id: checkout.razorpayOrderId,
      // Already in paise, exactly as the server computed it.
      amount: checkout.amountPaise,
      currency: checkout.currency,
      name: 'PYREXIA 2026',
      description: 'Pirates of the Lost Island · AIIMS Rishikesh',
      image: `${window.location.origin}${import.meta.env.BASE_URL}favicon.svg`,
      prefill: {
        name: checkout.name,
        email: checkout.email,
        contact: checkout.phone,
      },
      notes: { publicSite: 'pyrexia-2026' },
      theme: { color: '#c89b3c', backdrop_color: '#071318' },
      handler: (res: Record<string, string>) =>
        resolve({
          razorpay_order_id: res.razorpay_order_id,
          razorpay_payment_id: res.razorpay_payment_id,
          razorpay_signature: res.razorpay_signature,
        }),
      modal: {
        // Someone closing the window is a normal thing to do, not an error
        // worth alarming them about: the order simply stays unpaid, and the
        // reconciliation sweep tidies it up a day later.
        ondismiss: () => reject(new PaymentCancelled()),
        escape: true,
      },
      retry: { enabled: true, max_count: 3 },
    })
    rz.open()
  })
}
