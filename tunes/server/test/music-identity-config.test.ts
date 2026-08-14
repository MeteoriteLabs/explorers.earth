import { describe, expect, it, vi } from "vitest";
import {
  resolveMusicIdentityRuntimeConfig,
  type MusicIdentityAddressResolver,
} from "../config/music-identity-config";

const liveBase = {
  NODE_ENV: "production",
  MUSIC_MODE: "live",
  STRAPI_URL: "https://cms.example.com",
  MUSIC_STRAPI_ALLOWED_ORIGINS: "https://cms.example.com",
  TRUST_PROXY_HOPS: "1",
  MUSIC_TRUSTED_PROXY_IP: "172.31.250.2",
  MUSIC_IDENTITY_MAX_CONCURRENCY: "8",
  MUSIC_IDENTITY_MAX_PENDING: "32",
  MUSIC_IDENTITY_MAX_INFLIGHT: "32",
  MUSIC_IDENTITY_RETRIES: "2",
  MUSIC_CONNECT_TIMEOUT_MS: "2000",
  MUSIC_READ_TIMEOUT_MS: "4000",
  MUSIC_IDENTITY_OVERALL_TIMEOUT_MS: "10000",
  MUSIC_IDENTITY_CACHE_TTL_MS: "30000",
  MUSIC_CIRCUIT_FAILURE_THRESHOLD: "3",
  MUSIC_IDENTITY_CIRCUIT_OPEN_MS: "15000",
  MUSIC_RATE_LIMIT_PER_MINUTE: "30",
  MUSIC_IDENTITY_GLOBAL_RATE_PER_MINUTE: "300",
  MUSIC_IDENTITY_RATE_MAX_ENTRIES: "10000",
  MUSIC_TOKEN_CURRENT_KID: "music-current-2026-08",
  MUSIC_TOKEN_CURRENT_SECRET: Buffer.alloc(32, 0x51).toString("base64url"),
  MUSIC_TOKEN_LIFETIME_SECONDS: "600",
  MUSIC_TOKEN_CLOCK_SKEW_SECONDS: "15",
} as const;

const publicResolver: MusicIdentityAddressResolver = vi.fn(async () => ["8.8.8.8", "2606:4700:4700::1111"]);

describe("central Music identity startup configuration", () => {
  it.each([
    ["missing URL", { STRAPI_URL: undefined }],
    ["HTTP", { STRAPI_URL: "http://cms.example.com", MUSIC_STRAPI_ALLOWED_ORIGINS: "http://cms.example.com" }],
    ["userinfo", { STRAPI_URL: "https://user:pass@cms.example.com" }],
    ["path", { STRAPI_URL: "https://cms.example.com/api" }],
    ["query", { STRAPI_URL: "https://cms.example.com?x=1" }],
    ["fragment", { STRAPI_URL: "https://cms.example.com#x" }],
    ["not allowlisted", { STRAPI_URL: "https://other.example.com" }],
    ["malformed", { STRAPI_URL: "https://[broken" }],
    ["malformed trusted proxy", { MUSIC_TRUSTED_PROXY_IP: "not-an-ip" }],
  ])("rejects live %s before route registration", async (_label, overrides) => {
    await expect(resolveMusicIdentityRuntimeConfig({ ...liveBase, ...overrides }, { resolveAddresses: publicResolver }))
      .rejects.toThrow(/STRAPI|origin|URL|proxy/i);
  });

  it.each([
    "0.0.0.0", "127.0.0.1", "10.0.0.4", "169.254.1.2", "192.168.1.2", "100.64.0.1",
    "192.0.2.1", "192.88.99.1", "224.0.0.1",
    "::1", "64:ff9b::1", "100::1", "2001:1::1", "2001:db8::1", "2002:c0a8:101::", "fe80::1", "fd00::1",
  ])("rejects a live hostname resolving to non-public address %s", async (address) => {
    await expect(resolveMusicIdentityRuntimeConfig(liveBase, { resolveAddresses: async () => [address] }))
      .rejects.toThrow(/public|address|STRAPI/i);
  });

  it.each([
    ["MUSIC_IDENTITY_MAX_CONCURRENCY", "NaN"],
    ["MUSIC_IDENTITY_MAX_PENDING", "Infinity"],
    ["MUSIC_IDENTITY_MAX_INFLIGHT", "0"],
    ["MUSIC_IDENTITY_RETRIES", "-1"],
    ["MUSIC_CONNECT_TIMEOUT_MS", "0"],
    ["MUSIC_READ_TIMEOUT_MS", "-1"],
    ["MUSIC_IDENTITY_OVERALL_TIMEOUT_MS", "999999"],
    ["MUSIC_IDENTITY_CACHE_TTL_MS", "30001"],
    ["MUSIC_CIRCUIT_FAILURE_THRESHOLD", "0"],
    ["MUSIC_IDENTITY_CIRCUIT_OPEN_MS", "0"],
    ["MUSIC_RATE_LIMIT_PER_MINUTE", "0"],
    ["MUSIC_IDENTITY_GLOBAL_RATE_PER_MINUTE", "-1"],
    ["MUSIC_IDENTITY_RATE_MAX_ENTRIES", "1"],
    ["TRUST_PROXY_HOPS", "2"],
  ])("rejects invalid bounded control %s=%s", async (name, value) => {
    await expect(resolveMusicIdentityRuntimeConfig({ ...liveBase, [name]: value }, { resolveAddresses: publicResolver }))
      .rejects.toThrow(new RegExp(name));
  });

  it("enforces cross-field queue/deadline/rate bounds", async () => {
    for (const overrides of [
      { MUSIC_IDENTITY_MAX_PENDING: "4", MUSIC_IDENTITY_MAX_CONCURRENCY: "8" },
      { MUSIC_IDENTITY_MAX_INFLIGHT: "33", MUSIC_IDENTITY_MAX_PENDING: "32" },
      { MUSIC_IDENTITY_OVERALL_TIMEOUT_MS: "1000", MUSIC_READ_TIMEOUT_MS: "4000" },
      { MUSIC_IDENTITY_GLOBAL_RATE_PER_MINUTE: "10", MUSIC_RATE_LIMIT_PER_MINUTE: "30" },
    ]) {
      await expect(resolveMusicIdentityRuntimeConfig({ ...liveBase, ...overrides }, { resolveAddresses: publicResolver }))
        .rejects.toThrow(/bounded|must be|configuration/i);
    }
  });

  it("accepts only the exact declared fixture origin without DNS and pins every live DNS answer", async () => {
    const resolver = vi.fn(async () => ["8.8.8.8", "2606:4700:4700::1111"]);
    const live = await resolveMusicIdentityRuntimeConfig(liveBase, { resolveAddresses: resolver });
    expect(live.strapiOrigin).toBe("https://cms.example.com");
    expect(live.isTrustedProxy("::ffff:172.31.250.2")).toBe(true);
    expect(live.isTrustedProxy("172.31.250.3")).toBe(false);
    expect(live.pinnedAddresses).toEqual(["8.8.8.8", "2606:4700:4700::1111"]);
    expect(live.lookup("cms.example.com", { all: true })).resolves.toEqual([
      { address: "8.8.8.8", family: 4 }, { address: "2606:4700:4700::1111", family: 6 },
    ]);
    expect(live.lookup("cms.example.com", { family: 6 })).resolves.toEqual({
      address: "2606:4700:4700::1111", family: 6,
    });
    await expect(live.fetchImpl("https://other.example.com/api/users/me")).rejects.toThrow(/unpinned/i);
    expect(resolver).toHaveBeenCalledTimes(1);

    const fixture = await resolveMusicIdentityRuntimeConfig({
      ...liveBase,
      NODE_ENV: "test",
      MUSIC_MODE: "fixture",
      STRAPI_URL: "http://strapi:1337",
      MUSIC_FIXTURE_STRAPI_ORIGIN: "http://strapi:1337",
      TRUST_PROXY_HOPS: "0",
      MUSIC_TRUSTED_PROXY_IP: undefined,
    }, { resolveAddresses: vi.fn(async () => { throw new Error("fixture DNS must not run"); }) });
    expect(fixture.strapiOrigin).toBe("http://strapi:1337");
    await expect(resolveMusicIdentityRuntimeConfig({
      ...liveBase,
      NODE_ENV: "test",
      MUSIC_MODE: "fixture",
      STRAPI_URL: "http://127.0.0.1:1337",
      MUSIC_FIXTURE_STRAPI_ORIGIN: "http://strapi:1337",
      TRUST_PROXY_HOPS: "0",
      MUSIC_TRUSTED_PROXY_IP: undefined,
    })).rejects.toThrow(/fixture origin/i);
  });

  it("rejects the entire live answer set when even one resolved address is non-public", async () => {
    await expect(resolveMusicIdentityRuntimeConfig(liveBase, {
      resolveAddresses: async () => ["8.8.8.8", "127.0.0.1"],
    })).rejects.toThrow(/public addresses/i);
  });

  it.each([
    ["missing current kid", { MUSIC_TOKEN_CURRENT_KID: undefined }],
    ["missing current secret", { MUSIC_TOKEN_CURRENT_SECRET: undefined }],
    ["weak current secret", { MUSIC_TOKEN_CURRENT_SECRET: Buffer.alloc(31).toString("base64url") }],
    ["noncanonical current secret", { MUSIC_TOKEN_CURRENT_SECRET: "default-secret-with-at-least-thirty-two-characters" }],
    ["wrong token lifetime", { MUSIC_TOKEN_LIFETIME_SECONDS: "601" }],
    ["excess clock skew", { MUSIC_TOKEN_CLOCK_SKEW_SECONDS: "31" }],
    ["partial previous key", { MUSIC_TOKEN_PREVIOUS_KID: "previous" }],
    ["same key IDs", {
      MUSIC_TOKEN_PREVIOUS_KID: "music-current-2026-08",
      MUSIC_TOKEN_PREVIOUS_SECRET: Buffer.alloc(32, 0x52).toString("base64url"),
      MUSIC_TOKEN_PREVIOUS_ACCEPT_UNTIL: new Date(Date.now() + 60_000).toISOString(),
    }],
    ["non-UTC cutoff", {
      MUSIC_TOKEN_PREVIOUS_KID: "previous",
      MUSIC_TOKEN_PREVIOUS_SECRET: Buffer.alloc(32, 0x52).toString("base64url"),
      MUSIC_TOKEN_PREVIOUS_ACCEPT_UNTIL: "2026-08-14T12:00:00+05:30",
    }],
    ["unbounded overlap", {
      MUSIC_TOKEN_PREVIOUS_KID: "previous",
      MUSIC_TOKEN_PREVIOUS_SECRET: Buffer.alloc(32, 0x52).toString("base64url"),
      MUSIC_TOKEN_PREVIOUS_ACCEPT_UNTIL: new Date(Date.now() + 3_600_000).toISOString(),
    }],
  ])("rejects %s before route registration", async (_label, overrides) => {
    await expect(resolveMusicIdentityRuntimeConfig({ ...liveBase, ...overrides }, { resolveAddresses: publicResolver }))
      .rejects.toThrow(/token|key|kid|secret|lifetime|skew|overlap|UTC/i);
  });

  it("loads a live current/previous key only through explicit injected secret paths", async () => {
    const now = Date.now();
    const current = Buffer.alloc(32, 0x61).toString("base64url");
    const previous = Buffer.alloc(32, 0x62).toString("base64url");
    const readSecretFile = vi.fn(async (path: string) => ({
      "/run/secrets/music-current": `${current}\n`,
      "/run/secrets/music-previous": `${previous}\n`,
    })[path] ?? "");
    const config = await resolveMusicIdentityRuntimeConfig({
      ...liveBase,
      MUSIC_TOKEN_CURRENT_SECRET: undefined,
      MUSIC_TOKEN_CURRENT_SECRET_FILE: "/run/secrets/music-current",
      MUSIC_TOKEN_PREVIOUS_KID: "music-previous-2026-08",
      MUSIC_TOKEN_PREVIOUS_SECRET_FILE: "/run/secrets/music-previous",
      MUSIC_TOKEN_PREVIOUS_ACCEPT_UNTIL: new Date(now + 300_000).toISOString(),
    }, { resolveAddresses: publicResolver, readSecretFile, now: () => now });
    expect(config.musicToken).toEqual({
      current: { kid: "music-current-2026-08", secret: current },
      previous: {
        kid: "music-previous-2026-08",
        secret: previous,
        acceptUntil: new Date(now + 300_000).getTime(),
      },
      tokenLifetimeSeconds: 600,
      clockSkewSeconds: 15,
    });
    expect(readSecretFile).toHaveBeenCalledTimes(2);
  });
});
