import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
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

if (mode.lane === "live") {
  const url = new URL(externalUrl);
  const disposable = url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if (!disposable || process.env.MUSIC_E2E_LIVE_WRITE_CONFIRMATION !== CONFIRMATION) {
    process.stderr.write("Live public Music E2E refused: use a disposable loopback fixture and exact confirmation.\n");
    process.exit(3);
  }
}

const baseReport = {
  version: VERSION,
  runId,
  lane: mode.lane,
  services: { explorers: externalUrl, localTunes: process.env.MUSIC_API_BASE_URL ?? "http://127.0.0.1:3001", postgres: "fixture-owned" },
  evidencePath,
};

if (dryRun) {
  process.stdout.write(`${JSON.stringify({ ...baseReport, result: "dry-run", cleanup: "not-required" })}\n`);
  process.exit(0);
}

const playwrightCli = path.resolve("node_modules/@playwright/test/cli.js");
const args = [playwrightCli, "test", ...mode.files, `--project=${mode.project}`];
const result = spawnSync(process.execPath, args, {
  cwd: process.cwd(),
  stdio: "inherit",
  env: {
    ...process.env,
    PLAYWRIGHT_PR_SAFE: mode.lane === "pr-safe" ? "true" : "false",
    MUSIC_E2E_LIVE_WRITE: mode.lane === "live" ? "true" : "false",
  },
});
const passed = result.status === 0;
const report = { ...baseReport, result: passed ? "passed" : "failed", cleanup: mode.lane === "live" ? "restoration-required" : "not-required" };
const absoluteEvidence = path.resolve(evidencePath);
mkdirSync(path.dirname(absoluteEvidence), { recursive: true });
writeFileSync(absoluteEvidence, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
process.stdout.write(`${JSON.stringify(report)}\n`);
process.exit(result.status ?? 1);
