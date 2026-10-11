import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Default: local API :8787. HA edge: set VITE_API_PROXY=http://localhost:8080
      '/api': {
        target: process.env.VITE_API_PROXY || 'http://localhost:8787',
        changeOrigin: true,
      },
      '/uploads': {
        target: process.env.VITE_API_PROXY || 'http://localhost:8787',
        changeOrigin: true,
      },
      '/ws': {
        target: (process.env.VITE_API_PROXY || 'http://localhost:8787').replace(/^http/, 'ws'),
        ws: true,
      },
    },
  },
})
