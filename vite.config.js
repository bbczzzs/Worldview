import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy adsb.lol API to bypass CORS
      '/proxy/adsblol': {
        target: 'https://api.adsb.lol',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/adsblol/, ''),
        timeout: 15000,
      },
      // Proxy adsb.fi API to bypass CORS
      '/proxy/adsbfi': {
        target: 'https://opendata.adsb.fi',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/adsbfi/, ''),
        timeout: 15000,
      },
    },
  },
})
