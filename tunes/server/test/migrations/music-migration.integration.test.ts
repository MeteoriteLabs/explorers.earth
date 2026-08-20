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

const adminUrl = process.env.DATABASE_URL_TEST ?? "postgresql://music_migrator:music@127.0.0.1:55432/music_fixture";
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
    const exactTarget = new URL(adminUrl);
    expect({ protocol: exactTarget.protocol, hostname: exactTarget.hostname, port: exactTarget.port,
      pathname: exactTarget.pathname, username: exactTarget.username }).toEqual({
      protocol: "postgresql:", hostname: "127.0.0.1", port: "55432",
      pathname: "/music_fixture", username: "music_migrator",
    });
    expect(exactTarget.password).not.toBe("");
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

  it("migrates a fresh database, creates all 27 manifested runtime tables and controls, verifies, and repeats as a no-op", async () => {
    const pool = await freshDatabase("baseline");
    const first = await migrateMusicDatabase(pool);
    const second = await migrateMusicDatabase(pool);
    const verified = await verifyMusicDatabase(pool);
    const tables = await pool.query<{ table_name: string }>("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    const present = new Set(tables.rows.map(({ table_name }) => table_name));
    for (const table of manifest.tables) expect(present.has(table.name), table.name).toBe(true);
    expect(first.currentId).toBe(EXPECTED_MUSIC_MIGRATION_ID);
    expect(first.appliedIds).toEqual(["0001_runtime_baseline", "0002_identity_lifecycle", "0003_identity_lifecycle_hardening", "0004_identity_delete_saga", "0005_resource_bound_deletion_history", "0006_numeric_identity_lock", "0007_identity_provider_snapshot", "0008_credential_revocation_operations", "0009_credential_revocation_history_immutability", "0010_least_privilege_runtime_role", "0011_durable_publication_idempotency"]);
    expect(second.appliedIds).toEqual([]);
    expect(verified.ready).toBe(true);
    await pool.end();
  });

  it("upgrades a populated committed 0002 database through appended 0003 without rewriting history", async () => {
    const pool = await freshDatabase("upgrade_from_0002");
    const chain = loadMusicMigrations();
    await migrateMusicDatabase(pool, {
      migrations: chain.slice(0, 2),
      testOnlyExpectedIds: ["0001_runtime_baseline", "0002_identity_lifecycle"],
    });
    await pool.query(`INSERT INTO users
      (username,password,guest_url,venue_name,strapi_user_document_id,strapi_account_document_id,
       guest_capability_hash,lifecycle_operation_id)
      VALUES ('pre-hardening','disabled','pre-hardening-slug','Venue','pre-hardening-person','pre-hardening-account',$1,'pre-hardening-operation')`, ["b".repeat(64)]);
    const original0002 = (await pool.query("SELECT checksum FROM music_schema_migrations WHERE id='0002_identity_lifecycle'")).rows[0].checksum;
    await migrateMusicDatabase(pool);
    expect((await pool.query("SELECT checksum FROM music_schema_migrations WHERE id='0002_identity_lifecycle'")).rows[0].checksum).toBe(original0002);
    expect((await pool.query("SELECT operation_kind,operation_state FROM music_identity_lifecycle_operations WHERE operation_id='pre-hardening-operation'")).rows[0])
      .toEqual({ operation_kind: "provision", operation_state: "completed" });
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
    await expectRejected(pool, "UPDATE users SET identity_status='pending_deletion' WHERE id=$1", [id]);
    await expectRejected(pool, "UPDATE users SET identity_status='suspended' WHERE id=$1", [id]);
    await pool.end();
  });

  it("keeps tombstones independent of deleted user rows and never adopts by username/email", async () => {
    const pool = await freshDatabase("tombstone");
    await migrateMusicDatabase(pool);
    const repository = new MusicIdentityRepository(pool);
    await pool.query("INSERT INTO music_identity_tombstones(strapi_user_document_id,strapi_account_document_id,reason,lifecycle_operation_id) VALUES ('person-deleted','account-deleted','upstream-deleted','delete-op')");
    expect(await repository.isTombstoned("person-deleted")).toBe(true);
    await expect(repository.createIdentity({
      username: "recreated",
      password: "disabled-native-password",
      guestUrl: "recreated-slug",
      venueName: "Venue",
      strapiUserDocumentId: "person-deleted",
      strapiAccountDocumentId: "account-deleted",
      guestCapabilityHash: "d".repeat(64),
      operationId: "recreate-op",
    })).rejects.toThrow(/tombstoned/i);
    expect(await repository.findByExternalIdentity("person-missing")).toBeUndefined();
    expect(Object.getOwnPropertyNames(MusicIdentityRepository.prototype)).not.toEqual(expect.arrayContaining(["findByUsername", "findByEmail", "assertCanCreate"]));
    await pool.end();
  });

  it("atomically prevents recreation by either immutable user or Account ID, including direct SQL", async () => {
    const pool = await freshDatabase("atomic_identity");
    await migrateMusicDatabase(pool);
    const insertUser = `INSERT INTO users
      (username,password,guest_url,venue_name,strapi_user_document_id,strapi_account_document_id,
       guest_capability_hash,lifecycle_operation_id)
      VALUES ($1,'disabled-native-password',$2,'Venue',$3,$4,$5,$6)`;
    await pool.query(`INSERT INTO music_identity_tombstones
      (strapi_user_document_id,strapi_account_document_id,reason,lifecycle_operation_id)
      VALUES ('person-deleted','account-deleted','upstream-deleted','delete-direct')`);
    await expectRejected(pool, insertUser, ["same-user", "same-user-slug", "person-deleted", "other-account", "1".repeat(64), "create-same-user"]);
    await expectRejected(pool, insertUser, ["same-account", "same-account-slug", "other-person", "account-deleted", "2".repeat(64), "create-same-account"]);

    const repository = new MusicIdentityRepository(pool);
    await repository.createIdentity({
      username: "live",
      password: "disabled-native-password",
      guestUrl: "live-slug",
      venueName: "Venue",
      strapiUserDocumentId: "person-live",
      strapiAccountDocumentId: "account-live",
      guestCapabilityHash: "3".repeat(64),
      operationId: "provision-live",
    });
    await repository.tombstoneIdentity({
      strapiUserDocumentId: "person-live",
      strapiAccountDocumentId: "account-live",
      reason: "upstream-deleted",
      operationId: "delete-live",
    });
    expect(await repository.findByExternalIdentity("person-live")).toBeUndefined();
    expect(await repository.isTombstoned("person-live")).toBe(true);
    await expect(repository.createIdentity({
      username: "recreated-live",
      password: "disabled-native-password",
      guestUrl: "recreated-live-slug",
      venueName: "Venue",
      strapiUserDocumentId: "person-live",
      strapiAccountDocumentId: "account-live",
      guestCapabilityHash: "4".repeat(64),
      operationId: "recreate-live",
    })).rejects.toThrow(/tombstoned/i);

    await pool.query(insertUser, ["direct-delete", "direct-delete-slug", "person-direct-delete", "account-direct-delete", "e".repeat(64), "provision-direct-delete"]);
    await expectRejected(pool, "DELETE FROM users WHERE strapi_user_document_id='person-direct-delete'");
    expect((await pool.query("SELECT count(*)::int AS count FROM users WHERE strapi_user_document_id='person-direct-delete'")).rows[0].count).toBe(1);
    await repository.tombstoneIdentity({
      strapiUserDocumentId: "person-direct-delete", strapiAccountDocumentId: "account-direct-delete",
      reason: "upstream-deleted", operationId: "delete-direct-safe",
    });
    expect((await pool.query("SELECT strapi_account_document_id FROM music_identity_tombstones WHERE strapi_user_document_id='person-direct-delete'")).rows[0])
      .toEqual({ strapi_account_document_id: "account-direct-delete" });
    await expectRejected(pool, insertUser, ["direct-recreate-user", "direct-recreate-user-slug", "person-direct-delete", "account-other", "f".repeat(64), "recreate-direct-user"]);
    await expectRejected(pool, insertUser, ["direct-recreate-account", "direct-recreate-account-slug", "person-other", "account-direct-delete", "0".repeat(64), "recreate-direct-account"]);
    await pool.end();
  });

  it("serializes concurrent direct create-vs-tombstone in both lock-queue orderings", async () => {
    const pool = await freshDatabase("identity_races");
    await migrateMusicDatabase(pool);
    const insertUser = `INSERT INTO users
      (username,password,guest_url,venue_name,strapi_user_document_id,strapi_account_document_id,
       guest_capability_hash,lifecycle_operation_id)
      VALUES ($1,'disabled-native-password',$2,'Venue',$3,$4,$5,$6)`;
    const insertTombstone = `INSERT INTO music_identity_tombstones
      (strapi_user_document_id,strapi_account_document_id,reason,lifecycle_operation_id)
      VALUES ($1,$2,'upstream-deleted',$3)`;
    async function waitForWaiters(expected: number): Promise<void> {
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const waiting = await pool.query<{ count: number }>(`SELECT count(*)::int AS count FROM pg_locks
          WHERE locktype='advisory' AND NOT granted AND database=(SELECT oid FROM pg_database WHERE datname=current_database())`);
        if (waiting.rows[0].count >= expected) return;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      throw new Error(`timed out waiting for ${expected} advisory lock waiters`);
    }
    for (const first of ["create", "tombstone"] as const) {
      const suffix = first;
      const userDocumentId = `person-race-${suffix}`;
      const accountDocumentId = `account-race-${suffix}`;
      const blocker = await pool.connect();
      await blocker.query("BEGIN");
      await blocker.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`music:user:${userDocumentId}`]);
      await blocker.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`music:account:${accountDocumentId}`]);
      const create = () => pool.query(insertUser, [
        `race-${suffix}`, `race-slug-${suffix}`, userDocumentId, accountDocumentId,
        (first === "create" ? "6" : "7").repeat(64), `provision-race-${suffix}`,
      ]);
      const tombstone = () => pool.query(insertTombstone, [userDocumentId, accountDocumentId, `delete-race-${suffix}`]);
      const firstPromise = first === "create" ? create() : tombstone();
      await waitForWaiters(1);
      const secondPromise = first === "create" ? tombstone() : create();
      await waitForWaiters(2);
      await blocker.query("COMMIT");
      blocker.release();
      const [firstResult, secondResult] = await Promise.allSettled([firstPromise, secondPromise]);
      expect(firstResult.status).toBe("fulfilled");
      expect(secondResult.status).toBe("rejected");
      const state = await pool.query<{ live: number; tombstone: number }>(`SELECT
        (SELECT count(*)::int FROM users WHERE strapi_user_document_id=$1) AS live,
        (SELECT count(*)::int FROM music_identity_tombstones WHERE strapi_user_document_id=$1) AS tombstone`, [userDocumentId]);
      expect(state.rows[0]).toEqual(first === "create" ? { live: 1, tombstone: 0 } : { live: 0, tombstone: 1 });
    }
    await pool.end();
  });

  it("enforces lifecycle edge/session rules and operation replay at the repository boundary", async () => {
    const pool = await freshDatabase("lifecycle_edges");
    await migrateMusicDatabase(pool);
    const repository = new MusicIdentityRepository(pool);
    await repository.createIdentity({
      username: "lifecycle",
      password: "disabled-native-password",
      guestUrl: "lifecycle-slug",
      venueName: "Venue",
      strapiUserDocumentId: "person-lifecycle",
      strapiAccountDocumentId: "account-lifecycle",
      guestCapabilityHash: "5".repeat(64),
      operationId: "provision-lifecycle",
    });
    const suspended = await repository.transitionIdentity({
      strapiUserDocumentId: "person-lifecycle", operationId: "suspend-1", kind: "suspend", targetStatus: "suspended",
    });
    expect(suspended).toMatchObject({ identityStatus: "suspended", sessionVersion: 2 });
    const replay = await repository.transitionIdentity({
      strapiUserDocumentId: "person-lifecycle", operationId: "suspend-1", kind: "suspend", targetStatus: "suspended",
    });
    expect(replay).toEqual(suspended);
    await expect(repository.transitionIdentity({
      strapiUserDocumentId: "person-lifecycle", operationId: "suspend-1", kind: "reactivate", targetStatus: "active",
    })).rejects.toThrow(/operation.*mismatch/i);
    await repository.transitionIdentity({
      strapiUserDocumentId: "person-lifecycle", operationId: "reactivate-1", kind: "reactivate", targetStatus: "active",
    });
    await expect(repository.transitionIdentity({
      strapiUserDocumentId: "person-lifecycle", operationId: "suspend-1", kind: "suspend", targetStatus: "suspended",
    })).rejects.toMatchObject({ code: "STALE_LIFECYCLE_OPERATION" });
    const pending = await repository.transitionIdentity({
      strapiUserDocumentId: "person-lifecycle", operationId: "delete-1", kind: "request_deletion", targetStatus: "pending_deletion",
    });
    expect(pending.sessionVersion).toBe(4);
    await expect(repository.transitionIdentity({
      strapiUserDocumentId: "person-lifecycle", operationId: "bypass", kind: "reactivate", targetStatus: "active",
    })).rejects.toThrow(/invalid identity lifecycle transition/i);
    await repository.transitionIdentity({
      strapiUserDocumentId: "person-lifecycle", operationId: "cancel-1", kind: "cancel_deletion", targetStatus: "suspended",
    });
    await repository.transitionIdentity({
      strapiUserDocumentId: "person-lifecycle", operationId: "reactivate-2", kind: "reactivate", targetStatus: "active",
    });
    await repository.transitionIdentity({
      strapiUserDocumentId: "person-lifecycle", operationId: "delete-again", kind: "request_deletion", targetStatus: "pending_deletion",
    });
    await repository.transitionIdentity({
      strapiUserDocumentId: "person-lifecycle", operationId: "cancel-again", kind: "cancel_deletion", targetStatus: "suspended",
    });
    await repository.transitionIdentity({
      strapiUserDocumentId: "person-lifecycle", operationId: "reactivate-again", kind: "reactivate", targetStatus: "active",
    });
    await repository.createIdentity({
      username: "delete-from-suspended",
      password: "disabled-native-password",
      guestUrl: "delete-from-suspended-slug",
      venueName: "Venue",
      strapiUserDocumentId: "person-delete-from-suspended",
      strapiAccountDocumentId: "account-delete-from-suspended",
      guestCapabilityHash: "8".repeat(64),
      operationId: "provision-delete-from-suspended",
    });
    await repository.transitionIdentity({
      strapiUserDocumentId: "person-delete-from-suspended", operationId: "suspend-2", kind: "suspend", targetStatus: "suspended",
    });
    const deletedFromSuspended = await repository.transitionIdentity({
      strapiUserDocumentId: "person-delete-from-suspended", operationId: "delete-2", kind: "request_deletion", targetStatus: "pending_deletion",
    });
    expect(deletedFromSuspended.sessionVersion).toBe(3);
    const finalize = {
      strapiUserDocumentId: "person-delete-from-suspended", strapiAccountDocumentId: "account-delete-from-suspended",
      reason: "upstream-deleted", operationId: "delete-2",
    };
    await repository.tombstoneIdentity(finalize);
    await expect(repository.tombstoneIdentity(finalize)).resolves.toBeUndefined();
    expect((await pool.query(`SELECT t.lifecycle_operation_id,t.music_user_id,o.music_user_id AS operation_music_user_id
      FROM music_identity_tombstones t
      JOIN music_identity_lifecycle_operations o ON o.operation_id=t.lifecycle_operation_id
      WHERE t.strapi_user_document_id=$1`, [finalize.strapiUserDocumentId])).rows[0])
      .toEqual({ lifecycle_operation_id: "delete-2", music_user_id: deletedFromSuspended.id, operation_music_user_id: deletedFromSuspended.id });
    await expectRejected(pool, `INSERT INTO users
      (id,username,password,guest_url,venue_name,strapi_user_document_id,strapi_account_document_id,
       guest_capability_hash,lifecycle_operation_id)
      VALUES ($1,'numeric-reuse','disabled','numeric-reuse-slug','Venue','person-numeric-reuse',
        'account-numeric-reuse',$2,'provision-numeric-reuse')`, [deletedFromSuspended.id, "7".repeat(64)]);
    expect((await pool.query("SELECT count(*)::int AS count FROM music_identity_lifecycle_operations WHERE operation_id='provision-numeric-reuse'")).rows[0].count).toBe(0);
    await expectRejected(pool, "UPDATE music_identity_tombstones SET music_user_id=music_user_id+1 WHERE lifecycle_operation_id='delete-2'");
    await expectRejected(pool, "UPDATE music_identity_lifecycle_operations SET music_user_id=music_user_id+1 WHERE operation_id='delete-2'");
    expect((await pool.query(`SELECT count(*)::int AS count FROM pg_constraint
      WHERE contype='f' AND conrelid IN ('music_identity_tombstones'::regclass,'music_identity_lifecycle_operations'::regclass)
        AND confrelid='users'::regclass`)).rows[0].count).toBe(0);
    expect((await pool.query("SELECT seqcycle FROM pg_sequence WHERE seqrelid='users_id_seq'::regclass")).rows[0].seqcycle).toBe(false);
    expect((await pool.query("SELECT operation_id FROM music_identity_lifecycle_operations WHERE strapi_user_document_id='person-lifecycle' ORDER BY created_at,operation_id")).rows.map((row) => row.operation_id))
      .toEqual(expect.arrayContaining(["provision-lifecycle", "suspend-1", "reactivate-1", "delete-1", "cancel-1", "reactivate-2", "delete-again", "cancel-again", "reactivate-again"]));
    await expectRejected(pool, "UPDATE users SET identity_status='suspended' WHERE strapi_user_document_id='person-lifecycle'");
    await expectRejected(pool, "UPDATE users SET identity_status='pending_deletion' WHERE strapi_user_document_id='person-lifecycle'");
    await pool.end();
  });

  it("uses one advisory-before-row delete primitive without deadlock in create/delete and tombstone/delete orderings", async () => {
    const pool = await freshDatabase("delete_lock_order");
    await migrateMusicDatabase(pool);
    const repository = new MusicIdentityRepository(pool);
    async function seed(suffix: string): Promise<number> {
      const created = await repository.createIdentity({
        username: `lock-${suffix}`, password: "disabled", guestUrl: `lock-${suffix}-slug`, venueName: "Venue",
        strapiUserDocumentId: `person-lock-${suffix}`, strapiAccountDocumentId: `account-lock-${suffix}`,
        guestCapabilityHash: (suffix.charCodeAt(0) % 10).toString().repeat(64), operationId: `provision-lock-${suffix}`,
      });
      return created.id;
    }
    async function waitForWaiters(expected: number): Promise<void> {
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const waiting = await pool.query<{ count: number }>(`SELECT count(*)::int AS count FROM pg_locks
          WHERE locktype='advisory' AND NOT granted AND database=(SELECT oid FROM pg_database WHERE datname=current_database())`);
        if (waiting.rows[0].count >= expected) return;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      throw new Error("timed out waiting for identity advisory lock queue");
    }
    for (const family of ["create", "tombstone"] as const) {
      for (const first of [family, "delete"] as const) {
        const suffix = `${family}-${first}`;
        const userId = await seed(suffix);
        const userDocumentId = `person-lock-${suffix}`;
        const accountDocumentId = `account-lock-${suffix}`;
        const blocker = await pool.connect();
        await blocker.query("BEGIN");
        await blocker.query("SELECT lock_music_identity_pair($1,$2)", [userDocumentId, accountDocumentId]);
        const competitor = family === "create"
          ? () => repository.createIdentity({
            username: `duplicate-${suffix}`, password: "disabled", guestUrl: `duplicate-${suffix}-slug`, venueName: "Venue",
            strapiUserDocumentId: userDocumentId, strapiAccountDocumentId: accountDocumentId,
            guestCapabilityHash: "9".repeat(64), operationId: `duplicate-${suffix}`,
          })
          : () => pool.query(`INSERT INTO music_identity_tombstones
            (strapi_user_document_id,strapi_account_document_id,reason,lifecycle_operation_id)
            VALUES ($1,$2,'direct-race',$3)`, [userDocumentId, accountDocumentId, `direct-tombstone-${suffix}`]);
        const deletion = () => pool.query("SELECT finalize_music_identity_deletion($1,$2,$3)", [userId, `delete-${suffix}`, "race-delete"]);
        const firstPromise = first === "delete" ? deletion() : competitor();
        await waitForWaiters(1);
        const secondPromise = first === "delete" ? competitor() : deletion();
        await waitForWaiters(2);
        await blocker.query("COMMIT");
        blocker.release();
        const settled = await Promise.race([
          Promise.allSettled([firstPromise, secondPromise]),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("delete lock-order deadlock")), 5_000)),
        ]);
        expect(settled.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
        expect((await pool.query(`SELECT
          (SELECT count(*)::int FROM users WHERE id=$1) AS live,
          (SELECT count(*)::int FROM music_identity_tombstones WHERE strapi_user_document_id=$2) AS tombstone`, [userId,userDocumentId])).rows[0])
          .toEqual({ live: 0, tombstone: 1 });
      }
    }
    await pool.end();
  }, 30_000);

  it("serializes numeric user IDs across authorized deletion, explicit inserts, and sequence reset", async () => {
    const pool = await freshDatabase("numeric_id_lock");
    await migrateMusicDatabase(pool);
    const repository = new MusicIdentityRepository(pool);
    const original = await repository.createIdentity({
      username: "numeric-lock-old", password: "disabled", guestUrl: "numeric-lock-old-slug", venueName: "Venue",
      strapiUserDocumentId: "person-numeric-lock-old", strapiAccountDocumentId: "account-numeric-lock-old",
      guestCapabilityHash: "6".repeat(64), operationId: "provision-numeric-lock-old",
    });

    // Delete-first: the delete has removed the old row but has not committed.
    // A different external identity using the same numeric ID must wait on the
    // numeric advisory key, then observe the committed tombstone and lose.
    const deleting = await pool.connect();
    await deleting.query("BEGIN");
    await deleting.query("SELECT finalize_music_identity_deletion($1,$2,$3)", [original.id, "delete-numeric-lock-old", "numeric-race"]);
    const reuse = pool.query(`INSERT INTO users
      (id,username,password,guest_url,venue_name,strapi_user_document_id,strapi_account_document_id,
       guest_capability_hash,lifecycle_operation_id)
      VALUES ($1,'numeric-lock-reuse','disabled','numeric-lock-reuse-slug','Venue',
        'person-numeric-lock-new','account-numeric-lock-new',$2,'provision-numeric-lock-new')`, [original.id, "7".repeat(64)]);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const numericLockWaiters = (await pool.query<{ count: number }>(`SELECT count(*)::int AS count FROM pg_locks
      WHERE locktype='advisory' AND NOT granted AND database=(SELECT oid FROM pg_database WHERE datname=current_database())`)).rows[0].count;
    await deleting.query("COMMIT");
    deleting.release();
    const reuseResult = await reuse.then(() => ({ accepted: true, message: "" }), (error: Error) => ({ accepted: false, message: error.message }));
    expect(numericLockWaiters).toBeGreaterThanOrEqual(1);
    expect(reuseResult).toMatchObject({ accepted: false });
    expect(reuseResult.message).toMatch(/retired|tombstone/i);
    expect((await pool.query(`SELECT
      (SELECT count(*)::int FROM users WHERE id=$1) AS live,
      (SELECT count(*)::int FROM music_identity_tombstones WHERE music_user_id=$1) AS tombstone`, [original.id])).rows[0])
      .toEqual({ live: 0, tombstone: 1 });

    // Insert-first for an unused explicit ID is a normal live identity. It
    // stays live until a later authorized deletion; PostgreSQL's PK means an
    // insert cannot "win" first against an already-existing numeric ID.
    const explicitId = original.id + 50_000;
    const inserting = await pool.connect();
    await inserting.query("BEGIN");
    await inserting.query(`INSERT INTO users
      (id,username,password,guest_url,venue_name,strapi_user_document_id,strapi_account_document_id,
       guest_capability_hash,lifecycle_operation_id)
      VALUES ($1,'numeric-lock-first','disabled','numeric-lock-first-slug','Venue',
        'person-numeric-lock-first','account-numeric-lock-first',$2,'provision-numeric-lock-first')`, [explicitId, "8".repeat(64)]);
    // A delete that cannot yet observe the uncommitted identity must not
    // speculate or create history for it.
    await expect(pool.query("SELECT finalize_music_identity_deletion($1,$2,$3)", [explicitId, "premature-delete-numeric-lock-first", "numeric-race"]))
      .rejects.toThrow(/resource-bound deletion history not found/i);
    await inserting.query("COMMIT");
    inserting.release();
    expect((await pool.query("SELECT count(*)::int AS count FROM users WHERE id=$1", [explicitId])).rows[0].count).toBe(1);
    await pool.query("SELECT finalize_music_identity_deletion($1,$2,$3)", [explicitId, "delete-numeric-lock-first", "numeric-race"]);
    expect((await pool.query("SELECT count(*)::int AS count FROM users WHERE id=$1", [explicitId])).rows[0].count).toBe(0);

    // Resetting the sequence cannot bypass the same retired numeric-ID check.
    await pool.query("SELECT setval('users_id_seq',$1,false)", [explicitId]);
    await expect(pool.query(`INSERT INTO users
      (username,password,guest_url,venue_name,strapi_user_document_id,strapi_account_document_id,
       guest_capability_hash,lifecycle_operation_id)
      VALUES ('numeric-lock-sequence','disabled','numeric-lock-sequence-slug','Venue',
        'person-numeric-lock-sequence','account-numeric-lock-sequence',$1,'provision-numeric-lock-sequence')`, ["9".repeat(64)]))
      .rejects.toThrow(/retired|tombstone/i);
    await pool.end();
  }, 30_000);

  it("enforces the complete lifecycle operation-state edge matrix", async () => {
    const pool = await freshDatabase("operation_edges");
    await migrateMusicDatabase(pool);
    const states = ["requested", "running", "completed", "failed", "cancelled"] as const;
    const allowed = new Set([
      "requested:running", "requested:failed", "requested:cancelled",
      "running:completed", "running:failed", "running:cancelled",
      "failed:requested",
    ]);
    for (const from of states) {
      for (const to of states) {
        if (from === to) continue;
        const operationId = `matrix-${from}-${to}`;
        await pool.query(`INSERT INTO music_identity_lifecycle_operations(
          operation_id,strapi_user_document_id,strapi_account_document_id,operation_kind,
          requested_identity_status,operation_state,attempt_count
        ) VALUES ($1,$2,$3,'suspend','suspended',$4,$5)`, [
          operationId,`person-${operationId}`,`account-${operationId}`,from,from === "running" ? 1 : 0,
        ]);
        const nextAttempt = (from === "requested" && to === "running") || (from === "failed" && to === "requested") ? 1 : (from === "running" ? 1 : 0);
        const update = pool.query("UPDATE music_identity_lifecycle_operations SET operation_state=$2,attempt_count=$3 WHERE operation_id=$1", [operationId,to,nextAttempt]);
        if (allowed.has(`${from}:${to}`)) await expect(update).resolves.toMatchObject({ rowCount: 1 });
        else await expect(update).rejects.toThrow(/invalid lifecycle operation transition/i);
      }
    }
    await pool.end();
  });

  it("serializes concurrent migrators and rolls a deliberately failing migration back atomically", async () => {
    const pool = await freshDatabase("concurrency");
    const secondPool = new pg.Pool({ connectionString: (pool as unknown as { options: { connectionString: string } }).options.connectionString, max: 2 });
    const [left, right] = await Promise.all([migrateMusicDatabase(pool), migrateMusicDatabase(secondPool)]);
    expect([...left.appliedIds, ...right.appliedIds].sort()).toEqual(["0001_runtime_baseline", "0002_identity_lifecycle", "0003_identity_lifecycle_hardening", "0004_identity_delete_saga", "0005_resource_bound_deletion_history", "0006_numeric_identity_lock", "0007_identity_provider_snapshot", "0008_credential_revocation_operations", "0009_credential_revocation_history_immutability", "0010_least_privilege_runtime_role", "0011_durable_publication_idempotency"]);
    const failure = createMigrationDefinition("0012_deliberate_failure", "CREATE TABLE must_rollback(id integer); SELECT missing_function();");
    await expect(migrateMusicDatabase(pool, {
      migrations: [...loadMusicMigrations(), failure],
      testOnlyExpectedIds: ["0001_runtime_baseline", "0002_identity_lifecycle", "0003_identity_lifecycle_hardening", "0004_identity_delete_saga", "0005_resource_bound_deletion_history", "0006_numeric_identity_lock", "0007_identity_provider_snapshot", "0008_credential_revocation_operations", "0009_credential_revocation_history_immutability", "0010_least_privilege_runtime_role", "0011_durable_publication_idempotency", "0012_deliberate_failure"],
    })).rejects.toThrow();
    expect((await pool.query("SELECT to_regclass('public.must_rollback') AS value")).rows[0].value).toBeNull();
    expect((await pool.query("SELECT count(*)::int AS count FROM music_schema_migrations WHERE id='0012_deliberate_failure'")).rows[0].count).toBe(0);
    await secondPool.end();
    await pool.end();
  });

  it("rejects an appended production chain before any fresh or migrated database write", async () => {
    const appended = createMigrationDefinition("0012_unapproved", "CREATE TABLE forbidden_chain_write(id integer);\n");
    const chain = [...loadMusicMigrations(), appended];
    const fresh = await freshDatabase("appended_fresh");
    await expect(migrateMusicDatabase(fresh, { migrations: chain })).rejects.toThrow(/exact production migration chain/i);
    expect((await fresh.query("SELECT to_regclass('public.music_schema_migrations') AS journal, to_regclass('public.forbidden_chain_write') AS ddl")).rows[0])
      .toEqual({ journal: null, ddl: null });
    await fresh.end();

    const migrated = await freshDatabase("appended_migrated");
    await migrateMusicDatabase(migrated);
    const before = await migrated.query("SELECT id,checksum,schema_checksum,applied_at FROM music_schema_migrations ORDER BY id");
    await expect(migrateMusicDatabase(migrated, { migrations: chain })).rejects.toThrow(/exact production migration chain/i);
    expect((await migrated.query("SELECT id,checksum,schema_checksum,applied_at FROM music_schema_migrations ORDER BY id")).rows).toEqual(before.rows);
    expect((await migrated.query("SELECT to_regclass('public.forbidden_chain_write') AS ddl")).rows[0].ddl).toBeNull();
    await migrated.end();
  });

  it("fails closed on checksum changes, catalog drift, missing/future migrations, and unversioned application tables", async () => {
    const pool = await freshDatabase("tamper");
    await migrateMusicDatabase(pool);
    const chain = loadMusicMigrations();
    await expect(migrateMusicDatabase(pool, { migrations: [
      createMigrationDefinition(chain[0].id, `${chain[0].sql}\n-- tampered`), chain[1], chain[2], chain[3], chain[4], chain[5], chain[6], chain[7], chain[8], chain[9], chain[10],
    ] })).rejects.toThrow("checksum");
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

  it("fingerprints trigger function bodies and complete sequence metadata", async () => {
    const functionPool = await freshDatabase("function_drift");
    await migrateMusicDatabase(functionPool);
    await functionPool.query(`CREATE OR REPLACE FUNCTION enforce_music_identity_immutability() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END; $$`);
    await expect(verifyMusicDatabase(functionPool)).rejects.toThrow("drift");
    expect(await checkMusicDatabaseReadiness(functionPool)).toMatchObject({ ready: false, reason: "migration-state-invalid" });
    await functionPool.end();

    const sequencePool = await freshDatabase("sequence_drift");
    await migrateMusicDatabase(sequencePool);
    await sequencePool.query("ALTER SEQUENCE users_id_seq INCREMENT BY 2");
    await expect(verifyMusicDatabase(sequencePool)).rejects.toThrow("drift");
    expect(await checkMusicDatabaseReadiness(sequencePool)).toMatchObject({ ready: false, reason: "migration-state-invalid" });
    await sequencePool.end();
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
      strapiReadToken: "fixture-read-only-token",
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
