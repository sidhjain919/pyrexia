/**
 * Razorpay checkout launcher.
 *
 * With `VITE_RAZORPAY_KEY_ID` set (and a backend that creates real orders) this
 * opens the real checkout. Without it — the current state — it resolves a
 * clearly-labelled simulated payment so the whole flow stays testable.
 *
 * The handler response is NEVER proof of payment on its own. `api.confirmDelegatePayment`
 * must re-verify `razorpay_signature` server-side with the secret key before a
 * pass is marked confirmed.
 */

import type { PaymentOrder, PaymentResult } from './types'
import { RegistrationError } from './types'

const SDK = 'https://checkout.razorpay.com/v1/checkout.js'

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void }
  }
}

export const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined

/** True when a real gateway is wired up. Drives the "simulated payment" notice in the UI. */
export const paymentsAreLive = Boolean(RAZORPAY_KEY_ID)

let sdkPromise: Promise<void> | null = null

function loadSdk(): Promise<void> {
  if (window.Razorpay) return Promise.resolve()
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const el = document.createElement('script')
      el.src = SDK
      el.async = true
      el.onload = () => resolve()
      el.onerror = () => {
        sdkPromise = null
        reject(new RegistrationError('Could not reach the payment gateway.', 'network'))
      }
      document.head.appendChild(el)
    })
  }
  return sdkPromise
}

export type Prefill = { name: string; email: string; contact: string }

export async function payWithRazorpay(order: PaymentOrder, prefill: Prefill): Promise<PaymentResult> {
  const keyId = order.keyId ?? RAZORPAY_KEY_ID

  if (!keyId) {
    // No gateway configured — simulate a successful capture so the rest of the
    // journey (pass issue, QR, event entry) can be exercised end to end.
    await new Promise((r) => setTimeout(r, 1400))
    return {
      orderId: order.orderId,
      paymentId: `pay_simulated_${Math.random().toString(36).slice(2, 12)}`,
      signature: 'simulated',
    }
  }

  await loadSdk()
  if (!window.Razorpay) throw new RegistrationError('Payment gateway unavailable.', 'network')

  return new Promise<PaymentResult>((resolve, reject) => {
    const rz = new window.Razorpay!({
      key: keyId,
      order_id: order.orderId,
      amount: order.amount * 100, // paise
      currency: order.currency,
      name: 'PYREXIA 2026',
      description: 'Delegate Pass · AIIMS Rishikesh',
      prefill,
      theme: { color: '#c89b3c' },
      handler: (res: Record<string, string>) =>
        resolve({
          orderId: res.razorpay_order_id,
          paymentId: res.razorpay_payment_id,
          signature: res.razorpay_signature,
        }),
      modal: {
        ondismiss: () =>
          reject(new RegistrationError('Payment was cancelled before it completed.', 'payment_failed')),
      },
    })
    rz.open()
  })
}
