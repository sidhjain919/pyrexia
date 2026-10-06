import { useState, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

import type { StickerPerson } from '../api/client'

/** Small pieces the scan screens share. */

export function Panel({ children, tone }: { children: ReactNode; tone?: 'bad' | 'warn' }) {
  const look =
    tone === 'bad'
      ? 'border-red-500/40 bg-red-900/40 text-red-100'
      : tone === 'warn'
        ? 'border-amber-400/40 bg-amber-900/30 text-amber-100'
        : 'border-gold/15 bg-navy/45'
  return <div className={`rounded-xl border p-4 ${look}`}>{children}</div>
}

export function PrimaryButton({
  children,
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={`rounded-full bg-gradient-to-b from-gold-bright to-gold-deep px-6 py-3.5 font-semibold text-abyss disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  )
}

/** One line of input and its button, cleared after each submit. */
export function TextEntry({
  placeholder,
  button,
  busy,
  onSubmit,
  mono = false,
  className = '',
}: {
  placeholder: string
  button: string
  busy: boolean
  onSubmit: (value: string) => void
  mono?: boolean
  className?: string
}) {
  const [value, setValue] = useState('')
  return (
    <form
      className={`flex gap-2 ${className}`}
      onSubmit={(e) => {
        e.preventDefault()
        if (!value.trim()) return
        onSubmit(value)
        setValue('')
      }}
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        autoCapitalize={mono ? 'characters' : 'none'}
        spellCheck={false}
        className={`min-w-0 flex-1 rounded-lg border border-gold/25 bg-abyss px-3 py-3 text-offwhite outline-none placeholder:text-parchment/35 focus:border-gold ${
          mono ? 'font-mono uppercase tracking-widest' : ''
        }`}
      />
      <button
        type="submit"
        disabled={busy}
        className="flex min-w-24 items-center justify-center rounded-lg bg-gold/20 px-4 text-gold-bright ring-1 ring-inset ring-gold/50 disabled:opacity-50"
      >
        {busy ? <Loader2 size={18} className="animate-spin" /> : button}
      </button>
    </form>
  )
}

export function PersonCard({ person }: { person: StickerPerson }) {
  return (
    <Panel>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-2xl leading-tight text-offwhite">{person.name}</div>
          <div className="mt-1 text-[0.9rem] text-parchment/70">
            {[person.college, person.gender].filter(Boolean).join(' · ') || 'No college given'}
          </div>
          <div className="mt-2 font-mono text-[0.85rem] text-parchment/55">
            {person.publicCode} · {person.phone || person.email}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-[0.75rem] ${
            person.festivalPass ? 'bg-green-700/70 text-green-100' : 'bg-red-800/70 text-red-100'
          }`}
        >
          {person.festivalPass ? 'Festival Pass' : 'Basic only'}
        </span>
      </div>
    </Panel>
  )
}

/** "3 min ago", for a phone's last check-in. */
export function ago(iso: string | null): string {
  if (!iso) return 'never'
  // D1 writes `YYYY-MM-DD HH:MM:SS` in UTC with no zone marker.
  const t = new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`).getTime()
  const s = Math.max(0, (Date.now() - t) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  return `${Math.round(s / 86400)} d ago`
}
