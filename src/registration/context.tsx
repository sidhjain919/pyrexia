import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

/**
 * Three distinct journeys:
 *  - `delegate`     : buy the pass. Details, ID documents, payment, QR issued.
 *  - `event`        : enter one specific competition. Gated on a confirmed pass.
 *  - `accommodation`: book a bed for the five days. Also gated on the pass.
 */
export type RegisterMode = 'delegate' | 'event' | 'accommodation'

type RegistrationCtx = {
  open: boolean
  mode: RegisterMode
  /** The event being entered, when `mode` is `event`. */
  eventName: string | null
  /** Open the delegate pass flow. */
  openDelegate: () => void
  /** Open the accommodation booking form. */
  openAccommodation: () => void
  /** Open the entry form for one event. Falls back to the delegate flow with no name. */
  openRegister: (event?: string) => void
  closeRegister: () => void
}

const Ctx = createContext<RegistrationCtx | null>(null)

export function RegistrationProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<RegisterMode>('delegate')
  const [eventName, setEventName] = useState<string | null>(null)

  const openDelegate = useCallback(() => {
    setMode('delegate')
    setEventName(null)
    setOpen(true)
  }, [])

  const openAccommodation = useCallback(() => {
    setMode('accommodation')
    setEventName(null)
    setOpen(true)
  }, [])

  const openRegister = useCallback((event?: string) => {
    if (event) {
      setMode('event')
      setEventName(event)
    } else {
      setMode('delegate')
      setEventName(null)
    }
    setOpen(true)
  }, [])

  const closeRegister = useCallback(() => setOpen(false), [])

  const value = useMemo(
    () => ({
      open,
      mode,
      eventName,
      openDelegate,
      openAccommodation,
      openRegister,
      closeRegister,
    }),
    [open, mode, eventName, openDelegate, openAccommodation, openRegister, closeRegister],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useRegistration() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useRegistration must be used within RegistrationProvider')
  return ctx
}
