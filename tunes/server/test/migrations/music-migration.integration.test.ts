import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { setupMusicFixtureProbeRoute } from "../../routes/musicFixtureProbe";
import { setupMusicHealthRoutes } from "../../deployment/music-health";
import { createGateAttestation, type ImageCandidate } from "../../deployment/music-deployment";
import { MusicIdentityRepository } from "../../repositories/musicIdentityRepository";
import { checkMusicDatabaseReadiness } from "../../db/readiness";
import {
  createMigrationDefinition,
  loadMusicMigrations,
  migrateMusicDatabase,
  verifyMusicDatabase,
} from "../../db/migrate";
import { EXPECTED_MUSIC_MIGRATION_ID } from "../../../shared/music-migration-contract";
import manifest from "../../../../fixtures/db/music-runtime-table-manifest.json";

const exactTarget = "postgresql://music:music@127.0.0.1:55432/music_fixture";
const adminUrl = process.env.DATABASE_URL_TEST ?? exactTarget;
const runIntegration = process.env.MUSIC_C3_POSTGRES_TEST === "1";
const describePostgres = runIntegration ? describe.sequential : describe.skip;
const databases: string[] = [];
let admin: pg.Pool;

function databaseUrl(name: string): string {
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

async function freshDatabase(label: string): Promise<pg.Pool> {
  const name = `music_c3_${label}_${process.pid}_${databases.length}`.replace(/[^a-z0-9_]/g, "_");
  await admin.query(`CREATE DATABASE ${name}`);
  databases.push(name);
  return new pg.Pool({ connectionString: databaseUrl(name), max: 4 });
}

async function expectRejected(pool: pg.Pool, sql: string, values: unknown[] = []): Promise<void> {
  await expect(pool.query(sql, values)).rejects.toThrow();
}

describePostgres("C3 PostgreSQL 15 migration chain", () => {
  beforeAll(async () => {
    expect(adminUrl).toBe(exactTarget);
    admin = new pg.Pool({ connectionString: adminUrl, max: 4 });
    const version = await admin.query<{ server_version: string }>("SHOW server_version");
    expect(version.rows[0].server_version).toMatch(/^15\./);
  });

  afterAll(async () => {
    for (const name of databases.reverse()) {
      await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()", [name]);
      await admin.query(`DROP DATABASE ${name}`);
    }
    await admin.end();
  });

  it("migrates a fresh database, creates all 27 runtime tables, verifies, and repeats as a no-op", async () => {
    const pool = await freshDatabase("baseline");
    const first = await migrateMusicDatabase(pool);
    const second = await migrateMusicDatabase(pool);
    const verified = await verifyMusicDatabase(pool);
    const tables = await pool.query<{ table_name: string }>("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    const present = new Set(tables.rows.map(({ table_name }) => table_name));
    for (const table of manifest.tables) expect(present.has(table.name), table.name).toBe(true);
    expect(first.currentId).toBe(EXPECTED_MUSIC_MIGRATION_ID);
    expect(first.appliedIds).toEqual(["0001_runtime_baseline", "0002_identity_lifecycle"]);
    expect(second.appliedIds).toEqual([]);
    expect(verified.ready).toBe(true);
    await pool.end();
  });

  it("enforces immutable identities, selected Account, lifecycle, owners, and hashed guest capabilities in PostgreSQL", async () => {
    const pool = await freshDatabase("constraints");
    await migrateMusicDatabase(pool);
    const insert = `INSERT INTO users
      (username,password,guest_url,venue_name,strapi_user_document_id,strapi_account_document_id,
       guest_capability_hash,lifecycle_operation_id)
      VALUES ($1,'disabled-native-password',$2,'Venue',$3,$4,$5,$6) RETURNING id`;
    const hash = "a".repeat(64);
    const user = await pool.query<{ id: number }>(insert, ["snapshot", "public-slug", "person-1", "account-1", hash, "operation-1"]);
    const id = user.rows[0].id;
    await expectRejected(pool, insert, ["other", "other-slug", "person-1", "account-2", "b".repeat(64), "operation-2"]);
    await expectRejected(pool, insert, ["same-account", "same-account-slug", "person-2", "account-1", "c".repeat(64), "operation-3"]);
    await expectRejected(pool, "UPDATE users SET strapi_user_document_id='person-2' WHERE id=$1", [id]);
    await expectRejected(pool, "UPDATE users SET strapi_account_document_id='account-2' WHERE id=$1", [id]);
    await expectRejected(pool, "UPDATE users SET identity_status='invalid' WHERE id=$1", [id]);
    await expectRejected(pool, "UPDATE users SET session_version=0 WHERE id=$1", [id]);
    await expectRejected(pool, "INSERT INTO playlists(user_id,name) VALUES (999999,'orphan')");
    await expectRejected(pool, insert, ["plaintext", "plaintext-slug", "person-3", "account-3", "plaintext-capability", "operation-3"]);
    await expectRejected(pool, insert, ["duplicate-hash", "dup-slug", "person-4", "account-4", hash, "operation-4"]);
    await pool.query("UPDATE users SET identity_status='pending_deletion' WHERE id=$1", [id]);
    await expectRejected(pool, "UPDATE users SET identity_status='active' WHERE id=$1", [id]);
    await pool.query("UPDATE users SET identity_status='suspended' WHERE id=$1", [id]);
    await pool.end();
  });

  it("keeps tombstones independent of deleted user rows and never adopts by username/email", async () => {
    const pool = await freshDatabase("tombstone");
    await migrateMusicDatabase(pool);
    const repository = new MusicIdentityRepository(pool);
    await pool.query("INSERT INTO music_identity_tombstones(strapi_user_document_id,strapi_account_document_id,reason,lifecycle_operation_id) VALUES ('person-deleted','account-deleted','upstream-deleted','delete-op')");
    expect(await repository.isTombstoned("person-deleted")).toBe(true);
    await expect(repository.assertCanCreate("person-deleted", "account-deleted")).rejects.toThrow("tombstoned");
    expect(await repository.findByExternalIdentity("person-missing")).toBeUndefined();
    expect(Object.getOwnPropertyNames(MusicIdentityRepository.prototype)).not.toEqual(expect.arrayContaining(["findByUsername", "findByEmail"]));
    await pool.end();
  });

  it("serializes concurrent migrators and rolls a deliberately failing migration back atomically", async () => {
    const pool = await freshDatabase("concurrency");
    const secondPool = new pg.Pool({ connectionString: (pool as unknown as { options: { connectionString: string } }).options.connectionString, max: 2 });
    const [left, right] = await Promise.all([migrateMusicDatabase(pool), migrateMusicDatabase(secondPool)]);
    expect([...left.appliedIds, ...right.appliedIds].sort()).toEqual(["0001_runtime_baseline", "0002_identity_lifecycle"]);
    const failure = createMigrationDefinition("0003_deliberate_failure", "CREATE TABLE must_rollback(id integer); SELECT missing_function();");
    await expect(migrateMusicDatabase(pool, { migrations: [...loadMusicMigrations(), failure] })).rejects.toThrow();
    expect((await pool.query("SELECT to_regclass('public.must_rollback') AS value")).rows[0].value).toBeNull();
    expect((await pool.query("SELECT count(*)::int AS count FROM music_schema_migrations WHERE id='0003_deliberate_failure'")).rows[0].count).toBe(0);
    await secondPool.end();
    await pool.end();
  });

  it("fails closed on checksum changes, catalog drift, missing/future migrations, and unversioned application tables", async () => {
    const pool = await freshDatabase("tamper");
    await migrateMusicDatabase(pool);
    const chain = loadMusicMigrations();
    await expect(migrateMusicDatabase(pool, { migrations: [createMigrationDefinition(chain[0].id, `${chain[0].sql}\n-- tampered`), chain[1]] })).rejects.toThrow("checksum");
    await pool.query("ALTER TABLE users ADD COLUMN unreviewed_drift text");
    await expect(verifyMusicDatabase(pool)).rejects.toThrow("drift");
    await pool.end();

    const existing = await freshDatabase("unversioned");
    await existing.query("CREATE TABLE users(id integer primary key, username text, email text)");
    await existing.query("INSERT INTO users VALUES (1,'legacy-name','legacy@example.test')");
    await expect(migrateMusicDatabase(existing)).rejects.toThrow("unversioned application tables");
    expect((await existing.query("SELECT to_regclass('public.music_schema_migrations') AS value")).rows[0].value).toBeNull();
    await existing.end();

    const future = await freshDatabase("future");
    await migrateMusicDatabase(future);
    await future.query("INSERT INTO music_schema_migrations(id,checksum,schema_checksum) VALUES ('9999_future',$1,$1)", ["f".repeat(64)]);
    await expect(migrateMusicDatabase(future)).rejects.toThrow("unknown future migration");
    await expect(migrateMusicDatabase(future, { migrations: loadMusicMigrations().slice(1) })).rejects.toThrow("missing migration");
    await future.end();
  });

  it("keeps readiness closed before migration and opens only for the exact journal/checksum state", async () => {
    const pool = await freshDatabase("readiness");
    expect(await checkMusicDatabaseReadiness(pool)).toMatchObject({ ready: false });
    await migrateMusicDatabase(pool);
    expect(await checkMusicDatabaseReadiness(pool)).toMatchObject({ ready: true, currentId: EXPECTED_MUSIC_MIGRATION_ID });
    await pool.query("UPDATE music_schema_migrations SET checksum=$1 WHERE id=$2", ["0".repeat(64), EXPECTED_MUSIC_MIGRATION_ID]);
    expect(await checkMusicDatabaseReadiness(pool)).toMatchObject({ ready: false, reason: "migration-state-invalid" });
    await pool.end();
  });

  it("smokes every runtime family plus the real fixture/readiness routes on the migrated database", async () => {
    const pool = await freshDatabase("families");
    await migrateMusicDatabase(pool);
    const families = new Set<string>();
    for (const table of manifest.tables) {
      await pool.query(`SELECT count(*) FROM ${table.name}`);
      families.add(table.family);
    }
    expect(families).toEqual(new Set(["security-audit", "analytics", "pii", "user-content"]));

    const app = express();
    setupMusicFixtureProbeRoute(app, {
      mode: "fixture",
      databaseQuery: (sql) => pool.query(sql) as never,
      migrationReadiness: () => checkMusicDatabaseReadiness(pool),
      strapiUrl: "http://fixture",
      fetchImpl: (async (url: string | URL) => new Response(JSON.stringify(String(url).endsWith("/health")
        ? { status: "ready" }
        : { documentId: "person-1", accounts: [{ documentId: "account-1" }] }), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch,
    });
    const image: ImageCandidate = { digest: `sha256:${"a".repeat(64)}`, commit: "a".repeat(40), migrationMarker: EXPECTED_MUSIC_MIGRATION_ID };
    const key = "migration-attestation-test-key-long-enough";
    setupMusicHealthRoutes(app, {
      pool,
      env: {
        MUSIC_IMAGE_DIGEST: image.digest,
        MUSIC_IMAGE_COMMIT: image.commit,
        MUSIC_MIGRATION_MARKER: image.migrationMarker,
        MUSIC_GATE_ATTESTATION_KEY: key,
        MUSIC_GATE_ATTESTATION_JSON: JSON.stringify(createGateAttestation(image, key, (await verifyMusicDatabase(pool)).currentChecksum)),
        SESSION_SECRET: "s".repeat(32), COOKIE_SECRET: "c".repeat(32), STRAPI_ACCESS_TOKEN: "t".repeat(32), STRAPI_JWT_SECRET: "j".repeat(32),
        STRAPI_URL: "https://cms.example.test", MUSIC_NEW_ENTRY_KILL_SWITCH: "true", MUSIC_COHORT_ENABLED: "false",
      },
    });
    await request(app).get("/api/music-fixture/readiness").expect(200);
    await request(app).get("/health/ready").expect(200);
    await pool.end();
  });
});
