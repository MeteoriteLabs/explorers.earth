import assert from "node:assert/strict";
import test from "node:test";

import {
  createVerificationPlan,
  extractStableChildEvidence,
  parseVerificationArgs,
  runVerificationPlan,
} from "../verify-public-profile.mjs";
import {
  PROTECTED_REPORT_CODES,
  PROTECTED_SETUP_CODES,
  STABLE_CHILD_CODES,
  VERIFICATION_EXIT_CODES,
} from "../lib/stableVerificationCodes.mjs";

test("parses portable deterministic command options", () => {
  assert.deepEqual(
    parseVerificationArgs(["--username=alice", "--headed", "--dry-run", "--json"]),
    { mode: "deterministic", username: "alice", headed: true, dryRun: true, json: true },
  );
});

test("builds the deterministic golden path without protected commands", () => {
  const plan = createVerificationPlan({ mode: "deterministic", username: "alice", headed: true });
  assert.deepEqual(plan.map(({ id }) => id), [
    "fixture-env", "contract", "lint", "typecheck-app", "typecheck-test",
    "typecheck-e2e", "i18n", "unit", "coverage", "e2e", "build",
  ]);
  assert.deepEqual(plan.find(({ id }) => id === "e2e").args, ["run", "test:e2e", "--", "--headed"]);
  assert.equal(plan.some(({ id }) => /real-account|public-api|mutation/.test(id)), false);
});

test("builds the protected release path with preflights before browser execution", () => {
  const plan = createVerificationPlan({ mode: "release", username: "alice", headed: false });
  assert.deepEqual(plan.map(({ id }) => id), [
    "read-only-env", "public-api", "mutation-env", "real-account",
  ]);
  assert.deepEqual(plan[1].args, ["run", "verify:public-api", "--", "--username=alice", "--json"]);
});

test("dry-run never spawns a child and returns a machine-readable plan", async () => {
  let calls = 0;
  const result = await runVerificationPlan({
    options: { mode: "release", username: "alice", headed: false, dryRun: true, json: true },
    spawn: async () => { calls += 1; return { status: 0 }; },
  });
  assert.equal(calls, 0);
  assert.equal(result.code, "DRY_RUN");
  assert.equal(result.safeContext.commands.length, 4);
});

test("stops on the first stable blocker and names the failed command and artifact", async () => {
  const calls = [];
  const result = await runVerificationPlan({
    options: { mode: "release", username: "alice", headed: false, dryRun: false, json: true },
    spawn: async (step) => {
      calls.push(step.id);
      return { status: 20, code: "ENV_MISSING" };
    },
  });
  assert.deepEqual(calls, ["read-only-env"]);
  assert.equal(result.code, "ENV_MISSING");
  assert.equal(result.safeContext.failedCommand, "read-only-env");
  assert.match(result.artifactPath, /verification-summary\.json$/);
});

test("rejects unknown options without executing anything", () => {
  assert.throws(() => parseVerificationArgs(["--oops"]), /UNKNOWN_OPTION/);
});

test("passes JSON mode to every child runner so output can remain one safe envelope", async () => {
  const observed = [];
  const result = await runVerificationPlan({
    options: { mode: "release", username: "alice", headed: false, dryRun: false, json: true },
    spawn: async (step, options) => {
      observed.push([step.id, options.json]);
      return { status: 0 };
    },
  });
  assert.equal(result.code, "READY");
  assert.deepEqual(observed, [
    ["read-only-env", true], ["public-api", true], ["mutation-env", true], ["real-account", true],
  ]);
});

test("extracts only allowlisted structured blocker evidence and drops arbitrary output", () => {
  const evidence = extractStableChildEvidence({
    stdout: `private profile secret-value\n${JSON.stringify({ code: "ROUTE_FIXTURE_COVERAGE_MISMATCH", artifactPath: "test-results/playwright/real-account-redacted/summary.json", privatePayload: "secret-value" })}\n`,
    stderr: "authorization=Bearer secret-value",
  });
  assert.deepEqual(evidence, {
    code: "ROUTE_FIXTURE_COVERAGE_MISMATCH",
    artifactPath: "test-results/playwright/real-account-redacted/summary.json",
  });
  assert.doesNotMatch(JSON.stringify(evidence), /secret-value|authorization|privatePayload/i);
});

test("preserves protected setup blockers from exit-one output without retaining secrets", async () => {
  const result = await runVerificationPlan({
    options: { mode: "release", username: "alice", headed: false, dryRun: false, json: true },
    spawn: async (step) => step.id === "real-account"
      ? {
          status: 1,
          stderr: "token=private-token",
          protectedSummary: JSON.stringify({
            code: "PROTECTED_RUN_COMPLETE",
            tests: [{ code: "RESTORE_FAILED", privatePayload: "private-token" }],
          }, null, 2),
          artifactPath: "test-results/playwright/real-account-redacted/summary.json",
        }
      : { status: 0, stdout: '{"code":"READY"}' },
  });
  assert.equal(result.code, "RESTORE_FAILED");
  assert.equal(result.safeContext.failedCommand, "real-account");
  assert.match(result.safeContext.nextCommand, /recovery/i);
  assert.equal(result.artifactPath, "test-results/playwright/real-account-redacted/summary.json");
  assert.match(result.remediation, /recovery/i);
  assert.doesNotMatch(JSON.stringify(result), /private-token/);
});

test("single source enumerates every verification, protected-report, and setup code", () => {
  assert.deepEqual([...STABLE_CHILD_CODES], [
    ...Object.keys(VERIFICATION_EXIT_CODES),
    ...PROTECTED_REPORT_CODES,
    ...PROTECTED_SETUP_CODES,
  ]);
  for (const code of [
    "PUBLIC_API_TRANSPORT_ERROR", "PUBLIC_API_MALFORMED",
    "SECURITY_PROOF_MISSING", "PROTECTED_TEST_FAILED",
  ]) assert.equal(STABLE_CHILD_CODES.has(code), true);
});

test("every source-defined failure code survives exit-one JSON or summary safely", async () => {
  const nonFailures = new Set([
    "PROTECTED_RUN_COMPLETE", "PROTECTED_TEST_PASSED", "PROTECTED_TEST_SKIPPED",
  ]);
  const failureCodes = [...STABLE_CHILD_CODES].filter((code) => !nonFailures.has(code));
  for (const [index, code] of failureCodes.entries()) {
    const artifactPath = "test-results/playwright/real-account-redacted/summary.json";
    const structured = { code, artifactPath, privatePayload: `private-${code}` };
    const result = await runVerificationPlan({
      options: { mode: "release", username: "alice", headed: false, dryRun: false, json: true },
      spawn: async (step) => step.id === "real-account"
        ? index % 2 === 0
          ? { status: 1, stdout: `${JSON.stringify(structured)}\nraw-private-value` }
          : { status: 1, protectedSummary: JSON.stringify({ code: "PROTECTED_RUN_COMPLETE", tests: [structured] }), artifactPath }
        : { status: 0, stdout: '{"code":"READY"}' },
    });
    assert.equal(result.code, code);
    assert.equal(result.artifactPath, artifactPath);
    assert.equal(result.safeContext.failedCommand, "real-account");
    assert.match(result.safeContext.nextCommand, /recovery/i);
    assert.doesNotMatch(JSON.stringify(result), /private-|raw-private-value|privatePayload/i);
  }
});
