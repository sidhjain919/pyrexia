import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type RegistrationCtx = {
  open: boolean
  preselected: string[]
  openRegister: (event?: string) => void
  closeRegister: () => void
}

const Ctx = createContext<RegistrationCtx | null>(null)

export function RegistrationProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [preselected, setPreselected] = useState<string[]>([])

  const openRegister = useCallback((event?: string) => {
    setPreselected(event ? [event] : [])
    setOpen(true)
  }, [])
  const closeRegister = useCallback(() => setOpen(false), [])

  const value = useMemo(
    () => ({ open, preselected, openRegister, closeRegister }),
    [open, preselected, openRegister, closeRegister],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useRegistration() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useRegistration must be used within RegistrationProvider')
  return ctx
}
