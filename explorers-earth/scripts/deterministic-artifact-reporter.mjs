import fs from "node:fs/promises";
import path from "node:path";

import { deterministicFailureArtifactName } from "./playwright-artifact-name.mjs";

function pngViewport(file) {
  return fs.readFile(file).then((buffer) => {
    const png = buffer.subarray(1, 4).toString("ascii") === "PNG";
    if (!png || buffer.length < 24) return undefined;
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }).catch(() => undefined);
}

export default class DeterministicArtifactReporter {
  constructor(options = {}) {
    this.outputDir = options.outputDir ?? path.join(
      process.cwd(), "test-results", "playwright", "deterministic", "failure-artifacts",
    );
  }

  async onTestEnd(test, result) {
    if (result.status === "passed" || result.status === "skipped") return;
    const attachments = (result.attachments ?? []).filter((attachment) => attachment.path);
    const screenshot = attachments.find((attachment) => attachment.name === "screenshot");
    const project = test.parent?.project?.() ?? {};
    const viewport = screenshot
      ? await pngViewport(screenshot.path)
      : undefined;
    const effectiveViewport = viewport ?? project.use?.viewport ?? { width: 0, height: 0 };
    const caseId = test.titlePath().join(" ");
    await fs.mkdir(this.outputDir, { recursive: true });

    for (const attachment of attachments) {
      const kind = attachment.name === "trace"
        ? "trace"
        : attachment.name === "screenshot"
          ? "screenshot"
          : undefined;
      if (!kind) continue;
      const fileName = deterministicFailureArtifactName({
        project: project.name ?? "deterministic",
        caseId,
        viewport: effectiveViewport,
        attempt: result.retry ?? 0,
        kind,
      });
      await fs.copyFile(attachment.path, path.join(this.outputDir, fileName));
    }
  }
}
