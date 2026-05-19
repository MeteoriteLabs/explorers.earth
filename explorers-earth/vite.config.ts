import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
/// <reference types="vitest" />

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
   server: {
     proxy: {
       '/twitch-api': {
         target: 'https://id.twitch.tv',
         changeOrigin: true,
         rewrite: (path) => path.replace(/^\/twitch-api/, ''),
         secure: false,
       },
       '/igdb-api': {
         target: 'https://api.igdb.com',
         changeOrigin: true,
         rewrite: (path) => path.replace(/^\/igdb-api/, ''),
         secure: false,
       },
       '/api': {
        //  target: 'http://13.126.235.177:1337',
         target: 'http://77.42.95.255:1337',
        //  target: 'http://localhost:1337',
         changeOrigin: true,
         secure: false,
       },
       '/graphql': {
        //  target: 'http://13.126.235.177:1337',
         target: 'http://77.42.95.255:1337',
        //  target: 'http://localhost:1337',
         changeOrigin: true,
         secure: false,
       },
     },
   },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/__tests__/**/*.{test,spec}.{ts,tsx}', 'src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'e2e'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/test/**',
        'src/**/__tests__/**',
        'src/**/*.test.{ts,tsx}',
        'src/main.tsx',
        'src/vite-env.d.ts',
      ],
      thresholds: {
        statements: 70,
        branches: 70,
        functions: 70,
        lines: 70,
      },
    },
  },
});

