import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'pwa-icon.svg'],
      manifest: {
        name: 'Oshodi Isolo Excel Cooperative',
        short_name: 'Oshodi Coop',
        description: 'Management and accounting system for Oshodi Isolo Excel Cooperative.',
        theme_color: '#0D1B3E',
        background_color: '#F1F5F9',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/pwa-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        runtimeCaching: [{urlPattern: ({url}) => url.pathname.startsWith('/api'), handler: 'NetworkOnly'}],
      },
    }),
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true }
    }
  }
})
