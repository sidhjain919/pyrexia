import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

// Fonts (self-hosted, performant)
import '@fontsource/cinzel/400.css'
import '@fontsource/cinzel/500.css'
import '@fontsource/cinzel/600.css'
import '@fontsource/cinzel/700.css'
import '@fontsource/cinzel/800.css'
import '@fontsource/cinzel-decorative/700.css'
import '@fontsource/cinzel-decorative/900.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/special-elite/400.css'
import '@fontsource/rye/400.css'

import './index.css'
import App from './App.tsx'
import { RegistrationProvider } from './registration/context'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
      <RegistrationProvider>
        <App />
      </RegistrationProvider>
    </BrowserRouter>
  </StrictMode>,
)
