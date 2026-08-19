import type { DelegateCategory } from '../data/registration'

/** A file the delegate uploaded, as the backend refers to it. */
export type DocumentRef = {
  /** Storage key. In the mock adapter this is a local id, never a public URL. */
  ref: string
  filename: string
  /** Bytes. */
  size: number
  mime: string
}

export type DocumentKind = 'aadhaar' | 'studentId' | 'photo'

export type DelegateStatus =
  /** Form submitted, payment not completed. */
  | 'pending_payment'
  /** Paid and verified — this is the only status that unlocks event entry. */
  | 'confirmed'
  /** Payment attempted and failed or was abandoned. */
  | 'failed'

export type DelegateInput = {
  name: string
  email: string
  phone: string
  category: DelegateCategory
  college: string
  city: string
  course: string
  year: string
  gender: string
  emergencyName: string
  emergencyPhone: string
  passId: string
  documents: Partial<Record<DocumentKind, DocumentRef>>
  /** Explicit, logged consent to store the identity documents. */
  consent: boolean
}

export type Delegate = DelegateInput & {
  /** Human-readable pass number, e.g. `PYX26-4KD9TQ`. Printed on the pass and encoded in the QR. */
  delegateId: string
  status: DelegateStatus
  createdAt: string
  paidAt?: string
  amount: number
  /** Opaque string encoded into the QR — a check-in scanner resolves it server-side. */
  qrPayload: string
}

/** What Razorpay needs to open checkout. Created server-side; never trust a client-set amount. */
export type PaymentOrder = {
  orderId: string
  amount: number
  currency: 'INR'
  /** Razorpay key id. Absent in the mock adapter, which simulates checkout instead. */
  keyId?: string
}

export type PaymentResult = {
  orderId: string
  paymentId: string
  signature: string
}

export type TeamMember = {
  name: string
  email: string
  phone: string
  /** Team-mates need their own delegate pass too; this is checked at submit. */
  delegateId: string
}

export type EventEntryInput = {
  eventName: string
  territoryCode: string
  delegateId: string
  participation: 'solo' | 'team'
  teamName?: string
  members: TeamMember[]
  answers: Record<string, string>
}

export type EventEntry = EventEntryInput & {
  entryId: string
  createdAt: string
}

export type RegistrationErrorCode =
  | 'not_found'
  | 'duplicate'
  | 'not_confirmed'
  | 'payment_failed'
  | 'upload_failed'
  | 'network'

export class RegistrationError extends Error {
  // Written out rather than a constructor parameter property: the project
  // compiles with `erasableSyntaxOnly`.
  readonly code: RegistrationErrorCode

  constructor(message: string, code: RegistrationErrorCode) {
    super(message)
    this.name = 'RegistrationError'
    this.code = code
  }
}
