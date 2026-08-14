import { describe, expect, it, vi } from "vitest";
import { MusicIdentityRepository } from "../repositories/musicIdentityRepository";

function clientFor(sessionVersion: number | undefined) {
  const queries: Array<{ sql: string; values?: unknown[] }> = [];
  const client = {
    query: vi.fn(async (sql: string, values?: unknown[]) => {
      queries.push({ sql, values });
      if (/SELECT id,strapi_user_document_id/.test(sql)) {
        return sessionVersion === undefined ? { rows: [], rowCount: 0 } : {
          rows: [{
            id: 41,
            strapi_user_document_id: "subject-41",
            strapi_account_document_id: "account-41",
            identity_status: "active",
            session_version: sessionVersion,
          }],
          rowCount: 1,
        };
      }
      if (/UPDATE users SET session_version/.test(sql)) {
        return { rows: [{
          id: 41,
          strapi_user_document_id: "subject-41",
          strapi_account_document_id: "account-41",
          identity_status: "active",
          session_version: sessionVersion! + 1,
        }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }),
    release: vi.fn(),
  };
  return { client, queries };
}

describe("Music credential repository primitives", () => {
  it("resolves user and Account tombstones in the same local truth query", async () => {
    const query = vi.fn(async () => ({ rows: [{
      id: 41,
      strapi_user_document_id: "subject-41",
      strapi_account_document_id: "account-41",
      identity_status: "active",
      session_version: 3,
      tombstoned: true,
    }] }));
    const repository = new MusicIdentityRepository({ query } as never);
    await expect(repository.resolveCredentialSubject("subject-41")).resolves.toEqual({
      identity: {
        id: 41,
        strapiUserDocumentId: "subject-41",
        strapiAccountDocumentId: "account-41",
        identityStatus: "active",
        sessionVersion: 3,
      },
      tombstoned: true,
    });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain("music_identity_tombstones");
    expect(query.mock.calls[0][0]).toContain("strapi_account_document_id");
  });

  it.each(["logout_all", "entitlement_security_revocation", "credential_compromise"] as const)(
    "atomically increments sessionVersion for %s and treats exact expected-version retry as complete",
    async (reason) => {
      const first = clientFor(3);
      const repository = new MusicIdentityRepository({
        query: vi.fn(), connect: async () => first.client,
      } as never);
      await expect(repository.revokeAllCredentials({
        musicUserId: 41, expectedSessionVersion: 3, reason,
      })).resolves.toMatchObject({ id: 41, sessionVersion: 4 });
      expect(first.queries.map(({ sql }) => sql.trim().split(/\s+/).slice(0, 3).join(" "))).toEqual([
        "BEGIN",
        "SELECT id,strapi_user_document_id, strapi_account_document_id,identity_status,session_version",
        "UPDATE users SET",
        "COMMIT",
      ]);

      const retry = clientFor(4);
      const retried = new MusicIdentityRepository({ query: vi.fn(), connect: async () => retry.client } as never);
      await expect(retried.revokeAllCredentials({
        musicUserId: 41, expectedSessionVersion: 3, reason,
      })).resolves.toMatchObject({ sessionVersion: 4 });
      expect(retry.queries.some(({ sql }) => /UPDATE users SET session_version/.test(sql))).toBe(false);
    },
  );

  it("rolls back missing and impossible version requests without partial writes", async () => {
    for (const [version, expected] of [[undefined, 1], [5, 7], [5, 2]] as const) {
      const fixture = clientFor(version);
      const repository = new MusicIdentityRepository({ query: vi.fn(), connect: async () => fixture.client } as never);
      await expect(repository.revokeAllCredentials({
        musicUserId: 41, expectedSessionVersion: expected, reason: "logout_all",
      })).rejects.toMatchObject({ code: "IDENTITY_CONFLICT" });
      expect(fixture.queries.some(({ sql }) => /UPDATE users SET session_version/.test(sql))).toBe(false);
      expect(fixture.queries.at(-1)?.sql).toBe("ROLLBACK");
    }
  });
});
