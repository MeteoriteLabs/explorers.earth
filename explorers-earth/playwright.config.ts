import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
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
    baseURL: 'http://localhost:5173',
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
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
