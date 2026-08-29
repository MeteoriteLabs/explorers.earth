import { expect, test } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { PassThrough } from "node:stream";
import { pathToFileURL } from "node:url";
import {
  MUSIC_MUTATION_CALLSITES,
  MUSIC_PUBLIC_FIXTURE_VERSION,
  MUSIC_PUBLIC_STATES,
  assertLiveWriteAuthority,
  buildPermissionMatrix,
  buildPairwisePermissionMatrix,
  buildSanitizedFixtureEvidence,
  createCanonicalMusicFixtureAdapter,
  fixtureNamespace,
  normalizedSnapshotHash,
  musicLiveStrapiTokenFromEnvironment,
  musicLiveTest,
  resetMusicRestoreBlockForContractTest,
  runAuthorizedMusicMutation,
  resolveMusicTestLane,
  withRestoredMusicFixture,
} from "./setup/music";
import { stopMusicFixture } from "../scripts/music-fixture-cleanup.mjs";
import { runMusicFixtureOrchestration } from "../scripts/music-public-e2e-runner.mjs";
import {
  LIVE_JOURNEY_MANIFEST,
  LIVE_JOURNEY_MANIFEST_VERSION,
  LIVE_JOURNEY_RESULT_VERSION,
  buildProfileCoveringRows,
  canonicalEvidenceHash,
  classifyLivePreflight,
  profileFactorPairs,
  resolveDeclaredTsxCli,
  validateLiveJourneyEvidence,
} from "../scripts/music-public-live-preflight.mjs";
import playwrightConfig from "../playwright.config";

const EXPECTED_LIVE_JOURNEYS = [
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
  ...Array.from({ length: 6 }, (_, index) => ({
    id: `profile.owner.pairwise.batch-${String(index + 1).padStart(2, "0")}`,
    title: `publishes pairwise matrix batch ${index + 1}/6 and restores exact raw social_media`,
    source: "e2e/profile-theme.spec.ts",
  })),
] as const;

const EXPECTED_LIVE_READ_ONLY = [
  { title: "owner View as guest link opens public Music in a separate logged-out browser context", source: "e2e/music-public-contract.spec.ts" },
  { title: "pairwise permission matrix changes each concrete guest surface", source: "e2e/music-public-contract.spec.ts" },
  { title: "first-view fallback selects the first permitted content and then the explicit empty state", source: "e2e/music-public-contract.spec.ts" },
  { title: "screen readers receive actual loading and request-success announcements", source: "e2e/music-public-contract.spec.ts" },
  { title: "public and unlisted shares preserve canonical and capability privacy", source: "e2e/music-public-contract.spec.ts" },
  { title: "public and unlisted caches stay isolated and invalid capabilities recover generically", source: "e2e/music-public-contract.spec.ts" },
  { title: "invalid, private, and unavailable resources converge on generic recovery", source: "e2e/music-public-contract.spec.ts" },
  { title: "accessible public structure reflows at 320x700", source: "e2e/music-public-contract.spec.ts" },
  { title: "accessible public structure reflows at 375x667", source: "e2e/music-public-contract.spec.ts" },
  { title: "accessible public structure reflows at 390x844", source: "e2e/music-public-contract.spec.ts" },
  { title: "accessible public structure reflows at 768x1024", source: "e2e/music-public-contract.spec.ts" },
  { title: "accessible public structure reflows at 1440x900", source: "e2e/music-public-contract.spec.ts" },
  { title: "friendly route resolves one stable Account descriptor and shares canonical content", source: "e2e/music-public-contract.spec.ts" },
  { title: "friendly Music navigation preserves history, current-page semantics, heading order, and announcements", source: "e2e/music-public-contract.spec.ts" },
  { title: "wrong username and descriptor outage use non-enumerating recovery", source: "e2e/music-public-contract.spec.ts" },
  { title: "explicit friendly recovery: preference=true descriptor=missing", source: "e2e/music-public-contract.spec.ts" },
  { title: "explicit friendly recovery: preference=true descriptor=outage", source: "e2e/music-public-contract.spec.ts" },
  { title: "explicit friendly recovery: preference=false descriptor=available", source: "e2e/music-public-contract.spec.ts" },
  { title: "visual baseline dark-banner-full-content", source: "e2e/music-public-contract.spec.ts" },
  { title: "visual baseline minimal-light-solid", source: "e2e/music-public-contract.spec.ts" },
  { title: "visual baseline failed-image-fallback", source: "e2e/music-public-contract.spec.ts" },
  { title: "visual baseline mobile-reconnecting", source: "e2e/music-public-contract.spec.ts" },
  { title: "visual baseline 320-long-nav-stress", source: "e2e/music-public-contract.spec.ts" },
  { title: "visual baseline desktop-full-content", source: "e2e/music-public-contract.spec.ts" },
  { title: "restore guard uses one emergency cleanup and preserves the original failure", source: "e2e/profile-theme.spec.ts" },
  { title: "restore guard never performs an emergency write after a confirmed normal restore", source: "e2e/profile-theme.spec.ts" },
  { title: "restore guard refuses every write after a concurrent profile change", source: "e2e/profile-theme.spec.ts" },
  { title: "covering array dry run proves all values and all factor pairs", source: "e2e/profile-theme.spec.ts" },
  { title: "live timeout preserves at least five minutes for exact restore", source: "e2e/profile-theme.spec.ts" },
  { title: "live matrix is split into ordered batches of at most twelve rows", source: "e2e/profile-theme.spec.ts" },
  { title: "live row oracle promotes a category first view independently of saved order", source: "e2e/profile-theme.spec.ts" },
  { title: "renders homepage, navigation, and theme system elements", source: "e2e/profile-theme.spec.ts" },
] as const;

const LIVE_MUTATION_TAG = "@explorers-live-mutation";
const LIVE_READ_ONLY_TAG = "@explorers-live-read-only";

const AUTHORITATIVE_QUALIFICATION_STREAMS = [
  { role: "fixture-bootstrap-stdout", path: "logs/fixture-bootstrap.stdout.log", source: "fixture-bootstrap", stream: "stdout" },
  { role: "fixture-bootstrap-stderr", path: "logs/fixture-bootstrap.stderr.log", source: "fixture-bootstrap", stream: "stderr" },
  { role: "fixture-up-stdout", path: "logs/fixture-up.stdout.log", source: "fixture-up", stream: "stdout" },
  { role: "fixture-up-stderr", path: "logs/fixture-up.stderr.log", source: "fixture-up", stream: "stderr" },
  { role: "fixture-down-stdout", path: "logs/fixture-down.stdout.log", source: "fixture-down", stream: "stdout" },
  { role: "fixture-down-stderr", path: "logs/fixture-down.stderr.log", source: "fixture-down", stream: "stderr" },
  { role: "state-service-stdout", path: "logs/state-service.stdout.log", source: "state-service", stream: "stdout" },
  { role: "state-service-stderr", path: "logs/state-service.stderr.log", source: "state-service", stream: "stderr" },
] as const;
const REQUIRED_QUALIFICATION_ARTIFACTS = [
  ...AUTHORITATIVE_QUALIFICATION_STREAMS.map(({ role, path }) => ({ role, path })),
  { role: "analytics-ledger", path: "analytics-events.jsonl" },
  { role: "visual-trace-ledger", path: "visual-trace-ledger.json" },
  { role: "docker-inspection", path: "docker-inspection.json" },
  { role: "skip-ledger", path: "skip-reasons.json" },
  { role: "restoration-record", path: "restoration.json" },
  { role: "evidence", path: "evidence.json" },
] as const;
const NONE_RETAINED_VISUAL_LEDGER = `${JSON.stringify({
  schemaVersion: "explorers-public-visual-trace-ledger/v1",
  status: "none-retained",
  visuals: [],
  traces: [],
})}\n`;

function seededQualificationEvidence() {
  return `${JSON.stringify({
    stateServiceLifecycle: {
      schemaVersion: "explorers-public-state-service-lifecycle/v1",
      error: { status: "unavailable" },
      exit: { status: "unavailable" },
      close: { status: "unavailable" },
    },
    streams: AUTHORITATIVE_QUALIFICATION_STREAMS.map((definition) => ({
      schemaVersion: "explorers-public-stream-artifact/v1",
      ...definition,
      status: "captured",
      observedBytes: 3,
      bytes: 3,
      truncated: false,
    })),
  }, null, 2)}\n`;
}

function seededQualificationArtifactContent(role: string) {
  if (role === "visual-trace-ledger") return NONE_RETAINED_VISUAL_LEDGER;
  if (role === "evidence") return seededQualificationEvidence();
  return "abc";
}

function seedQualificationArtifacts(runDirectory: string) {
  for (const artifact of REQUIRED_QUALIFICATION_ARTIFACTS) {
    const artifactPath = join(runDirectory, ...artifact.path.split("/"));
    mkdirSync(resolve(artifactPath, ".."), { recursive: true });
    writeFileSync(artifactPath, seededQualificationArtifactContent(artifact.role));
  }
}

function observedQualificationAnalyticsLedger() {
  return {
    schemaVersion: "explorers-public-analytics-ledger/v1",
    status: "observed",
    events: [{
      sequence: 1,
      event: { name: "navigation_opened", route: "friendly" },
      utm: { utm_source: "newsletter", utm_medium: "email", utm_campaign: "music_launch" },
      delivery: {
        occurrenceSha256: "a".repeat(64),
        eventIdSha256: "b".repeat(64),
        attempts: 2,
        distinctEventIds: 1,
        committedEvents: 1,
        duplicateResponses: 1,
        exactlyOnce: true,
      },
    }],
  };
}

function rewriteQualificationManifest(
  runDirectory: string,
  mutate: (manifest: { schemaVersion: string; artifacts: Array<Record<string, unknown>> }) => void,
) {
  const manifestPath = join(runDirectory, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  mutate(manifest);
  const bytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  writeQualificationManifestBytes(runDirectory, bytes);
}

function writeQualificationManifestBytes(runDirectory: string, bytes: Buffer) {
  const manifestPath = join(runDirectory, "manifest.json");
  writeFileSync(manifestPath, bytes);
  writeFileSync(join(runDirectory, "manifest.sha256"), `${createHash("sha256").update(bytes).digest("hex")}\n`);
}

function playwrightJourneyReport(
  entries: ReadonlyArray<{ id: string; title: string; source: string }> = EXPECTED_LIVE_JOURNEYS,
  options: { skippedId?: string; resultStatus?: string } = {},
) {
  const spec = (entry: { id: string; title: string; source: string }) => ({
    title: entry.title,
    file: entry.source.replace(/^e2e\//, ""),
    tags: [LIVE_MUTATION_TAG],
    tests: [{
      annotations: entry.id === options.skippedId ? [{ type: "skip", description: "Bearer should-not-survive" }] : [],
      expectedStatus: "passed",
      results: options.resultStatus ? [{ status: options.resultStatus }] : [],
      status: options.resultStatus ?? "skipped",
    }],
  });
  const fixture = entries.filter(({ source }) => source.endsWith("music-fixture-fullstack.spec.ts"));
  const music = entries.filter(({ source }) => source.endsWith("music-public-contract.spec.ts"));
  const profile = entries.filter(({ source }) => source.endsWith("profile-theme.spec.ts"));
  const reviewedSources = new Set(["e2e/music-fixture-fullstack.spec.ts", "e2e/music-public-contract.spec.ts", "e2e/profile-theme.spec.ts"]);
  const unknownSources = entries.filter(({ source }) => !reviewedSources.has(source));
  const musicReadOnly = EXPECTED_LIVE_READ_ONLY.filter(({ source }) => source.endsWith("music-public-contract.spec.ts"));
  const profileReadOnly = EXPECTED_LIVE_READ_ONLY.filter(({ source }) => source.endsWith("profile-theme.spec.ts"));
  const readOnlySpec = (entry: { title: string; source: string }) => ({
    title: entry.title,
    file: entry.source.replace(/^e2e\//, ""),
    tags: [LIVE_READ_ONLY_TAG],
    tests: [{ annotations: [], expectedStatus: "passed", results: options.resultStatus ? [{ status: options.resultStatus }] : [] }],
  });
  return {
    suites: [
      { title: "music-fixture-fullstack.spec.ts", file: "music-fixture-fullstack.spec.ts", specs: fixture.map(spec) },
      { title: "music-public-contract.spec.ts", file: "music-public-contract.spec.ts", specs: [...music.map(spec), ...musicReadOnly.map(readOnlySpec)] },
      {
        title: "profile-theme.spec.ts",
        file: "profile-theme.spec.ts",
        specs: profileReadOnly.slice(0, 7).map(readOnlySpec),
        suites: [{ title: "approved live profile writes", specs: profile.map(spec) }],
      },
      { title: "profile-theme.spec.ts", file: "profile-theme.spec.ts", specs: profileReadOnly.slice(7).map(readOnlySpec) },
      ...unknownSources.map((entry) => ({ title: entry.source, file: entry.source, specs: [spec(entry)] })),
    ],
  };
}

function preflightChild(status: number, stdout = "", stderr = "") {
  return { status, stdout, stderr, signal: null, error: undefined };
}

function validJourneyEvidenceRecords() {
  const profileRows = buildProfileCoveringRows();
  const profileHash = canonicalEvidenceHash({ profile: "restored", order: ["music", "places"] });
  return EXPECTED_LIVE_JOURNEYS.map((entry, index) => ({
    version: LIVE_JOURNEY_RESULT_VERSION,
    manifestVersion: LIVE_JOURNEY_MANIFEST_VERSION,
    ...entry,
    status: "passed",
    skipReason: null,
    cleanup: "restored",
    beforeHash: index < 11 ? String(index + 1).padStart(64, "a") : profileHash,
    afterHash: index < 11 ? String(index + 1).padStart(64, "a") : profileHash,
    ...(index < 11 ? {} : { rowCount: 12, rows: profileRows.slice((index - 11) * 12, (index - 10) * 12) }),
  }));
}

function inertLiveCollectionEnvironment() {
  return {
    ...process.env,
    PLAYWRIGHT_EXTERNAL_BASE_URL: "http://127.0.0.1:55173",
    PLAYWRIGHT_PR_SAFE: "false",
    MUSIC_E2E_LIVE_WRITE: "true",
    MUSIC_E2E_LIVE_WRITE_CONFIRMATION: "I_UNDERSTAND_THIS_MUTATES_A_DISPOSABLE_FIXTURE",
    MUSIC_E2E_FIXTURE_VERSION: MUSIC_PUBLIC_FIXTURE_VERSION,
    MUSIC_E2E_ACCOUNT_USERNAME: "e2e-public-music-sentinel-owner",
    MUSIC_E2E_ACCOUNT_DOCUMENT_ID: "e2e-public-music-sentinel-account",
    MUSIC_E2E_SERVICE_ORIGINS: "http://127.0.0.1:55173,http://127.0.0.1:55000,tcp://127.0.0.1:55432,http://127.0.0.1:51337,http://127.0.0.1:55174",
    MUSIC_E2E_STRAPI_TOKEN: "sentinel-authority-value",
    E2E_PROFILE_LIVE_WRITES: "1",
    E2E_PROFILE_STORAGE_STATE: resolve(".artifacts/inert-profile-storage-state.json"),
    E2E_PROFILE_USERNAME: "e2e-profile-sentinel",
  };
}

function writeLifecycleContractShims(sandbox: string) {
  const fakeNpmPath = join(sandbox, "fake-npm.mjs");
  const fakeDockerPath = join(sandbox, "fake-docker.mjs");
  const fakeDockerHookPath = join(sandbox, "fake-docker-hook.cjs");
  const binDirectory = join(sandbox, "bin");
  mkdirSync(binDirectory);
  writeFileSync(fakeNpmPath, [
    'import { appendFileSync, existsSync, rmSync, writeFileSync } from "node:fs";',
    'const action = ["bootstrap", "up", "down"].find((candidate) => process.argv.includes(candidate));',
    'appendFileSync(process.env.FAKE_LIFECYCLE_LOG, `${action}\n`);',
    'process.stdout.write(`workspace=${process.cwd()} Bearer ${process.env.FAKE_PRIVATE_VALUE}\n${"bounded-child-output".repeat(600)}`);',
    'process.stderr.write(`credential=${process.env.FAKE_PRIVATE_VALUE} path=/private/fixture/lifecycle.log\n`);',
    'const scenario = process.env.FAKE_LIFECYCLE_SCENARIO;',
    'if (action === "bootstrap") {',
    '  if (scenario === "bootstrap-partial") writeFileSync(process.env.FAKE_RESOURCE_MARKER, "partial");',
    '  if (scenario.startsWith("bootstrap-")) process.exit(1);',
    '}',
    'if (action === "up") {',
    '  if (scenario === "up-partial") { writeFileSync(process.env.FAKE_RESOURCE_MARKER, "partial"); process.exit(1); }',
    '}',
    'if (action === "down") {',
    '  if (existsSync(process.env.FAKE_RESOURCE_MARKER)) rmSync(process.env.FAKE_RESOURCE_MARKER);',
    '  if (scenario.endsWith("down-failure")) process.exit(1);',
    '}',
    '',
  ].join("\n"));
  writeFileSync(fakeDockerPath, [
    'const mode = process.env.FAKE_DOCKER_MODE;',
    'if (mode === "unavailable") process.exit(2);',
    'if (mode === "residue") process.stdout.write(process.argv.includes("ps") ? `${"a".repeat(12)}\\n` : "explorers_music_fixture_residue\\n");',
    '',
  ].join("\n"));
  writeFileSync(fakeDockerHookPath, [
    'const { basename } = require("node:path");',
    'if ([basename(process.execPath), basename(process.argv0)].some((name) => name.toLowerCase() === "docker.exe")) {',
    '  const mode = process.env.FAKE_DOCKER_MODE;',
    '  if (mode === "unavailable") process.exit(2);',
    '  if (mode === "residue") process.stdout.write(process.argv.includes("ps") ? `${"a".repeat(12)}\\n` : "explorers_music_fixture_residue\\n");',
    '  process.exit(0);',
    '}',
    '',
  ].join("\n"));
  if (process.platform === "win32") {
    copyFileSync(process.execPath, join(binDirectory, "docker.exe"));
  } else {
    const posixDocker = join(binDirectory, "docker");
    writeFileSync(posixDocker, `#!/usr/bin/env node\nawait import(${JSON.stringify(pathToFileURL(fakeDockerPath).href)});\n`);
    chmodSync(posixDocker, 0o755);
  }
  return { fakeNpmPath, fakeDockerHookPath, binDirectory };
}

function lifecycleFreshProcessEnvironment({
  sandbox,
  runId,
  fakeNpmPath,
  fakeDockerHookPath,
  binDirectory,
  scenario,
  dockerMode,
  privateValue,
}: {
  sandbox: string;
  runId: string;
  fakeNpmPath: string;
  fakeDockerHookPath: string;
  binDirectory: string;
  scenario: string;
  dockerMode: string;
  privateValue: string;
}) {
  return {
    ...process.env,
    PATH: `${binDirectory}${delimiter}${process.env.PATH ?? ""}`,
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --require=${fakeDockerHookPath}`.trim(),
    npm_execpath: fakeNpmPath,
    MUSIC_PUBLIC_RUN_ID: runId,
    PLAYWRIGHT_EXTERNAL_BASE_URL: "http://127.0.0.1:55173",
    MUSIC_E2E_LIVE_WRITE: "true",
    MUSIC_E2E_LIVE_WRITE_CONFIRMATION: "I_UNDERSTAND_THIS_MUTATES_A_DISPOSABLE_FIXTURE",
    MUSIC_E2E_FIXTURE_VERSION: MUSIC_PUBLIC_FIXTURE_VERSION,
    MUSIC_E2E_ACCOUNT_USERNAME: `e2e-public-music-${runId}-owner`,
    MUSIC_E2E_ACCOUNT_DOCUMENT_ID: `e2e-public-music-${runId}-account`,
    MUSIC_E2E_USER_DOCUMENT_ID: `e2e-public-music-${runId}-user`,
    MUSIC_E2E_STRAPI_URL: "http://127.0.0.1:51337",
    MUSIC_E2E_STRAPI_TOKEN: privateValue,
    MUSIC_E2E_NAMESPACE_RESET_CONFIRMATION: "RESET_EXPLORERS_MUSIC_FIXTURE_NAMESPACE",
    MUSIC_E2E_SERVICE_ORIGINS: [
      "http://127.0.0.1:55173", "http://127.0.0.1:55000", "tcp://127.0.0.1:55432",
      "http://127.0.0.1:51337", "http://127.0.0.1:55174",
    ].join(","),
    MUSIC_E2E_HEALTH_URLS: [
      "http://127.0.0.1:55173/health", "http://127.0.0.1:55000/health", "tcp://127.0.0.1:55432",
      "http://127.0.0.1:51337/health", "http://127.0.0.1:55174/health",
    ].join(","),
    FAKE_LIFECYCLE_SCENARIO: scenario,
    FAKE_DOCKER_MODE: dockerMode,
    FAKE_LIFECYCLE_LOG: join(sandbox, `${runId}-lifecycle.log`),
    FAKE_RESOURCE_MARKER: join(sandbox, `${runId}-resource.marker`),
    FAKE_PRIVATE_VALUE: privateValue,
  };
}

type JsonCollectionSuite = {
  specs?: Array<{ title?: string; file?: string; tags?: string[] }>;
  suites?: JsonCollectionSuite[];
};

function allJsonCollectionSpecs(report: { suites?: JsonCollectionSuite[] }) {
  const specs: Array<{ title?: string; file?: string; tags: string[] }> = [];
  const visit = (suite: JsonCollectionSuite) => {
    for (const spec of suite.specs ?? []) specs.push({ ...spec, tags: (spec.tags ?? []).map((tag) => tag.replace(/^@/, "")) });
    for (const child of suite.suites ?? []) visit(child);
  };
  for (const suite of report.suites ?? []) visit(suite);
  return specs;
}

function syntheticJourneySpecSource(
  mutations: ReadonlyArray<{ title: string }>,
  readOnly: ReadonlyArray<{ title: string }>,
  hostileFailure?: {
    title: string;
    bearer: string;
    accessToken: string;
    capability: string;
    credential: string;
    absolutePath: string;
  },
) {
  const source = (title: string, tag: string) => {
    if (title !== hostileFailure?.title) {
      return `test(${JSON.stringify(title)}, { tag: ${JSON.stringify(tag)} }, async () => {});`;
    }
    const hostileValues = JSON.stringify([
      `Bearer ${hostileFailure.bearer}`,
      `access_token=${hostileFailure.accessToken}`,
      `capability=${hostileFailure.capability}`,
      `credential=${hostileFailure.credential}`,
      hostileFailure.absolutePath,
    ]);
    return [
      `test(${JSON.stringify(title)}, { tag: ${JSON.stringify(tag)} }, async ({}, testInfo) => {`,
      `  const hostile = ${hostileValues}.join(" ");`,
      '  const oversized = "hostile-output-".repeat(20000);',
      '  console.log(`${hostile} ${oversized}`);',
      '  console.error(`${hostile} ${oversized}`);',
      '  await testInfo.attach("hostile-private-attachment", { body: Buffer.from(`${hostile} ${oversized}`), contentType: "text/plain" });',
      '  throw new Error(`${hostile} ${oversized}`);',
      "});",
    ].join("\n");
  };
  return [
    'import { test } from "@playwright/test";',
    ...mutations.map(({ title }) => source(title, LIVE_MUTATION_TAG)),
    ...readOnly.map(({ title }) => source(title, LIVE_READ_ONLY_TAG)),
    "",
  ].join("\n");
}

async function runSyntheticTerminalOutcome(executionOutcome: unknown, runId: string) {
  const finalHash = "9".repeat(64);
  const retained: string[] = [];
  const outcome = await runMusicFixtureOrchestration({
    snapshotExists: true,
    baseReport: { version: MUSIC_PUBLIC_FIXTURE_VERSION, runId, lane: "live" },
    artifacts: {
      directory: `guarded/${runId}`,
      authPath: "owner-auth.json",
      storagePath: "profile-storage-state.json",
      mkdir: () => undefined,
      write: () => undefined,
      chmod: () => undefined,
    },
    restoreEvidence: {
      path: "restore-evidence.jsonl",
      exists: () => true,
      read: () => validJourneyEvidenceRecords().map((record) => JSON.stringify(record)).join("\n"),
    },
    execute: async () => executionOutcome,
    restore: async () => ({ ok: true, cleanup: "restored", beforeHash: finalHash, afterHash: finalHash }),
    teardown: {
      artifactPaths: [],
      artifactDirectories: [],
      exists: () => false,
      unlink: () => undefined,
      removeDirectory: () => undefined,
      stopStateService: () => undefined,
      down: () => 0,
    },
    writeReport: async (report: unknown) => { retained.push(JSON.stringify(report)); },
    writeStdout: (text: string) => { retained.push(text); },
    writeStderr: (text: string) => { retained.push(text); },
  });
  return { outcome, retained: retained.join("\n") };
}

test("live manifest binds exactly 17 collected mutation journeys", () => {
  expect(LIVE_JOURNEY_MANIFEST_VERSION).toBe("explorers-live-mutation-journeys/v1");
  expect(LIVE_JOURNEY_RESULT_VERSION).toBe("explorers-live-mutation-journey-result/v1");
  expect(LIVE_JOURNEY_MANIFEST).toEqual(EXPECTED_LIVE_JOURNEYS);

  const outcome = classifyLivePreflight({
    authorityResult: preflightChild(0, JSON.stringify({ skipReason: null })),
    collectionResult: preflightChild(0, JSON.stringify(playwrightJourneyReport())),
    workspaceRoot: process.cwd(),
    knownSecrets: [],
  });
  expect(outcome).toMatchObject({
    ok: true,
    exitCode: 0,
    manifestVersion: LIVE_JOURNEY_MANIFEST_VERSION,
    journeyIds: EXPECTED_LIVE_JOURNEYS.map(({ id }) => id),
  });
});

test("live preflight classifier distinguishes authority process, semantic, and collection failures", () => {
  const goodAuthority = preflightChild(0, JSON.stringify({ skipReason: null }));
  const goodCollection = preflightChild(0, JSON.stringify(playwrightJourneyReport()));
  const cases = [
    {
      name: "authority process",
      authorityResult: { ...preflightChild(1, "", "authority child failed"), error: { code: "ENOENT" } },
      collectionResult: goodCollection,
      subcheck: "authority-process",
    },
    {
      name: "authority semantic refusal",
      authorityResult: preflightChild(0, JSON.stringify({ skipReason: "live mutation skipped: incomplete authority" })),
      collectionResult: goodCollection,
      subcheck: "authority-semantic",
    },
    {
      name: "collection process",
      authorityResult: goodAuthority,
      collectionResult: preflightChild(1, "", "collection child failed"),
      subcheck: "collection-process",
    },
  ] as const;

  for (const entry of cases) {
    const outcome = classifyLivePreflight({ ...entry, workspaceRoot: process.cwd(), knownSecrets: [] });
    expect(outcome, entry.name).toMatchObject({
      ok: false,
      exitCode: 4,
      diagnostics: { failureStage: "preflight", subcheck: entry.subcheck },
    });
  }
});

test("live preflight rejects each missing journey plus duplicate, unknown, renamed, reordered, and skipped entries", () => {
  const classify = (entries: ReadonlyArray<{ id: string; title: string; source: string }>, skippedId?: string) => classifyLivePreflight({
    authorityResult: preflightChild(0, JSON.stringify({ skipReason: null })),
    collectionResult: preflightChild(0, JSON.stringify(playwrightJourneyReport(entries, { skippedId }))),
    workspaceRoot: process.cwd(),
    knownSecrets: [],
  });

  for (const missing of EXPECTED_LIVE_JOURNEYS) {
    const outcome = classify(EXPECTED_LIVE_JOURNEYS.filter(({ id }) => id !== missing.id));
    expect(outcome, missing.id).toMatchObject({
      ok: false,
      exitCode: 4,
      diagnostics: {
        failureStage: "preflight",
        subcheck: "manifest-missing",
        missingJourneyIds: [missing.id],
      },
    });
  }

  const duplicate = [...EXPECTED_LIVE_JOURNEYS];
  duplicate.splice(3, 0, EXPECTED_LIVE_JOURNEYS[3]);
  expect(classify(duplicate)).toMatchObject({ ok: false, diagnostics: { subcheck: "manifest-duplicate" } });

  const unknown = [...EXPECTED_LIVE_JOURNEYS, {
    id: "unknown-not-trusted",
    title: "live unexpected mutation journey",
    source: "e2e/music-public-contract.spec.ts",
  }];
  expect(classify(unknown)).toMatchObject({ ok: false, diagnostics: { subcheck: "manifest-unknown" } });

  const unknownSource = [...EXPECTED_LIVE_JOURNEYS, {
    id: "unknown-source-not-trusted",
    title: "live mutation from an unreviewed source",
    source: "e2e/unreviewed-live-mutation.spec.ts",
  }];
  expect(classify(unknownSource)).toMatchObject({ ok: false, diagnostics: { subcheck: "manifest-unknown" } });

  const renamed = EXPECTED_LIVE_JOURNEYS.map((entry, index) => index === 8 ? { ...entry, title: `${entry.title} renamed` } : entry);
  expect(classify(renamed)).toMatchObject({ ok: false, diagnostics: { subcheck: "manifest-unknown" } });

  const reordered = [...EXPECTED_LIVE_JOURNEYS];
  [reordered[3], reordered[4]] = [reordered[4], reordered[3]];
  expect(classify(reordered)).toMatchObject({ ok: false, diagnostics: { subcheck: "manifest-reordered" } });

  expect(classify(EXPECTED_LIVE_JOURNEYS, EXPECTED_LIVE_JOURNEYS[5].id)).toMatchObject({
    ok: false,
    diagnostics: { subcheck: "manifest-skipped", skippedJourneyIds: [EXPECTED_LIVE_JOURNEYS[5].id] },
  });
});

test("live preflight diagnostics are bounded, redacted, path-normalized, and allowlisted", () => {
  const workspaceRoot = process.cwd();
  const secret = "known-secret-value";
  const noisy = `${workspaceRoot} Bearer abc.def.ghi access_token=query-secret capability=cap-secret credential: cred-secret access-token="quoted-access-secret" capability='quoted-cap-secret' credential="quoted-cred-secret" ${secret} ${"x".repeat(10_000)}`;
  const outcome = classifyLivePreflight({
    authorityResult: preflightChild(1, noisy, noisy),
    collectionResult: preflightChild(0, ""),
    workspaceRoot,
    knownSecrets: [secret],
  });
  expect(outcome.ok).toBe(false);
  if (outcome.ok) return;
  const diagnostics = outcome.diagnostics;
  expect(Object.keys(diagnostics).sort()).toEqual([
    "child",
    "failureStage",
    "journeyPresence",
    "subcheck",
  ]);
  expect(Object.keys(diagnostics.child).sort()).toEqual([
    "errorCode",
    "signal",
    "status",
    "stderr",
    "stderrBytes",
    "stderrTruncated",
    "stdout",
    "stdoutBytes",
    "stdoutTruncated",
  ]);
  expect(Buffer.byteLength(diagnostics.child.stdout)).toBeLessThanOrEqual(4 * 1024);
  expect(Buffer.byteLength(diagnostics.child.stderr)).toBeLessThanOrEqual(4 * 1024);
  expect(diagnostics.child.stdoutBytes).toBeGreaterThan(4 * 1024);
  expect(diagnostics.child.stderrBytes).toBeGreaterThan(4 * 1024);
  expect(diagnostics.child.stdoutTruncated).toBe(true);
  expect(diagnostics.child.stderrTruncated).toBe(true);
  expect(`${diagnostics.child.stdout}\n${diagnostics.child.stderr}`).toContain("<workspace>");
  expect(`${diagnostics.child.stdout}\n${diagnostics.child.stderr}`).not.toMatch(/abc\.def\.ghi|query-secret|cap-secret|cred-secret|quoted-access-secret|quoted-cap-secret|quoted-cred-secret|known-secret-value/i);
  expect(diagnostics.journeyPresence).toEqual(EXPECTED_LIVE_JOURNEYS.map(({ id }) => ({ id, present: false })));
});

test("live journey evidence requires explicit ordered IDs and exact 72-row 484-pair profile coverage", () => {
  const profileRows = buildProfileCoveringRows();
  expect(profileRows).toHaveLength(72);
  expect(new Set(profileRows.map((row) => JSON.stringify(row))).size).toBe(72);
  expect(profileFactorPairs(profileRows).size).toBe(484);
  const hash = canonicalEvidenceHash({ profile: "restored", order: ["music", "places"] });
  expect(hash).toMatch(/^[a-f0-9]{64}$/);

  const records = validJourneyEvidenceRecords();
  const executionReport = playwrightJourneyReport(EXPECTED_LIVE_JOURNEYS, { resultStatus: "passed" });
  expect(validateLiveJourneyEvidence({ executionReport, records })).toMatchObject({
    ok: true,
    journeyResults: records,
  });

  const invalidCases = [
    records.slice(1),
    [records[0], ...records],
    [...records.slice(0, 4), records[5], records[4], ...records.slice(6)],
    [...records.slice(0, 8), { ...records[8], id: "unknown-not-trusted" }, ...records.slice(9)],
    records.map((record, index) => index === 11 ? { ...record, rows: [profileRows[0], ...profileRows.slice(0, 11)] } : record),
  ];
  for (const invalid of invalidCases) expect(validateLiveJourneyEvidence({ executionReport, records: invalid }).ok).toBe(false);
  expect(validateLiveJourneyEvidence({
    executionReport: playwrightJourneyReport(EXPECTED_LIVE_JOURNEYS, { skippedId: EXPECTED_LIVE_JOURNEYS[12].id, resultStatus: "passed" }),
    records,
  }).ok).toBe(false);
});

test("music restoration emits one explicit ID-bound terminal result only after exact restore", async () => {
  resetMusicRestoreBlockForContractTest();
  const records: unknown[] = [];
  let state: unknown = { publication: { mode: "private" }, queue: [] };
  const result = await withRestoredMusicFixture({
    journeyId: "music.owner.queue-add",
    snapshot: async () => structuredClone(state),
    cleanupNamespace: async () => undefined,
    restore: async (snapshot) => { state = structuredClone(snapshot); },
    writeJourneyResult: async (record) => { records.push(record); },
  }, async () => {
    state = { publication: { mode: "public" }, queue: ["fixture-song"] };
    return "journey-value";
  });
  expect(result.value).toBe("journey-value");
  expect(records).toEqual([expect.objectContaining({
    version: LIVE_JOURNEY_RESULT_VERSION,
    manifestVersion: LIVE_JOURNEY_MANIFEST_VERSION,
    id: "music.owner.queue-add",
    title: EXPECTED_LIVE_JOURNEYS[0].title,
    source: EXPECTED_LIVE_JOURNEYS[0].source,
    status: "passed",
    skipReason: null,
    cleanup: "restored",
    beforeHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    afterHash: expect.stringMatching(/^[a-f0-9]{64}$/),
  })]);
  expect((records[0] as { beforeHash: string; afterHash: string }).beforeHash)
    .toBe((records[0] as { beforeHash: string; afterHash: string }).afterHash);

  const failedRecords: unknown[] = [];
  await expect(withRestoredMusicFixture({
    journeyId: "music.owner.queue-add",
    snapshot: async () => ({ publication: { mode: "private" } }),
    cleanupNamespace: async () => undefined,
    restore: async () => undefined,
    writeJourneyResult: async (record) => { failedRecords.push(record); },
  }, async () => { throw new Error("journey failed"); })).rejects.toThrow("journey failed");
  expect(failedRecords).toEqual([]);
});

test("live canonical restoration retains explicit journey identity for terminal evidence", async () => {
  resetMusicRestoreBlockForContractTest();
  const environmentKeys = ["MUSIC_E2E_LIVE_WRITE", "MUSIC_E2E_STATE_SERVICE_URL", "MUSIC_E2E_STATE_TOKEN"] as const;
  const originalEnvironment = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  const baseline = {
    version: "music-live-account-snapshot/v1",
    snapshotId: "snapshot-terminal-evidence",
    publication: { coveredByDatabaseDump: true },
    guestControls: { coveredByDatabaseDump: true },
    queue: { coveredByDatabaseDump: true },
    playlists: { coveredByDatabaseDump: true },
    requests: { coveredByDatabaseDump: true },
    profile: { accountDocumentId: "e2e-public-music-evidence-account", publicMusic: true, preferenceRevision: 4, preferenceHash: "b".repeat(64) },
    database: { namespace: "e2e-public-music-evidence", dumpHash: "a".repeat(64) },
  };
  let current: unknown = structuredClone(baseline);
  const records: unknown[] = [];
  try {
    process.env.MUSIC_E2E_LIVE_WRITE = "true";
    process.env.MUSIC_E2E_STATE_SERVICE_URL = "http://127.0.0.1:55174";
    process.env.MUSIC_E2E_STATE_TOKEN = "sentinel-state-token";
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url.endsWith("/restore")) {
        current = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(current), { status: 200, headers: { "Content-Type": "application/json" } });
    };

    await withRestoredMusicFixture({
      journeyId: "music.owner.queue-add",
      snapshot: async () => { throw new Error("live mode must use the canonical snapshot adapter"); },
      cleanupNamespace: async () => undefined,
      restore: async () => { throw new Error("live mode must use the canonical restore adapter"); },
      writeJourneyResult: async (record) => { records.push(record); },
    }, async () => { current = { mutated: true }; });
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of environmentKeys) {
      const value = originalEnvironment[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
  expect(records).toEqual([expect.objectContaining({
    id: "music.owner.queue-add",
    cleanup: "restored",
    beforeHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    afterHash: expect.stringMatching(/^[a-f0-9]{64}$/),
  })]);
});

test("per-batch profile evidence hashes canonical state and refuses mismatch before writing", async () => {
  const { recordRestoredProfileJourney } = await import("../scripts/music-public-live-preflight.mjs");
  const rows = buildProfileCoveringRows().slice(0, 12);
  const written: unknown[] = [];
  const before = { social_media: { b: 2, a: 1 }, Feed_Data: ["music", "places"] };
  const after = { Feed_Data: ["music", "places"], social_media: { a: 1, b: 2 } };
  const record = await recordRestoredProfileJourney({
    id: "profile.owner.pairwise.batch-01",
    before,
    after,
    rows,
    write: async (value) => { written.push(value); },
  });
  expect(written).toEqual([record]);
  expect(record).toMatchObject({
    id: "profile.owner.pairwise.batch-01",
    rowCount: 12,
    rows,
    beforeHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    afterHash: expect.stringMatching(/^[a-f0-9]{64}$/),
  });
  expect(record.beforeHash).toBe(record.afterHash);

  const mismatched: unknown[] = [];
  await expect(recordRestoredProfileJourney({
    id: "profile.owner.pairwise.batch-01",
    before,
    after: { ...after, Feed_Data: ["places", "music"] },
    rows,
    write: async (value) => { mismatched.push(value); },
  })).rejects.toThrow(/canonical profile restoration mismatch/i);
  expect(mismatched).toEqual([]);
});

test("runner propagates typed preflight and terminal journey evidence without inventing an eighteenth journey", async () => {
  const finalHash = "f".repeat(64);
  const records = validJourneyEvidenceRecords();
  const executionReport = playwrightJourneyReport(EXPECTED_LIVE_JOURNEYS, { resultStatus: "passed" });
  const reports: unknown[] = [];
  const common = {
    snapshotExists: true,
    baseReport: { version: MUSIC_PUBLIC_FIXTURE_VERSION, runId: "typed-evidence", lane: "live" },
    artifacts: {
      directory: "fixture-artifacts",
      authPath: "owner-auth.json",
      storagePath: "profile-storage-state.json",
      mkdir: () => undefined,
      write: () => undefined,
      chmod: () => undefined,
    },
    restoreEvidence: {
      path: "journey-results.jsonl",
      exists: () => true,
      read: () => records.map((record) => JSON.stringify(record)).join("\n"),
    },
    restore: async () => ({ ok: true, cleanup: "restored", beforeHash: finalHash, afterHash: finalHash }),
    teardown: {
      artifactPaths: [],
      exists: () => false,
      unlink: () => undefined,
      stopStateService: () => undefined,
      down: () => 0,
    },
    writeReport: async (report: unknown) => { reports.push(structuredClone(report)); },
    writeStdout: () => undefined,
    writeStderr: () => undefined,
  };
  const successful = await runMusicFixtureOrchestration({
    ...common,
    execute: async () => ({ status: 0, executionReport }),
  });
  expect(successful.exitCode).toBe(0);
  expect(successful.report).toMatchObject({
    result: "passed",
    cleanup: "restored",
    manifestVersion: LIVE_JOURNEY_MANIFEST_VERSION,
    journeys: records,
    finalRestore: { cleanup: "restored", beforeHash: finalHash, afterHash: finalHash },
  });
  expect(successful.report.journeys).toHaveLength(17);
  expect(successful.report).not.toHaveProperty("restoreHashes");

  const preflightDiagnostics = {
    failureStage: "preflight",
    subcheck: "authority-process",
    journeyPresence: EXPECTED_LIVE_JOURNEYS.map(({ id }) => ({ id, present: false })),
  };
  const preflight = await runMusicFixtureOrchestration({
    ...common,
    restoreEvidence: { ...common.restoreEvidence, exists: () => false },
    execute: async () => ({ status: 4, preflightDiagnostics }),
  });
  expect(preflight.exitCode).toBe(4);
  expect(preflight.report).toMatchObject({
    result: "failed",
    cleanup: "restored",
    preflightDiagnostics,
    finalRestore: { cleanup: "restored", beforeHash: finalHash, afterHash: finalHash },
  });
  expect(preflight.report).not.toHaveProperty("journeys");

  const cleanupFailure = await runMusicFixtureOrchestration({
    ...common,
    restoreEvidence: { ...common.restoreEvidence, exists: () => false },
    execute: async () => ({ status: 4, preflightDiagnostics }),
    teardown: { ...common.teardown, down: () => 1 },
  });
  expect(cleanupFailure.exitCode).toBe(5);
  expect(cleanupFailure.report.cleanup).toBe("teardown-failed");
});

test("declared root TSX CLI executes the exact inert authority child from Explorer cwd", () => {
  const tsxCli = resolveDeclaredTsxCli();
  expect(tsxCli.replace(/\\/g, "/")).toMatch(/\/node_modules\/tsx\/dist\/cli\.mjs$/);
  expect(tsxCli.replace(/\\/g, "/")).not.toContain("/explorers-earth/node_modules/");
  expect(tsxCli.replace(/\\/g, "/")).not.toContain("/tunes/node_modules/");
  const result = spawnSync(process.execPath, [tsxCli, "-e", "import { musicLiveWriteSkipReason } from './e2e/setup/music.ts'; const skipReason=musicLiveWriteSkipReason(); process.stdout.write(JSON.stringify({skipReason}));"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      PLAYWRIGHT_EXTERNAL_BASE_URL: "http://127.0.0.1:55173",
      PLAYWRIGHT_PR_SAFE: "false",
      MUSIC_E2E_LIVE_WRITE: "true",
      MUSIC_E2E_LIVE_WRITE_CONFIRMATION: "I_UNDERSTAND_THIS_MUTATES_A_DISPOSABLE_FIXTURE",
      MUSIC_E2E_FIXTURE_VERSION: MUSIC_PUBLIC_FIXTURE_VERSION,
      MUSIC_E2E_ACCOUNT_USERNAME: "e2e-public-music-sentinel-owner",
      MUSIC_E2E_ACCOUNT_DOCUMENT_ID: "e2e-public-music-sentinel-account",
      MUSIC_E2E_SERVICE_ORIGINS: "http://127.0.0.1:55173,http://127.0.0.1:55000,tcp://127.0.0.1:55432,http://127.0.0.1:51337,http://127.0.0.1:55174",
      MUSIC_E2E_STRAPI_TOKEN: "sentinel-authority-value",
    },
  });
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual({ skipReason: null });
});

test("live preflight runner invokes package-resolved authority before exact JSON collection", async () => {
  const { runLivePreflight } = await import("../scripts/music-public-live-preflight.mjs");
  const calls: Array<{ executable: string; args: string[]; options: Record<string, unknown> }> = [];
  const collection = JSON.stringify(playwrightJourneyReport());
  const outcome = runLivePreflight({
    spawn: (executable: string, args: string[], options: Record<string, unknown>) => {
      calls.push({ executable, args, options });
      return calls.length === 1
        ? preflightChild(0, JSON.stringify({ skipReason: null }))
        : preflightChild(0, collection);
    },
    processExecPath: process.execPath,
    tsxCli: "declared-package/tsx/cli.mjs",
    playwrightCli: "explorer-package/playwright/cli.js",
    project: "chromium-music-live",
    cwd: process.cwd(),
    environment: {
      ...process.env,
      MUSIC_E2E_STRAPI_TOKEN: "known-secret-value",
      PLAYWRIGHT_JSON_OUTPUT_FILE: "must-not-be-used-by-preflight.json",
    },
    workspaceRoot: process.cwd(),
    knownSecrets: ["known-secret-value"],
  });
  expect(outcome).toMatchObject({ ok: true, exitCode: 0, manifestVersion: LIVE_JOURNEY_MANIFEST_VERSION });
  expect(calls).toHaveLength(2);
  expect(calls[0]).toMatchObject({
    executable: process.execPath,
    args: [
      "declared-package/tsx/cli.mjs",
      "-e",
      expect.stringContaining("musicLiveWriteSkipReason"),
    ],
    options: { cwd: process.cwd(), encoding: "utf8", windowsHide: true },
  });
  expect(calls[1]).toMatchObject({
    executable: process.execPath,
    args: [
      "explorer-package/playwright/cli.js",
      "test",
      "--project=chromium-music-live",
      "--list",
      "--reporter=json",
    ],
    options: { cwd: process.cwd(), encoding: "utf8", windowsHide: true },
  });
  expect(calls[0].options.env).not.toHaveProperty("PLAYWRIGHT_JSON_OUTPUT_FILE");
  expect(calls[1].options.env).not.toHaveProperty("PLAYWRIGHT_JSON_OUTPUT_FILE");
});

test("real inert live-project JSON collection classifies exactly 17 mutations and 32 read-only cases", () => {
  const result = spawnSync(process.execPath, [
    "node_modules/@playwright/test/cli.js",
    "test",
    "--project=chromium-music-live",
    "--list",
    "--reporter=json",
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: inertLiveCollectionEnvironment(),
    maxBuffer: 16 * 1024 * 1024,
  });
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  const report = JSON.parse(result.stdout) as { suites?: JsonCollectionSuite[] };
  const specs = allJsonCollectionSpecs(report);
  const mutationTag = LIVE_MUTATION_TAG.replace(/^@/, "");
  const readOnlyTag = LIVE_READ_ONLY_TAG.replace(/^@/, "");
  const mutationSpecs = specs.filter(({ tags }) => tags.includes(mutationTag));
  const readOnlySpecs = specs.filter(({ tags }) => tags.includes(readOnlyTag));
  expect(specs).toHaveLength(49);
  expect(mutationSpecs).toHaveLength(17);
  expect(readOnlySpecs).toHaveLength(32);
  expect(specs.every(({ tags }) => Number(tags.includes(mutationTag)) + Number(tags.includes(readOnlyTag)) === 1)).toBe(true);
  expect(classifyLivePreflight({
    authorityResult: preflightChild(0, JSON.stringify({ skipReason: null })),
    collectionResult: result,
    workspaceRoot: process.cwd(),
    knownSecrets: ["sentinel-authority-value"],
  })).toMatchObject({
    ok: true,
    manifestVersion: LIVE_JOURNEY_MANIFEST_VERSION,
    journeyIds: EXPECTED_LIVE_JOURNEYS.map(({ id }) => id),
  });
});

test("production journey execution command writes JSON that terminal evidence validation consumes", async () => {
  const module = await import("../scripts/music-public-live-preflight.mjs") as unknown as Record<string, unknown>;
  const execute = module.runPlaywrightJourneyExecution;
  expect(typeof execute).toBe("function");
  if (typeof execute !== "function") return;

  const artifactRoot = resolve(".artifacts");
  mkdirSync(artifactRoot, { recursive: true });
  const syntheticRoot = mkdtempSync(join(artifactRoot, "journey-report-contract-"));
  const reportPath = join(syntheticRoot, "playwright-journey-results.json");
  const outputDirectory = join(syntheticRoot, "private-playwright-output");
  try {
    const testDirectory = join(syntheticRoot, "e2e");
    mkdirSync(testDirectory, { recursive: true });
    writeFileSync(join(syntheticRoot, "playwright.config.mjs"), [
      'import { defineConfig } from "@playwright/test";',
      'export default defineConfig({ testDir: "./e2e", reporter: "line", projects: [{ name: "synthetic-journey-report" }] });',
      "",
    ].join("\n"));
    for (const source of [
      "e2e/music-fixture-fullstack.spec.ts",
      "e2e/music-public-contract.spec.ts",
      "e2e/profile-theme.spec.ts",
    ]) {
      writeFileSync(join(syntheticRoot, source), syntheticJourneySpecSource(
        EXPECTED_LIVE_JOURNEYS.filter((entry) => entry.source === source),
        EXPECTED_LIVE_READ_ONLY.filter((entry) => entry.source === source),
      ));
    }

    const outcome = (execute as (input: Record<string, unknown>) => { status: number; executionReport?: unknown })({
      spawn: spawnSync,
      processExecPath: process.execPath,
      playwrightCli: resolve("node_modules/@playwright/test/cli.js"),
      files: [
        "e2e/music-fixture-fullstack.spec.ts",
        "e2e/music-public-contract.spec.ts",
        "e2e/profile-theme.spec.ts",
      ],
      project: "synthetic-journey-report",
      cwd: syntheticRoot,
      environment: { ...process.env },
      reportPath,
      outputDirectory,
    });
    expect(outcome.status).toBe(0);
    expect(outcome).toMatchObject({ reportStatus: "accepted", privateArtifactCleanup: "deleted" });
    expect(existsSync(reportPath)).toBe(false);
    expect(existsSync(outputDirectory)).toBe(false);
    expect(JSON.stringify(outcome).length).toBeLessThan(48 * 1024);
    expect(validateLiveJourneyEvidence({
      executionReport: outcome.executionReport,
      records: validJourneyEvidenceRecords(),
    })).toMatchObject({ ok: true });
  } finally {
    rmSync(syntheticRoot, { recursive: true, force: true });
  }
});

test("failing production child retains only bounded canonical evidence and deletes every private Playwright artifact", async () => {
  const artifactRoot = resolve(".artifacts");
  mkdirSync(artifactRoot, { recursive: true });
  const syntheticRoot = mkdtempSync(join(artifactRoot, "hostile-journey-report-contract-"));
  const reportPath = join(syntheticRoot, "playwright-journey-results.json");
  const outputDirectory = join(syntheticRoot, "private-playwright-output");
  const hostile = {
    title: EXPECTED_LIVE_JOURNEYS[0].title,
    bearer: "hostile.bearer.sentinel",
    accessToken: "hostile-access-token-sentinel",
    capability: "hostile-capability-sentinel",
    credential: "hostile-credential-sentinel",
    absolutePath: join(syntheticRoot, "private attachment", "hostile-secret.txt"),
  };
  try {
    const testDirectory = join(syntheticRoot, "e2e");
    mkdirSync(testDirectory, { recursive: true });
    writeFileSync(join(syntheticRoot, "playwright.config.mjs"), [
      'import { defineConfig } from "@playwright/test";',
      `export default defineConfig({ testDir: "./e2e", reporter: "line", outputDir: ${JSON.stringify(outputDirectory)}, projects: [{ name: "synthetic-hostile-report" }] });`,
      "",
    ].join("\n"));
    for (const source of [
      "e2e/music-fixture-fullstack.spec.ts",
      "e2e/music-public-contract.spec.ts",
      "e2e/profile-theme.spec.ts",
    ]) {
      writeFileSync(join(syntheticRoot, source), syntheticJourneySpecSource(
        EXPECTED_LIVE_JOURNEYS.filter((entry) => entry.source === source),
        EXPECTED_LIVE_READ_ONLY.filter((entry) => entry.source === source),
        hostile,
      ));
    }

    const wrapperPath = join(syntheticRoot, "run-production-execution.mjs");
    writeFileSync(wrapperPath, [
      'import { spawnSync } from "node:child_process";',
      `import { runPlaywrightJourneyExecution } from ${JSON.stringify(pathToFileURL(resolve("scripts/music-public-live-preflight.mjs")).href)};`,
      "const outcome = runPlaywrightJourneyExecution({",
      "  spawn: spawnSync,",
      `  processExecPath: ${JSON.stringify(process.execPath)},`,
      `  playwrightCli: ${JSON.stringify(resolve("node_modules/@playwright/test/cli.js"))},`,
      `  files: ${JSON.stringify(["e2e/music-fixture-fullstack.spec.ts", "e2e/music-public-contract.spec.ts", "e2e/profile-theme.spec.ts"])},`,
      '  project: "synthetic-hostile-report",',
      `  cwd: ${JSON.stringify(syntheticRoot)},`,
      "  environment: { ...process.env },",
      `  reportPath: ${JSON.stringify(reportPath)},`,
      `  outputDirectory: ${JSON.stringify(outputDirectory)},`,
      "});",
      "process.stdout.write(JSON.stringify(outcome));",
      "",
    ].join("\n"));

    const result = spawnSync(process.execPath, [wrapperPath], {
      cwd: syntheticRoot,
      encoding: "utf8",
      env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
      maxBuffer: 16 * 1024 * 1024,
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const outcome = JSON.parse(result.stdout) as {
      status: number;
      reportStatus?: string;
      privateArtifactCleanup?: string;
      executionReport?: unknown;
    };
    expect(outcome).toMatchObject({
      status: expect.any(Number),
      reportStatus: "accepted",
      privateArtifactCleanup: "deleted",
    });
    expect(outcome.status).not.toBe(0);
    expect(existsSync(reportPath)).toBe(false);
    expect(existsSync(outputDirectory)).toBe(false);
    expect(JSON.stringify(outcome).length).toBeLessThan(48 * 1024);
    expect(validateLiveJourneyEvidence({
      executionReport: outcome.executionReport,
      records: validJourneyEvidenceRecords(),
    })).toMatchObject({ ok: false, subcheck: "execution-status" });

    const terminal = await runSyntheticTerminalOutcome(outcome, "hostile-private-report");
    expect(terminal.outcome).toMatchObject({
      exitCode: 5,
      report: {
        result: "failed",
        cleanup: "evidence-missing",
        journeyReportStatus: "accepted",
        journeyArtifactCleanup: "deleted",
        journeyDiagnostics: { subcheck: "execution-status" },
      },
    });
    expect(JSON.stringify(terminal.outcome.report).length).toBeLessThan(16 * 1024);

    const retained = `${result.stdout}\n${result.stderr}\n${JSON.stringify(outcome)}\n${terminal.retained}`;
    for (const secret of [hostile.bearer, hostile.accessToken, hostile.capability, hostile.credential]) {
      expect(retained).not.toContain(secret);
    }
    expect(retained).not.toContain(hostile.absolutePath);
    expect(retained.replaceAll("\\", "/")).not.toContain(hostile.absolutePath.replaceAll("\\", "/"));
    expect(retained).not.toContain("hostile-output-hostile-output-hostile-output");
  } finally {
    rmSync(syntheticRoot, { recursive: true, force: true });
  }
});

test("unknown hostile mutation identity is replaced by fixed sentinels before manifest validation", async () => {
  const module = await import("../scripts/music-public-live-preflight.mjs") as unknown as Record<string, unknown>;
  const execute = module.runPlaywrightJourneyExecution;
  expect(typeof execute).toBe("function");
  if (typeof execute !== "function") return;

  const hostileTitle = "Bearer hostile.unknown.token access_token=unknown-access credential=unknown-credential";
  const hostileSource = resolve("private hostile source", "capability=unknown-capability.spec.ts");
  const entries = EXPECTED_LIVE_JOURNEYS.map((entry, index) => index === 0
    ? { ...entry, title: hostileTitle, source: hostileSource }
    : entry);
  const reportPath = resolve("guarded/run-hostile-identity/playwright-journey-results.json");
  const outputDirectory = resolve("guarded/run-hostile-identity/private-playwright-output");
  const calls: string[] = [];
  const outcome = (execute as (input: Record<string, unknown>) => {
    status: number;
    reportStatus?: string;
    privateArtifactCleanup?: string;
    executionReport?: unknown;
  })({
    spawn: () => ({ status: 0 }),
    processExecPath: process.execPath,
    playwrightCli: "playwright-cli.js",
    files: ["e2e/profile-theme.spec.ts"],
    project: "synthetic-private-report",
    cwd: process.cwd(),
    environment: { ...process.env },
    reportPath,
    outputDirectory,
    privateArtifactIo: {
      exists: (path: string) => { calls.push(`exists:${path}`); return true; },
      size: (path: string) => { calls.push(`size:${path}`); return 4096; },
      read: (path: string) => { calls.push(`read:${path}`); return JSON.stringify(playwrightJourneyReport(entries, { resultStatus: "passed" })); },
      unlink: (path: string) => { calls.push(`unlink:${path}`); },
      removeDirectory: (path: string) => { calls.push(`remove-directory:${path}`); },
    },
  });
  expect(outcome).toMatchObject({ status: 0, reportStatus: "accepted", privateArtifactCleanup: "deleted" });
  expect(validateLiveJourneyEvidence({
    executionReport: outcome.executionReport,
    records: validJourneyEvidenceRecords(),
  })).toMatchObject({ ok: false, subcheck: "manifest-unknown" });
  const terminal = await runSyntheticTerminalOutcome(outcome, "hostile-identity");
  expect(terminal.outcome).toMatchObject({
    exitCode: 5,
    report: {
      result: "failed",
      cleanup: "evidence-missing",
      journeyDiagnostics: { subcheck: "manifest-unknown" },
    },
  });
  const retained = `${JSON.stringify(outcome)}\n${terminal.retained}`;
  expect(retained).not.toContain(hostileTitle);
  expect(retained).not.toContain(hostileSource);
  expect(retained.replaceAll("\\", "/")).not.toContain(hostileSource.replaceAll("\\", "/"));
  expect(retained).not.toMatch(/unknown-(?:access|credential|capability)/);
  expect(JSON.stringify(terminal.outcome.report).length).toBeLessThan(16 * 1024);
  expect(calls).toEqual([
    `exists:${reportPath}`,
    `size:${reportPath}`,
    `read:${reportPath}`,
    `exists:${reportPath}`,
    `unlink:${reportPath}`,
    `exists:${outputDirectory}`,
    `remove-directory:${outputDirectory}`,
  ]);
});

test("private raw report size and parse failures are rejected before retention and deleted in finally", async () => {
  const module = await import("../scripts/music-public-live-preflight.mjs") as unknown as Record<string, unknown>;
  const execute = module.runPlaywrightJourneyExecution;
  expect(typeof execute).toBe("function");
  if (typeof execute !== "function") return;

  for (const failure of ["too-large", "parse-failed"] as const) {
    const calls: string[] = [];
    let reads = 0;
    const reportPath = resolve(`guarded/run-${failure}/playwright-journey-results.json`);
    const outputDirectory = resolve(`guarded/run-${failure}/private-playwright-output`);
    const outcome = (execute as (input: Record<string, unknown>) => {
      status: number;
      reportStatus?: string;
      privateArtifactCleanup?: string;
      executionReport?: unknown;
    })({
      spawn: () => ({ status: 0 }),
      processExecPath: process.execPath,
      playwrightCli: "playwright-cli.js",
      files: ["e2e/profile-theme.spec.ts"],
      project: "synthetic-private-report",
      cwd: process.cwd(),
      environment: { ...process.env },
      reportPath,
      outputDirectory,
      privateArtifactIo: {
        exists: (path: string) => { calls.push(`exists:${path}`); return true; },
        size: (path: string) => { calls.push(`size:${path}`); return failure === "too-large" ? 64 * 1024 * 1024 : 12; },
        read: (path: string) => { calls.push(`read:${path}`); reads += 1; return "{not-json"; },
        unlink: (path: string) => { calls.push(`unlink:${path}`); },
        removeDirectory: (path: string) => { calls.push(`remove-directory:${path}`); },
      },
    });
    expect(outcome).toMatchObject({
      status: expect.any(Number),
      reportStatus: failure,
      privateArtifactCleanup: "deleted",
    });
    expect(outcome.status, failure).not.toBe(0);
    expect(outcome.executionReport, failure).toBeUndefined();
    expect(reads, failure).toBe(failure === "too-large" ? 0 : 1);
    expect(calls, failure).toEqual([
      `exists:${reportPath}`,
      `size:${reportPath}`,
      ...(failure === "too-large" ? [] : [`read:${reportPath}`]),
      `exists:${reportPath}`,
      `unlink:${reportPath}`,
      `exists:${outputDirectory}`,
      `remove-directory:${outputDirectory}`,
    ]);
    const terminal = await runSyntheticTerminalOutcome(outcome, `private-report-${failure}`);
    expect(terminal.outcome).toMatchObject({
      exitCode: 5,
      report: {
        result: "failed",
        cleanup: "evidence-missing",
        journeyReportStatus: failure,
        journeyArtifactCleanup: "deleted",
        journeyDiagnostics: { subcheck: `execution-report-${failure}` },
      },
    });
  }
});

test("first private report deletion failure is evidence-missing while restore and every teardown step still run", async () => {
  const module = await import("../scripts/music-public-live-preflight.mjs") as unknown as Record<string, unknown>;
  const execute = module.runPlaywrightJourneyExecution;
  expect(typeof execute).toBe("function");
  if (typeof execute !== "function") return;

  const reportPath = resolve("guarded/run-delete-failure/playwright-journey-results.json");
  const outputDirectory = resolve("guarded/run-delete-failure/private-playwright-output");
  const helperCalls: string[] = [];
  const executionOutcome = (execute as (input: Record<string, unknown>) => {
    status: number;
    reportStatus?: string;
    privateArtifactCleanup?: string;
    executionReport?: unknown;
  })({
    spawn: () => ({ status: 0 }),
    processExecPath: process.execPath,
    playwrightCli: "playwright-cli.js",
    files: ["e2e/profile-theme.spec.ts"],
    project: "synthetic-private-report",
    cwd: process.cwd(),
    environment: { ...process.env },
    reportPath,
    outputDirectory,
    privateArtifactIo: {
      exists: (path: string) => { helperCalls.push(`exists:${path}`); return true; },
      size: (path: string) => { helperCalls.push(`size:${path}`); return 1024; },
      read: (path: string) => { helperCalls.push(`read:${path}`); return JSON.stringify(playwrightJourneyReport(EXPECTED_LIVE_JOURNEYS, { resultStatus: "passed" })); },
      unlink: (path: string) => { helperCalls.push(`unlink:${path}`); throw new Error("Bearer private-delete-secret"); },
      removeDirectory: (path: string) => { helperCalls.push(`remove-directory:${path}`); },
    },
  });
  expect(executionOutcome).toMatchObject({
    status: expect.any(Number),
    reportStatus: "accepted",
    privateArtifactCleanup: "delete-failed",
  });
  expect(executionOutcome.status).not.toBe(0);
  expect(helperCalls).toEqual([
    `exists:${reportPath}`,
    `size:${reportPath}`,
    `read:${reportPath}`,
    `exists:${reportPath}`,
    `unlink:${reportPath}`,
    `exists:${outputDirectory}`,
    `remove-directory:${outputDirectory}`,
  ]);

  const finalHash = "e".repeat(64);
  const teardownCalls: string[] = [];
  const outcome = await runMusicFixtureOrchestration({
    snapshotExists: true,
    baseReport: { version: MUSIC_PUBLIC_FIXTURE_VERSION, runId: "private-delete-failure", lane: "live" },
    artifacts: {
      directory: "guarded/run-delete-failure",
      authPath: "owner-auth.json",
      storagePath: "profile-storage-state.json",
      mkdir: () => undefined,
      write: () => undefined,
      chmod: () => undefined,
    },
    restoreEvidence: {
      path: "restore-evidence.jsonl",
      exists: () => true,
      read: () => validJourneyEvidenceRecords().map((record) => JSON.stringify(record)).join("\n"),
    },
    execute: async () => executionOutcome,
    restore: async () => {
      teardownCalls.push("initial-restore");
      return { ok: true, cleanup: "restored", beforeHash: finalHash, afterHash: finalHash };
    },
    teardown: {
      artifactPaths: [reportPath, "owner-auth.json", "profile-storage-state.json"],
      artifactDirectories: [outputDirectory],
      exists: (path: string) => { teardownCalls.push(`exists:${path}`); return true; },
      unlink: (path: string) => { teardownCalls.push(`unlink:${path}`); },
      removeDirectory: (path: string) => { teardownCalls.push(`remove-directory:${path}`); },
      stopStateService: () => { teardownCalls.push("state-service-stop"); },
      down: () => { teardownCalls.push("exact-fixture-down"); return 0; },
    },
    writeReport: async () => undefined,
    writeStdout: () => undefined,
    writeStderr: () => undefined,
  });
  expect(teardownCalls).toEqual([
    "initial-restore",
    `exists:${reportPath}`,
    `unlink:${reportPath}`,
    "exists:owner-auth.json",
    "unlink:owner-auth.json",
    "exists:profile-storage-state.json",
    "unlink:profile-storage-state.json",
    `exists:${outputDirectory}`,
    `remove-directory:${outputDirectory}`,
    "state-service-stop",
    "exact-fixture-down",
  ]);
  expect(outcome).toMatchObject({
    exitCode: 5,
    teardownStatus: 0,
    report: {
      result: "failed",
      cleanup: "evidence-missing",
      journeyArtifactCleanup: "delete-failed",
    },
  });
});

test("clean PR-safe collection does not require live Music environment", () => {
  const env = { ...process.env, PLAYWRIGHT_PR_SAFE: "true" };
  for (const key of Object.keys(env)) if (key.startsWith("MUSIC_E2E_")) delete env[key];
  const result = spawnSync(process.execPath, ["node_modules/@playwright/test/cli.js", "test", "--list", "--project=chromium-music-fixture", "e2e/music-fixture-fullstack.spec.ts", "e2e/music-public-contract.spec.ts"], {
    cwd: process.cwd(), encoding: "utf8", env,
  });
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  expect(result.stdout).toContain("Total:");
});

test("live callback token is required only after the complete authority tuple", () => {
  const authority = {
    PLAYWRIGHT_EXTERNAL_BASE_URL: "http://127.0.0.1:55173",
    MUSIC_E2E_LIVE_WRITE: "true",
    MUSIC_E2E_LIVE_WRITE_CONFIRMATION: "I_UNDERSTAND_THIS_MUTATES_A_DISPOSABLE_FIXTURE",
    MUSIC_E2E_FIXTURE_VERSION: MUSIC_PUBLIC_FIXTURE_VERSION,
    MUSIC_E2E_ACCOUNT_USERNAME: "e2e-public-music-contract-owner",
    MUSIC_E2E_ACCOUNT_DOCUMENT_ID: "e2e-public-music-contract-account",
    MUSIC_E2E_SERVICE_ORIGINS: "http://127.0.0.1:55173,http://127.0.0.1:55000",
  };
  expect(() => musicLiveStrapiTokenFromEnvironment(authority)).toThrow(/MUSIC_E2E_STRAPI_TOKEN/);
  expect(musicLiveStrapiTokenFromEnvironment({ ...authority, MUSIC_E2E_STRAPI_TOKEN: "contract-token-0123456789" })).toBe("contract-token-0123456789");
});

test("Playwright and CI configuration do not inject or require a live callback token", () => {
  const config = readFileSync("playwright.config.ts", "utf8");
  const workflow = readFileSync("../.github/workflows/tunes.yml", "utf8");
  expect(config).not.toContain("fixture-read-only-token");
  expect(config).not.toContain("MUSIC_E2E_STRAPI_TOKEN ??=");
  expect(workflow).not.toMatch(/MUSIC_E2E_STRAPI_TOKEN:\s*\$\{\{/);
});

test("PR-safe execution cannot acquire live-write authority", () => {
  expect(resolveMusicTestLane({ PLAYWRIGHT_PR_SAFE: "true", MUSIC_E2E_LIVE_WRITE: "true" })).toBe("pr-safe");
  expect(() => assertLiveWriteAuthority({
    lane: "pr-safe",
    liveWriteEnabled: true,
    baseUrl: "http://127.0.0.1:55173",
    serviceOrigins: ["http://127.0.0.1:55173", "http://127.0.0.1:53001"],
    accountDocumentId: "e2e-public-music-run-123-account",
    accountUsername: "e2e-public-music-run-123-owner",
    fixtureVersion: MUSIC_PUBLIC_FIXTURE_VERSION,
    confirmation: "I_UNDERSTAND_THIS_MUTATES_A_DISPOSABLE_FIXTURE",
  })).toThrow(/PR-safe lane cannot acquire live-write authority/);
});

test("live authority is restricted to a namespaced loopback fixture", () => {
  expect(() => assertLiveWriteAuthority({
    lane: "live",
    liveWriteEnabled: true,
    baseUrl: "https://explorers.earth",
    serviceOrigins: ["http://127.0.0.1:53001"],
    accountDocumentId: "real-account",
    accountUsername: "real-user",
    fixtureVersion: MUSIC_PUBLIC_FIXTURE_VERSION,
    confirmation: "I_UNDERSTAND_THIS_MUTATES_A_DISPOSABLE_FIXTURE",
  })).toThrow(/service origin.*disposable loopback/);

  expect(assertLiveWriteAuthority({
    lane: "live",
    liveWriteEnabled: true,
    baseUrl: "http://127.0.0.1:55173",
    serviceOrigins: ["http://127.0.0.1:55173", "http://localhost:53001"],
    accountDocumentId: `${fixtureNamespace("run-123")}-account`,
    accountUsername: `${fixtureNamespace("run-123")}-owner`,
    fixtureVersion: MUSIC_PUBLIC_FIXTURE_VERSION,
    confirmation: "I_UNDERSTAND_THIS_MUTATES_A_DISPOSABLE_FIXTURE",
  })).toMatchObject({ authorized: true, namespace: fixtureNamespace("run-123") });
});

test("live authority requires the flag, exact fixture version, account document, and every service on loopback", () => {
  const valid = {
    lane: "live" as const,
    liveWriteEnabled: true,
    baseUrl: "http://127.0.0.1:55173",
    serviceOrigins: ["http://127.0.0.1:55173", "http://localhost:53001"],
    accountDocumentId: "e2e-public-music-run-123-account",
    accountUsername: "e2e-public-music-run-123-owner",
    fixtureVersion: MUSIC_PUBLIC_FIXTURE_VERSION,
    confirmation: "I_UNDERSTAND_THIS_MUTATES_A_DISPOSABLE_FIXTURE",
  };
  expect(() => assertLiveWriteAuthority({ ...valid, liveWriteEnabled: false })).toThrow(/MUSIC_E2E_LIVE_WRITE=true/);
  expect(() => assertLiveWriteAuthority({ ...valid, fixtureVersion: "wrong" })).toThrow(/fixture version/);
  expect(() => assertLiveWriteAuthority({ ...valid, accountDocumentId: "account-1" })).toThrow(/document ID/);
  expect(() => assertLiveWriteAuthority({ ...valid, serviceOrigins: [...valid.serviceOrigins, "https://tunes.example"] }))
    .toThrow(/service origin/);
});

test("live authority accepts owned PostgreSQL TCP and rejects remote TCP", () => {
  const valid = {
    lane: "live" as const, liveWriteEnabled: true, baseUrl: "http://127.0.0.1:55173",
    accountDocumentId: "e2e-public-music-contract-account", accountUsername: "e2e-public-music-contract-owner",
    fixtureVersion: MUSIC_PUBLIC_FIXTURE_VERSION, confirmation: "I_UNDERSTAND_THIS_MUTATES_A_DISPOSABLE_FIXTURE",
  };
  expect(assertLiveWriteAuthority({ ...valid, serviceOrigins: ["tcp://127.0.0.1:55432", "http://127.0.0.1:55000"] })).toMatchObject({ authorized: true });
  expect(() => assertLiveWriteAuthority({ ...valid, serviceOrigins: ["tcp://db.example:5432"] })).toThrow(/loopback/);
});

test("every declared mutation callsite passes through the centralized authority gate", async () => {
  expect(MUSIC_MUTATION_CALLSITES).toEqual(expect.arrayContaining([
    "owner-publication", "playlist-create", "playlist-song-add", "playlist-visibility",
    "queue-replace", "guest-controls", "song-request", "request-accept", "request-revoke", "guest-playback",
  ]));
  let invoked = false;
  await expect(runAuthorizedMusicMutation({
    lane: "fixture",
    liveWriteEnabled: false,
    baseUrl: "http://127.0.0.1:55173",
    serviceOrigins: ["http://127.0.0.1:55173"],
    accountDocumentId: "e2e-public-music-run-account",
    accountUsername: "e2e-public-music-run-owner",
    fixtureVersion: MUSIC_PUBLIC_FIXTURE_VERSION,
    confirmation: "I_UNDERSTAND_THIS_MUTATES_A_DISPOSABLE_FIXTURE",
  }, "queue-replace", async () => { invoked = true; })).rejects.toThrow(/Live writes require the live lane/);
  expect(invoked).toBe(false);
});

test("real Music API mutation callsites have no direct authority bypass", () => {
  for (const relativePath of ["e2e/music-public-contract.spec.ts", "e2e/music-fixture-fullstack.spec.ts"]) {
    const source = readFileSync(relativePath, "utf8");
    const directMutationLines = source.split(/\r?\n/).filter((line) => /page\.request\.(post|patch|put|delete)\(/.test(line));
    expect(directMutationLines, relativePath).not.toEqual([]);
    expect(directMutationLines, relativePath).toEqual(
      directMutationLines.filter((line) => line.includes("guardedMutation(")),
    );
  }
  const fullstack = readFileSync("e2e/music-fixture-fullstack.spec.ts", "utf8");
  expect(fullstack).toContain('runAuthorizedMusicMutation(musicLiveAuthorityFromEnvironment(), "playlist-song-add"');
  expect(fullstack).toContain('runAuthorizedMusicMutation(musicLiveAuthorityFromEnvironment(), "guest-controls"');
});

test("fixture contract is versioned and contains every required deterministic state", () => {
  expect(MUSIC_PUBLIC_FIXTURE_VERSION).toBe("music-public-e2e-fixture/v1");
  expect(MUSIC_PUBLIC_STATES).toEqual([
    "public", "unlisted", "private", "suspended", "tombstoned", "all-content",
    "empty", "queue-only", "playlists-only", "history-only", "request-allowed",
    "request-rate-limited",
  ]);
});

test("permission fixture enumerates all 32 combinations with stable names", () => {
  const rows = buildPermissionMatrix();
  expect(rows).toHaveLength(32);
  expect(new Set(rows.map((row) => row.key)).size).toBe(32);
  expect(rows[0]).toEqual({
    key: "00000",
    allowSongRequests: false,
    allowGuestPlayOnDevice: false,
    allowPlaylistSharing: false,
    allowRecentlyPlayedVisibility: false,
    allowQueueVisibility: false,
  });
  expect(rows[31]?.key).toBe("11111");
});

test("pairwise permission rows cover every binary interaction", () => {
  const rows = buildPairwisePermissionMatrix();
  const fields = ["allowSongRequests", "allowGuestPlayOnDevice", "allowPlaylistSharing", "allowRecentlyPlayedVisibility", "allowQueueVisibility"] as const;
  expect(rows.length).toBeLessThan(32);
  for (let left = 0; left < fields.length; left += 1) for (let right = left + 1; right < fields.length; right += 1) {
    expect(new Set(rows.map((row) => `${row[fields[left]!]}:${row[fields[right]!]}`))).toEqual(new Set(["false:false", "false:true", "true:false", "true:true"]));
  }
});

test("Playwright exposes explicit read-only, fixture, live, and visual projects", () => {
  const names = playwrightConfig.projects?.map((project) => project.name);
  expect(names).toEqual(expect.arrayContaining([
    "chromium-pr-safe",
    "chromium-music-fixture",
    "chromium-music-live",
    "firefox-music-visual",
    "webkit-music-visual",
  ]));
  expect(playwrightConfig.testIgnore).toBeUndefined();
});

test("failure evidence is retained without recording successful runs", () => {
  expect(playwrightConfig.use?.trace).toBe("retain-on-failure");
  expect(playwrightConfig.use?.screenshot).toBe("only-on-failure");
  expect(playwrightConfig.use?.video).toBe("retain-on-failure");
});

test("snapshot hashes ignore volatile fields but detect restorable state drift", () => {
  const before = {
    capturedAt: "2026-08-29T01:00:00.000Z",
    requestId: "secret-request-a",
    publication: { mode: "public", publicSlug: "fixture-public" },
    permissions: { allowSongRequests: true },
    queue: [{ publicId: "song-a", title: "One" }],
  };
  const after = { ...before, capturedAt: "2026-08-29T02:00:00.000Z", requestId: "secret-request-b" };
  expect(normalizedSnapshotHash(before)).toBe(normalizedSnapshotHash(after));
  expect(normalizedSnapshotHash({ ...after, publication: { mode: "private", publicSlug: "fixture-public" } }))
    .not.toBe(normalizedSnapshotHash(before));
});

test("fixture evidence prints useful metadata without capabilities or credentials", () => {
  const evidence = buildSanitizedFixtureEvidence({
    runId: "run-123",
    lane: "fixture",
    accountDocumentId: "fixture-account-document",
    username: "e2e-public-music-run-123-owner",
    explorerUrl: "http://127.0.0.1:55173/e2e-public-music-run-123",
    shareUrl: `http://127.0.0.1:55173/music/share/public-slug#${"A".repeat(43)}`,
    result: "passed",
    cleanup: "restored",
    evidencePath: ".artifacts/music-public/run-123/evidence.json",
  });
  expect(evidence).toMatchObject({
    version: "music-public-e2e-fixture/v1",
    lane: "fixture",
    result: "passed",
    cleanup: "restored",
  });
  expect(JSON.stringify(evidence)).not.toContain("A".repeat(43));
  expect(evidence.shareUrl).toBe("http://127.0.0.1:55173/music/share/public-slug");
});

test("developer fixture command prints a sanitized, versioned dry-run contract", () => {
  const sandbox = mkdtempSync(join(tmpdir(), "music-public-dry-run-"));
  try {
    const runner = resolve("scripts/music-public-e2e.mjs");
    const result = spawnSync(process.execPath, [runner, "verify", "--dry-run"], {
      cwd: sandbox,
      encoding: "utf8",
      env: { ...process.env, MUSIC_PUBLIC_RUN_ID: "contract-run" },
      windowsHide: true,
    });
    expect(result.status, result.stderr).toBe(0);
    const report = JSON.parse(result.stdout.trim()) as Record<string, unknown>;
    expect(report).toMatchObject({
      version: "music-public-e2e-fixture/v1",
      lane: "fixture",
      result: "dry-run",
      cleanup: "not-required",
    });
    expect(report).toHaveProperty("services");
    expect(JSON.stringify(report)).not.toContain('"postgres":"fixture-owned"');
    expect(report).toHaveProperty("accountDocumentId", "not-configured");
    expect(report).toHaveProperty("username", "not-configured");
    expect(report).toHaveProperty("evidencePath", ".artifacts/music-public/contract-run/evidence.json");

    const runDirectory = join(sandbox, ".artifacts", "music-public", "contract-run");
    const verify = spawnSync(process.execPath, [
      resolve("scripts/music-public-qualification-artifacts.mjs"), "verify", runDirectory,
    ], { cwd: sandbox, encoding: "utf8", windowsHide: true });
    expect(verify.status, `${verify.stdout}\n${verify.stderr}`).toBe(0);
    expect(JSON.parse(verify.stdout)).toMatchObject({ files: 14, manifestSha256: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(JSON.parse(readFileSync(join(runDirectory, "analytics-events.jsonl"), "utf8"))).toEqual({
      schemaVersion: "explorers-public-analytics-ledger/v1",
      status: "unavailable",
      reason: "not-observed",
      events: [],
    });
    expect(JSON.parse(readFileSync(join(runDirectory, "docker-inspection.json"), "utf8"))).toMatchObject({
      schemaVersion: "explorers-public-docker-inspection/v1",
      status: "unavailable",
      reason: "dry-run",
      cwd: "<workspace>",
      exitCodes: { containers: null, volumes: null },
      containerMatches: [],
      volumeMatches: [],
      containersRemaining: null,
      volumesRemaining: null,
    });
    expect(JSON.parse(readFileSync(join(runDirectory, "skip-reasons.json"), "utf8"))).toEqual({
      schemaVersion: "explorers-public-skip-ledger/v1",
      lane: "fixture",
      execution: "not-run",
      totals: { total: 0, passed: 0, failed: 0, skipped: 0 },
      reasons: [{ scope: "lane", reason: "not-observed" }],
    });
    expect(JSON.parse(readFileSync(join(runDirectory, "restoration.json"), "utf8"))).toEqual({
      schemaVersion: "explorers-public-restoration/v1",
      status: "unavailable",
      finalRestore: null,
      journeys: [],
    });
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

test("qualification run allocation refuses a reused run ID before any fixture action", () => {
  // Production break caught: a repeated run ID reopens the same directory and
  // can replace evidence that a reviewer already treated as immutable.
  const sandbox = mkdtempSync(join(tmpdir(), "music-public-exclusive-run-"));
  try {
    const environment = {
      ...process.env,
      MUSIC_PUBLIC_RUN_ID: "exclusive-contract-run",
      MUSIC_E2E_LIVE_WRITE: "true",
      MUSIC_E2E_LIVE_WRITE_CONFIRMATION: "I_UNDERSTAND_THIS_MUTATES_A_DISPOSABLE_FIXTURE",
      MUSIC_E2E_FIXTURE_VERSION: MUSIC_PUBLIC_FIXTURE_VERSION,
      MUSIC_E2E_ACCOUNT_USERNAME: "e2e-public-music-exclusive-contract-owner",
      MUSIC_E2E_ACCOUNT_DOCUMENT_ID: "e2e-public-music-exclusive-contract-account",
      MUSIC_E2E_USER_DOCUMENT_ID: "e2e-public-music-exclusive-contract-user",
      MUSIC_E2E_STRAPI_URL: "http://127.0.0.1:51337",
      MUSIC_E2E_STRAPI_TOKEN: "exclusive-contract-private-token",
      MUSIC_E2E_NAMESPACE_RESET_CONFIRMATION: "RESET_EXPLORERS_MUSIC_FIXTURE_NAMESPACE",
      MUSIC_E2E_SERVICE_ORIGINS: [
        "http://127.0.0.1:55173",
        "http://127.0.0.1:55000",
        "tcp://127.0.0.1:55432",
        "http://127.0.0.1:51337",
        "http://127.0.0.1:55174",
      ].join(","),
      MUSIC_E2E_HEALTH_URLS: [
        "http://127.0.0.1:55173/health",
        "http://127.0.0.1:55000/health",
        "tcp://127.0.0.1:55432",
        "http://127.0.0.1:51337/health",
        "http://127.0.0.1:55174/health",
      ].join(","),
    };
    const invoke = () => spawnSync(process.execPath, [
      resolve("scripts/music-public-e2e.mjs"),
      "live",
      "--dry-run",
    ], { cwd: sandbox, env: environment, encoding: "utf8", windowsHide: true });

    const first = invoke();
    expect(first.status, `${first.stdout}\n${first.stderr}`).toBe(0);
    expect(existsSync(join(sandbox, ".artifacts", "music-public", "exclusive-contract-run"))).toBe(true);

    const second = invoke();
    expect(second.status).toBe(5);
    expect(second.stderr).toBe("Live public Music E2E artifact initialization failed; details redacted.\n");
    expect(`${second.stdout}\n${second.stderr}`).not.toContain(sandbox);
    expect(`${second.stdout}\n${second.stderr}`).not.toContain("exclusive-contract-private-token");
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

for (const lifecycleCase of [
  {
    name: "bootstrap partial creation",
    runId: "bootstrap-partial-contract",
    scenario: "bootstrap-partial",
    dockerMode: "clean",
    expectedExit: 4,
    expectedCleanup: "not-required-safe",
    expectedStages: ["fixture-bootstrap", "fixture-down"],
  },
  {
    name: "up partial creation",
    runId: "up-partial-contract",
    scenario: "up-partial",
    dockerMode: "clean",
    expectedExit: 4,
    expectedCleanup: "not-required-safe",
    expectedStages: ["fixture-bootstrap", "fixture-up", "fixture-down"],
  },
  {
    name: "exact down failure",
    runId: "down-failure-contract",
    scenario: "bootstrap-down-failure",
    dockerMode: "clean",
    expectedExit: 5,
    expectedCleanup: "teardown-failed",
    expectedStages: ["fixture-bootstrap", "fixture-down"],
  },
  {
    name: "Docker inspection unavailable",
    runId: "docker-unavailable-contract",
    scenario: "bootstrap-no-resource",
    dockerMode: "unavailable",
    expectedExit: 5,
    expectedCleanup: "cleanup-inspection-failed",
    expectedStages: ["fixture-bootstrap", "fixture-down"],
  },
  {
    name: "Docker residue",
    runId: "docker-residue-contract",
    scenario: "bootstrap-no-resource",
    dockerMode: "residue",
    expectedExit: 5,
    expectedCleanup: "cleanup-inspection-failed",
    expectedStages: ["fixture-bootstrap", "fixture-down"],
  },
  {
    name: "verified no-resource cleanup",
    runId: "no-resource-contract",
    scenario: "bootstrap-no-resource",
    dockerMode: "clean",
    expectedExit: 4,
    expectedCleanup: "not-required-safe",
    expectedStages: ["fixture-bootstrap", "fixture-down"],
  },
] as const) {
  test(`early fixture failure finalizes exact cleanup evidence for ${lifecycleCase.name}`, () => {
    // Production break caught: a failed bootstrap/up could leave partial resources,
    // skip exact down, inherit raw child output, and still preserve exit 4 without cleanup proof.
    const sandbox = mkdtempSync(join(tmpdir(), "music-public-lifecycle-contract-"));
    try {
      const { fakeNpmPath, fakeDockerHookPath, binDirectory } = writeLifecycleContractShims(sandbox);
      const privateValue = `private-${lifecycleCase.runId}-value`;
      const environment = lifecycleFreshProcessEnvironment({
        sandbox,
        runId: lifecycleCase.runId,
        fakeNpmPath,
        fakeDockerHookPath,
        binDirectory,
        scenario: lifecycleCase.scenario,
        dockerMode: lifecycleCase.dockerMode,
        privateValue,
      });
      const result = spawnSync(process.execPath, [resolve("scripts/music-public-e2e.mjs"), "live"], {
        cwd: sandbox,
        env: environment,
        encoding: "utf8",
        windowsHide: true,
      });
      const runDirectory = join(sandbox, ".artifacts", "music-public", lifecycleCase.runId);
      expect(existsSync(join(runDirectory, "evidence.json")), `${result.stdout}\n${result.stderr}`).toBe(true);
      const evidence = JSON.parse(readFileSync(join(runDirectory, "evidence.json"), "utf8"));
      const dockerInspection = JSON.parse(readFileSync(join(runDirectory, "docker-inspection.json"), "utf8"));
      expect(result.status, `${result.stdout}\n${result.stderr}\n${JSON.stringify({ evidence, dockerInspection })}`)
        .toBe(lifecycleCase.expectedExit);
      expect(`${result.stdout}\n${result.stderr}`).not.toContain(privateValue);
      expect(`${result.stdout}\n${result.stderr}`).not.toContain(sandbox);
      expect(readFileSync(environment.FAKE_LIFECYCLE_LOG, "utf8").trim().split(/\r?\n/))
        .toEqual(lifecycleCase.expectedStages.map((stage) => stage.replace("fixture-", "")));
      expect(existsSync(environment.FAKE_RESOURCE_MARKER)).toBe(false);

      expect(evidence).toMatchObject({
        result: "failed",
        cleanup: lifecycleCase.expectedCleanup,
        exitCode: lifecycleCase.expectedExit,
      });
      expect(evidence.lifecycleCommands.map(({ stage }: { stage: string }) => stage))
        .toEqual(lifecycleCase.expectedStages);
      expect(evidence.lifecycleCommands.every((record: Record<string, unknown>) => (
        JSON.stringify(record).includes(privateValue) === false
      ))).toBe(true);
      const retainedStreamFiles = AUTHORITATIVE_QUALIFICATION_STREAMS.map((definition) => (
        readFileSync(join(runDirectory, ...definition.path.split("/")), "utf8")
      ));
      const retainedStreams = retainedStreamFiles.join("\n");
      expect(retainedStreams).toContain("<redacted>");
      expect(retainedStreams).toContain("<path>");
      expect(retainedStreams).not.toContain(privateValue);
      expect(retainedStreams).not.toContain(sandbox);
      expect(retainedStreamFiles.every((stream) => Buffer.byteLength(stream) <= 4_096)).toBe(true);
      expect(evidence.streams).toHaveLength(8);
      expect(evidence.streams.filter(({ status }: { status: string }) => status === "captured")
        .map(({ source, stream }: { source: string; stream: string }) => `${source}:${stream}`))
        .toEqual(lifecycleCase.expectedStages.flatMap((stage) => [`${stage}:stdout`, `${stage}:stderr`]));

      const verified = spawnSync(process.execPath, [
        resolve("scripts/music-public-qualification-artifacts.mjs"), "verify", runDirectory,
      ], { cwd: sandbox, encoding: "utf8", windowsHide: true });
      expect(verified.status, `${verified.stdout}\n${verified.stderr}`).toBe(0);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });
}

test("fresh runner routes asynchronous state-service exit through one exact cleanup and finalizer", () => {
  // Production break caught: an asynchronously failed state-service child had no
  // terminal listener, so another readiness branch could finalize first and call
  // an already-exited process safe without recording why it died.
  const sandbox = mkdtempSync(join(tmpdir(), "music-public-state-exit-contract-"));
  try {
    const runId = "state-service-exit-contract";
    const { fakeNpmPath, fakeDockerHookPath, binDirectory } = writeLifecycleContractShims(sandbox);
    const privateValue = "state-service-exit-private-value";
    const environment = lifecycleFreshProcessEnvironment({
      sandbox,
      runId,
      fakeNpmPath,
      fakeDockerHookPath,
      binDirectory,
      scenario: "state-service-exit",
      dockerMode: "clean",
      privateValue,
    });
    environment.MUSIC_E2E_HEALTH_URLS = Array.from({ length: 5 }, () => "http://127.0.0.1:55174/health").join(",");
    const result = spawnSync(process.execPath, [resolve("scripts/music-public-e2e.mjs"), "live"], {
      cwd: sandbox,
      env: environment,
      encoding: "utf8",
      windowsHide: true,
      timeout: 10_000,
    });
    const runDirectory = join(sandbox, ".artifacts", "music-public", runId);
    const evidence = JSON.parse(readFileSync(join(runDirectory, "evidence.json"), "utf8"));
    const lifecycleActions = readFileSync(environment.FAKE_LIFECYCLE_LOG, "utf8").trim().split(/\r?\n/);

    expect(result.status, `${result.stdout}\n${result.stderr}\n${JSON.stringify(evidence)}`).toBe(5);
    expect(lifecycleActions).toEqual(["bootstrap", "up", "down"]);
    expect(lifecycleActions.filter((action) => action === "down")).toHaveLength(1);
    expect(evidence).toMatchObject({
      stage: "state-service-exit",
      result: "failed",
      cleanup: "teardown-failed",
      exitCode: 5,
      stateServiceLifecycle: {
        schemaVersion: "explorers-public-state-service-lifecycle/v1",
        error: { status: "unavailable" },
        exit: { status: "observed", code: 1, signal: null },
        close: { status: "observed", code: 1, signal: null },
      },
    });
    expect(`${result.stdout}\n${result.stderr}\n${JSON.stringify(evidence)}`).not.toContain(privateValue);
    expect(`${result.stdout}\n${result.stderr}\n${JSON.stringify(evidence)}`).not.toContain(sandbox);
    expect(result.stderr).not.toMatch(/Unhandled 'error' event|ERR_UNHANDLED_ERROR/);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

test("qualification run allocation refuses a caller-selected parent outside the exact guarded path", async () => {
  // Production break caught: an environment-controlled or mistaken parent can
  // move retained evidence outside the reviewed .artifacts/music-public boundary.
  const sandbox = mkdtempSync(join(tmpdir(), "music-public-parent-guard-"));
  try {
    const { createExclusiveQualificationRunDirectory } = await import("../scripts/music-public-qualification-artifacts.mjs");
    expect(() => createExclusiveQualificationRunDirectory({
      artifactParent: join(sandbox, "unreviewed-artifact-parent"),
      runId: "guard-contract-run",
    })).toThrow("Qualification artifact parent must be the exact .artifacts/music-public directory");
    expect(existsSync(join(sandbox, "unreviewed-artifact-parent"))).toBe(false);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

test("qualification artifact CLI creates and verifies one canonical manifest with a hash-only sidecar", () => {
  // Production break caught: copied evidence has no independently executable
  // role/path/size/hash inventory, or recreating the manifest silently replaces authority.
  const sandbox = mkdtempSync(join(tmpdir(), "music-public-manifest-"));
  try {
    const artifactParent = join(sandbox, ".artifacts", "music-public");
    const runDirectory = join(artifactParent, "manifest-contract-run");
    mkdirSync(runDirectory, { recursive: true });
    seedQualificationArtifacts(runDirectory);
    const helper = resolve("scripts/music-public-qualification-artifacts.mjs");
    const invoke = (operation: "create" | "verify") => spawnSync(
      process.execPath,
      [helper, operation, runDirectory],
      { cwd: process.cwd(), encoding: "utf8", windowsHide: true },
    );

    const created = invoke("create");
    expect(created.status, `${created.stdout}\n${created.stderr}`).toBe(0);
    const manifestBytes = readFileSync(join(runDirectory, "manifest.json"));
    const manifest = JSON.parse(manifestBytes.toString("utf8"));
    expect(manifest).toEqual({
      schemaVersion: "explorers-public-qualification-artifacts/v1",
      artifacts: REQUIRED_QUALIFICATION_ARTIFACTS.map((artifact) => {
        const content = seededQualificationArtifactContent(artifact.role);
        return {
          ...artifact,
          bytes: Buffer.byteLength(content),
          sha256: createHash("sha256").update(content).digest("hex"),
        };
      }),
    });
    const expectedManifestHash = createHash("sha256").update(manifestBytes).digest("hex");
    expect(readFileSync(join(runDirectory, "manifest.sha256"), "utf8")).toBe(`${expectedManifestHash}\n`);
    expect(JSON.parse(created.stdout)).toEqual({
      schemaVersion: "explorers-public-qualification-artifacts/v1",
      files: 14,
      manifestSha256: expectedManifestHash,
    });

    const verified = invoke("verify");
    expect(verified.status, `${verified.stdout}\n${verified.stderr}`).toBe(0);
    expect(JSON.parse(verified.stdout)).toEqual(JSON.parse(created.stdout));

    const duplicateCreate = invoke("create");
    expect(duplicateCreate.status).toBe(1);
    expect(duplicateCreate.stderr).toBe("qualification artifact error: manifest files already exist\n");
    expect(`${duplicateCreate.stdout}\n${duplicateCreate.stderr}`).not.toContain(sandbox);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

test("qualification visual/trace ledger makes every retained relative file manifest-required", () => {
  // Production break caught: a screenshot/trace can be retained without a hash
  // row, or a ledger can smuggle an absolute/private path into reviewer evidence.
  const sandbox = mkdtempSync(join(tmpdir(), "music-public-visual-ledger-"));
  try {
    const runDirectory = join(sandbox, ".artifacts", "music-public", "visual-ledger-run");
    mkdirSync(runDirectory, { recursive: true });
    seedQualificationArtifacts(runDirectory);
    const visualLedger = {
      schemaVersion: "explorers-public-visual-trace-ledger/v1",
      status: "retained",
      visuals: ["visuals/owner-public-music.png"],
      traces: ["traces/owner-public-music.zip"],
    };
    writeFileSync(join(runDirectory, "visual-trace-ledger.json"), `${JSON.stringify(visualLedger)}\n`);
    mkdirSync(join(runDirectory, "visuals"));
    mkdirSync(join(runDirectory, "traces"));
    writeFileSync(join(runDirectory, "visuals", "owner-public-music.png"), "png");
    writeFileSync(join(runDirectory, "traces", "owner-public-music.zip"), "zip");
    const helper = resolve("scripts/music-public-qualification-artifacts.mjs");
    const created = spawnSync(process.execPath, [helper, "create", runDirectory], {
      cwd: process.cwd(), encoding: "utf8", windowsHide: true,
    });
    expect(created.status, `${created.stdout}\n${created.stderr}`).toBe(0);
    const manifest = JSON.parse(readFileSync(join(runDirectory, "manifest.json"), "utf8"));
    expect(manifest.artifacts.slice(-2)).toEqual([
      {
        role: "visual-001",
        path: "visuals/owner-public-music.png",
        bytes: 3,
        sha256: "8f8cbb7dcf46e0bc7d53265749a6c17d116093a6ba95e442764060c76fd4a86c",
      },
      {
        role: "trace-001",
        path: "traces/owner-public-music.zip",
        bytes: 3,
        sha256: "4a70fe9aa6436e02c2dea340fbd1e352e4ef2d8ce6ca52ad25d4b95471fc8bf2",
      },
    ]);
    const verified = spawnSync(process.execPath, [helper, "verify", runDirectory], {
      cwd: process.cwd(), encoding: "utf8", windowsHide: true,
    });
    expect(verified.status, `${verified.stdout}\n${verified.stderr}`).toBe(0);
    expect(JSON.parse(verified.stdout)).toMatchObject({ files: 16 });
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

const qualificationManifestTamperCases: Array<{
  name: string;
  expected: string;
  mutate: (runDirectory: string) => void;
}> = [
  {
    name: "a malformed sidecar",
    expected: "manifest sidecar format is invalid",
    mutate: (runDirectory) => writeFileSync(join(runDirectory, "manifest.sha256"), "not-a-canonical-sha\n"),
  },
  {
    name: "a sidecar hash that does not authenticate manifest bytes",
    expected: "manifest sidecar hash mismatch",
    mutate: (runDirectory) => writeFileSync(join(runDirectory, "manifest.sha256"), `${"0".repeat(64)}\n`),
  },
  {
    name: "a missing required artifact",
    expected: "required qualification artifact is missing or unreadable",
    mutate: (runDirectory) => rmSync(join(runDirectory, "evidence.json")),
  },
  {
    name: "a required artifact byte-count mismatch",
    expected: "qualification artifact byte count mismatch",
    mutate: (runDirectory) => writeFileSync(join(runDirectory, "logs", "state-service.stderr.log"), "abcd"),
  },
  {
    name: "a same-size required artifact hash mismatch",
    expected: "qualification artifact SHA-256 mismatch",
    mutate: (runDirectory) => writeFileSync(join(runDirectory, "logs", "state-service.stderr.log"), "abd"),
  },
  {
    name: "an unmanifested private artifact",
    expected: "qualification artifact file set mismatch",
    mutate: (runDirectory) => writeFileSync(join(runDirectory, "private-playwright-secret.json"), "must-not-survive"),
  },
  {
    name: "a missing required manifest role/path",
    expected: "manifest required artifact set mismatch",
    mutate: (runDirectory) => rewriteQualificationManifest(runDirectory, (manifest) => { manifest.artifacts.pop(); }),
  },
  {
    name: "a duplicate manifest role/path",
    expected: "manifest contains duplicate role or path",
    mutate: (runDirectory) => rewriteQualificationManifest(runDirectory, (manifest) => {
      manifest.artifacts.push({ ...manifest.artifacts[0] });
    }),
  },
  {
    name: "an extra manifest role/path",
    expected: "manifest required artifact set mismatch",
    mutate: (runDirectory) => {
      writeFileSync(join(runDirectory, "unexpected-required.json"), "abc");
      rewriteQualificationManifest(runDirectory, (manifest) => {
        manifest.artifacts.push({
          role: "raw-reporter",
          path: "unexpected-required.json",
          bytes: 3,
          sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
        });
      });
    },
  },
  {
    name: "a non-relative manifest artifact path",
    expected: "qualification artifact path is not a safe relative path",
    mutate: (runDirectory) => rewriteQualificationManifest(runDirectory, (manifest) => {
      manifest.artifacts[0].path = resolve("must-not-be-retained", "stdout.log");
    }),
  },
  {
    name: "non-canonical manifest JSON bytes",
    expected: "manifest JSON is not canonical",
    mutate: (runDirectory) => {
      const manifest = JSON.parse(readFileSync(join(runDirectory, "manifest.json"), "utf8"));
      writeQualificationManifestBytes(runDirectory, Buffer.from(JSON.stringify(manifest), "utf8"));
    },
  },
  {
    name: "an extra top-level manifest field",
    expected: "manifest contract is invalid",
    mutate: (runDirectory) => rewriteQualificationManifest(runDirectory, (manifest) => {
      Object.assign(manifest, { privateDiagnostic: "must-not-survive" });
    }),
  },
  {
    name: "an extra artifact-entry field",
    expected: "manifest contract is invalid",
    mutate: (runDirectory) => rewriteQualificationManifest(runDirectory, (manifest) => {
      manifest.artifacts[0].privateDiagnostic = "must-not-survive";
    }),
  },
  {
    name: "a reordered required role/path set",
    expected: "manifest required artifact set mismatch",
    mutate: (runDirectory) => rewriteQualificationManifest(runDirectory, (manifest) => {
      [manifest.artifacts[0], manifest.artifacts[1]] = [manifest.artifacts[1], manifest.artifacts[0]];
    }),
  },
];

for (const contract of qualificationManifestTamperCases) {
  test(`qualification artifact verifier rejects ${contract.name}`, () => {
    const sandbox = mkdtempSync(join(tmpdir(), "music-public-manifest-tamper-"));
    try {
      const runDirectory = join(sandbox, ".artifacts", "music-public", "tamper-contract-run");
      mkdirSync(runDirectory, { recursive: true });
      seedQualificationArtifacts(runDirectory);
      const helper = resolve("scripts/music-public-qualification-artifacts.mjs");
      const create = spawnSync(process.execPath, [helper, "create", runDirectory], {
        cwd: process.cwd(), encoding: "utf8", windowsHide: true,
      });
      expect(create.status, `${create.stdout}\n${create.stderr}`).toBe(0);
      contract.mutate(runDirectory);

      const verify = spawnSync(process.execPath, [helper, "verify", runDirectory], {
        cwd: process.cwd(), encoding: "utf8", windowsHide: true,
      });
      expect(verify.status).toBe(1);
      expect(verify.stderr).toBe(`qualification artifact error: ${contract.expected}\n`);
      expect(`${verify.stdout}\n${verify.stderr}`).not.toContain(sandbox);
      expect(`${verify.stdout}\n${verify.stderr}`).not.toContain("must-not-survive");
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });
}

test("qualification logs are exclusively written after bounded path and secret sanitization", async () => {
  // Production break caught: child diagnostics can retain credentials, absolute
  // worktree paths, or arbitrarily large stdout/stderr in reviewer artifacts.
  const sandbox = mkdtempSync(join(tmpdir(), "music-public-sanitized-log-"));
  try {
    const runDirectory = join(sandbox, ".artifacts", "music-public", "sanitized-log-run");
    mkdirSync(runDirectory, { recursive: true });
    const privateValue = "qualification-private-value-0123456789";
    const hostile = [
      `workspace=${process.cwd()}\\private\\report.json`,
      `Bearer ${privateValue}`,
      `access_token="${privateValue}" capability='${privateValue}' credential=${privateValue}`,
      `C:\\Users\\Private\\outside.txt /private/absolute/outside.txt`,
      "oversized=".repeat(2_000),
    ].join("\n");
    const qualificationArtifacts = await import("../scripts/music-public-qualification-artifacts.mjs");
    let result: { bytes: number; truncated: boolean } | undefined;
    expect(() => {
      result = qualificationArtifacts.writeSanitizedQualificationLog({
        runDirectory,
        relativePath: "logs/stdout.log",
        chunks: [hostile],
        workspaceRoot: process.cwd(),
        knownSecrets: [privateValue],
        maximumBytes: 4_096,
      });
    }).not.toThrow();
    expect(result).toEqual({ bytes: expect.any(Number), truncated: true });
    expect(result!.bytes).toBeLessThanOrEqual(4_096);
    const retained = readFileSync(join(runDirectory, "logs", "stdout.log"), "utf8");
    expect(Buffer.byteLength(retained)).toBe(result!.bytes);
    expect(retained).toContain("<workspace>");
    expect(retained).toContain("<redacted>");
    expect(retained).toContain("<path>");
    expect(retained).toMatch(/\[truncated\]\n$/);
    expect(retained).not.toContain(privateValue);
    expect(retained).not.toContain(process.cwd());
    expect(retained).not.toContain("C:\\Users\\Private");
    expect(retained).not.toContain("/private/absolute");

    expect(() => qualificationArtifacts.writeSanitizedQualificationLog({
      runDirectory,
      relativePath: "logs/stdout.log",
      chunks: ["replacement"],
      workspaceRoot: process.cwd(),
      knownSecrets: [],
      maximumBytes: 4_096,
    })).toThrow("qualification artifact already exists");
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

test("fixture lifecycle commands retain only bounded sanitized typed output without inheriting child streams", async () => {
  // Production break caught: bootstrap/up/down used stdio=inherit, so their raw,
  // unbounded output bypassed the qualification logs and could disclose paths or credentials.
  const qualificationArtifacts = await import("../scripts/music-public-qualification-artifacts.mjs");
  const privateValue = "lifecycle-private-value-0123456789";
  const absoluteOutsidePath = process.platform === "win32"
    ? "C:\\private\\fixture\\bootstrap.log"
    : "/private/fixture/bootstrap.log";
  const calls: Array<{ command: string; args: string[]; options: Record<string, unknown> }> = [];
  const captured = qualificationArtifacts.captureQualificationLifecycleCommand({
    stage: "fixture-bootstrap",
    processExecPath: "node-runtime",
    npmExecPath: "npm-cli",
    cwd: process.cwd(),
    retainedCwd: "<repository>",
    environment: { FIXTURE_TEST: "1" },
    workspaceRoot: process.cwd(),
    knownSecrets: [privateValue],
    spawn: (command: string, args: string[], options: Record<string, unknown>) => {
      calls.push({ command, args, options });
      return {
        status: 7,
        signal: null,
        stdout: `workspace=${process.cwd()}\nBearer ${privateValue}\n${"bounded-stdout".repeat(600)}`,
        stderr: `credential=${privateValue}\npath=${absoluteOutsidePath}\n`,
      };
    },
  });

  expect(captured.record).toEqual({
    schemaVersion: "explorers-public-lifecycle-command/v1",
    stage: "fixture-bootstrap",
    command: ["npm", "run", "--silent", "music-cli", "--", "bootstrap"],
    cwd: "<repository>",
    exitCode: 7,
    termination: "exited",
    stdout: {
      status: "captured",
      observedBytes: Buffer.byteLength(`workspace=${process.cwd()}\nBearer ${privateValue}\n${"bounded-stdout".repeat(600)}`),
      retainedBytes: Buffer.byteLength(captured.stdout),
      truncated: true,
    },
    stderr: {
      status: "captured",
      observedBytes: Buffer.byteLength(`credential=${privateValue}\npath=${absoluteOutsidePath}\n`),
      retainedBytes: Buffer.byteLength(captured.stderr),
      truncated: false,
    },
  });
  expect(captured.status).toBe(7);
  expect(`${captured.stdout}\n${captured.stderr}`).toContain("<redacted>");
  expect(`${captured.stdout}\n${captured.stderr}`).toContain("<path>");
  expect(`${captured.stdout}\n${captured.stderr}`).not.toContain(privateValue);
  expect(`${captured.stdout}\n${captured.stderr}`).not.toContain(process.cwd());
  expect(`${captured.stdout}\n${captured.stderr}`).not.toContain(absoluteOutsidePath);
  expect(Buffer.byteLength(captured.stdout)).toBeLessThanOrEqual(4_096);
  expect(calls).toEqual([{
    command: "node-runtime",
    args: ["npm-cli", "run", "--silent", "music-cli", "--", "bootstrap"],
    options: {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { FIXTURE_TEST: "1" },
      maxBuffer: 64 * 1024,
      windowsHide: true,
    },
  }]);
});

test("authoritative per-source streams preserve later up down and state output after an early stream fills its cap", async () => {
  // Production break caught: the global 4 KiB aggregate could be filled by
  // bootstrap, silently dropping later up/down/state bytes while typed command
  // records still claimed those streams were captured.
  const sandbox = mkdtempSync(join(tmpdir(), "music-public-per-stream-"));
  try {
    const runId = "per-stream-finalization-run";
    const runDirectory = join(sandbox, ".artifacts", "music-public", runId);
    mkdirSync(runDirectory, { recursive: true });
    const privateValue = "per-stream-private-token";
    const values: Record<string, string> = {
      "fixture-bootstrap:stdout": `bootstrap-start\n${"B".repeat(12_000)}\nbootstrap-end\n`,
      "fixture-bootstrap:stderr": `Bearer ${privateValue}\n`,
      "fixture-up:stdout": "late-up-stdout\n",
      "fixture-up:stderr": "late-up-stderr\n",
      "fixture-down:stdout": "late-down-stdout\n",
      "fixture-down:stderr": "late-down-stderr\n",
      "state-service:stdout": `late-state-stdout\n${"S".repeat(5_000)}\n`,
      "state-service:stderr": "late-state-stderr path=/private/state/service.log\n",
    };
    const streamArtifacts = AUTHORITATIVE_QUALIFICATION_STREAMS.map(({ source, stream }) => {
      const value = values[`${source}:${stream}`];
      return {
        source,
        stream,
        status: "captured",
        observedBytes: Buffer.byteLength(value),
        chunks: [value],
        truncated: false,
      };
    });
    const evidence = {
      version: MUSIC_PUBLIC_FIXTURE_VERSION,
      runId,
      lane: "live",
      result: "failed",
      cleanup: "not-required-safe",
      stateServiceLifecycle: {
        schemaVersion: "explorers-public-state-service-lifecycle/v1",
        error: { status: "unavailable" },
        exit: { status: "observed", code: null, signal: "SIGKILL" },
        close: { status: "observed", code: null, signal: "SIGKILL" },
      },
    };
    const qualificationArtifacts = await import("../scripts/music-public-qualification-artifacts.mjs");
    const finalized = qualificationArtifacts.finalizeQualificationRunArtifacts({
      runDirectory,
      workspaceRoot: process.cwd(),
      knownSecrets: [privateValue],
      streamArtifacts,
      analyticsLedger: {
        schemaVersion: "explorers-public-analytics-ledger/v1",
        status: "unavailable",
        reason: "execution-stopped",
        events: [],
      },
      visualTraceLedger: {
        schemaVersion: "explorers-public-visual-trace-ledger/v1",
        status: "none-retained",
        visuals: [],
        traces: [],
      },
      dockerInspection: {
        schemaVersion: "explorers-public-docker-inspection/v1",
        status: "observed",
        cwd: "<repository>",
        labels: {
          "com.explorers.music.fixture": "true",
          "com.explorers.music.project": "explorers-music-fixture",
        },
        commands: {
          containers: [
            "docker", "ps", "-aq",
            "--filter", "label=com.explorers.music.fixture=true",
            "--filter", "label=com.explorers.music.project=explorers-music-fixture",
          ],
          volumes: [
            "docker", "volume", "ls", "-q",
            "--filter", "label=com.explorers.music.fixture=true",
            "--filter", "label=com.explorers.music.project=explorers-music-fixture",
          ],
        },
        exitCodes: { containers: 0, volumes: 0 },
        containerMatches: [],
        volumeMatches: [],
        containersRemaining: 0,
        volumesRemaining: 0,
        authArtifacts: [
          { path: "owner-auth.json", state: "absent" },
          { path: "profile-storage-state.json", state: "absent" },
        ],
      },
      skipLedger: {
        schemaVersion: "explorers-public-skip-ledger/v1",
        lane: "live",
        execution: "execution-stopped",
        totals: { total: 0, passed: 0, failed: 0, skipped: 0 },
        reasons: [{ scope: "lane", reason: "execution-stopped" }],
      },
      restorationRecord: {
        schemaVersion: "explorers-public-restoration/v1",
        status: "unavailable",
        finalRestore: null,
        journeys: [],
      },
      evidence,
    });

    expect(finalized).toMatchObject({ files: 14, verified: true });
    const retainedEvidence = JSON.parse(readFileSync(join(runDirectory, "evidence.json"), "utf8"));
    expect(retainedEvidence.streams).toHaveLength(8);
    for (const definition of AUTHORITATIVE_QUALIFICATION_STREAMS) {
      const retained = readFileSync(join(runDirectory, ...definition.path.split("/")), "utf8");
      const record = retainedEvidence.streams.find(({ role }: { role: string }) => role === definition.role);
      expect(record).toMatchObject({
        schemaVersion: "explorers-public-stream-artifact/v1",
        ...definition,
        status: "captured",
        bytes: Buffer.byteLength(retained),
        observedBytes: Buffer.byteLength(values[`${definition.source}:${definition.stream}`]),
        truncated: Buffer.byteLength(values[`${definition.source}:${definition.stream}`]) > 4_096,
      });
      expect(Buffer.byteLength(retained)).toBeLessThanOrEqual(4_096);
      expect(retained).not.toContain(privateValue);
      expect(retained).not.toContain(sandbox);
    }
    expect(readFileSync(join(runDirectory, "logs", "fixture-up.stdout.log"), "utf8")).toContain("late-up-stdout");
    expect(readFileSync(join(runDirectory, "logs", "fixture-down.stdout.log"), "utf8")).toContain("late-down-stdout");
    expect(readFileSync(join(runDirectory, "logs", "state-service.stdout.log"), "utf8")).toContain("late-state-stdout");
    expect(readFileSync(join(runDirectory, "logs", "state-service.stderr.log"), "utf8")).toContain("<path>");
    expect(existsSync(join(runDirectory, "logs", "stdout.log"))).toBe(false);
    expect(existsSync(join(runDirectory, "logs", "stderr.log"))).toBe(false);

    retainedEvidence.streams.pop();
    const tamperedEvidenceBytes = Buffer.from(`${JSON.stringify(retainedEvidence, null, 2)}\n`, "utf8");
    writeFileSync(join(runDirectory, "evidence.json"), tamperedEvidenceBytes);
    rewriteQualificationManifest(runDirectory, (manifest) => {
      const evidenceArtifact = manifest.artifacts.find((artifact) => artifact.role === "evidence");
      Object.assign(evidenceArtifact!, {
        bytes: tamperedEvidenceBytes.length,
        sha256: createHash("sha256").update(tamperedEvidenceBytes).digest("hex"),
      });
    });
    const tamperedVerify = spawnSync(process.execPath, [
      resolve("scripts/music-public-qualification-artifacts.mjs"), "verify", runDirectory,
    ], { cwd: process.cwd(), encoding: "utf8", windowsHide: true });
    expect(tamperedVerify.status).toBe(1);
    expect(tamperedVerify.stderr).toBe("qualification artifact error: qualification stream metadata contract is invalid\n");
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

test("qualification analytics ledger retains only safe UTM and exactly-once observations", async () => {
  // Production break caught: analytics evidence stores raw event/authority IDs,
  // accepts arbitrary event fields, or claims exactly-once without observed counts.
  const sandbox = mkdtempSync(join(tmpdir(), "music-public-analytics-ledger-"));
  try {
    const runDirectory = join(sandbox, ".artifacts", "music-public", "analytics-ledger-run");
    mkdirSync(runDirectory, { recursive: true });
    const qualificationArtifacts = await import("../scripts/music-public-qualification-artifacts.mjs");
    const ledger = observedQualificationAnalyticsLedger();
    let result: { bytes: number; events: number; status: string } | undefined;
    expect(() => {
      result = qualificationArtifacts.writeQualificationAnalyticsLedger({ runDirectory, ledger });
    }).not.toThrow();
    expect(result).toEqual({ bytes: expect.any(Number), events: 1, status: "observed" });
    const retained = readFileSync(join(runDirectory, "analytics-events.jsonl"), "utf8");
    expect(retained).toBe(`${JSON.stringify(ledger)}\n`);
    expect(Buffer.byteLength(retained)).toBe(result!.bytes);
    expect(retained).not.toMatch(/Bearer|authorization|capability|credential|access[_-]?token|https?:\/\//i);
    expect(() => qualificationArtifacts.writeQualificationAnalyticsLedger({ runDirectory, ledger }))
      .toThrow("qualification artifact already exists");
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

const unsafeAnalyticsLedgerCases: Array<{
  name: string;
  mutate: (ledger: ReturnType<typeof observedQualificationAnalyticsLedger>) => void;
}> = [
  {
    name: "a raw event ID field",
    mutate: (ledger) => Object.assign(ledger.events[0].delivery, { eventId: "must-not-survive" }),
  },
  {
    name: "an arbitrary authority field",
    mutate: (ledger) => Object.assign(ledger.events[0], { authorization: "Bearer must-not-survive" }),
  },
  {
    name: "an unknown product event",
    mutate: (ledger) => { ledger.events[0].event = { name: "credential_exposed", route: "friendly" }; },
  },
  {
    name: "a URL-shaped UTM value",
    mutate: (ledger) => { ledger.events[0].utm.utm_source = "https://private.example/path"; },
  },
  {
    name: "an unknown UTM key",
    mutate: (ledger) => Object.assign(ledger.events[0].utm, { utm_token: "must-not-survive" }),
  },
  {
    name: "a noncanonical observation sequence",
    mutate: (ledger) => { ledger.events[0].sequence = 2; },
  },
  {
    name: "a non-SHA occurrence identifier",
    mutate: (ledger) => { ledger.events[0].delivery.occurrenceSha256 = "raw-occurrence-id"; },
  },
  {
    name: "a false exactly-once assertion",
    mutate: (ledger) => { ledger.events[0].delivery.exactlyOnce = false; },
  },
  {
    name: "multiple distinct event IDs for one occurrence",
    mutate: (ledger) => { ledger.events[0].delivery.distinctEventIds = 2; },
  },
  {
    name: "multiple committed events for one occurrence",
    mutate: (ledger) => { ledger.events[0].delivery.committedEvents = 2; },
  },
  {
    name: "more duplicate responses than attempts",
    mutate: (ledger) => { ledger.events[0].delivery.duplicateResponses = 3; },
  },
];

for (const contract of unsafeAnalyticsLedgerCases) {
  test(`qualification analytics ledger rejects ${contract.name}`, async () => {
    const sandbox = mkdtempSync(join(tmpdir(), "music-public-unsafe-analytics-"));
    try {
      const runDirectory = join(sandbox, ".artifacts", "music-public", "unsafe-analytics-run");
      mkdirSync(runDirectory, { recursive: true });
      const ledger = observedQualificationAnalyticsLedger();
      contract.mutate(ledger);
      const qualificationArtifacts = await import("../scripts/music-public-qualification-artifacts.mjs");
      expect(() => qualificationArtifacts.writeQualificationAnalyticsLedger({ runDirectory, ledger }))
        .toThrow("qualification analytics ledger contract is invalid");
      expect(existsSync(join(runDirectory, "analytics-events.jsonl"))).toBe(false);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });
}

test("qualification analytics ledger records a preflight evidence gap without placeholder events", async () => {
  const sandbox = mkdtempSync(join(tmpdir(), "music-public-unavailable-analytics-"));
  try {
    const runDirectory = join(sandbox, ".artifacts", "music-public", "unavailable-analytics-run");
    mkdirSync(runDirectory, { recursive: true });
    const ledger = {
      schemaVersion: "explorers-public-analytics-ledger/v1",
      status: "unavailable",
      reason: "preflight-stopped",
      events: [],
    };
    const qualificationArtifacts = await import("../scripts/music-public-qualification-artifacts.mjs");
    expect(qualificationArtifacts.writeQualificationAnalyticsLedger({ runDirectory, ledger })).toEqual({
      bytes: Buffer.byteLength(`${JSON.stringify(ledger)}\n`),
      events: 0,
      status: "unavailable",
    });
    expect(readFileSync(join(runDirectory, "analytics-events.jsonl"), "utf8")).toBe(`${JSON.stringify(ledger)}\n`);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

test("qualification Docker inspection retains exact bounded label-filter matches without raw command output", async () => {
  const sandbox = mkdtempSync(join(tmpdir(), "music-public-docker-inspection-"));
  try {
    const runDirectory = join(sandbox, ".artifacts", "music-public", "docker-inspection-run");
    mkdirSync(runDirectory, { recursive: true });
    writeFileSync(join(runDirectory, "owner-auth.json"), "private material must never be retained");
    const calls: Array<{ command: string; args: string[]; options: Record<string, unknown> }> = [];
    const containerId = "a".repeat(64);
    const qualificationArtifacts = await import("../scripts/music-public-qualification-artifacts.mjs");
    const inspection = qualificationArtifacts.inspectQualificationDockerCleanup({
      runDirectory,
      inspectionCwd: sandbox,
      retainedCwd: "<repository>",
      exists: existsSync,
      spawn: (command: string, args: string[], options: Record<string, unknown>) => {
        calls.push({ command, args, options });
        return {
          status: 0,
          stdout: args[0] === "ps" ? `${containerId}\n` : "explorers_music_fixture_cache\n",
          stderr: "must not be retained",
        };
      },
    });
    expect(inspection).toEqual({
      schemaVersion: "explorers-public-docker-inspection/v1",
      status: "observed",
      cwd: "<repository>",
      labels: {
        "com.explorers.music.fixture": "true",
        "com.explorers.music.project": "explorers-music-fixture",
      },
      commands: {
        containers: [
          "docker", "ps", "-aq",
          "--filter", "label=com.explorers.music.fixture=true",
          "--filter", "label=com.explorers.music.project=explorers-music-fixture",
        ],
        volumes: [
          "docker", "volume", "ls", "-q",
          "--filter", "label=com.explorers.music.fixture=true",
          "--filter", "label=com.explorers.music.project=explorers-music-fixture",
        ],
      },
      exitCodes: { containers: 0, volumes: 0 },
      containerMatches: [containerId],
      volumeMatches: ["explorers_music_fixture_cache"],
      containersRemaining: 1,
      volumesRemaining: 1,
      authArtifacts: [
        { path: "owner-auth.json", state: "present" },
        { path: "profile-storage-state.json", state: "absent" },
      ],
    });
    expect(calls).toHaveLength(2);
    expect(calls.every(({ command }) => command === "docker")).toBe(true);
    expect(calls.every(({ options }) => options.encoding === "utf8" && options.windowsHide === true
      && options.maxBuffer === 8 * 1024)).toBe(true);
    expect(JSON.stringify(inspection)).not.toContain("must not be retained");
    expect(JSON.stringify(inspection)).not.toContain(sandbox);
    expect(qualificationArtifacts.assessQualificationCleanup({
      lane: "live", cleanup: "not-required-safe", dockerInspection: inspection,
    })).toEqual({
      verified: false,
      gaps: [
        "docker-containers-remain",
        "docker-volumes-remain",
        "auth-artifact-present:owner-auth.json",
      ],
    });
    expect(qualificationArtifacts.assessQualificationCleanup({
      lane: "live",
      cleanup: "not-required-safe",
      dockerInspection: {
        ...inspection,
        containerMatches: [],
        volumeMatches: [],
        containersRemaining: 0,
        volumesRemaining: 0,
        authArtifacts: inspection.authArtifacts.map(({ path: relativePath }: { path: string }) => ({
          path: relativePath,
          state: "absent",
        })),
      },
    })).toEqual({ verified: true, gaps: [] });
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

test("qualification outcome projection derives exact totals, skip gaps, and restoration hashes without private rows", async () => {
  const qualificationArtifacts = await import("../scripts/music-public-qualification-artifacts.mjs");
  const finalHash = "f".repeat(64);
  const records = validJourneyEvidenceRecords();
  const completed = qualificationArtifacts.buildQualificationOutcomeRecords({
    lane: "live",
    executionOutcome: {
      status: 0,
      executionReport: playwrightJourneyReport(EXPECTED_LIVE_JOURNEYS, { resultStatus: "passed" }),
    },
    report: {
      finalRestore: { cleanup: "restored", beforeHash: finalHash, afterHash: finalHash },
      journeys: records,
    },
  });
  expect(completed.skipLedger).toEqual({
    schemaVersion: "explorers-public-skip-ledger/v1",
    lane: "live",
    execution: "completed",
    totals: { total: 49, passed: 49, failed: 0, skipped: 0 },
    reasons: [],
  });
  expect(completed.restorationRecord).toEqual({
    schemaVersion: "explorers-public-restoration/v1",
    status: "journeys-restored",
    finalRestore: { beforeHash: finalHash, afterHash: finalHash },
    journeys: records.map(({ id, beforeHash, afterHash }) => ({ id, beforeHash, afterHash })),
  });
  expect(JSON.stringify(completed)).not.toContain("rowCount");
  expect(JSON.stringify(completed)).not.toContain("rows");

  const preflight = qualificationArtifacts.buildQualificationOutcomeRecords({
    lane: "live",
    executionOutcome: {
      status: 4,
      preflightDiagnostics: { failureStage: "preflight", subcheck: "authority-process" },
    },
    report: {
      finalRestore: { cleanup: "restored", beforeHash: finalHash, afterHash: finalHash },
    },
  });
  expect(preflight.skipLedger).toEqual({
    schemaVersion: "explorers-public-skip-ledger/v1",
    lane: "live",
    execution: "preflight-stopped",
    totals: { total: 0, passed: 0, failed: 0, skipped: 0 },
    reasons: [{ scope: "authority", reason: "authority-process" }],
  });
  expect(preflight.restorationRecord).toEqual({
    schemaVersion: "explorers-public-restoration/v1",
    status: "initial-restored",
    finalRestore: { beforeHash: finalHash, afterHash: finalHash },
    journeys: [],
  });
});

test("preflight-stopped qualification finalization writes every safe artifact and verifies its manifest", async () => {
  // Production break caught: a failed guarded run leaves only evidence.json,
  // without immutable logs, exact cleanup inspection, skip/gap ledgers, or a verifier result.
  const sandbox = mkdtempSync(join(tmpdir(), "music-public-finalization-"));
  try {
    const runId = "preflight-finalization-run";
    const runDirectory = join(sandbox, ".artifacts", "music-public", runId);
    mkdirSync(runDirectory, { recursive: true });
    const finalHash = "c".repeat(64);
    const input = {
      runDirectory,
      workspaceRoot: process.cwd(),
      knownSecrets: ["finalization-private-token"],
      streamArtifacts: AUTHORITATIVE_QUALIFICATION_STREAMS.map(({ source, stream }) => {
        const value = source === "fixture-bootstrap" && stream === "stdout"
          ? "guarded run stopped before mutation callback\n"
          : (source === "fixture-bootstrap" && stream === "stderr"
            ? "access_token=finalization-private-token\n"
            : undefined);
        return value === undefined
          ? { source, stream, status: "unavailable", observedBytes: 0, chunks: [], truncated: false }
          : { source, stream, status: "captured", observedBytes: Buffer.byteLength(value), chunks: [value], truncated: false };
      }),
      analyticsLedger: {
        schemaVersion: "explorers-public-analytics-ledger/v1",
        status: "unavailable",
        reason: "preflight-stopped",
        events: [],
      },
      visualTraceLedger: {
        schemaVersion: "explorers-public-visual-trace-ledger/v1",
        status: "none-retained",
        visuals: [],
        traces: [],
      },
      dockerInspection: {
        schemaVersion: "explorers-public-docker-inspection/v1",
        status: "observed",
        cwd: "<repository>",
        labels: {
          "com.explorers.music.fixture": "true",
          "com.explorers.music.project": "explorers-music-fixture",
        },
        commands: {
          containers: [
            "docker", "ps", "-aq",
            "--filter", "label=com.explorers.music.fixture=true",
            "--filter", "label=com.explorers.music.project=explorers-music-fixture",
          ],
          volumes: [
            "docker", "volume", "ls", "-q",
            "--filter", "label=com.explorers.music.fixture=true",
            "--filter", "label=com.explorers.music.project=explorers-music-fixture",
          ],
        },
        exitCodes: { containers: 0, volumes: 0 },
        containerMatches: [],
        volumeMatches: [],
        containersRemaining: 0,
        volumesRemaining: 0,
        authArtifacts: [
          { path: "owner-auth.json", state: "absent" },
          { path: "profile-storage-state.json", state: "absent" },
        ],
      },
      skipLedger: {
        schemaVersion: "explorers-public-skip-ledger/v1",
        lane: "live",
        execution: "preflight-stopped",
        totals: { total: 0, passed: 0, failed: 0, skipped: 0 },
        reasons: [{ scope: "live-manifest", reason: "manifest-missing" }],
      },
      restorationRecord: {
        schemaVersion: "explorers-public-restoration/v1",
        status: "initial-restored",
        finalRestore: { beforeHash: finalHash, afterHash: finalHash },
        journeys: [],
      },
      evidence: {
        version: MUSIC_PUBLIC_FIXTURE_VERSION,
        runId,
        lane: "live",
        result: "failed",
        cleanup: "restored",
        commit: "c".repeat(40),
        command: "npm run music:test:public-e2e",
        cwd: "explorers-earth",
        stateServiceLifecycle: {
          schemaVersion: "explorers-public-state-service-lifecycle/v1",
          error: { status: "unavailable" },
          exit: { status: "unavailable" },
          close: { status: "unavailable" },
        },
      },
    };
    const qualificationArtifacts = await import("../scripts/music-public-qualification-artifacts.mjs");
    let finalized: { files: number; manifestSha256: string; verified: boolean } | undefined;
    expect(() => { finalized = qualificationArtifacts.finalizeQualificationRunArtifacts(input); }).not.toThrow();
    expect(finalized).toEqual({ files: 14, manifestSha256: expect.stringMatching(/^[a-f0-9]{64}$/), verified: true });
    expect(readFileSync(join(runDirectory, "logs", "fixture-bootstrap.stdout.log"), "utf8"))
      .toBe("guarded run stopped before mutation callback\n");
    expect(readFileSync(join(runDirectory, "logs", "fixture-bootstrap.stderr.log"), "utf8"))
      .toBe("access_token=<redacted>\n");
    expect(readFileSync(join(runDirectory, "logs", "state-service.stdout.log"), "utf8")).toBe("");
    expect(JSON.parse(readFileSync(join(runDirectory, "docker-inspection.json"), "utf8")))
      .toEqual(input.dockerInspection);
    expect(JSON.parse(readFileSync(join(runDirectory, "skip-reasons.json"), "utf8")))
      .toEqual(input.skipLedger);
    expect(JSON.parse(readFileSync(join(runDirectory, "restoration.json"), "utf8")))
      .toEqual(input.restorationRecord);
    expect(readFileSync(join(runDirectory, "evidence.json"), "utf8").toString())
      .not.toContain("finalization-private-token");
    expect(existsSync(join(runDirectory, "restore-evidence.jsonl"))).toBe(false);
    const verify = spawnSync(process.execPath, [
      resolve("scripts/music-public-qualification-artifacts.mjs"), "verify", runDirectory,
    ], { cwd: process.cwd(), encoding: "utf8", windowsHide: true });
    expect(verify.status, `${verify.stdout}\n${verify.stderr}`).toBe(0);
    expect(JSON.parse(verify.stdout)).toMatchObject({ files: 14, manifestSha256: finalized!.manifestSha256 });

    const unsafeRunDirectory = join(sandbox, ".artifacts", "music-public", "unsafe-finalization-run");
    mkdirSync(unsafeRunDirectory);
    expect(() => qualificationArtifacts.finalizeQualificationRunArtifacts({
      ...input,
      runDirectory: unsafeRunDirectory,
      evidence: { ...input.evidence, observedPath: "/private/build/output.log" },
    })).toThrow("qualification structured artifact is invalid");
    expect(existsSync(join(unsafeRunDirectory, "logs", "fixture-bootstrap.stdout.log"))).toBe(false);
    expect(existsSync(join(unsafeRunDirectory, "analytics-events.jsonl"))).toBe(false);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

test("live runner refuses before Playwright when any authority or five-service health input is missing", () => {
  const result = spawnSync(process.execPath, ["scripts/music-public-e2e.mjs", "live", "--dry-run"], {
    cwd: process.cwd(), encoding: "utf8", env: {
      ...process.env,
      PLAYWRIGHT_EXTERNAL_BASE_URL: "http://127.0.0.1:55173",
      MUSIC_E2E_LIVE_WRITE: "true",
      MUSIC_E2E_LIVE_WRITE_CONFIRMATION: "I_UNDERSTAND_THIS_MUTATES_A_DISPOSABLE_FIXTURE",
      MUSIC_E2E_FIXTURE_VERSION: MUSIC_PUBLIC_FIXTURE_VERSION,
      MUSIC_E2E_ACCOUNT_USERNAME: "e2e-public-music-contract-owner",
      MUSIC_E2E_ACCOUNT_DOCUMENT_ID: "e2e-public-music-contract-account",
      MUSIC_E2E_SERVICE_ORIGINS: "http://127.0.0.1:55173,http://127.0.0.1:55000,http://127.0.0.1:55432,http://127.0.0.1:51337,http://127.0.0.1:55174",
      MUSIC_E2E_HEALTH_URLS: "http://127.0.0.1:55173/health,http://127.0.0.1:55000/health,http://127.0.0.1:55432/health,http://127.0.0.1:51337/health,http://127.0.0.1:55174/health",
    },
  });
  expect(result.status).toBe(3);
  expect(result.stderr).toMatch(/full snapshot|namespace reset/i);
});

test("the documented root public E2E command is the hard-gated live orchestration path", () => {
  const rootPackage = JSON.parse(readFileSync("../package.json", "utf8")) as { scripts: Record<string, string> };
  const clientPackage = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
  expect(rootPackage.scripts["music:test:public-e2e"]).toContain("music:test:public-e2e");
  expect(clientPackage.scripts["music:test:public-e2e"]).toContain("music-public-e2e.mjs live");
  expect(clientPackage.scripts["music:test:public-fast"]).toContain("music-public-e2e.mjs fast");
  expect(clientPackage.scripts["music:test:public-pr"]).toContain("music-public-e2e.mjs pr");
  expect(clientPackage.scripts["music:fixture:public:verify"]).toContain("music-public-e2e.mjs verify");
  const runner = readFileSync("scripts/music-public-e2e.mjs", "utf8");
  expect(runner).toContain("process.env.npm_execpath");
  expect(runner).not.toContain('process.platform === "win32" ? "npm.cmd"');
  expect(runner).toContain("inspectQualificationDockerCleanup");
  expect(runner).toContain("assessQualificationCleanup");
  expect(runner).toContain("buildQualificationOutcomeRecords");
  expect(runner).toContain("finalizeQualificationRunArtifacts");
  expect(runner).toMatch(/artifactPaths:\s*\[[^\]]*restoreEvidencePath[^\]]*authStatePath[^\]]*profileStorageStatePath[^\]]*\]/s);
  expect(runner).toContain("writeReport: async () => undefined");
  expect(runner).not.toContain("function writeLiveReport");
  expect(runner).toContain('"--reporter=json"');
  expect(runner).toMatch(/privatePlaywrightOutputDirectory[\s\S]+--output=/);
  expect(runner).toMatch(/rmSync\(privatePlaywrightOutputDirectory, \{ recursive: true, force: true \}\)/);
  expect(runner).toMatch(/const result = spawnSync[\s\S]+finalizeCurrentQualification\(\{[\s\S]+stage: "execution-finished"/);
  expect(runner).toMatch(/const finalized = await qualificationCoordinator\.runFinalization[\s\S]+return finalized\.exitCode/);
  expect(runner).toContain("process.exit(await runLiveQualification())");
  const stateService = readFileSync("../tunes/scripts/music-e2e-state-service.mjs", "utf8");
  expect(runner).toContain("music-e2e-state-service.mjs");
  expect(stateService).toContain('"pg_dump"');
  expect(stateService).toContain('"psql"');
  expect(stateService).toContain("MUSIC_E2E_STRAPI_TOKEN");
  expect(stateService).toContain("Strapi public_music restore verification mismatch");
  expect(stateService).toContain("preferenceHash: profileHash");
  expect(stateService).not.toContain("domainHashes");
  expect(stateService).not.toContain("domainHash(");
  expect(stateService).not.toContain("MUSIC_E2E_FULL_SNAPSHOT_URL");
});

test("live browser authority is callback-minted and legacy fixture credentials cannot bypass the runner", () => {
  const runner = readFileSync("scripts/music-public-e2e.mjs", "utf8");
  const livePreflight = readFileSync("scripts/music-public-live-preflight.mjs", "utf8");
  const stateService = readFileSync("../tunes/scripts/music-e2e-state-service.mjs", "utf8");
  for (const file of ["e2e/music-fixture-fullstack.spec.ts", "e2e/music-public-contract.spec.ts"]) {
    const source = readFileSync(file, "utf8");
    expect(source).not.toContain("fixture-read-only-token");
    expect(source).toContain("musicLiveStrapiTokenFromEnvironment");
  }
  const liveFixture = readFileSync("e2e/setup/music.ts", "utf8");
  expect(liveFixture).toContain("MUSIC_E2E_STRAPI_TOKEN");
  expect(runner).not.toContain("MUSIC_E2E_OWNER_CREDENTIAL");
  expect(runner).toMatch(/runLifecycleCommand\("fixture-bootstrap"\)[\s\S]+runLifecycleCommand\("fixture-up"\)/);
  expect(runner).not.toContain('"inherit"');
  expect(stateService).not.toContain("MUSIC_E2E_OWNER_CREDENTIAL");
  expect(stateService).not.toContain("/api/music/dashboard");
  expect(stateService).not.toContain("/api/playlists");
  expect(runner).toContain("MUSIC_E2E_AUTH_STATE_PATH");
  expect(runner).toContain("google-auth/callback?access_token=");
  expect(runner).toContain("PLAYWRIGHT_EXTERNAL_BASE_URL: externalUrl");
  expect(runner).toContain("E2E_PROFILE_LIVE_WRITES: \"1\"");
  expect(runner).toContain("E2E_PROFILE_STORAGE_STATE: profileStorageStatePath");
  expect(runner).toContain("E2E_PROFILE_USERNAME: username");
  expect(livePreflight).toContain('"--list"');
  expect(runner).toContain("Live public Music E2E preflight refused");
  expect(runner).toContain('fetch(`${stateServiceUrl}/snapshot`');
  expect(runner).toMatch(/import \{[\s\S]*createMusicQualificationFailureCoordinator,[\s\S]*runMusicFixtureOrchestration,[\s\S]*\} from "\.\/music-public-e2e-runner\.mjs"/);
  expect(runner).toContain("runLivePreflight({");
  expect(runner).not.toContain('path.resolve("node_modules/tsx/dist/cli.mjs")');
  expect(runner).toContain("const liveOutcome = await runMusicFixtureOrchestration({");
  expect(runner.indexOf('fetch(`${stateServiceUrl}/snapshot`')).toBeLessThan(runner.indexOf("runLivePreflight({"));
  expect(runner.indexOf("runLivePreflight({")).toBeLessThan(runner.indexOf("google-auth/callback?access_token="));
  expect(runner).toContain("browserApiPrefix");
  expect(runner).not.toContain("http://localhost:55173/api/");
  expect(runner).toContain("callback bootstrap failed; details redacted");
  expect(runner).not.toContain("callbackBootstrapError.message");
  expect(runner).toContain("result.beforeHash === expected && result.afterHash === expected");
  expect(runner).toContain('runLifecycleCommand("fixture-down")');
});

test("runner orchestration contains setup, parse, and report faults with restored abort hashes", async () => {
  type RunnerReport = { result: string; cleanup: string; restoreHashes: Array<{ beforeHash: string; afterHash: string }> };

  const hash = "a".repeat(64);
  for (const fault of ["setup", "parse", "report"] as const) {
    const calls: string[] = [];
    const stdout: string[] = [];
    const stderr: string[] = [];
    const reports: RunnerReport[] = [];
    const outcome = await runMusicFixtureOrchestration({
      snapshotExists: true,
      baseReport: { version: MUSIC_PUBLIC_FIXTURE_VERSION, runId: `fault-${fault}`, lane: "live" },
      artifacts: {
        directory: "fixture-artifacts",
        authPath: "owner-auth.json",
        storagePath: "profile-storage-state.json",
        mkdir: () => { calls.push("mkdir"); },
        write: (file) => {
          calls.push(`write:${file}`);
          if (fault === "setup") throw new Error("Bearer secret-token");
        },
        chmod: (file) => { calls.push(`chmod:${file}`); },
      },
      restoreEvidence: {
        path: "restore-evidence.jsonl",
        exists: () => true,
        read: () => {
          calls.push("parse-restore-evidence");
          if (fault === "parse") throw new Error("Bearer secret-token");
          return `${JSON.stringify({ cleanup: "restored", beforeHash: hash, afterHash: hash })}\n`;
        },
      },
      execute: async () => { calls.push("execute"); return 0; },
      restore: async () => {
        calls.push("initial-restore");
        return { ok: true, cleanup: "restored", beforeHash: hash, afterHash: hash };
      },
      teardown: {
        artifactPaths: ["owner-auth.json", "profile-storage-state.json"],
        exists: (file) => { calls.push(`exists:${file}`); return true; },
        unlink: (file) => { calls.push(`unlink:${file}`); },
        stopStateService: () => { calls.push("state-service-stop"); },
        down: () => { calls.push("npm run --silent music-cli -- down"); return 0; },
      },
      writeReport: async (report) => {
        calls.push("write-final-report");
        if (fault === "report") throw new Error("Bearer secret-token");
        reports.push(structuredClone(report));
      },
      writeStdout: (text) => { stdout.push(text); },
      writeStderr: (text) => { stderr.push(text); },
    });

    expect(calls.filter((call) => call === "initial-restore"), fault).toHaveLength(1);
    expect(calls, fault).toEqual(expect.arrayContaining([
      "exists:owner-auth.json",
      "unlink:owner-auth.json",
      "exists:profile-storage-state.json",
      "unlink:profile-storage-state.json",
      "state-service-stop",
      "npm run --silent music-cli -- down",
      "write-final-report",
    ]));
    expect(outcome.exitCode, fault).not.toBe(0);
    expect(outcome.report.result, fault).toBe("failed");
    expect(outcome.report.cleanup, fault).toBe(fault === "setup" ? "restored" : "evidence-missing");
    expect(outcome.report.restoreHashes, fault).toEqual(expect.arrayContaining([{ beforeHash: hash, afterHash: hash }]));
    expect(JSON.parse(stdout.join("")), fault).toEqual(outcome.report);
    expect(`${stdout.join("")}\n${stderr.join("")}`, fault).not.toMatch(/bearer|token/i);
    if (fault === "setup") {
      expect(reports, "restored abort evidence must be written with direct verified hashes").toEqual([
        expect.objectContaining({ cleanup: "restored", restoreHashes: [{ beforeHash: hash, afterHash: hash }] }),
      ]);
    }
  }
});

for (const teardownFault of [
  "raw-report-unlink",
  "owner-auth-unlink",
  "profile-storage-unlink",
  "private-output-remove",
  "state-service-stop",
  "exact-down",
] as const) {
  test(`runner orchestration preserves teardown after ${teardownFault} failure`, async () => {
    type RunnerReport = { result: string; cleanup: string; restoreHashes: Array<{ beforeHash: string; afterHash: string }> };
    const initialHash = "c".repeat(64);
    const journeyHash = "d".repeat(64);
    const calls: string[] = [];
    const stdout: string[] = [];
    const stderr: string[] = [];
    const reports: RunnerReport[] = [];
    const outcome = await runMusicFixtureOrchestration({
      snapshotExists: true,
      baseReport: { version: MUSIC_PUBLIC_FIXTURE_VERSION, runId: `teardown-${teardownFault}`, lane: "live" },
      artifacts: {
        directory: "fixture-artifacts",
        authPath: "owner-auth.json",
        storagePath: "profile-storage-state.json",
        mkdir: (directory) => { calls.push(`mkdir:${directory}`); },
        write: (file) => { calls.push(`write:${file}`); },
        chmod: (file) => { calls.push(`chmod:${file}`); },
      },
      restoreEvidence: {
        path: "restore-evidence.jsonl",
        exists: (file) => { calls.push(`restore-evidence-exists:${file}`); return true; },
        read: (file) => {
          calls.push(`parse-restore-evidence:${file}`);
          return `${JSON.stringify({ cleanup: "restored", beforeHash: journeyHash, afterHash: journeyHash })}\n`;
        },
      },
      execute: async () => { calls.push("execute"); return 0; },
      restore: async () => {
        calls.push("initial-restore");
        return { ok: true, cleanup: "restored", beforeHash: initialHash, afterHash: initialHash };
      },
      teardown: {
        artifactPaths: ["playwright-journey-results.json", "owner-auth.json", "profile-storage-state.json"],
        artifactDirectories: ["private-playwright-output"],
        exists: (file) => { calls.push(`exists:${file}`); return true; },
        unlink: (file) => {
          calls.push(`unlink:${file}`);
          if ((teardownFault === "raw-report-unlink" && file === "playwright-journey-results.json")
              || (teardownFault === "owner-auth-unlink" && file === "owner-auth.json")
              || (teardownFault === "profile-storage-unlink" && file === "profile-storage-state.json")) {
            throw new Error("Bearer teardown-token");
          }
        },
        removeDirectory: (directory) => {
          calls.push(`remove-directory:${directory}`);
          if (teardownFault === "private-output-remove") throw new Error("Bearer teardown-token");
        },
        stopStateService: () => {
          calls.push("state-service-stop");
          if (teardownFault === "state-service-stop") throw new Error("Bearer teardown-token");
        },
        down: () => {
          calls.push("npm run --silent music-cli -- down");
          if (teardownFault === "exact-down") throw new Error("Bearer teardown-token");
          return 0;
        },
      },
      writeReport: async (report: RunnerReport) => { calls.push("write-final-report"); reports.push(structuredClone(report)); },
      writeStdout: (text) => { stdout.push(text); },
      writeStderr: (text) => { stderr.push(text); },
    });

    expect(calls, teardownFault).toEqual([
      "mkdir:fixture-artifacts",
      "write:profile-storage-state.json",
      "chmod:profile-storage-state.json",
      "execute",
      "initial-restore",
      "restore-evidence-exists:restore-evidence.jsonl",
      "parse-restore-evidence:restore-evidence.jsonl",
      "exists:playwright-journey-results.json",
      "unlink:playwright-journey-results.json",
      "exists:owner-auth.json",
      "unlink:owner-auth.json",
      "exists:profile-storage-state.json",
      "unlink:profile-storage-state.json",
      "exists:private-playwright-output",
      "remove-directory:private-playwright-output",
      "state-service-stop",
      "npm run --silent music-cli -- down",
      "write-final-report",
    ]);
    expect(calls.filter((call) => call === "initial-restore"), teardownFault).toHaveLength(1);
    expect(outcome.teardownStatus, teardownFault).toBe(1);
    expect(outcome.exitCode, teardownFault).toBe(5);
    expect(outcome.report, teardownFault).toMatchObject({
      result: "failed",
      cleanup: "teardown-failed",
      restoreHashes: [
        { beforeHash: initialHash, afterHash: initialHash },
        { beforeHash: journeyHash, afterHash: journeyHash },
      ],
    });
    expect(outcome.report.restoreHashes.every(({ beforeHash, afterHash }) => beforeHash.length > 0 && beforeHash === afterHash), teardownFault).toBe(true);
    expect(reports, teardownFault).toEqual([outcome.report]);
    expect(JSON.parse(stdout.join("")), teardownFault).toEqual(outcome.report);
    expect(`${stdout.join("")}\n${stderr.join("")}`, teardownFault).not.toMatch(/bearer|token/i);
  });
}

test("teardown continues after an artifact existence check fails", async () => {
  const calls: string[] = [];
  const status = await stopMusicFixture({
    artifactPaths: ["owner-auth", "profile-state"],
    exists: (file) => {
      calls.push(`exists:${file}`);
      if (file === "owner-auth") throw new Error("denied");
      return true;
    },
    unlink: (file) => { calls.push(`unlink:${file}`); },
    stopStateService: () => { calls.push("state-stop"); },
    down: () => { calls.push("npm run --silent music-cli -- down"); return 0; },
  });
  expect(calls).toEqual([
    "exists:owner-auth",
    "exists:profile-state",
    "unlink:profile-state",
    "state-stop",
    "npm run --silent music-cli -- down",
  ]);
  expect(status).toBe(1);
});

type InjectedStateServiceChild = EventEmitter & {
  stdout: PassThrough;
  stderr: PassThrough;
  exitCode: number | null;
  signalCode: string | null;
  kill: (signal: string) => boolean;
};

function injectedStateServiceChild(kill: (signal: string) => boolean): InjectedStateServiceChild {
  return Object.assign(new EventEmitter(), {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    exitCode: null as number | null,
    signalCode: null as string | null,
    kill,
  });
}

test("state-service stop rejects signal acceptance without an attested terminal event", async () => {
  // Production break caught: child.kill(true) proves only signal acceptance; the
  // child can remain alive while cleanup is reported as verified.
  const cleanup = await import("../scripts/music-fixture-cleanup.mjs") as typeof import("../scripts/music-fixture-cleanup.mjs") & {
    createMusicFixtureStateServiceGuard: (input: Record<string, unknown>) => {
      stop: () => Promise<unknown>;
      snapshot: () => Record<string, unknown>;
    };
  };
  const signals: string[] = [];
  const child = injectedStateServiceChild((signal) => { signals.push(signal); return true; });
  const guard = cleanup.createMusicFixtureStateServiceGuard({
    child,
    stopTimeoutMs: 25,
    onFailure: async () => undefined,
  });

  await expect(guard.stop()).rejects.toThrow("state service stop was not attested before timeout");
  expect(signals).toEqual(["SIGKILL"]);
  expect(guard.snapshot()).toMatchObject({
    lifecycle: {
      schemaVersion: "explorers-public-state-service-lifecycle/v1",
      error: { status: "unavailable" },
      exit: { status: "unavailable" },
      close: { status: "unavailable" },
    },
  });
});

test("state-service stop awaits a delayed expected SIGKILL exit and close", async () => {
  const cleanup = await import("../scripts/music-fixture-cleanup.mjs") as typeof import("../scripts/music-fixture-cleanup.mjs") & {
    createMusicFixtureStateServiceGuard: (input: Record<string, unknown>) => {
      stop: () => Promise<unknown>;
      snapshot: () => Record<string, unknown>;
    };
  };
  const child: InjectedStateServiceChild = injectedStateServiceChild((signal) => {
    queueMicrotask(() => {
      child.signalCode = signal;
      child.emit("exit", null, signal);
      child.emit("close", null, signal);
    });
    return true;
  });
  const guard = cleanup.createMusicFixtureStateServiceGuard({
    child,
    stopTimeoutMs: 100,
    onFailure: async () => { throw new Error("intentional stop must not finalize failure"); },
  });

  await expect(guard.stop()).resolves.toMatchObject({ status: "stopped" });
  expect(guard.snapshot()).toMatchObject({
    lifecycle: {
      error: { status: "unavailable" },
      exit: { status: "observed", code: null, signal: "SIGKILL" },
      close: { status: "observed", code: null, signal: "SIGKILL" },
    },
  });
});

test("unexpected normal state-service exit is attested and routed through failure once", async () => {
  const cleanup = await import("../scripts/music-fixture-cleanup.mjs") as typeof import("../scripts/music-fixture-cleanup.mjs") & {
    createMusicFixtureStateServiceGuard: (input: Record<string, unknown>) => {
      failure: Promise<unknown>;
      stop: () => Promise<unknown>;
      snapshot: () => Record<string, unknown>;
    };
  };
  let failures = 0;
  const child = injectedStateServiceChild(() => { throw new Error("already exited child must not be signaled"); });
  const guard = cleanup.createMusicFixtureStateServiceGuard({
    child,
    stopTimeoutMs: 100,
    onFailure: async () => { failures += 1; },
  });
  child.exitCode = 0;
  child.emit("exit", 0, null);
  child.emit("close", 0, null);

  await guard.failure;
  await expect(guard.stop()).resolves.toMatchObject({ status: "already-stopped" });
  expect(failures).toBe(1);
  expect(guard.snapshot()).toMatchObject({
    lifecycle: {
      exit: { status: "observed", code: 0, signal: null },
      close: { status: "observed", code: 0, signal: null },
    },
  });
});

test("state-service error and close races invoke one failure finalizer without an unhandled error", async () => {
  const cleanup = await import("../scripts/music-fixture-cleanup.mjs") as typeof import("../scripts/music-fixture-cleanup.mjs") & {
    createMusicFixtureStateServiceGuard: (input: Record<string, unknown>) => {
      failure: Promise<unknown>;
      stop: () => Promise<unknown>;
      snapshot: () => Record<string, unknown>;
    };
  };
  const calls: string[] = [];
  const child = injectedStateServiceChild(() => false);
  const guard = cleanup.createMusicFixtureStateServiceGuard({
    child,
    stopTimeoutMs: 100,
    onFailure: async () => {
      calls.push("private-artifacts", "state-stop", "exact-down", "docker-inspection", "artifact-finalization");
    },
  });

  child.emit("error", new Error("Bearer race-private-token"));
  child.emit("close", 1, null);
  child.emit("exit", 1, null);
  await guard.failure;

  expect(calls).toEqual(["private-artifacts", "state-stop", "exact-down", "docker-inspection", "artifact-finalization"]);
  expect(guard.snapshot()).toMatchObject({
    lifecycle: {
      error: { status: "observed" },
      exit: { status: "observed", code: 1, signal: null },
      close: { status: "observed", code: 1, signal: null },
    },
  });
  await expect(guard.stop()).rejects.toThrow(/state service .*failure|state service exited/i);
  expect(JSON.stringify(guard.snapshot())).not.toContain("race-private-token");
});

test("fresh-process state-service spawn error is handled and finalizes cleanup once", () => {
  const helperUrl = pathToFileURL(resolve("scripts/music-fixture-cleanup.mjs")).href;
  const script = [
    'import { spawn } from "node:child_process";',
    `import { createMusicFixtureStateServiceGuard } from ${JSON.stringify(helperUrl)};`,
    'const calls = [];',
    'const child = spawn("missing-state-service-private-command-92841", [], { stdio: ["ignore", "pipe", "pipe"] });',
    'let guard;',
    'guard = createMusicFixtureStateServiceGuard({ child, stopTimeoutMs: 1000, onFailure: async () => {',
    '  calls.push("private-artifacts", "state-stop");',
    '  try { await guard.stop(); } catch { calls.push("state-stop-unverified"); }',
    '  calls.push("exact-down", "docker-inspection", "artifact-finalization");',
    '} });',
    'await guard.failure;',
    'process.stdout.write(JSON.stringify({ calls, snapshot: guard.snapshot() }));',
  ].join("\n");
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", script], {
    cwd: process.cwd(),
    encoding: "utf8",
    windowsHide: true,
    timeout: 5_000,
  });

  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  expect(result.stderr).toBe("");
  const outcome = JSON.parse(result.stdout);
  expect(outcome.calls).toEqual([
    "private-artifacts",
    "state-stop",
    "state-stop-unverified",
    "exact-down",
    "docker-inspection",
    "artifact-finalization",
  ]);
  expect(outcome.snapshot.lifecycle).toMatchObject({
    error: { status: "observed" },
    close: { status: "observed" },
  });
  expect(result.stdout).not.toContain("missing-state-service-private-command-92841");
});

type QualificationFailureCoordinator = {
  signal: AbortSignal;
  markSnapshotReady: () => void;
  recordFailure: (failure: {
    stage: string;
    exitCode: number;
    cleanupWhenTeardownSucceeds?: string;
    executionOutcome?: Record<string, unknown>;
  }) => void;
  runRestoration: <T>(operation: () => Promise<T> | T) => Promise<T>;
  runFinalization: <T>(operation: () => Promise<T> | T) => Promise<T>;
  snapshot: () => {
    phase: string;
    snapshotReady: boolean;
    failure: { stage: string; exitCode: number } | null;
    ledger: string[];
  };
};

type QualificationCoordinatorModule = {
  createMusicQualificationFailureCoordinator: (options?: {
    onPhase?: (phase: string) => void;
  }) => QualificationFailureCoordinator;
  runMusicFixtureOrchestration: (input: Record<string, unknown>) => Promise<{
    exitCode: number;
    report: Record<string, unknown>;
    restoration: Record<string, unknown>;
    teardownStatus: number;
  }>;
};

type QualificationFailureTiming =
  | "before-snapshot"
  | "immediately-after-snapshot"
  | "simultaneous-with-restoration"
  | "during-execution"
  | "during-restoration"
  | "after-restoration-before-teardown"
  | "duplicate-terminal-events";

async function runInjectedQualificationFailureTiming(timing: QualificationFailureTiming) {
  const runner = await import("../scripts/music-public-e2e-runner.mjs") as unknown as QualificationCoordinatorModule;
  const calls: string[] = [];
  const reports: Array<Record<string, unknown>> = [];
  const equalHash = "7".repeat(64);
  const hasSnapshot = timing !== "before-snapshot";
  const coordinatorHolder: QualificationFailureCoordinator[] = [];
  const recordStateFailure = (stage = "state-service-exit") => {
    calls.push(`failure:${stage}`);
    coordinatorHolder[0].recordFailure({ stage, exitCode: 4 });
  };
  const coordinator = runner.createMusicQualificationFailureCoordinator({
    onPhase: (phase) => {
      if (timing === "simultaneous-with-restoration" && phase === "restoration") {
        recordStateFailure();
      }
      if (timing === "after-restoration-before-teardown" && phase === "restoration-complete") {
        recordStateFailure();
      }
    },
  });
  coordinatorHolder.push(coordinator);
  if (hasSnapshot) coordinator.markSnapshotReady();
  if (timing === "before-snapshot" || timing === "immediately-after-snapshot") recordStateFailure();

  const outcome = await runner.runMusicFixtureOrchestration({
    snapshotExists: hasSnapshot,
    coordinator,
    baseReport: { version: MUSIC_PUBLIC_FIXTURE_VERSION, runId: `phase-${timing}`, lane: "live" },
    artifacts: {
      directory: "guarded/phase-contract",
      authPath: "owner-auth.json",
      storagePath: "profile-storage-state.json",
      mkdir: () => undefined,
      write: () => undefined,
      chmod: () => undefined,
    },
    restoreEvidence: {
      path: "restore-evidence.jsonl",
      exists: () => false,
      read: () => "",
    },
    execute: async () => {
      calls.push("execution");
      if (timing === "during-execution") recordStateFailure();
      if (timing === "duplicate-terminal-events") {
        recordStateFailure("state-service-error");
        recordStateFailure("state-service-exit");
        recordStateFailure("state-service-close");
      }
      return { status: 0 };
    },
    restore: async () => {
      calls.push("restore");
      if (timing === "during-restoration") recordStateFailure();
      return timing === "during-restoration"
        ? { ok: false, cleanup: "restore-failed", beforeHash: equalHash, afterHash: "8".repeat(64) }
        : { ok: true, cleanup: "restored", beforeHash: equalHash, afterHash: equalHash };
    },
    teardown: {
      artifactPaths: ["restore-evidence.jsonl", "owner-auth.json", "profile-storage-state.json", "playwright-journey-results.json"],
      artifactDirectories: ["private-playwright-output"],
      exists: (artifact: string) => { calls.push(`exists:${artifact}`); return true; },
      unlink: (artifact: string) => { calls.push(`unlink:${artifact}`); },
      removeDirectory: (directory: string) => { calls.push(`remove:${directory}`); },
      stopStateService: async () => { calls.push("state-stop"); },
      down: async () => {
        calls.push("exact-down");
        return timing === "duplicate-terminal-events" ? 1 : 0;
      },
    },
    writeReport: async () => undefined,
    writeStdout: (text: string) => { reports.push(JSON.parse(text)); },
    writeStderr: () => undefined,
  });
  const finalized = await coordinator.runFinalization(async () => {
    calls.push("docker-inspection", "artifact-finalization");
    return { exitCode: outcome.exitCode };
  });
  calls.push("exit");
  return { calls, coordinator: coordinator.snapshot(), finalized, outcome, reports };
}

for (const phaseCase of [
  {
    timing: "before-snapshot",
    cleanup: "not-required-safe",
    exitCode: 4,
    restoreCalls: 0,
    ledger: [
      "failure:pre-snapshot", "orchestration", "execution-skipped", "teardown", "teardown-complete",
      "ready-to-finalize", "finalization", "settled",
    ],
  },
  {
    timing: "immediately-after-snapshot",
    cleanup: "restored",
    exitCode: 4,
    restoreCalls: 1,
    ledger: [
      "snapshot-ready", "failure:snapshot-ready", "orchestration", "execution-skipped", "restoration",
      "restoration-complete", "teardown", "teardown-complete", "ready-to-finalize", "finalization", "settled",
    ],
  },
  {
    timing: "during-execution",
    cleanup: "restored",
    exitCode: 4,
    restoreCalls: 1,
    ledger: [
      "snapshot-ready", "orchestration", "execution", "failure:execution", "execution-complete", "restoration",
      "restoration-complete", "teardown", "teardown-complete", "ready-to-finalize", "finalization", "settled",
    ],
  },
  {
    timing: "simultaneous-with-restoration",
    cleanup: "restored",
    exitCode: 4,
    restoreCalls: 1,
    ledger: [
      "snapshot-ready", "orchestration", "execution", "execution-complete", "restoration", "failure:restoration",
      "restoration-complete", "teardown", "teardown-complete", "ready-to-finalize", "finalization", "settled",
    ],
  },
  {
    timing: "during-restoration",
    cleanup: "restore-failed",
    exitCode: 5,
    restoreCalls: 1,
    ledger: [
      "snapshot-ready", "orchestration", "execution", "execution-complete", "restoration", "failure:restoration",
      "restoration-complete", "teardown", "teardown-complete", "ready-to-finalize", "finalization", "settled",
    ],
  },
  {
    timing: "after-restoration-before-teardown",
    cleanup: "restored",
    exitCode: 4,
    restoreCalls: 1,
    ledger: [
      "snapshot-ready", "orchestration", "execution", "execution-complete", "restoration", "restoration-complete",
      "failure:restoration-complete", "teardown", "teardown-complete", "ready-to-finalize", "finalization", "settled",
    ],
  },
  {
    timing: "duplicate-terminal-events",
    cleanup: "teardown-failed",
    exitCode: 5,
    restoreCalls: 1,
    ledger: [
      "snapshot-ready", "orchestration", "execution", "failure:execution", "execution-complete", "restoration",
      "restoration-complete", "teardown", "teardown-complete", "ready-to-finalize", "finalization", "settled",
    ],
  },
] as const) {
  test(`phase-aware failure coordinator restores and finalizes once for ${phaseCase.timing}`, async () => {
    // Production break caught: a state-service callback could independently exit
    // over the active orchestration, skipping or racing the required restore.
    const result = await runInjectedQualificationFailureTiming(phaseCase.timing);

    expect(result.calls.filter((call) => call === "restore")).toHaveLength(phaseCase.restoreCalls);
    expect(result.calls.filter((call) => call === "state-stop")).toHaveLength(1);
    expect(result.calls.filter((call) => call === "exact-down")).toHaveLength(1);
    expect(result.calls.filter((call) => call === "artifact-finalization")).toHaveLength(1);
    expect(result.calls.filter((call) => call === "exit")).toHaveLength(1);
    expect(result.reports).toHaveLength(1);
    expect(result.outcome.report.cleanup).toBe(phaseCase.cleanup);
    expect(result.outcome.exitCode).toBe(phaseCase.exitCode);
    expect(result.finalized).toEqual({ exitCode: phaseCase.exitCode });
    expect(result.coordinator.ledger).toEqual(phaseCase.ledger);
    expect(result.coordinator.failure).toMatchObject({ exitCode: 4 });
    if (phaseCase.restoreCalls === 0) {
      expect(result.calls.indexOf("restore")).toBe(-1);
    } else {
      expect(result.calls.indexOf("restore")).toBeGreaterThanOrEqual(0);
      expect(result.calls.indexOf("restore")).toBeLessThan(result.calls.indexOf("state-stop"));
    }
    expect(result.calls.indexOf("state-stop")).toBeLessThan(result.calls.indexOf("exact-down"));
    expect(result.calls.indexOf("exact-down")).toBeLessThan(result.calls.indexOf("docker-inspection"));
    expect(result.calls.indexOf("docker-inspection")).toBeLessThan(result.calls.indexOf("artifact-finalization"));
    expect(result.calls.indexOf("artifact-finalization")).toBeLessThan(result.calls.indexOf("exit"));
  });
}

test("fresh process preserves post-snapshot restoration ownership across duplicate terminal failures", () => {
  const runnerUrl = pathToFileURL(resolve("scripts/music-public-e2e-runner.mjs")).href;
  const script = [
    `import { createMusicQualificationFailureCoordinator, runMusicFixtureOrchestration } from ${JSON.stringify(runnerUrl)};`,
    'const calls = []; const reports = []; const hash = "a".repeat(64);',
    'const coordinator = createMusicQualificationFailureCoordinator();',
    'coordinator.markSnapshotReady();',
    'const outcome = await runMusicFixtureOrchestration({',
    '  snapshotExists: true, coordinator, baseReport: { version: "v1", runId: "fresh-phase", lane: "live" },',
    '  artifacts: { directory: "guarded", authPath: "owner-auth.json", storagePath: "profile-storage.json", mkdir() {}, write() {}, chmod() {} },',
    '  restoreEvidence: { path: "restore.jsonl", exists() { return false; }, read() { return ""; } },',
    '  execute: async () => { coordinator.recordFailure({ stage: "state-service-error", exitCode: 4 }); coordinator.recordFailure({ stage: "state-service-exit", exitCode: 4 }); coordinator.recordFailure({ stage: "state-service-close", exitCode: 4 }); return { status: 0 }; },',
    '  restore: async () => { calls.push("restore"); return { ok: true, cleanup: "restored", beforeHash: hash, afterHash: hash }; },',
    '  teardown: { artifactPaths: [], artifactDirectories: [], exists() { return false; }, unlink() {}, removeDirectory() {}, async stopStateService() { calls.push("state-stop"); }, async down() { calls.push("exact-down"); return 0; } },',
    '  async writeReport() {}, writeStdout(text) { reports.push(JSON.parse(text)); }, writeStderr() {},',
    '});',
    'await coordinator.runFinalization(async () => { calls.push("artifact-finalization"); return outcome.exitCode; });',
    'calls.push("exit");',
    'process.stdout.write(JSON.stringify({ calls, reports, outcome, coordinator: coordinator.snapshot() }));',
  ].join("\n");
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", script], {
    cwd: process.cwd(),
    encoding: "utf8",
    windowsHide: true,
    timeout: 5_000,
  });

  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  expect(result.stderr).toBe("");
  const observed = JSON.parse(result.stdout);
  expect(observed.calls).toEqual(["restore", "state-stop", "exact-down", "artifact-finalization", "exit"]);
  expect(observed.reports).toHaveLength(1);
  expect(observed.outcome).toMatchObject({ exitCode: 4, report: { cleanup: "restored", result: "failed" } });
  expect(observed.coordinator.ledger.filter((entry: string) => entry.startsWith("failure:"))).toEqual(["failure:execution"]);
  expect(result.stdout).not.toMatch(/Unhandled 'error' event|ERR_UNHANDLED_ERROR/);
});

test("fresh live runner lets verified restoration finish before a state-service failure finalizes", () => {
  // Production break caught: the guard callback called process.exit from a
  // microtask while restoreInitialSnapshot was awaiting its response.
  const sandbox = mkdtempSync(join(tmpdir(), "music-public-phase-owner-"));
  try {
    const preloader = join(sandbox, "phase-owner-preload.cjs");
    const phaseLog = join(sandbox, "phase-owner.log");
    writeFileSync(preloader, [
      'const childProcess = require("node:child_process");',
      'const { EventEmitter } = require("node:events");',
      'const { appendFileSync } = require("node:fs");',
      'const { PassThrough } = require("node:stream");',
      'const { syncBuiltinESMExports } = require("node:module");',
      'const append = (entry) => appendFileSync(process.env.FAKE_PHASE_LOG, `${entry}\n`);',
      'const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough(), exitCode: null, signalCode: null, kill(signal) { this.signalCode = signal; queueMicrotask(() => { this.stdout.end(); this.stderr.end(); this.emit("exit", null, signal); this.emit("close", null, signal); }); return true; } });',
      'childProcess.spawn = () => child;',
      'childProcess.spawnSync = (file, args = []) => {',
      '  const joined = args.join(" ");',
      '  const action = ["bootstrap", "up", "down"].find((candidate) => joined.includes(`music-cli -- ${candidate}`));',
      '  if (action) { append(action); return { status: 0, stdout: "", stderr: "", signal: null, error: undefined }; }',
      '  if (String(file) === "git") return { status: 0, stdout: `${"a".repeat(40)}\n`, stderr: "", signal: null, error: undefined };',
      '  if (String(file).toLowerCase().includes("docker")) return { status: 0, stdout: "", stderr: "", signal: null, error: undefined };',
      '  return { status: 1, stdout: "", stderr: "preflight stopped", signal: null, error: undefined };',
      '};',
      'syncBuiltinESMExports();',
      'let terminalEmitted = false;',
      'global.fetch = async (input) => {',
      '  const url = String(input);',
      '  if (url.endsWith("/snapshot")) return { ok: true, status: 200, async json() { append("snapshot-complete"); return { database: { dumpHash: "b".repeat(64) } }; } };',
      '  if (url.endsWith("/restore")) {',
      '    append("restore-start");',
      '    if (!terminalEmitted) { terminalEmitted = true; child.exitCode = 1; child.emit("error", new Error("Bearer fresh-phase-private")); child.emit("exit", 1, null); child.stdout.end(); child.stderr.end(); child.emit("close", 1, null); }',
      '    return { ok: true, status: 200, async json() { append("restore-complete"); return { beforeHash: "b".repeat(64), afterHash: "b".repeat(64) }; } };',
      '  }',
      '  if (url.includes("/api/accounts/")) return { ok: true, status: 200, async json() { return { data: { documentId: process.env.MUSIC_E2E_ACCOUNT_DOCUMENT_ID } }; } };',
      '  if (url.endsWith("/api/users/me")) return { ok: true, status: 200, async json() { return { username: process.env.MUSIC_E2E_ACCOUNT_USERNAME, documentId: process.env.MUSIC_E2E_USER_DOCUMENT_ID, accounts: [{ documentId: process.env.MUSIC_E2E_ACCOUNT_DOCUMENT_ID }] }; } };',
      '  return { ok: true, status: 200, async json() { return {}; } };',
      '};',
      'process.exit = (code) => { append(`exit:${code}`); process.exitCode = 1; };',
      '',
    ].join("\n"));
    const runId = "post-snapshot-owner-contract";
    const environment = lifecycleFreshProcessEnvironment({
      sandbox,
      runId,
      fakeNpmPath: "phase-owner-fake-npm.mjs",
      fakeDockerHookPath: preloader,
      binDirectory: sandbox,
      scenario: "phase-owner",
      dockerMode: "clean",
      privateValue: "fresh-phase-private",
    });
    environment.NODE_OPTIONS = `--require=${preloader}`;
    environment.FAKE_PHASE_LOG = phaseLog;
    environment.MUSIC_E2E_HEALTH_URLS = Array.from({ length: 5 }, () => "http://127.0.0.1:55174/health").join(",");
    const result = spawnSync(process.execPath, [resolve("scripts/music-public-e2e.mjs"), "live"], {
      cwd: sandbox,
      env: environment,
      encoding: "utf8",
      windowsHide: true,
      timeout: 10_000,
    });
    const runDirectory = join(sandbox, ".artifacts", "music-public", runId);
    const phaseEntries = readFileSync(phaseLog, "utf8").trim().split(/\r?\n/);
    const evidence = JSON.parse(readFileSync(join(runDirectory, "evidence.json"), "utf8"));

    expect(result.status, `${result.stdout}\n${result.stderr}\n${JSON.stringify({ phaseEntries, evidence })}`).toBe(1);
    expect(phaseEntries.filter((entry) => entry === "restore-start")).toHaveLength(1);
    expect(phaseEntries.filter((entry) => entry === "restore-complete")).toHaveLength(1);
    expect(phaseEntries.filter((entry) => entry === "down")).toHaveLength(1);
    expect(phaseEntries.filter((entry) => entry.startsWith("exit:"))).toEqual(["exit:5"]);
    expect(phaseEntries.indexOf("snapshot-complete")).toBeLessThan(phaseEntries.indexOf("restore-start"));
    expect(phaseEntries.indexOf("restore-complete")).toBeLessThan(phaseEntries.indexOf("down"));
    expect(result.stdout.trim().split(/\r?\n/)).toHaveLength(1);
    expect(evidence).toMatchObject({ result: "failed", cleanup: "teardown-failed", exitCode: 5 });
    expect(`${result.stdout}\n${result.stderr}\n${JSON.stringify(evidence)}`).not.toContain("fresh-phase-private");
    expect(`${result.stdout}\n${result.stderr}\n${JSON.stringify(evidence)}`).not.toContain(sandbox);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

test("one canonical adapter refuses incomplete account state and restores every domain through namespace reset", async () => {
  const complete = {
    version: "music-live-account-snapshot/v1",
    snapshotId: "snapshot-fixture",
    publication: { coveredByDatabaseDump: true },
    guestControls: { coveredByDatabaseDump: true },
    queue: { coveredByDatabaseDump: true },
    playlists: { coveredByDatabaseDump: true },
    requests: { coveredByDatabaseDump: true },
    profile: { accountDocumentId: "e2e-public-music-run-account", publicMusic: true, preferenceRevision: 4, preferenceHash: "b".repeat(64) },
    database: { namespace: "e2e-public-music-run", dumpHash: "a".repeat(64) },
  } as const;
  let current: unknown = structuredClone(complete);
  let resetValue: unknown;
  const adapter = createCanonicalMusicFixtureAdapter({
    readFullSnapshot: async () => structuredClone(current),
    resetNamespace: async (snapshot) => { resetValue = structuredClone(snapshot); current = structuredClone(snapshot); },
  });
  const snapshot = await adapter.snapshot();
  current = { ...complete, playlists: [] };
  await adapter.restore(snapshot);
  expect(resetValue).toEqual(complete);
  await expect(adapter.snapshot()).resolves.toEqual(complete);

  current = { ...complete, requests: undefined };
  await expect(adapter.snapshot()).rejects.toThrow(/requests/i);
});

test("mutating browser journeys use the automatic live-authority fixture before their test bodies", () => {
  expect(musicLiveTest).toBeDefined();
  const publicSource = readFileSync("e2e/music-public-contract.spec.ts", "utf8");
  const fullstackSource = readFileSync("e2e/music-fixture-fullstack.spec.ts", "utf8");
  expect(publicSource).toContain("const liveTest = musicLiveTest");
  expect(fullstackSource).toContain("const test = musicLiveTest");
  for (const title of [
    "live owner/guest toggle",
    "live guest reconnect",
    "live guest request",
    "live guest playback",
    "owner publication, playlist visibility",
  ]) {
    expect(publicSource).toMatch(new RegExp(`liveTest\\([^\\n]*${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  }
});

test("static mutation guard rejects raw API writes and standard-test live bypasses", () => {
  for (const file of ["e2e/music-public-contract.spec.ts", "e2e/music-fixture-fullstack.spec.ts"]) {
    const source = readFileSync(file, "utf8");
    const lines = source.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (/\.request\.(?:post|put|patch|delete)\(/.test(line)) {
        const guardedContext = lines.slice(Math.max(0, index - 2), index + 1).join("\n");
        expect(guardedContext, `${file}:${index + 1} raw mutation bypass`).toMatch(/guardedMutation\(|runAuthorizedMusicMutation\(/);
      }
    });
    expect(source, `${file} must not suite-skip in place of per-body authority`).not.toMatch(/test\.skip\(Boolean\(liveSkipReason\)[\s\S]{0,120}describe/);
  }
  const publicSource = readFileSync("e2e/music-public-contract.spec.ts", "utf8");
  expect(publicSource).not.toMatch(/\btest\(["'`]live /);
  expect(publicSource).not.toMatch(/\btest\(["'`]owner publication,/);
});

test("live fixture always restores and rejects normalized state drift", async () => {
  resetMusicRestoreBlockForContractTest();
  const events: string[] = [];
  let state: unknown = { publication: { mode: "private" }, queue: [] };
  await expect(withRestoredMusicFixture({
    snapshot: async () => structuredClone(state),
    restore: async (snapshot) => { events.push("restore"); state = snapshot; },
    cleanupNamespace: async () => { events.push("cleanup"); },
  }, async () => {
    state = { publication: { mode: "public" }, queue: [{ publicId: "fixture-song" }] };
    events.push("journey");
  })).resolves.toMatchObject({ cleanup: "restored", beforeHash: expect.any(String), afterHash: expect.any(String) });
  expect(events).toEqual(["journey", "cleanup", "restore"]);

  let snapshots = 0;
  await expect(withRestoredMusicFixture({
    snapshot: async () => snapshots++ === 0
      ? ({ publication: { mode: "private" } })
      : ({ publication: { mode: "public" } }),
    restore: async () => undefined,
    cleanupNamespace: async () => undefined,
  }, async () => undefined)).rejects.toThrow(/restoration mismatch/);
});

test("restore runs after journey failure, preserves the original state, and teardown is idempotent", async () => {
  resetMusicRestoreBlockForContractTest();
  const original = { publication: { mode: "unlisted" }, permissions: { allowSongRequests: true }, queue: ["one"] };
  let state = structuredClone(original);
  let cleanupCount = 0;
  const adapters = {
    snapshot: async () => structuredClone(state),
    cleanupNamespace: async () => { cleanupCount += 1; },
    restore: async (snapshot: unknown) => { state = structuredClone(snapshot); },
  };
  await expect(withRestoredMusicFixture(adapters, async () => {
    state = { publication: { mode: "private" }, permissions: { allowSongRequests: false }, queue: [] };
    throw new Error("journey failed");
  })).rejects.toThrow("journey failed");
  expect(state).toEqual(original);
  await expect(withRestoredMusicFixture(adapters, async () => "second teardown")).resolves.toMatchObject({ cleanup: "restored" });
  expect(cleanupCount).toBe(2);
});

test("restore is still attempted when namespace cleanup fails and subsequent live mutations are blocked", async () => {
  resetMusicRestoreBlockForContractTest();
  let restoreCount = 0;
  const evidence: unknown[] = [];
  await expect(withRestoredMusicFixture({
    snapshot: async () => ({ publication: { mode: "unlisted" } }),
    cleanupNamespace: async () => { throw new Error("namespace cleanup failed"); },
    restore: async () => { restoreCount += 1; },
    writeRecoveryArtifact: async (artifact) => { evidence.push(artifact); },
  }, async () => undefined)).rejects.toThrow("namespace cleanup failed");
  expect(restoreCount).toBe(1);
  expect(evidence).toEqual([{ reason: "cleanup-failed", beforeHash: expect.any(String) }]);
  expect(JSON.stringify(evidence)).not.toMatch(/token|credential|capability/i);
  await expect(runAuthorizedMusicMutation({
    lane: "live",
    liveWriteEnabled: true,
    baseUrl: "http://127.0.0.1:55173",
    serviceOrigins: ["http://127.0.0.1:55173"],
    accountDocumentId: "e2e-public-music-run-account",
    accountUsername: "e2e-public-music-run-owner",
    fixtureVersion: MUSIC_PUBLIC_FIXTURE_VERSION,
    confirmation: "I_UNDERSTAND_THIS_MUTATES_A_DISPOSABLE_FIXTURE",
  }, "guest-controls", async () => undefined)).rejects.toThrow(/blocked after a restoration failure/);
  resetMusicRestoreBlockForContractTest();
});

test("restore mismatch emits sanitized recovery evidence and blocks subsequent live mutations", async () => {
  resetMusicRestoreBlockForContractTest();
  const evidence: unknown[] = [];
  let snapshots = 0;
  await expect(withRestoredMusicFixture({
    snapshot: async () => snapshots++ === 0 ? ({ publication: { mode: "public" } }) : ({ publication: { mode: "private" } }),
    cleanupNamespace: async () => undefined,
    restore: async () => undefined,
    writeRecoveryArtifact: async (artifact) => { evidence.push(artifact); },
  }, async () => undefined)).rejects.toThrow(/restoration mismatch/);
  expect(JSON.stringify(evidence)).not.toMatch(/token|credential|capability/i);
  await expect(runAuthorizedMusicMutation({
    lane: "live",
    liveWriteEnabled: true,
    baseUrl: "http://127.0.0.1:55173",
    serviceOrigins: ["http://127.0.0.1:55173"],
    accountDocumentId: "e2e-public-music-run-account",
    accountUsername: "e2e-public-music-run-owner",
    fixtureVersion: MUSIC_PUBLIC_FIXTURE_VERSION,
    confirmation: "I_UNDERSTAND_THIS_MUTATES_A_DISPOSABLE_FIXTURE",
  }, "guest-controls", async () => undefined)).rejects.toThrow(/blocked after a restoration failure/);
  resetMusicRestoreBlockForContractTest();
});

test("real restoration failures retain a sanitized recovery artifact without custom wiring", async ({ browserName }, testInfo) => {
  expect(browserName).toBe("chromium");
  resetMusicRestoreBlockForContractTest();
  const artifactPath = testInfo.outputPath("music-recovery.json");
  const previousPath = process.env.MUSIC_E2E_RECOVERY_ARTIFACT_PATH;
  process.env.MUSIC_E2E_RECOVERY_ARTIFACT_PATH = artifactPath;
  let snapshots = 0;
  try {
    await expect(withRestoredMusicFixture({
      snapshot: async () => snapshots++ === 0
        ? ({ publication: { mode: "public" }, credential: "must-not-be-recorded" })
        : ({ publication: { mode: "private" }, credential: "must-not-be-recorded" }),
      cleanupNamespace: async () => undefined,
      restore: async () => undefined,
    }, async () => undefined)).rejects.toThrow(/restoration mismatch/);
    const artifact = readFileSync(artifactPath, "utf8");
    expect(JSON.parse(artifact)).toMatchObject({
      version: MUSIC_PUBLIC_FIXTURE_VERSION,
      reason: "restore-mismatch",
      beforeHash: expect.any(String),
      afterHash: expect.any(String),
    });
    expect(artifact).not.toMatch(/must-not-be-recorded|credential|token|capability/i);
  } finally {
    if (previousPath === undefined) delete process.env.MUSIC_E2E_RECOVERY_ARTIFACT_PATH;
    else process.env.MUSIC_E2E_RECOVERY_ARTIFACT_PATH = previousPath;
    resetMusicRestoreBlockForContractTest();
  }
});
