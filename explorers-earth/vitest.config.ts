import { defineConfig, configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Standalone test config (does not import vite.config.ts, which carries
// build/static-generation plugins not needed for tests). React + jsdom are
// enough for unit + component tests.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Pre-existing example/doc file (no describe/it, unresolved service imports);
    // it never transformed and is not a real test. Excluded so it doesn't break
    // the gate. Not introduced by this work.
    exclude: [...configDefaults.exclude, '**/localTunesIntegration.test.ts'],
  },
});
