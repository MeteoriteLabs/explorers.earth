import assert from "node:assert/strict";
import test from "node:test";

import { runControlledNegativeProbes, runPublicApiPreflight } from "../verify-public-api-access.mjs";

test("stops after an unauthorized account bootstrap and emits a redacted stable result", async () => {
  let calls = 0;
  const report = await runPublicApiPreflight({
    username: "fixture-user",
    env: {
      VITE_API_URL: "https://fixture.invalid/graphql",
      VITE_PUBLIC_READ_ACCESS_TOKEN: "private-read-token",
      PUBLIC_API_CAPABILITY_SCOPE: "configured",
      PUBLIC_API_ORIGIN_POLICY: "configured",
      PUBLIC_API_RATE_LIMIT_POLICY: "configured",
    },
    fetchImpl: async () => {
      calls += 1;
      return new Response(JSON.stringify({ errors: [{ message: "Unauthorized" }] }), { status: 401 });
    },
  });

  assert.equal(calls, 1);
  assert.equal(report.code, "PUBLIC_READ_UNAUTHORIZED");
  assert.deepEqual(report.operations, [{
    operation: "account-bootstrap",
    classification: "unauthorized",
    code: "PUBLIC_READ_UNAUTHORIZED",
    observedStatus: "http-401",
    likelyCause: "The configured public-read capability was rejected.",
    remediation: "Issue a published-read-only capability and set VITE_PUBLIC_READ_ACCESS_TOKEN.",
  }]);
  assert.doesNotMatch(JSON.stringify(report), /private-read-token|Unauthorized/);
});

test("probes only enabled published collections after a successful bootstrap", async () => {
  const requests = [];
  const report = await runPublicApiPreflight({
    username: "fixture-user",
    env: {
      VITE_API_URL: "https://fixture.invalid/graphql",
      VITE_PUBLIC_READ_ACCESS_TOKEN: "private-read-token",
      PUBLIC_API_CAPABILITY_SCOPE: "configured",
      PUBLIC_API_ORIGIN_POLICY: "configured",
      PUBLIC_API_RATE_LIMIT_POLICY: "configured",
    },
    fetchImpl: async (_url, options) => {
      const request = JSON.parse(options.body);
      requests.push(request.operationName);
      if (request.operationName === "PublicAccountBootstrap") {
        return Response.json({ data: { accounts: [{ documentId: "account-1", public_profile: "Yes", public_recommendations: "Yes" }] } });
      }
      return Response.json({ data: { recommendationLists: [] } });
    },
  });

  assert.deepEqual(requests, ["PublicAccountBootstrap", "PublicPlaces"]);
  assert.equal(report.code, "CONTROLLED_FIXTURE_REQUIRED");
  assert.deepEqual(report.operations.map((operation) => [operation.operation, operation.classification]), [
    ["account-bootstrap", "ready"],
    ["places", "empty"],
    ["controlled-negative-probes", "malformed"],
  ]);
});

test("controlled probes refuse every write until the approved QA canary and cleanup contract is present", async () => {
  let calls = 0;
  const result = await runControlledNegativeProbes({
    endpoint: "https://fixture.invalid/graphql",
    env: {
      PUBLIC_API_CONTROLLED_FIXTURE: "true",
      PUBLIC_API_PRIVATE_ACCOUNT_ID: "sensitive-account-id",
      PUBLIC_API_PRIVATE_LIST_ID: "sensitive-list-id",
      PUBLIC_API_PRIVATE_ITEM_ID: "sensitive-item-id",
      PUBLIC_API_PRIVATE_LIST_SLUG: "sensitive-list-slug",
      PUBLIC_API_RUN_ID: "safe-run-id",
      VITE_PUBLIC_READ_ACCESS_TOKEN: "public-read-token",
      VITE_ANALYTICS_WRITE_ACCESS_TOKEN: "analytics-write-token",
    },
    fetchImpl: async () => { calls += 1; return Response.json({ data: {} }); },
  });

  assert.equal(calls, 0);
  assert.equal(result.code, "ANALYTICS_CANARY_REQUIRED");
  assert.doesNotMatch(JSON.stringify(result), /sensitive-(?:account|list|item)|public-read-token|analytics-write-token/);
});

test("fails closed before any request when protected security proof is missing", async () => {
  let calls = 0;
  const report = await runPublicApiPreflight({
    username: "fixture-user",
    env: { VITE_API_URL: "https://fixture.invalid/graphql", VITE_PUBLIC_READ_ACCESS_TOKEN: "public-read-token" },
    fetchImpl: async () => { calls += 1; return Response.json({ data: { accounts: [] } }); },
  });

  assert.equal(calls, 0);
  assert.equal(report.code, "SECURITY_PROOF_MISSING");
  assert.deepEqual(report.operations, [{
    operation: "security-proof",
    classification: "malformed",
    code: "SECURITY_PROOF_MISSING",
    observedStatus: "scope-origin-rate-limit-missing",
    likelyCause: "Required server-side capability evidence is missing.",
    remediation: "Configure PUBLIC_API_CAPABILITY_SCOPE, PUBLIC_API_ORIGIN_POLICY, and PUBLIC_API_RATE_LIMIT_POLICY in the protected environment.",
  }]);
});

test("rejects a bootstrap account that is not publicly published", async () => {
  const report = await runPublicApiPreflight({
    username: "private-fixture",
    env: {
      VITE_API_URL: "https://fixture.invalid/graphql", VITE_PUBLIC_READ_ACCESS_TOKEN: "public-read-token",
      PUBLIC_API_CAPABILITY_SCOPE: "configured", PUBLIC_API_ORIGIN_POLICY: "configured", PUBLIC_API_RATE_LIMIT_POLICY: "configured",
    },
    fetchImpl: async () => Response.json({ data: { accounts: [{ documentId: "private-id", public_profile: "No" }] } }),
  });

  assert.equal(report.code, "PUBLIC_READ_FORBIDDEN");
  assert.equal(report.operations[0].observedStatus, "private-account-returned");
});
