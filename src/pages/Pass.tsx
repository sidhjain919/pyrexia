import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import QRCode from 'qrcode'
import { AlertCircle, Check, Download, Loader2, LogOut, RefreshCw, Star, Ticket } from 'lucide-react'

import {
  ApiError,
  api,
  clearSession,
  rememberAccount,
  getSession,
  newIdempotencyKey,
  waitForConfirmation,
  type Me,
  type PassView,
} from '../api/client'
import { ANNOUNCEMENT_CHANNEL } from '../data/site'
import { openCheckout, PaymentCancelled } from '../registration/razorpay'
import { useRegistration } from '../registration/context'

/**
 * My Voyage: the pass, and the one thing left to buy.
 *
 * The QR is rendered here from a token the server signs on every request rather
 * than from a stored image. That costs nothing and means the code on screen is
 * always current: buy the Festival Pass and reopen this page, and the QR
 * already says Delegate.
 */
export default function Pass() {
  const navigate = useNavigate()
  const { openRegister } = useRegistration()
  const [me, setMe] = useState<Me | null>(null)
  const [pass, setPass] = useState<PassView | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!getSession()) {
      navigate('/sign-in', { replace: true })
      return
    }
    setLoading(true)
    setError(null)
    try {
      const account = await api.me()
      setMe(account)
      // Keeps the greeting in the header right for sessions that predate it,
      // and for anyone whose name changed since they signed in.
      rememberAccount({
        email: account.email,
        name: account.name,
        publicCode: account.publicCode,
        hasRegistration: account.hasRegistration,
      })

      if (account.hasPass) {
        const p = await api.pass()
        setPass(p)
        setQr(
          await QRCode.toDataURL(p.token, {
            width: 900,
            margin: 1,
            errorCorrectionLevel: 'M',
            // Dark ink on parchment: high contrast, and it survives being
            // photographed off a screen in a dark queue.
            color: { dark: '#06141b', light: '#e8d5ae' },
          }),
        )
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearSession()
        navigate('/sign-in', { replace: true })
        return
      }
      setError(err instanceof Error ? err.message : 'Could not load your pass.')
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    void load()
  }, [load])

  const upgrade = async () => {
    if (!me) return
    setUpgrading(true)
    setNotice(null)
    try {
      // The account id isn't exposed by /api/me on purpose, so ask the upgrade
      // endpoint through the session rather than passing an id around the UI.
      const created = await api.upgrade('me', ['delegate'], newIdempotencyKey())
      const result = await openCheckout(created.checkout)
      await api.verifyCheckout(result).catch(() => {})

      setNotice('Confirming your payment…')
      const ok = await waitForConfirmation(created.orderId)
      setNotice(
        ok
          ? null
          : 'Your payment went through and is still confirming. Refresh in a moment.',
      )
      if (ok) await load()
    } catch (err) {
      if (err instanceof PaymentCancelled) {
        setNotice('Payment cancelled. Nothing has been charged.')
      } else {
        setNotice(err instanceof Error ? err.message : 'The upgrade could not be completed.')
      }
    } finally {
      setUpgrading(false)
    }
  }

  const signOut = async () => {
    await api.signOut().catch(() => {})
    clearSession()
    navigate('/', { replace: true })
  }

  if (loading) {
    return (
      <section className="flex min-h-[70svh] items-center justify-center px-6">
        <Loader2 size={26} className="animate-spin text-gold/70" />
      </section>
    )
  }

  if (error) {
    return (
      <section className="flex min-h-[70svh] items-center justify-center px-6 pb-24 pt-[calc(var(--header-h,7rem)+2rem)]">
        <div className="max-w-sm text-center">
          <AlertCircle size={22} className="mx-auto text-coral" />
          <p className="mt-4 text-parchment/75">{error}</p>
          <button
            onClick={() => void load()}
            className="mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-log text-[0.66rem] uppercase tracking-wide2 text-gold-bright ring-1 ring-inset ring-gold/50"
          >
            <RefreshCw size={13} /> Try again
          </button>
        </div>
      </section>
    )
  }

  if (!me) return null

  const isDelegate = me.tier === 1

  return (
    <section className="relative px-6 pb-24 pt-[calc(var(--header-h,7rem)+2rem)] sm:pb-28">
      <div className="mx-auto max-w-lg">
        <div className="text-center">
          <div className="font-log text-[0.62rem] uppercase tracking-cinema text-gold/70">
            My Voyage
          </div>
          <h1 className="mt-3 font-display text-3xl text-offwhite sm:text-4xl">
            {me.name || me.email}
          </h1>
          {me.college && (
            <p className="mt-1.5 text-[0.9rem] text-parchment/60">
              {me.college} · {me.course}, {me.year}
            </p>
          )}
        </div>

        {/* The whole design rests on "an account is not a registration", so an
            account without one has to say so before anything else. */}
        {!me.hasRegistration && (
          <div className="mt-9 rounded-2xl border border-ember/50 bg-ember/10 p-6 text-center">
            <AlertCircle size={22} className="mx-auto text-ember" />
            <p className="mt-3 font-display text-xl text-offwhite">
              You haven't registered for the fest yet
            </p>
            <p className="mx-auto mt-2 max-w-sm text-[0.88rem] leading-relaxed text-parchment/70">
              Having an account isn't the same as being registered. Basic Registration is ₹500, it's
              compulsory for everyone, and it covers every event.
            </p>
            <button
              onClick={() => openRegister()}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep px-7 py-3 font-log text-[0.68rem] uppercase tracking-wide2 text-abyss"
            >
              <Ticket size={14} /> Complete my registration · ₹500
            </button>
          </div>
        )}

        {/* The pass */}
        {/* Shown to anyone who holds a registration, not only to somebody who
            has just bought one: most people who registered before this existed
            will meet the channel here, and during the fest this page is the one
            they open most. */}
        {me.hasRegistration && (
          <a
            href={ANNOUNCEMENT_CHANNEL.href}
            target="_blank"
            rel="noreferrer"
            className="mt-6 block rounded-xl border border-aqua/45 bg-aqua/10 px-5 py-4 transition-colors hover:border-aqua"
          >
            <div className="font-display text-[1.02rem] text-offwhite">
              Join the announcement channel
            </div>
            <p className="mt-1 text-[0.83rem] leading-relaxed text-parchment/70">
              Every schedule change and result goes here first.
            </p>
            <p className="mt-2 text-[0.79rem] leading-relaxed text-aqua">
              {ANNOUNCEMENT_CHANNEL.mute}
            </p>
          </a>
        )}

        {me.hasRegistration && pass && qr ? (
          <div
            /*
             * Back to the drawn parchment surface.
             *
             * The printed-ticket plate was stretched to whatever box the
             * contents made — `background-size: 100% 100%` on an image with a
             * 16:9 engraved border, filled with a tall QR card. The border came
             * out smeared and the perforated stub landed in the middle of the
             * code. The CSS surface has no fixed proportions to violate, which
             * is exactly why it survived every screen size.
             */
            className="parchment mt-9 rounded-2xl p-6 shadow-cinema sm:p-8"
          >
            {/* The date line gets its own row: sharing one with the tier badge
                left both it and the name wrapping on a narrow phone. */}
            <div className="font-log text-[0.58rem] uppercase tracking-cinema text-wood/60">
              PYREXIA 2026 · 12–16 October
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="font-display text-xl leading-tight text-wood">{pass.name}</div>
              <span
                className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 font-log text-[0.55rem] uppercase tracking-wide2 ${
                  isDelegate ? 'bg-blood/90 text-parchment' : 'bg-wood/15 text-wood/80'
                }`}
              >
                {isDelegate ? 'Delegate' : 'Basic'}
              </span>
            </div>

            <div className="my-5 h-px bg-wood/20" />

            <img
              src={qr}
              alt="Your entry QR code"
              className="mx-auto w-full max-w-[260px] rounded-lg ring-1 ring-wood/20"
            />

            <div className="mt-5 text-center">
              <div className="font-log text-[0.56rem] uppercase tracking-wide2 text-wood/55">
                Registration number
              </div>
              <div className="font-display text-lg tracking-wide text-wood">{pass.publicCode}</div>
            </div>

            <p className="mt-5 text-center text-[0.7rem] leading-relaxed text-wood/60">
              Show this at the gate. It works offline, but don't share it: one entry per gate per
              day, and the guard sees your name.
            </p>
          </div>
        ) : me.hasRegistration ? (
          <div className="glass mt-9 rounded-2xl p-8 text-center">
            <Ticket size={22} className="mx-auto text-gold/60" />
            <p className="mt-3 font-display text-xl text-offwhite">No pass yet</p>
            <p className="mx-auto mt-2 max-w-xs text-[0.86rem] text-parchment/65">
              Your pass appears here as soon as your Basic Registration is confirmed.
            </p>
          </div>
        ) : null}

        {qr && (
          <a
            href={qr}
            download={`pyrexia-2026-${pass?.publicCode ?? 'pass'}.png`}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 font-log text-[0.66rem] uppercase tracking-wide2 text-gold-bright ring-1 ring-inset ring-gold/50 transition-colors hover:bg-gold/10"
          >
            <Download size={13} /> Save the QR
          </a>
        )}

        {/* Upgrade */}
        {me.hasRegistration && !isDelegate && me.available.some((p) => p.id === 'delegate') && (
          <div className="glass mt-6 rounded-2xl p-6">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-display text-[1.05rem] leading-tight text-offwhite sm:text-lg">
                Add the Festival Pass
              </span>
              <span className="shrink-0 whitespace-nowrap font-display text-lg text-gold-bright">
                +₹{((me.available.find((p) => p.id === 'delegate')?.amountPaise ?? 225000) / 100).toLocaleString('en-IN')}
              </span>
            </div>
            <p className="mt-1.5 text-[0.85rem] leading-relaxed text-parchment/65">
              Full access to everything the island runs, all five evenings included. Your pass
              stays the same, and anything you've already printed keeps working.
            </p>
            <button
              onClick={() => void upgrade()}
              disabled={upgrading}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep py-3 font-log text-[0.68rem] uppercase tracking-wide2 text-abyss disabled:opacity-60"
            >
              {upgrading ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} />}
              {upgrading ? 'Working…' : 'Open the full programme'}
            </button>
          </div>
        )}

        {isDelegate && (
          <div className="mt-6 flex items-center gap-2.5 rounded-xl border border-aqua/35 bg-aqua/10 px-4 py-3">
            <Check size={15} className="shrink-0 text-aqua" />
            <span className="text-[0.86rem] text-parchment/80">
              The full festival programme is open to you.
            </span>
          </div>
        )}

        {notice && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-ember/40 bg-ember/10 p-3 text-[0.82rem] text-ember">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            {notice}
          </div>
        )}

        {/* Events entered */}
        {me.entries.length > 0 && (
          <div className="mt-8">
            <div className="font-log text-[0.6rem] uppercase tracking-cinema text-gold/70">
              Events you've entered
            </div>
            <ul className="mt-3 divide-y divide-gold/10">
              {me.entries.map((e) => (
                <li key={e.eventName} className="flex items-center justify-between gap-3 py-3">
                  <span className="text-[0.92rem] text-offwhite">{e.eventName}</span>
                  <span className="font-log text-[0.6rem] uppercase tracking-wide2 text-parchment/50">
                    {e.teamName ?? e.participation}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          onClick={() => void signOut()}
          className="mx-auto mt-12 flex items-center gap-2 font-log text-[0.62rem] uppercase tracking-wide2 text-parchment/45 transition-colors hover:text-coral"
        >
          <LogOut size={12} /> Sign out
        </button>
      </div>
    </section>
  )
}
