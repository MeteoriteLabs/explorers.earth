import { describe, expect, it } from "vitest";
import { parseMusicEnvironment } from "../../config/music-environment.ts";

const validEnvironment = {
  MUSIC_MODE: "fixture",
  MUSIC_FIXTURE_VERSION: "1",
  STRAPI_FIXTURE_URL: "http://127.0.0.1:51337",
  DATABASE_URL_TEST: "postgresql://music:music@127.0.0.1:55432/music_fixture",
  SESSION_SECRET: "fixture-session-secret-at-least-32-characters",
  COOKIE_SECRET: "fixture-cookie-secret-at-least-32-characters",
  MUSIC_SIGNING_KEY_CURRENT_ID: "fixture-current",
  MUSIC_SIGNING_KEY_CURRENT_SECRET: "fixture-current-secret-at-least-32-chars",
  MUSIC_SIGNING_KEY_PREVIOUS_ID: "fixture-previous",
  MUSIC_SIGNING_KEY_PREVIOUS_SECRET: "fixture-previous-secret-at-least-32-chars",
  MUSIC_CONNECT_TIMEOUT_MS: "5000",
  MUSIC_READ_TIMEOUT_MS: "10000",
  MUSIC_CIRCUIT_FAILURE_THRESHOLD: "3",
  MUSIC_RATE_LIMIT_PER_MINUTE: "60",
  MUSIC_PROVISIONING_KILL_SWITCH: "true",
  MUSIC_PROVISIONING_COHORT: "disabled",
  MUSIC_EXPECTED_MIGRATION_ID: "0002_identity_lifecycle",
  MUSIC_RECONCILIATION_ENABLED: "false",
  MUSIC_RECONCILIATION_MAX_ROWS: "0",
};

describe("server-side Music environment contract", () => {
  it("parses validated numeric controls and recorded safe gates", () => {
    const environment = parseMusicEnvironment(validEnvironment);
    expect(environment).toMatchObject({
      MUSIC_CONNECT_TIMEOUT_MS: 5000,
      MUSIC_READ_TIMEOUT_MS: 10000,
      MUSIC_PROVISIONING_KILL_SWITCH: true,
      MUSIC_PROVISIONING_COHORT: "disabled",
      MUSIC_RECONCILIATION_ENABLED: false,
      MUSIC_RECONCILIATION_MAX_ROWS: 0,
    });
  });

  it("rejects a production-like database whose name merely contains the fixture suffix", () => {
    // Production break caught: substring allowlisting could accept a real host
    // or database such as production_music_fixture.
    expect(() =>
      parseMusicEnvironment({
        ...validEnvironment,
        DATABASE_URL_TEST: "postgresql://owner:secret@production.example.com:5432/production_music_fixture",
      }),
    ).toThrow("DATABASE_URL_TEST must exactly target 127.0.0.1:55432/music_fixture");
  });

  it("rejects a non-loopback Strapi fixture URL", () => {
    // Production break caught: fixture mode can silently call a live Strapi
    // host even though its database remains disposable.
    expect(() => parseMusicEnvironment({ ...validEnvironment, STRAPI_FIXTURE_URL: "https://strapi.example.com" })).toThrow(
      "STRAPI_FIXTURE_URL must exactly target http://127.0.0.1:51337",
    );
  });

  it("rejects out-of-range controls and unsafe recorded gates", () => {
    expect(() => parseMusicEnvironment({ ...validEnvironment, MUSIC_CONNECT_TIMEOUT_MS: "0" })).toThrow("MUSIC_CONNECT_TIMEOUT_MS must be between 100 and 60000");
    expect(() => parseMusicEnvironment({ ...validEnvironment, MUSIC_PROVISIONING_KILL_SWITCH: "false" })).toThrow("C0 requires the provisioning kill switch");
    expect(() => parseMusicEnvironment({ ...validEnvironment, MUSIC_RECONCILIATION_MAX_ROWS: "1" })).toThrow("C0 requires reconciliation disabled with zero rows");
  });
});

export { validEnvironment };
