import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const VERSION = "music-public-e2e-fixture/v1";
const CONFIRMATION = "I_UNDERSTAND_THIS_MUTATES_A_DISPOSABLE_FIXTURE";
const MODES = {
  fast: { lane: "pr-safe", project: "chromium-pr-safe", files: ["e2e/music-harness-contract.spec.ts", "e2e/music-fullstack.spec.ts"] },
  pr: { lane: "pr-safe", project: "chromium-pr-safe", files: [
    "e2e/analytics.spec.ts",
    "e2e/music-public-contract.spec.ts",
    "e2e/music-fullstack.spec.ts",
    "e2e/music-accessibility.spec.ts",
    "e2e/profile-theme.spec.ts",
    "e2e/profile-presentation-visual.spec.ts",
    "e2e/music-harness-contract.spec.ts",
  ] },
  e2e: { lane: "fixture", project: "chromium-music-fixture", files: [] },
  live: { lane: "live", project: "chromium-music-live", files: [] },
  verify: { lane: "fixture", project: "chromium-pr-safe", files: ["e2e/music-harness-contract.spec.ts"] },
};

const modeName = process.argv[2] ?? "verify";
const dryRun = process.argv.includes("--dry-run");
const mode = MODES[modeName];
if (!mode) {
  process.stderr.write(`Unknown public Music test mode: ${modeName}\n`);
  process.exit(2);
}

const runId = (process.env.MUSIC_PUBLIC_RUN_ID ?? new Date().toISOString().replace(/\D/g, "")).replace(/[^a-zA-Z0-9_-]/g, "-");
const evidencePath = `.artifacts/music-public/${runId}/evidence.json`;
const externalUrl = process.env.PLAYWRIGHT_EXTERNAL_BASE_URL ?? "http://127.0.0.1:5173";
const accountDocumentId = process.env.MUSIC_E2E_ACCOUNT_DOCUMENT_ID ?? "not-configured";
const username = process.env.MUSIC_E2E_ACCOUNT_USERNAME ?? "not-configured";
const fixtureVersion = process.env.MUSIC_E2E_FIXTURE_VERSION ?? "not-configured";
const configuredServiceOrigins = (process.env.MUSIC_E2E_SERVICE_ORIGINS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
const healthUrls = (process.env.MUSIC_E2E_HEALTH_URLS ?? "").split(",").map((value) => value.trim()).filter(Boolean);

function loopbackHttp(raw) {
  try {
    const url = new URL(raw);
    return url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}

if (mode.lane === "live") {
  const namespaceMatch = username.match(/^(e2e-public-music-[a-z0-9-]+)-owner$/);
  const validIdentity = namespaceMatch && accountDocumentId === `${namespaceMatch[1]}-account`;
  const fiveServices = configuredServiceOrigins.length === 5 && healthUrls.length === 5;
  const everyLoopback = [externalUrl, ...configuredServiceOrigins, ...healthUrls].every(loopbackHttp);
  if (process.env.MUSIC_E2E_LIVE_WRITE !== "true"
      || process.env.MUSIC_E2E_LIVE_WRITE_CONFIRMATION !== CONFIRMATION
      || fixtureVersion !== VERSION || !validIdentity || !fiveServices || !everyLoopback) {
    process.stderr.write("Live public Music E2E refused: require MUSIC_E2E_LIVE_WRITE=true, exact confirmation, fixture version, namespaced account/document ID, and five service loopback origins plus health URLs.\n");
    process.exit(3);
  }
}

const baseReport = {
  version: VERSION,
  runId,
  lane: mode.lane,
  fixtureVersion,
  accountDocumentId,
  username,
  services: configuredServiceOrigins.length > 0 ? configuredServiceOrigins : [externalUrl, process.env.MUSIC_API_BASE_URL ?? "http://127.0.0.1:3001"],
  evidencePath,
};

if (dryRun) {
  process.stdout.write(`${JSON.stringify({ ...baseReport, result: "dry-run", cleanup: "not-required" })}\n`);
  process.exit(0);
}

const monorepoRoot = path.resolve("..");
const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";
let fixtureStarted = false;
function stopFixture() {
  if (!fixtureStarted) return 0;
  fixtureStarted = false;
  return spawnSync(npmExecutable, ["run", "--silent", "music-cli", "--", "down"], { cwd: monorepoRoot, stdio: "inherit" }).status ?? 1;
}
if (mode.lane === "live") {
  const bootstrap = spawnSync(npmExecutable, ["run", "--silent", "music-cli", "--", "up"], { cwd: monorepoRoot, stdio: "inherit" });
  if (bootstrap.status !== 0) process.exit(4);
  fixtureStarted = true;
  for (const healthUrl of healthUrls) {
    let response;
    try { response = await fetch(healthUrl, { signal: AbortSignal.timeout(5_000) }); } catch (error) {
      process.stderr.write(`Live public Music E2E health check failed for ${new URL(healthUrl).origin}: ${error instanceof Error ? error.message : "unavailable"}\n`);
      stopFixture();
      process.exit(4);
    }
    if (!response.ok) {
      process.stderr.write(`Live public Music E2E health check returned ${response.status} for ${new URL(healthUrl).origin}.\n`);
      stopFixture();
      process.exit(4);
    }
  }
}

const playwrightCli = path.resolve("node_modules/@playwright/test/cli.js");
const args = [playwrightCli, "test", ...mode.files, `--project=${mode.project}`];
const restoreEvidencePath = path.resolve(`.artifacts/music-public/${runId}/restore-evidence.jsonl`);
const result = spawnSync(process.execPath, args, {
  cwd: process.cwd(),
  stdio: "inherit",
  env: {
    ...process.env,
    PLAYWRIGHT_PR_SAFE: mode.lane === "pr-safe" ? "true" : "false",
    MUSIC_E2E_LIVE_WRITE: mode.lane === "live" ? "true" : "false",
    MUSIC_E2E_RESTORE_EVIDENCE_PATH: restoreEvidencePath,
  },
});
let cleanup = "not-required";
let restoreHashes = [];
if (mode.lane === "live") {
  if (existsSync(restoreEvidencePath)) {
    restoreHashes = readFileSync(restoreEvidencePath, "utf8").trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  }
  const hashesVerified = restoreHashes.length > 0 && restoreHashes.every((entry) => entry.cleanup === "restored" && entry.beforeHash === entry.afterHash);
  cleanup = hashesVerified ? "restored" : "failed";
  const teardownStatus = stopFixture();
  if (!hashesVerified || teardownStatus !== 0) process.exitCode = 5;
}
const passed = result.status === 0 && cleanup !== "failed";
const report = { ...baseReport, result: passed ? "passed" : "failed", cleanup, restoreHashes: restoreHashes.map(({ beforeHash, afterHash }) => ({ beforeHash, afterHash })) };
const absoluteEvidence = path.resolve(evidencePath);
mkdirSync(path.dirname(absoluteEvidence), { recursive: true });
writeFileSync(absoluteEvidence, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
process.stdout.write(`${JSON.stringify(report)}\n`);
process.exit(process.exitCode || result.status || 0);
