import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrateMusicDatabase } from "../db/migrate";
import { EXPECTED_MUSIC_MIGRATION_CHAIN } from "../../shared/music-migration-contract";
import {
  attestUatDatabaseAuthority,
  MUSIC_UAT_DATABASE_ACK,
  parseUatDatabaseAuthority,
} from "../../scripts/music-uat-database";
import {
  MUSIC_FIXTURE_DATA_DUMP_MAX_BYTES,
  runMusicFixtureRestoreTransaction,
} from "../../scripts/music-e2e-state-restore.mjs";
import { corruptC11LaterCopyRow } from "./music-e2e-state-restore-test-helper";

const enabled = process.env.MUSIC_C11_STATE_RESTORE_POSTGRES_TEST === "1"
  && process.env.MUSIC_UAT_DATABASE_ACK === MUSIC_UAT_DATABASE_ACK;
const describePg = enabled ? describe.sequential : describe.skip;
const dockerExecutable = process.platform === "win32" ? "docker.exe" : "docker";
const fixtureDatabase = "music_fixture";
let admin: pg.Pool | undefined;
let fixture: pg.Pool | undefined;
let containerId = "";

function databaseUrl(name: string) {
  const target = new URL(process.env.DATABASE_URL_TEST ?? "");
  target.pathname = `/${name}`;
  return target.toString();
}

function docker(args: string[], input?: Buffer) {
  const result = spawnSync(dockerExecutable, args, {
    input, windowsHide: true, maxBuffer: MUSIC_FIXTURE_DATA_DUMP_MAX_BYTES,
  });
  if (result.status !== 0 || !Buffer.isBuffer(result.stdout)) throw new Error("owned restore integration child failed");
  return result.stdout;
}

function dump(dataOnly = false) {
  return docker([
    "exec", "-i", containerId, "pg_dump", "-U", "music_migrator", "-d", fixtureDatabase,
    "--format=plain", ...(dataOnly ? ["--data-only"] : ["--clean", "--if-exists", "--no-owner"]),
  ]);
}

function hash() {
  const normalized = dump().toString("utf8").split(/\r?\n/)
    .filter((line) => !line.startsWith("--") && !line.startsWith("\\restrict") && !line.startsWith("\\unrestrict"))
    .join("\n");
  return createHash("sha256").update(normalized).digest("hex");
}

describePg("owned PostgreSQL transactional Music E2E restore", () => {
  beforeAll(async () => {
    const authority = parseUatDatabaseAuthority(process.env);
    if (!authority) throw new Error("owned restore integration authority is missing");
    attestUatDatabaseAuthority(process.env, authority.commit);
    containerId = authority.containerId;
    admin = new pg.Pool({ connectionString: process.env.DATABASE_URL_TEST, max: 1 });
    await admin.query("CREATE DATABASE music_fixture");
    fixture = new pg.Pool({ connectionString: databaseUrl(fixtureDatabase), max: 1 });
    await migrateMusicDatabase(fixture);
    await fixture.query(`INSERT INTO users(
      username,password,email,guest_url,venue_name,strapi_user_document_id,strapi_account_document_id,
      lifecycle_operation_id,guest_capability_hash
    ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [
      "e2e-public-music-restore-owner", "not-a-login-secret", "restore@example.invalid",
      "e2e-public-music-restore", "Callback fixture", "e2e-public-music-restore-user",
      "e2e-public-music-restore-account", "restore-provision", "a".repeat(64),
    ]);
    await fixture.query("INSERT INTO playlists(user_id,name,is_visible_to_guests) SELECT id,$1,true FROM users WHERE username=$2", [
      "Restore qualification", "e2e-public-music-restore-owner",
    ]);
  });

  afterAll(async () => {
    try { if (fixture) await fixture.end(); }
    finally {
      if (admin) {
        try {
          await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()", [fixtureDatabase]);
          await admin.query("DROP DATABASE music_fixture");
        } finally { await admin.end(); }
      }
    }
  });

  it("restores a populated callback identity to its exact snapshot hash", async () => {
    const baselineData = dump(true);
    const baselineHash = hash();
    await fixture!.query("UPDATE users SET venue_name=$1 WHERE username=$2", [
      "Mutated callback fixture", "e2e-public-music-restore-owner",
    ]);
    expect(hash()).not.toBe(baselineHash);
    const restored = runMusicFixtureRestoreTransaction({
      containerId, dataDump: baselineData, snapshotHash: baselineHash, captureHash: hash,
      execute: (operation) => spawnSync(operation.file, operation.args, {
        input: operation.input, windowsHide: true, maxBuffer: 4 * 1024 * 1024,
      }),
    });
    expect(restored).toEqual({ ok: true, beforeHash: baselineHash, afterHash: baselineHash });
    expect(hash()).toBe(baselineHash);
  });

  it("rolls an injected mid-replay failure back to the pre-attempt mutated hash", async () => {
    const baselineData = dump(true);
    await fixture!.query("UPDATE users SET venue_name=$1 WHERE username=$2", [
      "Pre-attempt mutation", "e2e-public-music-restore-owner",
    ]);
    const preAttemptHash = hash();
    const hostileReplay = corruptC11LaterCopyRow(baselineData, {
      maximumBytes: MUSIC_FIXTURE_DATA_DUMP_MAX_BYTES,
    });
    expect(hostileReplay.earlierRows).toBe(EXPECTED_MUSIC_MIGRATION_CHAIN.length);
    expect(hostileReplay.targetRows).toBe(1);
    expect(hostileReplay.corruptedRow).toBe(1);
    const result = runMusicFixtureRestoreTransaction({
      containerId, dataDump: hostileReplay.dataDump, snapshotHash: "b".repeat(64), captureHash: hash,
      execute: (operation) => spawnSync(operation.file, operation.args, {
        input: operation.input, windowsHide: true, maxBuffer: 4 * 1024 * 1024,
      }),
    });
    expect(result).toEqual({ ok: false, stage: "database-restore", code: "replay-failed-rolled-back" });
    expect(hash()).toBe(preAttemptHash);
  });
});
