import { test } from 'node:test'
import assert from 'node:assert/strict'

import { mailer, type Message } from './mail.ts'
import type { Env } from '../types.ts'

const base: Record<string, string> = {
  ENVIRONMENT: 'test',
  MAIL_FROM_EMAIL: 'no-reply@pyrexiaaiims.com',
  MAIL_FROM_NAME: 'PYREXIA 2026',
}

const msg: Message = {
  to: 'aarav@example.edu',
  toName: 'Aarav Sharma',
  subject: "You're aboard",
  html: '<p>hello</p>',
  text: 'hello',
  replyTo: 'pyrexia@aiimsrishikesh.edu.in',
}

/** Swap fetch, run the send, hand back what the provider actually posted. */
async function capture(env: object, respond: () => Response) {
  const original = globalThis.fetch
  let seen: { url: string; body: any; auth: string | null } | null = null
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    seen = {
      url: String(url),
      body: JSON.parse(String(init.body)),
      auth: new Headers(init.headers).get('Authorization'),
    }
    return respond()
  }) as typeof fetch
  try {
    const result = await mailer(env as unknown as Env).send(msg)
    return { seen: seen as unknown as { url: string; body: any; auth: string | null }, result }
  } finally {
    globalThis.fetch = original
  }
}

test('with no key configured, nothing is sent', async () => {
  const original = globalThis.fetch
  let called = false
  globalThis.fetch = (async () => {
    called = true
    return new Response('{}')
  }) as typeof fetch
  try {
    const provider = mailer({ ...base, MAIL_PROVIDER: 'resend' } as unknown as Env)
    assert.equal(provider.name, 'console', 'a missing key must fall back, not throw')
    assert.equal((await provider.send(msg)).ok, true)
    assert.equal(called, false, 'the console provider must not touch the network')
  } finally {
    globalThis.fetch = original
  }
})

test('resend posts the message in the shape it expects', async () => {
  const { seen, result } = await capture(
    { ...base, MAIL_PROVIDER: 'resend', RESEND_API_KEY: 're_test_key' },
    () => new Response(JSON.stringify({ id: 'msg_123' }), { status: 200 }),
  )

  assert.equal(result.ok, true)
  assert.equal(result.ok && result.id, 'msg_123')
  assert.equal(seen.url, 'https://api.resend.com/emails')
  assert.equal(seen.auth, 'Bearer re_test_key')
  assert.equal(seen.body.from, 'PYREXIA 2026 <no-reply@pyrexiaaiims.com>', 'name and address in one field')
  assert.deepEqual(seen.body.to, ['aarav@example.edu'], 'to must be an array')
  assert.equal(seen.body.reply_to, 'pyrexia@aiimsrishikesh.edu.in', 'snake_case, not replyTo')
  assert.equal(seen.body.subject, "You're aboard")
  assert.ok(seen.body.html && seen.body.text, 'both parts must go')
})

test('resend: an unverified domain is not retried', async () => {
  const { result } = await capture(
    { ...base, MAIL_PROVIDER: 'resend', RESEND_API_KEY: 're_test_key' },
    () => new Response('{"message":"The pyrexiaaiims.com domain is not verified"}', { status: 403 }),
  )
  assert.equal(result.ok, false)
  assert.equal(result.ok === false && result.retryable, false, 'retrying sends the same broken thing')
  assert.match(result.ok === false ? result.error : '', /not verified/)
})

test('resend: rate limiting and outages are retried', async () => {
  for (const status of [429, 500, 503]) {
    const { result } = await capture(
      { ...base, MAIL_PROVIDER: 'resend', RESEND_API_KEY: 're_test_key' },
      () => new Response('busy', { status }),
    )
    assert.equal(result.ok === false && result.retryable, true, `${status} should retry`)
  }
})

test('resend: a network failure is retried, not swallowed', async () => {
  const original = globalThis.fetch
  globalThis.fetch = (async () => {
    throw new TypeError('network down')
  }) as typeof fetch
  try {
    const result = await mailer({
      ...base,
      MAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 're_test_key',
    } as unknown as Env).send(msg)
    assert.equal(result.ok, false)
    assert.equal(result.ok === false && result.retryable, true)
  } finally {
    globalThis.fetch = original
  }
})

test('brevo still works: switching provider is a config change', async () => {
  const { seen, result } = await capture(
    { ...base, MAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'xkeysib-test' },
    () => new Response(JSON.stringify({ messageId: 'brevo_1' }), { status: 200 }),
  )
  assert.equal(result.ok, true)
  assert.equal(seen.url, 'https://api.brevo.com/v3/smtp/email')
  assert.equal(seen.body.sender.email, 'no-reply@pyrexiaaiims.com', 'brevo splits name and address')
})

/* ------------------------------------------------------------------ *
 * Amazon SES
 *
 * SES is here because Wix hosts our DNS and will not create the MX record
 * most providers want. These check the request we build, not the signature -
 * the signature has its own tests against AWS's published vector.
 * ------------------------------------------------------------------ */

const sesEnv = {
  ...base,
  MAIL_PROVIDER: 'ses',
  SES_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
  SES_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
}

test('ses: sends to the regional endpoint, signed', async () => {
  const { seen, result } = await capture(
    sesEnv,
    () => new Response(JSON.stringify({ MessageId: 'ses_1' }), { status: 200 }),
  )
  assert.equal(result.ok, true)
  assert.equal(result.ok === true && result.id, 'ses_1')
  assert.equal(
    seen.url,
    'https://email.ap-south-1.amazonaws.com/v2/email/outbound-emails',
    'defaults to Mumbai, closest to everyone receiving these',
  )
  assert.match(String(seen.auth), /^AWS4-HMAC-SHA256 Credential=/)
  assert.equal(seen.body.Destination.ToAddresses[0], msg.to)
  assert.equal(seen.body.Content.Simple.Subject.Data, msg.subject)
  assert.equal(
    seen.body.Content.Simple.Body.Text.Charset,
    'UTF-8',
    'a name with an accent in it must not arrive as mojibake',
  )
})

test('ses: an unverified sender is not retried forever', async () => {
  // What SES actually returns while the account is still in the sandbox.
  const { result } = await capture(
    sesEnv,
    () =>
      new Response(JSON.stringify({ message: 'Email address is not verified.' }), {
        status: 400,
      }),
  )
  assert.equal(result.ok, false)
  assert.equal(
    result.ok === false && result.retryable,
    false,
    'the same rejected message must not be re-queued',
  )
})

test('ses: throttling is retried', async () => {
  const { result } = await capture(sesEnv, () => new Response('slow down', { status: 429 }))
  assert.equal(result.ok === false && result.retryable, true)
})

test('ses: half-configured credentials fall back to console, never crash', async () => {
  // A deploy that sets the key id but forgets the secret must still boot.
  const provider = mailer({
    ...base,
    MAIL_PROVIDER: 'ses',
    SES_ACCESS_KEY_ID: 'AKIA...',
  } as unknown as Env)
  assert.equal(provider.name, 'console')
})

/* ------------------------------------------------------------------ *
 * ZeptoMail — the provider that replaced SES when AWS declined
 * ------------------------------------------------------------------ */

test('zeptomail: posts to the India endpoint with Zoho’s own auth scheme', async () => {
  const { seen, result } = await capture(
    { ...base, MAIL_PROVIDER: 'zeptomail', ZEPTOMAIL_TOKEN: 'wSsV...key', ZEPTOMAIL_REGION: 'in' },
    () => new Response(JSON.stringify({ request_id: 'req_1' }), { status: 201 }),
  )

  assert.equal(seen.url, 'https://api.zeptomail.in/v1.1/email')
  // Not `Bearer`. Sending a bearer token here fails with a 401 that reads
  // exactly like a wrong key, which is an afternoon nobody gets back.
  assert.equal(seen.auth, 'Zoho-enczapikey wSsV...key')

  assert.equal(seen.body.from.address, 'no-reply@pyrexiaaiims.com')
  assert.equal(seen.body.to[0].email_address.address, 'aarav@example.edu')
  assert.equal(seen.body.to[0].email_address.name, 'Aarav Sharma')
  assert.equal(seen.body.reply_to[0].address, 'pyrexia@aiimsrishikesh.edu.in')
  assert.equal(seen.body.subject, "You're aboard")
  assert.equal(seen.body.htmlbody, '<p>hello</p>')
  assert.equal(seen.body.textbody, 'hello')

  assert.deepEqual(result, { ok: true, id: 'req_1' })
})

test('zeptomail: the region picks the data centre, not a query parameter', async () => {
  const { seen } = await capture(
    { ...base, MAIL_PROVIDER: 'zeptomail', ZEPTOMAIL_TOKEN: 'k', ZEPTOMAIL_REGION: 'com' },
    () => new Response('{}', { status: 201 }),
  )
  assert.equal(seen.url, 'https://api.zeptomail.com/v1.1/email')
})

test('zeptomail: an unverified sender is not retried, throttling is', async () => {
  const bad = await capture(
    { ...base, MAIL_PROVIDER: 'zeptomail', ZEPTOMAIL_TOKEN: 'k' },
    () => new Response('{"error":{"code":"TM_3201"}}', { status: 400 }),
  )
  assert.equal(bad.result.ok, false)
  assert.equal((bad.result as { retryable: boolean }).retryable, false)

  const throttled = await capture(
    { ...base, MAIL_PROVIDER: 'zeptomail', ZEPTOMAIL_TOKEN: 'k' },
    () => new Response('slow down', { status: 429 }),
  )
  assert.equal((throttled.result as { retryable: boolean }).retryable, true)
})

test('mailgun: form-encoded, Basic auth, and the reply-to goes in a header', async () => {
  const original = globalThis.fetch
  let seen: { url: string; body: string; auth: string | null } | null = null
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    seen = {
      url: String(url),
      body: String(init.body),
      auth: new Headers(init.headers).get('Authorization'),
    }
    return new Response(JSON.stringify({ id: '<a@b>' }), { status: 200 })
  }) as typeof fetch
  try {
    const result = await mailer({
      ...base,
      MAIL_PROVIDER: 'mailgun',
      MAILGUN_API_KEY: 'key-1',
      MAILGUN_DOMAIN: 'pyrexiaaiims.com',
    } as unknown as Env).send(msg)

    const got = seen as unknown as { url: string; body: string; auth: string | null }
    assert.equal(got.url, 'https://api.mailgun.net/v3/pyrexiaaiims.com/messages')
    assert.equal(got.auth, `Basic ${btoa('api:key-1')}`)
    const form = new URLSearchParams(got.body)
    assert.equal(form.get('to'), 'Aarav Sharma <aarav@example.edu>')
    assert.equal(form.get('h:Reply-To'), 'pyrexia@aiimsrishikesh.edu.in')
    assert.equal(result.ok, true)
  } finally {
    globalThis.fetch = original
  }
})

test('a provider named without its key is reported, not silently logged', async () => {
  // The failure this guards against: MAIL_PROVIDER is flipped to zeptomail in
  // wrangler.toml, the secret is never set, and every confirmation email goes
  // quietly into a log file while registration looks fine.
  const errors: string[] = []
  const original = console.error
  console.error = (line: string) => errors.push(String(line))
  try {
    const provider = mailer({ ...base, MAIL_PROVIDER: 'zeptomail' } as unknown as Env)
    assert.equal(provider.name, 'console', 'it must still boot')
    assert.equal((await provider.send(msg)).ok, true, 'and must not fail the queue')
    assert.equal(errors.length, 1)
    const logged = JSON.parse(errors[0])
    assert.match(logged.mail, /NOT SENT/)
    assert.equal(logged.provider, 'zeptomail')
    assert.match(logged.fix, /ZEPTOMAIL_TOKEN/)
  } finally {
    console.error = original
  }
})

test('zeptomail: a token pasted with its header prefix still works', async () => {
  // Zoho's console shows `Authorization: Zoho-enczapikey wSsV…` and its copy
  // button takes the lot. Doubling the prefix is a 401 that looks like a bad
  // key, so the prefix is stripped rather than trusted.
  const { seen } = await capture(
    {
      ...base,
      MAIL_PROVIDER: 'zeptomail',
      ZEPTOMAIL_TOKEN: '  Zoho-enczapikey wSsVR60k= ',
    },
    () => new Response('{}', { status: 201 }),
  )
  assert.equal(seen.auth, 'Zoho-enczapikey wSsVR60k=')
})

/* ------------------------------------------------------------------ *
 * SMTP — the launch-day path, no signup and no DNS
 * ------------------------------------------------------------------ */

test('smtp: the factory takes it when host, user and password are all present', () => {
  const provider = mailer({
    ...base,
    MAIL_PROVIDER: 'smtp',
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_USER: 'pyrexia@example.com',
    SMTP_PASS: 'app-password',
  } as unknown as Env)
  assert.equal(provider.name, 'smtp')
})

test('smtp: a half-filled config falls back rather than dialling with no password', () => {
  const provider = mailer({
    ...base,
    MAIL_PROVIDER: 'smtp',
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_USER: 'pyrexia@example.com',
  } as unknown as Env)
  assert.equal(provider.name, 'console')
})

test('smtp: the message it builds is one a mail server will accept', async () => {
  const { buildMime } = await import('./smtp.ts')
  const mime = buildMime(msg, 'no-reply@pyrexiaaiims.com', 'PYREXIA 2026')

  // Headers, and CRLF line endings throughout — LF alone is the single most
  // common reason a hand-built message is rejected or silently mangled.
  assert.match(mime, /^From: "PYREXIA 2026" <no-reply@pyrexiaaiims\.com>\r\n/)
  assert.match(mime, /\r\nTo: "Aarav Sharma" <aarav@example\.edu>\r\n/)
  assert.match(mime, /\r\nReply-To: pyrexia@aiimsrishikesh\.edu\.in\r\n/)
  assert.match(mime, /\r\nMessage-ID: <[0-9a-f-]+@pyrexiaaiims\.com>\r\n/)
  assert.equal(mime.includes('\n\n'), false, 'no bare LF anywhere')

  // Both alternatives present, and the boundary closes.
  const boundary = /boundary="(pyx_[0-9a-f]+)"/.exec(mime)?.[1]
  assert.ok(boundary, 'a multipart boundary was declared')
  assert.equal(mime.split(`--${boundary}`).length - 1, 3, 'two parts and a closing marker')
  assert.match(mime, /Content-Type: text\/plain; charset=UTF-8/)
  assert.match(mime, /Content-Type: text\/html; charset=UTF-8/)
  assert.match(mime, new RegExp(`--${boundary}--$`))

  // Bodies are base64 — which is also what guarantees no body line can start
  // with a full stop and end the DATA block early.
  const parts = mime.split(`--${boundary}`)
  for (const part of parts.slice(1, 3)) {
    const body = part.split('\r\n\r\n')[1]
    assert.match(body, /^[A-Za-z0-9+/=\r\n]+$/, 'base64 only')
    assert.equal(/^\./m.test(body), false, 'no line begins with a full stop')
    for (const line of body.split('\r\n')) assert.ok(line.length <= 76, 'wrapped at 76 columns')
  }
  assert.equal(Buffer.from(parts[1].split('\r\n\r\n')[1], 'base64').toString(), 'hello')
})

test('smtp: a non-ASCII subject is encoded, not sent raw', async () => {
  const { buildMime } = await import('./smtp.ts')
  const mime = buildMime(
    { ...msg, subject: 'PYREXIA 2026 · Pirates of the Lost Island' },
    'no-reply@pyrexiaaiims.com',
    'PYREXIA 2026',
  )
  const line = /\r\nSubject: (.*)\r\n/.exec(mime)?.[1] ?? ''
  assert.match(line, /^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/, 'RFC 2047 encoded-word')
  assert.equal(
    Buffer.from(/\?B\?(.*)\?=/.exec(line)![1], 'base64').toString(),
    'PYREXIA 2026 · Pirates of the Lost Island',
  )
})

test('smtp: the sender is the mailbox that signed in, not MAIL_FROM_EMAIL', async () => {
  // MAIL_FROM_EMAIL is right for every hosted provider and wrong here: Gmail
  // refuses a MAIL FROM the authenticated account does not own, so honouring
  // it would fail every send with a 5xx that looks like a bad password.
  const { buildMime } = await import('./smtp.ts')
  const provider = mailer({
    ...base,
    MAIL_FROM_EMAIL: 'no-reply@pyrexiaaiims.com',
    MAIL_PROVIDER: 'smtp',
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_USER: 'pyrexia.aiims@gmail.com',
    SMTP_PASS: 'app-password',
  } as unknown as Env)
  assert.equal(provider.name, 'smtp')
  const from = (provider as unknown as { config: { fromEmail: string } }).config.fromEmail
  assert.equal(from, 'pyrexia.aiims@gmail.com')

  // And a verified send-as alias still wins when it is set explicitly.
  const aliased = mailer({
    ...base,
    MAIL_PROVIDER: 'smtp',
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_USER: 'pyrexia.aiims@gmail.com',
    SMTP_PASS: 'p',
    SMTP_FROM: 'pyrexia@aiimsrishikesh.edu.in',
  } as unknown as Env)
  assert.equal(
    (aliased as unknown as { config: { fromEmail: string } }).config.fromEmail,
    'pyrexia@aiimsrishikesh.edu.in',
  )
  assert.match(buildMime(msg, 'a@b.com', 'X'), /^From: "X" <a@b\.com>/)
})
