import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// Base path differs per host:
//  - GitHub Pages serves from the project subpath "/pyrexia/"
//  - Vercel (and local dev/build) serve from the domain root "/"
// GitHub Actions sets GITHUB_ACTIONS=true; Vercel does not.
// The site is served from the root of pyrexiaaiims.com. It lived under
// /pyrexia/ while it was a GitHub project page; public/CNAME is what moved it.
const base = '/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
})
