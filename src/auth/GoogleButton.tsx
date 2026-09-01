import { useEffect, useRef, useState } from 'react'

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
  const [failed, setFailed] = useState(false)

  // Held in a ref so re-renders don't tear down and re-render Google's iframe,
  // which flickers and loses the button's own loading state.
  const callback = useRef(onCredential)
  callback.current = onCredential

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

        holder.current.replaceChildren()
        id.renderButton(holder.current, {
          type: 'standard',
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          logo_alignment: 'center',
          // Google's maximum. The wrapper below is sized to match.
          width: 400,
        })
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [])

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
   * Google renders the button into a cross-origin iframe we cannot restyle,
   * and it draws two entirely different buttons in there.
   *
   * Signed out, it honours `filled_black` and hands back a dark pill 46px
   * tall. Signed in, it substitutes the *personalised* button - an avatar,
   * "Continue as <name>", the address on a second line, a disclosure chevron -
   * which is both taller than 46px and painted light no matter what theme was
   * asked for. Neither of those is negotiable from out here.
   *
   * This used to clip to a hard 46px on the assumption there was only the
   * first button, so the second one arrived with its bottom sliced off, and
   * the white the iframe paints behind its pill leaked out at the corners
   * where our radius and theirs disagreed.
   *
   * So the frame stops fighting it. It sizes to whatever Google draws instead
   * of imposing a height, and it is deliberately light: the leak is white, so
   * a white plate is the one background it cannot show up against, and it
   * gives the personalised button somewhere to belong rather than floating as
   * a bright slab on a dark page. The gold ring is what makes it read as part
   * of this site rather than something pasted onto it.
   */
  return (
    <div
      aria-busy={disabled}
      className={`mx-auto flex w-full max-w-[400px] items-center justify-center overflow-hidden rounded-full bg-white p-[3px] shadow-[0_10px_30px_-14px_rgba(0,0,0,0.9)] ring-1 ring-gold/45 ${
        disabled ? 'pointer-events-none opacity-50' : ''
      }`}
    >
      <div ref={holder} className="flex w-full items-center justify-center overflow-hidden rounded-full" />
    </div>
  )
}
