import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages는 프로젝트 저장소를 하위 경로(/management_money/)에서 서빙한다.
// 다른 정적 호스팅(Vercel/Netlify 등, 루트 경로)에 배포할 때는 VITE_BASE_PATH를 비워 두면 '/'를 쓴다.
const base = process.env.VITE_BASE_PATH || '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '가계부 — Management Money',
        short_name: '가계부',
        description: '월별 수입·지출·순수입과 카테고리별 지출 비율을 한눈에 보는 로컬 우선 가계부',
        lang: 'ko',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f7f7f8',
        theme_color: '#2563eb',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: `${base}index.html`,
      },
    }),
  ],
  // 동적 import 로 뒤늦게 발견되는 의존성을 서버 시작 시 미리 번들해 dev 중 전체 새로고침을 막는다
  optimizeDeps: {
    include: ['xlsx', 'papaparse', 'recharts', 'dexie', 'dexie-react-hooks', 'date-fns', 'react-router'],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
})
