import {
  Flame,
  Music4,
  Mic2,
  Drama,
  Swords,
  Crown,
  ScrollText,
  Palette,
  PartyPopper,
  Gamepad2,
  Star,
  Compass,
  Anchor,
  Skull,
  type LucideProps,
} from 'lucide-react'

/* Brand glyphs: lucide-react removed its brand icons, so these are inlined. */
const Instagram = (p: LucideProps) => (
  <svg viewBox="0 0 24 24" width={p.size ?? 24} height={p.size ?? 24} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="2" y="2" width="20" height="20" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" stroke="none" />
  </svg>
)
const Youtube = (p: LucideProps) => (
  <svg viewBox="0 0 24 24" width={p.size ?? 24} height={p.size ?? 24} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="2" y="5" width="20" height="14" rx="4" />
    <path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none" />
  </svg>
)
const Facebook = (p: LucideProps) => (
  <svg viewBox="0 0 24 24" width={p.size ?? 24} height={p.size ?? 24} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M14 8.5V7c0-1 .5-1.5 1.5-1.5H17V3h-2.5C12 3 11 4.6 11 6.8V8.5H9V11h2v10h3V11h2.2l.4-2.5H14z" />
  </svg>
)

const map = {
  Flame,
  Music4,
  Mic2,
  Drama,
  Swords,
  Crown,
  ScrollText,
  Palette,
  PartyPopper,
  Gamepad2,
  Star,
  Compass,
  Anchor,
  Skull,
  Instagram,
  Youtube,
  Facebook,
}

export type IconName = keyof typeof map

export function Icon({ name, ...props }: { name: string } & LucideProps) {
  const Cmp = map[name as IconName] ?? Star
  return <Cmp {...props} />
}
