import { defineConfig, devices } from "@playwright/test";

// This suite never starts a server itself or inherits the live fixture config.
// Start only the companion no-proxy Vite config on this exact loopback port.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "profile-tab-hit-testing.spec.ts",
  outputDir: ".artifacts/profile-tab-hit-testing/results",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 10_000 },
  reporter: [["line"], ["json"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:55175",
    headless: true,
    actionTimeout: 5_000,
    navigationTimeout: 120_000,
    serviceWorkers: "block",
    storageState: { cookies: [], origins: [] },
    trace: "off",
    screenshot: "off",
    video: "off",
    launchOptions: {
      args: ["--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1", "--disable-quic"],
    },
  },
});
