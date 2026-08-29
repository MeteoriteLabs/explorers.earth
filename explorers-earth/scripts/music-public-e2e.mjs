import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createConnection } from "node:net";
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
const generatedNamespace = `e2e-public-music-${runId.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;
const username = process.env.MUSIC_E2E_ACCOUNT_USERNAME ?? (mode.lane === "live" ? `${generatedNamespace}-owner` : "not-configured");
const namespace = username.match(/^(e2e-public-music-[a-z0-9-]+)-owner$/)?.[1];
const accountDocumentId = process.env.MUSIC_E2E_ACCOUNT_DOCUMENT_ID ?? (namespace ? `${namespace}-account` : "not-configured");
const userDocumentId = process.env.MUSIC_E2E_USER_DOCUMENT_ID ?? (namespace ? `${namespace}-user` : "not-configured");
const fixtureVersion = process.env.MUSIC_E2E_FIXTURE_VERSION ?? "not-configured";
const configuredServiceOrigins = (process.env.MUSIC_E2E_SERVICE_ORIGINS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
const healthUrls = (process.env.MUSIC_E2E_HEALTH_URLS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
const namespaceResetConfirmation = process.env.MUSIC_E2E_NAMESPACE_RESET_CONFIRMATION;
const ownerCredential = process.env.MUSIC_E2E_OWNER_CREDENTIAL ?? "";
const strapiUrl = process.env.MUSIC_E2E_STRAPI_URL ?? (mode.lane === "live" ? "http://127.0.0.1:51337" : "");
const strapiToken = process.env.MUSIC_E2E_STRAPI_TOKEN ?? (mode.lane === "live" ? randomBytes(32).toString("base64url") : "");
const stateServiceUrl = "http://127.0.0.1:55174";

function loopbackHttp(raw) {
  try {
    const url = new URL(raw);
    return ["http:", "tcp:"].includes(url.protocol) && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}

if (mode.lane === "live") {
  Object.assign(process.env, { MUSIC_E2E_ACCOUNT_USERNAME: username, MUSIC_E2E_ACCOUNT_DOCUMENT_ID: accountDocumentId,
    MUSIC_E2E_USER_DOCUMENT_ID: userDocumentId, MUSIC_E2E_STRAPI_URL: strapiUrl, MUSIC_E2E_STRAPI_TOKEN: strapiToken });
  const namespaceMatch = username.match(/^(e2e-public-music-[a-z0-9-]+)-owner$/);
  const validIdentity = namespaceMatch && accountDocumentId === `${namespaceMatch[1]}-account`;
  const fiveServices = configuredServiceOrigins.length === 5 && healthUrls.length === 5;
  const fullSnapshotAuthority = ownerCredential.startsWith("Bearer ") && strapiToken.length > 0 && loopbackHttp(strapiUrl)
    && namespaceResetConfirmation === "RESET_EXPLORERS_MUSIC_FIXTURE_NAMESPACE";
  const everyLoopback = [externalUrl, ...configuredServiceOrigins, ...healthUrls].every(loopbackHttp);
  if (process.env.MUSIC_E2E_LIVE_WRITE !== "true"
      || process.env.MUSIC_E2E_LIVE_WRITE_CONFIRMATION !== CONFIRMATION
      || fixtureVersion !== VERSION || !validIdentity || !fiveServices || !everyLoopback || !fullSnapshotAuthority) {
    process.stderr.write("Live public Music E2E refused: require MUSIC_E2E_LIVE_WRITE=true, exact confirmation, fixture version, namespaced account/document ID, owner credential, loopback Strapi URL/token, five service loopback origins plus health URLs, and exact disposable namespace reset confirmation.\n");
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
let stateService;
let stateToken;
function stopFixture() {
  if (stateService) { stateService.kill(); stateService = undefined; }
  if (!fixtureStarted) return 0;
  fixtureStarted = false;
  return spawnSync(npmExecutable, ["run", "--silent", "music-cli", "--", "down"], { cwd: monorepoRoot, stdio: "inherit" }).status ?? 1;
}
if (mode.lane === "live") {
  const bootstrap = spawnSync(npmExecutable, ["run", "--silent", "music-cli", "--", "up"], { cwd: monorepoRoot, stdio: "inherit" });
  if (bootstrap.status !== 0) process.exit(4);
  fixtureStarted = true;
  stateToken = randomBytes(32).toString("base64url");
  stateService = spawn(process.execPath, ["tunes/scripts/music-e2e-state-service.mjs"], {
    cwd: monorepoRoot,
    stdio: ["ignore", "pipe", "inherit"],
    env: { ...process.env, MUSIC_E2E_STATE_TOKEN: stateToken },
  });
  for (const healthUrl of healthUrls) {
    if (healthUrl.startsWith(stateServiceUrl)) continue; // polled below with bounded startup retries
    let response;
    try {
      const endpoint = new URL(healthUrl);
      if (endpoint.protocol === "tcp:") {
        await new Promise((resolve, reject) => {
          const socket = createConnection({ host: endpoint.hostname, port: Number(endpoint.port) }, () => { socket.destroy(); resolve(); });
          socket.setTimeout(5_000, () => { socket.destroy(); reject(new Error("TCP health timeout")); });
          socket.once("error", reject);
        });
        continue;
      }
      response = await fetch(healthUrl, { headers: healthUrl.startsWith(stateServiceUrl) ? { Authorization: `Bearer ${stateToken}` } : {}, signal: AbortSignal.timeout(5_000) });
    } catch (error) {
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
  let stateReady = false;
  for (let attempt = 0; attempt < 30 && !stateReady; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    try {
      const response = await fetch(`${stateServiceUrl}/health`, { headers: { Authorization: `Bearer ${stateToken}` }, signal: AbortSignal.timeout(1_000) });
      stateReady = response.ok;
    } catch { /* service is still starting */ }
  }
  if (!stateReady) {
    process.stderr.write("Live public Music E2E state service failed its loopback health check.\n");
    stopFixture();
    process.exit(4);
  }
  try {
    const [accountResponse, identityResponse] = await Promise.all([
      fetch(`${strapiUrl}/api/accounts/${encodeURIComponent(accountDocumentId)}`, { headers: { Authorization: `Bearer ${strapiToken}` }, signal: AbortSignal.timeout(5_000) }),
      fetch(`${strapiUrl}/api/users/me`, { headers: { Authorization: `Bearer ${strapiToken}` }, signal: AbortSignal.timeout(5_000) }),
    ]);
    const account = await accountResponse.json(); const identity = await identityResponse.json();
    if (!accountResponse.ok || !identityResponse.ok || account.data?.documentId !== accountDocumentId
        || identity.username !== username || identity.documentId !== userDocumentId
        || identity.accounts?.[0]?.documentId !== accountDocumentId) throw new Error("fixture projected a different identity");
  } catch (error) {
    process.stderr.write(`Live public Music E2E identity readiness failed: ${error instanceof Error ? error.message : "unavailable"}\n`);
    stopFixture(); process.exit(4);
  }
  process.env.MUSIC_E2E_STATE_SERVICE_URL = stateServiceUrl;
  process.env.MUSIC_E2E_STATE_TOKEN = stateToken;
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
  let globalRestoreOk = false;
  try {
    const globalRestore = await fetch(`${stateServiceUrl}/restore-all`, { method: "POST", headers: { Authorization: `Bearer ${stateToken}` }, signal: AbortSignal.timeout(60_000) });
    globalRestoreOk = globalRestore.ok;
  } catch { globalRestoreOk = false; }
  if (existsSync(restoreEvidencePath)) {
    restoreHashes = readFileSync(restoreEvidencePath, "utf8").trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  }
  const hashesVerified = globalRestoreOk && restoreHashes.length > 0 && restoreHashes.every((entry) => entry.cleanup === "restored" && entry.beforeHash === entry.afterHash);
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
