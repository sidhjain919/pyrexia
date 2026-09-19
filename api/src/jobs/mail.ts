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
import { OTP_TTL_MINUTES } from '../lib/otp.ts'
import { createLoginToken } from '../lib/session.ts'
import * as templates from '../lib/templates.ts'
import { departureDate, festDate, roomLabel, SECURITY_DEPOSIT_RUPEES } from '../data/accommodation.ts'
import { feeFor } from '../data/fees.ts'
import { resolveEvent } from '../data/events.ts'
import { syncEventSheet } from './sheets.ts'

/** Where the site lives, for links inside emails. */
function siteUrl(env: Env): string {
  // The fallback is the real domain: a misconfigured deploy should send links
  // that work rather than links to where the site used to live.
  return (env.SITE_URL || 'https://pyrexiaaiims.com').replace(/\/$/, '')
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
      // Festival Pass in October paid ₹2,250 today; telling them we received
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
      // the Festival Pass. Everything else is a first arrival.
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
            tierName: products.includes('delegate') ? 'Festival Pass' : 'Basic Registration',
            amountPaise: row.amount_paise,
            passUrl,
          })

      await deliver(env, send, row.email, row.name, message)
      return
    }

    case 'email.event_entered': {
      const row = await env.DB.prepare(
        `SELECT r.name, r.email, r.public_code, e.event_name, e.territory_code,
                e.team_name, e.head_count, e.fee_variant, e.fee_paise
           FROM event_entries e
           JOIN registrations r ON r.id = e.registration_id
          WHERE e.id = ? AND e.registration_id = ?`,
      )
        .bind(job.entryId, job.registrationId)
        .first<{
          name: string
          email: string
          public_code: string
          event_name: string
          territory_code: string
          team_name: string | null
          head_count: number
          fee_variant: string | null
          fee_paise: number
        }>()

      if (!row) return

      // The bracket somebody actually paid for, by the id stored on the entry.
      // Only worth printing when the event runs more than one: "Nukkad Natak ·
      // Entry" tells nobody anything.
      const fee = feeFor(row.event_name)
      const band =
        fee && fee.variants.length > 1
          ? (fee.variants.find((v) => v.id === row.fee_variant)?.label ?? row.fee_variant ?? '')
          : ''

      const resolved = resolveEvent(row.event_name)
      const passUrl = await deepLink(env, job.registrationId, '/pass')

      const message = templates.eventEntered({
        name: row.name,
        publicCode: row.public_code,
        eventName: row.event_name,
        territory: resolved?.territory.territory ?? row.territory_code,
        band,
        teamName: row.team_name ?? '',
        headCount: row.head_count ?? 1,
        amountPaise: row.fee_paise,
        passUrl,
      })

      await deliver(env, send, row.email, row.name, message)
      return
    }

    case 'email.accommodation_confirmed': {
      // The booking carries its own copy of the contact details, so the
      // receipt goes to the address given on the accommodation form rather
      // than the one on the registration: for a good number of people those
      // are different, and this is the email they have to produce at a desk.
      const row = await env.DB.prepare(
        `SELECT b.public_code AS code, b.name, b.email, b.sharing, b.ac, b.days,
                b.arrival_date, b.fee_paise, r.public_code AS delegate_code,
                (SELECT o.amount_paise FROM orders o
                  WHERE o.accommodation_booking_id = b.id AND o.status = 'paid'
                  ORDER BY o.paid_at DESC LIMIT 1) AS paid_paise
           FROM accommodation_bookings b
           JOIN registrations r ON r.id = b.registration_id
          WHERE b.id = ? AND b.registration_id = ?`,
      )
        .bind(job.bookingId, job.registrationId)
        .first<{
          code: string
          name: string
          email: string
          sharing: number
          ac: number
          days: number
          arrival_date: string
          fee_paise: number
          delegate_code: string
          paid_paise: number | null
        }>()

      if (!row) return

      const passUrl = await deepLink(env, job.registrationId, '/pass')

      const message = templates.accommodationConfirmed({
        name: row.name,
        code: row.code,
        publicCode: row.delegate_code,
        room: roomLabel({ sharing: row.sharing, ac: row.ac === 1 }),
        days: row.days,
        arrival: festDate(row.arrival_date),
        departure: festDate(departureDate(row.arrival_date, row.days)),
        roomPaise: row.fee_paise,
        // What their statement will say, gateway charges included. Falls back
        // to the room charge only if the order row has gone missing, which
        // should be impossible by the time this job runs.
        amountPaise: row.paid_paise ?? row.fee_paise,
        depositRupees: SECURITY_DEPOSIT_RUPEES,
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

    case 'email.verify_code': {
      const row = await env.DB.prepare('SELECT name, email FROM registrations WHERE id = ?')
        .bind(job.registrationId)
        .first<{ name: string; email: string }>()

      if (!row) return

      const message = templates.verificationCode({ code: job.code, minutes: OTP_TTL_MINUTES })

      // Deliberately not through deliver(): a verification code is how someone
      // proves an address works, so refusing to send it because that address
      // is on the suppression list would make a bounced typo permanent, they
      // could never correct it by re-verifying.
      const result = await send.send({
        to: row.email,
        toName: row.name || undefined,
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo: env.MAIL_REPLY_TO || undefined,
      })

      if (!result.ok) {
        console.error('mail failed', send.name, row.email, result.error)
        if (result.retryable) throw new Error(result.error)
      }
      return
    }

    case 'email.reset_password': {
      const row = await env.DB.prepare('SELECT name, email FROM registrations WHERE id = ?')
        .bind(job.registrationId)
        .first<{ name: string; email: string }>()

      if (!row) return

      const message = templates.resetPassword({
        name: row.name,
        url: `${siteUrl(env)}/reset?token=${encodeURIComponent(job.token)}`,
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

    case 'sheets.sync':
      await syncEventSheet(env, job.eventName)
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
  // Has this address already told us to stop: by bouncing permanently, or by
  // someone marking us as spam? Amazon judges a sender on how often they send
  // to addresses that reject them, and one bad reputation delays every
  // student's pass. So the question is asked before every single send, not
  // just the bulk ones.
  const suppressed = await env.DB.prepare(
    'SELECT reason FROM email_suppressions WHERE email = ?',
  )
    .bind(to.toLowerCase())
    .first<{ reason: string }>()

  if (suppressed) {
    // Not an error, and not retried: this is the system working. It is logged
    // because someone whose pass never arrived will eventually ask why, and
    // this is the answer.
    console.warn('mail suppressed', suppressed.reason, to, message.subject)
    return
  }

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
  // permanent failure: a bad address, an unverified sender, is swallowed,
  // because retrying it just burns the queue for the same answer.
  if (result.retryable) throw new Error(result.error)
}
