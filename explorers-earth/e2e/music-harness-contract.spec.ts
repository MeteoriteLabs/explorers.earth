import { expect, test } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
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
  musicLiveTest,
  resetMusicRestoreBlockForContractTest,
  runAuthorizedMusicMutation,
  resolveMusicTestLane,
  withRestoredMusicFixture,
} from "./setup/music";
import playwrightConfig from "../playwright.config";

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

test("one canonical adapter refuses incomplete account state and restores every domain through namespace reset", async () => {
  const complete = {
    version: "music-live-account-snapshot/v1",
    snapshotId: "snapshot-fixture",
    publication: { mode: "unlisted", lifecycle: "active", publicSlug: "fixture_slug" },
    guestControls: { allowSongRequests: true, allowGuestPlayOnDevice: false, allowPlaylistSharing: true, allowRecentlyPlayedVisibility: true, allowQueueVisibility: true },
    queue: { revision: 7, songs: [{ id: 1, position: 0 }], currentlyPlaying: { id: 1 }, history: [{ id: 2 }] },
    playlists: [{ id: 10, name: "Fixture", privacy: "shared", songs: [{ id: 3, position: 0 }] }],
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
