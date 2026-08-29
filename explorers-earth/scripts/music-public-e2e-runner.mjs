import { prepareMusicFixtureArtifacts, stopMusicFixture } from "./music-fixture-cleanup.mjs";

function restorationHash(restoration) {
  if (!restoration?.ok || typeof restoration.beforeHash !== "string" || restoration.beforeHash.length === 0
      || restoration.beforeHash !== restoration.afterHash) return undefined;
  return { cleanup: "restored", beforeHash: restoration.beforeHash, afterHash: restoration.afterHash };
}

function evidenceHash(evidence) {
  if (!evidence || typeof evidence !== "object" || typeof evidence.beforeHash !== "string"
      || typeof evidence.afterHash !== "string") return undefined;
  return { beforeHash: evidence.beforeHash, afterHash: evidence.afterHash };
}

export async function runMusicFixtureOrchestration({
  snapshotExists,
  baseReport,
  artifacts,
  restoreEvidence,
  execute,
  restore,
  teardown,
  writeReport,
  writeStdout,
  writeStderr,
}) {
  let setupOk = false;
  let executionStatus = 4;
  try {
    prepareMusicFixtureArtifacts(artifacts);
    setupOk = true;
    try {
      const status = await execute();
      executionStatus = Number.isInteger(status) ? status : 1;
    } catch {
      writeStderr("Live public Music E2E execution failed; details redacted.\n");
    }
  } catch {
    writeStderr("Live public Music E2E setup failed; details redacted.\n");
  }

  let restoration = { ok: false, cleanup: "restore-failed" };
  if (snapshotExists) {
    try { restoration = await restore(); } catch { restoration = { ok: false, cleanup: "restore-failed" }; }
  }
  const initialHash = restorationHash(restoration);

  let parsedEvidence = [];
  let evidenceParseFailed = false;
  if (setupOk) {
    try {
      if (restoreEvidence.exists(restoreEvidence.path)) {
        parsedEvidence = restoreEvidence.read(restoreEvidence.path).trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
      }
    } catch {
      evidenceParseFailed = true;
      writeStderr("Live public Music E2E restore evidence parsing failed; details redacted.\n");
    }
  }

  const allEvidenceVerified = parsedEvidence.every((entry) => entry?.cleanup === "restored"
    && typeof entry.beforeHash === "string" && entry.beforeHash.length > 0 && entry.beforeHash === entry.afterHash);
  let cleanup = initialHash && allEvidenceVerified && !evidenceParseFailed ? "restored" : (initialHash ? "evidence-missing" : "restore-failed");
  let teardownStatus = 1;
  try { teardownStatus = stopMusicFixture(teardown); } catch { teardownStatus = 1; }
  if (teardownStatus !== 0) cleanup = "teardown-failed";

  const restoreHashes = [initialHash, ...parsedEvidence.map(evidenceHash)]
    .filter(Boolean)
    .map(({ beforeHash, afterHash }) => ({ beforeHash, afterHash }));
  let report = {
    ...baseReport,
    result: executionStatus === 0 && cleanup === "restored" ? "passed" : "failed",
    cleanup,
    restoreHashes,
  };
  try {
    await writeReport(report);
  } catch {
    cleanup = cleanup === "restored" ? "evidence-missing" : cleanup;
    report = { ...report, result: "failed", cleanup };
    writeStderr("Live public Music E2E evidence report writing failed; details redacted.\n");
  }

  const exitCode = cleanup === "restored" ? executionStatus : 5;
  writeStdout(`${JSON.stringify(report)}\n`);
  return { exitCode, report, restoration, teardownStatus };
}
