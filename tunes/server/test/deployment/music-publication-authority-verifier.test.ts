import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { verifyPublicationAuthority } from "../../../deployment/verify-publication-authority.mjs";

const script = resolve(import.meta.dirname, "../../../deployment/verify-publication-authority.mjs");
const encoded = (byte: number) => Buffer.alloc(32, byte).toString("base64url");

describe("privileged publication authority separation verifier", () => {
  let root: string;
  let environmentPath: string;
  let hmacPath: string;
  let paths: Record<string, string>;

  const secret = (name: string, value: string) => {
    const path = join(root, name);
    writeFileSync(path, value, { mode: 0o600 });
    chmodSync(path, 0o600);
    return path;
  };
  const writeEnvironment = (overrides: Record<string, string> = {}) => {
    const values = {
      MUSIC_PUBLICATION_RESPONSE_KEY_DIRECTORY_HOST: paths.publication,
      MUSIC_PUBLICATION_RESPONSE_PREVIOUS_KID: "publication-previous-v1",
      MUSIC_PUBLICATION_RESPONSE_PREVIOUS_KEY_FILE: "/run/secrets/music-publication-response/previous",
      MUSIC_PUBLICATION_RESPONSE_PREVIOUS_ACCEPT_UNTIL: "2026-08-22T00:00:00.000Z",
      MUSIC_TOKEN_SECRET_DIRECTORY_HOST: paths.token,
      MUSIC_TOKEN_PREVIOUS_KID: "token-previous-v1",
      MUSIC_TOKEN_PREVIOUS_SECRET_FILE: "/run/secrets/music-token/previous",
      MUSIC_TOKEN_PREVIOUS_ACCEPT_UNTIL: "2026-08-22T00:00:00.000Z",
      DB_RUNTIME_PASSWORD_FILE_HOST: paths.runtimeDatabase,
      DB_MIGRATOR_PASSWORD_FILE_HOST: paths.migratorDatabase,
      STRAPI_LIFECYCLE_PROOF_TOKEN_FILE_HOST: paths.lifecycleProof,
      STRAPI_RECONCILIATION_TOKEN_FILE_HOST: paths.reconciliation,
      SESSION_SECRET: "dedicated-session-authority",
      COOKIE_SECRET: "dedicated-cookie-authority",
      STRAPI_ACCESS_TOKEN: "dedicated-strapi-access-authority",
      STRAPI_JWT_SECRET: "dedicated-strapi-jwt-authority",
      MUSIC_GATE_ATTESTATION_KEY: "dedicated-gate-attestation-authority",
      MUSIC_SIGNING_KEY_CURRENT_SECRET: "dedicated-signing-current-authority",
      MUSIC_SIGNING_KEY_PREVIOUS_SECRET: "dedicated-signing-previous-authority",
      ...overrides,
    };
    writeFileSync(environmentPath, Object.entries(values).map(([key, value]) => `${key}=${value}`).join("\n") + "\n", { mode: 0o600 });
    chmodSync(environmentPath, 0o600);
  };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "music-publication-authority-"));
    const publication = join(root, "publication");
    const token = join(root, "token");
    mkdirSync(publication);
    mkdirSync(token);
    secret("publication/current", encoded(0x70));
    secret("publication/previous", encoded(0x71));
    secret("token/current", encoded(0x72));
    secret("token/previous", encoded(0x73));
    paths = {
      publication,
      token,
      runtimeDatabase: secret("database-runtime", "dedicated-runtime-password"),
      migratorDatabase: secret("database-migrator", "dedicated-migrator-password"),
      lifecycleProof: secret("strapi-lifecycle", "dedicated-lifecycle-proof"),
      reconciliation: secret("strapi-reconciliation", "dedicated-reconciliation-proof"),
    };
    environmentPath = join(root, "production.env");
    hmacPath = secret("deployment-hmac", "dedicated-deployment-hmac-authority");
    writeEnvironment();
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("accepts distinct current/previous publication material without exposing any authority", async () => {
    await expect(verifyPublicationAuthority(environmentPath, hmacPath)).resolves.toBeUndefined();
  });

  it.each([
    ["runtime database content", () => writeFileSync(paths.runtimeDatabase, encoded(0x70))],
    ["migrator database identity", () => writeEnvironment({ DB_MIGRATOR_PASSWORD_FILE_HOST: join(paths.publication, "current") })],
    ["deployment HMAC content", () => writeFileSync(hmacPath, encoded(0x70))],
    ["token content", () => writeFileSync(join(paths.token, "current"), encoded(0x70))],
    ["lifecycle proof content", () => writeFileSync(paths.lifecycleProof, encoded(0x70))],
    ["reconciliation content", () => writeFileSync(paths.reconciliation, encoded(0x70))],
    ["session content", () => writeEnvironment({ SESSION_SECRET: encoded(0x70) })],
    ["Strapi access content", () => writeEnvironment({ STRAPI_ACCESS_TOKEN: encoded(0x70) })],
    ["publication current/previous content", () => writeFileSync(join(paths.publication, "previous"), encoded(0x70))],
  ])("fails closed for shared %s with a contained error", async (_label, arrange) => {
    arrange();
    const error = await verifyPublicationAuthority(environmentPath, hmacPath).catch((cause) => cause);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("Publication authority verification failed.");
    expect(error.message).not.toContain(encoded(0x70));
  });

  it("CLI output contains no authority material on failure", () => {
    writeEnvironment({ COOKIE_SECRET: encoded(0x70) });
    const result = spawnSync(process.execPath, [script, environmentPath, hmacPath], { encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr.trim()).toBe("Publication authority verification failed.");
    expect(`${result.stdout}${result.stderr}`).not.toContain(encoded(0x70));
  });
});
