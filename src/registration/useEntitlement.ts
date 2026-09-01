import { useCallback, useEffect, useState } from 'react'

import { api, subscribeAuth, getSession, type Me } from '../api/client'

/**
 * What the person looking at the page has already bought.
 *
 * Every "Register Now" on the site used to say Register Now, to everybody,
 * including the delegate who had paid for the Festival Pass an hour earlier.
 * The button now reads the entitlement and offers the next thing rather than
 * the first thing:
 *
 *   anon         not signed in            Register Now
 *   unregistered signed in, nothing paid  Register Now
 *   basic        Basic Registration       Upgrade to Festival Pass
 *   festival     Festival Pass            My Pass
 *
 * It is one shared fetch, not one per button. Four surfaces ask this question
 * (the header, the hero, the chart panel and the closing CTA) and four
 * round trips for the same answer would be both slower and a way for two
 * buttons on one screen to disagree.
 *
 * Unknown until it is known: `state` starts as `null` while the answer is in
 * flight, and callers render the neutral label rather than flashing "Register
 * Now" at someone who is already a delegate.
 */
export type Entitlement = 'anon' | 'unregistered' | 'basic' | 'festival'

type Snapshot = { state: Entitlement | null; me: Me | null }

let snapshot: Snapshot = { state: getSession() ? null : 'anon', me: null }
let inFlight: Promise<void> | null = null
const listeners = new Set<() => void>()

function emit(): void {
  for (const l of listeners) l()
}

function classify(me: Me): Entitlement {
  if (!me.hasRegistration) return 'unregistered'
  return me.tier === 1 ? 'festival' : 'basic'
}

/**
 * Fetch once, share the answer.
 *
 * A failure resolves to `unregistered` rather than staying unknown forever: a
 * button that never resolves is worse than one that offers registration to
 * somebody who turns out to already hold a pass, because the server refuses
 * that purchase anyway and says why.
 */
function load(): Promise<void> {
  if (inFlight) return inFlight
  inFlight = api
    .me()
    .then((me) => {
      snapshot = { state: classify(me), me }
    })
    .catch(() => {
      snapshot = { state: 'unregistered', me: null }
    })
    .finally(() => {
      inFlight = null
      emit()
    })
  return inFlight
}

/** Called after anything that changes what somebody owns. */
export function refreshEntitlement(): void {
  if (!getSession()) {
    snapshot = { state: 'anon', me: null }
    emit()
    return
  }
  snapshot = { state: snapshot.state, me: snapshot.me }
  void load()
}

// Signing in or out changes the answer, and the store that knows about that
// already exists.
if (typeof window !== 'undefined') {
  subscribeAuth(() => {
    if (!getSession()) {
      snapshot = { state: 'anon', me: null }
      emit()
    } else if (snapshot.state === 'anon' || snapshot.state === null) {
      void load()
    }
  })
}

export function useEntitlement(): { state: Entitlement | null; me: Me | null; refresh: () => void } {
  const [, force] = useState(0)

  useEffect(() => {
    const listener = () => force((n) => n + 1)
    listeners.add(listener)
    if (getSession() && snapshot.state === null) void load()
    return () => {
      listeners.delete(listener)
    }
  }, [])

  const refresh = useCallback(() => refreshEntitlement(), [])
  return { state: snapshot.state, me: snapshot.me, refresh }
}

/**
 * The label and destination for the primary call to action.
 *
 * `to` is a route when the next step lives on the pass page, `action` is
 * `register` when it opens the checkout dialog. Both are never set at once.
 */
export function passCta(state: Entitlement | null): {
  label: string
  short: string
  to: string | null
  action: 'register' | null
} {
  switch (state) {
    case 'basic':
      return { label: 'Upgrade to Festival Pass', short: 'Upgrade', to: '/pass', action: null }
    case 'festival':
      return { label: 'My Pass', short: 'My Pass', to: '/pass', action: null }
    // `null` is "still loading". Register Now is the right guess for the
    // overwhelming majority and the only one that is never a dead end: the
    // dialog itself tells a delegate they are already registered.
    default:
      return { label: 'Register Now', short: 'Register', to: null, action: 'register' }
  }
}
