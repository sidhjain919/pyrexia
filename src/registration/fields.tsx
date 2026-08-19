import { useId, useRef, useState, type ReactNode } from 'react'
import { AlertCircle, Check, FileUp, Loader2, X } from 'lucide-react'
import type { DocumentKind, DocumentRef } from './types'
import { api } from './api'

/* ---------- shared shells ---------- */

export function Field({
  label,
  error,
  hint,
  required,
  children,
}: {
  label: string
  error?: string
  hint?: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="font-display text-[0.66rem] uppercase tracking-wide2 text-parchment/70">
        {label}
        {required && <span className="ml-1 text-coral/80">*</span>}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint && !error && <span className="mt-1 block text-[0.72rem] text-parchment/45">{hint}</span>}
      {error && (
        <span className="mt-1 flex items-center gap-1 text-[0.72rem] text-coral">
          <AlertCircle size={12} /> {error}
        </span>
      )}
    </label>
  )
}

const inputBase =
  'w-full rounded-lg border bg-ocean/50 px-3.5 py-2.5 text-[0.92rem] text-offwhite outline-none transition-colors placeholder:text-parchment/30 focus:border-gold/70'

export function TextInput({
  value,
  onChange,
  invalid,
  ...rest
}: {
  value: string
  onChange: (v: string) => void
  invalid?: boolean
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <input
      {...rest}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputBase} ${invalid ? 'border-coral/70' : 'border-gold/25'}`}
    />
  )
}

export function TextArea({
  value,
  onChange,
  invalid,
  ...rest
}: {
  value: string
  onChange: (v: string) => void
  invalid?: boolean
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'>) {
  return (
    <textarea
      {...rest}
      rows={3}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputBase} resize-y ${invalid ? 'border-coral/70' : 'border-gold/25'}`}
    />
  )
}

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Choose…',
  invalid,
}: {
  value: string
  onChange: (v: string) => void
  options: readonly string[]
  placeholder?: string
  invalid?: boolean
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputBase} appearance-none ${invalid ? 'border-coral/70' : 'border-gold/25'} ${
        value ? '' : 'text-parchment/40'
      }`}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o} className="bg-ocean text-offwhite">
          {o}
        </option>
      ))}
    </select>
  )
}

export function ChipGroup({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: readonly string[]
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value === o
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={`rounded-full px-4 py-2 text-[0.78rem] transition-colors ${
              on
                ? 'bg-gold/20 text-gold-bright ring-1 ring-inset ring-gold/70'
                : 'text-parchment/70 ring-1 ring-inset ring-gold/30 hover:text-gold-bright hover:ring-gold/70'
            }`}
          >
            {o}
          </button>
        )
      })}
    </div>
  )
}

/* ---------- identity document upload ---------- */

const ACCEPT = 'image/png,image/jpeg,image/webp,application/pdf'
const MAX_MB = 8

export function DocumentUpload({
  kind,
  label,
  hint,
  value,
  onChange,
  error,
}: {
  kind: DocumentKind
  label: string
  hint: string
  value?: DocumentRef
  onChange: (ref: DocumentRef | undefined) => void
  error?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const id = useId()

  const pick = async (file: File | undefined) => {
    if (!file) return
    setFailed(null)
    if (file.size > MAX_MB * 1024 * 1024) {
      setFailed(`Keep it under ${MAX_MB} MB.`)
      return
    }
    setBusy(true)
    try {
      onChange(await api.uploadDocument(file, kind))
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'Upload failed.')
    } finally {
      setBusy(false)
    }
  }

  const shown = failed ?? error

  return (
    <div>
      <span className="font-display text-[0.66rem] uppercase tracking-wide2 text-parchment/70">
        {label}
        <span className="ml-1 text-coral/80">*</span>
      </span>

      {value ? (
        <div className="mt-1.5 flex items-center gap-3 rounded-lg border border-aqua/40 bg-aqua/10 px-3.5 py-3">
          <Check size={16} className="shrink-0 text-aqua" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[0.86rem] text-offwhite">{value.filename}</div>
            <div className="text-[0.7rem] text-parchment/50">{(value.size / 1024).toFixed(0)} KB · uploaded</div>
          </div>
          <button
            type="button"
            onClick={() => onChange(undefined)}
            aria-label={`Remove ${label}`}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-parchment/60 ring-1 ring-inset ring-gold/35 hover:text-coral"
          >
            <X size={13} />
          </button>
        </div>
      ) : (
        <>
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            onChange={(e) => pick(e.target.files?.[0])}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className={`mt-1.5 flex w-full items-center gap-3 rounded-lg border border-dashed px-3.5 py-4 text-left transition-colors ${
              shown ? 'border-coral/60' : 'border-gold/35 hover:border-gold/70'
            }`}
          >
            {busy ? (
              <Loader2 size={17} className="shrink-0 animate-spin text-gold-bright" />
            ) : (
              <FileUp size={17} className="shrink-0 text-gold-bright" />
            )}
            <span className="text-[0.86rem] text-parchment/70">
              {busy ? 'Uploading…' : 'Choose a file — JPG, PNG, WEBP or PDF'}
            </span>
          </button>
        </>
      )}

      <span className="mt-1 block text-[0.72rem] text-parchment/45">{hint}</span>
      {shown && (
        <span className="mt-1 flex items-center gap-1 text-[0.72rem] text-coral">
          <AlertCircle size={12} /> {shown}
        </span>
      )}
    </div>
  )
}
