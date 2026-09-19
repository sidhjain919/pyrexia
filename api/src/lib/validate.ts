/**
 * Input validation for the forms that write a person into the database: the
 * registration form, and the accommodation booking form below it.
 *
 * These rules deliberately mirror the ones the React form applies, because the
 * browser's copy is a courtesy and this one is the enforcement. Anything that
 * reaches the database has been through here.
 */

export type FieldErrors = Record<string, string>

export type RegistrationInput = {
  name: string
  email: string
  phone: string
  gender: string
  college: string
  city: string
  course: string
  year: string
  emergencyName: string
  emergencyPhone: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
/** Indian mobile numbers start 6–9 and run to ten digits. */
const PHONE_RE = /^[6-9]\d{9}$/

export const YEARS = [
  '1st', '2nd', '3rd', '4th', '5th', 'Intern', 'Postgraduate', 'Not a student',
] as const

export const GENDERS = ['Female', 'Male', 'Other', 'Prefer not to say'] as const

/** Strip anything that isn't a digit, then drop a +91 or leading 0 if present. */
export function normalisePhone(raw: string): string {
  const digits = (raw ?? '').replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1)
  return digits
}

export function normaliseEmail(raw: string): string {
  return (raw ?? '').trim().toLowerCase()
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

/**
 * Common domain typos, caught at the door.
 *
 * Without WhatsApp or SMS in the loop, a mistyped address means someone pays
 * and then cannot be reached and cannot recover on their own. This catches the
 * overwhelming majority of those before any money moves.
 */
const DOMAIN_TYPOS: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'yahho.com': 'yahoo.com',
  'yaho.com': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  'hotmial.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'rediffmial.com': 'rediffmail.com',
}

/**
 * Suggest a correction, or null if the address looks fine.
 *
 * Only ever a suggestion: plenty of real institutional domains look like typos
 * of nothing, so this must never block a submission.
 */
export function suggestEmailFix(email: string): string | null {
  const at = email.lastIndexOf('@')
  if (at < 0) return null
  const domain = email.slice(at + 1).toLowerCase()
  const fixed = DOMAIN_TYPOS[domain]
  return fixed ? `${email.slice(0, at)}@${fixed}` : null
}

export function validateRegistration(body: unknown): {
  ok: boolean
  errors: FieldErrors
  value: RegistrationInput
} {
  const b = (body ?? {}) as Record<string, unknown>
  const errors: FieldErrors = {}

  const value: RegistrationInput = {
    name: str(b.name),
    email: normaliseEmail(str(b.email)),
    phone: normalisePhone(str(b.phone)),
    gender: str(b.gender),
    college: str(b.college),
    city: str(b.city),
    course: str(b.course),
    year: str(b.year),
    emergencyName: str(b.emergencyName),
    emergencyPhone: normalisePhone(str(b.emergencyPhone)),
  }

  if (value.name.length < 2) errors.name = 'Tell us your name.'
  if (value.name.length > 120) errors.name = 'That name is too long.'

  if (!EMAIL_RE.test(value.email)) errors.email = 'A valid email keeps you on the manifest.'
  if (value.email.length > 200) errors.email = 'That email is too long.'

  if (!PHONE_RE.test(value.phone)) errors.phone = 'A 10-digit Indian mobile number.'

  if (value.gender && !GENDERS.includes(value.gender as (typeof GENDERS)[number])) {
    errors.gender = 'Pick one of the listed options.'
  }

  if (value.college.length < 2) errors.college = 'Which port do you sail from?'
  if (value.city.length < 2) errors.city = 'Your city.'
  if (value.course.length < 2) errors.course = 'e.g. MBBS, BSc Nursing.'

  if (!YEARS.includes(value.year as (typeof YEARS)[number])) {
    errors.year = 'Pick your year of study.'
  }

  if (value.emergencyName.length < 2) errors.emergencyName = 'An emergency contact name.'
  if (!PHONE_RE.test(value.emergencyPhone)) errors.emergencyPhone = 'A 10-digit number.'

  // An emergency contact who is also you is not an emergency contact.
  if (value.emergencyPhone && value.emergencyPhone === value.phone) {
    errors.emergencyPhone = 'Use someone other than yourself.'
  }

  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'string' && v.length > 500) errors[k] = 'That value is too long.'
  }

  return { ok: Object.keys(errors).length === 0, errors, value }
}

/* ------------------------------------------------------------------ *
 * Accommodation
 * ------------------------------------------------------------------ */

export type AccommodationContact = {
  name: string
  email: string
  phone: string
  college: string
  course: string
  /** Free text: ground floor, a medical condition, anything the team should know. */
  requirements: string
  /** Free text on purpose: "late evening" beats a precise number somebody invented. */
  arrivalTime: string
  rulesAccepted: boolean
  partnerConsent: boolean
}

/**
 * The part of an accommodation booking that is about the person.
 *
 * The room, the length of the stay and the arrival date are not checked here:
 * those are priced by `data/accommodation.ts`, which is the only thing that
 * knows which rooms exist and what they cost, and it refuses anything it
 * cannot price.
 *
 * These fields arrive prefilled from the registration and are editable, which
 * is the point: the number somebody carries at a fest is frequently not the
 * one they signed up with, and the desk needs the one that will be answered.
 */
export function validateAccommodation(body: unknown): {
  ok: boolean
  errors: FieldErrors
  value: AccommodationContact
} {
  const b = (body ?? {}) as Record<string, unknown>
  const errors: FieldErrors = {}

  const value: AccommodationContact = {
    name: str(b.name),
    email: normaliseEmail(str(b.email)),
    phone: normalisePhone(str(b.phone)),
    college: str(b.college),
    course: str(b.course),
    requirements: str(b.requirements).slice(0, 600),
    arrivalTime: str(b.arrivalTime).slice(0, 60),
    rulesAccepted: b.rulesAccepted === true,
    partnerConsent: b.partnerConsent === true,
  }

  if (value.name.length < 2) errors.name = 'Tell us your name.'
  if (value.name.length > 120) errors.name = 'That name is too long.'

  if (!EMAIL_RE.test(value.email)) errors.email = 'The receipt has to reach you somewhere.'
  if (value.email.length > 200) errors.email = 'That email is too long.'

  // The number the desk rings when somebody has not turned up by midnight.
  if (!PHONE_RE.test(value.phone)) errors.phone = 'A 10-digit Indian mobile number.'

  if (value.college.length < 2) errors.college = 'Which port do you sail from?'
  if (value.course.length < 2) errors.course = 'e.g. MBBS, BSc Nursing.'

  // Both refused rather than defaulted. The terms behind them have teeth: a
  // cancellation is not refunded, and damage is charged against the deposit.
  if (!value.rulesAccepted) errors.rulesAccepted = 'Please read and accept the house rules.'
  if (!value.partnerConsent) {
    errors.partnerConsent = 'We need this to hand your booking to the hotel.'
  }

  return { ok: Object.keys(errors).length === 0, errors, value }
}
