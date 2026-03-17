import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  //  server: {
  //    proxy: {
  //      '/api': {
  //       //  target: 'http://13.126.235.177:1337',
  //        target: 'http://77.42.95.255:1337',
  //        changeOrigin: true,
  //        secure: false,
  //      },
  //      '/graphql': {
  //       //  target: 'http://13.126.235.177:1337',
  //        target: 'http://77.42.95.255:1337',
  //        changeOrigin: true,
  //        secure: false,
  //      },
  //    },
  //  },
});

