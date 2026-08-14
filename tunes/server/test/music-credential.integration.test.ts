import pg from "pg";
import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrateMusicDatabase } from "../db/migrate";
import { MusicPrincipalService } from "../middleware/musicPrincipal";
import { MusicIdentityRepository, type EnsureMusicIdentityInput } from "../repositories/musicIdentityRepository";
import { MusicTokenService } from "../services/musicTokenService";

const exactTarget = "postgresql://music:music@127.0.0.1:55432/music_fixture";
const enabled = process.env.MUSIC_C5_POSTGRES_TEST === "1";
const describePg = enabled ? describe.sequential : describe.skip;
const databaseName = `music_c5_credentials_${process.pid}`;
let admin: pg.Pool;
let pool: pg.Pool;
let repository: MusicIdentityRepository;

function input(suffix: string): EnsureMusicIdentityInput {
  return {
    userDocumentId: `user-${suffix}`,
    accountDocumentId: `account-${suffix}`,
    username: `astronaut-${suffix}`,
    email: `${suffix}@example.invalid`,
    provider: "local",
    accountName: `Room ${suffix}`,
    accountType: "Venue",
    accountMobile: "+15555550100",
    internalUsername: `explorer-${suffix}`,
    password: `disabled-${suffix}`,
    guestUrl: `guest-${suffix}`,
    guestCapabilityHash: createHash("sha256").update(suffix).digest("hex"),
    operationId: `provision-${suffix}`,
    requestId: `request-${suffix}`,
  };
}

describePg("C5 Music credentials on real PostgreSQL 15", () => {
  beforeAll(async () => {
    admin = new pg.Pool({ connectionString: exactTarget });
    expect((await admin.query("SHOW server_version")).rows[0].server_version).toMatch(/^15\./);
    await admin.query(`CREATE DATABASE ${databaseName}`);
    const target = new URL(exactTarget);
    target.pathname = `/${databaseName}`;
    pool = new pg.Pool({ connectionString: target.toString(), max: 24 });
    await migrateMusicDatabase(pool);
    repository = new MusicIdentityRepository(pool);
  });

  afterAll(async () => {
    await pool?.end();
    await admin?.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()", [databaseName]);
    await admin?.query(`DROP DATABASE IF EXISTS ${databaseName}`);
    await admin?.end();
  });

  it("re-resolves subject, both tombstone dimensions, status, and session truth on every request", async () => {
    const identity = await repository.ensureIdentity(input("truth"));
    const now = 1_800_000_000_000;
    const tokens = new MusicTokenService({
      current: { kid: "integration", secret: Buffer.alloc(32, 0x67).toString("base64url") },
      tokenLifetimeSeconds: 600,
      clockSkewSeconds: 10,
    }, { now: () => now });
    const principals = new MusicPrincipalService(tokens, repository);
    const token = tokens.mint(identity).token;
    await expect(principals.resolve(token)).resolves.toMatchObject({ musicUserId: identity.id, subject: "user-truth" });

    await repository.revokeAllCredentials({ musicUserId: identity.id, expectedSessionVersion: 1, reason: "logout_all" });
    await expect(principals.resolve(token)).rejects.toMatchObject({ code: "TOKEN_REVOKED" });

    const suspended = await repository.ensureIdentity(input("suspended"));
    const suspendedToken = tokens.mint(suspended).token;
    await repository.transitionIdentity({ strapiUserDocumentId: "user-suspended", operationId: "suspend-c5", kind: "suspend", targetStatus: "suspended" });
    await expect(principals.resolve(suspendedToken)).rejects.toMatchObject({ code: "IDENTITY_SUSPENDED" });

    const pending = await repository.ensureIdentity(input("pending"));
    const pendingToken = tokens.mint(pending).token;
    await repository.transitionIdentity({ strapiUserDocumentId: "user-pending", operationId: "delete-c5", kind: "request_deletion", targetStatus: "pending_deletion" });
    await expect(principals.resolve(pendingToken)).rejects.toMatchObject({ code: "IDENTITY_PENDING_DELETION" });

    const accountTombstone = await repository.ensureIdentity(input("account-tombstone"));
    const accountToken = tokens.mint(accountTombstone).token;
    await pool.query("BEGIN");
    await pool.query("SET LOCAL session_replication_role='replica'");
    await pool.query(`INSERT INTO music_identity_lifecycle_operations
      (operation_id,strapi_user_document_id,strapi_account_document_id,music_user_id,operation_kind,
       requested_identity_status,operation_state,attempt_count,result_session_version,operation_phase)
      VALUES ('other-delete','other-deleted-user','account-account-tombstone',$1,'tombstone',
        'pending_deletion','completed',1,$2,'single')`, [accountTombstone.id, accountTombstone.sessionVersion]);
    await pool.query(`INSERT INTO music_identity_tombstones
      (strapi_user_document_id,strapi_account_document_id,reason,lifecycle_operation_id,music_user_id)
      VALUES ('other-deleted-user','account-account-tombstone','security','other-delete',$1)`, [accountTombstone.id]);
    await pool.query("COMMIT");
    await expect(principals.resolve(accountToken)).rejects.toMatchObject({ code: "TOKEN_REVOKED" });
    await pool.query("BEGIN");
    await pool.query("SET LOCAL session_replication_role='replica'");
    await pool.query("DELETE FROM music_identity_tombstones WHERE lifecycle_operation_id='other-delete'");
    await pool.query("DELETE FROM music_identity_lifecycle_operations WHERE operation_id='other-delete'");
    await pool.query("COMMIT");

    await pool.query("DELETE FROM users WHERE id=$1", [identity.id]).catch(() => undefined);
    await expect(principals.resolve(token)).rejects.toMatchObject({ code: "TOKEN_REVOKED" });
  });

  it.each(["logout_all", "entitlement_security_revocation", "credential_compromise"] as const)(
    "atomically and idempotently revokes concurrent %s calls",
    async (reason) => {
      const identity = await repository.ensureIdentity(input(`revoke-${reason}`));
      const results = await Promise.all(Array.from({ length: 20 }, () => repository.revokeAllCredentials({
        musicUserId: identity.id, expectedSessionVersion: identity.sessionVersion, reason,
      })));
      expect(new Set(results.map(({ sessionVersion }) => sessionVersion))).toEqual(new Set([2]));
      expect((await pool.query("SELECT session_version FROM users WHERE id=$1", [identity.id])).rows[0].session_version).toBe(2);
    },
  );

  it("rolls back a stale version with no session mutation", async () => {
    const identity = await repository.ensureIdentity(input("stale"));
    await expect(repository.revokeAllCredentials({
      musicUserId: identity.id, expectedSessionVersion: 3, reason: "credential_compromise",
    })).rejects.toMatchObject({ code: "IDENTITY_CONFLICT" });
    expect((await pool.query("SELECT session_version FROM users WHERE id=$1", [identity.id])).rows[0].session_version).toBe(1);
  });
});
