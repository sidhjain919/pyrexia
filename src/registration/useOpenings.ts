import { useEffect, useState } from 'react'

import { api } from '../api/client'
import { DEFAULT_OPEN_TERRITORIES } from '../data/registration'

/**
 * Which verticals, and which single events, are taking entries, as the
 * server sees it.
 *
 * Fetched once per page load and shared by every card, because the grid asks
 * the same question seventy times. Until the answer lands, the built-in
 * default stands in: it is right in the ordinary case, so nobody watches a
 * grid of "Coming Soon" resolve into "Register" a second later. Nothing here
 * decides anything: entering a closed event is refused by the server whatever
 * this hook believes.
 *
 * Two layers, matching the server: a vertical's master switch, and each
 * event's own. An event is open only when both are.
 */

type Openings = {
  open: ReadonlySet<string>
  /** Verticals that have taken entries at some point, whether or not they are now. */
  everOpened: ReadonlySet<string>
  closedEvents: ReadonlySet<string>
}

const DEFAULT: Openings = {
  open: DEFAULT_OPEN_TERRITORIES,
  everOpened: DEFAULT_OPEN_TERRITORIES,
  closedEvents: new Set(),
}

let cache: Openings | null = null
let inflight: Promise<Openings> | null = null
const listeners = new Set<(next: Openings) => void>()

function load(): Promise<Openings> {
  if (cache) return Promise.resolve(cache)
  inflight ??= api
    .openings()
    .then((res) => {
      cache = {
        open: new Set(res.open),
        // An older API answers without this. Falling back to what is open now
        // means a card can only ever under-claim, saying "coming soon" where
        // it might have said "closed", never the other way round.
        everOpened: new Set(res.everOpened ?? res.open),
        closedEvents: new Set(res.closedEvents ?? []),
      }
      for (const fn of listeners) fn(cache)
      return cache
    })
    .catch(() => {
      // Offline, or the API is having a moment. Keep the default and try again
      // on the next mount rather than declaring everything shut.
      inflight = null
      return DEFAULT
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
  const [state, setState] = useState<Openings>(cache ?? DEFAULT)
  /** False until the server has answered, for anything that wants to wait. */
  const [settled, setSettled] = useState(cache !== null)

  useEffect(() => {
    let alive = true
    const listener = (next: Openings) => {
      if (!alive) return
      setState(next)
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
    /**
     * Whether entries are open. With only a vertical, its master switch; with
     * an event name as well, that event's own switch too.
     */
    isOpen: (territoryId: string, eventName?: string) =>
      state.open.has(territoryId) && (eventName === undefined || !state.closedEvents.has(eventName)),

    /**
     * What a shut card should say. "Coming Soon" invites somebody to check
     * back, which is right before entries open and a small lie afterwards.
     */
    shutLabel: (territoryId: string) =>
      state.everOpened.has(territoryId) ? 'Entries Closed' : 'Coming Soon',
    settled,
  }
}
