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

async function requestOperation({ endpoint, token, operation, variables, fetchImpl, timeoutMs, retries }) {
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
      clearTimeout(timeout);
      if (response.status === 401) return { diagnostic: diagnostic(operation.id, "unauthorized", "http-401") };
      if (response.status === 403) return { diagnostic: diagnostic(operation.id, "forbidden", "http-403") };
      if (!response.ok) return { diagnostic: diagnostic(operation.id, "transport-error", `http-${response.status}`) };
      let body;
      try { body = await response.json(); } catch { return { diagnostic: diagnostic(operation.id, "malformed", "invalid-json") }; }
      if (body?.errors?.some((error) => /forbidden/i.test(error?.message ?? ""))) return { diagnostic: diagnostic(operation.id, "forbidden", "graphql-forbidden") };
      if (body?.errors?.some((error) => /unauthorized/i.test(error?.message ?? ""))) return { diagnostic: diagnostic(operation.id, "unauthorized", "graphql-unauthorized") };
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

const NEGATIVE_PROBES = [
  ["private-account-direct-id", "CapabilityPrivateAccount", "query CapabilityPrivateAccount($id: ID!) { account(documentId: $id) { documentId } }", "public-read", (env) => ({ id: env.PUBLIC_API_PRIVATE_ACCOUNT_ID })],
  ["private-list-direct-id", "CapabilityPrivateList", "query CapabilityPrivateList($id: ID!) { recommendationList(documentId: $id) { documentId } }", "public-read", (env) => ({ id: env.PUBLIC_API_PRIVATE_LIST_ID })],
  ["private-item-direct-id", "CapabilityPrivateItem", "query CapabilityPrivateItem($id: ID!) { recommendedPlace(documentId: $id) { documentId } }", "public-read", (env) => ({ id: env.PUBLIC_API_PRIVATE_ITEM_ID })],
  ["private-list-by-slug", "CapabilityPrivateListSlug", "query CapabilityPrivateListSlug($slug: String!) { recommendationLists(filters: { slug: { eq: $slug } }) { documentId } }", "public-read", (env) => ({ slug: env.PUBLIC_API_PRIVATE_LIST_SLUG })],
  ["public-omits-visibility", "CapabilityUnfilteredRead", "query CapabilityUnfilteredRead { recommendationLists { documentId } }", "public-read", () => ({})],
  ["public-mutation", "CapabilityPublicMutation", "mutation CapabilityPublicMutation($id: ID!) { deleteRecommendationList(documentId: $id) { documentId } }", "public-read", (env) => ({ id: env.PUBLIC_API_PRIVATE_LIST_ID })],
  ["analytics-read", "CapabilityAnalyticsRead", "query CapabilityAnalyticsRead { accounts { documentId } }", "analytics-write", () => ({})],
  ["analytics-non-analytics-mutation", "CapabilityAnalyticsMutation", "mutation CapabilityAnalyticsMutation($id: ID!) { deleteRecommendationList(documentId: $id) { documentId } }", "analytics-write", (env) => ({ id: env.PUBLIC_API_PRIVATE_LIST_ID })],
  ["analytics-unknown-field", "CapabilityAnalyticsUnknownField", "mutation CapabilityAnalyticsUnknownField { createAnalyticsEvent(data: { unsupported: true }) { documentId } }", "analytics-write", () => ({})],
  ["analytics-invalid-account", "CapabilityAnalyticsInvalidAccount", "mutation CapabilityAnalyticsInvalidAccount($id: ID!) { createAnalyticsEvent(data: { account: $id }) { documentId } }", "analytics-write", (env) => ({ id: env.PUBLIC_API_PRIVATE_ACCOUNT_ID })],
  ["analytics-unsupported-event", "CapabilityAnalyticsUnsupportedEvent", "mutation CapabilityAnalyticsUnsupportedEvent { createAnalyticsEvent(data: { eventType: \"unsupported\" }) { documentId } }", "analytics-write", () => ({})],
  ["rate-limit", "CapabilityRateLimitProbe", "query CapabilityRateLimitProbe { accounts { documentId } }", "public-read", () => ({})],
];

export async function runControlledNegativeProbes({ endpoint, env = process.env, fetchImpl = fetch, timeoutMs = 1500, retries = 0 } = {}) {
  const required = ["VITE_PUBLIC_READ_ACCESS_TOKEN", "VITE_ANALYTICS_WRITE_ACCESS_TOKEN", "PUBLIC_API_PRIVATE_ACCOUNT_ID", "PUBLIC_API_PRIVATE_LIST_ID", "PUBLIC_API_PRIVATE_ITEM_ID", "PUBLIC_API_PRIVATE_LIST_SLUG"];
  if (env.PUBLIC_API_CONTROLLED_FIXTURE !== "true" || required.some((name) => !env[name])) {
    return {
      code: "CONTROLLED_FIXTURE_REQUIRED",
      operations: [diagnostic("controlled-negative-probes", "malformed", "fixture-missing")],
    };
  }
  const results = await Promise.all(NEGATIVE_PROBES.map(async ([id, operationName, query, capability, variablesFor]) => {
    const variables = variablesFor(env);
    const operation = { id, operationName, query, variables: () => variables, path: ["__must_not_exist__"] };
    const token = capability === "analytics-write" ? env.VITE_ANALYTICS_WRITE_ACCESS_TOKEN : env.VITE_PUBLIC_READ_ACCESS_TOKEN;
    const response = await requestOperation({ endpoint, token, operation, variables, fetchImpl, timeoutMs, retries });
    const expected = id === "rate-limit" ? "transport-error" : "forbidden";
    const passed = response.diagnostic.classification === expected;
    return { ...response.diagnostic, code: passed ? "PUBLIC_API_READY" : "PUBLIC_CAPABILITY_BOUNDARY_BROKEN", expected, passed };
  }));
  return { code: results.every((result) => result.passed) ? "PUBLIC_API_READY" : "PUBLIC_CAPABILITY_BOUNDARY_BROKEN", operations: results };
}

export async function runPublicApiPreflight({ username, env = process.env, fetchImpl = fetch, timeoutMs = 1500, retries = 1 } = {}) {
  const endpoint = env.VITE_API_URL;
  const publicReadSource = sourceFor(env, "VITE_PUBLIC_READ_ACCESS_TOKEN");
  const token = env.VITE_PUBLIC_READ_ACCESS_TOKEN ?? env.VITE_PUBLIC_ACCESS_TOKEN;
  const configuration = {
    publicReadSource,
    analyticsWriteSource: sourceFor(env, "VITE_ANALYTICS_WRITE_ACCESS_TOKEN"),
    capabilityScope: env.PUBLIC_API_CAPABILITY_SCOPE ? "configured" : "missing",
    originPolicy: env.PUBLIC_API_ORIGIN_POLICY ? "configured" : "missing",
    rateLimitPolicy: env.PUBLIC_API_RATE_LIMIT_POLICY ? "configured" : "missing",
  };
  if (!username || !endpoint || !token) {
    const operation = diagnostic("account-bootstrap", "unauthorized", "credential-or-endpoint-missing");
    return { code: operation.code, username: username ? "provided" : "missing", configuration, operations: [operation] };
  }
  const bootstrapResponse = await requestOperation({ endpoint, token, operation: ACCOUNT_BOOTSTRAP, variables: ACCOUNT_BOOTSTRAP.variables(username), fetchImpl, timeoutMs, retries });
  const bootstrap = bootstrapResponse.diagnostic;
  if (bootstrap.classification !== "ready") return { code: bootstrap.code, username: "provided", configuration, operations: [bootstrap] };
  const bootstrapOperation = { ...bootstrap, operation: "account-bootstrap" };
  const account = bootstrapResponse.value[0];
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
  return { code: negative.code === "PUBLIC_API_READY" ? reportCode(operations) : negative.code, username: "provided", configuration, operations: [...operations, ...negative.operations] };
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
