import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  accommodationConfirmed,
  eventEntered,
  paymentFailed,
  registrationConfirmed,
  signInLink,
} from './templates.ts'

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

test('a confirmed registration is pointed at the announcement channel', () => {
  const mail = registrationConfirmed({
    name: 'Aarav Sharma',
    publicCode: 'PYX26-ABC123',
    tierName: 'Festival Pass',
    amountPaise: 270000,
    passUrl: 'https://pyrexiaaiims.com/pass?t=x',
  })

  for (const body of [mail.html, mail.text]) {
    assert.match(body, /whatsapp\.com\/channel\/0029VbCwmsD7Noa8sdKrYm32/)
    // The mute warning has to travel with the link: a channel somebody joins
    // and never hears from is the same as one they never joined.
    assert.match(body, /muted by default/)
    assert.match(body, /unmute this channel manually/)
  }

  // The pass is still the primary action; the channel does not displace it.
  assert.match(mail.html, /View my pass/)
  assert.match(mail.text, /PYX26-ABC123/)
})

/* ------------------------------------------------------------------ *
 * Event entry
 * ------------------------------------------------------------------ */

test('a paid event entry is announced as an entry, never as a pass upgrade', () => {
  const mail = eventEntered({
    name: 'Meera Nair',
    publicCode: 'PYX26-D90T8M',
    eventName: 'Table Tennis',
    territory: 'Conquest Arena',
    band: 'Mixed doubles',
    teamName: 'Backhand Buccaneers',
    headCount: 2,
    amountPaise: 35000,
    passUrl: PASS_URL,
  })

  for (const body of [mail.html, mail.text, mail.subject]) {
    // The bug this replaced: an entry order has no line items and follows an
    // earlier paid order, which the registration mail reads as an upgrade. A
    // student who paid ₹350 for badminton was told their Festival Pass was
    // ready. Nothing here may ever say that again.
    assert.doesNotMatch(body, /upgrade/i, 'an entry is not an upgrade')
  }

  for (const body of [mail.html, mail.text]) {
    assert.match(body, /Table Tennis/, 'the event must be named')
    assert.match(body, /Mixed doubles/, 'the bracket they actually paid for')
    assert.match(body, /Backhand Buccaneers/, 'the crew name')
    assert.match(body, /₹350/, 'what they paid')
    assert.match(body, /PYX26-D90T8M/)
    assert.match(body, /token=abc123/)
  }

  assert.match(mail.subject, /Table Tennis/, 'searchable in an inbox')
})

test('a solo entry does not invent a crew, and a team entry says nobody else pays', () => {
  const solo = eventEntered({
    name: 'Aarav Sharma',
    publicCode: 'PYX26-4KD9TQ',
    eventName: 'Squid Game',
    territory: 'Alfresco',
    band: '',
    teamName: '',
    headCount: 1,
    amountPaise: 8000,
    passUrl: PASS_URL,
  })
  assert.doesNotMatch(solo.text, /Crew:/, 'no crew line on a solo entry')
  assert.doesNotMatch(solo.text, /People covered/, 'one person is not worth a row')
  // A single-band event prints no bracket: "Squid Game · Entry" says nothing.
  assert.match(solo.subject, /^You're entered: Squid Game$/)

  const team = eventEntered({
    name: 'Aarav Sharma',
    publicCode: 'PYX26-4KD9TQ',
    eventName: 'Nukkad Natak',
    territory: 'Thespians',
    band: '',
    teamName: 'Street Crew',
    headCount: 9,
    amountPaise: 70000,
    passUrl: PASS_URL,
  })
  assert.match(team.text, /nobody else needs to enter or pay/i)
  assert.match(team.text, /People covered: 9/)
})

test('an event name containing HTML cannot break the entry mail', () => {
  const mail = eventEntered({
    name: '<script>alert(1)</script>',
    publicCode: 'PYX26-4KD9TQ',
    eventName: '<img src=x onerror=alert(1)>',
    territory: 'Alfresco',
    band: '"><b>',
    teamName: '',
    headCount: 1,
    amountPaise: 8000,
    passUrl: PASS_URL,
  })
  // The payload must survive only as inert text. `onerror=` still appears in
  // the output as characters, which is fine and is the point: it is inside an
  // escaped `&lt;img&gt;` that no mail client will ever parse as a tag.
  assert.doesNotMatch(mail.html, /<script>/, 'the tag must be escaped, not rendered')
  assert.doesNotMatch(mail.html, /<img /, 'no attacker-supplied element survives')
  assert.match(mail.html, /&lt;script&gt;/)
  assert.match(mail.html, /&lt;img src=x/)
})

test('a free entry is confirmed without being handed a receipt for zero', () => {
  const mail = eventEntered({
    name: 'Ishaan Roy',
    publicCode: 'PYX26-4KD9TQ',
    eventName: 'Treasure Hunt',
    territory: 'Carnival Cove',
    band: '',
    teamName: 'The Magpies',
    headCount: 4,
    amountPaise: 0,
    passUrl: PASS_URL,
  })

  for (const body of [mail.html, mail.text]) {
    // Most events cost nothing beyond Basic Registration. A "Paid: ₹0" line on
    // one of those reads like a failed payment rather than a free entry.
    assert.doesNotMatch(body, /₹0/, 'never quote a zero amount')
    assert.doesNotMatch(body, /Paid/, 'no paid row when nothing was paid')
    assert.doesNotMatch(body, /We received/, 'nothing was received')
    assert.match(body, /nothing to pay/i, 'say plainly that it was free')
    assert.match(body, /Treasure Hunt/)
    assert.match(body, /The Magpies/)
  }

  // Still the same confirmation otherwise, so it is searchable alongside the
  // paid ones.
  assert.match(mail.subject, /^You're entered: Treasure Hunt$/)
})

/* ------------------------------------------------------------------ *
 * Accommodation
 * ------------------------------------------------------------------ */

test('the accommodation receipt leads with the deposit that is not in the total', () => {
  const mail = accommodationConfirmed({
    name: 'Asha Rao',
    code: 'STAY-Q6HVW4',
    publicCode: 'PYX26-D90T8M',
    room: '3 seater · AC',
    days: 4,
    arrival: '13 October',
    departure: '16 October',
    roomPaise: 280000,
    amountPaise: 286608,
    depositRupees: 500,
    passUrl: PASS_URL,
  })

  for (const body of [mail.html, mail.text]) {
    assert.match(body, /STAY-Q6HVW4/, 'the reference the desk asks for')
    assert.match(body, /3 seater/)
    assert.match(body, /13 October/)
    assert.match(body, /16 October/)
    // Both numbers: the room charge, and what their bank statement will say.
    assert.match(body, /₹2,800/, 'the room charge')
    assert.match(body, /₹2,866/, 'the total actually charged')
    assert.match(body, /₹500/, 'the cash deposit')
    assert.match(body, /cash/i, 'must say the deposit is cash')
    assert.match(body, /Aadhaar/, 'what to bring to check-in')
    assert.match(body, /not refunded/i, 'the cancellation terms')
  }

  assert.match(mail.subject, /STAY-Q6HVW4/)
})
