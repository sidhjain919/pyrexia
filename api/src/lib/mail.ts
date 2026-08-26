/**
 * Sending email.
 *
 * Providers behind one interface:
 *
 *   console — writes the message to the log instead of sending. The default,
 *             and what runs until a real key is configured, so the whole flow
 *             is exercisable before anyone signs up for anything.
 *   resend  — 3,000/month free, $20/month for 50,000. Verifies a domain with
 *             DKIM plus an MX record on a sending subdomain.
 *   brevo   — 300 free sends a day. Verifies with TXT records only, which
 *             matters when the registrar won't allow MX.
 *   ses     — Amazon. About ₹9 per thousand, so a fest's worth of email costs
 *             less than a cup of tea. Verifies with three CNAME records and no
 *             MX at all, which is why it is here: Wix hosts our DNS and will
 *             not create an MX record on a subdomain, and that single
 *             restriction rules out most of the market.
 *
 * Which one is right depends less on the API than on what DNS records the
 * registrar will let you create. Keeping all three behind one interface means
 * that decision can change without touching a single template or job.
 *
 * Nothing calls this directly from a request handler. Everything goes through
 * the queue, because a student tapping Register must never wait on an inbox —
 * and because a provider outage should delay an email, not fail a payment.
 */

import type { Env } from '../types.ts'
import { signRequest } from './sigv4.ts'

export type Message = {
  to: string
  toName?: string
  subject: string
  html: string
  text: string
  /** Where replies should land, which is rarely where we send from. */
  replyTo?: string
}

export type SendResult = { ok: true; id?: string } | { ok: false; error: string; retryable: boolean }

export interface MailProvider {
  readonly name: string
  send(message: Message): Promise<SendResult>
}

/* ------------------------------------------------------------------ *
 * console
 * ------------------------------------------------------------------ */

class ConsoleProvider implements MailProvider {
  readonly name = 'console'

  async send(message: Message): Promise<SendResult> {
    console.log(
      JSON.stringify({
        mail: 'not actually sent — no provider configured',
        to: message.to,
        subject: message.subject,
        // The text body carries any link, which is what you need while testing.
        text: message.text,
      }),
    )
    return { ok: true }
  }
}

/* ------------------------------------------------------------------ *
 * Brevo
 * ------------------------------------------------------------------ */

class BrevoProvider implements MailProvider {
  readonly name = 'brevo'

  // Written out rather than as constructor parameter properties: the project
  // compiles with `erasableSyntaxOnly`.
  private readonly apiKey: string
  private readonly fromEmail: string
  private readonly fromName: string

  constructor(apiKey: string, fromEmail: string, fromName: string) {
    this.apiKey = apiKey
    this.fromEmail = fromEmail
    this.fromName = fromName
  }

  async send(message: Message): Promise<SendResult> {
    let res: Response
    try {
      res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': this.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: { email: this.fromEmail, name: this.fromName },
          to: [{ email: message.to, ...(message.toName ? { name: message.toName } : {}) }],
          ...(message.replyTo ? { replyTo: { email: message.replyTo } } : {}),
          subject: message.subject,
          htmlContent: message.html,
          textContent: message.text,
        }),
      })
    } catch (err) {
      // Network trouble — worth another go.
      return { ok: false, error: String(err), retryable: true }
    }

    if (res.ok) {
      const body = (await res.json().catch(() => ({}))) as { messageId?: string }
      return { ok: true, id: body.messageId }
    }

    const detail = await res.text().catch(() => '')

    // 4xx means the message itself is wrong — a bad address, an unverified
    // sender. Retrying sends the same broken thing again, so don't.
    // 429 is the exception: rate limiting clears on its own.
    const retryable = res.status >= 500 || res.status === 429

    return { ok: false, error: `brevo ${res.status}: ${detail.slice(0, 300)}`, retryable }
  }
}

/* ------------------------------------------------------------------ *
 * Resend
 * ------------------------------------------------------------------ */

class ResendProvider implements MailProvider {
  readonly name = 'resend'

  // Written out rather than as constructor parameter properties: the project
  // compiles with `erasableSyntaxOnly`.
  private readonly apiKey: string
  private readonly from: string

  constructor(apiKey: string, fromEmail: string, fromName: string) {
    this.apiKey = apiKey
    // Resend wants a single RFC-5322 string rather than separate fields.
    this.from = fromName ? `${fromName} <${fromEmail}>` : fromEmail
  }

  async send(message: Message): Promise<SendResult> {
    let res: Response
    try {
      res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
          ...(message.replyTo ? { reply_to: message.replyTo } : {}),
        }),
      })
    } catch (err) {
      return { ok: false, error: String(err), retryable: true }
    }

    if (res.ok) {
      const body = (await res.json().catch(() => ({}))) as { id?: string }
      return { ok: true, id: body.id }
    }

    const detail = await res.text().catch(() => '')

    // 4xx means the message itself is wrong — an unverified domain, a bad
    // address. Retrying sends the same broken thing again. 429 is the
    // exception: rate limiting clears by itself.
    const retryable = res.status >= 500 || res.status === 429

    return { ok: false, error: `resend ${res.status}: ${detail.slice(0, 300)}`, retryable }
  }
}

/* ------------------------------------------------------------------ *
 * Amazon SES
 * ------------------------------------------------------------------ */

class SesProvider implements MailProvider {
  readonly name = 'ses'

  // Written out rather than as constructor parameter properties: the project
  // compiles with `erasableSyntaxOnly`.
  private readonly accessKeyId: string
  private readonly secretAccessKey: string
  private readonly region: string
  private readonly from: string

  constructor(
    accessKeyId: string,
    secretAccessKey: string,
    region: string,
    fromEmail: string,
    fromName: string,
  ) {
    this.accessKeyId = accessKeyId
    this.secretAccessKey = secretAccessKey
    this.region = region
    // SES accepts a display name only in RFC-5322 form, and only if the
    // address inside it belongs to a verified identity.
    this.from = fromName ? `${fromName} <${fromEmail}>` : fromEmail
  }

  async send(message: Message): Promise<SendResult> {
    const body = JSON.stringify({
      FromEmailAddress: this.from,
      Destination: { ToAddresses: [message.to] },
      ...(message.replyTo ? { ReplyToAddresses: [message.replyTo] } : {}),
      Content: {
        Simple: {
          Subject: { Data: message.subject, Charset: 'UTF-8' },
          Body: {
            Html: { Data: message.html, Charset: 'UTF-8' },
            Text: { Data: message.text, Charset: 'UTF-8' },
          },
        },
      },
    })

    let signed
    try {
      signed = await signRequest({
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
        region: this.region,
        service: 'ses',
        host: `email.${this.region}.amazonaws.com`,
        path: '/v2/email/outbound-emails',
        body,
      })
    } catch (err) {
      // A signing failure is a configuration problem — a malformed key, most
      // likely. Retrying re-signs the same bad credentials.
      return { ok: false, error: `ses signing: ${String(err)}`, retryable: false }
    }

    let res: Response
    try {
      res = await fetch(signed.url, {
        method: 'POST',
        headers: signed.headers,
        body: signed.body,
      })
    } catch (err) {
      return { ok: false, error: String(err), retryable: true }
    }

    if (res.ok) {
      const parsed = (await res.json().catch(() => ({}))) as { MessageId?: string }
      return { ok: true, id: parsed.MessageId }
    }

    const detail = await res.text().catch(() => '')

    // 4xx is our fault — an unverified sender, a bad address, or still being
    // in the sandbox. Sending it again changes nothing. 429 is throttling,
    // which does clear; so does anything 5xx.
    const retryable = res.status >= 500 || res.status === 429

    return { ok: false, error: `ses ${res.status}: ${detail.slice(0, 300)}`, retryable }
  }
}

/* ------------------------------------------------------------------ */

export function mailer(env: Env): MailProvider {
  if (env.MAIL_PROVIDER === 'resend' && env.RESEND_API_KEY) {
    return new ResendProvider(
      env.RESEND_API_KEY,
      env.MAIL_FROM_EMAIL || 'no-reply@pyrexiaaiims.com',
      env.MAIL_FROM_NAME || 'PYREXIA 2026',
    )
  }
  if (
    env.MAIL_PROVIDER === 'ses' &&
    env.SES_ACCESS_KEY_ID &&
    env.SES_SECRET_ACCESS_KEY
  ) {
    return new SesProvider(
      env.SES_ACCESS_KEY_ID,
      env.SES_SECRET_ACCESS_KEY,
      // Mumbai: closest region to everyone who will receive these.
      env.SES_REGION || 'ap-south-1',
      env.MAIL_FROM_EMAIL || 'no-reply@pyrexiaaiims.com',
      env.MAIL_FROM_NAME || 'PYREXIA 2026',
    )
  }
  if (env.MAIL_PROVIDER === 'brevo' && env.BREVO_API_KEY) {
    return new BrevoProvider(
      env.BREVO_API_KEY,
      env.MAIL_FROM_EMAIL || 'pyrexia@aiimsrishikesh.edu.in',
      env.MAIL_FROM_NAME || 'PYREXIA 2026',
    )
  }
  return new ConsoleProvider()
}
