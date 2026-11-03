import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://localhost',
        ws: true
      },
      '/images': {
        target: 'http://localhost',
        changeOrigin: true
      },
      '/p': {
        target: 'http://localhost',
        changeOrigin: true
      },
      '/receipt': {
        target: 'http://localhost',
        changeOrigin: true
      },
      '/r': {
        target: 'http://localhost',
        changeOrigin: true
      }
    }
  }
})
