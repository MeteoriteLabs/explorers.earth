import fs from "node:fs/promises";
import path from "node:path";

const secretPatterns = [
  /Bearer\s+[A-Za-z0-9._~+\/-]+/gi,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
  /(?:token|secret|password|authorization)\s*[=:]\s*[^\s,;]+/gi,
];

function escaped(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function redactProtectedText(value, secrets = []) {
  let result = String(value ?? "");
  for (const secret of secrets.filter(Boolean)) {
    result = result.replace(new RegExp(escaped(String(secret)), "g"), "[REDACTED]");
  }
  for (const pattern of secretPatterns) result = result.replace(pattern, "[REDACTED]");
  result = result.replace(/[A-Za-z]:[\\/][^\n\r"']+/g, "[REDACTED_PATH]");
  return result;
}

export function redactProtectedValue(value, secrets = [], key = "") {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactProtectedText(value, secrets);
  if (Array.isArray(value)) {
    return value.map((entry) => redactProtectedValue(entry, secrets));
  }
  if (typeof value !== "object") return value;

  const output = {};
  for (const [childKey, childValue] of Object.entries(value)) {
    if (childKey === "body" || childKey === "path") continue;
    output[childKey] = redactProtectedValue(childValue, secrets, childKey);
  }
  return output;
}

export async function writeProtectedReport(outputFile, value, secrets = []) {
  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  const safe = redactProtectedValue(value, secrets);
  await fs.writeFile(outputFile, `${JSON.stringify(safe, null, 2)}\n`, "utf8");
}
