import { spawnSync } from "node:child_process";

const result = spawnSync(
  process.execPath,
  ["node_modules/@playwright/test/cli.js", "test", "--project=real-account", "--grep", "@read-only"],
  {
    cwd: process.cwd(),
    stdio: "inherit",
    env: { ...process.env, E2E_PROFILE_PROTECTED_MODE: "read-only" },
    shell: false,
  },
);
process.exitCode = result.status ?? 1;
