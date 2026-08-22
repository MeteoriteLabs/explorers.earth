import assert from "node:assert/strict";
import test from "node:test";

import { classifyPublicProfileEnvironment, PUBLIC_PROFILE_ENVIRONMENT_TIERS, verifyPublicProfileEnvironment } from "../verify-public-profile-env.mjs";

const expectedEnvironmentTiers = {
  fixture: [],
  "read-only": [
    "VITE_API_URL",
    "VITE_PUBLIC_READ_ACCESS_TOKEN",
    "VITE_PUBLIC_ACCESS_TOKEN",
    "PUBLIC_API_CAPABILITY_SCOPE",
    "PUBLIC_API_EXPECTED_ORIGIN",
    "PUBLIC_API_ORIGIN_POLICY",
    "PUBLIC_API_RATE_LIMIT_POLICY",
  ],
  mutation: [
    "VITE_ANALYTICS_WRITE_ACCESS_TOKEN",
    "PUBLIC_API_CONTROLLED_FIXTURE",
    "PUBLIC_API_PRIVATE_ACCOUNT_ID",
    "PUBLIC_API_PRIVATE_LIST_ID",
    "PUBLIC_API_PRIVATE_ITEM_ID",
    "PUBLIC_API_PRIVATE_LIST_SLUG",
    "PUBLIC_API_RUN_ID",
    "PUBLIC_PROFILE_MUTATION_APPROVED",
    "PUBLIC_PROFILE_TEST_ACCOUNT_MARKER",
    "PUBLIC_API_ANALYTICS_QA_SINK",
    "PUBLIC_API_ANALYTICS_CANARY_MUTATION",
    "PUBLIC_API_ANALYTICS_CLEANUP_MUTATION",
    "PUBLIC_API_ANALYTICS_CLEANUP_VERIFY_QUERY",
  ],
};

test("every verification environment variable belongs to exactly one safety tier", () => {
  assert.deepEqual(PUBLIC_PROFILE_ENVIRONMENT_TIERS, expectedEnvironmentTiers);
  const variables = Object.values(PUBLIC_PROFILE_ENVIRONMENT_TIERS).flat();
  assert.equal(new Set(variables).size, variables.length);
});

test("environment classifier reports tier and presence without values", () => {
  const env = Object.fromEntries(Object.values(expectedEnvironmentTiers).flat().map((name) => [name, `private-${name}`]));
  env.PUBLIC_PROFILE_TEST_ACCOUNT_MARKER = "wrong-marker";
  env.PUBLIC_PROFILE_MUTATION_APPROVED = "true";
  const classified = classifyPublicProfileEnvironment(env);

  assert.deepEqual(classified.VITE_API_URL, { tier: "read-only", presence: "present", classification: "configured" });
  assert.deepEqual(classified.VITE_PUBLIC_READ_ACCESS_TOKEN, { tier: "read-only", presence: "present", classification: "dedicated" });
  assert.deepEqual(classified.PUBLIC_PROFILE_MUTATION_APPROVED, { tier: "mutation", presence: "present", classification: "approved" });
  assert.deepEqual(classified.PUBLIC_PROFILE_TEST_ACCOUNT_MARKER, { tier: "mutation", presence: "present", classification: "mismatch" });
  assert.doesNotMatch(JSON.stringify(classified), /private-/);
});

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
  const completeProtectedEnvironment = Object.fromEntries(
    Object.values(expectedEnvironmentTiers).flat().map((name) => [name, "configured"]),
  );
  const result = verifyPublicProfileEnvironment({
    mode: "mutation",
    env: {
      ...completeProtectedEnvironment,
      VITE_API_URL: "https://fixture.invalid/graphql",
      VITE_PUBLIC_READ_ACCESS_TOKEN: "public-read-value",
      VITE_ANALYTICS_WRITE_ACCESS_TOKEN: "analytics-write-value",
      PUBLIC_PROFILE_TEST_ACCOUNT_MARKER: "public-profile-mutation-fixture",
      PUBLIC_PROFILE_MUTATION_APPROVED: "",
    },
  });

  assert.equal(result.code, "LIVE_WRITE_NOT_APPROVED");
  assert.equal(result.safeContext.publicReadSource, "dedicated");
  assert.doesNotMatch(JSON.stringify(result), /(?:public-read|analytics-write)-value/);
});
