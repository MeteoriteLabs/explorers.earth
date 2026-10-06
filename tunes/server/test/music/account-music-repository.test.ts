import { describe, expect, it } from "vitest";
import { createAccountMusicRepository } from "../../music/accountMusicRepository";
import { AuthorizationError } from "../../application/authorization";
import type { Actor } from "../../application/actor";

// Ticket 6.1 under ADR-007. These cover the provisioning logic: authority, the
// idempotency key, and the concurrency loser's behaviour. They deliberately do not
// claim to prove the database constraints — the deferred ownership triggers from
// migration 0039 and the real unique indexes are only exercised against the attested
// disposable Postgres, which no ordinary dev session can reach.

const ACCOUNT = "6f1a9c42-0d3b-4f27-9d61-2e8c5b7a4411";

const webSession: Actor = {
  userId: "auth-user-a", accountId: ACCOUNT, role: "owner",
  credential: { kind: "web-session", sessionId: "session-a", sessionVersion: 3 },
};
const oauth: Actor = {
  userId: "auth-user-a", accountId: ACCOUNT, role: "owner",
  credential: { kind: "oauth", grantId: "grant-a", scopes: ["music:owner"] },
};

type Reply = { rows?: unknown[]; rowCount?: number };

/** Replies are matched on a distinctive fragment of each statement. */
function fakePool(script: Array<[RegExp, Reply]>, log: string[] = []) {
  const answer = (sql: string): Reply => {
    const hit = script.find(([pattern]) => pattern.test(sql));
    return hit ? hit[1] : {};
  };
  // Parameters are recorded alongside the text, so a case can pin what a placeholder
  // actually carries rather than only that the statement has the right shape.
  const parameters: Array<{ sql: string; values: unknown[] }> = [];
  const run = async (sql: string, values?: unknown[]) => {
    const text = sql.replace(/\s+/g, " ").trim();
    log.push(text);  // not truncated: assertions inspect the VALUES list
    if (values) parameters.push({ sql: text, values });
    const reply = answer(sql);
    return { rows: reply.rows ?? [], rowCount: reply.rowCount ?? (reply.rows ?? []).length };
  };
  const client = { query: run, release: () => {} };
  return { pool: { query: run, connect: async () => client }, log, parameters, client };
}

const membership: [RegExp, Reply] = [
  /FROM account_memberships/,
  { rows: [{ status: "active", role: "owner", session_version: "3", blocked_at: null }] },
];
// authorizeOperation also proves the web session is live and at the actor's version.
const liveSession: [RegExp, Reply] = [/FROM auth_session/, { rows: [{ valid: true }] }];
const accountRow: [RegExp, Reply] = [/FROM creator_accounts WHERE id=/, { rows: [{ display_name: "Owner A", handle: "owner-a" }] }];

describe("canonical Music venue provisioning", () => {
  it("reuses an existing mapping without writing anything", async () => {
    const { pool, log } = fakePool([membership, liveSession, [/FROM account_music_identity/, { rows: [{ music_user_id: 41 }] }]]);
    const result = await createAccountMusicRepository(pool as never).ensureMusicAccount(webSession);

    expect(result).toEqual({ musicUserId: 41, accountId: ACCOUNT, provisioned: false });
    expect(log.some((entry) => /INSERT INTO/i.test(entry))).toBe(false);
    expect(log.some((entry) => /BEGIN/i.test(entry))).toBe(false);
  });

  it("provisions a venue and its mapping in one transaction, leaving password and both Strapi ids null", async () => {
    const statements: string[] = [];
    const { pool, log, parameters } = fakePool([
      membership, liveSession, accountRow,
      [/FROM account_music_identity/, { rows: [] }],
      [/INSERT INTO users/, { rows: [{ id: 77 }] }],
      [/INSERT INTO account_music_identity/, { rows: [{ account_id: ACCOUNT }] }],
    ], statements);
    const result = await createAccountMusicRepository(pool as never).ensureMusicAccount(webSession);

    expect(result).toEqual({ musicUserId: 77, accountId: ACCOUNT, provisioned: true });
    const order = log.filter((entry) => /BEGIN|INSERT INTO users|INSERT INTO account_music_identity|COMMIT|ROLLBACK/i.test(entry));
    expect(order[0]).toMatch(/BEGIN/i);
    expect(order[1]).toMatch(/INSERT INTO users/i);
    expect(order[2]).toMatch(/INSERT INTO account_music_identity/i);
    expect(order[3]).toMatch(/COMMIT/i);
    expect(order.some((entry) => /ROLLBACK/i.test(entry))).toBe(false);
    // ADR-007 decisions 3 and 4: no password is written to satisfy a constraint, and
    // no Strapi document id is written during canonical provisioning. Asserted on the
    // literal VALUES list so a later edit cannot quietly reintroduce either.
    const insert = log.find((entry) => /INSERT INTO users/i.test(entry)) ?? "";
    expect(insert).toContain("VALUES ($1,NULL,NULL,$2,$3,NULL,NULL,$4,$5)");
    expect(insert).toMatch(/password,.*strapi_user_document_id,strapi_account_document_id/s);
    // lifecycle_operation_id is NOT NULL with no default, so it has to be supplied.
    // Break caught: the placeholder is filled with a Strapi document id, or anything
    // else that would make a canonical venue look externally identified.
    expect(insert).toMatch(/guest_capability_hash,\s*lifecycle_operation_id\)/);
    const venueValues = parameters.find((entry) => /INSERT INTO users/i.test(entry.sql))?.values ?? [];
    expect(venueValues[4]).toBe(`canonical-provision:${ACCOUNT}`);
  });

  it("locks the account row before inserting, so same-account callers serialise", async () => {
    const { pool, log } = fakePool([
      membership, liveSession, accountRow,
      [/FROM account_music_identity/, { rows: [] }],
      [/INSERT INTO users/, { rows: [{ id: 78 }] }],
      [/INSERT INTO account_music_identity/, { rows: [{ account_id: ACCOUNT }] }],
    ]);
    await createAccountMusicRepository(pool as never).ensureMusicAccount(webSession);

    const lock = log.findIndex((entry) => /FOR UPDATE/i.test(entry));
    const insert = log.findIndex((entry) => /INSERT INTO users/i.test(entry));
    expect(lock).toBeGreaterThan(-1);
    expect(lock).toBeLessThan(insert);
  });

  it("discards its own venue row and reads the winner when it loses the mapping insert", async () => {
    let mappingReads = 0;
    const log: string[] = [];
    const script: Array<[RegExp, Reply]> = [
      membership, liveSession, accountRow,
      [/INSERT INTO users/, { rows: [{ id: 79 }] }],
      // The loser's ON CONFLICT DO NOTHING returns no row.
      [/INSERT INTO account_music_identity/, { rows: [], rowCount: 0 }],
    ];
    const run = async (sql: string) => {
      log.push(sql.replace(/\s+/g, " ").trim());  // not truncated: assertions inspect the VALUES list
      if (/FROM account_music_identity/.test(sql)) {
        mappingReads += 1;
        // Absent for both the fast-path read and the in-transaction read, which is
        // the real race: both callers insert a venue and one loses the mapping.
        // Present only on the re-read after this caller rolls back.
        const won = mappingReads > 2;
        return { rows: won ? [{ music_user_id: 41 }] : [], rowCount: won ? 1 : 0 };
      }
      const hit = script.find(([pattern]) => pattern.test(sql));
      return { rows: hit?.[1].rows ?? [], rowCount: hit?.[1].rowCount ?? (hit?.[1].rows ?? []).length };
    };
    const pool = { query: run, connect: async () => ({ query: run, release: () => {} }) };

    const result = await createAccountMusicRepository(pool as never).ensureMusicAccount(webSession);

    expect(result).toEqual({ musicUserId: 41, accountId: ACCOUNT, provisioned: false });
    // The orphan must not survive: the losing transaction rolls back and does not commit.
    expect(log.some((entry) => /ROLLBACK/i.test(entry))).toBe(true);
    expect(log.some((entry) => /COMMIT/i.test(entry))).toBe(false);
  });

  it("refuses an OAuth grant before touching the venue tables", async () => {
    const { pool, log } = fakePool([membership, liveSession]);
    await expect(createAccountMusicRepository(pool as never).ensureMusicAccount(oauth))
      .rejects.toBeInstanceOf(AuthorizationError);
    expect(log.some((entry) => /account_music_identity|INSERT INTO/i.test(entry))).toBe(false);
  });

  it("refuses a suspended or blocked owner", async () => {
    for (const state of [
      { status: "suspended", role: "owner", session_version: "3", blocked_at: null },
      { status: "active", role: "owner", session_version: "3", blocked_at: new Date() },
    ]) {
      const { pool, log } = fakePool([[/FROM account_memberships/, { rows: [state] }]]);
      await expect(createAccountMusicRepository(pool as never).ensureMusicAccount(webSession))
        .rejects.toBeInstanceOf(AuthorizationError);
      expect(log.some((entry) => /INSERT INTO/i.test(entry))).toBe(false);
    }
  });

  it("refuses a foreign account target", async () => {
    const foreign: Actor = { ...webSession, accountId: "11111111-2222-3333-4444-555555555555" };
    const { pool } = fakePool([membership, liveSession]);
    await expect(createAccountMusicRepository(pool as never)
      .ensureMusicAccount({ ...foreign, accountId: foreign.accountId })).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("fails closed when the canonical account does not exist", async () => {
    const { pool } = fakePool([
      membership, liveSession,
      [/FROM account_music_identity/, { rows: [] }],
      [/FROM creator_accounts WHERE id=/, { rows: [], rowCount: 0 }],
    ]);
    await expect(createAccountMusicRepository(pool as never).ensureMusicAccount(webSession))
      .rejects.toBeInstanceOf(AuthorizationError);
  });
});
