import { useSyncExternalStore } from 'react'

import { authSnapshot, subscribeAuth, type AuthState } from '../api/client'

/**
 * Whether anyone is signed in, and who.
 *
 * Backed by the store in the API client rather than by a read at mount time,
 * so the header changes the moment somebody signs in or out instead of waiting
 * for a reload.
 */
export function useAuth(): AuthState {
  return useSyncExternalStore(subscribeAuth, authSnapshot, authSnapshot)
}

/** "Siddhant Shourya" becomes "Siddhant". Falls back to the part before the @. */
export function firstName(state: AuthState): string | null {
  const name = state.account?.name?.trim()
  if (name) return name.split(/\s+/)[0]
  const email = state.account?.email
  if (!email) return null
  const local = email.split('@')[0].replace(/[._-]+/g, ' ').trim()
  if (!local) return null
  return local.split(/\s+/)[0].replace(/^./, (c) => c.toUpperCase())
}
