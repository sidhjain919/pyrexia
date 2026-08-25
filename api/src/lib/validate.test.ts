import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  normaliseEmail,
  normalisePhone,
  suggestEmailFix,
  validateRegistration,
} from './validate.ts'

const GOOD = {
  name: 'Aarav Sharma',
  email: 'aarav@example.edu',
  phone: '9876543210',
  gender: 'Male',
  college: 'AIIMS Rishikesh',
  city: 'Rishikesh',
  course: 'MBBS',
  year: '3rd',
  emergencyName: 'Priya Sharma',
  emergencyPhone: '9123456780',
}

test('a complete form passes', () => {
  const { ok, errors } = validateRegistration(GOOD)
  assert.equal(ok, true, JSON.stringify(errors))
})

test('phone numbers are normalised before they are judged', () => {
  assert.equal(normalisePhone('+91 98765 43210'), '9876543210')
  assert.equal(normalisePhone('09876543210'), '9876543210')
  assert.equal(normalisePhone('98765-43210'), '9876543210')
  assert.equal(normalisePhone('919876543210'), '9876543210')

  // So a perfectly good number typed in any of those styles is accepted.
  const { ok, value } = validateRegistration({ ...GOOD, phone: '+91 98765 43210' })
  assert.equal(ok, true)
  assert.equal(value.phone, '9876543210')
})

test('Indian mobile rules are enforced', () => {
  for (const phone of ['1234567890', '5876543210', '98765', '98765432101', 'abcdefghij']) {
    const { ok, errors } = validateRegistration({ ...GOOD, phone })
    assert.equal(ok, false, `should reject ${phone}`)
    assert.ok(errors.phone)
  }
})

test('an emergency contact cannot be the registrant', () => {
  const { ok, errors } = validateRegistration({ ...GOOD, emergencyPhone: GOOD.phone })
  assert.equal(ok, false)
  assert.match(errors.emergencyPhone, /other than yourself/)
})

test('emails are lower-cased and trimmed so duplicates cannot slip through', () => {
  assert.equal(normaliseEmail('  Aarav@Example.EDU '), 'aarav@example.edu')

  const { value } = validateRegistration({ ...GOOD, email: '  Aarav@Example.EDU ' })
  assert.equal(value.email, 'aarav@example.edu')
})

test('obviously broken emails are rejected', () => {
  for (const email of ['not-an-email', 'a@b', 'a@b.c', '@example.com', 'a b@example.com']) {
    const { ok } = validateRegistration({ ...GOOD, email })
    assert.equal(ok, false, `should reject ${email}`)
  }
})

test('common domain typos are suggested, never enforced', () => {
  assert.equal(suggestEmailFix('aarav@gmial.com'), 'aarav@gmail.com')
  assert.equal(suggestEmailFix('aarav@yahho.com'), 'aarav@yahoo.com')
  assert.equal(suggestEmailFix('aarav@gmail.con'), 'aarav@gmail.com')

  // A real institutional domain must never be "corrected".
  assert.equal(suggestEmailFix('aarav@aiimsrishikesh.edu.in'), null)
  assert.equal(suggestEmailFix('aarav@gmail.com'), null)

  // And a typo'd address still validates — the suggestion is advisory only,
  // because blocking on it would reject legitimate addresses we've not heard of.
  assert.equal(validateRegistration({ ...GOOD, email: 'aarav@gmial.com' }).ok, true)
})

test('year must come from the list', () => {
  assert.equal(validateRegistration({ ...GOOD, year: '3rd' }).ok, true)
  assert.equal(validateRegistration({ ...GOOD, year: 'Intern' }).ok, true)
  assert.equal(validateRegistration({ ...GOOD, year: 'seventh' }).ok, false)
  assert.equal(validateRegistration({ ...GOOD, year: '' }).ok, false)
})

test('gender is optional but constrained when given', () => {
  assert.equal(validateRegistration({ ...GOOD, gender: '' }).ok, true)
  assert.equal(validateRegistration({ ...GOOD, gender: 'Prefer not to say' }).ok, true)
  assert.equal(validateRegistration({ ...GOOD, gender: 'whatever' }).ok, false)
})

test('missing required fields are reported together, not one at a time', () => {
  const { ok, errors } = validateRegistration({})
  assert.equal(ok, false)
  for (const field of ['name', 'email', 'phone', 'college', 'city', 'course', 'year']) {
    assert.ok(errors[field], `expected an error for ${field}`)
  }
})

test('absurd input is rejected rather than stored', () => {
  const { ok, errors } = validateRegistration({ ...GOOD, college: 'x'.repeat(600) })
  assert.equal(ok, false)
  assert.ok(errors.college)
})

test('non-object and hostile bodies do not throw', () => {
  for (const body of [null, undefined, 'a string', 42, [], { name: { nested: true } }]) {
    const { ok } = validateRegistration(body)
    assert.equal(ok, false, `should reject ${JSON.stringify(body)}`)
  }
})
