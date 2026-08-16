import { useEffect, useRef, useState } from 'react'

/**
 * Desktop custom cursor: a small gold ring that expands over interactive
 * elements and reveals a label from `data-cursor`. Disabled on touch / coarse
 * pointers and when reduced motion is requested.
 */
export default function Cursor() {
  const dot = useRef<HTMLDivElement>(null)
  const ring = useRef<HTMLDivElement>(null)
  const [label, setLabel] = useState('')
  const [active, setActive] = useState(false)
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!fine || reduce) return

    document.body.classList.add('cursor-custom')
    let rx = window.innerWidth / 2
    let ry = window.innerHeight / 2
    let dx = rx
    let dy = ry
    let raf = 0

    const loop = () => {
      rx += (dx - rx) * 0.18
      ry += (dy - ry) * 0.18
      if (ring.current) ring.current.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%)`
      if (dot.current) dot.current.style.transform = `translate3d(${dx}px, ${dy}px, 0) translate(-50%, -50%)`
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const move = (e: MouseEvent) => {
      dx = e.clientX
      dy = e.clientY
      setHidden(false)
      const t = (e.target as HTMLElement)?.closest<HTMLElement>(
        '[data-cursor], a, button, [role="button"]',
      )
      if (t) {
        setActive(true)
        setLabel(t.getAttribute('data-cursor') ?? '')
      } else {
        setActive(false)
        setLabel('')
      }
    }
    const leave = () => setHidden(true)

    window.addEventListener('mousemove', move)
    document.addEventListener('mouseleave', leave)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', move)
      document.removeEventListener('mouseleave', leave)
      document.body.classList.remove('cursor-custom')
    }
  }, [])

  return (
    <div aria-hidden className={hidden ? 'opacity-0' : 'opacity-100'} style={{ transition: 'opacity .3s' }}>
      <div
        ref={dot}
        className="pointer-events-none fixed left-0 top-0 z-[9999] h-1.5 w-1.5 rounded-full bg-gold-bright"
        style={{ mixBlendMode: 'difference' }}
      />
      <div
        ref={ring}
        className="pointer-events-none fixed left-0 top-0 z-[9998] flex items-center justify-center rounded-full border border-gold/70 font-log uppercase tracking-wide2 text-gold-bright transition-[width,height,background-color] duration-300"
        style={{
          width: active ? 74 : 34,
          height: active ? 74 : 34,
          backgroundColor: active ? 'rgba(200,155,60,0.10)' : 'transparent',
          fontSize: 9,
        }}
      >
        {active && label}
      </div>
    </div>
  )
}
