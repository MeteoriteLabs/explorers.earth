import { describe, expect, it } from "vitest";
import {
  MusicPrincipalError,
  MusicPrincipalService,
  assertMusicResourceOwner,
  createMusicSocketCredentialVerifier,
  type MusicCredentialSubjectState,
} from "../middleware/musicPrincipal";
import { MusicTokenService, type MusicTokenConfiguration } from "../services/musicTokenService";

const NOW = 1_800_000_000_000;
const currentSecret = Buffer.alloc(32, 0x31).toString("base64url");
const previousSecret = Buffer.alloc(32, 0x32).toString("base64url");
const tokenConfiguration: MusicTokenConfiguration = {
  current: { kid: "current", secret: currentSecret },
  tokenLifetimeSeconds: 600,
  clockSkewSeconds: 10,
};
const active = {
  id: 41,
  strapiUserDocumentId: "subject-41",
  strapiAccountDocumentId: "account-41",
  identityStatus: "active" as const,
  sessionVersion: 3,
};

function tokenService(configuration = tokenConfiguration, now = NOW): MusicTokenService {
  return new MusicTokenService(configuration, { now: () => now, randomBytes: () => Buffer.alloc(16, 0x44) });
}

function repository(initial: MusicCredentialSubjectState) {
  let state = initial;
  return {
    resolveCredentialSubject: async () => state,
    set: (next: MusicCredentialSubjectState) => { state = next; },
  };
}

function expectPrincipalError(operation: () => Promise<unknown> | unknown, code: MusicPrincipalError["code"]) {
  return expect(Promise.resolve().then(operation)).rejects.toMatchObject({ code });
}

describe("local Music principal resolution", () => {
  it("derives the only numeric owner from a verified immutable subject and current DB truth", async () => {
    const tokens = tokenService();
    const token = tokens.mint(active).token;
    const service = new MusicPrincipalService(tokens, repository({ identity: active, tombstoned: false }));
    await expect(service.resolve(token)).resolves.toEqual({
      musicUserId: 41,
      subject: "subject-41",
      accountDocumentId: "account-41",
      sessionVersion: 3,
    });
  });

  it.each([
    ["missing user", { identity: undefined, tombstoned: false }, "TOKEN_REVOKED"],
    ["user tombstone", { identity: undefined, tombstoned: true }, "TOKEN_REVOKED"],
    ["Account tombstone", { identity: active, tombstoned: true }, "TOKEN_REVOKED"],
    ["suspended", { identity: { ...active, identityStatus: "suspended" as const }, tombstoned: false }, "IDENTITY_SUSPENDED"],
    ["pending deletion", { identity: { ...active, identityStatus: "pending_deletion" as const }, tombstoned: false }, "IDENTITY_PENDING_DELETION"],
    ["session mismatch", { identity: { ...active, sessionVersion: 4 }, tombstoned: false }, "TOKEN_REVOKED"],
  ])("rejects %s from local truth", async (_label, state, code) => {
    const tokens = tokenService();
    const service = new MusicPrincipalService(tokens, repository(state));
    await expectPrincipalError(() => service.resolve(tokens.mint(active).token), code as MusicPrincipalError["code"]);
  });

  it("rejects Strapi bearer material and a native session cannot substitute for a Music token", async () => {
    const service = new MusicPrincipalService(tokenService(), repository({ identity: active, tombstoned: false }));
    for (const credential of ["strapi-bearer-proof", "", "not-a-jwt"] as const) {
      await expectPrincipalError(() => service.resolve(credential), "TOKEN_INVALID");
    }
  });

  it("asserts resources against the resolved numeric DB owner, never a caller ID", () => {
    const principal = { musicUserId: 41, subject: "subject-41", accountDocumentId: "account-41", sessionVersion: 3 };
    expect(() => assertMusicResourceOwner(principal, 41)).not.toThrow();
    expect(() => assertMusicResourceOwner(principal, 42)).toThrow(expect.objectContaining({ code: "RESOURCE_FORBIDDEN" }));
  });

  it("rechecks signature rotation and local revocation for an already-connected socket", async () => {
    let now = NOW;
    const previousConfiguration: MusicTokenConfiguration = {
      ...tokenConfiguration,
      previous: { kid: "previous", secret: previousSecret, acceptUntil: NOW + 5_000 },
    };
    const previousSigner = new MusicTokenService({
      ...previousConfiguration,
      current: { kid: "previous", secret: previousSecret },
      previous: undefined,
    }, { now: () => now, randomBytes: () => Buffer.alloc(16, 0x55) });
    const verifierTokens = new MusicTokenService(previousConfiguration, { now: () => now });
    const local = repository({ identity: active, tombstoned: false });
    const socketVerifier = createMusicSocketCredentialVerifier(new MusicPrincipalService(verifierTokens, local));
    const context = await socketVerifier.handshake({ token: previousSigner.mint(active).token });
    await expect(socketVerifier.recheck(context)).resolves.toMatchObject({ musicUserId: 41 });
    local.set({ identity: { ...active, sessionVersion: 4 }, tombstoned: false });
    await expectPrincipalError(() => socketVerifier.recheck(context), "TOKEN_REVOKED");
    local.set({ identity: active, tombstoned: false });
    now = NOW + 5_000;
    await expectPrincipalError(() => socketVerifier.recheck(context), "TOKEN_INVALID");
  });
});
