# PYREXIA 2026 — API

Cloudflare Workers + Hono + D1. Handles the small, write-shaped part of the
site: registration, payments, passes and (soon) the gate. Everything public
stays static on Pages, which is what lets a launch-day rush cost nothing.

## Running it

```bash
npm install
cp .dev.vars.example .dev.vars   # fill in Razorpay TEST keys
npm run db:local                 # apply migrations to the local D1
npm run dev                      # http://localhost:8787
npm test                         # 68 tests, no network needed
npm run e2e                      # 63 checks against the deployed API
npm run typecheck
```

`.dev.vars` is gitignored and must stay that way. Production secrets go in with
`wrangler secret put NAME` and never touch the repo.

## Live

Deployed at `https://pyrexia-api.pyrexia-api.workers.dev`.

| | |
|---|---|
| D1 database | `pyrexia` (APAC) |
| KV | feature flags, rate limits |
| Queues | `pyrexia-jobs` + dead-letter |
| Cron | reconciliation, every 15 min |
| R2 | **not enabled yet** — needed only for document upload |

## Before first deploy

```bash
wrangler login                   # browser OAuth — nothing to paste anywhere
wrangler d1 create pyrexia       # paste database_id into wrangler.toml
wrangler kv namespace create KV  # paste id into wrangler.toml
wrangler r2 bucket create pyrexia-docs
wrangler queues create pyrexia-jobs
wrangler queues create pyrexia-jobs-dlq
```

Then fill `account_id` and the three `REPLACE_ME` ids in `wrangler.toml`.

## The shape of it

```
migrations/0001_init.sql   18 tables. Entitlements, not a tier column.
src/lib/pass.ts            Ed25519 pass tokens + the gate decision
src/lib/keys.ts            Key import, cached per isolate
src/lib/razorpay.ts        Orders, and the two signatures
src/lib/pricing.ts         Amounts, read from the database, never from a request
src/lib/validate.ts        Server-side form rules
src/lib/session.ts         Passwordless sign-in and sessions
src/lib/mail.ts            Provider abstraction: console (default) or Brevo
src/lib/templates.ts       The emails themselves
src/lib/idempotency.ts     Double-tap protection
src/lib/audit.ts           Append-only log
src/routes/registrations.ts  Register, upgrade, verify, poll, pass keys
src/routes/auth.ts         Request a link, spend it, sign out
src/routes/me.ts           My Voyage, and the signed pass
src/routes/webhooks.ts     Razorpay — the only place entitlements are granted
src/jobs/mail.ts           Queue consumer
src/jobs/reconcile.ts      15-minute sweep for payments the webhook missed
```

## Three rules this codebase keeps

**The browser never names a price.** A request says `products: ['basic']`. The
amount comes from the `products` table, every time. See `lib/pricing.ts`.

**The webhook is the truth, the callback is the animation.** `/api/checkout/verify`
proves a payment is real so the success screen can stop spinning. It grants
nothing. `routes/webhooks.ts` is the only file that creates an entitlement or
issues a pass — so a browser that dies mid-payment still ends up with a pass,
and a forged callback ends up with nothing.

**Everything is idempotent.** Razorpay retries for days. `UNIQUE(razorpay_payment_id)`,
`INSERT OR IGNORE` on entitlements, and `WHERE status != 'paid'` guards mean the
fiftieth delivery of an event changes exactly as much as the second: nothing.

## Payment flow

```
POST /api/registrations          → creates a pending registration + Razorpay order
   (Idempotency-Key required)      returns razorpayOrderId + public keyId
                                   ↓
        browser opens Razorpay Checkout
                                   ↓
POST /api/checkout/verify        → HMAC(order_id|payment_id) checked
                                   success screen only; grants nothing
                                   ↓
POST /webhooks/razorpay          → signature checked against the RAW body
   (from Razorpay's servers)       grants entitlements, issues the pass,
                                   queues the confirmation email
                                   ↓
cron */15 * * * *                → anything still 'created' after 30 minutes is
                                   checked against Razorpay and settled
```

`POST /api/registrations/:id/upgrade` runs the same path for someone adding the
Delegate Card later. Because Razorpay's fee is purely percentage-based, this
costs the fest exactly what selling both upfront would have.

## Turning email on

Everything is written and queued; only delivery is switched off. To send for real:

1. Create a Brevo account and verify the sender address.
2. `wrangler secret put BREVO_API_KEY`
3. Change `MAIL_PROVIDER` to `"brevo"` in `wrangler.toml`, and deploy.

Until then every message is written to the log — run `wrangler tail` and you can
read exactly what would have been sent, links included.

**Before going live**, set `ENVIRONMENT = "production"`. That is what stops
`/api/auth/request` returning the sign-in token in its response, which exists so
the flow can be tested without a mailbox.

## Not built yet

- Admin dashboard and routes
- Noticeboard
- Document upload (needs R2 enabling)
- Event entry and team invites
- Gate manifest sync and scan ingest
- Wiring the React site to this API

`lib/pass.ts` is finished and tested — the gate work is wiring, not design.
