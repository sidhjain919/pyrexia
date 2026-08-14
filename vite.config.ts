import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// Dev serves from "/"; the production build targets the GitHub Pages
// project path "/pyrexia/".
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/pyrexia/' : '/',
  plugins: [react(), tailwindcss()],
}))
