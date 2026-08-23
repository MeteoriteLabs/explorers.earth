import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { requestOperation, runAnalyticsCanaryLifecycle, runAnalyticsRunCleanupPreflight, runControlledNegativeProbes, runPublicApiPreflight, runPublicReadOnlyPreflight } from "../verify-public-api-access.mjs";

const scriptPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../verify-public-api-access.mjs");
const testOperation = {
  id: "published-collection",
  operationName: "PublishedCollection",
  query: "query PublishedCollection { items { documentId } }",
  path: ["items"],
};

function validPolicyEnv(overrides = {}) {
  return {
    VITE_API_URL: "https://api.qa.explorers.earth/graphql",
    VITE_PUBLIC_READ_ACCESS_TOKEN: "fixture-public-read-capability",
    PUBLIC_API_CAPABILITY_SCOPE: "published-read-only",
    PUBLIC_API_EXPECTED_ORIGIN: "https://qa.explorers.earth",
    PUBLIC_API_ORIGIN_POLICY: '{"allowOrigins":["https://qa.explorers.earth"]}',
    PUBLIC_API_RATE_LIMIT_POLICY: '{"environment":"non-production","limit":3,"windowSeconds":60}',
    ...overrides,
  };
}

function protectedEnv(overrides = {}) {
  return validPolicyEnv({
    VITE_ANALYTICS_WRITE_ACCESS_TOKEN: "fixture-analytics-write-capability",
    PUBLIC_API_CONTROLLED_FIXTURE: "true",
    PUBLIC_API_PRIVATE_ACCOUNT_ID: "fixture-private-account",
    PUBLIC_API_PRIVATE_LIST_ID: "fixture-private-list",
    PUBLIC_API_PRIVATE_ITEM_ID: "fixture-private-item",
    PUBLIC_API_PRIVATE_LIST_SLUG: "fixture-private-slug",
    PUBLIC_API_RUN_ID: "qa-fixture-run-id",
    PUBLIC_PROFILE_MUTATION_APPROVED: "true",
    PUBLIC_PROFILE_TEST_ACCOUNT_MARKER: "public-profile-mutation-fixture",
    PUBLIC_API_ANALYTICS_QA_SINK: "qa-public-profile-analytics",
    PUBLIC_API_ANALYTICS_CANARY_MUTATION: "mutation { canary: createAnalyticsCanary { documentId } }",
    PUBLIC_API_ANALYTICS_CLEANUP_MUTATION: "mutation { cleanup: deleteAnalyticsCanary { documentId } }",
    PUBLIC_API_ANALYTICS_CLEANUP_VERIFY_QUERY: "query { remaining: analyticsCanaries { documentId } }",
    PUBLIC_API_ANALYTICS_RUN_CLEANUP_MUTATION: "mutation { cleanup: deleteQaRun { documentId } }",
    PUBLIC_API_ANALYTICS_RUN_CLEANUP_VERIFY_QUERY: "query { remaining: qaRunEvents { documentId } }",
    ...overrides,
  });
}

function analyticsDocuments() {
  return {
    canary: "mutation { canary: createAnalyticsCanary { documentId } }",
    cleanup: "mutation { cleanup: deleteAnalyticsCanary { documentId } }",
    remaining: "query { remaining: analyticsCanaries { documentId } }",
  };
}

function abortError() {
  return Object.assign(new Error("request aborted"), { name: "AbortError" });
}

function waitForAbort(signal) {
  return new Promise((_, reject) => signal.addEventListener("abort", () => reject(abortError()), { once: true }));
}

function protectedResponse(operationName, options, { rateResponse = "429", successfulInvalidShape } = {}) {
  if (operationName === "ApprovedAnalyticsCanary") return Response.json({ data: { canary: { documentId: "fixture-canary" } } });
  if (operationName === "CleanupAnalyticsCanary") return Response.json({ data: { cleanup: { documentId: "fixture-canary" } } });
  if (operationName === "VerifyAnalyticsCanaryCleanup") return Response.json({ data: { remaining: [] } });
  if (operationName === "PreflightQaBrowserRun") return Response.json({ data: { canary: { documentId: "fixture-run-canary" } } });
  if (operationName === "PreflightCleanupQaBrowserRun") return Response.json({ data: { cleanup: { documentId: "fixture-run-canary" } } });
  if (operationName === "PreflightVerifyQaBrowserRun") return Response.json({ data: { remaining: [] } });
  if (operationName === "CapabilityRateLimitProbe") {
    if (rateResponse === "timeout") return waitForAbort(options.signal);
    if (rateResponse === "200") return Response.json({ data: { accounts: [] } });
    return new Response("", { status: Number(rateResponse) });
  }
  if (/^AnalyticsValidationCanary/.test(operationName)) {
    if (successfulInvalidShape === operationName) return Response.json({ data: { analyticsValidationCanary: { accepted: true } } });
    return Response.json({ errors: [{ message: "Validation rejected unsupported event shape" }] });
  }
  return Response.json({ errors: [{ message: "Forbidden access" }] });
}

test("full response-body timeout is retried and recovers with a published collection", async () => {
  let attempts = 0;
  const result = await requestOperation({
    endpoint: "https://api.qa.explorers.earth/graphql",
    token: "fixture-capability",
    operation: testOperation,
    variables: {},
    timeoutMs: 5,
    retries: 1,
    fetchImpl: async (_url, options) => {
      attempts += 1;
      if (attempts === 1) {
        return { status: 200, ok: true, json: () => waitForAbort(options.signal) };
      }
      return Response.json({ data: { items: [{ documentId: "published-item" }] } });
    },
  });

  assert.equal(attempts, 2);
  assert.equal(result.diagnostic.classification, "ready");
  assert.deepEqual(result.value, [{ documentId: "published-item" }]);
});

test("malformed JSON is classified without exposing its response body", async () => {
  const result = await requestOperation({
    endpoint: "https://api.qa.explorers.earth/graphql", token: "fixture-capability", operation: testOperation, variables: {}, timeoutMs: 50, retries: 0,
    fetchImpl: async () => new Response("{private-response", { status: 200, headers: { "content-type": "application/json" } }),
  });

  assert.equal(result.diagnostic.classification, "malformed");
  assert.equal(result.diagnostic.observedStatus, "invalid-json");
  assert.doesNotMatch(JSON.stringify(result.diagnostic), /private-response/);
});

test("a successful response with missing data is classified as malformed", async () => {
  const result = await requestOperation({
    endpoint: "https://api.qa.explorers.earth/graphql", token: "fixture-capability", operation: testOperation, variables: {}, timeoutMs: 50, retries: 0,
    fetchImpl: async () => Response.json({ data: {} }),
  });

  assert.equal(result.diagnostic.classification, "malformed");
  assert.equal(result.diagnostic.observedStatus, "missing-data");
});

test("a non-empty published collection is classified as ready", async () => {
  const result = await requestOperation({
    endpoint: "https://api.qa.explorers.earth/graphql", token: "fixture-capability", operation: testOperation, variables: {}, timeoutMs: 50, retries: 0,
    fetchImpl: async () => Response.json({ data: { items: [{ documentId: "published-item" }] } }),
  });

  assert.equal(result.diagnostic.classification, "ready");
  assert.equal(result.diagnostic.code, "PUBLIC_API_READY");
});

test("the spawned CLI loads a temp-cwd .env and emits stable redacted JSON and exit code", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "public-api-cli-"));
  const privateValues = ["cli-read-capability", "Bearer cli-header-value", "cli-private-account"];
  try {
    await writeFile(path.join(cwd, ".env"), [
      "VITE_API_URL=https://api.qa.explorers.earth/graphql",
      `VITE_PUBLIC_READ_ACCESS_TOKEN=${privateValues[0]}`,
      `AUTHORIZATION=${privateValues[1]}`,
      `PUBLIC_API_PRIVATE_ACCOUNT_ID=${privateValues[2]}`,
      "PUBLIC_API_CAPABILITY_SCOPE=invalid-scope",
    ].join("\n"));
    const safeEnv = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^(?:VITE_|PUBLIC_API_|PUBLIC_PROFILE_|AUTHORIZATION$)/.test(name)));
    const run = () => spawnSync(process.execPath, [scriptPath, "--username=fixture-user", "--json"], { cwd, env: safeEnv, encoding: "utf8" });
    const first = run();
    const second = run();

    assert.equal(first.status, 35);
    assert.equal(first.signal, null);
    assert.equal(first.stdout, second.stdout);
    assert.equal(first.stderr, second.stderr);
    const output = JSON.parse(first.stdout);
    assert.equal(output.code, "SECURITY_PROOF_MISSING");
    assert.equal(output.safeContext.configuration.publicReadSource, "dedicated");
    for (const privateValue of privateValues) assert.doesNotMatch(`${first.stdout}\n${first.stderr}`, new RegExp(privateValue));
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("analytics canary success writes, cleans up, and verifies an empty QA sink", async () => {
  const operations = [];
  const result = await runAnalyticsCanaryLifecycle({
    endpoint: "https://fixture.invalid/graphql", token: "analytics-write-token", runId: "run-1", qaSink: "qa-sink",
    documents: analyticsDocuments(),
    fetchImpl: async (_url, options) => {
      const operationName = JSON.parse(options.body).operationName;
      operations.push(operationName);
      assert.equal(options.headers.authorization, "Bearer analytics-write-token");
      return Response.json(operationName === "ApprovedAnalyticsCanary" ? { data: { canary: { documentId: "created-id" } } } : operationName === "CleanupAnalyticsCanary" ? { data: { cleanup: { documentId: "created-id" } } } : { data: { remaining: [] } });
    },
  });
  assert.equal(result.code, "PUBLIC_API_READY");
  assert.deepEqual(operations, ["ApprovedAnalyticsCanary", "CleanupAnalyticsCanary", "VerifyAnalyticsCanaryCleanup"]);
});

test("run-wide analytics cleanup is functionally proven with a harmless isolated run before callbacks", async () => {
  const operations = [];
  const result = await runAnalyticsRunCleanupPreflight({
    endpoint: "https://fixture.invalid/graphql", token: "analytics-write-token", baseRunId: "qa-browser-run", qaSink: "qa-sink",
    documents: { canary: analyticsDocuments().canary, cleanupRun: "mutation { cleanup: deleteQaRun }", remainingRun: "query { remaining: qaRunEvents }" },
    fetchImpl: async (_url, options) => {
      const { operationName, variables } = JSON.parse(options.body); operations.push(operationName);
      assert.match(variables.runId, /^qa-preflight-/);
      return protectedResponse(operationName, options);
    },
  });
  assert.equal(result.code, "PUBLIC_API_READY");
  assert.deepEqual(operations, ["PreflightQaBrowserRun", "PreflightCleanupQaBrowserRun", "PreflightVerifyQaBrowserRun"]);
});

for (const failure of ["cleanup-fails", "query-fails", "transport-throws"]) {
  test(`run-wide ${failure} attempts emergency cleanup and retains truthful redacted recovery evidence`, async () => {
    const operations = []; const artifacts = [];
    const result = await runAnalyticsRunCleanupPreflight({
      endpoint: "https://fixture.invalid/graphql", token: "analytics-write-token", baseRunId: "qa-browser-run", qaSink: "qa-sink",
      documents: { canary: analyticsDocuments().canary, cleanupRun: "mutation { cleanup: deleteQaRun }", remainingRun: "query { remaining: qaRunEvents }" },
      writeRecoveryArtifact: async (value) => { artifacts.push(value); return "/redacted/recovery.json"; },
      fetchImpl: async (_url, options) => {
        const { operationName } = JSON.parse(options.body); operations.push(operationName);
        if (operationName === "PreflightQaBrowserRun") return Response.json({ data: { canary: { documentId: "created" } } });
        if (failure === "transport-throws") throw new Error("private transport detail");
        if (operationName === "PreflightCleanupQaBrowserRun") return Response.json({ data: { cleanup: failure !== "cleanup-fails" ? { documentId: "created" } : null } });
        if (operationName === "PreflightVerifyQaBrowserRun") return Response.json({ data: { remaining: failure === "query-fails" ? [{ documentId: "residual" }] : [] } });
        if (operationName === "EmergencyCleanupQaBrowserRun") return Response.json({ data: { cleanup: { documentId: "created" } } });
        return Response.json({ data: { remaining: [] } });
      },
    });
    assert.equal(result.code, "ANALYTICS_RUN_CLEANUP_UNAVAILABLE");
    assert.equal(result.artifactPath, "/redacted/recovery.json");
    assert.ok(operations.includes("EmergencyCleanupQaBrowserRun"));
    assert.ok(operations.includes("EmergencyVerifyQaBrowserRun"));
    assert.deepEqual(artifacts, [{ residualUnverified: failure === "transport-throws" }]);
    assert.doesNotMatch(JSON.stringify(result), /private transport detail|analytics-write-token|qa-browser-run|qa-sink/);
  });
}

test("unresolved run cleanup writes only restrictive redacted recovery evidence", async () => {
  const result = await runAnalyticsRunCleanupPreflight({
    endpoint: "https://fixture.invalid/graphql", token: "private-analytics-token", baseRunId: "qa-private-run", qaSink: "qa-private-sink",
    documents: { canary: analyticsDocuments().canary, cleanupRun: "mutation { cleanup: deleteQaRun }", remainingRun: "query { remaining: qaRunEvents }" },
    fetchImpl: async (_url, options) => {
      const { operationName } = JSON.parse(options.body);
      if (operationName === "PreflightQaBrowserRun") return Response.json({ data: { canary: { documentId: "created" } } });
      throw new Error("private cleanup failure");
    },
  });
  try {
    assert.equal(result.code, "ANALYTICS_RUN_CLEANUP_UNAVAILABLE");
    const saved = await readFile(result.artifactPath, "utf8");
    assert.doesNotMatch(saved, /private-analytics-token|qa-private-run|qa-private-sink|private cleanup failure/);
    assert.deepEqual(JSON.parse(saved), { version: 1, code: "ANALYTICS_RUN_CLEANUP_UNAVAILABLE", residualUnverified: true, runId: "[REDACTED]", qaSink: "[REDACTED]" });
    if (process.platform !== "win32") assert.equal((await stat(result.artifactPath)).mode & 0o077, 0);
  } finally { if (result.artifactPath) await rm(path.dirname(result.artifactPath), { recursive: true, force: true }); }
});

test("analytics canary cleanup runs in finally before cleanup verification", async () => {
  const operations = [];
  const result = await runAnalyticsCanaryLifecycle({
    endpoint: "https://api.qa.explorers.earth/graphql", token: "analytics-write-token", runId: "run-1", qaSink: "qa-sink", documents: analyticsDocuments(),
    fetchImpl: async (_url, options) => {
      const { operationName } = JSON.parse(options.body);
      operations.push(operationName);
      if (operationName === "ApprovedAnalyticsCanary") return Response.json({ data: { canary: { documentId: "created-id" } } });
      if (operationName === "CleanupAnalyticsCanary") return Response.json({ data: { cleanup: { documentId: "created-id" } } });
      throw new Error("verification transport failed");
    },
  });

  assert.deepEqual(operations, ["ApprovedAnalyticsCanary", "CleanupAnalyticsCanary", "VerifyAnalyticsCanaryCleanup"]);
  assert.equal(result.code, "ANALYTICS_CLEANUP_FAILED");
  assert.equal(result.operations[0].observedStatus, "cleanup-verification-failed");
});

test("analytics canary cleanup failure blocks all later verification", async () => {
  const operations = [];
  const result = await runAnalyticsCanaryLifecycle({
    endpoint: "https://api.qa.explorers.earth/graphql", token: "analytics-write-token", runId: "run-1", qaSink: "qa-sink", documents: analyticsDocuments(),
    fetchImpl: async (_url, options) => {
      const { operationName } = JSON.parse(options.body);
      operations.push(operationName);
      return operationName === "ApprovedAnalyticsCanary"
        ? Response.json({ data: { canary: { documentId: "created-id" } } })
        : Response.json({ errors: [{ message: "cleanup denied" }] });
    },
  });

  assert.deepEqual(operations, ["ApprovedAnalyticsCanary", "CleanupAnalyticsCanary"]);
  assert.equal(result.code, "ANALYTICS_CLEANUP_FAILED");
  assert.equal(result.operations[0].observedStatus, "cleanup-failed");
});

test("analytics canary non-empty remaining verification fails closed", async () => {
  const result = await runAnalyticsCanaryLifecycle({
    endpoint: "https://api.qa.explorers.earth/graphql", token: "analytics-write-token", runId: "run-1", qaSink: "qa-sink", documents: analyticsDocuments(),
    fetchImpl: async (_url, options) => {
      const { operationName } = JSON.parse(options.body);
      if (operationName === "ApprovedAnalyticsCanary") return Response.json({ data: { canary: { documentId: "created-id" } } });
      if (operationName === "CleanupAnalyticsCanary") return Response.json({ data: { cleanup: { documentId: "created-id" } } });
      return Response.json({ data: { remaining: [{ documentId: "retained-id" }] } });
    },
  });

  assert.equal(result.code, "ANALYTICS_CLEANUP_FAILED");
  assert.equal(result.operations[0].observedStatus, "cleanup-verification-failed");
  assert.doesNotMatch(JSON.stringify(result), /retained-id/);
});

test("stops after an unauthorized account bootstrap and emits a redacted stable result", async () => {
  let calls = 0;
  const report = await runPublicApiPreflight({
    username: "fixture-user",
    env: validPolicyEnv({ VITE_PUBLIC_READ_ACCESS_TOKEN: "private-read-token" }),
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
    env: validPolicyEnv({ VITE_PUBLIC_READ_ACCESS_TOKEN: "private-read-token" }),
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

test("read-only protected preflight proves enabled reads without any mutation or canary", async () => {
  const requests = [];
  const report = await runPublicReadOnlyPreflight({
    username: "fixture-user",
    env: validPolicyEnv(),
    fetchImpl: async (_url, options) => {
      const request = JSON.parse(options.body);
      requests.push(request);
      if (request.operationName === "PublicAccountBootstrap") {
        return Response.json({ data: { accounts: [{ documentId: "account-1", public_profile: "Yes", public_books: "Yes" }] } });
      }
      return Response.json({ data: { bookLists: [{ documentId: "book-list-doc", slug: "book-list", recommended_books: [{ book_categories: [{ documentId: "subject-doc" }] }] }] } });
    },
  });
  assert.equal(report.code, "PUBLIC_API_READY");
  assert.deepEqual(requests.map((request) => request.operationName), ["PublicAccountBootstrap", "PublicBooks"]);
  assert.equal(requests.some((request) => /\bmutation\b/.test(request.query)), false);
  assert.deepEqual(report.fixtureIdentities.bookListSlugs, ["book-list-doc", "book-list"]);
  assert.deepEqual(report.fixtureIdentities.bookSubjectSlugs, ["subject-doc"]);
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
    observedStatus: "scope-origin-rate-limit-invalid",
    likelyCause: "Required server-side capability evidence is missing or invalid.",
    remediation: "Use published-read-only scope, an allowOrigins policy containing PUBLIC_API_EXPECTED_ORIGIN, and non-production positive rate-limit JSON.",
  }]);
});

test("rejects a bootstrap account that is not publicly published", async () => {
  const report = await runPublicApiPreflight({
    username: "private-fixture",
    env: validPolicyEnv({ VITE_PUBLIC_READ_ACCESS_TOKEN: "public-read-token" }),
    fetchImpl: async () => Response.json({ data: { accounts: [{ documentId: "private-id", public_profile: "No" }] } }),
  });

  assert.equal(report.code, "PUBLIC_READ_FORBIDDEN");
  assert.equal(report.operations[0].observedStatus, "private-account-returned");
});

test("Authorization selects public-read versus analytics-write inside the fetch boundary while reports stay redacted", async () => {
  const env = protectedEnv();
  const result = await runControlledNegativeProbes({
    endpoint: env.VITE_API_URL,
    env,
    fetchImpl: async (_url, options) => {
      const { operationName } = JSON.parse(options.body);
      const analyticsOperation = /^(?:ApprovedAnalytics|CleanupAnalytics|VerifyAnalytics|Preflight|CapabilityAnalytics|Analytics)/.test(operationName);
      assert.equal(options.headers.authorization, `Bearer ${analyticsOperation ? env.VITE_ANALYTICS_WRITE_ACCESS_TOKEN : env.VITE_PUBLIC_READ_ACCESS_TOKEN}`);
      return protectedResponse(operationName, options);
    },
  });

  assert.equal(result.code, "PUBLIC_API_READY");
  assert.doesNotMatch(JSON.stringify(result), /fixture-(?:public-read|analytics-write)-capability|Bearer/i);
});

for (const rateResponse of ["200", "500", "timeout"]) {
  test(`ordinary ${rateResponse} responses do not prove the rate-limit boundary`, async () => {
    const env = protectedEnv();
    const result = await runControlledNegativeProbes({
      endpoint: env.VITE_API_URL,
      env,
      timeoutMs: 5,
      fetchImpl: async (_url, options) => {
        const { operationName } = JSON.parse(options.body);
        return protectedResponse(operationName, options, { rateResponse });
      },
    });

    const rate = result.operations.find((operation) => operation.operation === "rate-limit");
    assert.equal(result.code, "PUBLIC_CAPABILITY_BOUNDARY_BROKEN");
    assert.equal(rate.passed, false);
    assert.equal(rate.observedStatus, "rate-limit-not-observed");
  });
}

test("an explicit HTTP 429 proves the bounded rate-limit boundary", async () => {
  const env = protectedEnv();
  const result = await runControlledNegativeProbes({
    endpoint: env.VITE_API_URL,
    env,
    fetchImpl: async (_url, options) => {
      const { operationName } = JSON.parse(options.body);
      return protectedResponse(operationName, options, { rateResponse: "429" });
    },
  });

  const rate = result.operations.find((operation) => operation.operation === "rate-limit");
  assert.equal(result.code, "PUBLIC_API_READY");
  assert.equal(rate.passed, true);
  assert.equal(rate.observedStatus, "http-429");
});

test("validation-rejected classification is reserved for named invalid-shape probes", async () => {
  const graphqlValidationResponse = async () => Response.json({ errors: [{ message: "Validation rejected unsupported input" }] });
  const ordinary = await requestOperation({
    endpoint: "https://api.qa.explorers.earth/graphql", token: "fixture-capability", operation: testOperation, variables: {}, timeoutMs: 50, retries: 0, fetchImpl: graphqlValidationResponse,
  });
  const invalidShape = await requestOperation({
    endpoint: "https://api.qa.explorers.earth/graphql",
    token: "fixture-capability",
    operation: { ...testOperation, id: "analytics-unsupported-event", operationName: "AnalyticsValidationCanaryEvent" },
    variables: {}, timeoutMs: 50, retries: 0, fetchImpl: graphqlValidationResponse,
  });

  assert.equal(ordinary.diagnostic.classification, "malformed");
  assert.equal(ordinary.diagnostic.observedStatus, "graphql-errors");
  assert.equal(invalidShape.diagnostic.classification, "validation-rejected");
});

test("a successful invalid-shape mutation fails the capability boundary", async () => {
  const env = protectedEnv();
  const result = await runControlledNegativeProbes({
    endpoint: env.VITE_API_URL,
    env,
    fetchImpl: async (_url, options) => {
      const { operationName } = JSON.parse(options.body);
      return protectedResponse(operationName, options, { successfulInvalidShape: "AnalyticsValidationCanaryUnknown" });
    },
  });

  const probe = result.operations.find((operation) => operation.operation === "analytics-unknown-field");
  assert.equal(result.code, "PUBLIC_CAPABILITY_BOUNDARY_BROKEN");
  assert.equal(probe.expected, "validation-rejected");
  assert.equal(probe.passed, false);
});

test("the complete protected happy path reaches PUBLIC_API_READY only after every required proof", async () => {
  const env = protectedEnv();
  const requests = [];
  const report = await runPublicApiPreflight({
    username: "published-fixture",
    env,
    fetchImpl: async (_url, options) => {
      const { operationName } = JSON.parse(options.body);
      requests.push(operationName);
      if (operationName === "PublicAccountBootstrap") return Response.json({ data: { accounts: [{ documentId: "public-account", public_profile: "Yes", public_recommendations: "Yes" }] } });
      if (operationName === "PublicPlaces") return Response.json({ data: { recommendationLists: [{ documentId: "published-list" }] } });
      return protectedResponse(operationName, options);
    },
  });

  assert.equal(report.code, "PUBLIC_API_READY");
  assert.deepEqual(requests, [
    "PublicAccountBootstrap",
    "PublicPlaces",
    "ApprovedAnalyticsCanary",
    "CleanupAnalyticsCanary",
    "VerifyAnalyticsCanaryCleanup",
    "PreflightQaBrowserRun",
    "PreflightCleanupQaBrowserRun",
    "PreflightVerifyQaBrowserRun",
    "CapabilityPrivateAccount",
    "CapabilityPrivateList",
    "CapabilityPrivateItem",
    "CapabilityPrivateListSlug",
    "CapabilityUnfilteredRead",
    "PublicReadCapabilityCanary",
    "CapabilityAnalyticsRead",
    "AnalyticsNonAnalyticsCanary",
    "AnalyticsValidationCanaryUnknown",
    "AnalyticsValidationCanaryAccount",
    "AnalyticsValidationCanaryEvent",
    "CapabilityRateLimitProbe",
    "CapabilityRateLimitProbe",
    "CapabilityRateLimitProbe",
  ]);
  assert.deepEqual(report.operations.slice(0, 2).map(({ operation, classification }) => [operation, classification]), [["account-bootstrap", "ready"], ["places", "ready"]]);
  assert.equal(report.operations.at(-1).observedStatus, "http-429");
});

async function assertSecurityProofRejected(overrides) {
  let calls = 0;
  const report = await runPublicApiPreflight({
    username: "fixture-user",
    env: validPolicyEnv(overrides),
    fetchImpl: async () => { calls += 1; return Response.json({ data: { accounts: [] } }); },
  });
  assert.equal(calls, 0);
  assert.equal(report.code, "SECURITY_PROOF_MISSING");
  return report;
}

test("malformed policy JSON fails closed before network I/O", async () => {
  await assertSecurityProofRejected({ PUBLIC_API_ORIGIN_POLICY: "{" });
});

test("placeholder origin policy JSON fails closed before network I/O", async () => {
  await assertSecurityProofRejected({
    PUBLIC_API_EXPECTED_ORIGIN: "https://non-production.example.invalid",
    PUBLIC_API_ORIGIN_POLICY: '{"allowOrigins":["https://non-production.example.invalid"]}',
  });
});

test("a shared legacy capability fails closed before network I/O", async () => {
  await assertSecurityProofRejected({
    VITE_PUBLIC_READ_ACCESS_TOKEN: undefined,
    VITE_PUBLIC_ACCESS_TOKEN: "shared-legacy-capability",
  });
});

test("equal dedicated capabilities fail separation before network I/O", async () => {
  await assertSecurityProofRejected({
    VITE_PUBLIC_READ_ACCESS_TOKEN: "shared-capability",
    VITE_ANALYTICS_WRITE_ACCESS_TOKEN: "shared-capability",
  });
});

test("origin allowOrigins must be an actual array", async () => {
  await assertSecurityProofRejected({ PUBLIC_API_ORIGIN_POLICY: '{"allowOrigins":"https://qa.explorers.earth"}' });
});

test("origin allowOrigins rejects syntactically invalid URLs", async () => {
  await assertSecurityProofRejected({ PUBLIC_API_ORIGIN_POLICY: '{"allowOrigins":["https://qa.explorers.earth","not-a-url"]}' });
});

test("origin allowOrigins rejects path-bearing URLs", async () => {
  await assertSecurityProofRejected({
    PUBLIC_API_EXPECTED_ORIGIN: "https://qa.explorers.earth/profile",
    PUBLIC_API_ORIGIN_POLICY: '{"allowOrigins":["https://qa.explorers.earth/profile"]}',
  });
});

test("origin allowOrigins rejects duplicate origins", async () => {
  await assertSecurityProofRejected({ PUBLIC_API_ORIGIN_POLICY: '{"allowOrigins":["https://qa.explorers.earth","https://qa.explorers.earth"]}' });
});

test("origin allowOrigins must contain PUBLIC_API_EXPECTED_ORIGIN", async () => {
  await assertSecurityProofRejected({ PUBLIC_API_ORIGIN_POLICY: '{"allowOrigins":["https://other-qa.explorers.earth"]}' });
});
