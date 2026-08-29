import { expect, test } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
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
) {
  return [
    'import { test } from "@playwright/test";',
    ...mutations.map(({ title }) => `test(${JSON.stringify(title)}, { tag: ${JSON.stringify(LIVE_MUTATION_TAG)} }, async () => {});`),
    ...readOnly.map(({ title }) => `test(${JSON.stringify(title)}, { tag: ${JSON.stringify(LIVE_READ_ONLY_TAG)} }, async () => {});`),
    "",
  ].join("\n");
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

test("real inert live-project JSON collection classifies exactly 17 mutations and 31 read-only cases", () => {
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
  expect(specs).toHaveLength(48);
  expect(mutationSpecs).toHaveLength(17);
  expect(readOnlySpecs).toHaveLength(31);
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
  const reportPath = join(syntheticRoot, "journey-results.json");
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
    });
    expect(outcome.status).toBe(0);
    expect(existsSync(reportPath)).toBe(true);
    const persistedReport = JSON.parse(readFileSync(reportPath, "utf8"));
    expect(outcome.executionReport).toEqual(persistedReport);
    expect(validateLiveJourneyEvidence({
      executionReport: persistedReport,
      records: validJourneyEvidenceRecords(),
    })).toMatchObject({ ok: true });
  } finally {
    rmSync(syntheticRoot, { recursive: true, force: true });
  }
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
  const result = spawnSync(process.execPath, ["scripts/music-public-e2e.mjs", "verify", "--dry-run"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, MUSIC_PUBLIC_RUN_ID: "contract-run" },
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
  expect(runner).toMatch(/music-cli[\s\S]+bootstrap[\s\S]+music-cli[\s\S]+up/);
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
  expect(runner).toContain('import { runMusicFixtureOrchestration } from "./music-public-e2e-runner.mjs"');
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
  expect(runner).toContain('runNpm(["run", "--silent", "music-cli", "--", "down"]');
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

for (const teardownFault of ["first-artifact-unlink", "second-artifact-unlink", "state-service-stop", "exact-down"] as const) {
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
        artifactPaths: ["owner-auth.json", "profile-storage-state.json"],
        exists: (file) => { calls.push(`exists:${file}`); return true; },
        unlink: (file) => {
          calls.push(`unlink:${file}`);
          if ((teardownFault === "first-artifact-unlink" && file === "owner-auth.json")
              || (teardownFault === "second-artifact-unlink" && file === "profile-storage-state.json")) {
            throw new Error("Bearer teardown-token");
          }
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
      "exists:owner-auth.json",
      "unlink:owner-auth.json",
      "exists:profile-storage-state.json",
      "unlink:profile-storage-state.json",
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

test("teardown continues after an artifact existence check fails", () => {
  const calls: string[] = [];
  const status = stopMusicFixture({
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
