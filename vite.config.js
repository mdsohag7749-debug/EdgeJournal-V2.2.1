import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { devApiPlugin } from './vite.dev-proxy.js'

export default defineConfig({
  test: {
    // Tests run in a simulated DOM (jsdom) via Vitest. `npm test` /
    // `npm run test:run` / `npm run test:coverage` all run Vitest with
    // this config; the VitePWA plugin below is inert during tests.
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    css: false,
    include: ['src/**/*.test.{js,jsx}', 'server/**/*.test.{js,jsx}'],
  },
  plugins: [
    react(),
    devApiPlugin(),
    VitePWA({
      // Service worker updates itself in the background and takes over
      // on the next load — no "click to update" flow needed for a
      // journaling app like this.
      registerType: 'autoUpdate',
      // Requirement asks for manifest.json by name; vite-plugin-pwa
      // defaults to manifest.webmanifest, so this is pinned explicitly.
      manifestFilename: 'manifest.json',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'EdgeJournal',
        short_name: 'EdgeJournal',
        description: 'Trades, goals, pre-market plans, reflections, and study notes — your whole trading edge in one journal.',
        theme_color: '#0b0b0d',
        background_color: '#f8f9fa',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the app shell: built HTML/JS/CSS plus any bundled
        // fonts/icons/images that ship in dist (fonts here are loaded
        // from Google Fonts at runtime, cached separately below).
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'],
        // SPA fallback so a deep link (e.g. /analytics) still loads the
        // shell when opened offline instead of a browser network error.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/rest\//, /^\/auth\//, /^\/storage\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          // Google Fonts stylesheet + the actual font files (index.html
          // pulls in Space Grotesk / Inter / JetBrains Mono).
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'edgejournal-google-fonts-stylesheets' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'edgejournal-google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Avatars + trade screenshots served from Supabase Storage
          // (public URLs for avatars, signed URLs for screenshots) —
          // cache the bytes so previously viewed images still render
          // offline. Keyed by full URL, so an expired/rotated signed
          // URL just refetches instead of serving something stale.
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'edgejournal-media',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        // Lets `npm run dev` register a real service worker too, so
        // offline behavior can be tested without doing a full build.
        enabled: true,
        type: 'module',
      },
    }),
  ],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-recharts': ['recharts'],
          'vendor-framer': ['framer-motion'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
})
