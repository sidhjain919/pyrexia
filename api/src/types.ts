/** Worker bindings and secrets, as declared in wrangler.toml. */
export type Env = {
  DB: D1Database
  /** Not bound yet — R2 needs enabling on the account. Document upload is unbuilt. */
  DOCS?: R2Bucket
  KV: KVNamespace
  JOBS: Queue<Job>

  ENVIRONMENT: string
  /** Where the site lives, for links inside emails. */
  SITE_URL: string
  /** 'console' (log only) or 'brevo' (real delivery). */
  MAIL_PROVIDER: string
  MAIL_FROM_EMAIL: string
  MAIL_FROM_NAME: string
  /** Replies land here, which is not where we send from. */
  MAIL_REPLY_TO: string
  BREVO_API_KEY: string
  /** Which signing key new passes are minted with. */
  PASS_KEY_ID: string

  RAZORPAY_KEY_ID: string
  RAZORPAY_KEY_SECRET: string
  RAZORPAY_WEBHOOK_SECRET: string
  /** Ed25519 private key, base64url PKCS#8. Read only by the signing helper. */
  PASS_SIGNING_KEY_V1: string
  /** Its public half, base64url raw. Not a secret — the guard app needs it. */
  PASS_PUBLIC_KEY_V1: string
  SESSION_SECRET: string
  DOC_ENCRYPTION_KEY: string
}

/** Anything slow enough that a student should not wait on it. */
export type Job =
  | { kind: 'email.registration_confirmed'; registrationId: string; orderId: string }
  | { kind: 'email.sign_in_link'; registrationId: string; token: string }
  | { kind: 'email.payment_failed'; registrationId: string; orderId: string }
  | { kind: 'pass.render_pdf'; passId: string }

export type Tier = 0 | 1
