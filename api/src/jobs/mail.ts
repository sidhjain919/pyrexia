/**
 * The queue consumer.
 *
 * Everything slow lives here rather than inside a request a student is waiting
 * on. A registration handler writes a row and returns; the email leaves a
 * moment later, and a provider having a bad afternoon delays a message instead
 * of failing a payment.
 *
 * Retries are handled by the queue, not by loops in here: `message.retry()`
 * hands it back with backoff, up to the `max_retries` in wrangler.toml, after
 * which it lands in the dead-letter queue where a human can look at it.
 */

import type { Env, Job } from '../types.ts'
import { mailer } from '../lib/mail.ts'
import { createLoginToken } from '../lib/session.ts'
import * as templates from '../lib/templates.ts'

/** Where the site lives, for links inside emails. */
function siteUrl(env: Env): string {
  return (env.SITE_URL || 'https://sidhjain919.github.io/pyrexia').replace(/\/$/, '')
}

/**
 * A link that both signs someone in and lands them where they wanted to go.
 *
 * This is the whole passwordless design in one function: the confirmation email
 * carries a working sign-in, so the common path never involves typing anything.
 */
async function deepLink(env: Env, registrationId: string, path: string): Promise<string> {
  const token = await createLoginToken(env, registrationId, 'pass_link')
  return `${siteUrl(env)}/enter?token=${encodeURIComponent(token)}&next=${encodeURIComponent(path)}`
}

export async function handleJob(env: Env, job: Job): Promise<void> {
  const send = mailer(env)

  switch (job.kind) {
    case 'email.registration_confirmed': {
      // Describe *this* order, not the running total. Someone adding the
      // Delegate Card in October paid ₹2,250 today; telling them we received
      // ₹2,700 reads like they were charged twice.
      const row = await env.DB.prepare(
        `SELECT r.name, r.email, r.public_code, o.amount_paise,
                (SELECT group_concat(product_id) FROM order_items i
                  WHERE i.order_id = o.id) AS products,
                (SELECT count(*) FROM orders prev
                  WHERE prev.registration_id = r.id
                    AND prev.status = 'paid'
                    AND prev.paid_at < o.paid_at) AS earlier_orders
           FROM registrations r JOIN orders o ON o.id = ?
          WHERE r.id = ?`,
      )
        .bind(job.orderId, job.registrationId)
        .first<{
          name: string
          email: string
          public_code: string
          amount_paise: number
          products: string | null
          earlier_orders: number
        }>()

      if (!row) return

      const products = (row.products ?? '').split(',').filter(Boolean)
      const passUrl = await deepLink(env, job.registrationId, '/pass')

      // An upgrade is a paid order that follows an earlier one and adds only
      // the Delegate Card. Everything else is a first arrival.
      const isUpgrade = row.earlier_orders > 0 && !products.includes('basic')

      const message = isUpgrade
        ? templates.upgradeConfirmed({
            name: row.name,
            publicCode: row.public_code,
            amountPaise: row.amount_paise,
            passUrl,
          })
        : templates.registrationConfirmed({
            name: row.name,
            publicCode: row.public_code,
            tierName: products.includes('delegate') ? 'Delegate Card' : 'Basic Registration',
            amountPaise: row.amount_paise,
            passUrl,
          })

      await deliver(env, send, row.email, row.name, message)
      return
    }

    case 'email.sign_in_link': {
      const row = await env.DB.prepare('SELECT name, email FROM registrations WHERE id = ?')
        .bind(job.registrationId)
        .first<{ name: string; email: string }>()

      if (!row) return

      const message = templates.signInLink({
        name: row.name,
        url: `${siteUrl(env)}/enter?token=${encodeURIComponent(job.token)}&next=${encodeURIComponent('/pass')}`,
        minutes: 30,
      })

      await deliver(env, send, row.email, row.name, message)
      return
    }

    case 'email.payment_failed': {
      const row = await env.DB.prepare(
        `SELECT r.name, r.email, o.amount_paise, o.failure_reason
           FROM registrations r JOIN orders o ON o.id = ?
          WHERE r.id = ?`,
      )
        .bind(job.orderId, job.registrationId)
        .first<{ name: string; email: string; amount_paise: number; failure_reason: string | null }>()

      if (!row) return

      const message = templates.paymentFailed({
        name: row.name,
        amountPaise: row.amount_paise,
        retryUrl: `${siteUrl(env)}/#register`,
        reason: row.failure_reason ?? undefined,
      })

      await deliver(env, send, row.email, row.name, message)
      return
    }

    case 'pass.render_pdf':
      // The pass is a live page rather than a file: the QR has to reflect an
      // upgrade bought after the email went out, which a PDF attached in
      // September cannot. A downloadable version can come later for people who
      // want paper, but nothing depends on it.
      return

    default: {
      // Exhaustiveness: adding a job kind without handling it fails the build.
      const unreachable: never = job
      console.error('unhandled job kind', unreachable)
    }
  }
}

async function deliver(
  env: Env,
  send: ReturnType<typeof mailer>,
  to: string,
  toName: string,
  message: { subject: string; html: string; text: string },
): Promise<void> {
  const result = await send.send({
    to,
    toName,
    subject: message.subject,
    html: message.html,
    text: message.text,
    // Replies go to a mailbox a human reads, not to the sending address.
    replyTo: env.MAIL_REPLY_TO || undefined,
  })

  if (result.ok) return

  console.error('mail failed', send.name, to, result.error)

  // Throwing hands the message back to the queue for another attempt. A
  // permanent failure — a bad address, an unverified sender — is swallowed,
  // because retrying it just burns the queue for the same answer.
  if (result.retryable) throw new Error(result.error)
}
