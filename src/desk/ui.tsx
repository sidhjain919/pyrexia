/** Small pieces the desk's counters share. */

export function Legend({ n, label }: { n: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-gold/40 font-mono text-[0.62rem] text-gold-bright">
        {n}
      </span>
      <span className="font-log text-[0.66rem] uppercase tracking-wide2 text-parchment/70">
        {label}
      </span>
    </div>
  )
}

export function Choice({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex min-h-11 items-center rounded-lg px-4 py-2.5 text-left text-[0.88rem] transition-colors ${
        on
          ? 'bg-gold/15 text-gold-bright ring-1 ring-inset ring-gold/70'
          : 'text-parchment/75 ring-1 ring-inset ring-gold/25 hover:text-gold-bright hover:ring-gold/60'
      }`}
    >
      {children}
    </button>
  )
}
