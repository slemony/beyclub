import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' + HashRouter keeps the app portable on GitHub Pages
// regardless of the repo name.
export default defineConfig({
  base: './',
  plugins: [react()],
})
