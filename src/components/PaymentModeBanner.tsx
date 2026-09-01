import { useEffect, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

import { api } from '../api/client'

/**
 * A strip across the top of every page while the gateway is in test mode.
 *
 * The failure this exists to prevent has one shape: somebody switches Razorpay
 * to test keys for a dry run, the run goes well, the site gets announced, and
 * nobody notices for a day that every registration since has taken zero rupees
 * and issued a real pass. Nothing else on the page looks any different — the
 * checkout opens, the payment succeeds, the confirmation email arrives. Test
 * mode is invisible by design, which is exactly the problem.
 *
 * So it is deliberately loud, deliberately not dismissible, and it sits above
 * everything including the header. An ugly banner for a few hours is a fair
 * price for never shipping a live fest that cannot take money.
 *
 * Live mode renders nothing at all, so this costs the real site one request
 * that returns four bytes.
 */
export default function PaymentModeBanner() {
  const [testMode, setTestMode] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  /*
   * The header is fixed to the top too, so a banner that just appears there
   * covers it. `--banner-h` is what the header offsets itself by, and the
   * resize event is what makes it re-measure: the banner arrives after a fetch,
   * long after the header last worked out its own height.
   */
  useEffect(() => {
    const height = testMode ? Math.round(ref.current?.getBoundingClientRect().height ?? 0) : 0
    document.documentElement.style.setProperty('--banner-h', `${height}px`)
    window.dispatchEvent(new Event('resize'))
    return () => {
      document.documentElement.style.setProperty('--banner-h', '0px')
      window.dispatchEvent(new Event('resize'))
    }
  }, [testMode])

  useEffect(() => {
    let alive = true
    api
      .paymentMode()
      .then((mode) => alive && setTestMode(mode === 'test'))
      // A banner that cannot reach the API says nothing rather than guessing.
      // Guessing wrong in either direction is worse than staying quiet.
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  if (!testMode) return null

  return (
    <div
      ref={ref}
      role="status"
      className="fixed inset-x-0 top-0 z-[1200] flex items-center justify-center gap-2 bg-coral px-4 py-2 text-center font-log text-[0.62rem] uppercase tracking-wide2 text-abyss sm:text-[0.7rem]"
    >
      <AlertTriangle size={14} className="shrink-0" />
      <span>
        Test mode — payments are not real and no money is taken
      </span>
    </div>
  )
}
