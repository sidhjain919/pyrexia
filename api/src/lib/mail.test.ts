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

test('brevo still works — switching provider is a config change', async () => {
  const { seen, result } = await capture(
    { ...base, MAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'xkeysib-test' },
    () => new Response(JSON.stringify({ messageId: 'brevo_1' }), { status: 200 }),
  )
  assert.equal(result.ok, true)
  assert.equal(seen.url, 'https://api.brevo.com/v3/smtp/email')
  assert.equal(seen.body.sender.email, 'no-reply@pyrexiaaiims.com', 'brevo splits name and address')
})
