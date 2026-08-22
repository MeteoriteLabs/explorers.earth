import { expect, test } from "@playwright/test";
import { spawnSync } from "node:child_process";

test("protected prerequisites fail closed before any account mutation", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/verify-public-profile-env.mjs", "--mode=mutation", "--json"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: process.env,
    },
  );

  if (result.status !== 0) {
    throw new Error(result.stdout.trim() || result.stderr.trim() || "ENV_MISSING");
  }

  const username = process.env.E2E_PROFILE_USERNAME;
  const storageState = process.env.E2E_PROFILE_STORAGE_STATE;
  expect(username, "ENV_MISSING: E2E_PROFILE_USERNAME is required").toBeTruthy();
  expect(storageState, "ENV_MISSING: E2E_PROFILE_STORAGE_STATE is required").toBeTruthy();
});
