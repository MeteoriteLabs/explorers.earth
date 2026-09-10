import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveMusicDevelopmentProxyTarget } from './src/features/music/musicDevelopmentTransport'

export function resolveViteConfigDirectory(metaUrl: string, fallbackDirectory = process.cwd()): string {
  try {
    const url = new URL('.', metaUrl)
    return url.protocol === 'file:' ? fileURLToPath(url) : fallbackDirectory
  } catch {
    return fallbackDirectory
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  let musicProxyTarget: string | undefined
  try {
    musicProxyTarget = resolveMusicDevelopmentProxyTarget(env.VITE_LOCAL_TUNES_API_URL, {
      enabled: mode === 'development' && env.MUSIC_DEV_PROXY_ENABLED === 'true',
      target: env.MUSIC_DEV_PROXY_TARGET,
    })
  } catch (error) {
    if (mode === 'development' && env.MUSIC_DEV_PROXY_ENABLED === 'true') {
      throw new Error('Local Music development proxy configuration is invalid.', { cause: error })
    }
    // A production build keeps the default HTTPS Music target validation isolated
    // from unrelated Vite routes. Explicit local mode above must fail fast.
    console.warn('Music development proxy disabled: invalid Music origin.')
  }
  return ({
  resolve: {
    // Frontend contract tests exercise the shared Music fixture controller from
    // ../tunes. Resolve its GraphQL runtime against this package's declared
    // dependency instead of relying on a sibling package having been installed.
    alias: [{
      find: /^graphql$/,
      replacement: resolve(resolveViteConfigDirectory(import.meta.url), 'node_modules/graphql/index.mjs'),
    }],
  },
  plugins: [
    react(),
  ],
   server: {
     proxy: {
       ...(musicProxyTarget ? { '/__localtunes': {
         target: musicProxyTarget,
         changeOrigin: true,
         ws: true,
         rewrite: (path) => path.replace(/^\/__localtunes/, ''),
         secure: true,
       } } : {}),
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
        '/itunes-api': {
          target: 'http://127.0.0.1:5000',
          changeOrigin: true,
          secure: false,
        },
        '/api/apps/scrape-url': {
          target: 'http://127.0.0.1:5000',
          changeOrigin: true,
          secure: false,
        },
        '/api/products/scrape-link': {
          target: 'http://127.0.0.1:5000',
          changeOrigin: true,
          secure: false,
        },
        '/api/people/scrape-profile': {
          target: 'http://127.0.0.1:5000',
          changeOrigin: true,
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
  });
})

