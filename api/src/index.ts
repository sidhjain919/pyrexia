/**
 * PYREXIA 2026 API.
 *
 * Everything public is static and served from Pages; this Worker handles only
 * the small, write-shaped part of the site — registration, payments, passes and
 * the gate. That split is what lets the whole thing sit inside a $5 plan while
 * absorbing a launch-day rush.
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'

import type { Env, Job } from './types.ts'
import { ApiError } from './lib/http.ts'
import { auth } from './routes/auth.ts'
import { events } from './routes/events.ts'
import { me } from './routes/me.ts'
import { registrations } from './routes/registrations.ts'
import { webhooks } from './routes/webhooks.ts'
import { handleJob } from './jobs/mail.ts'
import { reconcileOrders } from './jobs/reconcile.ts'

const app = new Hono<{ Bindings: Env }>()

app.use('*', logger())
app.use('*', secureHeaders())

/**
 * The browser origins allowed to call this API.
 *
 * Deliberately a list rather than `*`: the API sets a session cookie, and a
 * wildcard origin with credentials is how a fest site becomes someone else's
 * CSRF demo.
 */
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5199',
  'https://sidhjain919.github.io',
  // The fest domain is added here once it exists.
]

/**
 * Outside production, also allow a dev server reached over the local network —
 * `http://192.168.1.7:5199` and the like — so the site can be opened on a phone
 * during development. Gated on ENVIRONMENT so it can never widen the real site.
 */
const PRIVATE_NETWORK =
  /^http:\/\/(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/

app.use(
  '/api/*',
  cors({
    origin: (origin, c) => {
      if (ALLOWED_ORIGINS.includes(origin)) return origin
      if (c.env.ENVIRONMENT !== 'production' && PRIVATE_NETWORK.test(origin)) return origin
      return ALLOWED_ORIGINS[0]
    },
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Idempotency-Key', 'Authorization'],
    credentials: true,
    maxAge: 86400,
  }),
)

/* ------------------------------------------------------------------ *
 * Routes
 * ------------------------------------------------------------------ */

app.get('/health', (c) =>
  c.json({ ok: true, environment: c.env.ENVIRONMENT, at: new Date().toISOString() }),
)

app.route('/api', registrations)
app.route('/api', auth)
app.route('/api', me)
app.route('/api', events)

// Razorpay posts here from its own servers, so this sits outside /api and
// outside CORS entirely. It authenticates by signature, not by origin.
app.route('/webhooks', webhooks)

/* ------------------------------------------------------------------ *
 * Errors
 * ------------------------------------------------------------------ */

app.notFound((c) => c.json({ error: { code: 'not_found', message: 'No such endpoint.' } }, 404))

app.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json(err.toJSON(), err.status as 400)
  }

  // Anything unexpected is logged in full and reported as nothing. Stack traces
  // and SQL never cross the boundary to a browser.
  console.error('unhandled error', c.req.method, c.req.path, err)
  return c.json(
    {
      error: {
        code: 'internal',
        message: 'Something went wrong on the crossing. Please try again.',
      },
    },
    500,
  )
})

/* ------------------------------------------------------------------ *
 * Worker entry points
 * ------------------------------------------------------------------ */

export default {
  fetch: app.fetch,

  /**
   * Every 15 minutes: settle anything left hanging.
   *
   * This is what rescues the student whose browser died between paying and
   * telling us — Razorpay knows the payment succeeded even when we never heard.
   */
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(reconcileOrders(env))
  },

  /**
   * Queue consumer: email, PDFs, exports. Anything that could take seconds
   * lives here rather than inside a request a student is waiting on.
   */
  async queue(batch: MessageBatch<Job>, env: Env) {
    for (const message of batch.messages) {
      try {
        await handleJob(env, message.body)
        message.ack()
      } catch (err) {
        // Hand it back with backoff. After max_retries it lands in the
        // dead-letter queue rather than disappearing.
        console.error('job failed, will retry', message.body?.kind, err)
        message.retry()
      }
    }
  },
}
