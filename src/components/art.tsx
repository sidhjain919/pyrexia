/**
 * Cartoon illustration kit — bold ink outlines, flat bright fills.
 * All pieces accept className/style and scale to their container.
 */
import type { CSSProperties } from 'react'

const INK = '#2a2018'
type P = { className?: string; style?: CSSProperties; size?: number }

/* ---------------- Sun ---------------- */
export function Sun({ className, style, size = 120 }: P) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className={className} style={style} aria-hidden>
      <g stroke={INK} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round">
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i * 30 * Math.PI) / 180
          const r1 = 44, r2 = 57
          return (
            <line key={i} x1={60 + r1 * Math.cos(a)} y1={60 + r1 * Math.sin(a)} x2={60 + r2 * Math.cos(a)} y2={60 + r2 * Math.sin(a)} stroke="#f5a623" strokeWidth="7" />
          )
        })}
        <circle cx="60" cy="60" r="34" fill="#ffd451" />
        <circle cx="60" cy="60" r="34" fill="none" stroke={INK} strokeWidth="3.5" />
      </g>
    </svg>
  )
}

/* ---------------- Cloud ---------------- */
export function Cloud({ className, style, size = 160 }: P) {
  return (
    <svg viewBox="0 0 200 100" width={size} height={(size * 100) / 200} className={className} style={style} aria-hidden>
      <path
        d="M40 82 C14 82 12 54 34 50 C30 28 62 20 74 38 C84 20 120 20 126 42 C150 34 172 52 158 72 C176 76 172 82 160 82 Z"
        fill="#fffaf0" stroke={INK} strokeWidth="3.5" strokeLinejoin="round"
      />
    </svg>
  )
}

/* ---------------- Palm tree ---------------- */
export function Palm({ className, style, size = 180, flip = false }: P & { flip?: boolean }) {
  return (
    <svg viewBox="0 0 160 220" width={size} height={(size * 220) / 160} className={className} style={{ ...style, transform: flip ? 'scaleX(-1)' : undefined }} aria-hidden>
      <g stroke={INK} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round">
        <path d="M74 210 C70 150 66 110 78 78 L92 80 C86 116 90 158 92 210 Z" fill="#a6672f" />
        <path d="M78 78 C60 60 30 58 12 74 C40 66 62 72 80 84 Z" fill="#2f9e6b" />
        <path d="M80 80 C64 50 66 22 88 6 C78 34 86 58 90 82 Z" fill="#37c2a8" />
        <path d="M82 80 C104 54 138 52 156 68 C126 60 102 68 90 84 Z" fill="#2f9e6b" />
        <path d="M84 82 C108 66 140 74 150 96 C124 82 100 82 90 90 Z" fill="#37c2a8" />
        <path d="M78 82 C52 74 26 86 18 108 C44 92 66 90 84 96 Z" fill="#2f9e6b" />
        <circle cx="80" cy="80" r="7" fill="#7a4a2a" />
      </g>
    </svg>
  )
}

/* ---------------- Cartoon ship ---------------- */
export function Ship({ className, style, size = 220 }: P) {
  return (
    <svg viewBox="0 0 260 240" width={size} height={(size * 240) / 260} className={className} style={style} aria-hidden>
      <g stroke={INK} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round">
        {/* mast */}
        <rect x="124" y="40" width="8" height="130" rx="3" fill="#a6672f" />
        {/* sail */}
        <path d="M132 46 C176 54 178 116 132 132 Z" fill="#fffaf0" />
        <path d="M124 50 C86 58 84 114 124 130 Z" fill="#f3ddad" />
        {/* Jolly Roger flag */}
        <path d="M128 40 L172 30 L166 44 L176 56 L128 52 Z" fill="#2a2018" />
        <circle cx="150" cy="42" r="5.5" fill="#fdf3dc" stroke="none" />
        {/* hull */}
        <path d="M44 168 L216 168 C206 210 176 224 130 224 C84 224 54 210 44 168 Z" fill="#d6472f" />
        <path d="M44 168 L216 168 L206 182 L54 182 Z" fill="#e7a531" />
        <circle cx="86" cy="196" r="8" fill="#fdf3dc" />
        <circle cx="130" cy="200" r="8" fill="#fdf3dc" />
        <circle cx="174" cy="196" r="8" fill="#fdf3dc" />
      </g>
    </svg>
  )
}

/* ---------------- Rolling sea band (fills width) ---------------- */
export function SeaBand({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 400 60" preserveAspectRatio="none" className={className} style={style} aria-hidden>
      <path d="M0 26 Q25 8 50 26 T100 26 T150 26 T200 26 T250 26 T300 26 T350 26 T400 26 V60 H0 Z" fill="#37c2a8" />
      <path d="M0 26 Q25 8 50 26 T100 26 T150 26 T200 26 T250 26 T300 26 T350 26 T400 26" fill="none" stroke="#2a2018" strokeWidth="3" />
      <path d="M0 40 Q25 24 50 40 T100 40 T150 40 T200 40 T250 40 T300 40 T350 40 T400 40" fill="none" stroke="#8fe7d6" strokeWidth="3" opacity="0.9" />
    </svg>
  )
}

/* ---------------- Parrot ---------------- */
export function Parrot({ className, style, size = 90 }: P) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} style={style} aria-hidden>
      <g stroke={INK} strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round">
        <path d="M42 30 C22 30 16 58 30 78 C42 94 66 92 74 74 C82 56 74 32 54 28 Z" fill="#2f9e6b" />
        <path d="M50 40 C64 36 78 44 80 58 C70 52 58 52 50 58 Z" fill="#37c2a8" />
        <path d="M40 82 C36 92 46 94 52 88 Z" fill="#d6472f" />
        <circle cx="46" cy="40" r="14" fill="#d6472f" />
        <circle cx="50" cy="38" r="4" fill="#fff" />
        <circle cx="51" cy="38" r="2" fill={INK} stroke="none" />
        <path d="M34 42 C24 40 22 50 32 52 Z" fill="#ffc542" />
      </g>
    </svg>
  )
}

/* ---------------- Treasure chest ---------------- */
export function Chest({ className, style, size = 150 }: P) {
  return (
    <svg viewBox="0 0 160 130" width={size} height={(size * 130) / 160} className={className} style={style} aria-hidden>
      <g stroke={INK} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round">
        <ellipse cx="80" cy="120" rx="60" ry="8" fill="#2a2018" opacity="0.15" stroke="none" />
        {/* gold pile */}
        <path d="M28 66 C40 54 60 52 80 56 C100 52 122 56 132 66 C120 60 100 62 80 64 C60 62 40 60 28 66 Z" fill="#ffc542" />
        <circle cx="58" cy="52" r="7" fill="#ffd451" />
        <circle cx="80" cy="48" r="7" fill="#ffd451" />
        <circle cx="102" cy="52" r="7" fill="#ffd451" />
        {/* box */}
        <rect x="26" y="66" width="108" height="48" rx="8" fill="#a6672f" />
        <rect x="26" y="66" width="108" height="14" fill="#7a4a2a" />
        {/* lid */}
        <path d="M26 66 C26 44 44 34 80 34 C116 34 134 44 134 66 Z" fill="#c47d3a" />
        {/* bands + lock */}
        <line x1="52" y1="66" x2="52" y2="114" />
        <line x1="108" y1="66" x2="108" y2="114" />
        <rect x="70" y="70" width="20" height="20" rx="4" fill="#ffc542" />
        <circle cx="80" cy="80" r="3.5" fill={INK} stroke="none" />
      </g>
    </svg>
  )
}

/* ---------------- Sunburst ornament (from the logo) ---------------- */
export function Sunburst({ className, style, size = 90 }: P) {
  const cols = ['#d6472f', '#7c4a86', '#37c2a8', '#e7a531', '#ff7d53']
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} style={style} aria-hidden>
      {Array.from({ length: 10 }).map((_, i) => {
        const a = (i * 36 * Math.PI) / 180
        const a2 = ((i * 36 + 16) * Math.PI) / 180
        const r1 = 20, r2 = 46
        return (
          <path
            key={i}
            d={`M${50 + r1 * Math.cos(a)} ${50 + r1 * Math.sin(a)} L${50 + r2 * Math.cos(a)} ${50 + r2 * Math.sin(a)} L${50 + r2 * Math.cos(a2)} ${50 + r2 * Math.sin(a2)} Z`}
            fill={cols[i % cols.length]}
            stroke={INK}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        )
      })}
      <circle cx="50" cy="50" r="9" fill="#ffc542" stroke={INK} strokeWidth="2" />
    </svg>
  )
}

/* ---------------- Ribbon banner ---------------- */
export function Banner({ className, style, size = 260 }: P) {
  return (
    <svg viewBox="0 0 300 70" width={size} height={(size * 70) / 300} className={className} style={style} aria-hidden>
      <g stroke={INK} strokeWidth="3.5" strokeLinejoin="round">
        <path d="M0 20 L26 12 L26 58 L0 66 L12 43 Z" fill="#b5361f" />
        <path d="M300 20 L274 12 L274 58 L300 66 L288 43 Z" fill="#b5361f" />
        <rect x="22" y="8" width="256" height="54" rx="10" fill="#d6472f" />
      </g>
    </svg>
  )
}

/* ---------------- Coin ---------------- */
export function Coin({ className, style, size = 34 }: P) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} className={className} style={style} aria-hidden>
      <circle cx="20" cy="20" r="17" fill="#ffc542" stroke={INK} strokeWidth="3" />
      <circle cx="20" cy="20" r="11" fill="none" stroke="#e7a531" strokeWidth="2.5" />
      <text x="20" y="26" textAnchor="middle" fontFamily="Luckiest Guy, sans-serif" fontSize="15" fill="#e7a531">P</text>
    </svg>
  )
}

/* ---------------- Compass (playful) ---------------- */
export function Compass({ className, style, size = 110, spin = false }: P & { spin?: boolean }) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className={className} style={style} aria-hidden>
      <circle cx="60" cy="60" r="52" fill="#f6e6bf" stroke={INK} strokeWidth="4" />
      <circle cx="60" cy="60" r="42" fill="none" stroke="#e7a531" strokeWidth="2.5" />
      <g className={spin ? 'anim-spin-slow' : ''} style={{ transformOrigin: '60px 60px' }}>
        <polygon points="60,22 70,60 60,66 50,60" fill="#d6472f" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <polygon points="60,98 70,60 60,54 50,60" fill="#1e8f79" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      </g>
      <circle cx="60" cy="60" r="5" fill="#2a2018" />
      {[['N', 60, 16], ['E', 104, 62], ['S', 60, 108], ['W', 16, 62]].map(([l, x, y]) => (
        <text key={l as string} x={x as number} y={y as number} textAnchor="middle" dominantBaseline="middle" fontFamily="Luckiest Guy, sans-serif" fontSize="12" fill={INK}>{l}</text>
      ))}
    </svg>
  )
}

/* ---------------- Little bird (V) ---------------- */
export function Bird({ className, style, size = 26 }: P) {
  return (
    <svg viewBox="0 0 40 20" width={size} height={(size * 20) / 40} className={className} style={style} aria-hidden>
      <path d="M2 14 Q12 2 20 12 Q28 2 38 14" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  )
}
