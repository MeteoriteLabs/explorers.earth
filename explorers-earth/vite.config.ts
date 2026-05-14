import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
});

