import { expect, test } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { chmodSync, copyFileSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { PassThrough } from "node:stream";
import { pathToFileURL } from "node:url";
import {
  MUSIC_MUTATION_CALLSITES,
  MUSIC_PUBLIC_FIXTURE_VERSION,
  MUSIC_PUBLIC_STATES,
  assertLivePublicSlug,
  assertLiveWriteAuthority,
  buildPermissionMatrix,
  buildPairwisePermissionMatrix,
  buildSanitizedFixtureEvidence,
  createCanonicalMusicFixtureAdapter,
  fixtureNamespace,
  normalizedSnapshotHash,
  prepareLivePublicMusicJourney,
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
import { LIVE_QUALIFICATION_REQUIRED_ARTIFACTS } from "../scripts/music-public-qualification-artifacts.mjs";
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
  { id: "music.read-only.owner-view-as-guest", title: "owner View as guest link opens public Music in a separate logged-out browser context", source: "e2e/music-public-contract.spec.ts" },
  { id: "music.read-only.permission-matrix", title: "pairwise permission matrix changes each concrete guest surface", source: "e2e/music-public-contract.spec.ts" },
  { id: "music.read-only.first-view-fallback", title: "first-view fallback selects the first permitted content and then the explicit empty state", source: "e2e/music-public-contract.spec.ts" },
  { id: "music.read-only.a11y-announcements", title: "screen readers receive actual loading and request-success announcements", source: "e2e/music-public-contract.spec.ts" },
  { id: "music.read-only.share-privacy", title: "public and unlisted shares preserve canonical and capability privacy", source: "e2e/music-public-contract.spec.ts" },
  { id: "music.read-only.cache-isolation", title: "public and unlisted caches stay isolated and invalid capabilities recover generically", source: "e2e/music-public-contract.spec.ts" },
  { id: "music.read-only.generic-recovery", title: "invalid, private, and unavailable resources converge on generic recovery", source: "e2e/music-public-contract.spec.ts" },
  { id: "music.read-only.viewport-320x700", title: "accessible public structure reflows at 320x700", source: "e2e/music-public-contract.spec.ts" },
  { id: "music.read-only.viewport-375x667", title: "accessible public structure reflows at 375x667", source: "e2e/music-public-contract.spec.ts" },
  { id: "music.read-only.viewport-390x844", title: "accessible public structure reflows at 390x844", source: "e2e/music-public-contract.spec.ts" },
  { id: "music.read-only.viewport-768x1024", title: "accessible public structure reflows at 768x1024", source: "e2e/music-public-contract.spec.ts" },
  { id: "music.read-only.viewport-1440x900", title: "accessible public structure reflows at 1440x900", source: "e2e/music-public-contract.spec.ts" },
  { id: "music.read-only.friendly-descriptor", title: "friendly route resolves one stable Account descriptor and shares canonical content", source: "e2e/music-public-contract.spec.ts" },
  { id: "music.read-only.friendly-navigation", title: "friendly Music navigation preserves history, current-page semantics, heading order, and announcements", source: "e2e/music-public-contract.spec.ts" },
  { id: "music.read-only.wrong-user-recovery", title: "wrong username and descriptor outage use non-enumerating recovery", source: "e2e/music-public-contract.spec.ts" },
  { id: "music.read-only.preference-true-missing", title: "explicit friendly recovery: preference=true descriptor=missing", source: "e2e/music-public-contract.spec.ts" },
  { id: "music.read-only.preference-true-outage", title: "explicit friendly recovery: preference=true descriptor=outage", source: "e2e/music-public-contract.spec.ts" },
  { id: "music.read-only.preference-false-available", title: "explicit friendly recovery: preference=false descriptor=available", source: "e2e/music-public-contract.spec.ts" },
  { id: "music.read-only.visual-dark-banner", title: "visual baseline dark-banner-full-content", source: "e2e/music-public-contract.spec.ts" },
  { id: "music.read-only.visual-minimal-light", title: "visual baseline minimal-light-solid", source: "e2e/music-public-contract.spec.ts" },
  { id: "music.read-only.visual-image-fallback", title: "visual baseline failed-image-fallback", source: "e2e/music-public-contract.spec.ts" },
  { id: "music.read-only.visual-mobile-reconnecting", title: "visual baseline mobile-reconnecting", source: "e2e/music-public-contract.spec.ts" },
  { id: "music.read-only.visual-long-nav", title: "visual baseline 320-long-nav-stress", source: "e2e/music-public-contract.spec.ts" },
  { id: "music.read-only.visual-desktop-full", title: "visual baseline desktop-full-content", source: "e2e/music-public-contract.spec.ts" },
  { id: "profile.read-only.restore-emergency", title: "restore guard uses one emergency cleanup and preserves the original failure", source: "e2e/profile-theme.spec.ts" },
  { id: "profile.read-only.restore-confirmed", title: "restore guard never performs an emergency write after a confirmed normal restore", source: "e2e/profile-theme.spec.ts" },
  { id: "profile.read-only.restore-concurrent-change", title: "restore guard refuses every write after a concurrent profile change", source: "e2e/profile-theme.spec.ts" },
  { id: "profile.read-only.covering-array", title: "covering array dry run proves all values and all factor pairs", source: "e2e/profile-theme.spec.ts" },
  { id: "profile.read-only.live-timeout", title: "live timeout preserves at least five minutes for exact restore", source: "e2e/profile-theme.spec.ts" },
  { id: "profile.read-only.live-batches", title: "live matrix is split into ordered batches of at most twelve rows", source: "e2e/profile-theme.spec.ts" },
  { id: "profile.read-only.first-view-oracle", title: "live row oracle promotes a category first view independently of saved order", source: "e2e/profile-theme.spec.ts" },
  { id: "profile.read-only.theme-elements", title: "renders homepage, navigation, and theme system elements", source: "e2e/profile-theme.spec.ts" },
] as const;

const LIVE_MUTATION_TAG = "@explorers-live-mutation";
const LIVE_READ_ONLY_TAG = "@explorers-live-read-only";

const EXACT_PUBLIC_LIVE_AUTHORITY_ARGS = [
  "--ack",
  "I_UNDERSTAND_THIS_MUTATES_A_DISPOSABLE_FIXTURE",
  "--fixture-version",
  MUSIC_PUBLIC_FIXTURE_VERSION,
  "--confirm-project",
  "explorers-music-fixture",
  "--confirm-namespace-reset",
  "RESET_EXPLORERS_MUSIC_FIXTURE_NAMESPACE",
] as const;

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
  { role: "fixture-authority", path: "fixture-authority.json" },
  { role: "analytics-ledger", path: "analytics-events.jsonl" },
  { role: "visual-trace-ledger", path: "visual-trace-ledger.json" },
  { role: "docker-inspection", path: "docker-inspection.json" },
  { role: "skip-ledger", path: "skip-reasons.json" },
  { role: "restoration-record", path: "restoration.json" },
  { role: "journey-outcomes", path: "journey-outcomes.json" },
  { role: "mutation-guard", path: "mutation-guard.json" },
  { role: "evidence", path: "evidence.json" },
] as const;
const SAFE_FIXTURE_AUTHORITY_GATE = Object.freeze({
  schemaVersion: "explorers-public-fixture-authority/v1",
  status: "accepted",
  command: ["npm", "run", "--silent", "music:fixture:authority:attest"],
  cwd: "<repository>",
  exitCode: 0,
  termination: "exited",
  attestation: {
    schemaVersion: "music-fixture-authority-attestation/v1",
    state: "tombstone",
    safeToBootstrap: true,
    usableRecords: 0,
  },
});
const NONE_RETAINED_VISUAL_LEDGER = `${JSON.stringify({
  schemaVersion: "explorers-public-visual-trace-ledger/v1",
  status: "none-retained",
  visuals: [],
  traces: [],
})}\n`;

function notRunJourneyOutcomeLedger() {
  return {
    schemaVersion: "explorers-public-journey-outcomes/v1",
    integrity: "not-run",
    counts: {
      execution: { total: 49, passed: 0, failed: 0, skipped: 0, notRun: 49 },
      terminal: { total: 17, passed: 0, failed: 0, missing: 0, invalid: 0, notRun: 17 },
    },
    executionOutcomes: [...EXPECTED_LIVE_JOURNEYS, ...EXPECTED_LIVE_READ_ONLY].map(({ id }) => ({
      id, status: "not-run", reason: "execution-not-run", stage: "preflight",
    })),
    mutationTerminals: EXPECTED_LIVE_JOURNEYS.map(({ id }) => ({
      id, status: "not-run", reason: "terminal-not-run", stage: "preflight",
    })),
  };
}

function unavailablePrebrowserQualification() {
  return {
    schemaVersion: "explorers-public-prebrowser-qualification/v2",
    status: "unavailable",
    code: "not-run",
    snapshotFailure: { phase: "none", stage: "none", code: "none" },
    checks: {
      populatedRollback: false, profileCapability: false, privateAuthority: false,
      staleRejected: false, publicProjection: false, musicPrerequisites: false,
      baselineRestored: false, ephemeralOwnerRetired: false, guardClear: false,
    },
    counts: { identityRows: 0, categoryQueries: 0, musicPrerequisites: 0 },
    hashes: {
      populatedDatabase: null, rollbackDatabase: null, populatedProfile: null, rollbackProfile: null,
      baselineDatabase: null, restoredBaselineDatabase: null, baselineProfile: null,
      restoredBaselineProfile: null, publicSlug: null,
    },
    profileRevisions: { populated: null, rollback: null, baseline: null, restoredBaseline: null },
  };
}

function passedPrebrowserQualification() {
  return {
    schemaVersion: "explorers-public-prebrowser-qualification/v2",
    status: "passed",
    code: "none",
    snapshotFailure: { phase: "none", stage: "none", code: "none" },
    checks: {
      populatedRollback: true, profileCapability: true, privateAuthority: true,
      staleRejected: true, publicProjection: true, musicPrerequisites: true,
      baselineRestored: true, ephemeralOwnerRetired: true, guardClear: true,
    },
    counts: { identityRows: 1, categoryQueries: 20, musicPrerequisites: 9 },
    hashes: {
      populatedDatabase: "1".repeat(64), rollbackDatabase: "1".repeat(64),
      populatedProfile: "2".repeat(64), rollbackProfile: "2".repeat(64),
      baselineDatabase: "3".repeat(64), restoredBaselineDatabase: "3".repeat(64),
      baselineProfile: "4".repeat(64), restoredBaselineProfile: "4".repeat(64),
      publicSlug: "5".repeat(64),
    },
    profileRevisions: { populated: 1, rollback: 1, baseline: 0, restoredBaseline: 0 },
  };
}

function failedPrebrowserQualification() {
  return {
    ...unavailablePrebrowserQualification(),
    status: "failed",
    code: "public-capability-failed",
  };
}

function unavailableInitialSnapshotQualification() {
  return {
    schemaVersion: "explorers-public-initial-snapshot/v1",
    status: "unavailable",
    stage: "not-run",
    code: "not-run",
    metadata: {
      databaseHash: null,
      profileHash: null,
      identityRows: null,
      profileRevision: null,
      profileFieldCount: null,
    },
  };
}

function passedInitialSnapshotQualification() {
  return {
    schemaVersion: "explorers-public-initial-snapshot/v1",
    status: "passed",
    stage: "snapshot-store",
    code: "none",
    metadata: {
      databaseHash: "a".repeat(64),
      profileHash: "b".repeat(64),
      identityRows: 0,
      profileRevision: 0,
      profileFieldCount: 2,
    },
  };
}

function seededQualificationEvidence() {
  return `${JSON.stringify({
    initialSnapshotQualification: unavailableInitialSnapshotQualification(),
    prebrowserQualification: unavailablePrebrowserQualification(),
    journeyOutcomes: notRunJourneyOutcomeLedger(),
    mutationGuard: {
      version: "music-e2e-mutation-guard/v1", state: "clear", reason: "none", stage: "preflight",
    },
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
  if (role === "fixture-authority") return `${JSON.stringify(SAFE_FIXTURE_AUTHORITY_GATE, null, 2)}\n`;
  if (role === "journey-outcomes") return `${JSON.stringify(notRunJourneyOutcomeLedger(), null, 2)}\n`;
  if (role === "mutation-guard") return `${JSON.stringify({
    version: "music-e2e-mutation-guard/v1", state: "clear", reason: "none", stage: "preflight",
  })}\n`;
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
  options: { skippedId?: string; resultStatus?: string; statusById?: Readonly<Record<string, string>> } = {},
) {
  const statusFor = (entry: { id: string }) => options.statusById?.[entry.id] ?? options.resultStatus;
  const spec = (entry: { id: string; title: string; source: string }) => {
    const status = statusFor(entry);
    const skipped = entry.id === options.skippedId || status === "skipped";
    return {
      title: entry.title,
      file: entry.source.replace(/^e2e\//, ""),
      tags: [LIVE_MUTATION_TAG],
      tests: [{
        annotations: skipped ? [{ type: "skip", description: "Bearer should-not-survive" }] : [],
        expectedStatus: "passed",
        results: status ? [{ status }] : [],
        status: status ?? "skipped",
      }],
    };
  };
  const fixture = entries.filter(({ source }) => source.endsWith("music-fixture-fullstack.spec.ts"));
  const music = entries.filter(({ source }) => source.endsWith("music-public-contract.spec.ts"));
  const profile = entries.filter(({ source }) => source.endsWith("profile-theme.spec.ts"));
  const reviewedSources = new Set(["e2e/music-fixture-fullstack.spec.ts", "e2e/music-public-contract.spec.ts", "e2e/profile-theme.spec.ts"]);
  const unknownSources = entries.filter(({ source }) => !reviewedSources.has(source));
  const musicReadOnly = EXPECTED_LIVE_READ_ONLY.filter(({ source }) => source.endsWith("music-public-contract.spec.ts"));
  const profileReadOnly = EXPECTED_LIVE_READ_ONLY.filter(({ source }) => source.endsWith("profile-theme.spec.ts"));
  const readOnlySpec = (entry: { id: string; title: string; source: string }) => {
    const status = statusFor(entry);
    return {
      title: entry.title,
      file: entry.source.replace(/^e2e\//, ""),
      tags: [LIVE_READ_ONLY_TAG],
      tests: [{
        annotations: status === "skipped" ? [{ type: "skip", description: "Bearer should-not-survive" }] : [],
        expectedStatus: "passed",
        results: status ? [{ status }] : [],
      }],
    };
  };
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
    'import { createHash } from "node:crypto";',
    'const authority = process.argv.includes("music:fixture:authority:attest");',
    'const scenario = process.env.FAKE_LIFECYCLE_SCENARIO;',
    'if (authority) {',
    '  appendFileSync(process.env.FAKE_LIFECYCLE_LOG, "authority\\n");',
    '  if (scenario === "authority-credential") {',
    '    process.stdout.write(JSON.stringify({ schemaVersion: "music-fixture-authority-attestation/v1", state: "tombstone", safeToBootstrap: true, usableRecords: 0, password: process.env.FAKE_PRIVATE_VALUE }) + "\\n");',
    '    process.stderr.write(`path=/private/${process.env.FAKE_PRIVATE_VALUE}/authority.log\\n`);',
    '  } else {',
    '    process.stdout.write(JSON.stringify({ schemaVersion: "music-fixture-authority-attestation/v1", state: "tombstone", safeToBootstrap: true, usableRecords: 0 }) + "\\n");',
    '  }',
    '  process.exit(0);',
    '}',
    'const action = ["bootstrap", "up", "down"].find((candidate) => process.argv.includes(candidate));',
    'const fixtureToken = process.env.MUSIC_E2E_STRAPI_TOKEN;',
    'appendFileSync(process.env.FAKE_LIFECYCLE_LOG, `${action}\n`);',
    'process.stdout.write(`workspace=${process.cwd()} Bearer ${process.env.FAKE_PRIVATE_VALUE} fixture_token=${fixtureToken}\n${"bounded-child-output".repeat(600)}`);',
    'process.stderr.write(`credential=${process.env.FAKE_PRIVATE_VALUE} fixture_token=${fixtureToken} path=/private/fixture/lifecycle.log\n`);',
    'if (action === "bootstrap") {',
    '  writeFileSync(process.env.FAKE_FIXTURE_TOKEN_MARKER, fixtureToken);',
    '  if (scenario === "bootstrap-partial") writeFileSync(process.env.FAKE_RESOURCE_MARKER, "partial");',
    '  if (scenario.startsWith("bootstrap-")) process.exit(1);',
    '}',
    'if (action === "up") {',
    '  if (scenario === "up-partial") { writeFileSync(process.env.FAKE_RESOURCE_MARKER, "partial"); process.exit(1); }',
    '}',
    'if (action === "down") {',
    '  writeFileSync(process.env.FAKE_FIXTURE_TOKEN_DIGEST, createHash("sha256").update(fixtureToken).digest("hex"));',
    '  if (existsSync(process.env.FAKE_FIXTURE_TOKEN_MARKER)) rmSync(process.env.FAKE_FIXTURE_TOKEN_MARKER);',
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
    'if (process.env.FAKE_LIFECYCLE_SCENARIO === "state-service-exit" && String(process.argv[1]).endsWith("music-public-e2e.mjs")) {',
    '  const { EventEmitter } = require("node:events");',
    '  const net = require("node:net");',
    '  const { syncBuiltinESMExports } = require("node:module");',
    '  net.createConnection = (_options, connected) => { const socket = new EventEmitter(); socket.setTimeout = () => socket; socket.destroy = () => undefined; queueMicrotask(connected); return socket; };',
    '  syncBuiltinESMExports();',
    '  global.fetch = async (input) => { await new Promise((resolve) => setTimeout(resolve, 25)); const url = String(input); return { ok: true, status: 200, async json() { if (url.includes("/api/accounts/")) return { data: { documentId: process.env.MUSIC_E2E_ACCOUNT_DOCUMENT_ID } }; if (url.endsWith("/api/users/me")) return { username: process.env.MUSIC_E2E_ACCOUNT_USERNAME, documentId: process.env.MUSIC_E2E_USER_DOCUMENT_ID, accounts: [{ documentId: process.env.MUSIC_E2E_ACCOUNT_DOCUMENT_ID }] }; return { database: { dumpHash: "b".repeat(64) } }; } }; };',
    '}',
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
  const cleanEnvironment = withoutPublicLiveAuthority(process.env);
  return {
    ...cleanEnvironment,
    PATH: `${binDirectory}${delimiter}${process.env.PATH ?? ""}`,
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --require=${fakeDockerHookPath}`.trim(),
    npm_execpath: fakeNpmPath,
    FAKE_LIFECYCLE_SCENARIO: scenario,
    FAKE_DOCKER_MODE: dockerMode,
    FAKE_LIFECYCLE_LOG: join(sandbox, `${runId}-lifecycle.log`),
    FAKE_RESOURCE_MARKER: join(sandbox, `${runId}-resource.marker`),
    FAKE_FIXTURE_TOKEN_MARKER: join(sandbox, `${runId}-fixture-token.private`),
    FAKE_FIXTURE_TOKEN_DIGEST: join(sandbox, `${runId}-fixture-token.sha256`),
    FAKE_PRIVATE_VALUE: privateValue,
  };
}

function withoutPublicLiveAuthority(environment: NodeJS.ProcessEnv) {
  const cleanEnvironment = { ...environment };
  for (const key of Object.keys(cleanEnvironment)) {
    const upper = key.toUpperCase();
    if (upper.startsWith("MUSIC_E2E_") || upper.startsWith("MUSIC_DEPLOY_")
        || upper.startsWith("MUSIC_DATABASE_") || upper.startsWith("MUSIC_DB_")
        || upper.startsWith("MUSIC_C10_STANDALONE_POSTGRES_") || upper.startsWith("MUSIC_UAT_DATABASE_")
        || upper.startsWith("LIVE_STRAPI_") || [
          "COMPOSE_PROJECT_NAME", "DATABASE_URL", "DATABASE_URL_TEST", "DOCKER_CONTEXT", "DOCKER_HOST",
          "E2E_PROFILE_LIVE_WRITES", "E2E_PROFILE_STORAGE_STATE", "E2E_PROFILE_USERNAME", "GATE_PROD",
          "MUSIC_API_BASE_URL", "MUSIC_MODE", "MUSIC_PUBLIC_RUN_ID", "MUSIC_STRAPI_HOST_PORT",
          "PLAYWRIGHT_EXTERNAL_BASE_URL", "PLAYWRIGHT_PR_SAFE", "STRAPI_ACCESS_TOKEN",
          "STRAPI_ANALYTICS_ACCESS_TOKEN", "STRAPI_URL", "VITE_API_URL", "VITE_BASE_URL",
          "VITE_LOCAL_TUNES_API_URL", "VITE_PUBLIC_ACCESS_TOKEN", "VITE_REST_API_URL",
        ].includes(upper)) delete cleanEnvironment[key];
  }
  return cleanEnvironment;
}

function onlyQualificationRunDirectory(sandbox: string) {
  const parent = join(sandbox, ".artifacts", "music-public");
  const entries = readdirSync(parent, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  if (entries.length !== 1) throw new Error(`expected one fresh qualification directory, received ${entries.length}`);
  return join(parent, entries[0]!.name);
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
  expect(failedRecords).toEqual([expect.objectContaining({
    id: "music.owner.queue-add",
    status: "failed",
    reason: "body-failed",
    stage: "body",
    cleanup: "restored",
    beforeHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    afterHash: expect.stringMatching(/^[a-f0-9]{64}$/),
  })]);

  const verificationRecords: unknown[] = [];
  let verificationSnapshots = 0;
  await expect(withRestoredMusicFixture({
    journeyId: "music.owner.queue-add",
    snapshot: async () => {
      if (verificationSnapshots++ === 0) return { publication: { mode: "private" } };
      throw new Error("verification read failed");
    },
    cleanupNamespace: async () => undefined,
    restore: async () => undefined,
    writeRecoveryArtifact: async () => undefined,
    writeJourneyResult: async (record) => { verificationRecords.push(record); },
  }, async () => undefined)).rejects.toThrow("verification read failed");
  expect(verificationRecords).toEqual([expect.objectContaining({
    id: "music.owner.queue-add", status: "failed", reason: "restore-failed", stage: "restore",
  })]);
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
    profile: {
      accountDocumentId: "e2e-public-music-evidence-account", publicMusic: true,
      profileRevision: 4, profileHash: "b".repeat(64), fieldCount: 24,
    },
    database: { namespace: "e2e-public-music-evidence", dumpHash: "a".repeat(64), identityRows: 1 },
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

test("profile live batches delegate one fixed terminal and every failure path to the canonical restorer", () => {
  const profileSource = readFileSync("e2e/profile-theme.spec.ts", "utf8");
  const setupSource = readFileSync("e2e/setup/music.ts", "utf8");
  expect(profileSource).toContain("withRestoredMusicFixture");
  expect(profileSource).toContain("journeyRows: liveRows");
  expect(profileSource).toContain("onBodyFailureAfterRestore: blockProfileMutationsAfterBatchFailure");
  expect(profileSource).not.toContain("appendLiveJourneyResult");
  expect(setupSource.indexOf("if (journeyFailure)"))
    .toBeLessThan(setupSource.indexOf("throw journeyFailure"));
  expect(setupSource).toContain("if (terminalWritten) throw new Error");
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
  const terminalEvidencePath = join(syntheticRoot, "restore-evidence.jsonl");
  const outcomeLedgerPath = join(syntheticRoot, "journey-outcomes.json");
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
    writeFileSync(terminalEvidencePath, `${validJourneyEvidenceRecords().map((record) => JSON.stringify(record)).join("\n")}\n`);

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
      terminalEvidencePath,
      outcomeLedgerPath,
    });
    expect(outcome.status).toBe(0);
    expect(outcome).toMatchObject({ reportStatus: "accepted", privateArtifactCleanup: "deleted" });
    expect(existsSync(reportPath)).toBe(false);
    expect(existsSync(outputDirectory)).toBe(false);
    expect(existsSync(outcomeLedgerPath)).toBe(true);
    expect(JSON.stringify(outcome).length).toBeLessThan(48 * 1024);
    expect(validateLiveJourneyEvidence({
      executionReport: outcome.executionReport,
      records: validJourneyEvidenceRecords(),
    })).toMatchObject({ ok: true });
  } finally {
    rmSync(syntheticRoot, { recursive: true, force: true });
  }
});

test("live journey child is fail-fast with retries disabled without masking final cleanup", async () => {
  const module = await import("../scripts/music-public-live-preflight.mjs") as unknown as Record<string, unknown>;
  const execute = module.runPlaywrightJourneyExecution as (input: Record<string, unknown>) => { status: number };
  const root = resolve(".artifacts", "journey-fail-fast-contract");
  const calls: string[][] = [];
  execute({
    spawn: (_file: string, args: string[]) => { calls.push(args); return { status: 1 }; },
    processExecPath: process.execPath,
    playwrightCli: "playwright-cli",
    files: ["e2e/music-public-contract.spec.ts"],
    project: "chromium-music-live",
    cwd: process.cwd(),
    environment: {},
    reportPath: join(root, "playwright-journey-results.json"),
    outputDirectory: join(root, "private-playwright-output"),
    terminalEvidencePath: join(root, "restore-evidence.jsonl"),
    outcomeLedgerPath: join(root, "journey-outcomes.json"),
    privateArtifactIo: { exists: () => false },
    persistOutcomeLedger: () => ({ status: "persisted" }),
  });
  expect(calls).toHaveLength(1);
  expect(calls[0]).toContain("--max-failures=1");
  expect(calls[0]).toContain("--retries=0");
});

test("runner separates orchestration authority from worker authority and binds final recovery to the run", () => {
  const source = readFileSync("scripts/music-public-e2e.mjs", "utf8");
  expect(source).toContain("MUSIC_E2E_ORCHESTRATION_STATE_TOKEN");
  expect(source).toContain('"mutation-guard.json"');
  expect(source).toContain('"mutation-recovery.private.jsonl"');
  expect(source).toContain('`${stateServiceUrl}/restore-final`');
  expect(source).toContain("orchestrationStateToken");
  expect(source).not.toContain('`${stateServiceUrl}/restore`, { method: "POST", headers: { Authorization: `Bearer ${stateToken}`');
});

test("immutable qualification evidence manifests the strict durable mutation guard", () => {
  expect(LIVE_QUALIFICATION_REQUIRED_ARTIFACTS).toContainEqual({
    role: "mutation-guard", path: "mutation-guard.json",
  });
});

test("sanitized journey outcome ledger retains exact 32/12/5 execution and all mutation terminal identities", async () => {
  const module = await import("../scripts/music-public-live-preflight.mjs") as unknown as Record<string, unknown>;
  const buildLedger = module.buildSanitizedJourneyOutcomeLedger;
  const validateLedger = module.validateSanitizedJourneyOutcomeLedger;
  expect(typeof buildLedger, "the stable safe outcome ledger builder must exist").toBe("function");
  expect(typeof validateLedger, "the safe outcome ledger validator must exist").toBe("function");
  if (typeof buildLedger !== "function" || typeof validateLedger !== "function") return;

  const expectedExecution = [...EXPECTED_LIVE_JOURNEYS, ...EXPECTED_LIVE_READ_ONLY];
  const statusById = Object.fromEntries(expectedExecution.map(({ id }, index) => [
    id,
    index < 32 ? "passed" : (index < 44 ? "failed" : "skipped"),
  ]));
  const terminalRecords = EXPECTED_LIVE_JOURNEYS.map(({ id }, index) => ({
    id,
    status: index < 12 ? "passed" : "failed",
    reason: "Bearer hostile-terminal-reason-must-not-survive",
    stage: "C:\\private\\hostile-terminal-stage",
  }));
  const ledger = (buildLedger as (input: Record<string, unknown>) => Record<string, unknown>)({
    executionReport: playwrightJourneyReport(EXPECTED_LIVE_JOURNEYS, { statusById }),
    reportStatus: "accepted",
    terminalRecords,
  }) as {
    schemaVersion: string;
    integrity: string;
    counts: Record<string, Record<string, number>>;
    executionOutcomes: Array<Record<string, unknown>>;
    mutationTerminals: Array<Record<string, unknown>>;
  };

  expect(ledger).toMatchObject({
    schemaVersion: "explorers-public-journey-outcomes/v1",
    integrity: "accepted",
    counts: {
      execution: { total: 49, passed: 32, failed: 12, skipped: 5, notRun: 0 },
      terminal: { total: 17, passed: 12, failed: 5, missing: 0, invalid: 0, notRun: 0 },
    },
  });
  expect(ledger.executionOutcomes.map(({ id }) => id)).toEqual(expectedExecution.map(({ id }) => id));
  expect(ledger.mutationTerminals.map(({ id }) => id)).toEqual(EXPECTED_LIVE_JOURNEYS.map(({ id }) => id));
  expect(ledger.executionOutcomes.every((entry) => Object.keys(entry).sort().join(",") === "id,reason,stage,status")).toBe(true);
  expect(ledger.mutationTerminals.every((entry) => Object.keys(entry).sort().join(",") === "id,reason,stage,status")).toBe(true);
  expect(ledger.mutationTerminals.slice(12)).toEqual(EXPECTED_LIVE_JOURNEYS.slice(12).map(({ id }) => ({
    id,
    status: "failed",
    reason: "terminal-failed",
    stage: "terminal-evidence",
  })));
  const retained = JSON.stringify(ledger);
  expect(retained).not.toContain("hostile-terminal-reason");
  expect(retained).not.toContain("private");
  expect(retained).not.toMatch(/"(?:title|source|file|path|trace|screenshot|stdout|storage|auth)"\s*:/i);
  const hostileTuple = structuredClone(ledger);
  hostileTuple.executionOutcomes[0] = {
    id: EXPECTED_LIVE_JOURNEYS[0].id,
    status: "passed",
    reason: "report-missing",
    stage: "preflight",
  };
  expect((validateLedger as (value: unknown) => boolean)(hostileTuple)).toBe(false);
});

test("terminal reconciliation records skipped and unstarted mutations without inventing passes", async () => {
  const module = await import("../scripts/music-public-live-preflight.mjs") as unknown as Record<string, unknown>;
  const buildLedger = module.buildSanitizedJourneyOutcomeLedger as (input: Record<string, unknown>) => {
    integrity: string; mutationTerminals: Array<Record<string, unknown>>;
  };
  const skippedId = EXPECTED_LIVE_JOURNEYS[0]!.id;
  const ledger = buildLedger({
    executionReport: playwrightJourneyReport(EXPECTED_LIVE_JOURNEYS, {
      resultStatus: "passed", statusById: { [skippedId]: "skipped" },
    }),
    reportStatus: "accepted",
    terminalRecords: [],
    terminalStatus: "accepted",
  });
  expect(ledger.integrity).toBe("incomplete");
  expect(ledger.mutationTerminals[0]).toEqual({
    id: skippedId, status: "skipped", reason: "test-skipped", stage: "execution",
  });
  expect(ledger.mutationTerminals.slice(1).every((record) => record.status === "missing")).toBe(true);
  expect(ledger.mutationTerminals.some((record) => record.status === "passed")).toBe(false);

  const notRun = buildLedger({ reportStatus: "not-run", terminalStatus: "not-run" });
  expect(notRun.mutationTerminals.every((record) => (
    record.status === "not-run" && record.reason === "terminal-not-run" && record.stage === "preflight"
  ))).toBe(true);
});

test("missing malformed and hostile journey reports retain only fixed safe diagnostics", async () => {
  const module = await import("../scripts/music-public-live-preflight.mjs") as unknown as Record<string, unknown>;
  const buildLedger = module.buildSanitizedJourneyOutcomeLedger;
  expect(typeof buildLedger, "the stable safe outcome ledger builder must exist").toBe("function");
  if (typeof buildLedger !== "function") return;

  const hostilePath = "C:\\private\\playwright\\Bearer hostile-report-secret.json";
  const cases = [
    { reportStatus: "missing", executionReport: undefined, reason: "report-missing" },
    { reportStatus: "parse-failed", executionReport: undefined, reason: "report-malformed" },
    { reportStatus: "too-large", executionReport: undefined, reason: "report-too-large" },
    {
      reportStatus: "accepted",
      executionReport: {
        suites: [{ specs: [{
          title: `Bearer hostile-report-secret ${hostilePath}`,
          file: hostilePath,
          tags: [LIVE_MUTATION_TAG],
          tests: [{ results: [{ status: "failed" }] }],
        }] }],
      },
      reason: "report-invalid",
    },
  ];
  for (const fixture of cases) {
    const ledger = (buildLedger as (input: Record<string, unknown>) => {
      integrity: string;
      executionOutcomes: Array<Record<string, unknown>>;
      mutationTerminals: Array<Record<string, unknown>>;
    })({ ...fixture, terminalRecords: undefined });
    expect(ledger.integrity).toBe("invalid");
    expect(ledger.executionOutcomes).toHaveLength(49);
    expect(ledger.executionOutcomes.every((entry) => entry.status === "failed" && entry.reason === fixture.reason)).toBe(true);
    expect(ledger.mutationTerminals).toHaveLength(17);
    expect(ledger.mutationTerminals.every((entry) => entry.status === "missing" && entry.reason === "terminal-missing")).toBe(true);
    const retained = JSON.stringify(ledger);
    expect(retained).not.toContain("hostile-report-secret");
    expect(retained).not.toContain(hostilePath);
    expect(retained.replaceAll("\\", "/")).not.toContain(hostilePath.replaceAll("\\", "/"));
  }
  const malformedTerminal = (buildLedger as (input: Record<string, unknown>) => {
    integrity: string;
    mutationTerminals: Array<Record<string, unknown>>;
  })({ reportStatus: "not-run", terminalStatus: "parse-failed", terminalRecords: undefined });
  expect(malformedTerminal.integrity).toBe("invalid");
  expect(malformedTerminal.mutationTerminals.every((entry) => (
    entry.status === "invalid" && entry.reason === "terminal-invalid" && entry.stage === "terminal-evidence"
  ))).toBe(true);
});

test("journey outcome ledger is persisted before private deletion and persistence failure still cleans fail-closed", async () => {
  const module = await import("../scripts/music-public-live-preflight.mjs") as unknown as Record<string, unknown>;
  const execute = module.runPlaywrightJourneyExecution;
  expect(typeof execute).toBe("function");
  if (typeof execute !== "function") return;

  for (const persistence of ["succeeds", "fails"] as const) {
    const runDirectory = resolve(`guarded/run-ledger-${persistence}`);
    const reportPath = join(runDirectory, "playwright-journey-results.json");
    const outputDirectory = join(runDirectory, "private-playwright-output");
    const terminalEvidencePath = join(runDirectory, "restore-evidence.jsonl");
    const outcomeLedgerPath = join(runDirectory, "journey-outcomes.json");
    const calls: string[] = [];
    const report = JSON.stringify(playwrightJourneyReport(EXPECTED_LIVE_JOURNEYS, { resultStatus: "failed" }));
    const terminals = validJourneyEvidenceRecords().map((record) => JSON.stringify(record)).join("\n");
    const outcome = (execute as (input: Record<string, unknown>) => Record<string, unknown>)({
      spawn: () => ({ status: 1 }),
      processExecPath: process.execPath,
      playwrightCli: "playwright-cli.js",
      files: ["e2e/profile-theme.spec.ts"],
      project: "synthetic-private-report",
      cwd: process.cwd(),
      environment: { ...process.env },
      reportPath,
      outputDirectory,
      terminalEvidencePath,
      outcomeLedgerPath,
      persistOutcomeLedger: ({ path: exactPath, ledger }: { path: string; ledger: unknown }) => {
        calls.push(`persist:${exactPath}`);
        expect(JSON.stringify(ledger)).not.toMatch(/(?:Bearer|beforeHash|afterHash|rows|title|source|path)/);
        if (persistence === "fails") throw new Error("Bearer persistence-secret");
      },
      privateArtifactIo: {
        exists: (path: string) => { calls.push(`exists:${path}`); return path !== outcomeLedgerPath; },
        size: (path: string) => { calls.push(`size:${path}`); return Buffer.byteLength(path === reportPath ? report : terminals); },
        read: (path: string) => { calls.push(`read:${path}`); return path === reportPath ? report : terminals; },
        unlink: (path: string) => { calls.push(`unlink:${path}`); },
        removeDirectory: (path: string) => { calls.push(`remove-directory:${path}`); },
      },
    });
    expect(calls.indexOf(`persist:${outcomeLedgerPath}`)).toBeGreaterThan(calls.indexOf(`read:${terminalEvidencePath}`));
    expect(calls.indexOf(`persist:${outcomeLedgerPath}`)).toBeLessThan(calls.indexOf(`unlink:${reportPath}`));
    expect(calls).toContain(`remove-directory:${outputDirectory}`);
    expect(outcome).toMatchObject({
      status: expect.any(Number),
      outcomeLedgerStatus: persistence === "succeeds" ? "persisted" : "persist-failed",
      privateArtifactCleanup: "deleted",
    });
    expect(outcome.status).not.toBe(0);
    expect(Object.hasOwn(outcome, "journeyOutcomeLedger")).toBe(persistence === "succeeds");
    expect(JSON.stringify(outcome)).not.toContain("persistence-secret");
  }
});

test("journey evidence validation accumulates execution and terminal defects while final restore remains independent", async () => {
  const executionReport = playwrightJourneyReport(EXPECTED_LIVE_JOURNEYS, { resultStatus: "failed" });
  const incompleteRecords = validJourneyEvidenceRecords().slice(0, 12);
  expect(validateLiveJourneyEvidence({ executionReport, records: incompleteRecords })).toMatchObject({
    ok: false,
    subcheck: "execution-status",
    subchecks: ["execution-status", "records-missing"],
  });

  const finalHash = "d".repeat(64);
  const orchestrationInput = {
    snapshotExists: true,
    baseReport: { version: MUSIC_PUBLIC_FIXTURE_VERSION, runId: "multi-defect-retention", lane: "live" },
    artifacts: {
      directory: "guarded/multi-defect-retention",
      authPath: "owner-auth.json",
      storagePath: "profile-storage-state.json",
      mkdir: () => undefined,
      write: () => undefined,
      chmod: () => undefined,
    },
    restoreEvidence: {
      path: "restore-evidence.jsonl",
      exists: () => true,
      read: () => incompleteRecords.map((record) => JSON.stringify(record)).join("\n"),
    },
    execute: async () => ({
      status: 1,
      reportStatus: "accepted",
      privateArtifactCleanup: "deleted",
      executionReport,
    }),
    teardown: {
      artifactPaths: [],
      artifactDirectories: [],
      exists: () => false,
      unlink: () => undefined,
      removeDirectory: () => undefined,
      stopStateService: () => undefined,
      down: () => 0,
    },
    writeReport: async () => undefined,
    writeStdout: () => undefined,
    writeStderr: () => undefined,
  };
  const outcome = await runMusicFixtureOrchestration({
    ...orchestrationInput,
    restore: async () => ({ ok: true, cleanup: "restored", beforeHash: finalHash, afterHash: finalHash }),
  });
  expect(outcome).toMatchObject({
    exitCode: 5,
    report: {
      result: "failed",
      cleanup: "evidence-missing",
      finalRestore: { beforeHash: finalHash, afterHash: finalHash },
      journeyDiagnostics: { subchecks: ["execution-status", "records-missing"] },
    },
  });

  const restoreFailure = await runMusicFixtureOrchestration({
    ...orchestrationInput,
    baseReport: { ...orchestrationInput.baseReport, runId: "multi-defect-restore-failure" },
    restore: async () => ({ ok: false, cleanup: "restore-failed" }),
  });
  expect(restoreFailure).toMatchObject({
    exitCode: 5,
    report: {
      result: "failed",
      cleanup: "restore-failed",
      journeyDiagnostics: { subchecks: ["execution-status", "records-missing"] },
    },
  });
  expect(restoreFailure.report.finalRestore).toBeUndefined();
});

test("failing production child retains only bounded canonical evidence and deletes every private Playwright artifact", async () => {
  const artifactRoot = resolve(".artifacts");
  mkdirSync(artifactRoot, { recursive: true });
  const syntheticRoot = mkdtempSync(join(artifactRoot, "hostile-journey-report-contract-"));
  const reportPath = join(syntheticRoot, "playwright-journey-results.json");
  const outputDirectory = join(syntheticRoot, "private-playwright-output");
  const terminalEvidencePath = join(syntheticRoot, "restore-evidence.jsonl");
  const outcomeLedgerPath = join(syntheticRoot, "journey-outcomes.json");
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
    writeFileSync(terminalEvidencePath, `${validJourneyEvidenceRecords().map((record) => JSON.stringify(record)).join("\n")}\n`);

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
      `  terminalEvidencePath: ${JSON.stringify(terminalEvidencePath)},`,
      `  outcomeLedgerPath: ${JSON.stringify(outcomeLedgerPath)},`,
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
  const terminalEvidencePath = resolve("guarded/run-hostile-identity/restore-evidence.jsonl");
  const outcomeLedgerPath = resolve("guarded/run-hostile-identity/journey-outcomes.json");
  const terminalRecords = validJourneyEvidenceRecords().map((record) => JSON.stringify(record)).join("\n");
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
    terminalEvidencePath,
    outcomeLedgerPath,
    persistOutcomeLedger: ({ path }: { path: string }) => { calls.push(`persist:${path}`); },
    privateArtifactIo: {
      exists: (path: string) => { calls.push(`exists:${path}`); return path !== outcomeLedgerPath; },
      size: (path: string) => { calls.push(`size:${path}`); return path === reportPath ? 4096 : Buffer.byteLength(terminalRecords); },
      read: (path: string) => { calls.push(`read:${path}`); return path === reportPath
        ? JSON.stringify(playwrightJourneyReport(entries, { resultStatus: "passed" }))
        : terminalRecords; },
      unlink: (path: string) => { calls.push(`unlink:${path}`); },
      removeDirectory: (path: string) => { calls.push(`remove-directory:${path}`); },
    },
  });
  expect(outcome).toMatchObject({ status: expect.any(Number), reportStatus: "accepted", privateArtifactCleanup: "deleted" });
  expect(outcome.status).not.toBe(0);
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
    `exists:${terminalEvidencePath}`,
    `size:${terminalEvidencePath}`,
    `read:${terminalEvidencePath}`,
    `persist:${outcomeLedgerPath}`,
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
    const terminalEvidencePath = resolve(`guarded/run-${failure}/restore-evidence.jsonl`);
    const outcomeLedgerPath = resolve(`guarded/run-${failure}/journey-outcomes.json`);
    const terminalRecords = validJourneyEvidenceRecords().map((record) => JSON.stringify(record)).join("\n");
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
      terminalEvidencePath,
      outcomeLedgerPath,
      persistOutcomeLedger: ({ path }: { path: string }) => { calls.push(`persist:${path}`); },
      privateArtifactIo: {
        exists: (path: string) => { calls.push(`exists:${path}`); return path !== outcomeLedgerPath; },
        size: (path: string) => { calls.push(`size:${path}`); return path === reportPath
          ? (failure === "too-large" ? 64 * 1024 * 1024 : 12)
          : Buffer.byteLength(terminalRecords); },
        read: (path: string) => {
          calls.push(`read:${path}`);
          if (path === reportPath) { reads += 1; return "{not-json"; }
          return terminalRecords;
        },
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
      `exists:${terminalEvidencePath}`,
      `size:${terminalEvidencePath}`,
      `read:${terminalEvidencePath}`,
      `persist:${outcomeLedgerPath}`,
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
  const terminalEvidencePath = resolve("guarded/run-delete-failure/restore-evidence.jsonl");
  const outcomeLedgerPath = resolve("guarded/run-delete-failure/journey-outcomes.json");
  const terminalRecords = validJourneyEvidenceRecords().map((record) => JSON.stringify(record)).join("\n");
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
    terminalEvidencePath,
    outcomeLedgerPath,
    persistOutcomeLedger: ({ path }: { path: string }) => { helperCalls.push(`persist:${path}`); },
    privateArtifactIo: {
      exists: (path: string) => { helperCalls.push(`exists:${path}`); return true; },
      size: (path: string) => { helperCalls.push(`size:${path}`); return path === reportPath ? 1024 : Buffer.byteLength(terminalRecords); },
      read: (path: string) => { helperCalls.push(`read:${path}`); return path === reportPath
        ? JSON.stringify(playwrightJourneyReport(EXPECTED_LIVE_JOURNEYS, { resultStatus: "passed" }))
        : terminalRecords; },
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
    `exists:${terminalEvidencePath}`,
    `size:${terminalEvidencePath}`,
    `read:${terminalEvidencePath}`,
    `persist:${outcomeLedgerPath}`,
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
    expect(JSON.parse(verify.stdout)).toMatchObject({ files: 17, manifestSha256: expect.stringMatching(/^[a-f0-9]{64}$/) });
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

test("qualification run allocation refuses a reused run ID before any fixture action", async () => {
  // Production break caught: a repeated run ID reopens the same directory and
  // can replace evidence that a reviewer already treated as immutable.
  const sandbox = mkdtempSync(join(tmpdir(), "music-public-exclusive-run-"));
  try {
    const { createExclusiveQualificationRunDirectory } = await import("../scripts/music-public-qualification-artifacts.mjs");
    const artifactParent = join(sandbox, ".artifacts", "music-public");
    const first = createExclusiveQualificationRunDirectory({ artifactParent, runId: "exclusive-contract-run" });
    expect(first).toBe(join(artifactParent, "exclusive-contract-run"));
    expect(() => createExclusiveQualificationRunDirectory({ artifactParent, runId: "exclusive-contract-run" }))
      .toThrow(/exist/i);
    expect(readdirSync(artifactParent)).toEqual(["exclusive-contract-run"]);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

test("fresh live runner rejects hostile fixture authority before bootstrap without attempting lifecycle teardown", () => {
  // The operator has separately proved the reset removed the reviewed volumes
  // and freed all five ports. A failed final authority gate is therefore a
  // pre-bootstrap refusal: no fixture command, service, or down is authorized.
  const sandbox = mkdtempSync(join(tmpdir(), "music-public-authority-gate-contract-"));
  try {
    const runId = "authority-gate-rejection-contract";
    const { fakeNpmPath, fakeDockerHookPath, binDirectory } = writeLifecycleContractShims(sandbox);
    const privateValue = "authority-gate-private-value";
    const environment = lifecycleFreshProcessEnvironment({
      sandbox,
      runId,
      fakeNpmPath,
      fakeDockerHookPath,
      binDirectory,
      scenario: "authority-credential",
      dockerMode: "clean",
      privateValue,
    });
    const result = spawnSync(process.execPath, [
      resolve("scripts/music-public-e2e.mjs"), "live", ...EXACT_PUBLIC_LIVE_AUTHORITY_ARGS,
    ], {
      cwd: sandbox,
      env: environment,
      encoding: "utf8",
      windowsHide: true,
    });
    const runDirectory = onlyQualificationRunDirectory(sandbox);
    const evidence = JSON.parse(readFileSync(join(runDirectory, "evidence.json"), "utf8"));
    const retainedAuthority = JSON.parse(readFileSync(join(runDirectory, "fixture-authority.json"), "utf8"));

    expect(result.status, `${result.stdout}\n${result.stderr}\n${JSON.stringify(evidence)}`).toBe(4);
    expect(readFileSync(environment.FAKE_LIFECYCLE_LOG, "utf8").trim().split(/\r?\n/)).toEqual(["authority"]);
    expect(existsSync(environment.FAKE_RESOURCE_MARKER)).toBe(false);
    expect(evidence).toMatchObject({
      stage: "fixture-authority-gate-failed",
      result: "failed",
      cleanup: "not-required-safe",
      exitCode: 4,
      lifecycleCommands: [],
    });
    expect(retainedAuthority).toEqual({
      schemaVersion: "explorers-public-fixture-authority/v1",
      status: "rejected",
      command: ["npm", "run", "--silent", "music:fixture:authority:attest"],
      cwd: "<repository>",
      exitCode: 0,
      termination: "exited",
      attestation: null,
    });
    expect(`${result.stdout}\n${result.stderr}\n${JSON.stringify(evidence)}\n${JSON.stringify(retainedAuthority)}`)
      .not.toContain(privateValue);
    expect(`${result.stdout}\n${result.stderr}\n${JSON.stringify(evidence)}\n${JSON.stringify(retainedAuthority)}`)
      .not.toContain("/private/");
    expect(evidence.streams.every(({ status }: { status: string }) => status === "unavailable")).toBe(true);

    const verified = spawnSync(process.execPath, [
      resolve("scripts/music-public-qualification-artifacts.mjs"), "verify", runDirectory,
    ], { cwd: sandbox, encoding: "utf8", windowsHide: true });
    expect(verified.status, `${verified.stdout}\n${verified.stderr}`).toBe(0);
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
      const result = spawnSync(process.execPath, [
        resolve("scripts/music-public-e2e.mjs"), "live", ...EXACT_PUBLIC_LIVE_AUTHORITY_ARGS,
      ], {
        cwd: sandbox,
        env: environment,
        encoding: "utf8",
        windowsHide: true,
      });
      const runDirectory = onlyQualificationRunDirectory(sandbox);
      expect(existsSync(join(runDirectory, "evidence.json")), `${result.stdout}\n${result.stderr}`).toBe(true);
      const evidence = JSON.parse(readFileSync(join(runDirectory, "evidence.json"), "utf8"));
      const dockerInspection = JSON.parse(readFileSync(join(runDirectory, "docker-inspection.json"), "utf8"));
      expect(result.status, `${result.stdout}\n${result.stderr}\n${JSON.stringify({ evidence, dockerInspection })}`)
        .toBe(lifecycleCase.expectedExit);
      expect(`${result.stdout}\n${result.stderr}`).not.toContain(privateValue);
      expect(`${result.stdout}\n${result.stderr}`).not.toContain(sandbox);
      expect(readFileSync(environment.FAKE_LIFECYCLE_LOG, "utf8").trim().split(/\r?\n/))
        .toEqual(["authority", ...lifecycleCase.expectedStages.map((stage) => stage.replace("fixture-", ""))]);
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

test("generated fixture token stays off argv and retained output and is retired on failure", () => {
  // Production break caught: generating the fixture token inside the runner is
  // safe only if hostile child output is sanitized and exact down retires the
  // simulated protected authority even when bootstrap fails.
  const sandbox = mkdtempSync(join(tmpdir(), "music-public-generated-token-"));
  try {
    const runLabel = "generated-token-contract";
    const { fakeNpmPath, fakeDockerHookPath, binDirectory } = writeLifecycleContractShims(sandbox);
    const environment = lifecycleFreshProcessEnvironment({
      sandbox,
      runId: runLabel,
      fakeNpmPath,
      fakeDockerHookPath,
      binDirectory,
      scenario: "bootstrap-partial",
      dockerMode: "clean",
      privateValue: "separate-hostile-child-value",
    });
    const result = spawnSync(process.execPath, [
      resolve("scripts/music-public-e2e.mjs"), "live", ...EXACT_PUBLIC_LIVE_AUTHORITY_ARGS,
    ], { cwd: sandbox, env: environment, encoding: "utf8", windowsHide: true });
    const runDirectory = onlyQualificationRunDirectory(sandbox);
    const retainedFiles: string[] = [];
    const visit = (directory: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const target = join(directory, entry.name);
        if (entry.isDirectory()) visit(target);
        else retainedFiles.push(readFileSync(target, "utf8"));
      }
    };
    visit(runDirectory);
    const retainedText = `${result.stdout}\n${result.stderr}\n${retainedFiles.join("\n")}`;
    const evidence = JSON.parse(readFileSync(join(runDirectory, "evidence.json"), "utf8"));
    const digest = readFileSync(environment.FAKE_FIXTURE_TOKEN_DIGEST, "utf8");
    const tokenLikeValues = retainedText.match(/[A-Za-z0-9_-]{32,128}/g) ?? [];
    const argvValues = JSON.stringify(EXACT_PUBLIC_LIVE_AUTHORITY_ARGS).match(/[A-Za-z0-9_-]{32,128}/g) ?? [];

    expect(result.status, retainedText).toBe(4);
    expect(evidence.command).toEqual(["node", "scripts/music-public-e2e.mjs", "live", ...EXACT_PUBLIC_LIVE_AUTHORITY_ARGS]);
    expect(readFileSync(environment.FAKE_LIFECYCLE_LOG, "utf8").trim().split(/\r?\n/))
      .toEqual(["authority", "bootstrap", "down"]);
    expect(existsSync(environment.FAKE_FIXTURE_TOKEN_MARKER)).toBe(false);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenLikeValues.some((value) => createHash("sha256").update(value).digest("hex") === digest)).toBe(false);
    expect(argvValues.some((value) => createHash("sha256").update(value).digest("hex") === digest)).toBe(false);
    expect(retainedText).toContain("<redacted>");
    expect(retainedText).not.toContain("separate-hostile-child-value");
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

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
    const result = spawnSync(process.execPath, [
      resolve("scripts/music-public-e2e.mjs"), "live", ...EXACT_PUBLIC_LIVE_AUTHORITY_ARGS,
    ], {
      cwd: sandbox,
      env: environment,
      encoding: "utf8",
      windowsHide: true,
      timeout: 10_000,
    });
    const runDirectory = onlyQualificationRunDirectory(sandbox);
    const evidence = JSON.parse(readFileSync(join(runDirectory, "evidence.json"), "utf8"));
    const lifecycleActions = readFileSync(environment.FAKE_LIFECYCLE_LOG, "utf8").trim().split(/\r?\n/);

    expect(result.status, `${result.stdout}\n${result.stderr}\n${JSON.stringify(evidence)}`).toBe(5);
    expect(lifecycleActions).toEqual(["authority", "bootstrap", "up", "down"]);
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
      files: 17,
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
    expect(JSON.parse(verified.stdout)).toMatchObject({ files: 19 });
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
    name: "a hard-linked retained mutation guard",
    expected: "qualification mutation guard evidence contract is invalid",
    mutate: (runDirectory) => linkSync(
      join(runDirectory, "mutation-guard.json"),
      join(dirname(runDirectory), "mutation-guard-alias.json"),
    ),
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
  {
    name: "a rehashed reference-state fixture authority record",
    expected: "fixture authority evidence contract is invalid",
    mutate: (runDirectory) => {
      const value = {
        ...SAFE_FIXTURE_AUTHORITY_GATE,
        attestation: { ...SAFE_FIXTURE_AUTHORITY_GATE.attestation, state: "reference" },
      };
      const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
      writeFileSync(join(runDirectory, "fixture-authority.json"), bytes);
      rewriteQualificationManifest(runDirectory, (manifest) => {
        const artifact = manifest.artifacts.find(({ role }) => role === "fixture-authority")!;
        artifact.bytes = bytes.length;
        artifact.sha256 = createHash("sha256").update(bytes).digest("hex");
      });
    },
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

test("fixture authority gate invokes the exact fixed-root command and accepts only the strict safe attestation schema", async () => {
  // Production break caught: the live runner bootstraps immediately after the
  // operator reset, without a typed post-reset fixture-authority attestation.
  const qualificationArtifacts = await import("../scripts/music-public-qualification-artifacts.mjs");
  const calls: Array<{ command: string; args: string[]; options: Record<string, unknown> }> = [];
  const stdout = `${JSON.stringify({
    schemaVersion: "music-fixture-authority-attestation/v1",
    state: "absent",
    safeToBootstrap: true,
    usableRecords: 0,
  })}\n`;
  const captured = qualificationArtifacts.captureQualificationFixtureAuthority({
    processExecPath: "node-runtime",
    npmExecPath: "npm-cli",
    cwd: process.cwd(),
    retainedCwd: "<repository>",
    environment: { FIXTURE_TEST: "1" },
    spawn: (command: string, args: string[], options: Record<string, unknown>) => {
      calls.push({ command, args, options });
      return { status: 0, signal: null, stdout, stderr: "" };
    },
  });

  expect(captured).toEqual({
    status: 0,
    record: {
      schemaVersion: "explorers-public-fixture-authority/v1",
      status: "accepted",
      command: ["npm", "run", "--silent", "music:fixture:authority:attest"],
      cwd: "<repository>",
      exitCode: 0,
      termination: "exited",
      attestation: {
        schemaVersion: "music-fixture-authority-attestation/v1",
        state: "absent",
        safeToBootstrap: true,
        usableRecords: 0,
      },
    },
  });
  expect(calls).toEqual([{
    command: "node-runtime",
    args: ["npm-cli", "run", "--silent", "music:fixture:authority:attest"],
    options: {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { FIXTURE_TEST: "1" },
      maxBuffer: 8 * 1024,
      windowsHide: true,
    },
  }]);
});

test("fixture authority gate rejects and redacts hostile credential-bearing malformed or ambiguous output", async () => {
  const qualificationArtifacts = await import("../scripts/music-public-qualification-artifacts.mjs");
  const privateValue = "authority-private-value-must-not-survive";
  const hostileOutputs = [
    `${JSON.stringify({
      schemaVersion: "music-fixture-authority-attestation/v1",
      state: "tombstone",
      safeToBootstrap: true,
      usableRecords: 0,
      password: privateValue,
    })}\n`,
    `${JSON.stringify({
      schemaVersion: "music-fixture-authority-attestation/v1",
      state: "reference",
      safeToBootstrap: true,
      usableRecords: 0,
    })}\n`,
    "not-json\n",
    `${JSON.stringify({
      schemaVersion: "music-fixture-authority-attestation/v1",
      state: "tombstone",
      safeToBootstrap: true,
      usableRecords: 0,
    })}\n${JSON.stringify({ path: `/private/${privateValue}` })}\n`,
  ];

  for (const stdout of hostileOutputs) {
    const captured = qualificationArtifacts.captureQualificationFixtureAuthority({
      processExecPath: "node-runtime",
      npmExecPath: "npm-cli",
      cwd: process.cwd(),
      retainedCwd: "<repository>",
      environment: { FIXTURE_TEST: "1" },
      spawn: () => ({
        status: 0,
        signal: null,
        stdout,
        stderr: `credential=${privateValue} path=/private/${privateValue}/authority.log`,
      }),
    });
    expect(captured).toEqual({
      status: 1,
      record: {
        schemaVersion: "explorers-public-fixture-authority/v1",
        status: "rejected",
        command: ["npm", "run", "--silent", "music:fixture:authority:attest"],
        cwd: "<repository>",
        exitCode: 0,
        termination: "exited",
        attestation: null,
      },
    });
    expect(JSON.stringify(captured)).not.toContain(privateValue);
    expect(JSON.stringify(captured)).not.toContain("/private/");
  }
});

test("fixture authority gate blocks nonzero signal and spawn-error terminal states without raw diagnostics", async () => {
  const qualificationArtifacts = await import("../scripts/music-public-qualification-artifacts.mjs");
  const privateValue = "terminal-authority-private-value";
  const cases = [
    { name: "nonzero", result: { status: 5, signal: null, stdout: privateValue, stderr: privateValue }, exitCode: 5, termination: "exited" },
    { name: "signal", result: { status: null, signal: "SIGTERM", stdout: privateValue, stderr: privateValue }, exitCode: null, termination: "signaled" },
    { name: "spawn-error", result: undefined, exitCode: null, termination: "spawn-error" },
  ] as const;

  for (const contract of cases) {
    const captured = qualificationArtifacts.captureQualificationFixtureAuthority({
      processExecPath: "node-runtime",
      npmExecPath: "npm-cli",
      cwd: process.cwd(),
      retainedCwd: "<repository>",
      environment: { FIXTURE_TEST: "1" },
      spawn: () => {
        if (contract.result === undefined) throw new Error(privateValue);
        return contract.result;
      },
    });
    expect(captured).toEqual({
      status: 1,
      record: {
        schemaVersion: "explorers-public-fixture-authority/v1",
        status: "rejected",
        command: ["npm", "run", "--silent", "music:fixture:authority:attest"],
        cwd: "<repository>",
        exitCode: contract.exitCode,
        termination: contract.termination,
        attestation: null,
      },
    });
    expect(JSON.stringify(captured), contract.name).not.toContain(privateValue);
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

test("fixture-down deletes volumes only for the exact reviewed fixture project", async () => {
  const qualificationArtifacts = await import("../scripts/music-public-qualification-artifacts.mjs");
  const calls: Array<{ command: string; args: string[] }> = [];
  const captured = qualificationArtifacts.captureQualificationLifecycleCommand({
    stage: "fixture-down",
    processExecPath: "node-runtime",
    npmExecPath: "npm-cli",
    cwd: process.cwd(),
    retainedCwd: "<repository>",
    environment: { FIXTURE_TEST: "1" },
    workspaceRoot: process.cwd(),
    spawn: (command: string, args: string[]) => {
      calls.push({ command, args });
      return { status: 0, signal: null, stdout: "", stderr: "" };
    },
  });
  const expected = [
    "npm", "run", "--silent", "music-cli", "--", "down",
    "--volumes", "--mode", "fixture", "--confirm-project", "explorers-music-fixture",
  ];
  expect(captured.record.command).toEqual(expected);
  expect(calls).toEqual([{
    command: "node-runtime",
    args: ["npm-cli", ...expected.slice(1)],
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
      initialSnapshotQualification: unavailableInitialSnapshotQualification(),
      prebrowserQualification: unavailablePrebrowserQualification(),
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
      fixtureAuthority: SAFE_FIXTURE_AUTHORITY_GATE,
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
      journeyOutcomeLedger: notRunJourneyOutcomeLedger(),
      evidence,
    });

    expect(finalized).toMatchObject({ files: 17, verified: true });
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
      fixtureAuthority: SAFE_FIXTURE_AUTHORITY_GATE,
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
      journeyOutcomeLedger: notRunJourneyOutcomeLedger(),
      evidence: {
        version: MUSIC_PUBLIC_FIXTURE_VERSION,
        runId,
        lane: "live",
        result: "failed",
        cleanup: "restored",
        commit: "c".repeat(40),
        command: "npm run music:test:public-e2e",
        cwd: "explorers-earth",
        initialSnapshotQualification: unavailableInitialSnapshotQualification(),
        prebrowserQualification: unavailablePrebrowserQualification(),
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
    expect(finalized).toEqual({ files: 17, manifestSha256: expect.stringMatching(/^[a-f0-9]{64}$/), verified: true });
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
    expect(JSON.parse(readFileSync(join(runDirectory, "journey-outcomes.json"), "utf8")))
      .toEqual(input.journeyOutcomeLedger);
    expect(JSON.parse(readFileSync(join(runDirectory, "evidence.json"), "utf8")).journeyOutcomes)
      .toEqual(input.journeyOutcomeLedger);
    expect(readFileSync(join(runDirectory, "evidence.json"), "utf8").toString())
      .not.toContain("finalization-private-token");
    expect(existsSync(join(runDirectory, "restore-evidence.jsonl"))).toBe(false);
    const verify = spawnSync(process.execPath, [
      resolve("scripts/music-public-qualification-artifacts.mjs"), "verify", runDirectory,
    ], { cwd: process.cwd(), encoding: "utf8", windowsHide: true });
    expect(verify.status, `${verify.stdout}\n${verify.stderr}`).toBe(0);
    expect(JSON.parse(verify.stdout)).toMatchObject({ files: 17, manifestSha256: finalized!.manifestSha256 });

    const persistedRunId = "persisted-failure-ledger-run";
    const persistedRunDirectory = join(sandbox, ".artifacts", "music-public", persistedRunId);
    mkdirSync(persistedRunDirectory);
    const expectedExecution = [...EXPECTED_LIVE_JOURNEYS, ...EXPECTED_LIVE_READ_ONLY];
    const statusById = Object.fromEntries(expectedExecution.map(({ id }, index) => [
      id,
      index < 32 ? "passed" : (index < 44 ? "failed" : "skipped"),
    ]));
    const livePreflight = await import("../scripts/music-public-live-preflight.mjs");
    const persistedLedger = livePreflight.buildSanitizedJourneyOutcomeLedger({
      executionReport: playwrightJourneyReport(EXPECTED_LIVE_JOURNEYS, { statusById }),
      reportStatus: "accepted",
      terminalRecords: EXPECTED_LIVE_JOURNEYS.map(({ id }, index) => ({ id, status: index < 12 ? "passed" : "failed" })),
      terminalStatus: "accepted",
    });
    livePreflight.persistSanitizedJourneyOutcomeLedger({
      path: join(persistedRunDirectory, "journey-outcomes.json"),
      ledger: persistedLedger,
    });
    expect(() => qualificationArtifacts.finalizeQualificationRunArtifacts({
      ...input,
      runDirectory: persistedRunDirectory,
      journeyOutcomeLedger: persistedLedger,
      journeyOutcomeLedgerPersisted: true,
      evidence: { ...input.evidence, runId: persistedRunId },
    })).toThrow("qualification structured artifact contract is invalid");
    const persistedFinalized = qualificationArtifacts.finalizeQualificationRunArtifacts({
      ...input,
      runDirectory: persistedRunDirectory,
      journeyOutcomeLedger: persistedLedger,
      journeyOutcomeLedgerPersisted: true,
      skipLedger: {
        schemaVersion: "explorers-public-skip-ledger/v1",
        lane: "live",
        execution: "completed",
        totals: { total: 49, passed: 32, failed: 12, skipped: 5 },
        reasons: [{ scope: "journey", reason: "test-skipped" }],
      },
      evidence: { ...input.evidence, runId: persistedRunId },
    });
    expect(persistedFinalized).toMatchObject({ files: 17, verified: true });
    expect(JSON.parse(readFileSync(join(persistedRunDirectory, "evidence.json"), "utf8")).journeyOutcomes)
      .toEqual(persistedLedger);
    expect(JSON.parse(readFileSync(join(persistedRunDirectory, "manifest.json"), "utf8")).artifacts)
      .toEqual(expect.arrayContaining([expect.objectContaining({ role: "journey-outcomes", path: "journey-outcomes.json" })]));

    const unsafeRunDirectory = join(sandbox, ".artifacts", "music-public", "unsafe-finalization-run");
    mkdirSync(unsafeRunDirectory);
    expect(() => qualificationArtifacts.finalizeQualificationRunArtifacts({
      ...input,
      runDirectory: unsafeRunDirectory,
      evidence: { ...input.evidence, observedPath: "/private/build/output.log" },
    })).toThrow("qualification structured artifact is invalid");
    expect(existsSync(join(unsafeRunDirectory, "logs", "fixture-bootstrap.stdout.log"))).toBe(false);
    expect(existsSync(join(unsafeRunDirectory, "analytics-events.jsonl"))).toBe(false);

    const missingPersistedRunDirectory = join(sandbox, ".artifacts", "music-public", "missing-persisted-ledger-run");
    mkdirSync(missingPersistedRunDirectory);
    expect(() => qualificationArtifacts.finalizeQualificationRunArtifacts({
      ...input,
      runDirectory: missingPersistedRunDirectory,
      journeyOutcomeLedgerPersisted: true,
    })).toThrow("qualification journey outcome ledger is missing or unreadable");
    expect(existsSync(join(missingPersistedRunDirectory, "manifest.json"))).toBe(false);
    expect(existsSync(join(missingPersistedRunDirectory, "manifest.sha256"))).toBe(false);
    expect(existsSync(join(missingPersistedRunDirectory, "journey-outcomes.json"))).toBe(false);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

test("explicit live authority rejects malformed argv before any random authority is generated", async () => {
  // Production break caught: the public runner previously accepted no argv at
  // all and tried to reconstruct mutation authority from ambient variables.
  const modulePath = "../scripts/music-public-live-authority.mjs";
  const authorityModule = await import(modulePath).catch(() => null) as null | {
    buildMusicPublicLiveAuthority(input: {
      args: readonly string[];
      environment: Record<string, string | undefined>;
      randomBytes: (size: number) => Buffer;
    }): unknown;
  };
  expect(authorityModule, "the side-effect-free live authority builder must exist").not.toBeNull();
  if (!authorityModule) return;

  let randomCalls = 0;
  const invoke = (args: readonly string[]) => authorityModule.buildMusicPublicLiveAuthority({
    args,
    environment: {},
    randomBytes: (size) => { randomCalls += 1; return Buffer.alloc(size, 0x11); },
  });
  const wrongValue = [...EXACT_PUBLIC_LIVE_AUTHORITY_ARGS];
  wrongValue[1] = "not-the-reviewed-acknowledgement";
  const duplicate = [...EXACT_PUBLIC_LIVE_AUTHORITY_ARGS, "--ack", EXACT_PUBLIC_LIVE_AUTHORITY_ARGS[1]];
  const extra = [...EXACT_PUBLIC_LIVE_AUTHORITY_ARGS, "--dry-run"];
  const reordered = [...EXACT_PUBLIC_LIVE_AUTHORITY_ARGS];
  [reordered[0], reordered[2]] = [reordered[2], reordered[0]];

  for (const invalid of [[], EXACT_PUBLIC_LIVE_AUTHORITY_ARGS.slice(0, -2), wrongValue, duplicate, extra, reordered]) {
    expect(() => invoke(invalid)).toThrow(/refused/i);
  }
  expect(randomCalls).toBe(0);
});

test("explicit live authority rejects every ambient target or credential override before randomness", async () => {
  // Production break caught: a correct-looking local argv could still inherit a
  // database, production, URL, token, or identity target from the shell.
  const modulePath = "../scripts/music-public-live-authority.mjs";
  const authorityModule = await import(modulePath).catch(() => null) as null | {
    buildMusicPublicLiveAuthority(input: {
      args: readonly string[];
      environment: Record<string, string | undefined>;
      randomBytes: (size: number) => Buffer;
    }): unknown;
  };
  expect(authorityModule, "the side-effect-free live authority builder must exist").not.toBeNull();
  if (!authorityModule) return;

  let randomCalls = 0;
  for (const hostileEnvironment of [
    { MUSIC_E2E_STRAPI_TOKEN: "hostile-token" },
    { music_e2e_account_username: "hostile-owner" },
    { MUSIC_PUBLIC_RUN_ID: "caller-selected-run" },
    { PLAYWRIGHT_EXTERNAL_BASE_URL: "https://explorers.earth" },
    { MUSIC_API_BASE_URL: "https://localtunes.earth" },
    { MUSIC_STRAPI_HOST_PORT: "1337" },
    { LIVE_STRAPI_URL: "https://cms.example" },
    { LIVE_STRAPI_READ_ONLY_CREDENTIAL: "hostile-credential" },
    { STRAPI_URL: "https://cms.example" },
    { STRAPI_ACCESS_TOKEN: "hostile-access-token" },
    { DATABASE_URL: "postgresql://production.example/music" },
    { DATABASE_URL_TEST: "postgresql://127.0.0.1:5432/shared" },
    { DOCKER_HOST: "tcp://production.example:2375" },
    { GATE_PROD: "1" },
    { MUSIC_DEPLOY_PRODUCTION: "1" },
  ]) {
    expect(() => authorityModule.buildMusicPublicLiveAuthority({
      args: EXACT_PUBLIC_LIVE_AUTHORITY_ARGS,
      environment: hostileEnvironment,
      randomBytes: (size) => { randomCalls += 1; return Buffer.alloc(size, 0x22); },
    })).toThrow(/refused/i);
  }
  expect(randomCalls).toBe(0);
});

test("explicit live authority derives one distinct namespaced tuple and fixed five-service topology", async () => {
  // Production break caught: the old shell recipe let ports, URLs, identities,
  // and the fixture token drift independently across one supposedly owned run.
  const modulePath = "../scripts/music-public-live-authority.mjs";
  const authorityModule = await import(modulePath).catch(() => null) as null | {
    buildMusicPublicLiveAuthority(input: {
      args: readonly string[];
      environment: Record<string, string | undefined>;
      randomBytes: (size: number) => Buffer;
    }): {
      runId: string;
      namespace: string;
      username: string;
      accountDocumentId: string;
      userDocumentId: string;
      fixtureToken: string;
      project: string;
      externalUrl: string;
      strapiUrl: string;
      serviceOrigins: string[];
      healthUrls: string[];
      environment: Record<string, string>;
    };
  };
  expect(authorityModule, "the side-effect-free live authority builder must exist").not.toBeNull();
  if (!authorityModule) return;

  const fills = [0x11, 0x22, 0x33, 0x44];
  const generated = [0, 1].map(() => authorityModule.buildMusicPublicLiveAuthority({
    args: EXACT_PUBLIC_LIVE_AUTHORITY_ARGS,
    environment: {},
    randomBytes: (size) => Buffer.alloc(size, fills.shift()),
  }));
  const first = generated[0];
  expect(first.runId).toBe("11".repeat(16));
  expect(first.namespace).toBe(`e2e-public-music-${first.runId}`);
  expect(new Set([first.namespace, first.username, first.accountDocumentId, first.userDocumentId]).size).toBe(4);
  expect(first).toMatchObject({
    project: "explorers-music-fixture",
    username: `${first.namespace}-owner`,
    accountDocumentId: `${first.namespace}-account`,
    userDocumentId: `${first.namespace}-user`,
    externalUrl: "http://localhost:55173",
    strapiUrl: "http://127.0.0.1:51337",
    serviceOrigins: [
      "tcp://127.0.0.1:55432",
      "http://127.0.0.1:51337",
      "http://127.0.0.1:55000",
      "http://localhost:55173",
      "http://127.0.0.1:55174",
    ],
    healthUrls: [
      "tcp://127.0.0.1:55432",
      "http://127.0.0.1:51337/health",
      "http://127.0.0.1:55000/api/music-fixture/readiness",
      "http://localhost:55173/health",
      "http://127.0.0.1:55174/health",
    ],
  });
  expect(first.environment).toMatchObject({
    MUSIC_PUBLIC_RUN_ID: first.runId,
    PLAYWRIGHT_EXTERNAL_BASE_URL: first.externalUrl,
    PLAYWRIGHT_PR_SAFE: "false",
    MUSIC_STRAPI_HOST_PORT: "51337",
    MUSIC_E2E_ACCOUNT_USERNAME: first.username,
    MUSIC_E2E_ACCOUNT_DOCUMENT_ID: first.accountDocumentId,
    MUSIC_E2E_USER_DOCUMENT_ID: first.userDocumentId,
    MUSIC_E2E_STRAPI_URL: first.strapiUrl,
    MUSIC_E2E_STRAPI_TOKEN: first.fixtureToken,
  });
  expect(first.fixtureToken).toBe(Buffer.alloc(32, 0x22).toString("base64url"));
  expect(generated[1].runId).not.toBe(first.runId);
  expect(generated[1].fixtureToken).not.toBe(first.fixtureToken);
  expect(JSON.stringify(EXACT_PUBLIC_LIVE_AUTHORITY_ARGS)).not.toContain(first.fixtureToken);
});

test("naked or ambient-hostile live invocation refuses before artifacts and fixture lifecycle", () => {
  // Production break caught: the documented naked command failed only after
  // trying to source a hand-built ambient tuple, while a hostile shell could
  // influence generated authority before the lifecycle gate.
  const sandbox = mkdtempSync(join(tmpdir(), "music-public-invocation-refusal-"));
  try {
    const lifecycleLog = join(sandbox, "lifecycle.log");
    const fakeNpmPath = join(sandbox, "fake-npm.cjs");
    writeFileSync(fakeNpmPath, [
      'require("node:fs").appendFileSync(process.env.FAKE_LIFECYCLE_LOG, `${process.argv.slice(2).join(" ")}\n`);',
      "process.exit(1);",
      "",
    ].join("\n"));
    const cleanEnvironment = withoutPublicLiveAuthority(process.env);
    const invoke = (args: readonly string[], hostileEnvironment: Record<string, string> = {}) => spawnSync(
      process.execPath,
      [resolve("scripts/music-public-e2e.mjs"), "live", ...args],
      {
        cwd: sandbox,
        encoding: "utf8",
        windowsHide: true,
        env: {
          ...cleanEnvironment,
          npm_execpath: fakeNpmPath,
          FAKE_LIFECYCLE_LOG: lifecycleLog,
          ...hostileEnvironment,
        },
      },
    );

    const naked = invoke([]);
    const hostile = invoke(EXACT_PUBLIC_LIVE_AUTHORITY_ARGS, { MUSIC_E2E_STRAPI_TOKEN: "hostile-ambient-token" });
    for (const result of [naked, hostile]) {
      expect(result.status).toBe(3);
      expect(result.stdout).toBe("");
      expect(result.stderr).toMatch(/^Live public Music E2E refused:/);
      expect(`${result.stdout}\n${result.stderr}`).not.toContain("hostile-ambient-token");
    }
    expect(existsSync(lifecycleLog)).toBe(false);
    expect(existsSync(join(sandbox, ".artifacts"))).toBe(false);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

test("the documented root public E2E command is the hard-gated live orchestration path", () => {
  const rootPackage = JSON.parse(readFileSync("../package.json", "utf8")) as { scripts: Record<string, string> };
  const clientPackage = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
  const testingGuide = readFileSync("../docs/testing.md", "utf8");
  const exactRunbookCommand = `npm run music:test:public-e2e -- ${EXACT_PUBLIC_LIVE_AUTHORITY_ARGS.join(" ")}`;
  expect(rootPackage.scripts["music:fixture:authority:attest"])
    .toBe("tsx tunes/scripts/music-fixture-authority-attest.ts");
  expect(rootPackage.scripts["music:test:public-e2e"]).toBe("npm --prefix explorers-earth run music:test:public-e2e --");
  expect(clientPackage.scripts["music:test:public-e2e"]).toBe("node scripts/music-public-e2e.mjs live");
  expect(clientPackage.scripts["music:test:public-fast"]).toContain("music-public-e2e.mjs fast");
  expect(clientPackage.scripts["music:test:public-pr"]).toContain("music-public-e2e.mjs pr");
  expect(clientPackage.scripts["music:fixture:public:verify"]).toContain("music-public-e2e.mjs verify");
  expect(testingGuide).toContain(exactRunbookCommand);
  expect(testingGuide).not.toMatch(/\$env:MUSIC_E2E_/);
  expect(testingGuide).not.toContain("<account-scoped local fixture token>");

  const sandbox = mkdtempSync(join(tmpdir(), "music-public-package-command-"));
  try {
    const preloader = join(sandbox, "capture-runner.cjs");
    const capturePath = join(sandbox, "runner.json");
    writeFileSync(preloader, [
      'const { basename } = require("node:path");',
      'if (basename(String(process.argv[1])) === "music-public-e2e.mjs") {',
      '  require("node:fs").writeFileSync(process.env.FAKE_RUNNER_CAPTURE, JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd() }));',
      '  process.exit(0);',
      '}',
      '',
    ].join("\n"));
    const npmExecPath = process.env.npm_execpath
      ?? join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
    expect(existsSync(npmExecPath)).toBe(true);
    const result = spawnSync(process.execPath, [
      npmExecPath, "run", "--silent", "music:test:public-e2e", "--", ...EXACT_PUBLIC_LIVE_AUTHORITY_ARGS,
    ], {
      cwd: resolve(".."),
      encoding: "utf8",
      windowsHide: true,
      timeout: 10_000,
      env: {
        ...withoutPublicLiveAuthority(process.env),
        NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --require=${preloader}`.trim(),
        FAKE_RUNNER_CAPTURE: capturePath,
      },
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(JSON.parse(readFileSync(capturePath, "utf8"))).toEqual({
      argv: ["live", ...EXACT_PUBLIC_LIVE_AUTHORITY_ARGS],
      cwd: resolve(),
    });
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }

  const runner = readFileSync("scripts/music-public-e2e.mjs", "utf8");
  expect(runner).toContain("process.env.npm_execpath");
  expect(runner).not.toContain('process.platform === "win32" ? "npm.cmd"');
  expect(runner).toContain("inspectQualificationDockerCleanup");
  expect(runner).toContain("assessQualificationCleanup");
  expect(runner).toContain("buildQualificationOutcomeRecords");
  expect(runner).toContain("finalizeQualificationRunArtifacts");
  expect(runner.indexOf("captureQualificationFixtureAuthority({"))
    .toBeLessThan(runner.indexOf("fixtureLifecycleAttempted = true"));
  expect(runner.indexOf("captureQualificationFixtureAuthority({"))
    .toBeLessThan(runner.indexOf('runLifecycleCommand("fixture-bootstrap")'));
  expect(runner).toMatch(/artifactPaths:\s*\[[^\]]*restoreEvidencePath[^\]]*authStatePath[^\]]*profileStorageStatePath[^\]]*\]/s);
  expect(runner).toContain("journeyOutcomeCleanupRequired = journeyExecutionOutcome.outcomeLedgerStatus === \"persist-failed\"");
  expect(runner).toContain("[journeyOutcomeLedgerPath, `${journeyOutcomeLedgerPath}.private-tmp`]");
  expect(runner.indexOf("const journeyExecutionOutcome = runPlaywrightJourneyExecution({"))
    .toBeLessThan(runner.indexOf("journeyOutcomeCleanupRequired = journeyExecutionOutcome.outcomeLedgerStatus"));
  expect(runner).toContain("writeReport: async () => undefined");
  expect(runner).not.toContain("function writeLiveReport");
  expect(runner).toContain('"--reporter=json"');
  expect(runner).toMatch(/privatePlaywrightOutputDirectory[\s\S]+--output=/);
  expect(runner).toMatch(/rmSync\(privatePlaywrightOutputDirectory, \{ recursive: true, force: true \}\)/);
  expect(runner).toMatch(/const result = spawnSync[\s\S]+finalizeCurrentQualification\(\{[\s\S]+stage: "execution-finished"/);
  expect(runner).toMatch(/const finalized = await qualificationCoordinator\.runFinalization[\s\S]+return finalized\.exitCode/);
  expect(runner).toContain("process.exit(await runLiveQualification())");
  const stateService = readFileSync("../tunes/scripts/music-e2e-state-service.mjs", "utf8");
  const stateCapture = readFileSync("../tunes/scripts/music-e2e-state-capture.mjs", "utf8");
  const stateRestore = readFileSync("../tunes/scripts/music-e2e-state-restore.mjs", "utf8");
  expect(runner).toContain("music-e2e-state-service.mjs");
  expect(stateService).toContain('"pg_dump"');
  expect(stateRestore).toContain('"psql"');
  expect(stateService).toContain("MUSIC_E2E_STRAPI_TOKEN");
  expect(stateService).toContain("fixture profile restoration failed");
  expect(stateCapture).toContain("profileHash: profileState.stateHash");
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
  expect(runner.indexOf("google-auth/callback?access_token="))
    .toBeLessThan(runner.indexOf("writeFileSync(authStatePath"));
  expect(runner.indexOf("writeFileSync(authStatePath"))
    .toBeLessThan(runner.indexOf("runPlaywrightJourneyExecution({"));
  expect(runner).toContain('authorization !== `Bearer ${strapiToken}`');
  expect(runner).toMatch(/\^Bearer \[A-Za-z0-9_-\]\+\\\.\[A-Za-z0-9_-\]\+\\\.\[A-Za-z0-9_-\]\+\$/);
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
      'const net = require("node:net");',
      'const { syncBuiltinESMExports } = require("node:module");',
      'const append = (entry) => appendFileSync(process.env.FAKE_PHASE_LOG, `${entry}\n`);',
      'const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough(), exitCode: null, signalCode: null, kill(signal) { this.signalCode = signal; queueMicrotask(() => { this.stdout.end(); this.stderr.end(); this.emit("exit", null, signal); this.emit("close", null, signal); }); return true; } });',
      'childProcess.spawn = () => child;',
      'childProcess.spawnSync = (file, args = []) => {',
      '  const joined = args.join(" ");',
      '  if (joined.includes("music:fixture:authority:attest")) { append("authority"); return { status: 0, stdout: `${JSON.stringify({ schemaVersion: "music-fixture-authority-attestation/v1", state: "tombstone", safeToBootstrap: true, usableRecords: 0 })}\n`, stderr: "", signal: null, error: undefined }; }',
      '  const action = ["bootstrap", "up", "down"].find((candidate) => joined.includes(`music-cli -- ${candidate}`));',
      '  if (action) { append(action); return { status: 0, stdout: "", stderr: "", signal: null, error: undefined }; }',
      '  if (String(file) === "git") return { status: 0, stdout: `${"a".repeat(40)}\n`, stderr: "", signal: null, error: undefined };',
      '  if (String(file).toLowerCase().includes("docker")) return { status: 0, stdout: "", stderr: "", signal: null, error: undefined };',
      '  return { status: 1, stdout: "", stderr: "preflight stopped", signal: null, error: undefined };',
      '};',
      'net.createConnection = (_options, connected) => { const socket = new EventEmitter(); socket.setTimeout = () => socket; socket.destroy = () => undefined; queueMicrotask(connected); return socket; };',
      'syncBuiltinESMExports();',
      'let terminalEmitted = false;',
      'global.fetch = async (input) => {',
      '  const url = String(input);',
      '  if (url.endsWith("/snapshot")) {',
      '    const namespace = process.env.MUSIC_E2E_ACCOUNT_USERNAME.replace(/-owner$/, "");',
      '    const snapshot = { version: "music-live-account-snapshot/v1", snapshotId: "phase-owner-snapshot", publication: { coveredByDatabaseDump: true }, guestControls: { coveredByDatabaseDump: true }, queue: { coveredByDatabaseDump: true }, playlists: { coveredByDatabaseDump: true }, requests: { coveredByDatabaseDump: true }, profile: { accountDocumentId: process.env.MUSIC_E2E_ACCOUNT_DOCUMENT_ID, publicMusic: false, profileRevision: 0, profileHash: "c".repeat(64), fieldCount: 2 }, database: { namespace, dumpHash: "b".repeat(64), identityRows: 0 } };',
      '    return { ok: true, status: 200, headers: { get() { return null; } }, async text() { append("snapshot-complete"); return JSON.stringify(snapshot); } };',
      '  }',
      '  if (url.endsWith("/restore-final")) {',
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
    const result = spawnSync(process.execPath, [
      resolve("scripts/music-public-e2e.mjs"), "live", ...EXACT_PUBLIC_LIVE_AUTHORITY_ARGS,
    ], {
      cwd: sandbox,
      env: environment,
      encoding: "utf8",
      windowsHide: true,
      timeout: 10_000,
    });
    const runDirectory = onlyQualificationRunDirectory(sandbox);
    const phaseEntries = readFileSync(phaseLog, "utf8").trim().split(/\r?\n/);
    const evidence = JSON.parse(readFileSync(join(runDirectory, "evidence.json"), "utf8"));

    expect(result.status, `${result.stdout}\n${result.stderr}\n${JSON.stringify({ phaseEntries, evidence })}`).toBe(1);
    // The qualifier completes its baseline restore; outer recovery still
    // attempts the unconditional final restore after the injected service
    // failure, even though teardown can close that second response.
    expect(phaseEntries.filter((entry) => entry === "restore-start")).toHaveLength(2);
    expect(phaseEntries.filter((entry) => entry === "restore-complete")).toHaveLength(1);
    expect(phaseEntries.filter((entry) => entry === "down")).toHaveLength(1);
    expect(phaseEntries.filter((entry) => entry.startsWith("exit:"))).toEqual(["exit:5"]);
    expect(phaseEntries.indexOf("snapshot-complete")).toBeLessThan(phaseEntries.indexOf("restore-start"));
    expect(phaseEntries.lastIndexOf("restore-complete")).toBeLessThan(phaseEntries.indexOf("down"));
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
    profile: {
      accountDocumentId: "e2e-public-music-run-account", publicMusic: true,
      profileRevision: 4, profileHash: "b".repeat(64), fieldCount: 24,
    },
    database: { namespace: "e2e-public-music-run", dumpHash: "a".repeat(64), identityRows: 1 },
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

test("live public preparation publishes a returned non-literal slug and seeds every guest prerequisite inside canonical scope", async () => {
  const reads: string[] = [];
  const mutations: Array<{ callsite: string; method: string; path: string; data?: unknown; idempotencyKey?: string }> = [];
  let profileUpdates = 0;
  let playlistSong = 80;
  let playback = 1;
  const result = await prepareLivePublicMusicJourney({
    seedId: "a1b2c3d4",
    publicationIdempotencyKey: "tunes-share-v1-1777000000000-11111111-2222-4333-8444-555555555555",
    controls: {
      allowSongRequests: true,
      allowGuestPlayOnDevice: true,
      allowPlaylistSharing: true,
      allowRecentlyPlayedVisibility: true,
      allowQueueVisibility: true,
    },
    read: async (path) => {
      reads.push(path);
      if (path === "/api/music/dashboard") return {
        status: 200,
        body: { queueRevision: 0, playbackRevision: 0, publication: { mode: "private", publicSlug: "private-seed" } },
      };
      return {
        status: 200,
        body: {
          version: "music-public-resource/v1",
          publication: { mode: "public", publicSlug: "actual-public-123" },
          permissions: {
            allowSongRequests: true,
            allowGuestPlayOnDevice: true,
            allowPlaylistSharing: true,
            allowRecentlyPlayedVisibility: true,
            allowQueueVisibility: true,
          },
          queue: { items: [{ title: "Fixture queued song" }] },
          recentlyPlayed: { items: [{ title: "Fixture history song" }] },
          currentlyPlaying: { title: "Fixture playing song" },
          playlists: { items: [{ name: "Fixture public a1b2c3d4" }] },
        },
      };
    },
    updatePublicProfile: async () => {
      profileUpdates += 1;
      return { status: 200, body: { data: { updateAccount: { public_music: "Yes" } } } };
    },
    mutate: async (callsite, request) => {
      mutations.push({ callsite, ...request });
      if (request.path === "/api/playlists") return { status: 201, body: { id: 71 } };
      if (request.path.endsWith("/songs")) return { status: 201, body: { id: ++playlistSong } };
      if (request.path.endsWith("/visibility")) return { status: 204, body: undefined };
      if (request.path === "/api/music/queue/replace") return { status: 200, body: { revision: 1, songs: [] } };
      if (request.path === "/api/playlist/currently-playing") return {
        status: 200, body: { version: "music-playback/v1", revision: ++playback, playbackRevision: playback, song: {} },
      };
      if (request.path === "/api/music/guest-controls") return { status: 200, body: request.data };
      if (request.path === "/api/music/publication") return {
        status: 200,
        body: { version: "music-publication/v1", publication: { mode: "public", publicSlug: "actual-public-123" } },
      };
      throw new Error(`unexpected mutation ${request.path}`);
    },
  });

  expect(result).toMatchObject({
    publicSlug: "actual-public-123",
    playlistId: 71,
    songs: { history: 81, playing: 82, queued: 83 },
  });
  expect(profileUpdates).toBe(1);
  expect(reads).toEqual(["/api/music/dashboard", "/api/music/public-resource/v1/actual-public-123"]);
  expect(mutations.map(({ callsite, path }) => [callsite, path])).toEqual([
    ["playlist-create", "/api/playlists"],
    ["playlist-song-add", "/api/playlists/71/songs"],
    ["playlist-song-add", "/api/playlists/71/songs"],
    ["playlist-song-add", "/api/playlists/71/songs"],
    ["playlist-visibility", "/api/playlists/71/visibility"],
    ["queue-replace", "/api/music/queue/replace"],
    ["player-update", "/api/playlist/currently-playing"],
    ["player-update", "/api/playlist/currently-playing"],
    ["guest-controls", "/api/music/guest-controls"],
    ["owner-publication", "/api/music/publication"],
  ]);
  expect(mutations.filter(({ path }) => path.endsWith("/currently-playing")).map(({ data }) => data)).toEqual([
    { songId: 81, expectedRevision: 1, expectedPlaybackRevision: 0 },
    { songId: 82, expectedRevision: 2, expectedPlaybackRevision: 2 },
  ]);
  expect(mutations.find(({ callsite }) => callsite === "owner-publication")?.idempotencyKey)
    .toBe("tunes-share-v1-1777000000000-11111111-2222-4333-8444-555555555555");
  expect(() => assertLivePublicSlug("qualification-public")).toThrow(/returned public slug/i);
  expect(() => assertLivePublicSlug("short")).toThrow(/returned public slug/i);
});

test("profile batch body failures restore first, emit one row-bearing terminal, and then block subsequent batches", async () => {
  resetMusicRestoreBlockForContractTest();
  const rows = buildProfileCoveringRows().slice(0, 12);
  const events: string[] = [];
  const terminals: any[] = [];
  const state = { profile: { social_media: { theme_settings: { preset: "minimal-light" } } } };
  await expect(withRestoredMusicFixture({
    journeyId: "profile.owner.pairwise.batch-01",
    journeyRows: rows,
    snapshot: async () => { events.push("snapshot"); return structuredClone(state); },
    cleanupNamespace: async () => { events.push("cleanup"); },
    restore: async () => { events.push("restore"); },
    onBodyFailureAfterRestore: async () => { events.push("block"); },
    writeJourneyResult: async (record) => { events.push("terminal"); terminals.push(record); },
  }, async () => {
    events.push("body");
    throw new Error("profile baseline failed");
  })).rejects.toThrow("profile baseline failed");

  expect(events).toEqual(["snapshot", "body", "cleanup", "restore", "snapshot", "block", "terminal"]);
  expect(terminals).toEqual([expect.objectContaining({
    id: "profile.owner.pairwise.batch-01",
    status: "failed",
    reason: "body-failed",
    stage: "body",
    cleanup: "restored",
    rowCount: 12,
    rows,
  })]);
});

test("live Music journeys contain no mock-only slug or post-terminal mutation cleanup", () => {
  const source = readFileSync("e2e/music-public-contract.spec.ts", "utf8");
  const liveSource = source.slice(source.indexOf("const permissionJourneyIds"));
  expect(liveSource).not.toContain("qualification-public");
  expect(liveSource).toContain("prepareOwnerPublicJourney");
  expect(source.slice(0, source.indexOf("const permissionJourneyIds"))).toContain("return prepareLivePublicMusicJourney({");
  const afterEach = source.slice(source.indexOf("test.afterEach"), source.indexOf("const permissionJourneyIds"));
  expect(afterEach).not.toMatch(/guardedMutation|request\.(?:post|patch|delete)/);
});

test("guest-device playback is local-only and leaves the owner queue exact while a second guest stays isolated", () => {
  const source = readFileSync("e2e/music-public-contract.spec.ts", "utf8");
  const journey = source.slice(
    source.indexOf('liveTest("live guest playback'),
    source.indexOf('liveTest("owner publication'),
  );
  expect(journey).toContain("Choose Fixture queued song to play on this device");
  expect(journey).toContain("Play Fixture queued song on this device");
  expect(journey).toContain("expect(afterBody).toEqual(beforeBody)");
  expect(journey).toContain("second guest remains on the canonical owner selection");
  expect(journey).not.toContain("toBeGreaterThan(beforeRevision)");
  expect(journey).not.toContain("guest playback changes canonical player state");
});

test("profile batch baseline and every row execute inside canonical snapshot restoration and terminal ownership", () => {
  const source = readFileSync("e2e/profile-theme.spec.ts", "utf8");
  const liveBatch = source.slice(source.indexOf("test.describe('approved live profile writes'"), source.indexOf("test.describe('Public Profile Theme"));
  expect(liveBatch).toMatch(/withRestoredMusicFixture\([\s\S]+journeyRows:\s*liveRows[\s\S]+async \(\) => \{[\s\S]+const baselineAccount = await openDashboard/);
  expect(liveBatch.indexOf("withRestoredMusicFixture(")).toBeLessThan(liveBatch.indexOf("const baselineAccount = await openDashboard"));
  expect(liveBatch).not.toContain("appendLiveJourneyResult");
  expect(liveBatch).not.toContain("normalExactRestore");
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

test("a fresh worker observes the durable state-service latch before invoking a mutation", async () => {
  resetMusicRestoreBlockForContractTest();
  const previous = {
    write: process.env.MUSIC_E2E_LIVE_WRITE,
    url: process.env.MUSIC_E2E_STATE_SERVICE_URL,
    token: process.env.MUSIC_E2E_STATE_TOKEN,
  };
  const originalFetch = globalThis.fetch;
  let invoked = 0;
  try {
    process.env.MUSIC_E2E_LIVE_WRITE = "true";
    process.env.MUSIC_E2E_STATE_SERVICE_URL = "http://127.0.0.1:55174";
    process.env.MUSIC_E2E_STATE_TOKEN = "A".repeat(43);
    globalThis.fetch = async () => new Response(JSON.stringify({
      status: "ready",
      service: "music-e2e-state",
      mutationGuard: {
        version: "music-e2e-mutation-guard/v1", state: "blocked", reason: "restore-failed", stage: "restore",
      },
    }), { status: 200, headers: { "content-type": "application/json" } });
    await expect(runAuthorizedMusicMutation({
      lane: "live", liveWriteEnabled: true, baseUrl: "http://127.0.0.1:55173",
      serviceOrigins: ["http://127.0.0.1:55000"],
      accountDocumentId: "e2e-public-music-run-account", accountUsername: "e2e-public-music-run-owner",
      fixtureVersion: MUSIC_PUBLIC_FIXTURE_VERSION,
      confirmation: "I_UNDERSTAND_THIS_MUTATES_A_DISPOSABLE_FIXTURE",
    }, "guest-controls", async () => { invoked += 1; })).rejects.toThrow("MUSIC_MUTATION_BLOCKED");
    expect(invoked).toBe(0);
  } finally {
    globalThis.fetch = originalFetch;
    if (previous.write === undefined) delete process.env.MUSIC_E2E_LIVE_WRITE; else process.env.MUSIC_E2E_LIVE_WRITE = previous.write;
    if (previous.url === undefined) delete process.env.MUSIC_E2E_STATE_SERVICE_URL; else process.env.MUSIC_E2E_STATE_SERVICE_URL = previous.url;
    if (previous.token === undefined) delete process.env.MUSIC_E2E_STATE_TOKEN; else process.env.MUSIC_E2E_STATE_TOKEN = previous.token;
    resetMusicRestoreBlockForContractTest();
  }
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

async function loadPrebrowserQualificationContract(): Promise<Record<string, unknown>> {
  try {
    const modulePath: string = "../scripts/music-public-prebrowser-qualification.mjs";
    return await import(modulePath);
  } catch {
    return {};
  }
}

type QualificationSnapshot = {
  version: "music-live-account-snapshot/v1";
  snapshotId: string;
  profile: { accountDocumentId: string; publicMusic: boolean; profileRevision: number; profileHash: string; fieldCount: number };
  database: { namespace: string; dumpHash: string; identityRows: number };
};

function qualificationSnapshot(snapshotId: string, databaseHash: string, profileHash: string, profileRevision: number, identityRows: number): QualificationSnapshot {
  return {
    version: "music-live-account-snapshot/v1",
    snapshotId,
    profile: {
      accountDocumentId: "e2e-public-music-qualification-account",
      publicMusic: false,
      profileRevision,
      profileHash,
      fieldCount: 24,
    },
    database: {
      namespace: "e2e-public-music-qualification",
      dumpHash: databaseHash,
      identityRows,
    },
  };
}

function passingPrebrowserQualificationAdapter(events: string[]) {
  const populated = qualificationSnapshot("populated-snapshot", "b".repeat(64), "c".repeat(64), 3, 1);
  const publicPhase = qualificationSnapshot("public-snapshot", "d".repeat(64), "e".repeat(64), 4, 1);
  let snapshots = 0;
  return {
    ensureEphemeralOwner: async () => { events.push("identity-ensure"); return "header.payload.qualifier-signature"; },
    capture: async () => {
      events.push(`snapshot:${snapshots === 0 ? "populated" : "public"}`);
      return snapshots++ === 0 ? populated : publicPhase;
    },
    verifyRollbackProbe: async () => {
      events.push("rollback-probe");
      return { profileCapability: true, privateAuthority: true, staleRejected: true };
    },
    restore: async (snapshot: QualificationSnapshot) => {
      events.push(`restore:${snapshot.snapshotId}`);
      return {
        restored: true,
        beforeHash: snapshot.database.dumpHash,
        afterHash: snapshot.database.dumpHash,
        profileHash: snapshot.profile.profileHash,
        profileRevision: snapshot.profile.profileRevision,
      };
    },
    verifyPublicProfileAndMusic: async () => {
      events.push("public-profile-category-music");
      return { publicSlug: "actual-fixture-public-slug", categoryQueries: 20, musicPrerequisites: 9 };
    },
    restoreBaseline: async (snapshot: QualificationSnapshot) => {
      events.push("restore:initial-baseline");
      return {
        restored: true,
        beforeHash: snapshot.database.dumpHash,
        afterHash: snapshot.database.dumpHash,
        profileHash: snapshot.profile.profileHash,
        profileRevision: snapshot.profile.profileRevision,
      };
    },
    verifyEphemeralOwnerRetired: async (jwt: string) => {
      events.push("qualifier-jwt-retired");
      return jwt === "header.payload.qualifier-signature";
    },
    readGuard: async () => {
      events.push("guard-clear");
      return { version: "music-e2e-mutation-guard/v1", state: "clear", reason: "none", stage: "preflight" };
    },
  };
}

test("pre-browser qualifier proves populated rollback, public/category/music capability, JWT retirement, and returns only fixed safe metadata", async () => {
  const contract = await loadPrebrowserQualificationContract();
  const run = contract.runMusicPrebrowserQualification as undefined | ((input: {
    initialSnapshot: QualificationSnapshot;
    adapter: ReturnType<typeof passingPrebrowserQualificationAdapter>;
  }) => Promise<{ ok: boolean; record: Record<string, unknown>; qualifierJwtFingerprint?: string }>);
  expect(typeof run).toBe("function");
  if (!run) return;
  const events: string[] = [];
  const initial = qualificationSnapshot("initial-snapshot", "a".repeat(64), "f".repeat(64), 0, 0);
  const result = await run({ initialSnapshot: initial, adapter: passingPrebrowserQualificationAdapter(events) });

  expect(events).toEqual([
    "identity-ensure",
    "snapshot:populated",
    "rollback-probe",
    "restore:populated-snapshot",
    "snapshot:public",
    "public-profile-category-music",
    "restore:public-snapshot",
    "restore:initial-baseline",
    "qualifier-jwt-retired",
    "guard-clear",
  ]);
  expect(result).toMatchObject({
    ok: true,
    qualifierJwtFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    record: {
      schemaVersion: "explorers-public-prebrowser-qualification/v2",
      snapshotFailure: { phase: "none", stage: "none", code: "none" },
      status: "passed",
      code: "none",
      checks: {
        populatedRollback: true,
        profileCapability: true,
        privateAuthority: true,
        staleRejected: true,
        publicProjection: true,
        musicPrerequisites: true,
        baselineRestored: true,
        ephemeralOwnerRetired: true,
        guardClear: true,
      },
      counts: { identityRows: 1, categoryQueries: 20, musicPrerequisites: 9 },
      hashes: {
        populatedDatabase: "b".repeat(64),
        rollbackDatabase: "b".repeat(64),
        populatedProfile: "c".repeat(64),
        rollbackProfile: "c".repeat(64),
        baselineDatabase: "a".repeat(64),
        restoredBaselineDatabase: "a".repeat(64),
        baselineProfile: "f".repeat(64),
        restoredBaselineProfile: "f".repeat(64),
        publicSlug: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
      profileRevisions: { populated: 3, rollback: 3, baseline: 0, restoredBaseline: 0 },
    },
  });
  const retained = JSON.stringify(result.record);
  expect(retained).not.toMatch(/header\.payload|actual-fixture-public-slug|jwt|credential|authorization|token|snapshotId|path/i);
});

test("pre-browser qualifier distinguishes a valid populated snapshot with zero exact identity rows", async () => {
  const contract = await loadPrebrowserQualificationContract();
  const run = contract.runMusicPrebrowserQualification as undefined | ((input: {
    initialSnapshot: QualificationSnapshot;
    adapter: ReturnType<typeof passingPrebrowserQualificationAdapter>;
  }) => Promise<{ ok: boolean; record: Record<string, unknown> }>);
  expect(typeof run).toBe("function");
  if (!run) return;

  const events: string[] = [];
  const adapter = passingPrebrowserQualificationAdapter(events);
  adapter.capture = async () => {
    events.push("snapshot:populated");
    return qualificationSnapshot("populated-zero", "b".repeat(64), "c".repeat(64), 0, 0);
  };
  const result = await run({
    initialSnapshot: qualificationSnapshot("initial-snapshot", "a".repeat(64), "f".repeat(64), 0, 0),
    adapter,
  });

  expect(events).toEqual([
    "identity-ensure", "snapshot:populated", "restore:initial-baseline", "qualifier-jwt-retired", "guard-clear",
  ]);
  expect(result).toMatchObject({
    ok: false,
    record: {
      schemaVersion: "explorers-public-prebrowser-qualification/v2",
      status: "failed",
      code: "populated-identity-cardinality",
      snapshotFailure: { phase: "none", stage: "none", code: "none" },
      counts: { identityRows: 0, categoryQueries: 0, musicPrerequisites: 0 },
    },
  });
});

test("loopback qualifier retains only fixed state-capture stage codes and rejects hostile response detail", async () => {
  const contract = await loadPrebrowserQualificationContract();
  const createAdapter = contract.createLoopbackPrebrowserQualificationAdapter as undefined | ((input: {
    authority: Record<string, unknown>;
    initialSnapshot: QualificationSnapshot;
    fetchImpl: typeof fetch;
  }) => ReturnType<typeof passingPrebrowserQualificationAdapter>);
  const run = contract.runMusicPrebrowserQualification as undefined | ((input: {
    initialSnapshot: QualificationSnapshot;
    adapter: ReturnType<typeof passingPrebrowserQualificationAdapter>;
  }) => Promise<{ ok: boolean; record: Record<string, unknown> }>);
  expect(typeof createAdapter).toBe("function");
  expect(typeof run).toBe("function");
  if (!createAdapter || !run) return;

  const initial = qualificationSnapshot("initial-snapshot", "a".repeat(64), "f".repeat(64), 0, 0);
  const authority = {
    stateOrigin: "http://127.0.0.1:55174",
    tunesOrigin: "http://127.0.0.1:55000",
    explorerOrigin: "http://localhost:55173",
    strapiOrigin: "http://127.0.0.1:51337",
    stateToken: "S".repeat(43), orchestrationToken: "O".repeat(43), fixtureToken: "F".repeat(43),
    namespace: "e2e-public-music-qualification",
    username: "e2e-public-music-qualification-owner",
    accountDocumentId: "e2e-public-music-qualification-account",
    userDocumentId: "e2e-public-music-qualification-user",
  };
  const hostile = "Bearer hostile.capture.value from C:\\Users\\private\\capture.json";
  const cases = [
    {
      status: 500,
      body: {
        schemaVersion: "music-e2e-state-capture-failure/v1",
        state: "failed", stage: "identity-count-query", code: "operation-failed",
      },
      failure: { phase: "populated", stage: "identity-count-query", code: "operation-failed" },
    },
    {
      status: 500,
      body: {
        schemaVersion: "music-e2e-state-capture-failure/v1",
        state: "failed", stage: "identity-count-query", code: "operation-failed", detail: hostile,
      },
      failure: { phase: "populated", stage: "snapshot-store", code: "contract-invalid" },
    },
    {
      status: 503,
      body: { error: hostile },
      failure: { phase: "populated", stage: "snapshot-store", code: "operation-failed" },
    },
  ] as const;

  for (const scenario of cases) {
    const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
      status, headers: { "content-type": "application/json" },
    });
    const fetchImpl: typeof fetch = async (input) => {
      const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
      if (url.pathname === "/api/music/identity/ensure") {
        return json({ identity: { status: "active" }, credential: { token: "header.payload.qualifier-signature" } });
      }
      if (url.pathname === "/snapshot") return json(scenario.body, scenario.status);
      if (url.pathname === "/restore-final") return json({
        restored: true, beforeHash: initial.database.dumpHash, afterHash: initial.database.dumpHash,
        profileHash: initial.profile.profileHash, profileRevision: initial.profile.profileRevision,
      });
      if (url.pathname === "/api/playlists") return json({ error: "retired" }, 401);
      if (url.pathname === "/health") return json({
        status: "ready", service: "music-e2e-state",
        mutationGuard: { version: "music-e2e-mutation-guard/v1", state: "clear", reason: "none", stage: "preflight" },
      });
      throw new Error(hostile);
    };
    const result = await run({ initialSnapshot: initial, adapter: createAdapter({ authority, initialSnapshot: initial, fetchImpl }) });
    expect(result).toMatchObject({
      ok: false,
      record: {
        schemaVersion: "explorers-public-prebrowser-qualification/v2",
        status: "failed",
        code: "populated-snapshot-failed",
        snapshotFailure: scenario.failure,
      },
    });
    expect(JSON.stringify(result.record)).not.toMatch(/hostile|Bearer|C:\\Users|detail|path|token|authorization/i);
  }
});

test("loopback qualifier adapter exercises exact fixture profile, stale, public category, and seeded Music protocols without persisting owner authority", async () => {
  const contract = await loadPrebrowserQualificationContract();
  const createAdapter = contract.createLoopbackPrebrowserQualificationAdapter as undefined | ((input: {
    authority: Record<string, unknown>;
    initialSnapshot: QualificationSnapshot;
    fetchImpl: typeof fetch;
  }) => ReturnType<typeof passingPrebrowserQualificationAdapter>);
  const run = contract.runMusicPrebrowserQualification as undefined | ((input: {
    initialSnapshot: QualificationSnapshot;
    adapter: ReturnType<typeof passingPrebrowserQualificationAdapter>;
  }) => Promise<{ ok: boolean; record: Record<string, unknown> }>);
  expect(typeof createAdapter).toBe("function");
  expect(typeof run).toBe("function");
  if (!createAdapter || !run) return;

  const initial = qualificationSnapshot("initial-snapshot", "a".repeat(64), "f".repeat(64), 0, 0);
  const populated = qualificationSnapshot("populated-snapshot", "b".repeat(64), "c".repeat(64), 3, 1);
  const publicPhase = qualificationSnapshot("public-snapshot", "d".repeat(64), "e".repeat(64), 4, 1);
  const ownerJwt = "qualifier.header.ephemeral-owner";
  const calls: Array<{
    origin: string; path: string; method: string; operation?: string;
    expectedRevision?: string; idempotencyKey?: string;
  }> = [];
  let snapshotCount = 0;
  let playlistId = 40;
  let songId = 100;
  let playbackCalls = 0;
  let baselineRestored = false;
  let directRevisionWrites = 0;
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
    status, headers: { "content-type": "application/json" },
  });
  const fetchImpl: typeof fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    const method = init.method ?? (input instanceof Request ? input.method : "GET");
    const headers = new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined));
    const rawBody = typeof init.body === "string" ? init.body : "";
    const decoded = rawBody ? JSON.parse(rawBody) as Record<string, any> : {};
    const operation = typeof decoded.query === "string"
      ? /(?:query|mutation)\s+([A-Za-z0-9_]+)/.exec(decoded.query)?.[1]
      : undefined;
    calls.push({
      origin: url.origin, path: url.pathname, method, operation,
      expectedRevision: headers.get("x-music-fixture-expected-revision") ?? undefined,
      idempotencyKey: headers.get("idempotency-key") ?? undefined,
    });

    if (url.origin === "http://127.0.0.1:55174" && url.pathname === "/snapshot") {
      return json(snapshotCount++ === 0 ? populated : publicPhase);
    }
    if (url.origin === "http://127.0.0.1:55174" && url.pathname === "/restore") {
      const snapshot = decoded as unknown as QualificationSnapshot;
      return json({ restored: true, beforeHash: snapshot.database.dumpHash, afterHash: snapshot.database.dumpHash,
        profileHash: snapshot.profile.profileHash, profileRevision: snapshot.profile.profileRevision });
    }
    if (url.origin === "http://127.0.0.1:55174" && url.pathname === "/restore-final") {
      baselineRestored = true;
      return json({ restored: true, beforeHash: initial.database.dumpHash, afterHash: initial.database.dumpHash,
        profileHash: initial.profile.profileHash, profileRevision: initial.profile.profileRevision });
    }
    if (url.origin === "http://127.0.0.1:55174" && url.pathname === "/health") {
      return json({ status: "ready", service: "music-e2e-state",
        mutationGuard: { version: "music-e2e-mutation-guard/v1", state: "clear", reason: "none", stage: "preflight" } });
    }
    if (url.origin === "http://127.0.0.1:55000" && url.pathname === "/api/music/identity/ensure") {
      return json({ identity: { status: "active" }, credential: { token: ownerJwt } });
    }
    if (url.pathname === "/__music-fixture/profile-state/snapshot") {
      const exactTuple = decoded.namespace === "e2e-public-music-qualification"
        && decoded.username === "e2e-public-music-qualification-owner"
        && decoded.accountDocumentId === "e2e-public-music-qualification-account"
        && decoded.userDocumentId === "e2e-public-music-qualification-user";
      if (headers.get("authorization") !== `Bearer ${"F".repeat(43)}` || !exactTuple) return json({ error: "denied" }, 403);
      return json({ version: "music-fixture-profile-state/v1", revision: 3, stateHash: "c".repeat(64),
        snapshot: { version: "music-fixture-profile-snapshot/v1", revision: 3, account: { documentId: "e2e-public-music-qualification-account" } } });
    }
    if (url.pathname === "/__music-fixture/profile-state/restore") {
      return headers.get("authorization") === `Bearer ${"F".repeat(43)}`
        ? json({ version: "music-fixture-profile-state/v1", restored: true, revision: 3, stateHash: "c".repeat(64) })
        : json({ error: "denied" }, 403);
    }
    if (url.pathname === "/graphql") {
      if (headers.has("x-music-fixture-expected-revision")) {
        if (url.origin === "http://localhost:55173") return json({ error: "revision authority denied" }, 403);
        directRevisionWrites += 1;
        if (directRevisionWrites === 2) return json({ error: "fixture profile revision stale" }, 409);
      }
      if (operation === "UpdateAccount") return json({ data: { updateAccount: {
        documentId: "e2e-public-music-qualification-account",
        Bio: decoded.variables?.data?.Bio,
        public_profile: decoded.variables?.data?.public_profile ?? "Yes",
        public_recommendations: decoded.variables?.data?.public_recommendations ?? "Yes",
        public_music: decoded.variables?.data?.public_music ?? "Yes",
      } } });
      if (operation === "UsersPermissionsUser") return json({ data: { usersPermissionsUser: {
        documentId: "e2e-public-music-qualification-user", username: "e2e-public-music-qualification-owner",
        accounts: [{ documentId: "e2e-public-music-qualification-account", Bio: "fixture", updatedAt: "2026-08-29T00:00:03.000Z" }],
      } } });
      if (operation === "PublicProfileData" || operation === "PublicAccountBasic") return json({ data: { accounts: [{
        documentId: "e2e-public-music-qualification-account", username: "e2e-public-music-qualification-owner",
        Account_Name: "Fixture Explorer",
        public_profile: "Yes", public_recommendations: "Yes", public_music: "Yes",
      }] } });
      const categoryDefinitions: Record<string, { root: string; subject: string; contentKey: string }> = {
        GetPlacesLists: { root: "recommendationLists", subject: "places", contentKey: "recommended_places" },
        GetMoviesLists: { root: "movieLists", subject: "movies", contentKey: "recommended_movies" },
        GetBooksLists: { root: "bookLists", subject: "books", contentKey: "recommended_books" },
        GetGamesLists: { root: "gameLists", subject: "games", contentKey: "recommended_games" },
        GetAppsLists: { root: "appLists", subject: "apps", contentKey: "recommended_apps" },
        GetProductsLists: { root: "productLists", subject: "products", contentKey: "recommended_products" },
        GetPeopleLists: { root: "personLists", subject: "people", contentKey: "recommended_people" },
        GetGuidesLists: { root: "guides", subject: "guides", contentKey: "Title" },
      };
      if (operation === "PublicCategoryListCounts") return json({ data: Object.fromEntries(
        Object.values(categoryDefinitions).map(({ root }) => [root, [{ documentId: `e2e-public-music-qualification-${root}-count` }]]),
      ) });
      const category = operation ? categoryDefinitions[operation] : undefined;
      if (category) {
        const documentId = `e2e-public-music-qualification-${category.subject}-list`;
        return json({ data: { [category.root]: [{
          documentId,
          ...(category.contentKey === "Title"
            ? { Title: "Fixture Guide" }
            : { [category.contentKey]: [{ documentId: `${documentId}-item` }] }),
        }] } });
      }
      return json({ error: "unknown operation" }, 403);
    }
    if (url.origin === "http://127.0.0.1:55000" && url.pathname === "/api/playlists" && method === "POST") {
      return json({ id: ++playlistId, name: decoded.name }, 201);
    }
    if (url.origin === "http://127.0.0.1:55000" && url.pathname === "/api/playlists" && method === "GET") {
      return baselineRestored ? json({ error: "retired" }, 401) : json([]);
    }
    if (/^\/api\/playlists\/\d+\/songs$/.test(url.pathname)) return json({ id: ++songId }, 201);
    if (/^\/api\/playlists\/\d+\/visibility$/.test(url.pathname)) return new Response(null, { status: 204 });
    if (url.pathname === "/api/music/dashboard") return json({ queueRevision: 0, playbackRevision: 0, publication: { mode: "private" } });
    if (url.pathname === "/api/music/queue/replace") return json({ revision: 1 });
    if (url.pathname === "/api/playlist/currently-playing") return json({ revision: 2 + playbackCalls, playbackRevision: ++playbackCalls });
    if (url.pathname === "/api/music/guest-controls") return json({ updated: true });
    if (url.pathname === "/api/music/publication") return json({ version: "music-publication/v1",
      publication: { mode: "public", publicSlug: "actual-qualified-public-slug" } });
    if (url.pathname === "/api/music/public-resource/v1/actual-qualified-public-slug") return json({
      version: "music-public-resource/v1",
      currentlyPlaying: { title: "Fixture playing song" },
      queue: { items: [{ title: "Fixture queued song" }] },
      recentlyPlayed: { items: [{ title: "Fixture history song" }] },
      playlists: { items: [{ name: "Pre-browser public fixture" }] },
      permissions: {
        allowSongRequests: true, allowGuestPlayOnDevice: true, allowPlaylistSharing: true,
        allowRecentlyPlayedVisibility: true, allowQueueVisibility: true,
      },
    });
    return json({ error: "unexpected fixture request" }, 404);
  };

  const authority = {
    stateOrigin: "http://127.0.0.1:55174",
    tunesOrigin: "http://127.0.0.1:55000",
    explorerOrigin: "http://localhost:55173",
    strapiOrigin: "http://127.0.0.1:51337",
    stateToken: "S".repeat(43),
    orchestrationToken: "O".repeat(43),
    fixtureToken: "F".repeat(43),
    namespace: "e2e-public-music-qualification",
    username: "e2e-public-music-qualification-owner",
    accountDocumentId: "e2e-public-music-qualification-account",
    userDocumentId: "e2e-public-music-qualification-user",
  };
  const result = await run({ initialSnapshot: initial, adapter: createAdapter({ authority, initialSnapshot: initial, fetchImpl }) });
  expect(result).toMatchObject({ ok: true, record: { status: "passed", counts: { categoryQueries: 20, musicPrerequisites: 9 } } });
  expect(calls.filter(({ operation }) => operation === "UsersPermissionsUser")).toHaveLength(2);
  expect(calls.filter(({ operation }) => operation && [
    "PublicProfileData", "PublicCategoryListCounts", "GetPlacesLists", "GetMoviesLists", "GetBooksLists",
    "GetGamesLists", "GetAppsLists", "GetProductsLists", "GetPeopleLists", "GetGuidesLists",
  ].includes(operation))).toHaveLength(20);
  expect(calls.filter(({ expectedRevision }) => expectedRevision !== undefined)).toEqual(expect.arrayContaining([
    expect.objectContaining({ origin: "http://127.0.0.1:51337", operation: "UpdateAccount", expectedRevision: "3" }),
    expect.objectContaining({ origin: "http://localhost:55173", operation: "UpdateAccount", expectedRevision: "3" }),
  ]));
  expect(calls.find(({ path }) => path === "/api/music/publication")).toMatchObject({
    idempotencyKey: expect.stringMatching(/^tunes-share-v1-\d{13}-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
  });
  expect(calls.filter(({ path }) => path === "/api/music/public-resource/v1/actual-qualified-public-slug"))
    .toEqual(expect.arrayContaining([
      expect.objectContaining({ origin: "http://127.0.0.1:55000" }),
      expect.objectContaining({ origin: "http://localhost:55173" }),
    ]));
  expect(JSON.stringify(result.record)).not.toContain(ownerJwt);
});

for (const [method, expectedCode] of [
  ["ensureEphemeralOwner", "identity-ensure-failed"],
  ["capture", "populated-snapshot-failed"],
  ["verifyRollbackProbe", "rollback-probe-failed"],
  ["restore", "phase-restore-failed"],
  ["verifyPublicProfileAndMusic", "public-capability-failed"],
  ["restoreBaseline", "baseline-restore-failed"],
  ["verifyEphemeralOwnerRetired", "ephemeral-owner-not-retired"],
  ["readGuard", "guard-not-clear"],
] as const) {
  test(`pre-browser qualifier maps ${method} failure to fixed ${expectedCode} and still attempts baseline restore and guard inspection`, async () => {
    const contract = await loadPrebrowserQualificationContract();
    const run = contract.runMusicPrebrowserQualification as undefined | ((input: {
      initialSnapshot: QualificationSnapshot;
      adapter: ReturnType<typeof passingPrebrowserQualificationAdapter>;
    }) => Promise<{ ok: boolean; record: Record<string, unknown> }>);
    expect(typeof run).toBe("function");
    if (!run) return;
    const events: string[] = [];
    const adapter = passingPrebrowserQualificationAdapter(events);
    const original = adapter[method] as (...args: unknown[]) => Promise<unknown>;
    Object.assign(adapter, {
      [method]: async (...args: unknown[]) => {
        await original(...args);
        if (method === "verifyEphemeralOwnerRetired") return false;
        if (method === "readGuard") return { version: "music-e2e-mutation-guard/v1", state: "blocked", reason: "restore-failed", stage: "restore" };
        throw new Error("Bearer private-qualification-value from C:\\Users\\private\\state.json");
      },
    });
    const result = await run({
      initialSnapshot: qualificationSnapshot("initial-snapshot", "a".repeat(64), "f".repeat(64), 0, 0),
      adapter,
    });
    expect(result).toMatchObject({ ok: false, record: { status: "failed", code: expectedCode } });
    expect(events).toContain("restore:initial-baseline");
    expect(events).toContain("guard-clear");
    expect(JSON.stringify(result.record)).not.toMatch(/private-qualification|Bearer|C:\\Users|snapshotId|token|credential|authorization/i);
  });
}

test("runner qualifier refusal restores and tears down before any storage, collection, callback, or auth write", async () => {
  const events: string[] = [];
  const hash = "a".repeat(64);
  const outcome = await runMusicFixtureOrchestration({
    snapshotExists: true,
    baseReport: { version: MUSIC_PUBLIC_FIXTURE_VERSION, runId: "prebrowser-refusal", lane: "live" },
    qualify: async () => {
      events.push("qualify");
      return { ok: false, record: failedPrebrowserQualification() };
    },
    artifacts: {
      directory: "fixture-artifacts", authPath: "owner-auth.json", storagePath: "profile-storage-state.json",
      mkdir: () => { events.push("artifact-mkdir"); },
      write: (file: string) => { events.push(`auth-write:${file}`); },
      chmod: () => undefined,
    },
    restoreEvidence: { path: "restore.jsonl", exists: () => false, read: () => "" },
    execute: async () => { events.push("collection-callback-journeys"); return 0; },
    restore: async () => { events.push("initial-restore"); return { ok: true, beforeHash: hash, afterHash: hash }; },
    teardown: {
      artifactPaths: [], exists: () => false, unlink: () => undefined,
      stopStateService: async () => { events.push("state-service-stop"); },
      down: () => { events.push("fixture-down"); return 0; },
    },
    writeReport: async () => undefined,
    writeStdout: () => undefined,
    writeStderr: () => undefined,
  });
  expect(events).toEqual(["qualify", "initial-restore", "state-service-stop", "fixture-down"]);
  expect(outcome).toMatchObject({ exitCode: 4, report: { result: "failed", cleanup: "restored" } });
});

test("runner starts artifact setup and collection/callback execution only after a green qualifier", async () => {
  const events: string[] = [];
  const hash = "a".repeat(64);
  await runMusicFixtureOrchestration({
    snapshotExists: true,
    baseReport: { version: MUSIC_PUBLIC_FIXTURE_VERSION, runId: "prebrowser-green", lane: "live" },
    qualify: async () => { events.push("qualify-green"); return { ok: true, record: passedPrebrowserQualification() }; },
    artifacts: {
      directory: "fixture-artifacts", authPath: "owner-auth.json", storagePath: "profile-storage-state.json",
      mkdir: () => { events.push("artifact-mkdir"); },
      write: () => { events.push("storage-write"); },
      chmod: () => undefined,
    },
    restoreEvidence: { path: "restore.jsonl", exists: () => false, read: () => "" },
    execute: async () => { events.push("collection-callback-journeys"); return 0; },
    restore: async () => { events.push("initial-restore"); return { ok: true, beforeHash: hash, afterHash: hash }; },
    teardown: {
      artifactPaths: [], exists: () => false, unlink: () => undefined,
      stopStateService: async () => { events.push("state-service-stop"); },
      down: () => { events.push("fixture-down"); return 0; },
    },
    writeReport: async () => undefined,
    writeStdout: () => undefined,
    writeStderr: () => undefined,
  });
  expect(events).toEqual([
    "qualify-green", "artifact-mkdir", "storage-write", "collection-callback-journeys",
    "initial-restore", "state-service-stop", "fixture-down",
  ]);
});

test("runner rejects a hostile qualifier record before artifacts and never retains its extra field", async () => {
  const events: string[] = [];
  const reports: unknown[] = [];
  const hash = "a".repeat(64);
  const hostile = "Bearer hostile.qualifier.secret";
  const outcome = await runMusicFixtureOrchestration({
    snapshotExists: true,
    baseReport: { version: MUSIC_PUBLIC_FIXTURE_VERSION, runId: "prebrowser-hostile", lane: "live" },
    qualify: async () => {
      events.push("qualify");
      return { ok: true, record: { ...passedPrebrowserQualification(), credential: hostile } };
    },
    artifacts: {
      directory: "fixture-artifacts", authPath: "owner-auth.json", storagePath: "profile-storage-state.json",
      mkdir: () => { events.push("artifact-mkdir"); },
      write: () => { events.push("storage-write"); },
      chmod: () => undefined,
    },
    restoreEvidence: { path: "restore.jsonl", exists: () => false, read: () => "" },
    execute: async () => { events.push("collection-callback-journeys"); return 0; },
    restore: async () => { events.push("initial-restore"); return { ok: true, beforeHash: hash, afterHash: hash }; },
    teardown: {
      artifactPaths: [], exists: () => false, unlink: () => undefined,
      stopStateService: async () => { events.push("state-service-stop"); },
      down: () => { events.push("fixture-down"); return 0; },
    },
    writeReport: async (report: unknown) => { reports.push(report); },
    writeStdout: () => undefined,
    writeStderr: () => undefined,
  });
  expect(events).toEqual(["qualify", "initial-restore", "state-service-stop", "fixture-down"]);
  expect(outcome).toMatchObject({ exitCode: 4, report: { result: "failed", cleanup: "restored" } });
  expect(JSON.stringify(reports)).not.toContain(hostile);
});

test("pre-browser qualification records have one exact fixed safe schema and reject hostile additions", async () => {
  const contract = await loadPrebrowserQualificationContract();
  const validate = contract.validateMusicPrebrowserQualificationRecord as undefined | ((value: unknown) => boolean);
  expect(typeof validate).toBe("function");
  if (!validate) return;
  const events: string[] = [];
  const result = await (contract.runMusicPrebrowserQualification as (input: {
    initialSnapshot: QualificationSnapshot;
    adapter: ReturnType<typeof passingPrebrowserQualificationAdapter>;
  }) => Promise<{ record: Record<string, unknown> }>)({
    initialSnapshot: qualificationSnapshot("initial-snapshot", "a".repeat(64), "f".repeat(64), 0, 0),
    adapter: passingPrebrowserQualificationAdapter(events),
  });
  expect(validate(result.record)).toBe(true);
  expect(validate({ ...result.record, token: "header.payload.secret" })).toBe(false);
  expect(validate({ ...result.record, code: "C:\\Users\\private\\raw.txt" })).toBe(false);
  expect(validate({ ...result.record, counts: { identityRows: 1, categoryQueries: 19, musicPrerequisites: 9 } })).toBe(false);
  expect(validate({ ...result.record, hashes: { ...(result.record.hashes as object), publicSlug: "actual-private-slug" } })).toBe(false);
});

test("public qualification accepts only the exact profile, all counts, and every namespaced category fixture", async () => {
  const contract = await loadPrebrowserQualificationContract();
  const validate = contract.validateMusicQualificationPublicGraphql as undefined | ((input: {
    operation: string; root: string; body: unknown; namespace: string; accountDocumentId: string;
  }) => boolean);
  expect(typeof validate).toBe("function");
  if (!validate) return;
  const namespace = "e2e-public-music-qualification";
  const accountDocumentId = `${namespace}-account`;
  const profile = {
    data: { accounts: [{
      documentId: accountDocumentId, Account_Name: "Fixture Explorer",
      public_profile: "Yes", public_recommendations: "Yes", public_music: "Yes",
    }] },
  };
  expect(validate({ operation: "PublicProfileData", root: "accounts", body: profile, namespace, accountDocumentId })).toBe(true);
  expect(validate({ operation: "PublicProfileData", root: "accounts", body: {
    data: { accounts: [{ ...profile.data.accounts[0], documentId: `${namespace}-other-account` }] },
  }, namespace, accountDocumentId })).toBe(false);

  const roots = ["recommendationLists", "movieLists", "bookLists", "gameLists", "appLists", "productLists", "personLists", "guides"];
  const counts = { data: Object.fromEntries(roots.map((root) => [root, [{ documentId: `${namespace}-${root}-count` }]])) };
  expect(validate({ operation: "PublicCategoryListCounts", root: "recommendationLists", body: counts, namespace, accountDocumentId })).toBe(true);
  expect(validate({ operation: "PublicCategoryListCounts", root: "recommendationLists", body: {
    data: { ...counts.data, guides: [] },
  }, namespace, accountDocumentId })).toBe(false);

  const categoryCases = [
    ["GetPlacesLists", "recommendationLists", "places", "recommended_places"],
    ["GetMoviesLists", "movieLists", "movies", "recommended_movies"],
    ["GetBooksLists", "bookLists", "books", "recommended_books"],
    ["GetGamesLists", "gameLists", "games", "recommended_games"],
    ["GetAppsLists", "appLists", "apps", "recommended_apps"],
    ["GetProductsLists", "productLists", "products", "recommended_products"],
    ["GetPeopleLists", "personLists", "people", "recommended_people"],
    ["GetGuidesLists", "guides", "guides", "Title"],
  ] as const;
  for (const [operation, root, subject, contentKey] of categoryCases) {
    const item = {
      documentId: `${namespace}-${subject}-list`,
      ...(contentKey === "Title" ? { Title: "Fixture Guide" } : { [contentKey]: [{ documentId: `${namespace}-${subject}-list-item` }] }),
    };
    expect(validate({ operation, root, body: { data: { [root]: [item] } }, namespace, accountDocumentId })).toBe(true);
    expect(validate({ operation, root, body: { data: { [root]: [{ ...item, documentId: "foreign-list" }] } }, namespace, accountDocumentId })).toBe(false);
  }
});

test("profile qualification requires the exact account and requested fields in UpdateAccount success", async () => {
  const contract = await loadPrebrowserQualificationContract();
  const validate = contract.validateMusicQualificationUpdateResponse as undefined | ((input: {
    status: number; body: unknown; accountDocumentId: string; expected: Record<string, unknown>;
  }) => boolean);
  expect(typeof validate).toBe("function");
  if (!validate) return;
  const accountDocumentId = "e2e-public-music-qualification-account";
  const body = { data: { updateAccount: { documentId: accountDocumentId, Bio: "rollback probe" } } };
  expect(validate({ status: 200, body, accountDocumentId, expected: { Bio: "rollback probe" } })).toBe(true);
  expect(validate({ status: 200, body: { data: { updateAccount: null } }, accountDocumentId, expected: { Bio: "rollback probe" } })).toBe(false);
  expect(validate({ status: 200, body, accountDocumentId: `${accountDocumentId}-other`, expected: { Bio: "rollback probe" } })).toBe(false);
  expect(validate({ status: 200, body, accountDocumentId, expected: { Bio: "different" } })).toBe(false);
});

test("qualifier credential fingerprint must differ from the later callback owner credential", async () => {
  const contract = await loadPrebrowserQualificationContract();
  const distinct = contract.isDistinctMusicCallbackCredential as undefined | ((input: {
    qualifierJwtFingerprint: string;
    callbackCredential: string;
  }) => boolean);
  expect(typeof distinct).toBe("function");
  if (!distinct) return;
  const qualifier = "qualifier.header.ephemeral-owner";
  const fingerprint = createHash("sha256").update(qualifier).digest("hex");
  expect(distinct({ qualifierJwtFingerprint: fingerprint, callbackCredential: `Bearer ${qualifier}` })).toBe(false);
  expect(distinct({ qualifierJwtFingerprint: fingerprint, callbackCredential: "Bearer callback.header.distinct-owner" })).toBe(true);
  expect(distinct({ qualifierJwtFingerprint: fingerprint, callbackCredential: "Bearer malformed" })).toBe(false);
});

test("canonical state snapshots require safe populated identity and profile field counts", async () => {
  const base = {
    version: "music-live-account-snapshot/v1",
    snapshotId: "safe-populated-snapshot",
    publication: { coveredByDatabaseDump: true },
    guestControls: { coveredByDatabaseDump: true },
    queue: { coveredByDatabaseDump: true },
    playlists: { coveredByDatabaseDump: true },
    requests: { coveredByDatabaseDump: true },
    profile: {
      accountDocumentId: "e2e-public-music-state-account", publicMusic: false,
      profileRevision: 3, profileHash: "a".repeat(64),
    },
    database: { namespace: "e2e-public-music-state", dumpHash: "b".repeat(64) },
  };
  await expect(createCanonicalMusicFixtureAdapter({
    readFullSnapshot: async () => base,
    resetNamespace: async () => undefined,
  }).snapshot()).rejects.toThrow(/complete Strapi profile state|database identity population/);
  await expect(createCanonicalMusicFixtureAdapter({
    readFullSnapshot: async () => ({
      ...base,
      profile: { ...base.profile, fieldCount: 24 },
      database: { ...base.database, identityRows: 1 },
    }),
    resetNamespace: async () => undefined,
  }).snapshot()).resolves.toMatchObject({
    profile: { fieldCount: 24 }, database: { identityRows: 1 },
  });
});

test("state service proves populated identity/profile metadata and returns exact profile restore equality", () => {
  const stateService = readFileSync("../tunes/scripts/music-e2e-state-service.mjs", "utf8");
  const captureCore = readFileSync("../tunes/scripts/music-e2e-state-capture.mjs", "utf8");
  expect(stateService).toContain("runMusicFixtureIdentityCountPsql");
  expect(stateService).not.toContain("buildMusicFixtureIdentityCountPsqlQuery");
  expect(stateService).not.toContain('"-Atc"');
  expect(captureCore).toContain("buildMusicFixtureIdentityCountPgQuery");
  expect(captureCore).toContain("buildMusicFixtureIdentityCountPsqlOperation");
  expect(captureCore).toContain("identityPredicates");
  expect(captureCore).toContain("identityRows");
  expect(captureCore).toContain("fieldCount");
  expect(stateService).toMatch(/return \{[\s\S]{0,320}beforeHash: restored\.beforeHash,[\s\S]{0,160}afterHash: restored\.afterHash,[\s\S]{0,160}profileHash:[\s\S]{0,160}profileRevision:/);
  expect(captureCore).not.toMatch(/SELECT[^`]*\$\{(?:authority|namespace|username)/);
});

test("live runner binds qualification before collection and callback without persisting qualifier authority", () => {
  const runner = readFileSync("scripts/music-public-e2e.mjs", "utf8");
  const snapshot = runner.indexOf('fetch(`${stateServiceUrl}/snapshot`');
  const qualification = runner.indexOf("runMusicPrebrowserQualification({");
  const collection = runner.indexOf("runLivePreflight({");
  const callback = runner.indexOf("google-auth/callback?access_token=");
  const authWrite = runner.indexOf("writeFileSync(authStatePath");
  expect(snapshot).toBeGreaterThan(-1);
  expect(qualification).toBeGreaterThan(snapshot);
  expect(collection).toBeGreaterThan(qualification);
  expect(callback).toBeGreaterThan(collection);
  expect(authWrite).toBeGreaterThan(callback);
  expect(runner).toContain("isDistinctMusicCallbackCredential");
  expect(runner).toContain("prebrowserQualificationRecord");
  expect(runner).not.toMatch(/writeFileSync\([^\n]+qualifierJwt/i);
});

test("artifact finalization requires a validated safe pre-browser qualification record", () => {
  const artifacts = readFileSync("scripts/music-public-qualification-artifacts.mjs", "utf8");
  expect(artifacts).toContain("validateMusicPrebrowserQualificationRecord");
  expect(artifacts).toMatch(/!validateMusicPrebrowserQualificationRecord\(evidence\.prebrowserQualification\)/);
});

test("initial snapshot decoding retains only exact fixed stage/code and bounded success metadata", async () => {
  const contract = await import("../scripts/music-public-initial-snapshot.mjs").catch(() => null) as null | {
    decodeMusicInitialSnapshotResponse(input: { status: number; body: unknown }): {
      ok: boolean;
      snapshot?: unknown;
      record: ReturnType<typeof unavailableInitialSnapshotQualification>;
    };
    musicInitialSnapshotRequestFailure(error: unknown): ReturnType<typeof unavailableInitialSnapshotQualification>;
    validateMusicInitialSnapshotQualificationRecord(value: unknown): boolean;
  };
  expect(contract).not.toBeNull();
  if (!contract) return;
  const snapshot = {
    version: "music-live-account-snapshot/v1",
    snapshotId: "initial-safe-snapshot",
    publication: { coveredByDatabaseDump: true },
    guestControls: { coveredByDatabaseDump: true },
    queue: { coveredByDatabaseDump: true },
    playlists: { coveredByDatabaseDump: true },
    requests: { coveredByDatabaseDump: true },
    profile: {
      accountDocumentId: "e2e-public-music-state-account", publicMusic: false,
      profileRevision: 0, profileHash: "b".repeat(64), fieldCount: 2,
    },
    database: { namespace: "e2e-public-music-state", dumpHash: "a".repeat(64), identityRows: 0 },
  };
  expect(contract.decodeMusicInitialSnapshotResponse({ status: 200, body: snapshot })).toEqual({
    ok: true,
    snapshot,
    record: passedInitialSnapshotQualification(),
  });

  const serviceFailure = {
    schemaVersion: "music-e2e-state-capture-failure/v1",
    state: "failed",
    stage: "identity-count-query",
    code: "operation-failed",
  };
  expect(contract.decodeMusicInitialSnapshotResponse({ status: 500, body: serviceFailure })).toEqual({
    ok: false,
    record: {
      ...unavailableInitialSnapshotQualification(),
      status: "failed",
      stage: "identity-count-query",
      code: "operation-failed",
    },
  });
  const hostileValue = "token=never-retain C:\\private\\capture.sql postgresql://owner:secret@127.0.0.1/db";
  const malformed = contract.decodeMusicInitialSnapshotResponse({
    status: 500,
    body: { ...serviceFailure, debug: hostileValue },
  });
  expect(malformed).toEqual({
    ok: false,
    record: {
      ...unavailableInitialSnapshotQualification(),
      status: "failed",
      stage: "snapshot-store",
      code: "contract-invalid",
    },
  });
  expect(JSON.stringify(malformed)).not.toContain("never-retain");
  expect(contract.musicInitialSnapshotRequestFailure(Object.assign(new Error(hostileValue), { name: "TimeoutError" })))
    .toEqual({
      ...unavailableInitialSnapshotQualification(),
      status: "failed",
      stage: "snapshot-store",
      code: "operation-timeout",
    });
  expect(contract.validateMusicInitialSnapshotQualificationRecord(malformed.record)).toBe(true);
  expect(contract.validateMusicInitialSnapshotQualificationRecord({ ...malformed.record, path: hostileValue })).toBe(false);
});

test("live runner preserves safe initial-snapshot failure before qualifier and artifact validation", () => {
  const runner = readFileSync("scripts/music-public-e2e.mjs", "utf8");
  const decode = runner.indexOf("decodeMusicInitialSnapshotResponse({");
  const qualification = runner.indexOf("runMusicPrebrowserQualification({");
  expect(decode).toBeGreaterThan(-1);
  expect(qualification).toBeGreaterThan(decode);
  expect(runner).toContain("initialSnapshotQualificationRecord");
  expect(runner).toMatch(/initialSnapshotQualification:\s*(?:report\.initialSnapshotQualification \?\? )?initialSnapshotQualificationRecord/);
  const artifacts = readFileSync("scripts/music-public-qualification-artifacts.mjs", "utf8");
  expect(artifacts).toContain("validateMusicInitialSnapshotQualificationRecord");
  expect(artifacts).toMatch(/!validateMusicInitialSnapshotQualificationRecord\(evidence\.initialSnapshotQualification\)/);
});
