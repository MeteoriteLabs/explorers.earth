import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrateMusicDatabase } from "../db/migrate";
import { MusicDomainRepository } from "../repositories/musicDomainRepository";
import { MusicIdentityRepository, type EnsureMusicIdentityInput } from "../repositories/musicIdentityRepository";
import { MusicPrincipalService } from "../middleware/musicPrincipal";
import { MusicTokenService } from "../services/musicTokenService";
import { manuallyRepairMusicDeletion } from "../workers/musicLifecycleWorker";

const exactTarget = process.env.DATABASE_URL_TEST ?? "postgresql://music_migrator:music@127.0.0.1:55432/music_fixture";
const enabled = process.env.MUSIC_C7_POSTGRES_TEST === "1";
const describePg = enabled ? describe.sequential : describe.skip;
const databaseName = `music_c7_lifecycle_${process.pid}`;
let admin: pg.Pool;
let pool: pg.Pool;

function identityInput(suffix: string): EnsureMusicIdentityInput {
  return {
    userDocumentId: `c7-user-${suffix}`,
    accountDocumentId: `c7-account-${suffix}`,
    username: `mutable-${suffix}`,
    email: `${suffix}@example.invalid`,
    provider: "local",
    accountName: `Account ${suffix}`,
    accountType: "Explorer",
    accountMobile: "+15555550100",
    internalUsername: `c7-owner-${suffix}`,
    password: `disabled-password-${suffix}`,
    guestUrl: `c7-public-${suffix}`,
    guestCapabilityHash: Buffer.from(suffix).toString("hex").padEnd(64, "a").slice(0, 64),
    operationId: `provision-${suffix}`,
    requestId: `request-${suffix}`,
  };
}

describePg("C7 durable Music lifecycle on PostgreSQL 15", () => {
  beforeAll(async () => {
    admin = new pg.Pool({ connectionString: exactTarget });
    expect((await admin.query("SHOW server_version")).rows[0].server_version).toMatch(/^15\./);
    await admin.query(`CREATE DATABASE ${databaseName}`);
    const target = new URL(exactTarget);
    target.pathname = `/${databaseName}`;
    pool = new pg.Pool({ connectionString: target.toString(), max: 24 });
    await migrateMusicDatabase(pool);
  });

  afterAll(async () => {
    await pool?.end();
    await admin?.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()", [databaseName]);
    await admin?.query(`DROP DATABASE IF EXISTS ${databaseName}`);
    await admin?.end();
  });

  it("converges concurrent prepare calls, rotates the session, revokes publication, and hides the public resource", async () => {
    // Break caught: multi-tab prepare creates divergent operations or leaves owner/public authority live.
    const repository = new MusicIdentityRepository(pool);
    const projection = await repository.ensureIdentity(identityInput("prepare"));
    await pool.query("INSERT INTO playlists(user_id,name,is_visible_to_guests) VALUES ($1,'Public',true)", [projection.id]);
    await pool.query("UPDATE users SET guest_discoverable=true WHERE id=$1", [projection.id]);

    const results = await Promise.all(Array.from({ length: 12 }, (_, index) => repository.prepareDeletion({
      userDocumentId: "c7-user-prepare",
      accountDocumentId: "c7-account-prepare",
      operationId: `delete-prepare-${index}`,
    })));

    expect(new Set(results.map(({ operationId }) => operationId))).toEqual(new Set([results[0].operationId]));
    expect(results[0]).toMatchObject({
      musicUserId: projection.id,
      identityStatus: "pending_deletion",
      phase: "prepared",
      state: "completed",
      boundaryCrossed: false,
    });
    const row = (await pool.query("SELECT session_version,guest_discoverable,guest_capability_revoked_at FROM users WHERE id=$1", [projection.id])).rows[0];
    expect(row.session_version).toBe(projection.sessionVersion + 1);
    expect(row.guest_discoverable).toBe(false);
    expect(row.guest_capability_revoked_at).not.toBeNull();
    await expect(new MusicDomainRepository(pool).resolveGuestResource("c7-public-prepare")).resolves.toBeUndefined();
  });

  it("cancels only before the durable upstream-attempt boundary", async () => {
    // Break caught: cancellation racing past an irreversible upstream deletion attempt.
    const repository = new MusicIdentityRepository(pool);
    await repository.ensureIdentity(identityInput("cancel"));
    const prepared = await repository.prepareDeletion({
      userDocumentId: "c7-user-cancel", accountDocumentId: "c7-account-cancel", operationId: "delete-cancel",
    });
    const cancelled = await repository.cancelDeletion({
      userDocumentId: "c7-user-cancel", accountDocumentId: "c7-account-cancel", operationId: "cancel-cancel",
    });
    expect(cancelled).toMatchObject({ identityStatus: "suspended", state: "cancelled", boundaryCrossed: false });
    await expect(repository.lifecycleStatus({ userDocumentId: "c7-user-cancel", accountDocumentId: "c7-account-cancel" }))
      .resolves.toMatchObject({ identityStatus: "suspended", phase: "prepared", state: "cancelled", boundaryCrossed: false });

    await repository.transitionIdentity({
      strapiUserDocumentId: "c7-user-cancel", operationId: "reactivate-cancel", kind: "reactivate", targetStatus: "active",
    });
    await repository.prepareDeletion({
      userDocumentId: "c7-user-cancel", accountDocumentId: "c7-account-cancel", operationId: "delete-boundary",
    });
    await repository.markDeletionBoundary({ userDocumentId: "c7-user-cancel", accountDocumentId: "c7-account-cancel" });
    await expect(repository.cancelDeletion({
      userDocumentId: "c7-user-cancel", accountDocumentId: "c7-account-cancel", operationId: "cancel-too-late",
    })).rejects.toMatchObject({ code: "LIFECYCLE_CANCEL_FORBIDDEN", status: 409 });
    expect(prepared.operationId).toBe("delete-cancel");
  });

  it("claims once, retains only safe aggregate data, atomically tombstones, and denies recreation", async () => {
    // Break caught: cleanup before absence, partial PII retention, duplicate workers, or identity recreation.
    const repository = new MusicIdentityRepository(pool);
    const projection = await repository.ensureIdentity(identityInput("finalize"));
    await pool.query("INSERT INTO youtube_api_usage(endpoint_type,user_id,quota_cost) VALUES ('search',$1,100)", [projection.id]);
    await pool.query("INSERT INTO guest_interactions(user_id,guest_id,interaction_type) VALUES ($1,'pii-guest','view')", [projection.id]);
    await pool.query("INSERT INTO activity_logs(user_id,event_type,event_data) VALUES ($1,'login','{\"email\":\"pii@example.invalid\"}')", [projection.id]);
    await pool.query("INSERT INTO playlists(user_id,name) VALUES ($1,'private content')", [projection.id]);
    await pool.query("INSERT INTO api_tokens(token,name,user_id,scopes) VALUES ('secret-token','secret',$1,'{}')", [projection.id]);
    await repository.prepareDeletion({
      userDocumentId: "c7-user-finalize", accountDocumentId: "c7-account-finalize", operationId: "delete-finalize",
    });
    await repository.markDeletionBoundary({ userDocumentId: "c7-user-finalize", accountDocumentId: "c7-account-finalize" });

    const [first, second] = await Promise.all([
      repository.claimDueDeletions({ now: new Date(Date.now() + 600_000), batchSize: 10, maxAttempts: 5 }),
      repository.claimDueDeletions({ now: new Date(Date.now() + 600_000), batchSize: 10, maxAttempts: 5 }),
    ]);
    const targetClaims = [...first, ...second].filter(({ operationId }) => operationId === "delete-finalize");
    expect(targetClaims).toHaveLength(1);
    const claimed = targetClaims[0];
    await expect(repository.finalizeDeletion(claimed)).resolves.toBe(true);
    await expect(repository.finalizeDeletion(claimed)).resolves.toBe(false);

    expect(Number((await pool.query("SELECT count(*) FROM users WHERE id=$1", [projection.id])).rows[0].count)).toBe(0);
    expect((await pool.query("SELECT user_id FROM youtube_api_usage WHERE endpoint_type='search'")).rows[0].user_id).toBeNull();
    expect(Number((await pool.query("SELECT count(*) FROM guest_interactions WHERE user_id=$1", [projection.id])).rows[0].count)).toBe(0);
    const tombstone = (await pool.query("SELECT music_user_id,lifecycle_operation_id,retention_stage FROM music_identity_tombstones WHERE strapi_user_document_id='c7-user-finalize'")).rows[0];
    expect(tombstone).toEqual({ music_user_id: projection.id, lifecycle_operation_id: "delete-finalize", retention_stage: "classified-v1" });
    await expect(repository.ensureIdentity(identityInput("finalize"))).rejects.toMatchObject({ code: "IDENTITY_TOMBSTONED" });
  });

  it("rolls back the complete retention transaction when cleanup fails", async () => {
    // Break caught: a partial cleanup commits before the tombstone/finalization operation.
    const base = new MusicIdentityRepository(pool);
    const projection = await base.ensureIdentity(identityInput("rollback"));
    await pool.query("INSERT INTO playlists(user_id,name) VALUES ($1,'must survive rollback')", [projection.id]);
    await base.prepareDeletion({
      userDocumentId: "c7-user-rollback", accountDocumentId: "c7-account-rollback", operationId: "delete-rollback",
    });
    await base.markDeletionBoundary({ userDocumentId: "c7-user-rollback", accountDocumentId: "c7-account-rollback" });
    const claimed = (await base.claimDueDeletions({ now: new Date(Date.now() + 600_000), batchSize: 10, maxAttempts: 5 }))
      .find(({ operationId }) => operationId === "delete-rollback")!;
    const failing = new MusicIdentityRepository(pool, {
      beforeFinalize: async () => { throw new Error("injected-retention-failure"); },
    });

    await expect(failing.finalizeDeletion(claimed)).rejects.toThrow("injected-retention-failure");
    expect(Number((await pool.query("SELECT count(*) FROM users WHERE id=$1", [projection.id])).rows[0].count)).toBe(1);
    expect(Number((await pool.query("SELECT count(*) FROM playlists WHERE user_id=$1", [projection.id])).rows[0].count)).toBe(1);
    expect(Number((await pool.query("SELECT count(*) FROM music_identity_tombstones WHERE music_user_id=$1", [projection.id])).rows[0].count)).toBe(0);
  });

  it("suspends and reactivates the stable owner/content without restoring publication authority", async () => {
    // Break caught: suspension remaps/deletes content or reactivation silently republishes it.
    const repository = new MusicIdentityRepository(pool);
    const projection = await repository.ensureIdentity(identityInput("suspend"));
    await pool.query("INSERT INTO playlists(user_id,name,is_visible_to_guests) VALUES ($1,'preserved',true)", [projection.id]);
    await pool.query("UPDATE users SET guest_discoverable=true WHERE id=$1", [projection.id]);
    const suspended = await repository.transitionIdentity({
      strapiUserDocumentId: "c7-user-suspend", operationId: "suspend-c7", kind: "suspend", targetStatus: "suspended",
    });
    expect(suspended).toMatchObject({ id: projection.id, identityStatus: "suspended", sessionVersion: projection.sessionVersion + 1 });
    expect(await new MusicDomainRepository(pool).resolveGuestResource("c7-public-suspend")).toBeUndefined();
    const reactivated = await repository.transitionIdentity({
      strapiUserDocumentId: "c7-user-suspend", operationId: "reactivate-c7", kind: "reactivate", targetStatus: "active",
    });
    expect(reactivated).toMatchObject({ id: projection.id, identityStatus: "active", sessionVersion: suspended.sessionVersion });
    expect(Number((await pool.query("SELECT count(*) FROM playlists WHERE user_id=$1", [projection.id])).rows[0].count)).toBe(1);
    expect(await new MusicDomainRepository(pool).resolveGuestResource("c7-public-suspend")).toBeUndefined();
  });

  it("revokes a previously valid C5 credential in the prepare transaction", async () => {
    // Break caught: a stale browser credential remains usable after prepare commits.
    const repository = new MusicIdentityRepository(pool);
    const projection = await repository.ensureIdentity(identityInput("stale-token"));
    const tokens = new MusicTokenService({
      current: { kid: "c7-current", secret: Buffer.alloc(32, 7).toString("base64url") },
      tokenLifetimeSeconds: 600,
      clockSkewSeconds: 0,
    });
    const principals = new MusicPrincipalService(tokens, repository);
    const credential = tokens.mint(projection).token;
    await expect(principals.resolve(credential)).resolves.toMatchObject({ musicUserId: projection.id });
    await repository.prepareDeletion({
      userDocumentId: "c7-user-stale-token", accountDocumentId: "c7-account-stale-token", operationId: "delete-stale-token",
    });
    await expect(principals.resolve(credential)).rejects.toMatchObject({ code: "IDENTITY_PENDING_DELETION", status: 409 });
  });

  it("persists retry backoff, typed dead-letter state, and authoritative manual repair", async () => {
    // Break caught: presence/outage deletes data, spins immediately, or cannot be safely repaired.
    const repository = new MusicIdentityRepository(pool);
    const projection = await repository.ensureIdentity(identityInput("retry"));
    await pool.query("INSERT INTO playlists(user_id,name) VALUES ($1,'retain until absence')", [projection.id]);
    await repository.prepareDeletion({
      userDocumentId: "c7-user-retry", accountDocumentId: "c7-account-retry", operationId: "delete-retry",
    });
    await repository.markDeletionBoundary({ userDocumentId: "c7-user-retry", accountDocumentId: "c7-account-retry" });
    const first = (await repository.claimDueDeletions({ now: new Date(Date.now() + 10_000), batchSize: 20, maxAttempts: 3 }))
      .find(({ operationId }) => operationId === "delete-retry")!;
    await repository.recordDeletionObservation(first, "present", false);
    expect(Number((await pool.query("SELECT count(*) FROM playlists WHERE user_id=$1", [projection.id])).rows[0].count)).toBe(1);
    const immediate = await repository.claimDueDeletions({ now: new Date(), batchSize: 20, maxAttempts: 3 });
    expect(immediate.some(({ operationId }) => operationId === "delete-retry")).toBe(false);
    const second = (await repository.claimDueDeletions({ now: new Date(Date.now() + 600_000), batchSize: 20, maxAttempts: 3 }))
      .find(({ operationId }) => operationId === "delete-retry")!;
    await repository.recordDeletionObservation(second, "outage", true);
    await expect(repository.lifecycleStatus({ userDocumentId: "c7-user-retry", accountDocumentId: "c7-account-retry" }))
      .resolves.toMatchObject({ state: "failed", deadLetter: true, retryable: false });
    await expect(manuallyRepairMusicDeletion({
      operation: second,
      proveAbsence: async () => "absent",
      finalizeDeletion: (operation) => repository.finalizeDeletion(operation),
    })).resolves.toBe(true);
    expect(Number((await pool.query("SELECT count(*) FROM users WHERE id=$1", [projection.id])).rows[0].count)).toBe(0);
  });

  it("reclaims a stale running operation after a worker crash", async () => {
    // Break caught: a process crash after claim strands deletion in running forever.
    const repository = new MusicIdentityRepository(pool);
    await repository.ensureIdentity(identityInput("crash-recovery"));
    await repository.prepareDeletion({
      userDocumentId: "c7-user-crash-recovery",
      accountDocumentId: "c7-account-crash-recovery",
      operationId: "delete-crash-recovery",
    });
    await repository.markDeletionBoundary({
      userDocumentId: "c7-user-crash-recovery", accountDocumentId: "c7-account-crash-recovery",
    });
    const first = (await repository.claimDueDeletions({
      now: new Date(Date.now() + 10_000), batchSize: 20, maxAttempts: 5,
    })).find(({ operationId }) => operationId === "delete-crash-recovery")!;
    expect(first.attemptCount).toBe(2);

    const reclaimed = (await repository.claimDueDeletions({
      now: new Date(Date.now() + 600_000), batchSize: 20, maxAttempts: 5,
    })).find(({ operationId }) => operationId === "delete-crash-recovery");
    expect(reclaimed).toMatchObject({ operationId: "delete-crash-recovery", attemptCount: 3 });
  });
});
