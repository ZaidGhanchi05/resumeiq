import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const api = 'http://localhost:8000'
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: { '/api': api, '/reports': api } },
})
