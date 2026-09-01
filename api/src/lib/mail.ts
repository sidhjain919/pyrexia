/**
 * Sending email.
 *
 * Providers behind one interface:
 *
 *   console: writes the message to the log instead of sending. The default,
 *             and what runs until a real key is configured, so the whole flow
 *             is exercisable before anyone signs up for anything.
 *   resend : 3,000/month free, $20/month for 50,000. Verifies a domain with
 *             DKIM plus an MX record on a sending subdomain.
 *   brevo  : 300 free sends a day. Verifies with TXT records only, which
 *             matters when the registrar won't allow MX.
 *   ses    : Amazon. About ₹9 per thousand. Verifies with three CNAME records
 *             and no MX at all, which is why it was chosen: Wix hosts our DNS
 *             and will not create an MX record on a subdomain, and that single
 *             restriction rules out most of the market.
 *   zepto  : Zoho ZeptoMail. Transactional only, priced in rupees, verifies on
 *             SPF and DKIM TXT records alone.
 *   mailgun: MX is needed only to *receive* mail. A send-only domain verifies
 *             on two TXT records, which Wix will create.
 *   smtp   : Straight to a mailbox that already exists, with credentials the
 *             fest already holds. The only option with no signup, no review
 *             queue and no DNS at all, which is what makes it the one to
 *             launch on while a hosted provider is still verifying. See
 *             `smtp.ts` for what it costs.
 *
 * The last two exist because AWS declined to lift the SES sandbox, and a
 * sandboxed SES can only mail addresses somebody has verified by hand: for a
 * fest taking public registrations that is the same as having no email at all.
 * Nothing about the templates, the queue or the jobs changes when the provider
 * does, which was the point of putting them behind one interface.
 *
 * Which one is right depends less on the API than on what DNS records the
 * registrar will let you create. Before adding another, check whether it wants
 * an MX record on a sending subdomain: if it does, it is a dead end here.
 *
 * Nothing calls this directly from a request handler. Everything goes through
 * the queue, because a student tapping Register must never wait on an inbox -
 * and because a provider outage should delay an email, not fail a payment.
 */

import type { Env } from '../types.ts'
import { signRequest } from './sigv4.ts'
import { SmtpProvider } from './smtp.ts'

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

  /**
   * Set when MAIL_PROVIDER named a real provider whose credentials are absent.
   *
   * Falling back to the log is right while nothing is configured. Falling back
   * *silently* after somebody has deliberately set MAIL_PROVIDER=zeptomail is
   * how a fest discovers on the morning of registration that six hundred
   * confirmation emails went to a log file. The line below is the difference
   * between that and a one-line fix.
   */
  private readonly misconfigured: string | null

  constructor(misconfigured: string | null = null) {
    this.misconfigured = misconfigured
  }

  async send(message: Message): Promise<SendResult> {
    if (this.misconfigured) {
      console.error(
        JSON.stringify({
          mail: 'NOT SENT: provider configured but its credentials are missing',
          provider: this.misconfigured,
          fix: `wrangler secret put ${CREDENTIAL_FOR[this.misconfigured] ?? '<API key>'}`,
          to: message.to,
          subject: message.subject,
        }),
      )
      return { ok: true }
    }

    console.log(
      JSON.stringify({
        mail: 'not actually sent: no provider configured',
        to: message.to,
        subject: message.subject,
        // The text body carries any link, which is what you need while testing.
        text: message.text,
      }),
    )
    return { ok: true }
  }
}

/** The secret each provider needs, named so the log can say how to fix it. */
const CREDENTIAL_FOR: Record<string, string> = {
  smtp: 'SMTP_HOST / SMTP_USER / SMTP_PASS',
  resend: 'RESEND_API_KEY',
  ses: 'SES_ACCESS_KEY_ID / SES_SECRET_ACCESS_KEY',
  zeptomail: 'ZEPTOMAIL_TOKEN',
  mailgun: 'MAILGUN_API_KEY (and MAILGUN_DOMAIN)',
  brevo: 'BREVO_API_KEY',
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
      // Network trouble: worth another go.
      return { ok: false, error: String(err), retryable: true }
    }

    if (res.ok) {
      const body = (await res.json().catch(() => ({}))) as { messageId?: string }
      return { ok: true, id: body.messageId }
    }

    const detail = await res.text().catch(() => '')

    // 4xx means the message itself is wrong: a bad address, an unverified
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

    // 4xx means the message itself is wrong: an unverified domain, a bad
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
      // A signing failure is a configuration problem: a malformed key, most
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

    // 4xx is our fault: an unverified sender, a bad address, or still being
    // in the sandbox. Sending it again changes nothing. 429 is throttling,
    // which does clear; so does anything 5xx.
    const retryable = res.status >= 500 || res.status === 429

    return { ok: false, error: `ses ${res.status}: ${detail.slice(0, 300)}`, retryable }
  }
}

/* ------------------------------------------------------------------ *
 * ZeptoMail (Zoho)
 * ------------------------------------------------------------------ */

/**
 * Zoho's transactional-only service.
 *
 * Transactional-only is a feature here rather than a limitation: it is why the
 * account review asks "do you send receipts and passwords" rather than about
 * marketing consent, and why the domain verifies on TXT records alone.
 *
 * The auth header is deliberately not a bearer token. Zoho wants the literal
 * word `Zoho-enczapikey` in front of the key, and sending `Bearer` instead
 * fails with a 401 that reads exactly like a wrong key.
 */
class ZeptoProvider implements MailProvider {
  readonly name = 'zeptomail'

  // Written out rather than as constructor parameter properties: the project
  // compiles with `erasableSyntaxOnly`.
  private readonly token: string
  private readonly host: string
  private readonly fromEmail: string
  private readonly fromName: string

  constructor(token: string, region: string, fromEmail: string, fromName: string) {
    // Zoho's console hands you the whole header line, prefix included, and its
    // copy button copies the whole thing. Pasting that verbatim produces
    // `Zoho-enczapikey Zoho-enczapikey wSsV…` and a 401 that reads exactly
    // like a wrong key — an afternoon of re-issuing tokens that were all fine.
    this.token = token.trim().replace(/^Zoho-enczapikey\s+/i, '')
    // `in` is the India data centre, which is where this account should live.
    this.host = region === 'in' ? 'api.zeptomail.in' : 'api.zeptomail.com'
    this.fromEmail = fromEmail
    this.fromName = fromName
  }

  async send(message: Message): Promise<SendResult> {
    let res: Response
    try {
      res = await fetch(`https://${this.host}/v1.1/email`, {
        method: 'POST',
        headers: {
          Authorization: `Zoho-enczapikey ${this.token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          from: { address: this.fromEmail, name: this.fromName },
          to: [
            {
              email_address: {
                address: message.to,
                ...(message.toName ? { name: message.toName } : {}),
              },
            },
          ],
          ...(message.replyTo ? { reply_to: [{ address: message.replyTo }] } : {}),
          subject: message.subject,
          htmlbody: message.html,
          textbody: message.text,
        }),
      })
    } catch (err) {
      return { ok: false, error: String(err), retryable: true }
    }

    if (res.ok) {
      const body = (await res.json().catch(() => ({}))) as { request_id?: string }
      return { ok: true, id: body.request_id }
    }

    const detail = await res.text().catch(() => '')
    // 4xx is the message or the account: a bad address, an unverified sender,
    // a key without permission. Sending it again sends the same broken thing.
    const retryable = res.status >= 500 || res.status === 429
    return { ok: false, error: `zeptomail ${res.status}: ${detail.slice(0, 300)}`, retryable }
  }
}

/* ------------------------------------------------------------------ *
 * Mailgun
 * ------------------------------------------------------------------ */

/**
 * Mailgun's send endpoint.
 *
 * Form-encoded rather than JSON, and HTTP Basic under the literal username
 * `api`. Its domain setup screen asks for MX records as well, but those are
 * only for receiving: a send-only domain verifies on the SPF and DKIM TXT
 * records alone, which is the whole reason it is usable here.
 */
class MailgunProvider implements MailProvider {
  readonly name = 'mailgun'

  private readonly apiKey: string
  private readonly domain: string
  private readonly host: string
  private readonly from: string

  constructor(apiKey: string, domain: string, region: string, fromEmail: string, fromName: string) {
    this.apiKey = apiKey
    this.domain = domain
    // The EU region is a different hostname, not a parameter.
    this.host = region === 'eu' ? 'api.eu.mailgun.net' : 'api.mailgun.net'
    this.from = fromName ? `${fromName} <${fromEmail}>` : fromEmail
  }

  async send(message: Message): Promise<SendResult> {
    const form = new URLSearchParams({
      from: this.from,
      to: message.toName ? `${message.toName} <${message.to}>` : message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    })
    if (message.replyTo) form.set('h:Reply-To', message.replyTo)

    let res: Response
    try {
      res = await fetch(`https://${this.host}/v3/${encodeURIComponent(this.domain)}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`api:${this.apiKey}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      })
    } catch (err) {
      return { ok: false, error: String(err), retryable: true }
    }

    if (res.ok) {
      const body = (await res.json().catch(() => ({}))) as { id?: string }
      return { ok: true, id: body.id }
    }

    const detail = await res.text().catch(() => '')
    const retryable = res.status >= 500 || res.status === 429
    return { ok: false, error: `mailgun ${res.status}: ${detail.slice(0, 300)}`, retryable }
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
  if (env.MAIL_PROVIDER === 'smtp' && env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
    const port = Number(env.SMTP_PORT || '587')
    return new SmtpProvider({
      host: env.SMTP_HOST,
      port,
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
      /*
       * The sender is the mailbox that signed in, not MAIL_FROM_EMAIL.
       *
       * That is deliberate and it is the difference between this working and
       * not. MAIL_FROM_EMAIL is `no-reply@pyrexiaaiims.com`, which is right for
       * every hosted provider and wrong here: Gmail and Outlook refuse a
       * `MAIL FROM` the authenticated account does not own, and relays that
       * accept it anyway get the message filed as forgery. Set SMTP_FROM only
       * if the mailbox has that address as a verified send-as alias.
       */
      fromEmail: env.SMTP_FROM || env.SMTP_USER,
      fromName: env.MAIL_FROM_NAME || 'PYREXIA 2026',
    })
  }
  if (env.MAIL_PROVIDER === 'zeptomail' && env.ZEPTOMAIL_TOKEN) {
    return new ZeptoProvider(
      env.ZEPTOMAIL_TOKEN,
      env.ZEPTOMAIL_REGION || 'in',
      env.MAIL_FROM_EMAIL || 'no-reply@pyrexiaaiims.com',
      env.MAIL_FROM_NAME || 'PYREXIA 2026',
    )
  }
  if (env.MAIL_PROVIDER === 'mailgun' && env.MAILGUN_API_KEY && env.MAILGUN_DOMAIN) {
    return new MailgunProvider(
      env.MAILGUN_API_KEY,
      env.MAILGUN_DOMAIN,
      env.MAILGUN_REGION || 'us',
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
  // Named a provider, but its key never arrived. Say so on every send.
  const named = env.MAIL_PROVIDER
  if (named && named !== 'console' && named in CREDENTIAL_FOR) {
    return new ConsoleProvider(named)
  }
  return new ConsoleProvider()
}
