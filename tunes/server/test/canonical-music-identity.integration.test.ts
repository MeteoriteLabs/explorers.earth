import { createHmac, randomUUID } from "node:crypto";
import pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCanonicalApp } from "../auth/canonicalApp";
import { resolveExplorersAuthConfig } from "../auth/betterAuth";
import { createAccountMusicRepository } from "../music/accountMusicRepository";
import type { Actor } from "../application/actor";

/**
 * Ticket 6.1, the named acceptance suite, under ADR-007 and ADR-008.
 *
 * `server/test/music/account-music-repository.test.ts` already covers this repository's
 * logic in eleven cases against a scripted fake pool - the account lock, the lost mapping
 * insert, the OAuth refusal, the foreign-account refusal. Those are not repeated here.
 *
 * What a fake pool cannot establish, and what this suite is for:
 *
 *  - that PostgreSQL actually serialises two concurrent provisions. The unit test proves
 *    `SELECT ... FOR UPDATE` is *issued*; only a real database proves it *works*, and the
 *    one-to-one guarantee is the whole point of the mapping.
 *  - that migration 0039's deferred ownership triggers accept a venue with both Strapi
 *    document ids NULL and a mapping, and reject one without. ADR-007 decision 4 forbids
 *    inventing filler to satisfy a constraint, so the constraint has to genuinely permit
 *    the canonical shape.
 *  - that `password` and `lifecycle_operation_id` being left unset satisfy the real
 *    columns rather than the test's idea of them.
 *  - that a lost race leaves no orphaned `users` row behind.
 *
 * Every case drives `ensureMusicAccount` through the canonical repository with a real
 * web-session Actor, so the authority path is the one production uses.
 */

const config = resolveExplorersAuthConfig({
  EXPLORERS_PUBLIC_ORIGIN: "http://127.0.0.1:51474",
  EXPLORERS_AUTH_SECRET: "canonical-music-identity-secret-".repeat(2),
  GOOGLE_CLIENT_ID: "fixture-google-id",
  GOOGLE_CLIENT_SECRET: "fixture-google-secret",
});

let pool: pg.Pool;
let composed: ReturnType<typeof createCanonicalApp>;

/** A canonical owner with a real Better Auth session, as the authorization suite builds one. */
async function owner() {
  const userId = `music-identity-${randomUUID()}`;
  await pool.query("INSERT INTO auth_user(id,name,email) VALUES ($1,'Owner',$2)",
    [userId, `${userId}@example.invalid`]);
  await pool.query(
    "INSERT INTO auth_account(id,account_id,provider_id,user_id,updated_at) VALUES ($1,$2,'google',$3,now())",
    [randomUUID(), `google-${userId}`, userId]);
  const context = await composed.auth.$context;
  const session = await context.internalAdapter.createSession(userId, false);
  const signature = createHmac("sha256", config.secret).update(session.token).digest("base64");
  const cookie = `${context.authCookies.sessionToken.name}=${session.token}.${signature}`;
  const profile = await request(composed.app).get("/api/explorers/v1/me").set("cookie", cookie);
  expect(profile.status).toBe(200);
  const accountId = profile.body.account.id as string;
  const actor: Actor = {
    userId, accountId, role: "owner",
    credential: { kind: "web-session", sessionId: session.id, sessionVersion: 1 },
  };
  return { userId, accountId, actor, cookie };
}

const venueOf = async (musicUserId: number) => (await pool.query<{
  username: string; password: string | null; venue_name: string;
  strapi_user_document_id: string | null; strapi_account_document_id: string | null;
  lifecycle_operation_id: string | null; identity_status: string;
}>(`SELECT username,password,venue_name,strapi_user_document_id,strapi_account_document_id,
      lifecycle_operation_id,identity_status FROM users WHERE id=$1`, [musicUserId])).rows[0];

describe("canonical Music identity against real PostgreSQL", () => {
  beforeAll(() => {
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL_TEST, max: 8 });
    composed = createCanonicalApp(pool, config);
  });
  afterAll(async () => { await pool?.end(); });

  it("provisions one venue with no Strapi identifiers and no invented password", async () => {
    const subject = await owner();
    const repository = createAccountMusicRepository(pool);

    const ensured = await repository.ensureMusicAccount(subject.actor);
    expect(ensured).toMatchObject({ accountId: subject.accountId, provisioned: true });
    expect(Number.isSafeInteger(ensured.musicUserId) && ensured.musicUserId > 0).toBe(true);

    const venue = await venueOf(ensured.musicUserId);
    // ADR-007 decision 4: no filler password, and no Strapi document id on a canonical
    // venue. These NULLs are the decision, so the real columns must accept them.
    expect(venue.password).toBeNull();
    expect(venue.strapi_user_document_id).toBeNull();
    expect(venue.strapi_account_document_id).toBeNull();
    expect(venue.lifecycle_operation_id).toBeNull();
    expect(venue.identity_status).toBe("active");
    // Deterministic, so a retry cannot derive a second venue name.
    expect(venue.username).toMatch(/^explorer-[0-9a-f]{24}$/);

    const mapping = await pool.query(
      "SELECT music_user_id FROM account_music_identity WHERE account_id=$1", [subject.accountId]);
    expect(mapping.rows).toEqual([{ music_user_id: ensured.musicUserId }]);
  });

  it("is idempotent: a second ensure reuses the mapping and creates no second venue", async () => {
    const subject = await owner();
    const repository = createAccountMusicRepository(pool);

    const first = await repository.ensureMusicAccount(subject.actor);
    const second = await repository.ensureMusicAccount(subject.actor);

    expect(second.musicUserId).toBe(first.musicUserId);
    expect(second.provisioned).toBe(false);
    const venues = await pool.query<{ count: string }>(
      `SELECT count(*)::text FROM users u JOIN account_music_identity m ON m.music_user_id=u.id
        WHERE m.account_id=$1`, [subject.accountId]);
    expect(venues.rows[0].count).toBe("1");
  });

  it("gives one venue to concurrent provisions of the same account, with no orphan row", async () => {
    /*
     * The case a fake pool cannot reach: whether PostgreSQL actually serialises four
     * callers into one venue.
     *
     * What this does NOT cover, stated because an earlier draft of this comment claimed it
     * did and a mutation proved otherwise. Making the lost-race branch commit its venue
     * instead of discarding it left all eight cases green, which means that branch is
     * never reached here. It cannot be: `alreadyMapped` is checked *inside* the
     * transaction, after `SELECT ... FOR UPDATE` on the account row, so a same-account
     * caller that arrives second blocks on the lock and then returns through the
     * already-mapped path without ever attempting the mapping insert.
     *
     * That is the lock working, not a gap. The `ON CONFLICT DO NOTHING` discard is
     * defence-in-depth for a conflict arriving by some other route, and it is covered by
     * the unit suite, which can script the conflict a real lock prevents
     * ("discards its own venue row and reads the winner when it loses the mapping insert").
     *
     * So what is asserted below is the outcome - one venue, one mapping, no unowned row -
     * which is the guarantee that matters and the one only a real database can show.
     */
    const subject = await owner();
    const repository = createAccountMusicRepository(pool);

    const results = await Promise.all(Array.from({ length: 4 }, () =>
      repository.ensureMusicAccount(subject.actor)));

    const ids = new Set(results.map((result) => result.musicUserId));
    expect(ids.size).toBe(1);
    expect(results.filter((result) => result.provisioned)).toHaveLength(1);

    const mappings = await pool.query<{ count: string }>(
      "SELECT count(*)::text FROM account_music_identity WHERE account_id=$1", [subject.accountId]);
    expect(mappings.rows[0].count).toBe("1");

    // No orphan: every venue bearing this account's deterministic username is mapped.
    const orphans = await pool.query<{ count: string }>(
      `SELECT count(*)::text FROM users u
        WHERE u.username=(SELECT username FROM users WHERE id=$1)
          AND NOT EXISTS (SELECT 1 FROM account_music_identity m WHERE m.music_user_id=u.id)`,
      [[...ids][0]]);
    expect(orphans.rows[0].count).toBe("0");
  });

  it("keeps two owners on two venues, each reachable only through its own mapping", async () => {
    const first = await owner();
    const second = await owner();
    const repository = createAccountMusicRepository(pool);

    const a = await repository.ensureMusicAccount(first.actor);
    const b = await repository.ensureMusicAccount(second.actor);

    expect(a.musicUserId).not.toBe(b.musicUserId);
    const rows = await pool.query<{ account_id: string; music_user_id: number }>(
      "SELECT account_id,music_user_id FROM account_music_identity WHERE account_id=ANY($1)",
      [[first.accountId, second.accountId]]);
    expect(rows.rows).toHaveLength(2);
    expect(new Set(rows.rows.map((row) => row.music_user_id)).size).toBe(2);
    // Distinct venue names too, so the deterministic derivation is per account and not
    // a constant that happened to be unique by insert order.
    expect((await venueOf(a.musicUserId)).username)
      .not.toBe((await venueOf(b.musicUserId)).username);
  });

  it("refuses an OAuth credential and writes nothing", async () => {
    const subject = await owner();
    const repository = createAccountMusicRepository(pool);
    const oauth: Actor = {
      ...subject.actor,
      credential: { kind: "oauth-grant", clientId: "client", scopes: ["music:owner"] } as Actor["credential"],
    };

    await expect(repository.ensureMusicAccount(oauth)).rejects.toMatchObject({ status: 403 });
    const mappings = await pool.query<{ count: string }>(
      "SELECT count(*)::text FROM account_music_identity WHERE account_id=$1", [subject.accountId]);
    expect(mappings.rows[0].count).toBe("0");
  });

  it("refuses a foreign account target without provisioning it", async () => {
    const subject = await owner();
    const victim = await owner();
    const repository = createAccountMusicRepository(pool);

    // The actor's own session, pointed at somebody else's account.
    await expect(repository.ensureMusicAccount({ ...subject.actor, accountId: victim.accountId }))
      .rejects.toMatchObject({ status: 404 });
    const mappings = await pool.query<{ count: string }>(
      "SELECT count(*)::text FROM account_music_identity WHERE account_id=$1", [victim.accountId]);
    expect(mappings.rows[0].count).toBe("0");
  });

  it("converges the venue name after the account is renamed", async () => {
    const subject = await owner();
    const repository = createAccountMusicRepository(pool);
    const ensured = await repository.ensureMusicAccount(subject.actor);

    await pool.query("UPDATE creator_accounts SET display_name=$2 WHERE id=$1",
      [subject.accountId, "Renamed Venue"]);
    const reused = await repository.ensureMusicAccount(subject.actor);

    expect(reused.musicUserId).toBe(ensured.musicUserId);
    expect((await venueOf(ensured.musicUserId)).venue_name).toBe("Renamed Venue");
  });

  it("refuses an unmapped canonical venue at COMMIT, so the NULLs are not a hole", async () => {
    // The guard that makes the previous cases safe. Migration 0039's deferred ownership
    // trigger has to reject a venue with both Strapi ids NULL and no mapping - otherwise
    // "no Strapi identifier" would simply mean "unowned", and the canonical shape above
    // would be indistinguishable from a leak.
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      /*
       * Pin the two things this assertion depends on, rather than trusting whatever the
       * pooled connection was last used for. Found by this case failing in a fourteen-file
       * run while passing alone: a constraint test that silently depends on ambient session
       * state reports "the guard is gone" when the truth is "triggers were off", which is a
       * worse failure than the one it exists to catch.
       *
       * `session_replication_role='origin'` is what makes triggers fire at all - other
       * suites legitimately set 'replica' to seed rows past these guards - and the trigger
       * is asserted enabled ('O' or 'A') so a dropped or disabled guard is distinguishable
       * from a disabled session.
       */
      await client.query("SET LOCAL session_replication_role='origin'");
      const guard = await client.query<{ tgenabled: string }>(
        `SELECT tgenabled FROM pg_trigger
          WHERE tgrelid='public.users'::regclass AND tgname='users_music_venue_owned'`);
      expect(guard.rowCount, "0039's ownership guard is missing from users").toBe(1);
      expect(["O", "A"]).toContain(guard.rows[0].tgenabled);

      await client.query(
        `INSERT INTO users(username,password,email,guest_url,venue_name,
           strapi_user_document_id,strapi_account_document_id,guest_capability_hash)
         VALUES ($1,NULL,NULL,$2,'Unowned',NULL,NULL,$3)`,
        [`explorer-${randomUUID().replace(/-/g, "").slice(0, 24)}`,
          randomUUID(), "a".repeat(64)]);
      await expect(client.query("COMMIT")).rejects.toBeDefined();
    } finally {
      await client.query("ROLLBACK").catch(() => undefined);
      client.release();
    }
  });
});
