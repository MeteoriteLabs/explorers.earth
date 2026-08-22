import assert from "node:assert/strict";
import test from "node:test";

import { createVerificationResult, exitCodeFor } from "../lib/verificationResult.mjs";

test("creates a redacted machine-readable failure envelope", () => {
  const result = createVerificationResult({
    code: "ENV_MISSING",
    summary: "Public read credentials are missing.",
    safeContext: { source: "none", authorization: "Bearer private-value" },
    remediation: "Set VITE_PUBLIC_READ_ACCESS_TOKEN in the protected environment.",
  });

  assert.deepEqual(result, {
    code: "ENV_MISSING",
    summary: "Public read credentials are missing.",
    safeContext: { source: "none", authorization: "[REDACTED]" },
    remediation: "Set VITE_PUBLIC_READ_ACCESS_TOKEN in the protected environment.",
  });
  assert.equal(exitCodeFor(result.code), 20);
});
