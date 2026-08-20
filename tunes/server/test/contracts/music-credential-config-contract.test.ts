import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../../../..");
const fixtureSecret = Buffer.alloc(32, 0x71).toString("base64url");

interface ComposeService {
  environment?: Record<string, string>;
  volumes?: Array<{ source: string; target: string; read_only?: boolean }>;
  build?: { args?: Record<string, string> };
}

function productionModel(): { services: Record<string, ComposeService> } {
  const digest = `sha256:${"a".repeat(64)}`;
  return JSON.parse(execFileSync("docker", ["compose", "--profile", "deployment", "-f", "docker-compose.yml", "config", "--format", "json"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      ACME_EMAIL: "ops@example.invalid", DB_USER: "legacy-owner", DB_PASS: "legacy-owner-password-sentinel", DB_NAME: "music",
      DB_MIGRATOR_USER: "music_migrator", DB_MIGRATOR_PASSWORD_FILE_HOST: "/opt/explorers/secrets/db-migrator",
      DB_RUNTIME_USER: "music_runtime_login", DB_RUNTIME_PASSWORD_FILE_HOST: "/opt/explorers/secrets/db-runtime",
      SESSION_SECRET: "session-secret-at-least-32-characters", COOKIE_SECRET: "cookie-secret-at-least-32-characters",
      STRAPI_URL: "https://cms.example.com", MUSIC_STRAPI_ALLOWED_ORIGINS: "https://cms.example.com",
      STRAPI_ACCESS_TOKEN: "read-token", STRAPI_JWT_SECRET: "jwt-secret-at-least-32-characters",
      MUSIC_GATE_ATTESTATION_KEY: "gate-secret-at-least-32-characters",
      MUSIC_TOKEN_CURRENT_KID: "production-current-2026-08",
      MUSIC_TOKEN_SECRET_DIRECTORY_HOST: "/opt/explorers/music-token-secrets",
      MUSIC_PUBLICATION_RESPONSE_CURRENT_KID: "production-publication-2026-08",
      MUSIC_PUBLICATION_RESPONSE_KEY_DIRECTORY_HOST: "/opt/explorers/music-publication-response",
      EXPLORERS_IMAGE: `ghcr.io/example/explorers@${digest}`,
      TUNES_BLUE_IMAGE: `ghcr.io/example/tunes@${digest}`, TUNES_BLUE_DIGEST: digest, TUNES_BLUE_COMMIT: "a".repeat(40),
      TUNES_GREEN_IMAGE: `ghcr.io/example/tunes@${digest}`, TUNES_GREEN_DIGEST: digest, TUNES_GREEN_COMMIT: "a".repeat(40),
      TUNES_CANDIDATE_IMAGE: `ghcr.io/example/tunes@${digest}`, TUNES_CANDIDATE_DIGEST: digest, TUNES_CANDIDATE_COMMIT: "a".repeat(40),
      TUNES_COMPAT_IMAGE: `ghcr.io/example/tunes@${digest}`,
    },
  })) as { services: Record<string, ComposeService> };
}

describe("C5 credential configuration contracts", () => {
  it("renders production key paths and bounded settings without key material", () => {
    const model = productionModel();
    const runtime = model.services["tunes-blue"];
    expect(runtime.environment).toMatchObject({
      MUSIC_TOKEN_CURRENT_KID: "production-current-2026-08",
      MUSIC_TOKEN_CURRENT_SECRET_FILE: "/run/secrets/music-token/current",
      MUSIC_TOKEN_PREVIOUS_SECRET_FILE: "",
      MUSIC_TOKEN_LIFETIME_SECONDS: "600",
      MUSIC_PUBLICATION_RESPONSE_CURRENT_KID: "production-publication-2026-08",
      MUSIC_PUBLICATION_RESPONSE_CURRENT_KEY_FILE: "/run/secrets/music-publication-response/current",
      MUSIC_PUBLICATION_RESPONSE_PREVIOUS_KEY_FILE: "",
    });
    expect(runtime.volumes).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "/opt/explorers/music-token-secrets", target: "/run/secrets/music-token", read_only: true }),
      expect.objectContaining({ source: "/opt/explorers/music-publication-response", target: "/run/secrets/music-publication-response", read_only: true }),
    ]));
    const rendered = JSON.stringify(model);
    expect(rendered).not.toContain(fixtureSecret);
    expect(runtime.environment).not.toHaveProperty("MUSIC_TOKEN_CURRENT_SECRET");
    expect(runtime.environment).not.toHaveProperty("MUSIC_PUBLICATION_RESPONSE_CURRENT_KEY");
  });

  it("renders separate file-backed migrator/runtime authority without any password value", () => {
    const model = productionModel();
    const runtime = model.services["tunes-blue"];
    const gate = model.services["tunes-gate"];
    const database = model.services.db;
    const runtimeEnvironment = runtime.environment ?? {};
    const gateEnvironment = gate.environment ?? {};

    expect(runtimeEnvironment).not.toHaveProperty("DATABASE_URL");
    expect(runtimeEnvironment).toMatchObject({
      MUSIC_DATABASE_USER: "music_runtime_login",
      MUSIC_DATABASE_PASSWORD_FILE: "/run/secrets/music-db-runtime",
    });
    expect(gateEnvironment).toMatchObject({
      MUSIC_DATABASE_USER: "music_migrator",
      MUSIC_DATABASE_PASSWORD_FILE: "/run/secrets/music-db-migrator",
      MUSIC_RUNTIME_DATABASE_USER: "music_runtime_login",
      MUSIC_RUNTIME_DATABASE_PASSWORD_FILE: "/run/secrets/music-db-runtime",
    });
    expect(database.environment).toMatchObject({
      POSTGRES_USER: "music_migrator",
      POSTGRES_PASSWORD_FILE: "/run/secrets/music-db-migrator",
    });
    expect(database.environment).not.toHaveProperty("POSTGRES_PASSWORD");
    expect(runtime.volumes).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "/opt/explorers/secrets/db-runtime", target: "/run/secrets/music-db-runtime", read_only: true }),
    ]));
    expect(runtime.volumes).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ target: "/run/secrets/music-db-migrator" }),
    ]));
    expect(gate.volumes).toEqual(expect.arrayContaining([
      expect.objectContaining({ target: "/run/secrets/music-db-migrator", read_only: true }),
      expect.objectContaining({ target: "/run/secrets/music-db-runtime", read_only: true }),
    ]));
    const rendered = JSON.stringify(model);
    expect(rendered).not.toContain("legacy-owner-password-sentinel");
    expect(rendered).not.toMatch(/postgres(?:ql)?:\/\/[^"@]+:[^"@]+@/);
  });

  it("uses generated fixture files and never checks a token secret into Compose or examples", () => {
    const compose = readFileSync(resolve(repositoryRoot, "docker-compose.music-test.yml"), "utf8");
    const examples = [".env.music.example", ".env.music.test.example"]
      .map((name) => readFileSync(resolve(repositoryRoot, name), "utf8")).join("\n");
    expect(compose).toContain("MUSIC_TOKEN_CURRENT_SECRET_FILE: /run/secrets/music-token/current");
    expect(compose).toContain("${MUSIC_TOKEN_SECRET_FILE_HOST:?MUSIC_TOKEN_SECRET_FILE_HOST is required}:/run/secrets/music-token/current:ro");
    expect(compose).not.toContain("./.artifacts/music-token-secrets:/run/secrets/music-token:ro");
    expect(compose).toContain("POSTGRES_PASSWORD_FILE: /run/secrets/music-db-migrator");
    expect(compose).not.toMatch(/POSTGRES_PASSWORD:\s/);
    expect(compose).not.toMatch(/postgresql:\/\/[^\s:$]+:[^\s@]+@/);
    expect(compose).not.toMatch(/MUSIC_TOKEN_CURRENT_SECRET:\s*[^$]/);
    expect(examples).toContain("MUSIC_TOKEN_CURRENT_SECRET_FILE=/run/secrets/music-token/current");
    expect(examples).toContain("MUSIC_TOKEN_PREVIOUS_SECRET_FILE=/run/secrets/music-token/previous");
    expect(examples).not.toContain(fixtureSecret);
  });

  it("keeps all credential material out of browser source and built-time variable names", () => {
    const source = readFileSync(resolve(repositoryRoot, "explorers-earth/src/lib/localTunesApiClient.ts"), "utf8");
    expect(source).not.toMatch(/MUSIC_TOKEN_|SIGNING_KEY|import\.meta\.env/);
    for (const service of Object.values(productionModel().services)) {
      expect(Object.keys(service.build?.args ?? {})).not.toEqual(expect.arrayContaining([
        expect.stringMatching(/MUSIC_TOKEN_|SIGNING_KEY|DATABASE|PASSWORD|SECRET/i),
      ]));
    }
  });
});
