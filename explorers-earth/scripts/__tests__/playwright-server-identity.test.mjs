import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

test("Playwright server dry-run reports a redacted workspace identity", () => {
  const secret = "must-never-be-printed";
  const result = spawnSync(
    process.execPath,
    [
      "scripts/start-playwright-server.mjs",
      "--port=43210",
      "--project=deterministic",
      "--dry-run",
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        VITE_API_URL: "https://api.fixture.invalid/graphql",
        VITE_PUBLIC_READ_ACCESS_TOKEN: secret,
      },
    },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /baseURL=http:\/\/127\.0\.0\.1:43210/);
  assert.match(result.stdout, /pid=\d+/);
  assert.match(result.stdout, /command=npm run dev/);
  assert.match(result.stdout, /branch=codex\/profile-dashboard-public-profile/);
  assert.match(result.stdout, /commit=[0-9a-f]{7,40}/);
  assert.match(result.stdout, /apiHost=api\.fixture\.invalid/);
  assert.match(result.stdout, /project=deterministic/);
  assert.match(result.stdout, /environment=fixture-with-public-read-capability/);
  assert.doesNotMatch(result.stdout + result.stderr, new RegExp(secret));
});
