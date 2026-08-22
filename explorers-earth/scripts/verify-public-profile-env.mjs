import { config } from "dotenv";
import { createVerificationResult, exitCodeFor, formatVerificationResult } from "./lib/verificationResult.mjs";

export const MUTATION_ACCOUNT_MARKER = "public-profile-mutation-fixture";

export const PUBLIC_PROFILE_ENVIRONMENT_TIERS = Object.freeze({
  fixture: Object.freeze([]),
  "read-only": Object.freeze([
    "VITE_API_URL",
    "VITE_PUBLIC_READ_ACCESS_TOKEN",
    "VITE_PUBLIC_ACCESS_TOKEN",
    "PUBLIC_API_CAPABILITY_SCOPE",
    "PUBLIC_API_EXPECTED_ORIGIN",
    "PUBLIC_API_ORIGIN_POLICY",
    "PUBLIC_API_RATE_LIMIT_POLICY",
  ]),
  mutation: Object.freeze([
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
  ]),
});

export function classifyPublicProfileEnvironment(env = {}) {
  return Object.fromEntries(Object.entries(PUBLIC_PROFILE_ENVIRONMENT_TIERS).flatMap(([tier, names]) => names.map((name) => {
    const presence = env[name] ? "present" : "missing";
    let classification = presence === "present" ? "configured" : "missing";
    if (name === "VITE_PUBLIC_READ_ACCESS_TOKEN" || name === "VITE_ANALYTICS_WRITE_ACCESS_TOKEN") classification = presence === "present" ? "dedicated" : "missing";
    if (name === "VITE_PUBLIC_ACCESS_TOKEN") classification = presence === "present" ? "legacy-local" : "missing";
    if (name === "PUBLIC_PROFILE_MUTATION_APPROVED") classification = env[name] === "true" ? "approved" : "not-approved";
    if (name === "PUBLIC_PROFILE_TEST_ACCOUNT_MARKER") classification = presence === "missing" ? "missing" : env[name] === MUTATION_ACCOUNT_MARKER ? "matched" : "mismatch";
    return [name, { tier, presence, classification }];
  })));
}

export function capabilitySources(env) {
  const classified = classifyPublicProfileEnvironment(env);
  return {
    publicRead: classified.VITE_PUBLIC_READ_ACCESS_TOKEN.presence === "present" ? "dedicated" : classified.VITE_PUBLIC_ACCESS_TOKEN.classification,
    analyticsWrite: classified.VITE_ANALYTICS_WRITE_ACCESS_TOKEN.presence === "present" ? "dedicated" : classified.VITE_PUBLIC_ACCESS_TOKEN.classification,
  };
}

export function verifyPublicProfileEnvironment({ mode = "fixture", env = process.env } = {}) {
  const classified = classifyPublicProfileEnvironment(env);
  const sources = capabilitySources(env);
  const baseContext = { mode, publicReadSource: sources.publicRead, analyticsWriteSource: sources.analyticsWrite };

  if (mode === "fixture") {
    return createVerificationResult({
      code: "READY",
      summary: "Deterministic fixture verification is ready.",
      safeContext: { mode, publicReadSource: "not-required", analyticsWriteSource: "not-required" },
      remediation: "Run npm run verify:public-profile:env -- --mode=fixture before deterministic tests.",
    });
  }

  if (classified.VITE_API_URL.presence === "missing" || sources.publicRead === "missing") {
    return createVerificationResult({
      code: "ENV_MISSING",
      summary: "Live public-read verification is missing required configuration.",
      safeContext: { ...baseContext, apiUrl: env.VITE_API_URL ? "present" : "missing" },
      remediation: "Set VITE_API_URL and VITE_PUBLIC_READ_ACCESS_TOKEN, then run npm run verify:public-profile:env -- --mode=read-only --json.",
    });
  }

  if (mode === "read-only") {
    return createVerificationResult({
      code: "READY",
      summary: "Live read-only verification is ready.",
      safeContext: { ...baseContext, apiUrl: "present" },
      remediation: "Run npm run verify:public-api -- --username=<published-username>.",
    });
  }

  if (mode !== "mutation") {
    return createVerificationResult({
      code: "ENV_MISSING",
      summary: "Verification mode is not supported.",
      safeContext: { ...baseContext, mode: "invalid" },
      remediation: "Use --mode=fixture, --mode=read-only, or --mode=mutation.",
    });
  }

  if (env.PUBLIC_PROFILE_MUTATION_APPROVED !== "true") {
    return createVerificationResult({
      code: "LIVE_WRITE_NOT_APPROVED",
      summary: "Protected mutation verification was not explicitly approved.",
      safeContext: baseContext,
      remediation: "Set PUBLIC_PROFILE_MUTATION_APPROVED=true only in the protected non-production environment, then rerun this command.",
    });
  }

  if (env.PUBLIC_PROFILE_TEST_ACCOUNT_MARKER !== MUTATION_ACCOUNT_MARKER) {
    return createVerificationResult({
      code: "ACCOUNT_MARKER_MISMATCH",
      summary: "Protected mutation verification is not pointed at the dedicated test account.",
      safeContext: { ...baseContext, accountMarker: env.PUBLIC_PROFILE_TEST_ACCOUNT_MARKER ? "mismatch" : "missing" },
      remediation: `Set PUBLIC_PROFILE_TEST_ACCOUNT_MARKER=${MUTATION_ACCOUNT_MARKER} in the protected non-production environment.`,
    });
  }

  if (sources.publicRead !== "dedicated" || sources.analyticsWrite !== "dedicated") {
    return createVerificationResult({
      code: "ENV_MISSING",
      summary: "Protected mutation verification requires independently scoped browser capabilities.",
      safeContext: baseContext,
      remediation: "Set both VITE_PUBLIC_READ_ACCESS_TOKEN and VITE_ANALYTICS_WRITE_ACCESS_TOKEN; do not use VITE_PUBLIC_ACCESS_TOKEN for protected release verification.",
    });
  }

  return createVerificationResult({
    code: "READY",
    summary: "Protected mutation verification prerequisites are ready.",
    safeContext: { ...baseContext, apiUrl: "present", accountMarker: "matched" },
    remediation: "Run the protected mutation suite and restore the dedicated account in its finally block.",
  });
}

function parseArgs(args) {
  return {
    mode: args.find((arg) => arg.startsWith("--mode="))?.slice("--mode=".length) ?? "fixture",
    json: args.includes("--json"),
  };
}

if (import.meta.url === `file:///${process.argv[1]?.replaceAll("\\", "/")}`) {
  config({ quiet: true });
  const { mode, json } = parseArgs(process.argv.slice(2));
  const result = verifyPublicProfileEnvironment({ mode });
  console.log(formatVerificationResult(result, json));
  process.exitCode = result.code === "READY" ? 0 : exitCodeFor(result.code);
}
