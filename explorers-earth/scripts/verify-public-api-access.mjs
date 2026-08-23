import { config } from "dotenv";
import { ACCOUNT_BOOTSTRAP, enabledPublicOperations } from "./public-api-capabilities.mjs";
import { exitCodeFor, formatVerificationResult } from "./lib/verificationResult.mjs";

const DIAGNOSTICS = {
  "transport-error": ["PUBLIC_API_TRANSPORT_ERROR", "The public API could not be reached before the timeout.", "Check VITE_API_URL, the allowed origin, and the server-side rate-limit policy."],
  unauthorized: ["PUBLIC_READ_UNAUTHORIZED", "The configured public-read capability was rejected.", "Issue a published-read-only capability and set VITE_PUBLIC_READ_ACCESS_TOKEN."],
  forbidden: ["PUBLIC_READ_FORBIDDEN", "The configured public-read capability is not permitted for this operation.", "Grant only the documented published-read operation or require a BFF/server proxy."],
  malformed: ["PUBLIC_API_MALFORMED", "The public API returned an invalid capability response.", "Verify the GraphQL schema and published-read response contract without exposing private fields."],
  empty: ["PUBLIC_API_EMPTY", "The published collection is available but has no records.", "Confirm this empty result is expected for the controlled public fixture."],
  ready: ["PUBLIC_API_READY", "The published operation returned public records.", "Record this scoped capability result in the release artifact."],
  "validation-rejected": ["PUBLIC_API_VALIDATION_REJECTED", "The API rejected the deliberate invalid canary shape.", "Record the rejected invalid-shape boundary proof."],
};

function diagnostic(operation, classification, observedStatus) {
  const [code, likelyCause, remediation] = DIAGNOSTICS[classification];
  return { operation, classification, code, observedStatus, likelyCause, remediation };
}

function sourceFor(env, name, legacy = "VITE_PUBLIC_ACCESS_TOKEN") {
  if (env[name]) return "dedicated";
  if (env[legacy]) return "legacy-local";
  return "missing";
}

function parseUrlOrigin(value) {
  if (typeof value !== "string" || value.length === 0) return null;
  try {
    const url = new URL(value);
    const placeholder = /(?:^|\.)(?:invalid|test|example)$|(?:^|\.)example\.(?:com|org|net)$|placeholder|your-origin/i.test(url.hostname);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash || placeholder) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function capabilitySeparation(env) {
  const publicRead = env.VITE_PUBLIC_READ_ACCESS_TOKEN;
  const analyticsWrite = env.VITE_ANALYTICS_WRITE_ACCESS_TOKEN;
  if (env.VITE_PUBLIC_ACCESS_TOKEN && (!publicRead || !analyticsWrite)) return "invalid";
  if (publicRead && analyticsWrite) return publicRead === analyticsWrite ? "invalid" : "valid";
  return "unproven";
}

function policyEvidence(env) {
  try {
    const origin = JSON.parse(env.PUBLIC_API_ORIGIN_POLICY ?? "");
    const rate = JSON.parse(env.PUBLIC_API_RATE_LIMIT_POLICY ?? "");
    const expectedOrigin = parseUrlOrigin(env.PUBLIC_API_EXPECTED_ORIGIN);
    const allowOrigins = Array.isArray(origin.allowOrigins) ? origin.allowOrigins.map(parseUrlOrigin) : [];
    const originValid = expectedOrigin !== null
      && allowOrigins.length > 0
      && allowOrigins.every((value) => value !== null)
      && new Set(allowOrigins).size === allowOrigins.length
      && allowOrigins.includes(expectedOrigin);
    const rateValid = rate.environment === "non-production" && Number.isInteger(rate.limit) && rate.limit > 0 && Number.isInteger(rate.windowSeconds) && rate.windowSeconds > 0;
    return { capabilityScope: env.PUBLIC_API_CAPABILITY_SCOPE === "published-read-only" ? "valid" : "invalid", originPolicy: originValid ? "valid" : "invalid", rateLimitPolicy: rateValid ? "valid" : "invalid" };
  } catch { return { capabilityScope: env.PUBLIC_API_CAPABILITY_SCOPE === "published-read-only" ? "valid" : "invalid", originPolicy: "invalid", rateLimitPolicy: "invalid" }; }
}

const INVALID_SHAPE_PROBE_IDS = new Set(["analytics-unknown-field", "analytics-invalid-account", "analytics-unsupported-event"]);

export async function requestOperation({ endpoint, token, operation, variables, fetchImpl, timeoutMs, retries }) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ operationName: operation.operationName, query: operation.query, variables }),
        signal: controller.signal,
      });
      if (response.status === 401) { clearTimeout(timeout); return { diagnostic: diagnostic(operation.id, "unauthorized", "http-401") }; }
      if (response.status === 403) { clearTimeout(timeout); return { diagnostic: diagnostic(operation.id, "forbidden", "http-403") }; }
      if (!response.ok) { clearTimeout(timeout); return { diagnostic: diagnostic(operation.id, "transport-error", `http-${response.status}`) }; }
      let body;
      try { body = await response.json(); } catch (error) {
        if (error?.name === "AbortError") throw error;
        clearTimeout(timeout);
        return { diagnostic: diagnostic(operation.id, "malformed", "invalid-json") };
      }
      clearTimeout(timeout);
      if (body?.errors?.some((error) => /forbidden/i.test(error?.message ?? ""))) return { diagnostic: diagnostic(operation.id, "forbidden", "graphql-forbidden") };
      if (body?.errors?.some((error) => /unauthorized/i.test(error?.message ?? ""))) return { diagnostic: diagnostic(operation.id, "unauthorized", "graphql-unauthorized") };
      if (body?.errors?.some((error) => /validation|unknown field|invalid input|unsupported/i.test(error?.message ?? ""))) {
        return { diagnostic: INVALID_SHAPE_PROBE_IDS.has(operation.id)
          ? diagnostic(operation.id, "validation-rejected", "graphql-validation-denied")
          : diagnostic(operation.id, "malformed", "graphql-errors") };
      }
      if (Array.isArray(body?.errors) && body.errors.length > 0) return { diagnostic: diagnostic(operation.id, "malformed", "graphql-errors") };
      const value = operation.path.reduce((current, key) => current?.[key], body?.data);
      if (!Array.isArray(value)) return { diagnostic: diagnostic(operation.id, "malformed", "missing-data") };
      return { diagnostic: diagnostic(operation.id, value.length === 0 ? "empty" : "ready", "http-200"), value };
    } catch (error) {
      clearTimeout(timeout);
      if (attempt === retries) return { diagnostic: diagnostic(operation.id, "transport-error", error?.name === "AbortError" ? "timeout" : "network-error") };
    }
  }
}

function reportCode(operations) {
  const blocking = operations.find((operation) => !["ready", "empty"].includes(operation.classification));
  return blocking?.code ?? "PUBLIC_API_READY";
}

function cleanupFailure(observedStatus) {
  return { code: "ANALYTICS_CLEANUP_FAILED", operations: [{ operation: "analytics-canary", classification: "malformed", code: "ANALYTICS_CLEANUP_FAILED", observedStatus, likelyCause: "The protected analytics canary was not proven cleaned up.", remediation: "Stop mutations and repair the dedicated QA sink before rerunning." }] };
}

export async function runAnalyticsCanaryLifecycle({ endpoint, token, runId, qaSink, documents, fetchImpl = fetch, timeoutMs = 1500 } = {}) {
  if (!endpoint || !token || !runId || !qaSink || !/^qa[-_]/i.test(qaSink) || !documents || !/\bcanary\s*:/.test(documents.canary ?? "") || !/\bcleanup\s*:/.test(documents.cleanup ?? "") || !/\bremaining\s*:/.test(documents.remaining ?? "")) return { code: "ANALYTICS_CANARY_REQUIRED", operations: [{ operation: "analytics-canary", classification: "malformed", code: "ANALYTICS_CANARY_REQUIRED", observedStatus: "contract-missing-or-invalid", likelyCause: "The protected analytics canary contract is incomplete.", remediation: "Provide aliasing canary, cleanup, and remaining documents plus a QA sink and run ID." }] };
  const send = async (operationName, query, variables) => {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
    try { const response = await fetchImpl(endpoint, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ operationName, query, variables }), signal: controller.signal }); const body = await response.json(); return response.ok && !body.errors ? body.data : null; } catch { return null; } finally { clearTimeout(timer); }
  };
  let createdId;
  try {
    const written = await send("ApprovedAnalyticsCanary", documents.canary, { runId, qaSink });
    createdId = written?.canary?.documentId;
    if (!createdId) return cleanupFailure("canary-write-failed");
  } finally {
    if (createdId) {
      const cleaned = await send("CleanupAnalyticsCanary", documents.cleanup, { runId, qaSink, documentId: createdId });
      if (!cleaned?.cleanup) createdId = undefined;
    }
  }
  if (!createdId) return cleanupFailure("cleanup-failed");
  const remaining = await send("VerifyAnalyticsCanaryCleanup", documents.remaining, { runId, qaSink });
  if (!Array.isArray(remaining?.remaining) || remaining.remaining.length) return cleanupFailure("cleanup-verification-failed");
  return { code: "PUBLIC_API_READY", operations: [{ operation: "analytics-canary", classification: "ready", code: "PUBLIC_API_READY", observedStatus: "cleanup-verified", likelyCause: "Approved QA analytics canary completed and was removed.", remediation: "Retain the redacted release artifact." }] };
}

export async function runAnalyticsRunCleanupPreflight({ endpoint, token, baseRunId, qaSink, documents, fetchImpl = fetch, timeoutMs = 1500 } = {}) {
  const runId = /^qa[-_]/i.test(baseRunId ?? "") ? `qa-preflight-${baseRunId.slice(3)}` : "";
  if (!endpoint || !token || !runId || !/^qa[-_]/i.test(qaSink ?? "") ||
      !/\bcanary\s*:/.test(documents?.canary ?? "") || !/\bcleanup\s*:/.test(documents?.cleanupRun ?? "") ||
      !/\bremaining\s*:/.test(documents?.remainingRun ?? "")) {
    return { code: "ANALYTICS_RUN_CLEANUP_UNAVAILABLE", operations: [diagnostic("analytics-run-cleanup", "malformed", "contract-missing-or-invalid")] };
  }
  const send = async (operationName, query) => {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(endpoint, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ operationName, query, variables: { runId, qaSink } }), signal: controller.signal });
      const body = await response.json();
      return response.ok && !body.errors ? body.data : null;
    } catch { return null; } finally { clearTimeout(timer); }
  };
  const written = await send("PreflightQaBrowserRun", documents.canary);
  if (!written?.canary?.documentId) return { code: "ANALYTICS_RUN_CLEANUP_UNAVAILABLE", operations: [diagnostic("analytics-run-cleanup", "malformed", "canary-write-failed")] };
  const cleaned = await send("PreflightCleanupQaBrowserRun", documents.cleanupRun);
  if (!cleaned?.cleanup) return { code: "ANALYTICS_RUN_CLEANUP_UNAVAILABLE", operations: [diagnostic("analytics-run-cleanup", "malformed", "cleanup-failed")] };
  const verified = await send("PreflightVerifyQaBrowserRun", documents.remainingRun);
  if (!Array.isArray(verified?.remaining) || verified.remaining.length !== 0) return { code: "ANALYTICS_RUN_CLEANUP_UNAVAILABLE", operations: [diagnostic("analytics-run-cleanup", "malformed", "cleanup-verification-failed")] };
  return { code: "PUBLIC_API_READY", operations: [{ ...diagnostic("analytics-run-cleanup", "ready", "cleanup-verified"), code: "PUBLIC_API_READY" }] };
}

const NEGATIVE_PROBES = [
  ["private-account-direct-id", "CapabilityPrivateAccount", "query CapabilityPrivateAccount($id: ID!) { account(documentId: $id) { documentId } }", "public-read", (env) => ({ id: env.PUBLIC_API_PRIVATE_ACCOUNT_ID })],
  ["private-list-direct-id", "CapabilityPrivateList", "query CapabilityPrivateList($id: ID!) { recommendationList(documentId: $id) { documentId } }", "public-read", (env) => ({ id: env.PUBLIC_API_PRIVATE_LIST_ID })],
  ["private-item-direct-id", "CapabilityPrivateItem", "query CapabilityPrivateItem($id: ID!) { recommendedPlace(documentId: $id) { documentId } }", "public-read", (env) => ({ id: env.PUBLIC_API_PRIVATE_ITEM_ID })],
  ["private-list-by-slug", "CapabilityPrivateListSlug", "query CapabilityPrivateListSlug($slug: String!) { recommendationLists(filters: { slug: { eq: $slug } }) { documentId } }", "public-read", (env) => ({ slug: env.PUBLIC_API_PRIVATE_LIST_SLUG })],
  ["public-omits-visibility", "CapabilityUnfilteredRead", "query CapabilityUnfilteredRead { recommendationLists { documentId } }", "public-read", () => ({})],
  ["public-mutation", "PublicReadCapabilityCanary", "mutation PublicReadCapabilityCanary($runId: String!) { publicReadCapabilityCanary(runId: $runId) { accepted } }", "public-read", (env) => ({ runId: env.PUBLIC_API_RUN_ID })],
  ["analytics-read", "CapabilityAnalyticsRead", "query CapabilityAnalyticsRead { accounts { documentId } }", "analytics-write", () => ({})],
  ["analytics-non-analytics-mutation", "AnalyticsNonAnalyticsCanary", "mutation AnalyticsNonAnalyticsCanary($runId: String!) { analyticsNonAnalyticsCanary(runId: $runId) { accepted } }", "analytics-write", (env) => ({ runId: env.PUBLIC_API_RUN_ID })],
  ["analytics-unknown-field", "AnalyticsValidationCanaryUnknown", "mutation AnalyticsValidationCanaryUnknown($runId: String!) { analyticsValidationCanary(runId: $runId, shape: \"unknown-field\") { accepted } }", "analytics-write", (env) => ({ runId: env.PUBLIC_API_RUN_ID })],
  ["analytics-invalid-account", "AnalyticsValidationCanaryAccount", "mutation AnalyticsValidationCanaryAccount($runId: String!) { analyticsValidationCanary(runId: $runId, shape: \"invalid-account\") { accepted } }", "analytics-write", (env) => ({ runId: env.PUBLIC_API_RUN_ID })],
  ["analytics-unsupported-event", "AnalyticsValidationCanaryEvent", "mutation AnalyticsValidationCanaryEvent($runId: String!) { analyticsValidationCanary(runId: $runId, shape: \"unsupported-event\") { accepted } }", "analytics-write", (env) => ({ runId: env.PUBLIC_API_RUN_ID })],
];

export async function runControlledNegativeProbes({ endpoint, env = process.env, fetchImpl = fetch, timeoutMs = 1500, retries = 0 } = {}) {
  const required = ["VITE_PUBLIC_READ_ACCESS_TOKEN", "VITE_ANALYTICS_WRITE_ACCESS_TOKEN", "PUBLIC_API_PRIVATE_ACCOUNT_ID", "PUBLIC_API_PRIVATE_LIST_ID", "PUBLIC_API_PRIVATE_ITEM_ID", "PUBLIC_API_PRIVATE_LIST_SLUG", "PUBLIC_API_RUN_ID"];
  if (env.PUBLIC_API_CONTROLLED_FIXTURE !== "true" || required.some((name) => !env[name])) {
    return {
      code: "CONTROLLED_FIXTURE_REQUIRED",
      operations: [diagnostic("controlled-negative-probes", "malformed", "fixture-missing")],
    };
  }
  if (env.PUBLIC_PROFILE_MUTATION_APPROVED !== "true" || env.PUBLIC_PROFILE_TEST_ACCOUNT_MARKER !== "public-profile-mutation-fixture" || !env.PUBLIC_API_ANALYTICS_QA_SINK || !env.PUBLIC_API_ANALYTICS_CANARY_MUTATION || !env.PUBLIC_API_ANALYTICS_CLEANUP_MUTATION || !env.PUBLIC_API_ANALYTICS_CLEANUP_VERIFY_QUERY) {
    return { code: "ANALYTICS_CANARY_REQUIRED", operations: [{ operation: "analytics-canary", classification: "malformed", code: "ANALYTICS_CANARY_REQUIRED", observedStatus: "approval-sink-or-cleanup-missing", likelyCause: "Approved analytics canary cleanup cannot be guaranteed.", remediation: "Provide the protected approval, dedicated marker, QA sink, canary mutation, cleanup mutation, and cleanup verification query." }] };
  }
  const lifecycle = await runAnalyticsCanaryLifecycle({ endpoint, token: env.VITE_ANALYTICS_WRITE_ACCESS_TOKEN, runId: env.PUBLIC_API_RUN_ID, qaSink: env.PUBLIC_API_ANALYTICS_QA_SINK, documents: { canary: env.PUBLIC_API_ANALYTICS_CANARY_MUTATION, cleanup: env.PUBLIC_API_ANALYTICS_CLEANUP_MUTATION, remaining: env.PUBLIC_API_ANALYTICS_CLEANUP_VERIFY_QUERY }, fetchImpl, timeoutMs });
  if (lifecycle.code !== "PUBLIC_API_READY") return lifecycle;
  const runCleanup = await runAnalyticsRunCleanupPreflight({ endpoint, token: env.VITE_ANALYTICS_WRITE_ACCESS_TOKEN, baseRunId: env.PUBLIC_API_RUN_ID, qaSink: env.PUBLIC_API_ANALYTICS_QA_SINK, documents: { canary: env.PUBLIC_API_ANALYTICS_CANARY_MUTATION, cleanupRun: env.PUBLIC_API_ANALYTICS_RUN_CLEANUP_MUTATION, remainingRun: env.PUBLIC_API_ANALYTICS_RUN_CLEANUP_VERIFY_QUERY }, fetchImpl, timeoutMs });
  if (runCleanup.code !== "PUBLIC_API_READY") return runCleanup;
  const results = [];
  for (const [id, operationName, query, capability, variablesFor] of NEGATIVE_PROBES) {
    const variables = variablesFor(env);
    const operation = { id, operationName, query, variables: () => variables, path: ["__must_not_exist__"] };
    const token = capability === "analytics-write" ? env.VITE_ANALYTICS_WRITE_ACCESS_TOKEN : env.VITE_PUBLIC_READ_ACCESS_TOKEN;
    const response = await requestOperation({ endpoint, token, operation, variables, fetchImpl, timeoutMs, retries });
    const expected = id.startsWith("analytics-") && ["analytics-unknown-field", "analytics-invalid-account", "analytics-unsupported-event"].includes(id) ? "validation-rejected" : "forbidden";
    const passed = response.diagnostic.classification === expected;
    results.push({ ...response.diagnostic, code: passed ? "PUBLIC_API_READY" : "PUBLIC_CAPABILITY_BOUNDARY_BROKEN", expected, passed });
  }
  const rateRequests = [];
  for (let attempt = 0; attempt < 3; attempt += 1) rateRequests.push(await requestOperation({ endpoint, token: env.VITE_PUBLIC_READ_ACCESS_TOKEN, operation: { id: "rate-limit", operationName: "CapabilityRateLimitProbe", query: "query CapabilityRateLimitProbe { accounts { documentId } }", path: ["accounts"] }, variables: {}, fetchImpl, timeoutMs, retries: 0 }));
  const ratePassed = rateRequests.some((response) => response.diagnostic.observedStatus === "http-429");
  results.push({ ...diagnostic("rate-limit", ratePassed ? "transport-error" : "malformed", ratePassed ? "http-429" : "rate-limit-not-observed"), code: ratePassed ? "PUBLIC_API_READY" : "PUBLIC_CAPABILITY_BOUNDARY_BROKEN", expected: "http-429", passed: ratePassed });
  return { code: results.every((result) => result.passed) ? "PUBLIC_API_READY" : "PUBLIC_CAPABILITY_BOUNDARY_BROKEN", operations: results };
}

export async function runPublicApiPreflight({ username, env = process.env, fetchImpl = fetch, timeoutMs = 1500, retries = 1 } = {}) {
  const endpoint = env.VITE_API_URL;
  const publicReadSource = sourceFor(env, "VITE_PUBLIC_READ_ACCESS_TOKEN");
  const token = env.VITE_PUBLIC_READ_ACCESS_TOKEN ?? env.VITE_PUBLIC_ACCESS_TOKEN;
  const configuration = {
    publicReadSource,
    analyticsWriteSource: sourceFor(env, "VITE_ANALYTICS_WRITE_ACCESS_TOKEN"),
    capabilitySeparation: capabilitySeparation(env),
    ...policyEvidence(env),
  };
  if (!username || !endpoint || !token) {
    const operation = diagnostic("account-bootstrap", "unauthorized", "credential-or-endpoint-missing");
    return { code: operation.code, username: username ? "provided" : "missing", configuration, operations: [operation] };
  }
  if (configuration.capabilitySeparation === "invalid" || [configuration.capabilityScope, configuration.originPolicy, configuration.rateLimitPolicy].some((value) => value !== "valid")) {
    const operation = {
      operation: "security-proof", classification: "malformed", code: "SECURITY_PROOF_MISSING",
      observedStatus: "scope-origin-rate-limit-invalid", likelyCause: "Required server-side capability evidence is missing or invalid.",
      remediation: "Use published-read-only scope, an allowOrigins policy containing PUBLIC_API_EXPECTED_ORIGIN, and non-production positive rate-limit JSON.",
    };
    return { code: operation.code, username: "provided", configuration, operations: [operation] };
  }
  const bootstrapResponse = await requestOperation({ endpoint, token, operation: ACCOUNT_BOOTSTRAP, variables: ACCOUNT_BOOTSTRAP.variables(username), fetchImpl, timeoutMs, retries });
  const bootstrap = bootstrapResponse.diagnostic;
  if (bootstrap.classification !== "ready") return { code: bootstrap.code, username: "provided", configuration, operations: [bootstrap] };
  const bootstrapOperation = { ...bootstrap, operation: "account-bootstrap" };
  const account = bootstrapResponse.value[0];
  if (account.public_profile !== "Yes" && account.public_profile !== true) {
    const privateAccount = { ...bootstrapOperation, classification: "forbidden", code: "PUBLIC_READ_FORBIDDEN", observedStatus: "private-account-returned", likelyCause: "The bootstrap query exposed an unpublished account.", remediation: "Require public_profile publication in the server query policy or use a BFF/server proxy." };
    return { code: privateAccount.code, username: "provided", configuration, operations: [privateAccount] };
  }
  const collectionResponses = await Promise.all(enabledPublicOperations(account).map((operation) => requestOperation({ endpoint, token, operation, variables: operation.variables(account.documentId), fetchImpl, timeoutMs, retries })));
  const collectionResults = collectionResponses.map((response) => response.diagnostic);
  const operations = [bootstrapOperation, ...collectionResults];
  const negative = await runControlledNegativeProbes({ endpoint, env, fetchImpl, timeoutMs });
  if (negative.code === "CONTROLLED_FIXTURE_REQUIRED") {
    const prerequisite = {
      ...negative.operations[0],
      code: "CONTROLLED_FIXTURE_REQUIRED",
      likelyCause: "No controlled non-production fixture was configured for negative capability probes.",
      remediation: "Configure the controlled fixture IDs and PUBLIC_API_CONTROLLED_FIXTURE=true, or require a BFF/server proxy before release.",
    };
    return { code: "CONTROLLED_FIXTURE_REQUIRED", username: "provided", configuration, operations: [...operations, prerequisite] };
  }
  const code = negative.code === "PUBLIC_API_READY" ? reportCode(operations) : negative.code;
  return { code, username: "provided", configuration, operations: [...operations, ...negative.operations], accountVisibility: publicVisibility(account) };
}

export async function runPublicReadOnlyPreflight({ username, env = process.env, fetchImpl = fetch, timeoutMs = 1500, retries = 1 } = {}) {
  const endpoint = env.VITE_API_URL;
  const token = env.VITE_PUBLIC_READ_ACCESS_TOKEN;
  if (!username || !endpoint || !token) return { code: "ENV_MISSING", operations: [] };
  const bootstrapResponse = await requestOperation({
    endpoint, token, operation: ACCOUNT_BOOTSTRAP,
    variables: ACCOUNT_BOOTSTRAP.variables(username), fetchImpl, timeoutMs, retries,
  });
  if (bootstrapResponse.diagnostic.classification !== "ready") {
    return { code: bootstrapResponse.diagnostic.code, operations: [bootstrapResponse.diagnostic] };
  }
  const account = bootstrapResponse.value[0];
  if (account.public_profile !== "Yes" && account.public_profile !== true) {
    return { code: "PUBLIC_READ_FORBIDDEN", operations: [bootstrapResponse.diagnostic] };
  }
  const collections = await Promise.all(enabledPublicOperations(account).map((operation) => requestOperation({
    endpoint, token, operation, variables: operation.variables(account.documentId), fetchImpl, timeoutMs, retries,
  })));
  const operations = [bootstrapResponse.diagnostic, ...collections.map((result) => result.diagnostic)];
  return { code: reportCode(operations), operations, accountVisibility: publicVisibility(account) };
}

function publicVisibility(account) {
  return Object.fromEntries(["public_profile", "public_recommendations", "public_music", "public_movie", "public_books", "public_guides", "public_games", "public_apps", "public_products", "public_people"].map((field) => [field, account[field] === true || account[field] === "Yes"]));
}

function parseArgs(args) {
  return { username: args.find((arg) => arg.startsWith("--username="))?.slice(11), json: args.includes("--json") };
}

if (import.meta.url === `file:///${process.argv[1]?.replaceAll("\\", "/")}`) {
  config({ quiet: true });
  const { username, json } = parseArgs(process.argv.slice(2));
  const report = await runPublicApiPreflight({ username });
  const failure = report.operations.find((operation) => !["ready", "empty"].includes(operation.classification));
  const result = {
    code: report.code,
    summary: report.code === "PUBLIC_API_READY"
      ? "Public API capability preflight is ready."
      : `${failure.operation}: ${failure.classification}; ${failure.likelyCause}`,
    safeContext: { username: report.username, configuration: report.configuration, operations: report.operations },
    remediation: failure?.remediation,
  };
  console.log(formatVerificationResult(result, json));
  process.exitCode = report.code === "PUBLIC_API_READY" ? 0 : exitCodeFor(report.code);
}
