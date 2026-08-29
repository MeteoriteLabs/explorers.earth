import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createConnection } from "node:net";
import { chmodSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { settleMusicFixture } from "./music-fixture-cleanup.mjs";

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
const externalUrl = process.env.PLAYWRIGHT_EXTERNAL_BASE_URL ?? (mode.lane === "live" ? "http://localhost:55173" : "http://127.0.0.1:5173");
const generatedNamespace = `e2e-public-music-${runId.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;
const username = process.env.MUSIC_E2E_ACCOUNT_USERNAME ?? (mode.lane === "live" ? `${generatedNamespace}-owner` : "not-configured");
const namespace = username.match(/^(e2e-public-music-[a-z0-9-]+)-owner$/)?.[1];
const accountDocumentId = process.env.MUSIC_E2E_ACCOUNT_DOCUMENT_ID ?? (namespace ? `${namespace}-account` : "not-configured");
const userDocumentId = process.env.MUSIC_E2E_USER_DOCUMENT_ID ?? (namespace ? `${namespace}-user` : "not-configured");
const fixtureVersion = process.env.MUSIC_E2E_FIXTURE_VERSION ?? "not-configured";
const configuredServiceOrigins = (process.env.MUSIC_E2E_SERVICE_ORIGINS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
const healthUrls = (process.env.MUSIC_E2E_HEALTH_URLS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
const namespaceResetConfirmation = process.env.MUSIC_E2E_NAMESPACE_RESET_CONFIRMATION;
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
  const fullSnapshotAuthority = strapiToken.length > 0 && loopbackHttp(strapiUrl)
    && namespaceResetConfirmation === "RESET_EXPLORERS_MUSIC_FIXTURE_NAMESPACE";
  const everyLoopback = [externalUrl, ...configuredServiceOrigins, ...healthUrls].every(loopbackHttp);
  if (process.env.MUSIC_E2E_LIVE_WRITE !== "true"
      || process.env.MUSIC_E2E_LIVE_WRITE_CONFIRMATION !== CONFIRMATION
      || fixtureVersion !== VERSION || !validIdentity || !fiveServices || !everyLoopback || !fullSnapshotAuthority) {
    process.stderr.write("Live public Music E2E refused: require MUSIC_E2E_LIVE_WRITE=true, exact confirmation, fixture version, namespaced account/document ID, loopback Strapi URL/token, five service loopback origins plus health URLs, and exact disposable namespace reset confirmation. Owner authority is minted only after callback bootstrap.\n");
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
const npmExecPath = process.env.npm_execpath;
if (!npmExecPath) {
  process.stderr.write("Live public Music E2E requires invocation through the documented npm script.\n");
  process.exit(4);
}
function runNpm(arguments_, options = {}) {
  return spawnSync(process.execPath, [npmExecPath, ...arguments_], { ...options, env: options.env ?? process.env });
}
let fixtureStarted = false;
let stateService;
let stateToken;
let authStatePath;
let profileStorageStatePath;
let initialSnapshot;
let initialRestoreEvidence;
let initialRestorePromise;
function stopFixture() {
  if (authStatePath && existsSync(authStatePath)) { unlinkSync(authStatePath); authStatePath = undefined; }
  if (profileStorageStatePath && existsSync(profileStorageStatePath)) { unlinkSync(profileStorageStatePath); profileStorageStatePath = undefined; }
  if (stateService) { stateService.kill(); stateService = undefined; }
  if (!fixtureStarted) return 0;
  fixtureStarted = false;
  return runNpm(["run", "--silent", "music-cli", "--", "down"], { cwd: monorepoRoot, stdio: "inherit" }).status ?? 1;
}
async function restoreInitialSnapshot() {
  if (initialRestorePromise) return initialRestorePromise;
  initialRestorePromise = (async () => {
    if (!initialSnapshot || !stateToken) return { ok: false, cleanup: "evidence-missing" };
    try {
    const response = await fetch(`${stateServiceUrl}/restore`, { method: "POST", headers: { Authorization: `Bearer ${stateToken}`, "content-type": "application/json" }, body: JSON.stringify(initialSnapshot), signal: AbortSignal.timeout(60_000) });
    if (!response.ok) return { ok: false, cleanup: "restore-failed" };
    const result = await response.json();
    const expected = initialSnapshot?.database?.dumpHash;
    const ok = typeof expected === "string" && result.beforeHash === expected && result.afterHash === expected;
    return { ok, cleanup: ok ? "restored" : "restore-failed", beforeHash: result.beforeHash, afterHash: result.afterHash };
    } catch { return { ok: false, cleanup: "restore-failed" }; }
  })();
  return initialRestorePromise;
}
function writeLiveFailureEvidence(cleanup) {
  const absoluteEvidence = path.resolve(evidencePath);
  mkdirSync(path.dirname(absoluteEvidence), { recursive: true });
  writeFileSync(absoluteEvidence, `${JSON.stringify({ ...baseReport, result: "failed", cleanup, restoreHashes: initialRestoreEvidence?.ok ? [{ beforeHash: initialRestoreEvidence.beforeHash, afterHash: initialRestoreEvidence.afterHash }] : [] }, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}
async function abortPostSnapshot(message) {
  const settled = await settleMusicFixture({ restore: restoreInitialSnapshot, parseEvidence: async () => [], teardown: stopFixture,
    writeEvidence: async ({ cleanup }) => writeLiveFailureEvidence(cleanup) });
  initialRestoreEvidence = settled.restoration;
  process.stderr.write(`${message}; details redacted.\n`);
  process.exit(4);
}
if (mode.lane === "live") {
  const authorityBootstrap = runNpm(["run", "--silent", "music-cli", "--", "bootstrap"], { cwd: monorepoRoot, stdio: "inherit", env: process.env });
  if (authorityBootstrap.status !== 0) process.exit(4);
  const bootstrap = runNpm(["run", "--silent", "music-cli", "--", "up", "--detach", "--wait"], { cwd: monorepoRoot, stdio: "inherit" });
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
  try {
    const snapshotResponse = await fetch(`${stateServiceUrl}/snapshot`, { method: "POST", headers: { Authorization: `Bearer ${stateToken}` }, signal: AbortSignal.timeout(60_000) });
    if (!snapshotResponse.ok) throw new Error("snapshot response was not successful");
    initialSnapshot = await snapshotResponse.json();
  } catch {
    process.stderr.write("Live public Music E2E preflight refused: initial full-state snapshot failed.\n");
    const teardownStatus = stopFixture();
    writeLiveFailureEvidence(teardownStatus === 0 ? "evidence-missing" : "teardown-failed");
    process.exit(4);
  }
  try {
    profileStorageStatePath = path.resolve(`.artifacts/music-public/${runId}/profile-storage-state.json`);
    mkdirSync(path.dirname(profileStorageStatePath), { recursive: true });
    writeFileSync(profileStorageStatePath, `${JSON.stringify({ cookies: [], origins: [] })}\n`, { encoding: "utf8", mode: 0o600 });
    chmodSync(profileStorageStatePath, 0o600);
  } catch { await abortPostSnapshot("Live public Music E2E setup failed"); }
  const playwrightCli = path.resolve("node_modules/@playwright/test/cli.js");
  const restoreEvidencePath = path.resolve(`.artifacts/music-public/${runId}/restore-evidence.jsonl`);
  const preflightEnvironment = { ...process.env, PLAYWRIGHT_EXTERNAL_BASE_URL: externalUrl, PLAYWRIGHT_PR_SAFE: "false", MUSIC_E2E_LIVE_WRITE: "true", MUSIC_E2E_RESTORE_EVIDENCE_PATH: restoreEvidencePath,
    E2E_PROFILE_LIVE_WRITES: "1", E2E_PROFILE_STORAGE_STATE: profileStorageStatePath, E2E_PROFILE_USERNAME: username };
  const tsxCli = path.resolve("node_modules/tsx/dist/cli.mjs");
  const authorityPreflight = spawnSync(process.execPath, [tsxCli, "-e", "import { musicLiveWriteSkipReason } from './e2e/setup/music.ts'; const reason=musicLiveWriteSkipReason(); if(reason) throw new Error(reason);"], { cwd: process.cwd(), encoding: "utf8", env: preflightEnvironment });
  const collectionPreflight = spawnSync(process.execPath, [playwrightCli, "test", `--project=${mode.project}`, "--list"], { cwd: process.cwd(), encoding: "utf8", env: preflightEnvironment });
  const requiredJourneys = ["owner publication", "guest request", "guest playback", "pairwise matrix batch 1/6", "pairwise matrix batch 6/6"];
  if (authorityPreflight.status !== 0 || collectionPreflight.status !== 0 || !requiredJourneys.every((title) => collectionPreflight.stdout.includes(title))) {
    process.stderr.write("Live public Music E2E preflight refused: authority was skipped or expected mutation journeys did not collect.\n");
    await abortPostSnapshot("Live public Music E2E preflight failed");
  }

  let browser;
  let mintedCredential = "";
  let callbackBootstrapError;
  try {
    const { chromium } = await import("@playwright/test");
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext(); const page = await context.newPage();
    const browserApiPrefix = `${new URL(externalUrl).origin}/api/`;
    page.on("request", (request) => {
      const authorization = request.headers().authorization;
      if (request.url().startsWith(browserApiPrefix) && authorization?.startsWith("Bearer ")
          && authorization !== `Bearer ${strapiToken}`) mintedCredential = authorization;
    });
    await page.goto(`${externalUrl}/google-auth/callback?access_token=${encodeURIComponent(strapiToken)}`, { waitUntil: "domcontentloaded" });
    await page.getByText("Login successful! Redirecting...").waitFor({ timeout: 30_000 });
    await page.goto(`${externalUrl}/recommendations/music`, { waitUntil: "domcontentloaded" });
    await page.getByRole("tab", { name: "Playlists", exact: true }).waitFor({ timeout: 30_000 });
    if (!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(mintedCredential)) throw new Error("callback did not mint owner Tunes authority");
    authStatePath = path.resolve(`.artifacts/music-public/${runId}/owner-auth.json`);
    mkdirSync(path.dirname(authStatePath), { recursive: true });
    writeFileSync(authStatePath, `${JSON.stringify({ ownerCredential: mintedCredential })}\n`, { encoding: "utf8", mode: 0o600 });
    chmodSync(authStatePath, 0o600);
    await context.storageState({ path: profileStorageStatePath });
    chmodSync(profileStorageStatePath, 0o600);
    process.env.MUSIC_E2E_AUTH_STATE_PATH = authStatePath;
    process.env.E2E_PROFILE_STORAGE_STATE = profileStorageStatePath;
  } catch (error) { callbackBootstrapError = error; }
  finally { if (browser) { try { await browser.close(); } catch { callbackBootstrapError ??= new Error("browser close failed"); } } }
  if (callbackBootstrapError) {
    process.stderr.write("Live public Music E2E callback bootstrap failed; details redacted.\n");
    await abortPostSnapshot("Live public Music E2E callback bootstrap failed");
  }

}

const playwrightCli = path.resolve("node_modules/@playwright/test/cli.js");
const args = [playwrightCli, "test", ...mode.files, `--project=${mode.project}`];
const restoreEvidencePath = path.resolve(`.artifacts/music-public/${runId}/restore-evidence.jsonl`);
const childEnvironment = {
  ...process.env,
  PLAYWRIGHT_EXTERNAL_BASE_URL: externalUrl,
  PLAYWRIGHT_PR_SAFE: mode.lane === "pr-safe" ? "true" : "false",
  MUSIC_E2E_LIVE_WRITE: mode.lane === "live" ? "true" : "false",
  MUSIC_E2E_RESTORE_EVIDENCE_PATH: restoreEvidencePath,
  ...(mode.lane === "live" ? {
    E2E_PROFILE_LIVE_WRITES: "1",
    E2E_PROFILE_STORAGE_STATE: profileStorageStatePath,
    E2E_PROFILE_USERNAME: username,
  } : {}),
};
const result = spawnSync(process.execPath, args, {
  cwd: process.cwd(),
  stdio: "inherit",
  env: childEnvironment,
});
let cleanup = "not-required";
let restoreHashes = [];
if (mode.lane === "live") {
  initialRestoreEvidence = await restoreInitialSnapshot();
  const globalRestoreOk = initialRestoreEvidence.ok;
  if (globalRestoreOk) restoreHashes.push({ cleanup: "restored", beforeHash: initialRestoreEvidence.beforeHash, afterHash: initialRestoreEvidence.afterHash });
  let evidenceParseFailed = false;
  try {
    if (existsSync(restoreEvidencePath)) restoreHashes.push(...readFileSync(restoreEvidencePath, "utf8").trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)));
  } catch { evidenceParseFailed = true; }
  const hashesVerified = globalRestoreOk && restoreHashes.length > 0 && restoreHashes.every((entry) => entry.cleanup === "restored" && entry.beforeHash === entry.afterHash);
  cleanup = hashesVerified && !evidenceParseFailed ? "restored" : (globalRestoreOk ? "evidence-missing" : "restore-failed");
  const teardownStatus = stopFixture();
  if (teardownStatus !== 0) cleanup = "teardown-failed";
  if (!hashesVerified || teardownStatus !== 0) process.exitCode = 5;
}
const passed = result.status === 0 && (cleanup === "not-required" || cleanup === "restored");
const report = { ...baseReport, result: passed ? "passed" : "failed", cleanup, restoreHashes: restoreHashes.map(({ beforeHash, afterHash }) => ({ beforeHash, afterHash })) };
const absoluteEvidence = path.resolve(evidencePath);
try {
  mkdirSync(path.dirname(absoluteEvidence), { recursive: true });
  writeFileSync(absoluteEvidence, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
} catch { process.exitCode ||= 5; }
process.stdout.write(`${JSON.stringify(report)}\n`);
process.exit(process.exitCode || result.status || 0);
