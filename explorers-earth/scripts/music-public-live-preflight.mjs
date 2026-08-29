import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const LIVE_JOURNEY_MANIFEST_VERSION = "explorers-live-mutation-journeys/v1";
export const LIVE_JOURNEY_RESULT_VERSION = "explorers-live-mutation-journey-result/v1";

export const LIVE_JOURNEY_MANIFEST = Object.freeze([
  { id: "music.owner.queue-add", title: "authenticated owner queue mutation reaches the branch-local Tunes fixture through the fixture browser origin", source: "e2e/music-fixture-fullstack.spec.ts" },
  { id: "music.owner.mobile-workspace", title: "full owner workspace remains usable at a mobile viewport", source: "e2e/music-fixture-fullstack.spec.ts" },
  { id: "music.owner-guest.permission.allow-song-requests", title: "live owner/guest toggle allowSongRequests restores the exact permission snapshot", source: "e2e/music-public-contract.spec.ts" },
  { id: "music.owner-guest.permission.allow-guest-play-on-device", title: "live owner/guest toggle allowGuestPlayOnDevice restores the exact permission snapshot", source: "e2e/music-public-contract.spec.ts" },
  { id: "music.owner-guest.permission.allow-playlist-sharing", title: "live owner/guest toggle allowPlaylistSharing restores the exact permission snapshot", source: "e2e/music-public-contract.spec.ts" },
  { id: "music.owner-guest.permission.allow-recently-played-visibility", title: "live owner/guest toggle allowRecentlyPlayedVisibility restores the exact permission snapshot", source: "e2e/music-public-contract.spec.ts" },
  { id: "music.owner-guest.permission.allow-queue-visibility", title: "live owner/guest toggle allowQueueVisibility restores the exact permission snapshot", source: "e2e/music-public-contract.spec.ts" },
  { id: "music.owner-guest.reconnect", title: "live guest reconnect refetches canonical state after transport interruption", source: "e2e/music-public-contract.spec.ts" },
  { id: "music.guest.request-lifecycle", title: "live guest request accepts once, replays, conflicts, rate-limits, and owner revokes it", source: "e2e/music-public-contract.spec.ts" },
  { id: "music.guest.playback-second-guest", title: "live guest playback remains isolated while queue and player revisions refetch", source: "e2e/music-public-contract.spec.ts" },
  { id: "music.owner.publication-playlist-sharing", title: "owner publication, playlist visibility, and playlist-sharing settings persist and control fixture public access", source: "e2e/music-public-contract.spec.ts" },
  { id: "profile.owner.pairwise.batch-01", title: "publishes pairwise matrix batch 1/6 and restores exact raw social_media", source: "e2e/profile-theme.spec.ts" },
  { id: "profile.owner.pairwise.batch-02", title: "publishes pairwise matrix batch 2/6 and restores exact raw social_media", source: "e2e/profile-theme.spec.ts" },
  { id: "profile.owner.pairwise.batch-03", title: "publishes pairwise matrix batch 3/6 and restores exact raw social_media", source: "e2e/profile-theme.spec.ts" },
  { id: "profile.owner.pairwise.batch-04", title: "publishes pairwise matrix batch 4/6 and restores exact raw social_media", source: "e2e/profile-theme.spec.ts" },
  { id: "profile.owner.pairwise.batch-05", title: "publishes pairwise matrix batch 5/6 and restores exact raw social_media", source: "e2e/profile-theme.spec.ts" },
  { id: "profile.owner.pairwise.batch-06", title: "publishes pairwise matrix batch 6/6 and restores exact raw social_media", source: "e2e/profile-theme.spec.ts" },
]);

const PROFILE_FACTORS = Object.freeze({
  preset: Object.freeze(["cinematic-dark", "glassmorphism", "sunset-glow", "minimal-light", "emerald-nature", "neon-cyber"]),
  accent: Object.freeze(["#10B981", "#38BDF8", "#EC4899", "#8B5CF6", "#F59E0B", "#F43F5E"]),
  wallpaper: Object.freeze(["banner-top", "full-wallpaper-image", "ambient-gradient", "solid-color"]),
  firstView: Object.freeze(["all-recommendations", "places", "music", "movies", "books", "games", "guides", "apps", "products", "people", "gallery", "business"]),
  layout: Object.freeze(["shelves", "grid", "featured"]),
  orderShape: Object.freeze(["canonical", "reverse", "rotate", "preferred-first"]),
});
const PROFILE_FACTOR_NAMES = Object.freeze(Object.keys(PROFILE_FACTORS));

function factorPair(leftName, leftValue, rightName, rightValue) {
  return `${leftName}=${leftValue}|${rightName}=${rightValue}`;
}

function rowFactorPairs(row) {
  const pairs = [];
  for (let left = 0; left < PROFILE_FACTOR_NAMES.length; left += 1) {
    for (let right = left + 1; right < PROFILE_FACTOR_NAMES.length; right += 1) {
      const leftName = PROFILE_FACTOR_NAMES[left];
      const rightName = PROFILE_FACTOR_NAMES[right];
      pairs.push(factorPair(leftName, row[leftName], rightName, row[rightName]));
    }
  }
  return pairs;
}

function requiredProfileFactorPairs() {
  const required = new Set();
  for (let left = 0; left < PROFILE_FACTOR_NAMES.length; left += 1) {
    for (let right = left + 1; right < PROFILE_FACTOR_NAMES.length; right += 1) {
      const leftName = PROFILE_FACTOR_NAMES[left];
      const rightName = PROFILE_FACTOR_NAMES[right];
      for (const leftValue of PROFILE_FACTORS[leftName]) {
        for (const rightValue of PROFILE_FACTORS[rightName]) {
          required.add(factorPair(leftName, leftValue, rightName, rightValue));
        }
      }
    }
  }
  return required;
}

function allProfileRows() {
  const rows = [];
  const visit = (index, partial) => {
    if (index === PROFILE_FACTOR_NAMES.length) {
      rows.push(partial);
      return;
    }
    const name = PROFILE_FACTOR_NAMES[index];
    for (const value of PROFILE_FACTORS[name]) visit(index + 1, { ...partial, [name]: value });
  };
  visit(0, {});
  return rows;
}

export function buildProfileCoveringRows() {
  const candidates = allProfileRows().map((row) => ({ row, pairs: rowFactorPairs(row) }));
  const uncovered = requiredProfileFactorPairs();
  const selected = [];
  while (uncovered.size > 0) {
    let bestIndex = -1;
    let bestScore = -1;
    for (let index = 0; index < candidates.length; index += 1) {
      const score = candidates[index].pairs.reduce((total, pair) => total + Number(uncovered.has(pair)), 0);
      if (score > bestScore) {
        bestIndex = index;
        bestScore = score;
      }
    }
    if (bestIndex < 0 || bestScore <= 0) throw new Error("Profile covering rows could not cover every required pair");
    const [best] = candidates.splice(bestIndex, 1);
    selected.push(best.row);
    for (const pair of best.pairs) uncovered.delete(pair);
  }
  return selected;
}

export function profileFactorPairs(rows) {
  return new Set(rows.flatMap(rowFactorPairs));
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map((entry) => canonicalValue(entry));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => [key, canonicalValue(value[key])]));
  }
  return value;
}

export function canonicalEvidenceHash(value) {
  return createHash("sha256").update(JSON.stringify(canonicalValue(value))).digest("hex");
}

export function resolveDeclaredTsxCli({ packageJsonUrl = new URL("../../package.json", import.meta.url) } = {}) {
  const packageJsonPath = fileURLToPath(packageJsonUrl);
  const manifest = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  if (!manifest.dependencies?.tsx && !manifest.devDependencies?.tsx && !manifest.optionalDependencies?.tsx) {
    const error = new Error("The declaring package does not declare tsx");
    error.code = "TSX_NOT_DECLARED";
    throw error;
  }
  return createRequire(packageJsonPath).resolve("tsx/cli");
}

function normalizeSource(file) {
  const normalized = String(file ?? "").replace(/\\/g, "/");
  const e2eIndex = normalized.lastIndexOf("/e2e/");
  if (e2eIndex >= 0) return normalized.slice(e2eIndex + 1);
  return normalized.startsWith("e2e/") ? normalized : `e2e/${normalized.replace(/^\/+/, "")}`;
}

function specResult(spec) {
  const test = Array.isArray(spec.tests) ? spec.tests[0] : undefined;
  const annotations = Array.isArray(test?.annotations) ? test.annotations : [];
  const skip = annotations.find((annotation) => annotation?.type === "skip");
  const results = Array.isArray(test?.results) ? test.results : [];
  return {
    title: String(spec.title ?? ""),
    source: normalizeSource(spec.file),
    skipReason: skip ? (typeof skip.description === "string" && skip.description ? skip.description : "skipped") : null,
    status: typeof results.at(-1)?.status === "string" ? results.at(-1).status : null,
  };
}

export function extractCollectedLiveJourneys(report) {
  const parsed = typeof report === "string" ? JSON.parse(report) : report;
  if (!parsed || !Array.isArray(parsed.suites)) throw new Error("Playwright collection report did not contain suites");
  const collected = [];
  for (const fileSuite of parsed.suites) {
    const source = normalizeSource(fileSuite.file ?? fileSuite.title);
    if (source === "e2e/music-fixture-fullstack.spec.ts" || source === "e2e/music-public-contract.spec.ts") {
      for (const spec of fileSuite.specs ?? []) collected.push(specResult({ ...spec, file: spec.file ?? source }));
    }
    if (source === "e2e/profile-theme.spec.ts") {
      for (const suite of fileSuite.suites ?? []) {
        if (suite.title !== "approved live profile writes") continue;
        for (const spec of suite.specs ?? []) collected.push(specResult({ ...spec, file: spec.file ?? source }));
      }
    }
  }
  return collected;
}

function manifestKey(entry) {
  return `${entry.source}\0${entry.title}`;
}

function journeyPresence(collected = []) {
  const present = new Set(collected.map(manifestKey));
  return LIVE_JOURNEY_MANIFEST.map((entry) => ({ id: entry.id, present: present.has(manifestKey(entry)) }));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function redactText(value, { knownSecrets, workspaceRoot }) {
  let sanitized = String(value ?? "");
  for (const secret of knownSecrets ?? []) {
    if (typeof secret === "string" && secret.length > 0) sanitized = sanitized.replace(new RegExp(escapeRegExp(secret), "gi"), "<redacted>");
  }
  sanitized = sanitized
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer <redacted>")
    .replace(/(access[_-]?token|capability|credential)(["']?\s*[:=]\s*["']?)([^\s&"',}]+)/gi, "$1$2<redacted>");
  if (typeof workspaceRoot === "string" && workspaceRoot.length > 0) {
    const variants = new Set([workspaceRoot, workspaceRoot.replace(/\\/g, "/"), workspaceRoot.replace(/\//g, "\\")]);
    for (const variant of variants) sanitized = sanitized.replace(new RegExp(escapeRegExp(variant), "gi"), "<workspace>");
  }
  return sanitized;
}

function boundedUtf8(value, maximumBytes = 4 * 1024) {
  const bytes = Buffer.from(value, "utf8");
  if (bytes.length <= maximumBytes) return { text: value, truncated: false };
  const suffix = Buffer.from("...[truncated]", "utf8");
  const prefix = bytes.subarray(0, maximumBytes - suffix.length).toString("utf8").replace(/\uFFFD$/u, "");
  return { text: `${prefix}${suffix.toString("utf8")}`, truncated: true };
}

function childDiagnostics(result, sanitization) {
  const rawStdout = String(result?.stdout ?? "");
  const rawStderr = String(result?.stderr ?? "");
  const stdout = boundedUtf8(redactText(rawStdout, sanitization));
  const stderr = boundedUtf8(redactText(rawStderr, sanitization));
  const errorCode = typeof result?.error?.code === "string" && /^[A-Z0-9_-]{1,64}$/i.test(result.error.code)
    ? result.error.code : null;
  const signal = typeof result?.signal === "string" && /^[A-Z0-9_-]{1,32}$/i.test(result.signal)
    ? result.signal : null;
  return {
    status: Number.isInteger(result?.status) ? result.status : null,
    errorCode,
    signal,
    stdoutBytes: Buffer.byteLength(rawStdout),
    stderrBytes: Buffer.byteLength(rawStderr),
    stdoutTruncated: stdout.truncated,
    stderrTruncated: stderr.truncated,
    stdout: stdout.text,
    stderr: stderr.text,
  };
}

function failedPreflight(subcheck, result, sanitization, collected, extra = {}) {
  return {
    ok: false,
    exitCode: 4,
    diagnostics: {
      failureStage: "preflight",
      subcheck,
      ...(result ? { child: childDiagnostics(result, sanitization) } : {}),
      journeyPresence: journeyPresence(collected),
      ...extra,
    },
  };
}

function manifestClassification(collected) {
  const expectedKeys = LIVE_JOURNEY_MANIFEST.map(manifestKey);
  const actualKeys = collected.map(manifestKey);
  const counts = new Map();
  for (const key of actualKeys) counts.set(key, (counts.get(key) ?? 0) + 1);
  const duplicateIds = LIVE_JOURNEY_MANIFEST.filter((entry) => (counts.get(manifestKey(entry)) ?? 0) > 1).map(({ id }) => id);
  if (duplicateIds.length > 0) return { subcheck: "manifest-duplicate", duplicateJourneyIds: duplicateIds };
  const expectedSet = new Set(expectedKeys);
  if (actualKeys.some((key) => !expectedSet.has(key))) return { subcheck: "manifest-unknown" };
  const actualSet = new Set(actualKeys);
  const missingJourneyIds = LIVE_JOURNEY_MANIFEST.filter((entry) => !actualSet.has(manifestKey(entry))).map(({ id }) => id);
  if (missingJourneyIds.length > 0) return { subcheck: "manifest-missing", missingJourneyIds };
  if (actualKeys.some((key, index) => key !== expectedKeys[index])) return { subcheck: "manifest-reordered" };
  const skippedJourneyIds = collected.flatMap((entry, index) => entry.skipReason === null ? [] : [LIVE_JOURNEY_MANIFEST[index].id]);
  if (skippedJourneyIds.length > 0) return { subcheck: "manifest-skipped", skippedJourneyIds };
  return undefined;
}

export function classifyLivePreflight({ authorityResult, collectionResult, workspaceRoot, knownSecrets = [] }) {
  const sanitization = { workspaceRoot, knownSecrets };
  if (authorityResult?.error || authorityResult?.signal || authorityResult?.status !== 0) {
    return failedPreflight("authority-process", authorityResult, sanitization, []);
  }
  let authority;
  try { authority = JSON.parse(String(authorityResult.stdout ?? "").trim()); } catch { /* classified below */ }
  if (!authority || authority.skipReason !== null) return failedPreflight("authority-semantic", authorityResult, sanitization, []);
  if (collectionResult?.error || collectionResult?.signal || collectionResult?.status !== 0) {
    return failedPreflight("collection-process", collectionResult, sanitization, []);
  }
  let collected;
  try { collected = extractCollectedLiveJourneys(collectionResult.stdout); } catch {
    return failedPreflight("collection-semantic", collectionResult, sanitization, []);
  }
  const manifestFailure = manifestClassification(collected);
  if (manifestFailure) {
    const { subcheck, ...extra } = manifestFailure;
    return failedPreflight(subcheck, collectionResult, sanitization, collected, extra);
  }
  return {
    ok: true,
    exitCode: 0,
    manifestVersion: LIVE_JOURNEY_MANIFEST_VERSION,
    journeyIds: LIVE_JOURNEY_MANIFEST.map(({ id }) => id),
  };
}

const AUTHORITY_EVALUATION = "import { musicLiveWriteSkipReason } from './e2e/setup/music.ts'; const skipReason=musicLiveWriteSkipReason(); process.stdout.write(JSON.stringify({skipReason}));";

export function runLivePreflight({
  spawn,
  processExecPath,
  tsxCli,
  playwrightCli,
  project,
  cwd,
  environment,
  workspaceRoot,
  knownSecrets = [],
}) {
  let resolvedTsxCli = tsxCli;
  if (!resolvedTsxCli) {
    try { resolvedTsxCli = resolveDeclaredTsxCli(); } catch (error) {
      return classifyLivePreflight({
        authorityResult: {
          status: null,
          stdout: "",
          stderr: "",
          signal: null,
          error: { code: typeof error?.code === "string" ? error.code : "MODULE_NOT_FOUND" },
        },
        collectionResult: { status: null, stdout: "", stderr: "", signal: null },
        workspaceRoot,
        knownSecrets,
      });
    }
  }
  const childEnvironment = { ...environment };
  delete childEnvironment.PLAYWRIGHT_JSON_OUTPUT_FILE;
  delete childEnvironment.PLAYWRIGHT_JSON_OUTPUT_NAME;
  delete childEnvironment.PLAYWRIGHT_JSON_OUTPUT_DIR;
  const childOptions = {
    cwd,
    encoding: "utf8",
    env: childEnvironment,
    windowsHide: true,
    maxBuffer: 1024 * 1024,
  };
  const authorityResult = spawn(processExecPath, [resolvedTsxCli, "-e", AUTHORITY_EVALUATION], childOptions);
  if (authorityResult?.error || authorityResult?.signal || authorityResult?.status !== 0) {
    return classifyLivePreflight({
      authorityResult,
      collectionResult: { status: null, stdout: "", stderr: "", signal: null },
      workspaceRoot,
      knownSecrets,
    });
  }
  const collectionResult = spawn(processExecPath, [
    playwrightCli,
    "test",
    `--project=${project}`,
    "--list",
    "--reporter=json",
  ], childOptions);
  return classifyLivePreflight({ authorityResult, collectionResult, workspaceRoot, knownSecrets });
}

export function liveJourneyManifestEntry(id) {
  return LIVE_JOURNEY_MANIFEST.find((entry) => entry.id === id);
}

export function buildLiveJourneyResult({ id, beforeHash, afterHash, rows }) {
  const entry = liveJourneyManifestEntry(id);
  if (!entry) throw new Error("Unknown live journey ID");
  const profile = id.startsWith("profile.owner.pairwise.batch-");
  if (profile && (!Array.isArray(rows) || rows.length !== 12)) throw new Error("Profile journey evidence requires exactly 12 rows");
  if (!profile && rows !== undefined) throw new Error("Music journey evidence cannot contain profile rows");
  return {
    version: LIVE_JOURNEY_RESULT_VERSION,
    manifestVersion: LIVE_JOURNEY_MANIFEST_VERSION,
    ...entry,
    status: "passed",
    skipReason: null,
    cleanup: "restored",
    beforeHash,
    afterHash,
    ...(profile ? { rowCount: rows.length, rows } : {}),
  };
}

export async function recordRestoredProfileJourney({ id, before, after, rows, write }) {
  if (typeof write !== "function") throw new Error("Profile journey evidence requires a writer");
  const beforeHash = canonicalEvidenceHash(before);
  const afterHash = canonicalEvidenceHash(after);
  if (beforeHash !== afterHash) throw new Error("Canonical profile restoration mismatch");
  const record = buildLiveJourneyResult({ id, beforeHash, afterHash, rows });
  await write(record);
  return record;
}

export function appendLiveJourneyResult(file, record) {
  if (typeof file !== "string" || file.length === 0) throw new Error("Live journey evidence path is required");
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, `${JSON.stringify(record)}\n`, { encoding: "utf8", mode: 0o600 });
}

function evidenceFailure(subcheck, records = []) {
  const ids = new Set(records.map((record) => record?.id).filter((id) => typeof id === "string"));
  return {
    ok: false,
    failureStage: "journey-evidence",
    subcheck,
    journeyPresence: LIVE_JOURNEY_MANIFEST.map(({ id }) => ({ id, present: ids.has(id) })),
  };
}

function validHashPair(record) {
  return typeof record.beforeHash === "string" && /^[a-f0-9]{64}$/.test(record.beforeHash)
    && record.beforeHash === record.afterHash;
}

export function validateLiveJourneyEvidence({ executionReport, records }) {
  let collected;
  try { collected = extractCollectedLiveJourneys(executionReport); } catch { return evidenceFailure("execution-report"); }
  const manifestFailure = manifestClassification(collected);
  if (manifestFailure) return evidenceFailure(manifestFailure.subcheck, records);
  if (collected.some((entry) => entry.status !== "passed")) return evidenceFailure("execution-status", records);
  if (!Array.isArray(records)) return evidenceFailure("records-missing");
  const knownIds = new Set(LIVE_JOURNEY_MANIFEST.map(({ id }) => id));
  if (records.some((record) => !knownIds.has(record?.id))) return evidenceFailure("records-unknown", records);
  if (new Set(records.map((record) => record?.id)).size !== records.length) return evidenceFailure("records-duplicate", records);
  if (records.length !== LIVE_JOURNEY_MANIFEST.length) return evidenceFailure("records-missing", records);
  for (let index = 0; index < LIVE_JOURNEY_MANIFEST.length; index += 1) {
    const expected = LIVE_JOURNEY_MANIFEST[index];
    const record = records[index];
    if (record.id !== expected.id) return evidenceFailure("records-reordered", records);
    if (record.version !== LIVE_JOURNEY_RESULT_VERSION || record.manifestVersion !== LIVE_JOURNEY_MANIFEST_VERSION
        || record.title !== expected.title || record.source !== expected.source
        || record.status !== "passed" || record.skipReason !== null || record.cleanup !== "restored"
        || !validHashPair(record)) return evidenceFailure("record-contract", records);
  }
  const profileRecords = records.slice(11);
  if (profileRecords.some((record) => record.rowCount !== 12 || !Array.isArray(record.rows) || record.rows.length !== 12)) {
    return evidenceFailure("profile-row-count", records);
  }
  const rows = profileRecords.flatMap((record) => record.rows);
  const expectedRows = buildProfileCoveringRows();
  if (rows.length !== 72 || new Set(rows.map((row) => JSON.stringify(canonicalValue(row)))).size !== 72
      || JSON.stringify(rows) !== JSON.stringify(expectedRows)) return evidenceFailure("profile-row-order", records);
  const coveredPairs = profileFactorPairs(rows);
  const requiredPairs = requiredProfileFactorPairs();
  if (coveredPairs.size !== 484 || coveredPairs.size !== requiredPairs.size
      || [...requiredPairs].some((pair) => !coveredPairs.has(pair))) return evidenceFailure("profile-factor-pairs", records);
  return {
    ok: true,
    journeyResults: records,
    journeyPresence: LIVE_JOURNEY_MANIFEST.map(({ id }) => ({ id, present: true })),
  };
}
