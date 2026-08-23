import { VERIFICATION_EXIT_CODES } from "./stableVerificationCodes.mjs";

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
  return VERIFICATION_EXIT_CODES[code] ?? 1;
}

export function formatVerificationResult(result, json = false) {
  if (json) return JSON.stringify(result);
  return `${result.summary}\nCode: ${result.code}\nObserved: ${JSON.stringify(result.safeContext)}\nRemediation: ${result.remediation}`;
}
