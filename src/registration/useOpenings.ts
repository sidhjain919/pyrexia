import { useEffect, useState } from 'react'

import { api } from '../api/client'
import { DEFAULT_OPEN_TERRITORIES } from '../data/registration'

/**
 * Which verticals are taking entries, as the server sees it.
 *
 * Fetched once per page load and shared by every card, because the grid asks
 * the same question seventy times. Until the answer lands, the built-in
 * default stands in: it is right in the ordinary case, so nobody watches a
 * grid of "Coming Soon" resolve into "Register" a second later. Nothing here
 * decides anything — entering a closed event is refused by the server whatever
 * this hook believes.
 */

let cache: ReadonlySet<string> | null = null
let inflight: Promise<ReadonlySet<string>> | null = null
const listeners = new Set<(open: ReadonlySet<string>) => void>()

function load(): Promise<ReadonlySet<string>> {
  if (cache) return Promise.resolve(cache)
  inflight ??= api
    .openings()
    .then((res) => {
      cache = new Set(res.open)
      for (const fn of listeners) fn(cache)
      return cache
    })
    .catch(() => {
      // Offline, or the API is having a moment. Keep the default and try again
      // on the next mount rather than declaring everything shut.
      inflight = null
      return DEFAULT_OPEN_TERRITORIES
    })
  return inflight
}

/** Drop the cached answer, so the next read goes back to the server. */
export function refreshOpenings() {
  cache = null
  inflight = null
  void load()
}

export function useOpenings() {
  const [open, setOpen] = useState<ReadonlySet<string>>(cache ?? DEFAULT_OPEN_TERRITORIES)
  /** False until the server has answered, for anything that wants to wait. */
  const [settled, setSettled] = useState(cache !== null)

  useEffect(() => {
    let alive = true
    const listener = (next: ReadonlySet<string>) => {
      if (!alive) return
      setOpen(next)
      setSettled(true)
    }
    listeners.add(listener)
    void load().then(listener)
    return () => {
      alive = false
      listeners.delete(listener)
    }
  }, [])

  return {
    isOpen: (territoryId: string) => open.has(territoryId),
    settled,
  }
}
