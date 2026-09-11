import { useEffect, useState } from 'react'
import { FileText, Loader2, X } from 'lucide-react'

import {
  ApiError,
  api,
  fetchAdminDocument,
  type AdminDocument,
  type AdminRegistrationDetail,
  type AdminRow,
} from '../api/client'

/**
 * The identity documents one person uploaded, shown to whoever on the crew
 * needs to see them.
 *
 * Deliberately a viewer and nothing more. The committee asked to be able to
 * look, not to approve or reject: the desk checks a face against a card on
 * the day, and a verdict recorded in September would be a promise nobody
 * intends to keep. So there are no buttons here except Close.
 *
 * The files are fetched one at a time through the endpoint that decrypts them
 * and logs the view against the admin's name, and the object URLs are revoked
 * the moment this closes. Nothing is cached, nothing is downloaded, nothing
 * ends up in anybody's Downloads folder.
 */
export default function IdViewer({ row, onClose }: { row: AdminRow; onClose: () => void }) {
  const [detail, setDetail] = useState<AdminRegistrationDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** Object URLs by document id, created as each file arrives. */
  const [files, setFiles] = useState<Record<string, { url: string; mime: string }>>({})
  const [failed, setFailed] = useState<Record<string, string>>({})

  useEffect(() => {
    let alive = true
    const urls: string[] = []
    api
      .adminRegistration(row.id)
      .then(async (d) => {
        if (!alive) return
        setDetail(d)
        // All of them in parallel: three files, one round trip's worth of wait.
        await Promise.all(
          d.documents.map(async (doc) => {
            try {
              const f = await fetchAdminDocument(doc.id)
              if (!alive) {
                URL.revokeObjectURL(f.url)
                return
              }
              urls.push(f.url)
              setFiles((prev) => ({ ...prev, [doc.id]: f }))
            } catch (err) {
              if (alive) {
                setFailed((prev) => ({
                  ...prev,
                  [doc.id]: err instanceof ApiError ? err.message : 'Could not open this file.',
                }))
              }
            }
          }),
        )
      })
      .catch((err) => alive && setError(err instanceof ApiError ? err.message : 'Could not load this person.'))

    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      alive = false
      window.removeEventListener('keydown', onKey)
      for (const u of urls) URL.revokeObjectURL(u)
    }
  }, [row.id, onClose])

  const reg = detail?.registration ?? {}

  return (
    <div
      className="fixed inset-0 z-[3000] flex items-start justify-center overflow-y-auto bg-abyss/85 p-4 backdrop-blur-md sm:items-center sm:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Identity documents for ${row.name ?? row.publicCode}`}
    >
      <div
        className="console card relative my-auto w-full max-w-5xl p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="ink-3 text-[0.74rem]">{row.publicCode}</div>
            <h2 className="mt-0.5 truncate text-[1.2rem] font-semibold" style={{ color: 'var(--cs-ink)' }}>
              {row.name ?? 'Name not given'}
            </h2>
            <div className="ink-2 mt-1 text-[0.82rem]">
              {[reg.college, reg.course, reg.year].filter(Boolean).join(' · ') || row.email}
              {row.phone && <span className="ink-3"> · {row.phone}</span>}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="ghost inline-flex items-center gap-1.5 !py-1.5">
            <X size={14} /> Close
          </button>
        </div>

        {error && (
          <div className="mt-5 rounded-lg border border-coral/50 bg-coral/10 p-3 text-[0.85rem] text-coral">
            {error}
          </div>
        )}

        {!detail && !error && (
          <div className="ink-3 mt-8 flex items-center gap-2 text-[0.85rem]">
            <Loader2 size={14} className="animate-spin" /> Loading…
          </div>
        )}

        {detail && detail.documents.length === 0 && (
          <p className="ink-3 mt-8 text-[0.88rem]">
            Nothing uploaded. Registration does not require documents up front; the desk checks an
            ID on the day.
          </p>
        )}

        {detail && detail.documents.length > 0 && (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {detail.documents.map((doc) => (
              <Document key={doc.id} doc={doc} file={files[doc.id]} failure={failed[doc.id]} />
            ))}
          </div>
        )}

        <p className="ink-3 mt-5 text-[0.72rem]">
          Each view is recorded against your name. These files are deleted within thirty days of the
          fest, as the privacy page promises.
        </p>
      </div>
    </div>
  )
}

const KIND_LABEL: Record<AdminDocument['kind'], string> = {
  student_id: 'College ID',
  aadhaar: 'Government ID',
  photo: 'Photo',
}

function Document({
  doc,
  file,
  failure,
}: {
  doc: AdminDocument
  file?: { url: string; mime: string }
  failure?: string
}) {
  const isImage = (file?.mime ?? doc.mime ?? '').startsWith('image/')
  const isPdf = (file?.mime ?? doc.mime ?? '') === 'application/pdf'
  return (
    <figure className="flex flex-col overflow-hidden rounded-lg" style={{ border: '1px solid var(--cs-hair)' }}>
      <figcaption className="flex items-baseline justify-between gap-3 px-3 py-2" style={{ background: 'var(--cs-surface-2)' }}>
        <span className="text-[0.84rem] font-semibold" style={{ color: 'var(--cs-ink)' }}>
          {KIND_LABEL[doc.kind] ?? doc.kind}
        </span>
        <span className="ink-3 truncate text-[0.7rem]">
          {doc.size_bytes ? `${Math.round(doc.size_bytes / 1024)} KB` : ''}
        </span>
      </figcaption>

      <div className="flex min-h-[16rem] items-center justify-center bg-black/30">
        {failure ? (
          <span className="px-4 text-center text-[0.8rem] text-coral">{failure}</span>
        ) : !file ? (
          <Loader2 size={18} className="ink-3 animate-spin" />
        ) : isImage ? (
          // A link as well as an image, so a small card can be opened full size in a new tab.
          <a href={file.url} target="_blank" rel="noopener noreferrer" className="block w-full">
            <img src={file.url} alt={KIND_LABEL[doc.kind]} className="max-h-[28rem] w-full object-contain" />
          </a>
        ) : isPdf ? (
          <iframe src={file.url} title={KIND_LABEL[doc.kind]} className="h-[28rem] w-full" />
        ) : (
          <a
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="ghost inline-flex items-center gap-2"
          >
            <FileText size={14} /> Open {doc.filename ?? 'file'}
          </a>
        )}
      </div>
    </figure>
  )
}
