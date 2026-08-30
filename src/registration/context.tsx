import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

/**
 * Two distinct journeys:
 *  - `delegate`: buy the pass. Details, ID documents, payment, QR issued.
 *  - `event`   : enter one specific competition. Gated on a confirmed pass.
 */
export type RegisterMode = 'delegate' | 'event'

type RegistrationCtx = {
  open: boolean
  mode: RegisterMode
  /** The event being entered, when `mode` is `event`. */
  eventName: string | null
  /** Open the delegate pass flow. */
  openDelegate: () => void
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
    () => ({ open, mode, eventName, openDelegate, openRegister, closeRegister }),
    [open, mode, eventName, openDelegate, openRegister, closeRegister],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useRegistration() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useRegistration must be used within RegistrationProvider')
  return ctx
}
