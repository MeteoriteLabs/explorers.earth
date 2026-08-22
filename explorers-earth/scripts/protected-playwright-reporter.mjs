import fs from "node:fs/promises";
import path from "node:path";

import {
  writeProtectedReport,
} from "./protected-playwright-report.mjs";

function configuredSecrets(env = process.env) {
  return Object.entries(env)
    .filter(([name, value]) => value && /TOKEN|SECRET|PASSWORD|USERNAME|STORAGE_STATE|CONFIRMATION/.test(name))
    .map(([, value]) => value);
}

export default class ProtectedPlaywrightReporter {
  constructor(options = {}) {
    this.outputFile = options.outputFile ?? path.join(
      process.cwd(), "test-results", "playwright", "real-account-redacted", "summary.json",
    );
    this.secrets = options.secrets ?? configuredSecrets();
    this.writeStdout = options.writeStdout ?? ((chunk) => process.stdout.write(chunk));
    this.artifactRoot = path.resolve(options.artifactRoot ?? process.cwd());
    this.results = [];
    this.runId = options.runId ?? process.env.PUBLIC_API_RUN_ID;
  }

  onStdOut() {
    // Protected stdout can contain arbitrary DOM, account, and error payloads.
    // It is intentionally suppressed rather than serialized and redacted.
  }

  onStdErr() {
    // See onStdOut: allowlist-by-construction means no arbitrary text leaves the run.
  }

  onBegin(_config, suite) {
    this.writeStdout(`[protected] ${suite.allTests().length} test(s); arbitrary output suppressed\n`);
  }

  async onTestEnd(test, result) {
    for (const attachment of result.attachments ?? []) {
      if (!attachment.path) continue;
      const resolved = path.resolve(attachment.path);
      if (resolved.startsWith(`${this.artifactRoot}${path.sep}`)) {
        await fs.rm(resolved, { force: true });
      }
    }

    const requestedOperation = test.annotations?.find(
      (annotation) => annotation.type === "operation",
    )?.description;
    this.results.push({
      code: result.status === "passed"
        ? "PROTECTED_TEST_PASSED"
        : result.status === "skipped"
          ? "PROTECTED_TEST_SKIPPED"
          : "PROTECTED_TEST_FAILED",
      status: result.status,
      operation: requestedOperation,
    });
  }

  async onEnd(result) {
    await writeProtectedReport(this.outputFile, {
      code: "PROTECTED_RUN_COMPLETE",
      runId: this.runId,
      status: result.status,
      tests: this.results,
    }, this.secrets);
  }
}
