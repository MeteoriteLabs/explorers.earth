import { defineConfig, configDefaults } from 'vitest/config';
import path from 'node:path';

// Integration config = ONLY *.integration.test.ts. These import the app and
// connect to Postgres, so run them with a reachable test DB:
//   DATABASE_URL_TEST=postgresql://tunes:tunes@127.0.0.1:5433/tunes_e2e npm run test:integration
export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./server/test/setup.ts'],
    include: ['**/*.integration.test.ts'],
    exclude: [...configDefaults.exclude],
  },
});
