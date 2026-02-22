import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy Aviation Edge API to bypass CORS
      '/proxy/aviationedge': {
        target: 'https://aviation-edge.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/aviationedge/, ''),
        timeout: 20000,
      },
    },
  },
})
