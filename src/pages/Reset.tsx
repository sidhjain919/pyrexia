import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, Check, Loader2 } from 'lucide-react'

import { ApiError, api, setSession } from '../api/client'
import { Field, TextInput } from '../registration/fields'

/**
 * Choosing a new password from an emailed link.
 *
 * Succeeding signs them straight in: making someone reset a password and then
 * immediately type it again is a step that exists only because the code was
 * written that way.
 */
export default function Reset() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    setError(null)
    setFieldError(null)
    try {
      const res = await api.resetPassword(token, password)
      setSession(res.token, res.account)
      navigate('/pass', { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.fields?.password) setFieldError(err.fields.password)
      else setError(err instanceof Error ? err.message : 'That link could not be used.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex min-h-[80svh] items-center justify-center px-6 py-24">
      <div className="w-full max-w-sm text-center">
        <div className="font-log text-[0.62rem] uppercase tracking-cinema text-gold/70">
          PYREXIA 2026
        </div>
        <h1 className="mt-3 font-display text-3xl text-offwhite sm:text-4xl">
          Choose a new password
        </h1>

        {!token ? (
          <p className="mt-6 text-[0.92rem] text-parchment/70">
            That link is missing its code.{' '}
            <Link to="/sign-in" className="text-gold-bright underline">
              Ask for a new one
            </Link>
            .
          </p>
        ) : (
          <>
            <div className="mt-8 text-left">
              <Field label="New password" required error={fieldError ?? undefined} hint="At least 8 characters.">
                <TextInput
                  value={password}
                  onChange={(v) => {
                    setPassword(v)
                    setFieldError(null)
                  }}
                  invalid={!!fieldError}
                  type="password"
                  placeholder="Choose a password"
                  autoComplete="new-password"
                />
              </Field>
            </div>

            {error && (
              <div className="mt-5 flex items-start gap-2 rounded-lg border border-coral/50 bg-coral/10 p-3 text-left text-[0.82rem] text-coral">
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <button
              onClick={() => void submit()}
              disabled={busy}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep py-3.5 font-log text-[0.72rem] uppercase tracking-wide2 text-abyss disabled:opacity-60"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              Save and sign in
            </button>

            <p className="mt-5 text-[0.78rem] leading-relaxed text-parchment/45">
              Saving this signs you out everywhere else.
            </p>
          </>
        )}
      </div>
    </section>
  )
}
