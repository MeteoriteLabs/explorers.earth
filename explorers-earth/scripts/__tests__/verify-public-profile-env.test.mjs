import assert from "node:assert/strict";
import test from "node:test";

import { verifyPublicProfileEnvironment } from "../verify-public-profile-env.mjs";

test("fixture verification passes without live credentials", () => {
  const result = verifyPublicProfileEnvironment({ mode: "fixture", env: {} });

  assert.deepEqual(result, {
    code: "READY",
    summary: "Deterministic fixture verification is ready.",
    safeContext: { mode: "fixture", publicReadSource: "not-required", analyticsWriteSource: "not-required" },
    remediation: "Run npm run verify:public-profile:env -- --mode=fixture before deterministic tests.",
  });
});

test("read-only verification identifies missing public API inputs without values", () => {
  const result = verifyPublicProfileEnvironment({
    mode: "read-only",
    env: { VITE_PUBLIC_READ_ACCESS_TOKEN: "private-value" },
  });

  assert.equal(result.code, "ENV_MISSING");
  assert.deepEqual(result.safeContext, {
    mode: "read-only",
    publicReadSource: "dedicated",
    analyticsWriteSource: "missing",
    apiUrl: "missing",
  });
  assert.doesNotMatch(JSON.stringify(result), /private-value/);
});

test("mutation verification requires opt-in before the dedicated account marker", () => {
  const result = verifyPublicProfileEnvironment({
    mode: "mutation",
    env: {
      VITE_API_URL: "https://fixture.invalid/graphql",
      VITE_PUBLIC_READ_ACCESS_TOKEN: "public-read-value",
      VITE_ANALYTICS_WRITE_ACCESS_TOKEN: "analytics-write-value",
      PUBLIC_PROFILE_TEST_ACCOUNT_MARKER: "public-profile-mutation-fixture",
    },
  });

  assert.equal(result.code, "LIVE_WRITE_NOT_APPROVED");
  assert.equal(result.safeContext.publicReadSource, "dedicated");
  assert.doesNotMatch(JSON.stringify(result), /(?:public-read|analytics-write)-value/);
});
