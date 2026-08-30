import { test } from 'node:test'
import assert from 'node:assert/strict'

import { paymentFailed, registrationConfirmed, signInLink } from './templates.ts'

const PASS_URL = 'https://example.test/#/enter?token=abc123&next=%2Fpass'

test('the confirmation carries the number, the amount and the link', () => {
  const mail = registrationConfirmed({
    name: 'Aarav Sharma',
    publicCode: 'PYX26-4KD9TQ',
    tierName: 'Basic Registration',
    amountPaise: 50000,
    passUrl: PASS_URL,
  })

  for (const body of [mail.html, mail.text]) {
    assert.match(body, /PYX26-4KD9TQ/, 'registration number must appear')
    assert.match(body, /₹500/, 'the amount they paid must appear')
    assert.match(body, /Basic Registration/)
    assert.match(body, /token=abc123/, 'the sign-in link must appear')
  }

  // In HTML an ampersand inside an attribute has to be written `&amp;`, the
  // browser decodes it back, so the link still works. The text version keeps
  // the raw URL, because there is nothing to decode it.
  assert.ok(mail.html.includes(PASS_URL.replace(/&/g, '&amp;')), 'href must be entity-escaped')
  assert.ok(mail.text.includes(PASS_URL), 'text version keeps the URL verbatim')

  assert.match(mail.subject, /PYX26-4KD9TQ/, 'the subject should be searchable in an inbox')
  assert.match(mail.html, /Aarav/, 'greets them by first name')
})

test('a Delegate sees ₹2,700, formatted for India', () => {
  const mail = registrationConfirmed({
    name: 'Meera Nair',
    publicCode: 'PYX26-D90T8M',
    tierName: 'Festival Pass',
    amountPaise: 270000,
    passUrl: PASS_URL,
  })

  assert.match(mail.text, /₹2,70,000|₹2,700/, `got: ${mail.text.match(/₹[\d,]+/)?.[0]}`)
  assert.match(mail.text, /Festival Pass/)
})

test('a name containing HTML cannot break the message', () => {
  const mail = registrationConfirmed({
    name: '<script>alert(1)</script>Rahul',
    publicCode: 'PYX26-AAAAAA',
    tierName: 'Basic Registration',
    amountPaise: 45000,
    passUrl: PASS_URL,
  })

  assert.doesNotMatch(mail.html, /<script>/, 'the tag must be escaped, not rendered')
  assert.match(mail.html, /&lt;script&gt;/)
})

test('the sign-in link says it is single-use and when it dies', () => {
  const url = 'https://example.test/#/enter?token=xyz'
  const mail = signInLink({ name: 'Aarav Sharma', url, minutes: 30 })

  for (const body of [mail.html, mail.text]) {
    assert.ok(body.includes(url))
    assert.match(body, /30 minutes/)
    assert.match(body, /once/i, 'should say the link works once')
    assert.match(body, /ignore this email/i, 'people who did not ask must be told what to do')
  }
})

test('a failed payment reassures before it asks', () => {
  const mail = paymentFailed({
    name: 'Aarav Sharma',
    amountPaise: 45000,
    retryUrl: 'https://example.test/#/register',
  })

  for (const body of [mail.html, mail.text]) {
    assert.match(body, /No money has left your account/i, 'the first worry must be answered first')
    assert.match(body, /reverse/i, 'explains a pending bank deduction')
    assert.ok(body.includes('https://example.test/#/register'))
  }
})

test('every email has a working plain-text twin', () => {
  const mails = [
    registrationConfirmed({ name: 'A B', publicCode: 'PYX26-XXXXXX', tierName: 'Basic Registration', amountPaise: 45000, passUrl: PASS_URL }),
    signInLink({ name: 'A B', url: PASS_URL, minutes: 30 }),
    paymentFailed({ name: 'A B', amountPaise: 45000, retryUrl: PASS_URL }),
  ]

  for (const mail of mails) {
    assert.ok(mail.text.length > 80, 'text version must be substantive, not a stub')
    assert.doesNotMatch(mail.text, /<[a-z]/i, 'text version must contain no markup')
    assert.ok(mail.subject.length > 0 && mail.subject.length < 90, 'subject must fit an inbox column')
  }
})

test('the HTML is self-contained and survives Gmail', () => {
  const mail = registrationConfirmed({
    name: 'A B', publicCode: 'PYX26-XXXXXX', tierName: 'Basic Registration',
    amountPaise: 45000, passUrl: PASS_URL,
  })

  assert.doesNotMatch(mail.html, /<style/i, 'Gmail strips style blocks, everything must be inline')
  assert.doesNotMatch(mail.html, /<img/i, 'no images: clients block them and a baked-in QR goes stale')
  assert.match(mail.html, /style="/, 'styling has to be inline attributes')
  assert.match(mail.html, /<!doctype html>/i)
})
