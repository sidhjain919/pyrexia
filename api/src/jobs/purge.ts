/**
 * Deleting identity documents when their time is up.
 *
 * The privacy page tells students their documents are removed within thirty
 * days of the fest. That sentence is only true if something enforces it, and
 * "we will remember in November" is not something. This runs on the same
 * schedule as the payment reconciliation and needs nobody to think about it.
 *
 * The row is kept and marked `purged_at` rather than deleted outright: it is
 * the evidence that the promise was honoured, and it holds no personal content
 * once the object is gone: a kind, a size and a date.
 */

import type { Env } from '../types.ts'
import * as audit from '../lib/audit.ts'

/** Small batches: the cron runs every fifteen minutes and is in no hurry. */
const BATCH = 50

export async function purgeExpiredDocuments(env: Env): Promise<number> {
  const { results } = await env.DB.prepare(
    `SELECT id, r2_key, registration_id, kind FROM documents
      WHERE purged_at IS NULL AND purge_after <= date('now')
      LIMIT ${BATCH}`,
  ).all<{ id: string; r2_key: string; registration_id: string; kind: string }>()

  if (results.length === 0) return 0

  let purged = 0

  for (const doc of results) {
    try {
      await env.DOCS.delete(doc.r2_key)
    } catch (err) {
      // A bucket that is briefly unavailable should not mark the row as done -
      // that would leave the file behind with nothing left to find it by. Skip
      // it and let the next run try again.
      console.error('purge: could not delete object', doc.r2_key, err)
      continue
    }

    await env.DB.prepare("UPDATE documents SET purged_at = datetime('now') WHERE id = ?")
      .bind(doc.id)
      .run()

    await audit.record(env, {
      action: 'document.purge',
      entity: 'document',
      entityId: doc.id,
      after: { registrationId: doc.registration_id, kind: doc.kind },
    })

    purged++
  }

  if (purged) console.log(`purged ${purged} expired document(s)`)
  return purged
}
