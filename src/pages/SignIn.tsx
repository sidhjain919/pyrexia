import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { AlertCircle, ArrowRight, Loader2, Mail } from 'lucide-react'

import { ApiError, api, setSession } from '../api/client'
import GoogleButton from '../auth/GoogleButton'
import { Field, TextInput } from '../registration/fields'

/**
 * Sign in, create an account, or ask for a reset, one page, three modes.
 *
 * It is a plain email-and-password form on purpose. The previous version asked
 * for an email and then said "check your inbox", which reads as a mailing-list
 * signup rather than a way in, and left anyone who lost the mail with nowhere
 * to go. Email is now only the recovery path, which is where people expect it.
 *
 * The wording is deliberate throughout: an account is never called a
 * "registration". Registration is the ₹500 thing, and conflating them is how
 * somebody turns up at a gate believing they have paid.
 *
 * Signing up now ends on a code screen rather than straight inside. The pass
 * is delivered by email, so an address nobody has proved means someone can pay
 * ₹500 and never receive the thing they bought. Google skips that screen
 * entirely: it has already checked the address, which is most of why it is
 * offered first.
 */

type Mode = 'signin' | 'signup' | 'forgot' | 'verify'

export default function SignIn() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [mode, setMode] = useState<Mode>(params.get('new') === '1' ? 'signup' : 'signin')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [fatal, setFatal] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState<{ message: string; devToken?: string } | null>(null)

  /** Set once a code is on its way; also the address the code belongs to. */
  const [pending, setPending] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [resentAt, setResentAt] = useState<number | null>(null)

  /** Where to go once they're in: set when the event flow sends them here. */
  const next = params.get('next')

  const go = () => navigate(next && next.startsWith('/') ? next : '/pass', { replace: true })

  const submit = async () => {
    setBusy(true)
    setErrors({})
    setFatal(null)
    try {
      if (mode === 'forgot') {
        const res = await api.forgotPassword(email)
        setSent({ message: res.message, devToken: res.devToken })
        return
      }

      if (mode === 'verify') {
        const res = await api.verifyEmail(pending ?? email, code)
        setSession(res.token, res.account)
        go()
        return
      }

      if (mode === 'signup') {
        // No session here: sign-up ends with a code, not a way in.
        const res = await api.signUp(email, password)
        setPending(res.email)
        setMode('verify')
        return
      }

      const res = await api.signIn(email, password)
      setSession(res.token, res.account)
      go()
    } catch (err) {
      if (err instanceof ApiError) {
        // An account made before the address was proved, or one that never
        // finished. The server has already sent a fresh code.
        if (err.code === 'verification_required') {
          setPending(String(err.extra.email ?? email))
          setCode('')
          setMode('verify')
          return
        }
        if (err.fields) setErrors(err.fields)
        else setFatal(err.message)
      } else {
        setFatal('Something went wrong. Please try again.')
      }
    } finally {
      setBusy(false)
    }
  }

  const signInWithGoogle = async (credential: string) => {
    setBusy(true)
    setFatal(null)
    try {
      const res = await api.googleSignIn(credential)
      setSession(res.token, res.account)
      go()
    } catch (err) {
      setFatal(
        err instanceof ApiError ? err.message : 'Google sign-in failed. Please try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    if (!pending) return
    setBusy(true)
    setFatal(null)
    setErrors({})
    try {
      await api.resendCode(pending)
      setResentAt(Date.now())
      setCode('')
    } catch (err) {
      setFatal(err instanceof ApiError ? err.message : 'Could not send another code.')
    } finally {
      setBusy(false)
    }
  }

  /* ---------- reset link sent ---------- */

  if (sent) {
    return (
      <Shell title="Check your email">
        <p className="text-[0.94rem] leading-relaxed text-parchment/70">{sent.message}</p>

        {sent.devToken && (
          <div className="mt-5 rounded-lg border border-ember/40 bg-ember/10 p-4 text-left">
            <div className="font-log text-[0.58rem] uppercase tracking-wide2 text-ember">
              Development only · email is not switched on yet
            </div>
            <a
              href={`${import.meta.env.BASE_URL}reset?token=${encodeURIComponent(sent.devToken)}`}
              className="mt-2 block break-all text-[0.82rem] text-gold-bright underline"
            >
              Open the reset link
            </a>
          </div>
        )}

        <button
          onClick={() => {
            setSent(null)
            setMode('signin')
          }}
          className="mt-6 font-log text-[0.64rem] uppercase tracking-wide2 text-parchment/50 hover:text-gold-bright"
        >
          Back to sign in
        </button>
      </Shell>
    )
  }

  /* ---------- the code ---------- */

  if (mode === 'verify') {
    return (
      <Shell title="Check your email">
        <p className="text-[0.92rem] leading-relaxed text-parchment/65">
          We sent a six-digit code to{' '}
          <strong className="text-parchment/90">{pending ?? email}</strong>. It expires in ten
          minutes.
        </p>

        <div className="mt-7 text-left">
          <Field label="Verification code" required error={errors.code}>
            <TextInput
              value={code}
              onChange={(v) => {
                // Digits only, so a pasted "123 456" still works.
                setCode(v.replace(/\D/g, '').slice(0, 6))
                setErrors((e) => ({ ...e, code: '' }))
                setFatal(null)
              }}
              invalid={!!errors.code}
              type="text"
              placeholder="123456"
              autoComplete="one-time-code"
              inputMode="numeric"
            />
          </Field>
        </div>

        {fatal && (
          <div className="mt-5 flex items-start gap-2 rounded-lg border border-coral/50 bg-coral/10 p-3 text-left text-[0.82rem] text-coral">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            {fatal}
          </div>
        )}

        {resentAt && !fatal && (
          <p className="mt-5 rounded-lg border border-gold/25 bg-gold/10 p-3 text-[0.82rem] text-gold-bright">
            A new code is on its way. The previous one no longer works.
          </p>
        )}

        <button
          onClick={() => void submit()}
          disabled={busy || code.length !== 6}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep py-3.5 font-log text-[0.72rem] uppercase tracking-wide2 text-abyss transition-transform hover:scale-[1.01] disabled:opacity-50"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
          Confirm my email
        </button>

        <div className="mt-6 flex flex-col items-center gap-2.5 text-[0.84rem]">
          <button
            onClick={() => void resend()}
            disabled={busy}
            className="text-parchment/55 transition-colors hover:text-gold-bright disabled:opacity-50"
          >
            Didn't get it? <span className="text-gold-bright">Send another</span>
          </button>
          <button
            onClick={() => {
              setMode('signin')
              setPending(null)
              setCode('')
              setResentAt(null)
              setFatal(null)
            }}
            className="text-parchment/45 transition-colors hover:text-gold-bright"
          >
            Use a different email
          </button>
        </div>

        <p className="mt-7 text-[0.78rem] leading-relaxed text-parchment/45">
          Check your spam folder before asking for another; it is the usual
          culprit.
        </p>
      </Shell>
    )
  }

  /* ---------- the form ---------- */

  const title =
    mode === 'signup' ? 'Create your account' : mode === 'forgot' ? 'Reset your password' : 'Sign in'

  const subtitle =
    mode === 'signup'
      ? 'An account lets you register for the fest and enter events. It takes two fields.'
      : mode === 'forgot'
        ? "Enter the email you signed up with and we'll send you a link."
        : 'Welcome back, voyager.'

  return (
    <Shell title={title}>
      <p className="mb-7 text-[0.92rem] leading-relaxed text-parchment/65">{subtitle}</p>

      {mode !== 'forgot' && (
        <div className="mb-7">
          <GoogleButton onCredential={(c) => void signInWithGoogle(c)} disabled={busy} />

          <div className="mt-7 flex items-center gap-3">
            <div className="h-px flex-1 bg-gold/15" />
            <span className="font-log text-[0.58rem] uppercase tracking-wide2 text-parchment/35">
              or with email
            </span>
            <div className="h-px flex-1 bg-gold/15" />
          </div>
        </div>
      )}

      <div className="space-y-4 text-left">
        <Field label="Email" required error={errors.email}>
          <TextInput
            value={email}
            onChange={(v) => {
              setEmail(v)
              setErrors((e) => ({ ...e, email: '' }))
            }}
            invalid={!!errors.email}
            type="email"
            placeholder="you@college.edu"
            autoComplete="email"
          />
        </Field>

        {mode !== 'forgot' && (
          <Field
            label="Password"
            required
            error={errors.password}
            hint={mode === 'signup' ? 'At least 8 characters.' : undefined}
          >
            <TextInput
              value={password}
              onChange={(v) => {
                setPassword(v)
                setErrors((e) => ({ ...e, password: '' }))
              }}
              invalid={!!errors.password}
              type="password"
              placeholder={mode === 'signup' ? 'Choose a password' : 'Your password'}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
          </Field>
        )}
      </div>

      {fatal && (
        <div className="mt-5 flex items-start gap-2 rounded-lg border border-coral/50 bg-coral/10 p-3 text-left text-[0.82rem] text-coral">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          {fatal}
        </div>
      )}

      <button
        onClick={() => void submit()}
        disabled={busy}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep py-3.5 font-log text-[0.72rem] uppercase tracking-wide2 text-abyss transition-transform hover:scale-[1.01] disabled:opacity-60"
      >
        {busy ? (
          <Loader2 size={15} className="animate-spin" />
        ) : mode === 'forgot' ? (
          <Mail size={15} />
        ) : (
          <ArrowRight size={15} />
        )}
        {mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Sign in'}
      </button>

      <div className="mt-6 flex flex-col items-center gap-2.5 text-[0.84rem]">
        {mode === 'signin' && (
          <>
            <button
              onClick={() => setMode('forgot')}
              className="text-parchment/55 transition-colors hover:text-gold-bright"
            >
              Forgot your password?
            </button>
            <button
              onClick={() => setMode('signup')}
              className="text-parchment/75 transition-colors hover:text-gold-bright"
            >
              New here? <span className="text-gold-bright">Create an account</span>
            </button>
          </>
        )}
        {mode !== 'signin' && (
          <button
            onClick={() => setMode('signin')}
            className="text-parchment/75 transition-colors hover:text-gold-bright"
          >
            Already have an account? <span className="text-gold-bright">Sign in</span>
          </button>
        )}
      </div>

      {mode === 'signup' && (
        <p className="mt-7 text-[0.78rem] leading-relaxed text-parchment/45">
          Creating an account is free and is <strong className="text-parchment/70">not</strong> your
          fest registration. Basic Registration is ₹500 and comes next.
        </p>
      )}
    </Shell>
  )
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex min-h-[80svh] items-center justify-center px-6 py-24">
      <div className="w-full max-w-sm text-center">
        <div className="font-log text-[0.62rem] uppercase tracking-cinema text-gold/70">
          PYREXIA 2026
        </div>
        <h1 className="mt-3 font-display text-3xl text-offwhite sm:text-4xl">{title}</h1>
        <div className="mt-7">{children}</div>
        <Link
          to="/"
          className="mt-10 inline-block font-log text-[0.62rem] uppercase tracking-wide2 text-parchment/40 hover:text-gold-bright"
        >
          ← Back to the island
        </Link>
      </div>
    </section>
  )
}
