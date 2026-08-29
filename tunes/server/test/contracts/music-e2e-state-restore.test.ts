import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { EXPECTED_MUSIC_MIGRATION_CHAIN } from "../../../shared/music-migration-contract";

async function loadRestoreContract(): Promise<Record<string, unknown>> {
  try {
    const modulePath: string = "../../../scripts/music-e2e-state-restore.mjs";
    return await import(modulePath);
  } catch {
    return {};
  }
}

describe("Music E2E transactional state restore", () => {
  it("derives an immutable restore target only from the exact fixture container fingerprint", async () => {
    // Production break caught: label-only inspection followed by execution by
    // mutable Compose name leaves a TOCTOU window and under-specifies target.
    const contract = await loadRestoreContract();
    const attest = contract.attestMusicFixtureRestoreContainer as undefined | ((value: unknown) => { containerId: string });
    expect(attest).toBeTypeOf("function");
    if (!attest) return;
    const containerId = "a".repeat(64);
    const exact = {
      Id: containerId,
      Name: "/explorers-music-fixture-postgres-1",
      Config: {
        Image: "postgres:15-alpine",
        Labels: {
          "com.explorers.music.fixture": "true",
          "com.explorers.music.project": "explorers-music-fixture",
          "com.docker.compose.project": "explorers-music-fixture",
          "com.docker.compose.service": "postgres",
          "com.docker.compose.container-number": "1",
          "com.docker.compose.oneoff": "False",
        },
      },
      State: { Running: true, Health: { Status: "healthy" } },
      HostConfig: { PortBindings: { "5432/tcp": [{ HostIp: "127.0.0.1", HostPort: "55432" }] } },
      Mounts: [
        { Type: "volume", Name: "explorers-music-fixture_music-fixture-postgres", Destination: "/var/lib/postgresql/data", RW: true },
        { Type: "bind", Destination: "/run/secrets/music-db-migrator", RW: false },
      ],
    };
    expect(attest(exact)).toEqual({ containerId });
    for (const hostile of [
      { ...exact, Id: "b".repeat(64), Name: "/production-postgres" },
      { ...exact, Config: { ...exact.Config, Image: "postgres:latest" } },
      { ...exact, HostConfig: { PortBindings: { "5432/tcp": [{ HostIp: "0.0.0.0", HostPort: "55432" }] } } },
      { ...exact, Mounts: [...exact.Mounts, { Type: "bind", Destination: "/host", RW: true }] },
    ]) expect(() => attest(hostile)).toThrow("fixture restore container authority is invalid");
  });

  it("builds one exact single-transaction psql operation around the private plain dump", async () => {
    // Production break caught: splitting TRUNCATE and replay across child
    // processes can commit a destructive partial restore before replay fails.
    const contract = await loadRestoreContract();
    const build = contract.buildMusicFixtureRestoreOperation as undefined | ((input: {
      containerId: string;
      dataDump: Buffer;
    }) => { file: string; args: string[]; input: Buffer });

    expect(build).toBeTypeOf("function");
    if (!build) return;
    const marker = "COPY public.users (id) FROM stdin;\n1\n\\.\n";
    const operation = build({ containerId: "a".repeat(64), dataDump: Buffer.from(marker) });

    expect(operation.file).toBe(process.platform === "win32" ? "docker.exe" : "docker");
    expect(operation.args).toEqual([
      "exec", "-i", "a".repeat(64),
      "psql", "-X", "-v", "ON_ERROR_STOP=1", "--single-transaction",
      "-U", "music_migrator", "-d", "music_fixture",
    ]);
    const sql = operation.input.toString("utf8");
    expect(sql.match(/TRUNCATE TABLE/g)).toHaveLength(1);
    expect(sql.match(/COPY public\.users \(id\) FROM stdin;/g)).toHaveLength(1);
    expect(sql.indexOf("TRUNCATE TABLE")).toBeLessThan(sql.indexOf(marker));
    expect(sql.indexOf(marker)).toBeLessThan(sql.lastIndexOf("ENABLE ALWAYS TRIGGER music_publication_operation_immutability"));
  });

  it("uses the exact frozen 0021 table, migration, and trigger authority", async () => {
    // Production break caught: a dynamic public-table query or incomplete
    // trigger inventory could truncate an unexpected table or replay through a
    // trigger whose semantics mutate the captured bytes.
    const contract = await loadRestoreContract();
    expect(contract.MUSIC_FIXTURE_TABLES).toEqual([
      "activity_logs", "analytics_snapshots", "api_tokens", "email_logs", "email_templates",
      "explorers_analytics_receipts", "guest_interactions", "music_credential_revocation_operations",
      "music_identity_lifecycle_operations", "music_identity_tombstones", "music_owner_operations",
      "music_publication_operation_archive", "music_publication_operations", "music_reactivation_tokens",
      "music_schema_migrations", "page_contents", "playback_states", "played_songs", "playlist_songs",
      "playlists", "seo_settings", "session", "songs", "system_settings", "team_members", "user_activity",
      "user_profiles", "user_sessions", "users", "widgets", "youtube_api_calls", "youtube_api_usage",
      "youtube_music", "youtube_music_playlists", "youtube_playlists", "youtube_tokens",
    ]);
    expect(contract.MUSIC_FIXTURE_MIGRATION_IDS).toEqual([
      "0001_runtime_baseline", "0002_identity_lifecycle", "0003_identity_lifecycle_hardening",
      "0004_identity_delete_saga", "0005_resource_bound_deletion_history", "0006_numeric_identity_lock",
      "0007_identity_provider_snapshot", "0008_credential_revocation_operations",
      "0009_credential_revocation_history_immutability", "0010_least_privilege_runtime_role",
      "0011_durable_publication_idempotency", "0012_publication_replay_expiry_guard",
      "0013_publication_operation_database_clock", "0014_durable_reactivation_authority",
      "0015_publication_operation_archive", "0016_publication_operation_retention",
      "0017_publication_idempotency_key_retirement", "0018_transactional_queue_replacement",
      "0019_queue_visibility_control", "0020_public_snapshot_revision", "0021_explorers_analytics_receipts",
    ]);
    expect(contract.MUSIC_FIXTURE_TRIGGER_FINGERPRINTS).toEqual([
      { table: "music_credential_revocation_operations", name: "music_credential_revocation_history_immutability", enabled: "A", type: 27 },
      { table: "music_identity_lifecycle_operations", name: "music_lifecycle_operation_state", enabled: "O", type: 19 },
      { table: "music_identity_tombstones", name: "music_identity_tombstone_immutability", enabled: "O", type: 19 },
      { table: "music_identity_tombstones", name: "music_identity_tombstone_insert", enabled: "O", type: 7 },
      { table: "music_publication_operation_archive", name: "music_publication_operation_archive_immutability", enabled: "A", type: 27 },
      { table: "music_publication_operations", name: "music_publication_operation_immutability", enabled: "A", type: 31 },
      { table: "music_reactivation_tokens", name: "music_reactivation_token_identity_immutability", enabled: "O", type: 19 },
      { table: "users", name: "users_music_identity_immutability", enabled: "O", type: 19 },
      { table: "users", name: "users_music_identity_insert", enabled: "O", type: 7 },
      { table: "users", name: "users_reject_unauthorized_music_identity_delete", enabled: "O", type: 11 },
      { table: "users", name: "users_retain_music_identity_tombstone", enabled: "O", type: 9 },
    ]);
    expect(Object.isFrozen(contract.MUSIC_FIXTURE_TABLES)).toBe(true);
    expect(Object.isFrozen(contract.MUSIC_FIXTURE_MIGRATION_IDS)).toBe(true);
    expect(Object.isFrozen(contract.MUSIC_FIXTURE_TRIGGER_FINGERPRINTS)).toBe(true);
  });

  it("derives table and migration allowlists from the checked-in runtime manifest", async () => {
    // Production break caught: a second hand-maintained inventory can remain
    // internally consistent while silently drifting from the schema authority.
    const contract = await loadRestoreContract();
    const manifest = JSON.parse(readFileSync(resolve(
      "../fixtures/db/music-runtime-table-manifest.json",
    ), "utf8")) as {
      schemaVersion: string;
      migrationChain: { engine: string; expectedId: string; files: string[]; controlTables: string[] };
      tables: Array<{ name: string }>;
    };
    expect(manifest.schemaVersion).toBe("music-runtime-table-manifest/v1");
    expect(contract.MUSIC_FIXTURE_TABLES).toEqual([
      ...new Set([...manifest.tables.map(({ name }) => name), ...manifest.migrationChain.controlTables]),
    ].sort());
    expect(contract.MUSIC_FIXTURE_MIGRATION_IDS).toEqual([...EXPECTED_MUSIC_MIGRATION_CHAIN]);
    expect(manifest.migrationChain.files).toEqual(EXPECTED_MUSIC_MIGRATION_CHAIN.map((id) => `${id}.sql`));
    const source = readFileSync(resolve("scripts/music-e2e-state-restore.mjs"), "utf8");
    expect(source).toContain("music-runtime-table-manifest.json");
    expect(source).not.toContain("export const MUSIC_FIXTURE_TABLES = Object.freeze([");
    expect(source).not.toContain("export const MUSIC_FIXTURE_MIGRATION_IDS = Object.freeze([");
  });

  it("refuses malformed immutable container authority before allocating restore input", async () => {
    // Production break caught: executing by a mutable name or caller-controlled
    // target could replay the private dump into a non-fixture database.
    const contract = await loadRestoreContract();
    const build = contract.buildMusicFixtureRestoreOperation as (input: {
      containerId: string;
      dataDump: Buffer;
    }) => unknown;
    expect(build).toBeTypeOf("function");
    if (!build) return;
    expect(() => build({ containerId: "explorers-music-fixture-postgres-1", dataDump: Buffer.from("safe") }))
      .toThrow("fixture restore authority is invalid");
    expect(() => build({ containerId: "a".repeat(64), dataDump: Buffer.from("safe") })).not.toThrow();
  });

  it("classifies a failed replay as rolled back only when the pre-attempt hash is unchanged", async () => {
    // Production break caught: a failed child could be reported generically
    // without proving whether the destructive replay committed partial state.
    const contract = await loadRestoreContract();
    const run = contract.runMusicFixtureRestoreTransaction as undefined | ((input: {
      containerId: string;
      dataDump: Buffer;
      snapshotHash: string;
      captureHash: () => string;
      execute: (operation: unknown) => { status: number | null };
    }) => { ok: boolean; stage?: string; code?: string });
    expect(run).toBeTypeOf("function");
    if (!run) return;
    const mutatedHash = "b".repeat(64);
    expect(run({
      containerId: "a".repeat(64),
      dataDump: Buffer.from("SELECT 1;\n"),
      snapshotHash: "c".repeat(64),
      captureHash: () => mutatedHash,
      execute: () => ({ status: 1 }),
    })).toEqual({ ok: false, stage: "database-restore", code: "replay-failed-rolled-back" });

    let captures = 0;
    expect(run({
      containerId: "a".repeat(64),
      dataDump: Buffer.from("SELECT 1;\n"),
      snapshotHash: "c".repeat(64),
      captureHash: () => (++captures === 1 ? mutatedHash : "d".repeat(64)),
      execute: () => ({ status: 1 }),
    })).toEqual({ ok: false, stage: "database-restore", code: "rollback-unverified" });
  });

  it("accepts a restore only when the committed hash equals the stored snapshot", async () => {
    // Production break caught: child exit zero alone cannot prove the replay
    // restored the exact snapshot bytes.
    const contract = await loadRestoreContract();
    const run = contract.runMusicFixtureRestoreTransaction as (input: {
      containerId: string;
      dataDump: Buffer;
      snapshotHash: string;
      captureHash: () => string;
      execute: (operation: unknown) => { status: number | null };
    }) => { ok: boolean; stage?: string; code?: string; beforeHash?: string; afterHash?: string };
    expect(run).toBeTypeOf("function");
    if (!run) return;
    const snapshotHash = "c".repeat(64);
    expect(run({
      containerId: "a".repeat(64), dataDump: Buffer.from("SELECT 1;\n"), snapshotHash,
      captureHash: () => snapshotHash, execute: () => ({ status: 0 }),
    })).toEqual({ ok: true, beforeHash: snapshotHash, afterHash: snapshotHash });
    expect(run({
      containerId: "a".repeat(64), dataDump: Buffer.from("SELECT 1;\n"), snapshotHash,
      captureHash: () => "d".repeat(64), execute: () => ({ status: 0 }),
    })).toEqual({ ok: false, stage: "verification", code: "restore-mismatch" });
  });

  it("binds the live state service to attested immutable authority and the atomic restore helper", () => {
    // Production break caught: the state service retained the old dynamic
    // two-process TRUNCATE+replay even after the safe helper existed.
    const source = readFileSync(resolve("scripts/music-e2e-state-service.mjs"), "utf8");
    expect(source).toContain("attestMusicFixtureRestoreContainer");
    expect(source).toContain("runMusicFixtureRestoreTransaction");
    expect(source).toContain("createMusicMutationGuard");
    expect(source).toContain('"/restore-final"');
    expect(source).not.toContain("SELECT string_agg(format('%I.%I'");
    expect(source).not.toContain('"explorers-music-fixture-postgres-1", ...args');
  });
});
