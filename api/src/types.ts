/** Worker bindings and secrets, as declared in wrangler.toml. */
export type Env = {
  DB: D1Database
  /** Private bucket for identity documents and photos. No public access, ever. */
  DOCS: R2Bucket
  KV: KVNamespace
  JOBS: Queue<Job>

  ENVIRONMENT: string
  /** Where the site lives, for links inside emails. */
  SITE_URL: string
  /** 'console' (log only), 'resend', or 'brevo'. */
  MAIL_PROVIDER: string
  MAIL_FROM_EMAIL: string
  MAIL_FROM_NAME: string
  /** Replies land here, which is not where we send from. */
  MAIL_REPLY_TO: string
  BREVO_API_KEY: string
  RESEND_API_KEY: string
  SES_ACCESS_KEY_ID: string
  SES_SECRET_ACCESS_KEY: string
  SES_REGION: string
  SES_TOPIC_ARN: string
  GOOGLE_CLIENT_ID: string
  /** Which signing key new passes are minted with. */
  PASS_KEY_ID: string

  RAZORPAY_KEY_ID: string
  RAZORPAY_KEY_SECRET: string
  RAZORPAY_WEBHOOK_SECRET: string
  /** Ed25519 private key, base64url PKCS#8. Read only by the signing helper. */
  PASS_SIGNING_KEY_V1: string
  /** Its public half, base64url raw. Not a secret, the guard app needs it. */
  PASS_PUBLIC_KEY_V1: string
  SESSION_SECRET: string
  DOC_ENCRYPTION_KEY: string
}

/** Anything slow enough that a student should not wait on it. */
export type Job =
  | { kind: 'email.registration_confirmed'; registrationId: string; orderId: string }
  | { kind: 'email.sign_in_link'; registrationId: string; token: string }
  | { kind: 'email.verify_code'; registrationId: string; code: string }
  | { kind: 'email.reset_password'; registrationId: string; token: string }
  | { kind: 'email.payment_failed'; registrationId: string; orderId: string }
  | { kind: 'pass.render_pdf'; passId: string }

export type Tier = 0 | 1
