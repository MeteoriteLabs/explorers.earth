import fs from "node:fs/promises";
import path from "node:path";

import {
  redactProtectedText,
  redactProtectedValue,
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
  }

  onStdOut(chunk) {
    this.writeStdout(redactProtectedText(chunk.toString(), this.secrets));
  }

  onStdErr(chunk) {
    this.writeStdout(redactProtectedText(chunk.toString(), this.secrets));
  }

  onBegin(_config, suite) {
    for (const test of suite.allTests()) {
      const projectName = test.parent?.project?.()?.name ?? "real-account";
      const location = test.location
        ? `${path.basename(test.location.file)}:${test.location.line}`
        : "protected";
      this.writeStdout(redactProtectedText(
        `[${projectName}] ${location} › ${test.titlePath().join(" › ")}\n`,
        this.secrets,
      ));
    }
  }

  async onTestEnd(test, result) {
    for (const attachment of result.attachments ?? []) {
      if (!attachment.path) continue;
      const resolved = path.resolve(attachment.path);
      if (resolved.startsWith(`${this.artifactRoot}${path.sep}`)) {
        await fs.rm(resolved, { force: true });
      }
    }

    this.results.push(redactProtectedValue({
      title: test.titlePath().join(" > "),
      status: result.status,
      retry: result.retry,
      errors: result.errors,
      attachments: (result.attachments ?? []).map((attachment) => ({
        name: "[REDACTED_ATTACHMENT]",
        contentType: attachment.contentType,
      })),
    }, this.secrets));
  }

  async onEnd(result) {
    await writeProtectedReport(this.outputFile, {
      status: result.status,
      tests: this.results,
    }, this.secrets);
  }
}
