const EXIT_CODES = {
  ENV_MISSING: 20,
  ACCOUNT_MARKER_MISMATCH: 21,
  PUBLIC_READ_UNAUTHORIZED: 22,
  LIVE_WRITE_NOT_APPROVED: 23,
  RESTORE_FAILED: 24,
  ANALYTICS_CLEANUP_FAILED: 25,
  PUBLIC_API_TRANSPORT_ERROR: 30,
  PUBLIC_READ_FORBIDDEN: 31,
  PUBLIC_API_MALFORMED: 32,
  CONTROLLED_FIXTURE_REQUIRED: 33,
  PUBLIC_CAPABILITY_BOUNDARY_BROKEN: 34,
  SECURITY_PROOF_MISSING: 35,
  ANALYTICS_CANARY_REQUIRED: 36,
};

const SENSITIVE_KEY = /authorization|token|secret|password|payload|storage/i;

function redact(value, key = "") {
  if (SENSITIVE_KEY.test(key)) return "[REDACTED]";
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, redact(item, name)]));
  }
  return value;
}

export function createVerificationResult({ code, summary, safeContext = {}, remediation, artifactPath }) {
  return {
    code,
    summary,
    safeContext: redact(safeContext),
    remediation,
    ...(artifactPath ? { artifactPath } : {}),
  };
}

export function exitCodeFor(code) {
  return EXIT_CODES[code] ?? 1;
}

export function formatVerificationResult(result, json = false) {
  if (json) return JSON.stringify(result);
  return `${result.summary}\nCode: ${result.code}\nObserved: ${JSON.stringify(result.safeContext)}\nRemediation: ${result.remediation}`;
}
