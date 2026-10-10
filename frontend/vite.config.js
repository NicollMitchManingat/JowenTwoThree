import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      // Local dev only: forwards same-origin `/api/*` to the Express backend
      // so the frontend can use relative URLs (matching Vercel rewrites).
      '/api': 'http://localhost:3001'
    }
  },
  resolve: {
    dedupe: ['react', 'react-dom']
  }
})
