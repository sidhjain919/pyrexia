/**
 * Where Amazon tells us an email failed.
 *
 * SES reports bounces and complaints through SNS, which POSTs them here. Two
 * things happen with each one: it is written to `email_events`, which is the
 * permanent record, and: for the failures that will never succeed, the
 * address goes on the suppression list so we stop writing to it.
 *
 * The distinction matters. A full mailbox is a *transient* bounce and clears
 * on its own; suppressing it would lock a paying student out of their own
 * pass. A non-existent address is *permanent* and will never accept mail, and
 * continuing to try is what destroys a sending reputation.
 *
 * A complaint: someone pressing "spam": is always final, whatever we think
 * of it.
 */

import { Hono } from 'hono'

import type { Env } from '../types.ts'
import { verifySnsMessage, type SnsMessage } from '../lib/sns.ts'

export const ses = new Hono<{ Bindings: Env }>()

type SesNotification = {
  notificationType?: string
  eventType?: string
  bounce?: {
    bounceType?: string
    bounceSubType?: string
    bouncedRecipients?: { emailAddress?: string; diagnosticCode?: string }[]
  }
  complaint?: {
    complaintFeedbackType?: string
    complainedRecipients?: { emailAddress?: string }[]
  }
  mail?: { destination?: string[] }
}

async function record(
  env: Env,
  email: string,
  event: string,
  subtype: string | null,
  detail: string | null,
) {
  await env.DB.prepare(
    `INSERT INTO email_events (id, email, event, subtype, detail)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(crypto.randomUUID(), email.toLowerCase(), event, subtype, detail)
    .run()
}

async function suppress(env: Env, email: string, reason: string, detail: string | null) {
  await env.DB.prepare(
    `INSERT INTO email_suppressions (email, reason, detail) VALUES (?, ?, ?)
     ON CONFLICT (email) DO UPDATE SET reason = excluded.reason, detail = excluded.detail`,
  )
    .bind(email.toLowerCase(), reason, detail)
    .run()
}

ses.post('/ses', async (c) => {
  const raw = await c.req.text()

  let message: SnsMessage
  try {
    message = JSON.parse(raw) as SnsMessage
  } catch {
    return c.text('bad json', 400)
  }

  // Only our own topic. Without this, anyone who set up their own SNS topic
  // could send us signatures that verify perfectly well.
  if (c.env.SES_TOPIC_ARN && message.TopicArn !== c.env.SES_TOPIC_ARN) {
    return c.text('unknown topic', 403)
  }

  if (!(await verifySnsMessage(message))) return c.text('bad signature', 403)

  // SNS proves a subscriber is willing by asking it to fetch a one-time URL.
  if (message.Type === 'SubscriptionConfirmation' && message.SubscribeURL) {
    await fetch(message.SubscribeURL)
    console.log('ses: subscription confirmed', message.TopicArn)
    return c.text('subscribed', 200)
  }

  let payload: SesNotification
  try {
    payload = JSON.parse(message.Message) as SesNotification
  } catch {
    return c.text('ok', 200)
  }

  const kind = payload.notificationType ?? payload.eventType

  if (kind === 'Bounce' && payload.bounce) {
    const permanent = payload.bounce.bounceType === 'Permanent'
    for (const recipient of payload.bounce.bouncedRecipients ?? []) {
      const email = recipient.emailAddress
      if (!email) continue
      const detail = recipient.diagnosticCode ?? null
      await record(c.env, email, 'bounce', payload.bounce.bounceType ?? null, detail)
      // Only permanent failures. A mailbox that was full this morning is not
      // a reason to cut someone off from their pass forever.
      if (permanent) await suppress(c.env, email, 'bounce', detail)
    }
    return c.text('ok', 200)
  }

  if (kind === 'Complaint' && payload.complaint) {
    for (const recipient of payload.complaint.complainedRecipients ?? []) {
      const email = recipient.emailAddress
      if (!email) continue
      const type = payload.complaint.complaintFeedbackType ?? null
      await record(c.env, email, 'complaint', type, null)
      // Someone asked not to hear from us. That is not ours to second-guess.
      await suppress(c.env, email, 'complaint', type)
    }
    return c.text('ok', 200)
  }

  // Deliveries and everything else: logged, nothing suppressed.
  for (const email of payload.mail?.destination ?? []) {
    await record(c.env, email, String(kind ?? 'unknown').toLowerCase(), null, null)
  }

  return c.text('ok', 200)
})
