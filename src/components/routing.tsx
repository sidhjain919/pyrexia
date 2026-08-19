import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/** Scrolls to top on route change, or to a hash target if present. */
export function ScrollManager() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) {
      const id = hash.slice(1)
      // wait for the page to paint
      const t = window.setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 350)
      return () => window.clearTimeout(t)
    }
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [pathname, hash])
  return null
}

/** Returns a handler that navigates to a `to` which may include a #hash on home. */
export function useNavTo() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  return (to: string, after?: () => void) => {
    const [path, hashPart] = to.split('#')
    const target = path || '/'
    const hash = hashPart ? `#${hashPart}` : ''
    if (hash) {
      if (pathname === target) {
        document.getElementById(hashPart)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else {
        navigate(target + hash)
      }
    } else {
      navigate(target)
    }
    after?.()
  }
}

/**
 * Scroll-spy for the single-page layout: tracks which section id is
 * currently nearest the top of the viewport, so the navbar can highlight it.
 */
export function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0])

  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el)
    if (els.length === 0) return

    const onScroll = () => {
      const probe = window.innerHeight * 0.3
      let current = els[0].id
      for (const el of els) {
        if (el.getBoundingClientRect().top <= probe) current = el.id
      }
      setActive(current)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [ids])

  return active
}
