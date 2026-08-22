import { defineConfig, devices } from '@playwright/test';
import { createServer } from 'node:net';

async function allocatePort() {
  const configured = Number.parseInt(process.env.PW_PORT ?? '', 10);
  if (Number.isInteger(configured) && configured > 0 && configured <= 65_535) {
    return configured;
  }

  return new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('PLAYWRIGHT_PORT_ALLOCATION_FAILED'));
        return;
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

const port = await allocatePort();
// Playwright evaluates this module in both the coordinator and worker process.
// Persist the coordinator's allocation so every child resolves the same server.
process.env.PW_PORT ??= String(port);
const baseURL = `http://127.0.0.1:${port}`;
const requestedProject = process.argv.some((argument) => argument.includes('real-account'))
  ? 'real-account'
  : 'deterministic';
const reportClass = requestedProject === 'real-account' ? 'real-account-redacted' : 'deterministic';

export default defineConfig({
  testDir: './e2e',
  timeout: 90000, // 90 seconds test timeout
  expect: {
    timeout: 10000, // 10 seconds expect timeout
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker to avoid running out of virtual memory
  reporter: [
    ['line'],
    ['html', { outputFolder: `playwright-report/${reportClass}`, open: 'never' }],
    ['json', { outputFile: `test-results/playwright/${reportClass}/summary.json` }],
    ['junit', { outputFile: `test-results/playwright/${reportClass}/junit.xml` }],
  ],
  use: {
    baseURL,
    actionTimeout: 15000,
    navigationTimeout: 60000, // 60 seconds navigation timeout
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'deterministic',
      testIgnore: /real-account[\\/]/,
      use: { ...devices['Desktop Chrome'], headless: true },
    },
    {
      name: 'real-account',
      testMatch: /real-account[\\/].*\.spec\.ts/,
      fullyParallel: false,
      workers: 1,
      use: {
        ...devices['Desktop Chrome'],
        headless: true,
        trace: 'off',
        screenshot: 'off',
        video: 'off',
      },
    },
  ],
  webServer: {
    command: `node scripts/start-playwright-server.mjs --port=${port} --project=${requestedProject}`,
    url: baseURL,
    reuseExistingServer: process.env.PW_REUSE_SERVER === '1',
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
