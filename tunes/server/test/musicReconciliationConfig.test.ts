import { describe, expect, it } from "vitest";
import {
  parseMusicReconciliationCommandConfig,
  validateMusicReconciliationServiceToken,
} from "../config/music-reconciliation-config";
import { resolveMusicIdentityTransportConfig } from "../config/music-identity-config";

const fixture = {
  MUSIC_MODE: "fixture",
  MUSIC_STRAPI_HOST_PORT: "51337",
  STRAPI_FIXTURE_URL: "http://127.0.0.1:51337",
  STRAPI_RECONCILIATION_TOKEN: "fixture-read-only-token",
};

describe("music reconciliation command configuration", () => {
  it("defaults every control to bounded report-only fixture values", () => {
    expect(parseMusicReconciliationCommandConfig(fixture)).toEqual({
      environment: "fixture",
      applyEnabled: false,
      liveContractVerified: false,
      sourceUrl: "http://127.0.0.1:51337",
      serviceToken: "fixture-read-only-token",
      pageSize: 100,
      maxRows: 1_000,
      batchSize: 100,
      maxChangeAbsolute: 0,
      maxChangePercent: 0,
      maxPages: 100,
      scanTimeoutMs: 300_000,
      timeoutMs: 10_000,
      maxResponseBytes: 1_048_576,
      maxCanonicalBytes: 16 * 1024 * 1024,
      databaseLockTimeoutMs: 5_000,
      databaseStatementTimeoutMs: 120_000,
      databaseIdleTransactionTimeoutMs: 30_000,
    });
  });

  it("parses explicit bounded thresholds separately from the C0 startup gates", () => {
    expect(parseMusicReconciliationCommandConfig({
      ...fixture,
      MUSIC_RECONCILIATION_ENVIRONMENT: "fixture",
      MUSIC_RECONCILIATION_APPLY_ENABLED: "true",
      MUSIC_RECONCILIATION_PAGE_SIZE: "20",
      MUSIC_RECONCILIATION_SCAN_MAX_ROWS: "500",
      MUSIC_RECONCILIATION_BATCH_SIZE: "25",
      MUSIC_RECONCILIATION_MAX_CHANGE_ABSOLUTE: "3",
      MUSIC_RECONCILIATION_MAX_CHANGE_PERCENT: "1.5",
      MUSIC_RECONCILIATION_TIMEOUT_MS: "5000",
      MUSIC_RECONCILIATION_MAX_RESPONSE_BYTES: "65536",
      MUSIC_RECONCILIATION_ENABLED: "false",
      MUSIC_RECONCILIATION_MAX_ROWS: "0",
    })).toMatchObject({ applyEnabled: true, pageSize: 20, maxRows: 500, batchSize: 25, maxChangeAbsolute: 3, maxChangePercent: 1.5 });
  });

  it("accepts an authenticated explicit loopback fixture port without widening the source boundary", () => {
    expect(parseMusicReconciliationCommandConfig({
      ...fixture,
      MUSIC_STRAPI_HOST_PORT: "52359",
      STRAPI_FIXTURE_URL: "http://127.0.0.1:52359",
    })).toMatchObject({ sourceUrl: "http://127.0.0.1:52359" });
  });

  it("requires an attested, HTTPS, dedicated file-backed authority for live reads", () => {
    const live = {
      MUSIC_MODE: "live",
      MUSIC_RECONCILIATION_ENVIRONMENT: "staging",
      MUSIC_RECONCILIATION_APPLY_ENABLED: "false",
      MUSIC_RECONCILIATION_LIVE_CONTRACT_VERIFIED: "true",
      STRAPI_URL: "https://strapi.example.test",
      STRAPI_RECONCILIATION_TOKEN_FILE: "/run/secrets/strapi-reconciliation",
    };
    expect(parseMusicReconciliationCommandConfig(live)).toMatchObject({
      environment: "staging",
      liveContractVerified: true,
      sourceUrl: "https://strapi.example.test",
      serviceTokenFile: "/run/secrets/strapi-reconciliation",
      serviceToken: undefined,
    });
    for (const invalid of [
      { ...live, MUSIC_RECONCILIATION_LIVE_CONTRACT_VERIFIED: "false" },
      { ...live, STRAPI_URL: "http://strapi.example.test" },
      { ...live, STRAPI_RECONCILIATION_TOKEN_FILE: undefined },
      { ...live, STRAPI_RECONCILIATION_TOKEN: "inline-is-forbidden" },
      { ...live, STRAPI_RECONCILIATION_TOKEN_FILE: "/run/secrets/strapi-lifecycle", STRAPI_LIFECYCLE_PROOF_TOKEN_FILE: "/run/secrets/strapi-lifecycle" },
      { ...live, STRAPI_RECONCILIATION_TOKEN_FILE: "/run/secrets/../secrets/strapi-lifecycle", STRAPI_LIFECYCLE_PROOF_TOKEN_FILE: "/run/secrets/strapi-lifecycle" },
      { ...live, MUSIC_RECONCILIATION_ENVIRONMENT: "fixture" },
    ]) expect(() => parseMusicReconciliationCommandConfig(invalid)).toThrow();
    expect(() => validateMusicReconciliationServiceToken("short")).toThrow();
    expect(() => validateMusicReconciliationServiceToken(` ${"a".repeat(16)}`)).toThrow();
    expect(() => validateMusicReconciliationServiceToken(`${"a".repeat(16)}\n`)).toThrow();
    expect(validateMusicReconciliationServiceToken("a".repeat(16))).toBe("a".repeat(16));
  });

  it("resolves the pinned live transport without loading Music signing or lifecycle authorities", async () => {
    const transport = await resolveMusicIdentityTransportConfig({
      MUSIC_MODE: "live",
      STRAPI_URL: "https://strapi.example.test",
      MUSIC_STRAPI_ALLOWED_ORIGINS: "https://strapi.example.test",
      MUSIC_IDENTITY_MAX_CONCURRENCY: "2",
    }, { resolveAddresses: async () => ["93.184.216.34"] });
    expect(transport.strapiOrigin).toBe("https://strapi.example.test");
    expect(transport.pinnedAddresses).toEqual(["93.184.216.34"]);
    expect(transport.fetchImpl).toBeTypeOf("function");
  });

  it("permanently rejects production apply and invalid numeric bounds", () => {
    expect(() => parseMusicReconciliationCommandConfig({
      MUSIC_MODE: "live",
      MUSIC_RECONCILIATION_ENVIRONMENT: "production",
      MUSIC_RECONCILIATION_APPLY_ENABLED: "true",
      MUSIC_RECONCILIATION_LIVE_CONTRACT_VERIFIED: "true",
      STRAPI_URL: "https://strapi.example.test",
      STRAPI_RECONCILIATION_TOKEN_FILE: "/run/secrets/strapi-reconciliation",
    })).toThrow(/production/i);
    for (const invalid of ["0", "100001", "1.2", "not-a-number"]) {
      expect(() => parseMusicReconciliationCommandConfig({ ...fixture, MUSIC_RECONCILIATION_SCAN_MAX_ROWS: invalid })).toThrow();
    }
  });

  it("fails closed across malformed command-only controls and authorities", () => {
    const invalidFixtureValues: Array<Record<string, unknown>> = [
      { ...fixture, MUSIC_MODE: "unknown" },
      { ...fixture, MUSIC_RECONCILIATION_ENVIRONMENT: "staging" },
      { ...fixture, MUSIC_RECONCILIATION_APPLY_ENABLED: "yes" },
      { ...fixture, MUSIC_RECONCILIATION_MAX_CHANGE_PERCENT: "not-percent" },
      { ...fixture, MUSIC_RECONCILIATION_MAX_CHANGE_PERCENT: "101" },
      { ...fixture, MUSIC_RECONCILIATION_MAX_CHANGE_PERCENT: "9".repeat(400) },
      { ...fixture, STRAPI_FIXTURE_URL: "http://127.0.0.1:51337/path" },
      { ...fixture, STRAPI_FIXTURE_URL: "http://127.0.0.1:51337/?query=1" },
      { ...fixture, STRAPI_FIXTURE_URL: "http://127.0.0.1:51337/#fragment" },
      { ...fixture, MUSIC_STRAPI_HOST_PORT: "52359", STRAPI_FIXTURE_URL: "http://127.0.0.1:51337" },
      { ...fixture, MUSIC_STRAPI_HOST_PORT: "80", STRAPI_FIXTURE_URL: "http://127.0.0.1:80" },
      { ...fixture, MUSIC_STRAPI_HOST_PORT: "", STRAPI_FIXTURE_URL: "http://127.0.0.1:51337" },
      { ...fixture, MUSIC_STRAPI_HOST_PORT: "55000", STRAPI_FIXTURE_URL: "http://127.0.0.1:55000" },
      { ...fixture, MUSIC_STRAPI_HOST_PORT: "52359", STRAPI_FIXTURE_URL: "http://localhost:52359" },
      { ...fixture, MUSIC_STRAPI_HOST_PORT: "52359", STRAPI_FIXTURE_URL: "http://user@127.0.0.1:52359" },
      { ...fixture, STRAPI_RECONCILIATION_TOKEN: "wrong" },
      { ...fixture, STRAPI_RECONCILIATION_TOKEN: "" },
    ];
    for (const invalid of invalidFixtureValues) expect(() => parseMusicReconciliationCommandConfig(invalid)).toThrow();

    const live = {
      MUSIC_MODE: "live",
      MUSIC_RECONCILIATION_ENVIRONMENT: "staging",
      MUSIC_RECONCILIATION_LIVE_CONTRACT_VERIFIED: "true",
      STRAPI_URL: "https://strapi.example.test",
      STRAPI_RECONCILIATION_TOKEN_FILE: "/run/secrets/strapi-reconciliation",
    };
    for (const invalid of [
      { ...live, MUSIC_RECONCILIATION_ENVIRONMENT: "" },
      { ...live, STRAPI_URL: "https://user@strapi.example.test" },
      { ...live, STRAPI_URL: "https://user:password@strapi.example.test" },
      { ...live, STRAPI_RECONCILIATION_TOKEN_FILE: " ".repeat(2) },
      { ...live, STRAPI_RECONCILIATION_TOKEN_FILE: "x".repeat(4_097) },
    ]) expect(() => parseMusicReconciliationCommandConfig(invalid)).toThrow();
    expect(parseMusicReconciliationCommandConfig({ ...live, STRAPI_ACCESS_TOKEN_FILE: "/run/secrets/another-token" }))
      .toMatchObject({ environment: "staging" });
  });
});
