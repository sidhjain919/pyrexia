import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Check, Loader2, Trash2, Upload } from 'lucide-react'

import { ApiError, api, uploadDocument, type MyDocument } from '../api/client'

/**
 * Uploading a college ID and, optionally, a government ID.
 *
 * Used in two places: during registration, and from the pass page afterwards:
 * so it owns its own loading and error state rather than expecting a parent to
 * manage it.
 *
 * The two documents are not equal. The college ID is what the whole price
 * depends on — this is a student fest at a student rate, and the desk has no
 * other way to tell a student from anyone else — so it is required. Aadhaar is
 * a convenience for the desk and stays optional, because insisting on the one
 * document people are most careful with, to sell a ₹500 ticket, loses
 * registrations and deserves to.
 *
 * It says plainly what happens to the files, because "upload your Aadhaar"
 * with no explanation is a reasonable thing for someone to refuse.
 */

type Kind = MyDocument['kind']

const SLOTS: { kind: Kind; label: string; hint: string; required: boolean }[] = [
  {
    kind: 'student_id',
    label: 'College / student ID',
    hint: 'Your current student card, front side. Required.',
    required: true,
  },
  {
    kind: 'aadhaar',
    label: 'Government photo ID',
    // Any government ID does the job. Naming Aadhaar first because it is what
    // most students reach for, while not demanding it.
    hint: 'Optional. Aadhaar, driving licence, passport or voter ID.',
    required: false,
  },
]

/**
 * The ceiling, in megabytes, and it is the same number the Worker enforces.
 * Checked here as well so somebody who picks a 40 MB photo is told instantly
 * rather than after uploading it over a phone connection.
 */
const MAX_MB = 5

export default function DocumentUpload({
  compact = false,
  onChange,
}: {
  compact?: boolean
  /** Fires with the kinds currently held, so a parent can gate Continue on it. */
  onChange?: (held: Kind[]) => void
}) {
  const [docs, setDocs] = useState<MyDocument[] | null>(null)
  const [verification, setVerification] = useState<string>('unsubmitted')
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState<Kind | null>(null)
  const [error, setError] = useState<string | null>(null)

  const inputs = useRef<Partial<Record<Kind, HTMLInputElement | null>>>({})

  const load = async () => {
    try {
      const res = await api.myDocuments()
      setDocs(res.documents)
      setVerification(res.verification)
      setNote(res.note)
      onChange?.(res.documents.map((d) => d.kind))
    } catch {
      // Not signed in, or offline. Neither is worth an alarming message here:
      // the slots render empty and the upload button says what to do.
      setDocs([])
      onChange?.([])
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const choose = async (kind: Kind, file: File | undefined) => {
    if (!file) return
    setError(null)

    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`That file is over ${MAX_MB} MB. A photo from your phone is usually enough.`)
      return
    }

    setBusy(kind)
    try {
      await uploadDocument(kind, file)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That upload failed. Try again.')
    } finally {
      setBusy(null)
      // Clearing the input matters: without it, choosing the same file again
      // after a failure fires no change event and looks like nothing happened.
      const input = inputs.current[kind]
      if (input) input.value = ''
    }
  }

  const remove = async (doc: MyDocument) => {
    setError(null)
    try {
      await api.deleteDocument(doc.id)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove that.')
    }
  }

  const held = (kind: Kind) => docs?.find((d) => d.kind === kind)
  const approved = verification === 'approved'

  return (
    <div>
      {!compact && (
        <p className="text-[0.88rem] leading-relaxed text-parchment/60">
          So the registration desk can check that the pass belongs to you. Your
          college ID is required — the student rate depends on it. A government
          photo ID is optional and only speeds up the desk. Images or PDF, up to{' '}
          {MAX_MB} MB each. Bring the physical cards with you as well: the desk
          checks that your face matches the photograph.
        </p>
      )}

      <div className="mt-4 space-y-3">
        {SLOTS.map((slot) => {
          const doc = held(slot.kind)
          const uploading = busy === slot.kind

          return (
            <div
              key={slot.kind}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-gold/15 bg-navy/35 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-[0.9rem] text-offwhite">
                  {doc && <Check size={14} className="shrink-0 text-aqua" />}
                  {slot.label}
                  {/* A word, not a colour or an asterisk. */}
                  <span
                    className={`font-log text-[0.55rem] uppercase tracking-wide2 ${
                      slot.required ? 'text-gold-bright' : 'text-parchment/40'
                    }`}
                  >
                    {slot.required ? 'Required' : 'Optional'}
                  </span>
                </div>
                <div className="mt-0.5 text-[0.78rem] text-parchment/45">
                  {doc
                    ? `Uploaded · ${Math.round(doc.sizeBytes / 1024)} KB`
                    : slot.hint}
                </div>
              </div>

              <input
                ref={(el) => {
                  inputs.current[slot.kind] = el
                }}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                onChange={(e) => void choose(slot.kind, e.target.files?.[0])}
                className="hidden"
                id={`upload-${slot.kind}`}
              />

              {doc && !approved && (
                <button
                  type="button"
                  onClick={() => void remove(doc)}
                  title="Remove"
                  className="rounded-full border border-coral/25 p-2 text-coral/70 transition-colors hover:border-coral/60 hover:text-coral"
                >
                  <Trash2 size={13} />
                </button>
              )}

              {!approved && (
                <label
                  htmlFor={`upload-${slot.kind}`}
                  className="flex cursor-pointer items-center gap-2 rounded-full border border-gold/25 px-4 py-2 font-log text-[0.6rem] uppercase tracking-wide2 text-parchment/75 transition-colors hover:border-gold/50 hover:text-gold-bright"
                >
                  {uploading ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Upload size={12} />
                  )}
                  {doc ? 'Replace' : 'Upload'}
                </label>
              )}
            </div>
          )
        })}
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-coral/50 bg-coral/10 p-3 text-[0.82rem] text-coral">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* The state carries a word, never a colour on its own. */}
      {verification === 'pending' && docs && docs.length > 0 && (
        <p className="mt-3 text-[0.82rem] text-parchment/50">
          Waiting to be checked by the crew. Nothing more to do.
        </p>
      )}

      {verification === 'approved' && (
        <p className="mt-3 flex items-center gap-2 text-[0.82rem] text-aqua">
          <Check size={14} />
          Checked and approved.
        </p>
      )}

      {verification === 'rejected' && (
        <div className="mt-3 rounded-lg border border-ember/40 bg-ember/10 p-3 text-[0.82rem] text-ember">
          <strong className="font-semibold">Needs another look.</strong>{' '}
          {note ?? 'Please upload a clearer photo.'}
        </div>
      )}

      {!compact && (
        <p className="mt-4 text-[0.76rem] leading-relaxed text-parchment/40">
          Stored encrypted, visible only to the organising crew, every viewing
          logged, and deleted within thirty days of the fest.
        </p>
      )}
    </div>
  )
}
