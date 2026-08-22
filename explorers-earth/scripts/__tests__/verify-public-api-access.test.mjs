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
    },
    fetchImpl: async (_url, options) => {
      const request = JSON.parse(options.body);
      requests.push(request.operationName);
      if (request.operationName === "PublicAccountBootstrap") {
        return Response.json({ data: { accounts: [{ documentId: "account-1", public_recommendations: "Yes" }] } });
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

test("controlled negative probes reject private reads, mutations, invalid analytics, and rate-limit traffic", async () => {
  const result = await runControlledNegativeProbes({
    endpoint: "https://fixture.invalid/graphql",
    env: {
      PUBLIC_API_CONTROLLED_FIXTURE: "true",
      PUBLIC_API_PRIVATE_ACCOUNT_ID: "sensitive-account-id",
      PUBLIC_API_PRIVATE_LIST_ID: "sensitive-list-id",
      PUBLIC_API_PRIVATE_ITEM_ID: "sensitive-item-id",
      PUBLIC_API_PRIVATE_LIST_SLUG: "sensitive-list-slug",
      VITE_PUBLIC_READ_ACCESS_TOKEN: "public-read-token",
      VITE_ANALYTICS_WRITE_ACCESS_TOKEN: "analytics-write-token",
    },
    fetchImpl: async (_url, options) => {
      const { operationName } = JSON.parse(options.body);
      return operationName === "CapabilityRateLimitProbe"
        ? new Response("", { status: 429 })
        : Response.json({ errors: [{ message: "Forbidden access" }] });
    },
  });

  assert.equal(result.code, "PUBLIC_API_READY");
  assert.equal(result.operations.length, 12);
  assert.equal(result.operations.every((operation) => operation.passed), true);
  assert.deepEqual(result.operations.at(-1), {
    operation: "rate-limit",
    classification: "transport-error",
    code: "PUBLIC_API_READY",
    observedStatus: "http-429",
    likelyCause: "The public API could not be reached before the timeout.",
    remediation: "Check VITE_API_URL, the allowed origin, and the server-side rate-limit policy.",
    expected: "transport-error",
    passed: true,
  });
  assert.doesNotMatch(JSON.stringify(result), /sensitive-(?:account|list|item)|public-read-token|analytics-write-token/);
});
