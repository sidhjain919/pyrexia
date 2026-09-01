/**
 * Sending mail by talking SMTP directly.
 *
 * Every hosted provider — SES, ZeptoMail, Mailgun, Brevo — puts an account
 * review and a DNS change between you and your first email. That is the right
 * trade in September and the wrong one on launch morning. This provider has
 * neither: it signs in to a mailbox that already exists, with credentials the
 * fest already holds, and sends. No signup, no approval queue, no records to
 * propagate.
 *
 * What it costs is deliverability and volume. Mail leaves as the mailbox owner,
 * so SPF and DKIM belong to that provider's domain rather than ours, and the
 * daily cap is whoever runs the mailbox — 500 a day on a personal Gmail, 2,000
 * on Workspace. It is the right thing to launch on and the wrong thing to still
 * be using in October; `MAIL_PROVIDER` moves back to `zeptomail` the moment the
 * domain verifies, and nothing else changes.
 *
 * Workers can open TCP sockets, but not on port 25 — Cloudflare blocks it. Use
 * 587 (STARTTLS, the default here) or 465 (TLS from the first byte). The
 * `cloudflare:sockets` import is dynamic so this file stays importable under
 * `node --test`, where that module does not exist.
 */

import type { MailProvider, Message, SendResult } from './mail.ts'

/** Long enough for a slow handshake, short enough not to hold a queue message hostage. */
const TIMEOUT_MS = 20_000

/* ------------------------------------------------------------------ *
 * The wire
 * ------------------------------------------------------------------ */

type Reply = { code: number; text: string }

/**
 * One SMTP conversation.
 *
 * Kept deliberately small: connect, a handful of commands, close. There is no
 * connection pooling because a Worker isolate has nowhere to pool to, and
 * because one message per connection is what a queue consumer wants anyway.
 */
class Conn {
  private socket: { readable: ReadableStream; writable: WritableStream; close(): Promise<void>; startTls(): unknown }
  private reader: ReadableStreamDefaultReader<Uint8Array>
  private writer: WritableStreamDefaultWriter<Uint8Array>
  private decoder = new TextDecoder()
  private encoder = new TextEncoder()
  private buffer = ''

  constructor(socket: Conn['socket']) {
    this.socket = socket
    this.reader = socket.readable.getReader() as ReadableStreamDefaultReader<Uint8Array>
    this.writer = socket.writable.getWriter() as WritableStreamDefaultWriter<Uint8Array>
  }

  /**
   * Read one complete reply.
   *
   * SMTP continuation lines are `250-EXTENSION`, and only the final line of a
   * reply uses a space: `250 OK`. Reading until the first CRLF would stop in
   * the middle of an EHLO response and leave the rest to be mistaken for the
   * answer to the *next* command, which is the classic way a hand-rolled SMTP
   * client desynchronises and then fails somewhere unrelated.
   */
  async read(): Promise<Reply> {
    for (;;) {
      const lines = this.buffer.split('\r\n')
      for (let i = 0; i < lines.length; i++) {
        if (/^\d{3} /.test(lines[i])) {
          const complete = lines.slice(0, i + 1)
          this.buffer = lines.slice(i + 1).join('\r\n')
          return { code: Number(complete[i].slice(0, 3)), text: complete.join('\n') }
        }
      }
      const { value, done } = await this.reader.read()
      if (done) throw new Error('the server closed the connection')
      this.buffer += this.decoder.decode(value, { stream: true })
    }
  }

  async write(line: string): Promise<void> {
    await this.writer.write(this.encoder.encode(line + '\r\n'))
  }

  /** Send a command and insist on the reply code it must produce. */
  async command(line: string, expect: number, label: string): Promise<Reply> {
    await this.write(line)
    const reply = await this.read()
    if (Math.floor(reply.code / 100) !== Math.floor(expect / 100)) {
      throw new SmtpError(reply.code, `${label}: ${reply.text.trim()}`)
    }
    return reply
  }

  /** After STARTTLS the socket is replaced, so the reader and writer are too. */
  upgrade(): void {
    // The old reader/writer are attached to the plaintext stream. Releasing
    // them first is what lets the TLS socket take the streams over.
    this.reader.releaseLock()
    this.writer.releaseLock()
    const secure = this.socket.startTls() as Conn['socket']
    this.socket = secure
    this.reader = secure.readable.getReader() as ReadableStreamDefaultReader<Uint8Array>
    this.writer = secure.writable.getWriter() as WritableStreamDefaultWriter<Uint8Array>
    this.buffer = ''
  }

  async close(): Promise<void> {
    try {
      await this.write('QUIT')
    } catch {
      /* already gone; nothing to say */
    }
    try {
      await this.socket.close()
    } catch {
      /* already gone */
    }
  }
}

/** Carries the server's reply code, which is what decides whether to retry. */
class SmtpError extends Error {
  readonly code: number
  constructor(code: number, message: string) {
    super(message)
    this.name = 'SmtpError'
    this.code = code
  }
}

/* ------------------------------------------------------------------ *
 * Building the message
 * ------------------------------------------------------------------ */

/** Base64 of UTF-8. `btoa` alone mangles anything outside latin-1. */
function b64(input: string): string {
  const bytes = new TextEncoder().encode(input)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

/** Base64 bodies are wrapped at 76 columns, as the MIME spec asks. */
function wrap(encoded: string): string {
  return (encoded.match(/.{1,76}/g) ?? []).join('\r\n')
}

/**
 * Encode a header value that may not be ASCII.
 *
 * A raw "PYREXIA 2026 · Pirates of the Lost Island" in a Subject line is not
 * legal 7-bit header text, and servers differ on whether they pass it, mangle
 * it or reject the message. RFC 2047 encoded-words are the portable answer.
 */
function header(value: string): string {
  // eslint-disable-next-line no-control-regex
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${b64(value)}?=`
}

function address(email: string, name?: string): string {
  return name ? `"${header(name).replace(/"/g, '')}" <${email}>` : email
}

/** Exported for tests: the message format is where a hand-rolled client breaks. */
export function buildMime(message: Message, fromEmail: string, fromName: string): string {
  const boundary = `pyx_${crypto.randomUUID().replace(/-/g, '')}`
  const domain = fromEmail.split('@')[1] ?? 'pyrexiaaiims.com'

  const headers = [
    `From: ${address(fromEmail, fromName)}`,
    `To: ${address(message.to, message.toName)}`,
    ...(message.replyTo ? [`Reply-To: ${message.replyTo}`] : []),
    `Subject: ${header(message.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ]

  // Both parts are base64. That is not only about UTF-8: base64 output can
  // never begin a line with a full stop, which is what would otherwise end the
  // DATA block early and truncate the email.
  const body = [
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrap(b64(message.text)),
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrap(b64(message.html)),
    `--${boundary}--`,
  ]

  return [...headers, ...body].join('\r\n')
}

/* ------------------------------------------------------------------ *
 * The provider
 * ------------------------------------------------------------------ */

export type SmtpConfig = {
  host: string
  port: number
  user: string
  pass: string
  fromEmail: string
  fromName: string
  /** 465 speaks TLS immediately; 587 negotiates it with STARTTLS. */
  implicitTls?: boolean
}

export class SmtpProvider implements MailProvider {
  readonly name = 'smtp'

  private readonly config: SmtpConfig

  constructor(config: SmtpConfig) {
    this.config = config
  }

  async send(message: Message): Promise<SendResult> {
    const { host, port, user, pass, fromEmail, fromName } = this.config
    const implicit = this.config.implicitTls ?? port === 465

    let conn: Conn | null = null
    try {
      const { connect } = (await import('cloudflare:sockets')) as {
        connect: (a: { hostname: string; port: number }, o: { secureTransport: string; allowHalfOpen: boolean }) => Conn['socket']
      }

      const socket = connect(
        { hostname: host, port },
        { secureTransport: implicit ? 'on' : 'starttls', allowHalfOpen: false },
      )
      conn = new Conn(socket)
      const session = conn

      await withTimeout(
        (async () => {
          const greeting = await session.read()
          if (greeting.code !== 220) {
            throw new SmtpError(greeting.code, `greeting: ${greeting.text.trim()}`)
          }

          // The EHLO name is cosmetic to the relay but must be syntactically a
          // domain; some servers reject a bare label.
          await session.command(`EHLO ${hostnameOf(fromEmail)}`, 250, 'EHLO')

          if (!implicit) {
            await session.command('STARTTLS', 220, 'STARTTLS')
            session.upgrade()
            // Everything the server told us before the upgrade is discarded,
            // which is the point of STARTTLS: only the second EHLO is trusted.
            await session.command(`EHLO ${hostnameOf(fromEmail)}`, 250, 'EHLO (TLS)')
          }

          // AUTH LOGIN rather than PLAIN: it is the one every consumer mail
          // host accepts, Gmail and Outlook included.
          await session.command('AUTH LOGIN', 334, 'AUTH')
          await session.command(b64(user), 334, 'username')
          await session.command(b64(pass), 235, 'password')

          await session.command(`MAIL FROM:<${fromEmail}>`, 250, 'MAIL FROM')
          await session.command(`RCPT TO:<${message.to}>`, 250, 'RCPT TO')
          await session.command('DATA', 354, 'DATA')

          await session.write(buildMime(message, fromEmail, fromName))
          await session.command('.', 250, 'message body')
        })(),
        TIMEOUT_MS,
      )

      await conn.close()
      return { ok: true }
    } catch (err) {
      if (conn) await conn.close().catch(() => {})

      if (err instanceof SmtpError) {
        // 4xx is the server asking for later — a full mailbox, a rate limit, a
        // grey-listing delay. 5xx is a refusal, and sending it again sends the
        // same refused thing.
        const retryable = err.code >= 400 && err.code < 500
        return { ok: false, error: `smtp ${err.code}: ${err.message}`, retryable }
      }
      // A socket that never opened or a handshake that timed out is worth
      // another attempt; the queue will space them out.
      return { ok: false, error: `smtp: ${String(err)}`, retryable: true }
    }
  }
}

/** The domain half of an address, for the EHLO greeting. */
function hostnameOf(email: string): string {
  return email.split('@')[1] || 'localhost'
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms),
    ),
  ])
}
