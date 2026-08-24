import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT ?? 5173);
const externalBaseUrl = process.env.PLAYWRIGHT_EXTERNAL_BASE_URL;
const prSafe = process.env.PLAYWRIGHT_PR_SAFE === 'true';

export default defineConfig({
  testDir: './e2e',
  testIgnore: prSafe ? [
    '**/music-auth-triggers.spec.ts',
    '**/music-fixture-fullstack.spec.ts',
    '**/music-fullstack.spec.ts',
  ] : [],
  timeout: 90000, // 90 seconds test timeout
  expect: {
    timeout: 10000, // 10 seconds expect timeout
  },
  fullyParallel: false, // Run tests sequentially to save memory
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker to avoid running out of virtual memory
  reporter: 'line',
  use: {
    baseURL: externalBaseUrl ?? `http://localhost:${port}`,
    actionTimeout: 15000,
    navigationTimeout: 60000, // 60 seconds navigation timeout
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], headless: true },
    },
  ],
  webServer: externalBaseUrl ? undefined : {
    command: `npm run dev -- --port ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
