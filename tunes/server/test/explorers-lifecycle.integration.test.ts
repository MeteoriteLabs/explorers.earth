import { createHmac, randomUUID } from "node:crypto";
import pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCanonicalApp } from "../auth/canonicalApp";
import { resolveExplorersAuthConfig } from "../auth/betterAuth";
import { issueRecoveryProof } from "../auth/recoveryProof";
import { AccountLifecycleService } from "../application/accountLifecycle";
import { runAccountLifecycleMaintenance } from "../application/accountLifecycleMaintenance";
import { LocalObjectStorage } from "../services/objectStorage";
import { MusicIdentityRepository } from "../repositories/musicIdentityRepository";

const config = resolveExplorersAuthConfig({
  EXPLORERS_PUBLIC_ORIGIN: "http://127.0.0.1:51474",
  EXPLORERS_AUTH_SECRET: "lifecycle-integration-secret-".repeat(3),
  GOOGLE_CLIENT_ID: "fixture-google-id",
  GOOGLE_CLIENT_SECRET: "fixture-google-secret",
});
let pool: pg.Pool;
let app: ReturnType<typeof createCanonicalApp>;

async function identity() {
  const userId = `lifecycle-${randomUUID()}`;
  await pool.query("INSERT INTO auth_user(id,name,email) VALUES ($1,'Person',$2)", [userId, `${userId}@example.invalid`]);
  await pool.query("INSERT INTO auth_account(id,account_id,provider_id,user_id,updated_at) VALUES ($1,$2,'google',$3,now())",
    [randomUUID(), `google-${userId}`, userId]);
  const context = await app.auth.$context;
  const session = await context.internalAdapter.createSession(userId, false);
  const signature = createHmac("sha256", config.secret).update(session.token).digest("base64");
  const cookie = `${context.authCookies.sessionToken.name}=${session.token}.${signature}`;
  const profile = await request(app.app).get("/api/explorers/v1/me").set("cookie", cookie);
  expect(profile.status).toBe(200);
  return { userId, cookie, accountId: profile.body.account.id, revision: profile.body.account.revision as number };
}

describe("canonical account lifecycle", () => {
  beforeAll(() => { pool = new pg.Pool({ connectionString: process.env.DATABASE_URL_TEST }); app = createCanonicalApp(pool, config); });
  afterAll(async () => { await pool?.end(); });

  it("rechecks revoked web sessions and OAuth operation scopes inside the lifecycle service", async () => {
    const owner = await identity();
    const session = await pool.query<{ id: string; session_version: string }>(
      "SELECT id,session_version::text FROM auth_session WHERE user_id=$1 LIMIT 1", [owner.userId]);
    const service = new AccountLifecycleService(pool);
    const webActor = { userId: owner.userId, accountId: owner.accountId, role: "owner" as const,
      credential: { kind: "web-session" as const, sessionId: session.rows[0].id,
        sessionVersion: Number(session.rows[0].session_version) } };
    await pool.query("UPDATE user_security_state SET session_version=session_version+1 WHERE user_id=$1", [owner.userId]);
    await expect(service.recordDeletionFeedback(webActor, { reason: "Leaving" },
      { requestId: randomUUID(), idempotencyKey: randomUUID() })).rejects.toMatchObject({ status: 401 });
    await pool.query("UPDATE user_security_state SET session_version=session_version-1 WHERE user_id=$1", [owner.userId]);
    await pool.query("DELETE FROM auth_session WHERE id=$1", [session.rows[0].id]);
    await expect(service.recordDeletionFeedback(webActor, { reason: "Leaving" },
      { requestId: randomUUID(), idempotencyKey: randomUUID() })).rejects.toMatchObject({ status: 401 });
    await expect(service.requestAccountDeactivation(webActor, { expectedRevision: owner.revision },
      { requestId: randomUUID(), idempotencyKey: randomUUID() })).rejects.toMatchObject({ status: 401 });
    const oauthActor = { userId: owner.userId, accountId: owner.accountId, role: "owner" as const,
      credential: { kind: "oauth" as const, grantId: randomUUID(), scopes: [] } };
    await expect(service.recordDeletionFeedback(oauthActor, { reason: "Leaving" },
      { requestId: randomUUID(), idempotencyKey: randomUUID() })).rejects.toMatchObject({ status: 403 });
    await expect(service.requestAccountDeletion(oauthActor, { expectedRevision: owner.revision, feedbackId: randomUUID() },
      { requestId: randomUUID(), idempotencyKey: randomUUID() })).rejects.toMatchObject({ status: 403 });
    expect((await pool.query("SELECT count(*)::int AS count FROM deletion_feedback WHERE account_id=$1", [owner.accountId])).rows[0].count).toBe(0);
  });

  it("records one trimmed feedback reason on duplicate submit and never accepts caller ownership", async () => {
    const owner = await identity();
    const idempotencyKey = randomUUID();
    const submit = () => request(app.app).post("/api/explorers/v1/account/deletion-feedback")
      .set("origin", config.baseURL).set("cookie", owner.cookie).set("idempotency-key", idempotencyKey)
      .send({ reason: "  Taking a break  ", accountId: randomUUID(), userId: "attacker" });
    const first = await submit();
    expect(first.status).toBe(201);
    const second = await submit();
    expect(second.status).toBe(201);
    expect(second.body.feedback.id).toBe(first.body.feedback.id);
    const rows = await pool.query("SELECT account_id,user_id,reason FROM deletion_feedback WHERE id=$1", [first.body.feedback.id]);
    expect(rows.rows).toEqual([{ account_id: owner.accountId, user_id: owner.userId, reason: "Taking a break" }]);
  });

  it("denies cross-origin feedback and rejects invalid reason without recording it", async () => {
    const owner = await identity();
    const denied = await request(app.app).post("/api/explorers/v1/account/deletion-feedback")
      .set("origin", "https://attacker.example").set("cookie", owner.cookie).send({ reason: "No" });
    expect(denied.status).toBe(403);
    const invalid = await request(app.app).post("/api/explorers/v1/account/deletion-feedback")
      .set("origin", config.baseURL).set("cookie", owner.cookie).set("idempotency-key", randomUUID()).send({ reason: "   " });
    expect(invalid.status).toBe(422);
  });

  it("deactivates once, revokes the session and refuses another account's feedback", async () => {
    const owner = await identity();
    const other = await identity();
    const feedback = await request(app.app).post("/api/explorers/v1/account/deletion-feedback")
      .set("origin", config.baseURL).set("cookie", other.cookie).set("idempotency-key", randomUUID()).send({ reason: "Leaving" });
    const crossAccount = await request(app.app).post("/api/explorers/v1/account/deletion")
      .set("origin", config.baseURL).set("cookie", owner.cookie).set("idempotency-key", randomUUID())
      .send({ expectedRevision: owner.revision, feedbackId: feedback.body.feedback.id });
    expect(crossAccount.status).toBe(404);
    const changed = await request(app.app).post("/api/explorers/v1/account/deactivation")
      .set("origin", config.baseURL).set("cookie", owner.cookie).set("idempotency-key", randomUUID())
      .send({ expectedRevision: owner.revision });
    expect(changed.status).toBe(200);
    expect(changed.body.lifecycle).toMatchObject({ accountId: owner.accountId, status: "suspended", revision: owner.revision + 1 });
    expect((await request(app.app).get("/api/explorers/v1/me").set("cookie", owner.cookie)).status).toBe(401);
  });

  it("uses the purpose-bound proof to recover a suspended account once, then requires a fresh normal session", async () => {
    const owner = await identity();
    const changed = await request(app.app).post("/api/explorers/v1/account/deactivation")
      .set("origin", config.baseURL).set("cookie", owner.cookie).set("idempotency-key", randomUUID())
      .send({ expectedRevision: owner.revision });
    const context = await app.auth.$context;
    const temporary = await context.internalAdapter.createSession(owner.userId, false);
    const proof = await issueRecoveryProof(pool, { userId: owner.userId, subject: `google-${owner.userId}`, sessionId: temporary.id });
    const proofCookie = `explorers_recovery_proof=${proof.token}`;
    const status = await request(app.app).get("/api/explorers/v1/recovery/status").set("cookie", proofCookie);
    expect(status.status).toBe(200);
    expect(status.body.recovery).toMatchObject({ status: "suspended", revision: changed.body.lifecycle.revision });
    expect((await request(app.app).get("/api/explorers/v1/me").set("cookie", proofCookie)).status).toBe(401);
    const recovered = await request(app.app).post("/api/explorers/v1/recovery/complete")
      .set("origin", config.baseURL).set("cookie", proofCookie)
      .send({ expectedRevision: changed.body.lifecycle.revision });
    expect(recovered.status).toBe(200);
    expect(recovered.body.lifecycle.status).toBe("active");
    expect((await request(app.app).post("/api/explorers/v1/recovery/complete").set("origin", config.baseURL)
      .set("cookie", proofCookie).send({ expectedRevision: changed.body.lifecycle.revision })).status).toBe(403);
    expect((await request(app.app).get("/api/explorers/v1/me").set("cookie", owner.cookie)).status).toBe(401);
  });

  it("cancels pending deletion with a Google-bound proof while rejecting foreign ownership", async () => {
    const owner = await identity();
    const other = await identity();
    const feedback = await request(app.app).post("/api/explorers/v1/account/deletion-feedback")
      .set("origin", config.baseURL).set("cookie", owner.cookie).set("idempotency-key", randomUUID())
      .send({ reason: "Pause" });
    const pending = await request(app.app).post("/api/explorers/v1/account/deletion")
      .set("origin", config.baseURL).set("cookie", owner.cookie).set("idempotency-key", randomUUID())
      .send({ expectedRevision: owner.revision, feedbackId: feedback.body.feedback.id });
    expect(pending.body.lifecycle.status).toBe("pending_deletion");
    const context = await app.auth.$context;
    const foreignSession = await context.internalAdapter.createSession(other.userId, false);
    await expect(issueRecoveryProof(pool, { userId: other.userId,
      subject: `google-${owner.userId}`, sessionId: foreignSession.id })).rejects.toThrow();
    const temporary = await context.internalAdapter.createSession(owner.userId, false);
    const proof = await issueRecoveryProof(pool, { userId: owner.userId,
      subject: `google-${owner.userId}`, sessionId: temporary.id });
    await pool.query("UPDATE account_lifecycle_operations SET state='running' WHERE id=$1", [pending.body.lifecycle.operationId]);
    const duringFinalization = await request(app.app).post("/api/explorers/v1/recovery/complete")
      .set("origin", config.baseURL).set("cookie", `explorers_recovery_proof=${proof.token}`)
      .send({ expectedRevision: pending.body.lifecycle.revision });
    expect(duringFinalization.status).toBe(409);
    await pool.query("UPDATE account_lifecycle_operations SET state='pending' WHERE id=$1", [pending.body.lifecycle.operationId]);
    const recovered = await request(app.app).post("/api/explorers/v1/recovery/complete")
      .set("origin", config.baseURL).set("cookie", `explorers_recovery_proof=${proof.token}`)
      .send({ expectedRevision: pending.body.lifecycle.revision });
    expect(recovered.status).toBe(200);
    expect(recovered.body.lifecycle.status).toBe("active");
    expect((await pool.query("SELECT kind FROM account_lifecycle_operations WHERE id=$1",
      [recovered.body.lifecycle.operationId])).rows[0].kind).toBe("cancel_deletion");
    expect((await pool.query("SELECT deletion_requested_at FROM creator_accounts WHERE id=$1", [owner.accountId])).rows[0].deletion_requested_at).toBeNull();
  });

  it("allows exactly one concurrent recovery and rejects expired and revoked proofs", async () => {
    const owner = await identity();
    const deactivated = await request(app.app).post("/api/explorers/v1/account/deactivation")
      .set("origin", config.baseURL).set("cookie", owner.cookie).set("idempotency-key", randomUUID())
      .send({ expectedRevision: owner.revision });
    const context = await app.auth.$context;
    const temporary = await context.internalAdapter.createSession(owner.userId, false);
    const proof = await issueRecoveryProof(pool, { userId: owner.userId,
      subject: `google-${owner.userId}`, sessionId: temporary.id });
    const complete = () => request(app.app).post("/api/explorers/v1/recovery/complete")
      .set("origin", config.baseURL).set("cookie", `explorers_recovery_proof=${proof.token}`)
      .send({ expectedRevision: deactivated.body.lifecycle.revision });
    const responses = await Promise.all([complete(), complete()]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 403]);
    expect((await pool.query("SELECT revision FROM creator_accounts WHERE id=$1", [owner.accountId])).rows[0].revision)
      .toBe(String(deactivated.body.lifecycle.revision + 1));

    await pool.query("UPDATE creator_accounts SET status='suspended',suspended_at=now(),revision=revision+1 WHERE id=$1", [owner.accountId]);
    const expiredSession = await context.internalAdapter.createSession(owner.userId, false);
    const expired = await issueRecoveryProof(pool, { userId: owner.userId,
      subject: `google-${owner.userId}`, sessionId: expiredSession.id });
    await pool.query("UPDATE account_recovery_proofs SET issued_at=issued_at-interval '10 minutes',expires_at=expires_at-interval '10 minutes' WHERE id=$1", [expired.id]);
    expect((await request(app.app).get("/api/explorers/v1/recovery/status")
      .set("cookie", `explorers_recovery_proof=${expired.token}`)).status).toBe(403);
    const revokedSession = await context.internalAdapter.createSession(owner.userId, false);
    const revoked = await issueRecoveryProof(pool, { userId: owner.userId,
      subject: `google-${owner.userId}`, sessionId: revokedSession.id });
    await pool.query("UPDATE account_recovery_proofs SET revoked_at=now() WHERE id=$1", [revoked.id]);
    expect((await request(app.app).get("/api/explorers/v1/recovery/status")
      .set("cookie", `explorers_recovery_proof=${revoked.token}`)).status).toBe(403);

  });

  it("retires expired receipts and purges aged feedback using database time", async () => {
    const owner = await identity();
    const key = randomUUID();
    const submit = () => request(app.app).post("/api/explorers/v1/account/deletion-feedback")
      .set("origin", config.baseURL).set("cookie", owner.cookie).set("idempotency-key", key).send({ reason: "Private reason" });
    expect((await submit()).status).toBe(201);
    await pool.query(`UPDATE application_command_receipts SET replay_until=clock_timestamp()-interval '1 second'
      WHERE account_id=$1 AND operation='deletion-feedback'`, [owner.accountId]);
    expect((await submit()).status).toBe(409);
    await pool.query("UPDATE deletion_feedback SET created_at=clock_timestamp()-interval '31 days' WHERE account_id=$1", [owner.accountId]);
    await runAccountLifecycleMaintenance(pool, new LocalObjectStorage());
    expect((await pool.query("SELECT status,response FROM application_command_receipts WHERE account_id=$1", [owner.accountId])).rows[0])
      .toMatchObject({ status: "retired", response: null });
    expect((await pool.query("SELECT reason,user_id,purged_at IS NOT NULL AS purged FROM deletion_feedback WHERE account_id=$1", [owner.accountId])).rows[0])
      .toMatchObject({ reason: null, user_id: null, purged: true });
    expect((await submit()).status).toBe(409);
  });

  it("keeps a Music-mapped deletion pending until the 6.1 owner boundary is available", async () => {
    const owner = await identity();
    const musicId = randomUUID();
    const user = await new MusicIdentityRepository(pool).ensureIdentity({
      userDocumentId: `user-${musicId}`, accountDocumentId: `account-${musicId}`,
      username: `owner-${musicId}`, email: `${musicId}@example.invalid`, provider: "google",
      accountName: "Fixture", accountType: "Venue", accountMobile: "+15555550100", internalUsername: `owner-${musicId}`,
      password: "disabled-native-password", guestUrl: `guest-${musicId}`,
      guestCapabilityHash: "a".repeat(64), operationId: `provision-${musicId}`, requestId: musicId,
    });
    await pool.query("INSERT INTO account_music_identity(account_id,music_user_id) VALUES($1,$2)", [owner.accountId, user.id]);
    const feedback = await request(app.app).post("/api/explorers/v1/account/deletion-feedback")
      .set("origin", config.baseURL).set("cookie", owner.cookie).set("idempotency-key", randomUUID())
      .send({ reason: "Music account" });
    const pending = await request(app.app).post("/api/explorers/v1/account/deletion")
      .set("origin", config.baseURL).set("cookie", owner.cookie).set("idempotency-key", randomUUID())
      .send({ expectedRevision: owner.revision, feedbackId: feedback.body.feedback.id });
    expect(pending.status).toBe(200);
    expect(await runAccountLifecycleMaintenance(pool, new LocalObjectStorage())).toBe(1);
    expect((await pool.query("SELECT state,completed_at,failure_code FROM account_lifecycle_operations WHERE id=$1",
      [pending.body.lifecycle.operationId])).rows[0]).toMatchObject({
      state: "pending", completed_at: null, failure_code: "MUSIC_BOUNDARY_PENDING",
    });
    expect((await pool.query("SELECT status FROM creator_accounts WHERE id=$1", [owner.accountId])).rows[0].status).toBe("pending_deletion");
    const context = await app.auth.$context;
    const temporary = await context.internalAdapter.createSession(owner.userId, false);
    const proof = await issueRecoveryProof(pool, { userId: owner.userId,
      subject: `google-${owner.userId}`, sessionId: temporary.id });
    const recovered = await request(app.app).post("/api/explorers/v1/recovery/complete")
      .set("origin", config.baseURL).set("cookie", `explorers_recovery_proof=${proof.token}`)
      .send({ expectedRevision: pending.body.lifecycle.revision });
    expect(recovered.status).toBe(200);
    expect(recovered.body.lifecycle.status).toBe("active");
  });

  it("finalizes a pending delete through child-first media cleanup and retains only a non-revivable tombstone", async () => {
    const owner = await identity();
    await pool.query(`UPDATE creator_accounts SET handle='deletedtest',display_name='Private Person',account_type='Personal',
      onboarding_status='complete',bio_plain='Secret biography' WHERE id=$1`, [owner.accountId]);
    const storage = new LocalObjectStorage();
    const mediaId = randomUUID();
    const key = `local/${owner.accountId}/${mediaId}`;
    await storage.put(key, Buffer.from("private picture"));
    await pool.query(`INSERT INTO media_assets(id,account_id,purpose,status,mime_type,byte_size,content_sha256,ready_at)
      VALUES($1,$2,'profile','ready','image/png',15,$3,clock_timestamp())`, [mediaId, owner.accountId, Buffer.alloc(32, 1)]);
    await pool.query(`INSERT INTO media_objects(media_id,variant,storage_environment,object_key,mime_type,byte_size,content_sha256)
      VALUES($1,'original','local',$2,'image/png',15,$3)`, [mediaId, key, Buffer.alloc(32, 1)]);
    await pool.query("INSERT INTO profile_media(account_id,slot,media_id) VALUES($1,'profile',$2)", [owner.accountId, mediaId]);
    const feedback = await request(app.app).post("/api/explorers/v1/account/deletion-feedback")
      .set("origin", config.baseURL).set("cookie", owner.cookie).set("idempotency-key", randomUUID())
      .send({ reason: "Sensitive feedback" });
    const pending = await request(app.app).post("/api/explorers/v1/account/deletion")
      .set("origin", config.baseURL).set("cookie", owner.cookie).set("idempotency-key", randomUUID())
      .send({ expectedRevision: owner.revision, feedbackId: feedback.body.feedback.id });
    expect(pending.status).toBe(200);
    expect((await pool.query("SELECT state,completed_at FROM account_lifecycle_operations WHERE id=$1",
      [pending.body.lifecycle.operationId])).rows[0]).toMatchObject({ state: "pending", completed_at: null });
    expect(await runAccountLifecycleMaintenance(pool, {
      environment: "local", put: (objectKey, bytes) => storage.put(objectKey, bytes),
      get: (objectKey) => storage.get(objectKey), delete: async () => { throw new Error("temporary storage outage"); },
    })).toBe(1);
    expect((await pool.query("SELECT state,failure_code FROM account_lifecycle_operations WHERE id=$1",
      [pending.body.lifecycle.operationId])).rows[0]).toMatchObject({ state: "running", failure_code: "FINALIZATION_RETRY" });
    await pool.query("UPDATE account_lifecycle_operations SET updated_at=clock_timestamp()-interval '11 minutes' WHERE id=$1",
      [pending.body.lifecycle.operationId]);
    expect(await runAccountLifecycleMaintenance(pool, storage)).toBe(1);
    expect((await pool.query("SELECT status,handle,display_name,bio_plain,deleted_at IS NOT NULL AS deleted FROM creator_accounts WHERE id=$1", [owner.accountId])).rows[0])
      .toMatchObject({ status: "deleted", handle: null, display_name: null, bio_plain: null, deleted: true });
    expect((await pool.query("SELECT state,completed_at IS NOT NULL AS completed FROM account_lifecycle_operations WHERE id=$1",
      [pending.body.lifecycle.operationId])).rows[0]).toMatchObject({ state: "succeeded", completed: true });
    expect((await pool.query("SELECT reason,user_id FROM deletion_feedback WHERE id=$1", [feedback.body.feedback.id])).rows[0])
      .toMatchObject({ reason: null, user_id: null });
    expect((await pool.query("SELECT count(*)::int AS count FROM media_assets WHERE account_id=$1", [owner.accountId])).rows[0].count).toBe(0);
    await expect(storage.get(key)).rejects.toThrow();
    const context = await app.auth.$context;
    const terminalSession = await context.internalAdapter.createSession(owner.userId, false);
    const terminalCookie = `${context.authCookies.sessionToken.name}=${terminalSession.token}.${createHmac("sha256", config.secret).update(terminalSession.token).digest("base64")}`;
    expect((await request(app.app).get("/api/explorers/v1/me").set("cookie", terminalCookie)).status).toBe(403);
    await expect(issueRecoveryProof(pool, { userId: owner.userId,
      subject: `google-${owner.userId}`, sessionId: terminalSession.id })).rejects.toThrow();
    expect((await pool.query("SELECT count(*)::int AS count FROM initial_account_bindings WHERE account_id=$1", [owner.accountId])).rows[0].count).toBe(1);
  });
});
