import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, Loader2 } from 'lucide-react'

import { ApiError, api, setSession } from '../api/client'

/**
 * The landing spot for a sign-in link.
 *
 * `/enter?token=…&next=/pass`: spends the token, stores the session, and
 * forwards. The token is single-use, so this page must run exactly once even
 * though React's development mode mounts effects twice; hence the ref guard.
 */
export default function Enter() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const spent = useRef(false)

  const token = params.get('token')
  const next = params.get('next') || '/pass'

  useEffect(() => {
    if (spent.current) return
    spent.current = true

    if (!token) {
      setError('That link is missing its sign-in code. Ask for a new one.')
      return
    }

    api
      .consumeSignIn(token)
      .then((res) => {
        setSession(res.token, res.account)
        // `replace` so the back button doesn't return them to a spent link.
        navigate(next.startsWith('/') ? next : '/pass', { replace: true })
      })
      .catch((err) => {
        setError(
          err instanceof ApiError
            ? err.message
            : 'That link could not be used. Ask for a new one.',
        )
      })
  }, [token, next, navigate])

  return (
    <section className="flex min-h-[70svh] items-center justify-center px-6 py-24">
      <div className="w-full max-w-sm text-center">
        {error ? (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-coral/50 bg-coral/10">
              <AlertCircle size={20} className="text-coral" />
            </div>
            <h1 className="mt-5 font-display text-2xl text-offwhite">That link didn't work</h1>
            <p className="mt-2 text-[0.92rem] leading-relaxed text-parchment/70">{error}</p>
            <button
              onClick={() => navigate('/sign-in', { replace: true })}
              className="mt-6 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep px-6 py-3 font-log text-[0.68rem] uppercase tracking-wide2 text-abyss"
            >
              Send me a new link
            </button>
          </>
        ) : (
          <>
            <Loader2 size={26} className="mx-auto animate-spin text-gold/70" />
            <p className="mt-4 font-display text-lg text-offwhite">Signing you in…</p>
          </>
        )}
      </div>
    </section>
  )
}
