import { describe, expect, it, vi } from "vitest";

const namespace = "e2e-public-music-capture";
const authority = Object.freeze({
  namespace,
  username: `${namespace}-owner`,
  accountDocumentId: `${namespace}-account`,
  userDocumentId: `${namespace}-user`,
});
const containerId = "a".repeat(64);
const databaseHash = "b".repeat(64);
const profileHash = "c".repeat(64);
const snapshotId = "00000000-0000-4000-8000-000000000012";
const hostile = "postgresql://owner:do-not-retain@127.0.0.1:55432/private C:\\private\\capture.sql token=do-not-retain";

async function loadCaptureContract(): Promise<Record<string, unknown>> {
  try {
    const modulePath: string = "../../../scripts/music-e2e-state-capture.mjs";
    return await import(modulePath);
  } catch {
    return {};
  }
}

function profileState(account: Record<string, unknown> = { public_music: "No", Bio: "Fixture" }) {
  return {
    version: "music-fixture-profile-state/v1",
    revision: 7,
    stateHash: profileHash,
    snapshot: { account },
  };
}

function adapters(events: string[] = []) {
  return {
    containerAuthority: vi.fn(async () => { events.push("container-authority"); return { containerId }; }),
    schemaInventory: vi.fn(async () => { events.push("schema-inventory"); return { attested: true }; }),
    pgDump: vi.fn(async ({ dataOnly }: { dataOnly: boolean }) => {
      events.push(dataOnly ? "pg-dump:data" : "pg-dump:full");
      return Buffer.from(dataOnly ? "COPY public.users FROM stdin;\n\\.\n" : "CREATE TABLE users();\n");
    }),
    identityCountQuery: vi.fn(async () => { events.push("identity-count-query"); return 1; }),
    profilePrivateFetch: vi.fn(async () => { events.push("profile-private-fetch"); return profileState(); }),
    snapshotStore: vi.fn(async () => { events.push("snapshot-store"); }),
  };
}

describe("Music initial state capture", () => {
  it("runs the exact production stages and returns only bounded snapshot metadata", async () => {
    const contract = await loadCaptureContract();
    const capture = contract.captureMusicFixtureState as undefined | ((input: Record<string, unknown>) => Promise<unknown>);
    expect(capture).toBeTypeOf("function");
    if (!capture) return;
    const events: string[] = [];
    const result = await capture({
      authority,
      initial: true,
      adapters: adapters(events),
      createSnapshotId: () => snapshotId,
      hashDump: () => databaseHash,
    });
    expect(events).toEqual([
      "container-authority", "schema-inventory", "pg-dump:full", "pg-dump:data",
      "identity-count-query", "profile-private-fetch", "snapshot-store",
    ]);
    expect(result).toEqual({
      version: "music-live-account-snapshot/v1",
      snapshotId,
      publication: { coveredByDatabaseDump: true },
      guestControls: { coveredByDatabaseDump: true },
      queue: { coveredByDatabaseDump: true },
      playlists: { coveredByDatabaseDump: true },
      requests: { coveredByDatabaseDump: true },
      profile: {
        accountDocumentId: authority.accountDocumentId,
        publicMusic: false,
        profileRevision: 7,
        profileHash,
        fieldCount: 2,
      },
      database: { namespace, dumpHash: databaseHash, identityRows: 1 },
    });
  });

  it("classifies every capture boundary with fixed stage/code and discards hostile errors", async () => {
    const contract = await loadCaptureContract();
    const capture = contract.captureMusicFixtureState as undefined | ((input: Record<string, unknown>) => Promise<unknown>);
    const safeFailure = contract.safeMusicFixtureCaptureFailure as undefined | ((error: unknown) => unknown);
    expect(capture).toBeTypeOf("function");
    expect(safeFailure).toBeTypeOf("function");
    if (!capture || !safeFailure) return;

    const cases: Array<{
      stage: string;
      code: string;
      mutate: (value: ReturnType<typeof adapters>) => Record<string, unknown>;
    }> = [
      { stage: "container-authority", code: "operation-failed", mutate: (value) => ({ ...value, containerAuthority: async () => { throw new Error(hostile); } }) },
      { stage: "schema-inventory", code: "operation-failed", mutate: (value) => ({ ...value, schemaInventory: async () => { throw new Error(hostile); } }) },
      { stage: "pg-dump", code: "operation-failed", mutate: (value) => ({ ...value, pgDump: async () => { throw new Error(hostile); } }) },
      { stage: "dump-hash", code: "operation-failed", mutate: (value) => ({ ...value, hashDump: () => { throw new Error(hostile); } }) },
      { stage: "identity-count-query", code: "operation-failed", mutate: (value) => ({ ...value, identityCountQuery: async () => { throw new Error(hostile); } }) },
      { stage: "profile-private-fetch", code: "operation-failed", mutate: (value) => ({ ...value, profilePrivateFetch: async () => { throw new Error(hostile); } }) },
      { stage: "profile-schema", code: "contract-invalid", mutate: (value) => ({ ...value, profilePrivateFetch: async () => ({ ...profileState(), stateHash: hostile }) }) },
      { stage: "profile-field-count", code: "contract-invalid", mutate: (value) => ({ ...value, profilePrivateFetch: async () => profileState({}) }) },
      { stage: "snapshot-store", code: "operation-failed", mutate: (value) => ({ ...value, snapshotStore: async () => { throw new Error(hostile); } }) },
    ];

    for (const entry of cases) {
      const base = adapters();
      const changed = entry.mutate(base);
      const hashDump = changed.hashDump ?? (() => databaseHash);
      delete changed.hashDump;
      let retained: unknown;
      try {
        await capture({ authority, adapters: changed, createSnapshotId: () => snapshotId, hashDump });
      } catch (error) {
        retained = safeFailure(error);
      }
      expect(retained, entry.stage).toEqual({
        schemaVersion: "music-e2e-state-capture-failure/v1",
        state: "failed",
        stage: entry.stage,
        code: entry.code,
      });
      expect(JSON.stringify(retained)).not.toContain("do-not-retain");
      expect(JSON.stringify(retained)).not.toContain("C:\\private");
    }
  });

  it("uses one fixed timeout code and refuses invalid authority before any adapter call", async () => {
    const contract = await loadCaptureContract();
    const capture = contract.captureMusicFixtureState as undefined | ((input: Record<string, unknown>) => Promise<unknown>);
    const safeFailure = contract.safeMusicFixtureCaptureFailure as undefined | ((error: unknown) => unknown);
    expect(capture).toBeTypeOf("function");
    expect(safeFailure).toBeTypeOf("function");
    if (!capture || !safeFailure) return;
    const timeout = Object.assign(new Error(hostile), { name: "TimeoutError" });
    let failure: unknown;
    try {
      await capture({
        authority,
        adapters: { ...adapters(), profilePrivateFetch: async () => { throw timeout; } },
        createSnapshotId: () => snapshotId,
        hashDump: () => databaseHash,
      });
    } catch (error) { failure = safeFailure(error); }
    expect(failure).toEqual({
      schemaVersion: "music-e2e-state-capture-failure/v1",
      state: "failed",
      stage: "profile-private-fetch",
      code: "operation-timeout",
    });

    const guarded = adapters();
    try {
      await capture({ authority: { ...authority, namespace: "production" }, adapters: guarded });
    } catch (error) { failure = safeFailure(error); }
    expect(failure).toEqual({
      schemaVersion: "music-e2e-state-capture-failure/v1",
      state: "failed",
      stage: "container-authority",
      code: "contract-invalid",
    });
    expect(Object.values(guarded).every((operation) => operation.mock.calls.length === 0)).toBe(true);
  });

  it("shares the exact parameterized identity query and private loopback endpoint codec", async () => {
    const contract = await loadCaptureContract();
    const buildQuery = contract.buildMusicFixtureIdentityCountPgQuery as undefined | ((value: typeof authority) => { text: string; values: string[] });
    const requestProfile = contract.requestMusicFixturePrivateProfileSnapshot as undefined | ((input: Record<string, unknown>) => Promise<unknown>);
    expect(buildQuery).toBeTypeOf("function");
    expect(requestProfile).toBeTypeOf("function");
    if (!buildQuery || !requestProfile) return;
    expect(buildQuery(authority)).toEqual({
      text: "SELECT count(*)::int AS count FROM users WHERE strapi_user_document_id = $1 AND strapi_account_document_id = $2 AND username = $3 AND identity_status = 'active';",
      values: [authority.userDocumentId, authority.accountDocumentId, authority.username],
    });

    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(profileState()), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    await expect(requestProfile({
      fetchImpl,
      origin: "http://127.0.0.1:51337",
      token: "x".repeat(43),
      authority,
    })).resolves.toEqual(profileState());
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:51337/__music-fixture/profile-state/snapshot",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: `Bearer ${"x".repeat(43)}`, "Content-Type": "application/json" },
        body: JSON.stringify(authority),
      }),
    );
    await expect(requestProfile({
      fetchImpl,
      origin: "https://example.com",
      token: "x".repeat(43),
      authority,
    })).rejects.toThrow("fixture profile endpoint authority is invalid");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
