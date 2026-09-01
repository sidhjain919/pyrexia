import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * "Continue with Google".
 *
 * Google renders this button itself, inside an iframe we are not allowed to
 * restyle: that is the deal for using it, and trying to fake it with our own
 * markup is both against their terms and a good way to get sign-in blocked.
 * So the surrounding page adapts to the button rather than the other way
 * round. Note that `theme` is a request, not a guarantee - see the frame at
 * the bottom of this file for the two different buttons Google will draw.
 *
 * The client id is public on purpose: it ships inside every page that shows
 * this button. What makes it safe is the origin allowlist in Google's console
 * plus the audience check the server does on the returned token, not secrecy.
 */

const CLIENT_ID = '422997955520-i6d1963hfip9gs9enp4lbf70onnfi754.apps.googleusercontent.com'
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

type GoogleId = {
  initialize: (config: {
    client_id: string
    callback: (response: { credential?: string }) => void
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
  }) => void
  renderButton: (
    parent: HTMLElement,
    options: Record<string, string | number>,
  ) => void
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } }
  }
}

/** Load Google's script once, however many buttons ask for it. */
let loader: Promise<void> | null = null

function loadScript(): Promise<void> {
  if (loader) return loader

  loader = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('google script failed')))
      if (window.google?.accounts?.id) resolve()
      return
    }

    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('google script failed'))
    document.head.appendChild(script)
  })

  return loader
}

export default function GoogleButton({
  onCredential,
  disabled,
}: {
  onCredential: (credential: string) => void
  disabled?: boolean
}) {
  const holder = useRef<HTMLDivElement>(null)
  /** The width the current iframe was drawn for, so a resize can tell if it moved. */
  const drawnAt = useRef(0)
  const [failed, setFailed] = useState(false)

  // Held in a ref so re-renders don't tear down and re-render Google's iframe,
  // which flickers and loses the button's own loading state.
  const callback = useRef(onCredential)
  callback.current = onCredential

  /*
   * Draw the button at the width it will actually occupy.
   *
   * `renderButton` takes a pixel width and lays the button out to exactly
   * that, so a hard-coded 400 on a container that turned out to be 384 had
   * Google drawing eight pixels of pill past each end, where `overflow-hidden`
   * sliced straight through the rounded caps. On a phone the gap is wider and
   * so is the damage. Measuring first is the only version of this that is
   * right at every width.
   *
   * Google clamps to 400 itself, so the max is theirs, not ours.
   */
  const draw = useCallback(() => {
    const id = window.google?.accounts?.id
    const node = holder.current
    if (!id || !node) return

    const width = Math.round(node.getBoundingClientRect().width)
    if (width < 200) return // not laid out yet; the observer will call back

    node.replaceChildren()
    id.renderButton(node, {
      type: 'standard',
      theme: 'filled_black',
      size: 'large',
      shape: 'pill',
      text: 'continue_with',
      logo_alignment: 'center',
      width: Math.min(width, 400),
    })
    drawnAt.current = width
  }, [])

  useEffect(() => {
    let cancelled = false

    loadScript()
      .then(() => {
        if (cancelled || !holder.current) return
        const id = window.google?.accounts?.id
        if (!id) {
          setFailed(true)
          return
        }

        id.initialize({
          client_id: CLIENT_ID,
          callback: (response) => {
            if (response.credential) callback.current(response.credential)
          },
          // No One Tap prompt on load. It appears over the page uninvited and
          // reads as an advert on a site people have not signed into yet.
          auto_select: false,
          cancel_on_tap_outside: true,
        })

        draw()
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    /*
     * Rotating a phone, or the scrollbar appearing, changes the width the
     * button was drawn for. Re-drawing is the only way to change it: the
     * width is baked into the iframe's URL. Guarded on a real change of whole
     * pixels, because tearing down Google's iframe on every sub-pixel reflow
     * flickers and loses its pressed state.
     */
    const node = holder.current
    if (!node) return

    const observer = new ResizeObserver(() => {
      if (cancelled) return
      const width = Math.round(node.getBoundingClientRect().width)
      if (width >= 200 && Math.abs(width - drawnAt.current) > 1) draw()
    })
    observer.observe(node)

    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [draw])

  // A blocked script, an ad blocker, a network that filters Google, none of
  // these should look like a broken page. Email and password still works, and
  // saying so is more use than an error.
  if (failed) {
    return (
      <p className="text-[0.78rem] leading-relaxed text-parchment/40">
        Google sign-in could not load. Use your email and password below.
      </p>
    )
  }

  /*
   * No frame, no clipping, no background of our own.
   *
   * Every previous attempt here was compensating for a button drawn to the
   * wrong width: a fixed height that sliced the personalised button, then a
   * plate to hide edges that only existed because the pill was overflowing.
   * Drawn to the width it actually has, the button needs none of it - it is
   * already `filled_black` on a dark page, which is the whole reason that
   * theme exists.
   *
   * The iframe runs about ten pixels wider and two taller than the pill it
   * contains; that margin is transparent and Google sets `color-scheme: dark`
   * on it, so nothing shows through. Height is left alone entirely, because
   * the personalised button is taller and only Google knows by how much.
   */
  return (
    <div
      aria-busy={disabled}
      className={`mx-auto w-full max-w-[400px] ${disabled ? 'pointer-events-none opacity-50' : ''}`}
    >
      {/*
       * A themed inset for Google's button.
       *
       * Google draws two different buttons in this iframe: a dark `filled_black`
       * pill for most people, and, for anyone already signed into Google, a
       * personalised "Continue as …" card that Google renders on a light
       * background we are not allowed to recolour. Bare on the page, that light
       * card reads as a stray white slab. Sitting it in this rounded dark inset
       * — padded, never clipped — makes it read as a deliberate control that
       * belongs to the page, and the ordinary dark button blends into it. The
       * inset owns the padding, so `draw()` still measures the true width and
       * nothing is sliced.
       */}
      <div className="flex justify-center rounded-2xl border border-gold/15 bg-ocean/50 p-2">
        <div ref={holder} className="w-full" />
      </div>
    </div>
  )
}
