/**
 * Audit log.
 *
 * Append-only by convention and by discipline: nothing in this codebase updates
 * or deletes from `audit_log`. When money and passes are involved, the question
 * "who did this, and when?" has to have an answer that survives the person who
 * did it deciding it would be better if it didn't.
 */

import type { Env } from '../types.ts'
import { newId } from './ids.ts'

export type AuditAction =
  | 'registration.create'
  | 'registration.confirm'
  | 'order.create'
  | 'order.paid'
  | 'order.failed'
  | 'order.reconciled'
  | 'entitlement.grant'
  | 'entitlement.revoke'
  | 'pass.issue'
  | 'pass.revoke'
  | 'document.view'
  | 'document.purge'
  | 'verification.decide'
  | 'notice.publish'
  | 'flag.set'
  | 'refund.create'
  | 'guard.issue_device'
  | 'admin.login'
  | 'auth.link_requested'
  | 'auth.signed_in'
  | 'account.created'
  | 'auth.reset_requested'
  | 'auth.password_reset'
  | 'event.enter'
  | 'event.withdraw'

export type AuditEntry = {
  action: AuditAction
  entity?: string
  entityId?: string
  actorId?: string
  actorEmail?: string
  before?: unknown
  after?: unknown
  ip?: string
}

/**
 * Writing the log must never be the reason a request fails — a student's
 * payment should not be lost because an INSERT into a log table timed out. It
 * is therefore fire-and-forget, and failures are surfaced to the platform logs
 * rather than raised.
 */
export async function record(env: Env, entry: AuditEntry): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO audit_log (id, actor_id, actor_email, action, entity, entity_id,
                              before_json, after_json, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        newId(),
        entry.actorId ?? null,
        entry.actorEmail ?? null,
        entry.action,
        entry.entity ?? null,
        entry.entityId ?? null,
        entry.before === undefined ? null : JSON.stringify(entry.before),
        entry.after === undefined ? null : JSON.stringify(entry.after),
        entry.ip ?? null,
      )
      .run()
  } catch (err) {
    console.error('audit write failed', entry.action, entry.entityId, err)
  }
}
