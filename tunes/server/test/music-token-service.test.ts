import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  MusicTokenError,
  MusicTokenService,
  type MusicTokenConfiguration,
} from "../services/musicTokenService";

const NOW_SECONDS = 1_800_000_000;
const CURRENT_SECRET = Buffer.alloc(32, 0x41).toString("base64url");
const PREVIOUS_SECRET = Buffer.alloc(32, 0x42).toString("base64url");

function configuration(overrides: Partial<MusicTokenConfiguration> = {}): MusicTokenConfiguration {
  return {
    current: { kid: "music-current-2026-08", secret: CURRENT_SECRET },
    tokenLifetimeSeconds: 600,
    clockSkewSeconds: 15,
    ...overrides,
  };
}

function service(overrides: Partial<MusicTokenConfiguration> = {}, nowSeconds = NOW_SECONDS) {
  return new MusicTokenService(configuration(overrides), {
    now: () => nowSeconds * 1_000,
    randomBytes: (size) => Buffer.alloc(size, 0x7a),
  });
}

function encoded(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function rawToken(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  secret = CURRENT_SECRET,
): string {
  const unsigned = `${encoded(header)}.${encoded(payload)}`;
  const signature = createHmac("sha256", Buffer.from(secret, "base64url")).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
}

function validClaims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    iss: "explorers-tunes",
    aud: "music-api",
    sub: "strapi-user-document-id",
    jti: "0123456789abcdef0123456789abcdef",
    iat: NOW_SECONDS,
    exp: NOW_SECONDS + 600,
    sessionVersion: 7,
    ...overrides,
  };
}

function expectTokenError(operation: () => unknown, code: MusicTokenError["code"]): void {
  try {
    operation();
    throw new Error("expected MusicTokenError");
  } catch (error) {
    expect(error).toBeInstanceOf(MusicTokenError);
    expect((error as MusicTokenError).code).toBe(code);
  }
}

describe("scoped Music token service", () => {
  it("mints exactly the approved ten-minute HS256 header and claims without mutable identity data", () => {
    const result = service().mint({
      id: 99,
      strapiUserDocumentId: "strapi-user-document-id",
      strapiAccountDocumentId: "account-secret-context",
      identityStatus: "active",
      sessionVersion: 7,
    });
    const [headerPart, payloadPart] = result.token.split(".");
    expect(JSON.parse(Buffer.from(headerPart, "base64url").toString("utf8"))).toEqual({
      alg: "HS256",
      kid: "music-current-2026-08",
    });
    expect(JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"))).toEqual({
      iss: "explorers-tunes",
      aud: "music-api",
      sub: "strapi-user-document-id",
      jti: "7a".repeat(16),
      iat: NOW_SECONDS,
      exp: NOW_SECONDS + 600,
      sessionVersion: 7,
    });
    expect(result.expiresAt).toBe((NOW_SECONDS + 600) * 1_000);
    expect(service().verify(result.token)).toEqual(validClaims({ jti: "7a".repeat(16) }));
    expect(result.token).not.toContain("account-secret-context");
    expect(result.token).not.toContain("99");
  });

  it("uses a fresh 128-bit-or-greater jti for every token", () => {
    const tokenService = new MusicTokenService(configuration());
    const projection = {
      id: 1,
      strapiUserDocumentId: "subject",
      strapiAccountDocumentId: "account",
      identityStatus: "active" as const,
      sessionVersion: 1,
    };
    const claims = Array.from({ length: 50 }, () => tokenService.verify(tokenService.mint(projection).token));
    expect(new Set(claims.map(({ jti }) => jti)).size).toBe(50);
    expect(claims.every(({ jti }) => /^[a-f0-9]{32}$/.test(jti))).toBe(true);
  });

  it.each([
    ["none", { alg: "none", kid: "music-current-2026-08" }, ""],
    ["alternate algorithm", { alg: "HS384", kid: "music-current-2026-08" }, CURRENT_SECRET],
    ["missing kid", { alg: "HS256" }, CURRENT_SECRET],
    ["unknown kid", { alg: "HS256", kid: "unknown" }, CURRENT_SECRET],
  ])("rejects %s header", (_label, header, secret) => {
    const token = secret ? rawToken(header, validClaims(), secret) : `${encoded(header)}.${encoded(validClaims())}.`;
    expectTokenError(() => service().verify(token), "TOKEN_INVALID");
  });

  it("rejects a duplicate kid before JSON interpretation", () => {
    const header = Buffer.from('{"alg":"HS256","kid":"music-current-2026-08","kid":"other"}').toString("base64url");
    const payload = encoded(validClaims());
    const unsigned = `${header}.${payload}`;
    const signature = createHmac("sha256", Buffer.from(CURRENT_SECRET, "base64url")).update(unsigned).digest("base64url");
    expectTokenError(() => service().verify(`${unsigned}.${signature}`), "TOKEN_INVALID");
  });

  it.each([
    ["wrong issuer", { iss: "attacker" }],
    ["wrong audience", { aud: "other-api" }],
    ["missing subject", { sub: undefined }],
    ["missing jti", { jti: undefined }],
    ["wrong session type", { sessionVersion: "7" }],
    ["zero session", { sessionVersion: 0 }],
    ["fractional iat", { iat: NOW_SECONDS + 0.5 }],
    ["excessive lifetime", { exp: NOW_SECONDS + 601 }],
    ["short lifetime", { exp: NOW_SECONDS + 599 }],
    ["zero lifetime", { exp: NOW_SECONDS }],
    ["extra mutable claim", { username: "pii-user" }],
  ])("rejects %s", (_label, overrides) => {
    expectTokenError(() => service().verify(rawToken(
      { alg: "HS256", kid: "music-current-2026-08" },
      validClaims(overrides),
    )), "TOKEN_INVALID");
  });

  it("rejects header, payload, and signature tampering", () => {
    const valid = rawToken({ alg: "HS256", kid: "music-current-2026-08" }, validClaims());
    const [header, payload, signature] = valid.split(".");
    for (const token of [
      `${encoded({ alg: "HS256", kid: "other" })}.${payload}.${signature}`,
      `${header}.${encoded(validClaims({ sub: "attacker" }))}.${signature}`,
      `${header}.${payload}.${signature.slice(0, -1)}A`,
    ]) expectTokenError(() => service().verify(token), "TOKEN_INVALID");
  });

  it("enforces expiry and future-iat at the documented skew edges", () => {
    const header = { alg: "HS256", kid: "music-current-2026-08" };
    expect(service({}, NOW_SECONDS + 614).verify(rawToken(header, validClaims()))).toMatchObject({ sub: "strapi-user-document-id" });
    expectTokenError(() => service({}, NOW_SECONDS + 615).verify(rawToken(header, validClaims())), "TOKEN_EXPIRED");
    expect(service().verify(rawToken(header, validClaims({ iat: NOW_SECONDS + 15, exp: NOW_SECONDS + 615 })))).toMatchObject({ iat: NOW_SECONDS + 15 });
    expectTokenError(() => service().verify(rawToken(header, validClaims({ iat: NOW_SECONDS + 16, exp: NOW_SECONDS + 616 }))), "TOKEN_INVALID");
  });

  it("verifies but never signs with previous only before its hard cutoff", () => {
    const previous = {
      kid: "music-previous-2026-08",
      secret: PREVIOUS_SECRET,
      acceptUntil: (NOW_SECONDS + 100) * 1_000,
    };
    const token = rawToken({ alg: "HS256", kid: previous.kid }, validClaims(), PREVIOUS_SECRET);
    expect(service({ previous }, NOW_SECONDS + 99).verify(token)).toMatchObject({ sub: "strapi-user-document-id" });
    expectTokenError(() => service({ previous }, NOW_SECONDS + 100).verify(token), "TOKEN_INVALID");
    expectTokenError(() => service({ previous }, NOW_SECONDS + 101).verify(token), "TOKEN_INVALID");
    const mintedHeader = JSON.parse(Buffer.from(service({ previous }).mint({
      id: 1, strapiUserDocumentId: "subject", strapiAccountDocumentId: "account",
      identityStatus: "active", sessionVersion: 1,
    }).token.split(".")[0], "base64url").toString("utf8"));
    expect(mintedHeader.kid).toBe("music-current-2026-08");
  });
});
