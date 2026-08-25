import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, Loader2, Mail, Send } from 'lucide-react'

import { ApiError, api } from '../api/client'

/**
 * Signing back in.
 *
 * There is nothing to sign *up* for here — paying is what creates the account.
 * This page exists for the person who has already registered and no longer has
 * the confirmation email to hand.
 *
 * The reply is deliberately the same whether or not the account exists, so this
 * form can't be used to work out who has bought a pass.
 */
export default function SignIn() {
  const [identifier, setIdentifier] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [devLink, setDevLink] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!identifier.trim()) return

    setState('sending')
    setError(null)
    try {
      const res = await api.requestSignIn(identifier.trim())
      setState('sent')
      // Only ever present outside production — lets the flow be walked through
      // before the mailer is switched on.
      if (res.devToken) {
        setDevLink(
          `${window.location.origin}${import.meta.env.BASE_URL}enter?token=${encodeURIComponent(res.devToken)}&next=%2Fpass`,
        )
      }
    } catch (err) {
      setState('idle')
      setError(err instanceof ApiError ? err.message : 'Could not send the link. Try again.')
    }
  }

  return (
    <section className="flex min-h-[75svh] items-center justify-center px-6 py-24">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <div className="font-log text-[0.62rem] uppercase tracking-cinema text-gold/70">
            Returning voyager
          </div>
          <h1 className="mt-3 font-display text-3xl text-offwhite">Find your pass</h1>
          <p className="mt-2.5 text-[0.92rem] leading-relaxed text-parchment/65">
            Enter the email or mobile you registered with and we'll send a link straight to your
            inbox. No password to remember.
          </p>
        </div>

        {state === 'sent' ? (
          <div className="mt-8">
            <div className="glass flex flex-col items-center gap-3 rounded-xl px-6 py-8 text-center">
              <Mail size={22} className="text-gold/70" />
              <p className="font-display text-xl text-offwhite">Check your inbox</p>
              <p className="max-w-xs text-[0.86rem] leading-relaxed text-parchment/65">
                If that account exists, a sign-in link is on its way. It works once and expires in
                30 minutes.
              </p>
            </div>

            {devLink && (
              <div className="mt-4 rounded-lg border border-ember/40 bg-ember/10 p-3">
                <div className="font-log text-[0.56rem] uppercase tracking-wide2 text-ember">
                  Development only — email is not switched on yet
                </div>
                <a href={devLink} className="mt-1.5 block break-all text-[0.78rem] text-gold-bright">
                  {devLink}
                </a>
              </div>
            )}

            <button
              onClick={() => {
                setState('idle')
                setDevLink(null)
              }}
              className="mt-5 w-full text-center font-log text-[0.62rem] uppercase tracking-wide2 text-parchment/45 hover:text-gold-bright"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8">
            <label htmlFor="identifier" className="sr-only">
              Email or mobile
            </label>
            <input
              id="identifier"
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value)
                setError(null)
              }}
              placeholder="you@college.edu or 10-digit mobile"
              autoComplete="email"
              className={`w-full rounded-lg border bg-ocean/60 px-4 py-3 text-offwhite outline-none placeholder:text-parchment/35 focus:border-gold/70 ${
                error ? 'border-coral/70' : 'border-gold/25'
              }`}
            />

            {error && (
              <div className="mt-2.5 flex items-start gap-2 text-[0.82rem] text-coral">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={state === 'sending'}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep py-3.5 font-log text-[0.7rem] uppercase tracking-wide2 text-abyss disabled:opacity-60"
            >
              {state === 'sending' ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Sending…
                </>
              ) : (
                <>
                  <Send size={14} /> Send me a link
                </>
              )}
            </button>
          </form>
        )}

        <p className="mt-8 text-center text-[0.86rem] text-parchment/55">
          Not registered yet?{' '}
          <Link to="/#register" className="text-gold-bright hover:underline">
            Start here
          </Link>
        </p>
      </div>
    </section>
  )
}
