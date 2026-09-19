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
export function useActiveSection(ids: string[]): string | null {
  const { pathname } = useLocation()
  const [active, setActive] = useState<string | null>(pathname === '/' ? ids[0] : null)

  useEffect(() => {
    // The sections only exist on the home page. Anywhere else nothing in the
    // chart is "current", and saying so is better than the old behaviour: the
    // elements were looked up once at mount, so after a visit to /sign-in
    // they were detached nodes whose rect reads as 0,0, which put every one
    // of them "above the probe" and left the underline stuck on Navigator,
    // on every page, until a hard refresh.
    if (pathname !== '/') {
      setActive(null)
      return
    }

    const onScroll = () => {
      // Looked up on every scroll rather than cached: cheap, and it stays
      // correct while the page is still mounting its sections.
      const probe = window.innerHeight * 0.3
      let current: string | null = null
      for (const id of ids) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= probe) current = id
      }
      setActive(current ?? ids[0])
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [ids, pathname])

  return active
}
