import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../../../..");
const fixtureSecret = Buffer.alloc(32, 0x71).toString("base64url");

function productionRender(): string {
  const digest = `sha256:${"a".repeat(64)}`;
  return execFileSync("docker", ["compose", "-f", "docker-compose.yml", "config"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      ACME_EMAIL: "ops@example.invalid", DB_USER: "music", DB_PASS: "password", DB_NAME: "music",
      SESSION_SECRET: "session-secret-at-least-32-characters", COOKIE_SECRET: "cookie-secret-at-least-32-characters",
      STRAPI_URL: "https://cms.example.com", MUSIC_STRAPI_ALLOWED_ORIGINS: "https://cms.example.com",
      STRAPI_ACCESS_TOKEN: "read-token", STRAPI_JWT_SECRET: "jwt-secret-at-least-32-characters",
      MUSIC_GATE_ATTESTATION_KEY: "gate-secret-at-least-32-characters",
      MUSIC_TOKEN_CURRENT_KID: "production-current-2026-08",
      MUSIC_TOKEN_SECRET_DIRECTORY_HOST: "/opt/explorers/music-token-secrets",
      EXPLORERS_IMAGE: `ghcr.io/example/explorers@${digest}`,
      TUNES_BLUE_IMAGE: `ghcr.io/example/tunes@${digest}`, TUNES_BLUE_DIGEST: digest, TUNES_BLUE_COMMIT: "a".repeat(40),
      TUNES_GREEN_IMAGE: `ghcr.io/example/tunes@${digest}`, TUNES_GREEN_DIGEST: digest, TUNES_GREEN_COMMIT: "a".repeat(40),
      TUNES_CANDIDATE_IMAGE: `ghcr.io/example/tunes@${digest}`, TUNES_CANDIDATE_DIGEST: digest, TUNES_CANDIDATE_COMMIT: "a".repeat(40),
      TUNES_COMPAT_IMAGE: `ghcr.io/example/tunes@${digest}`,
    },
  });
}

describe("C5 credential configuration contracts", () => {
  it("renders production key paths and bounded settings without key material", () => {
    const rendered = productionRender();
    expect(rendered).toContain("MUSIC_TOKEN_CURRENT_KID: production-current-2026-08");
    expect(rendered).toContain("MUSIC_TOKEN_CURRENT_SECRET_FILE: /run/secrets/music-token/current");
    expect(rendered).toContain("MUSIC_TOKEN_PREVIOUS_SECRET_FILE: \"\"");
    expect(rendered).toContain("MUSIC_TOKEN_LIFETIME_SECONDS: \"600\"");
    expect(rendered).toContain("/opt/explorers/music-token-secrets:/run/secrets/music-token:ro");
    expect(rendered.match(/\/opt\/explorers\/music-token-secrets:\/run\/secrets\/music-token:ro/g)).toHaveLength(1);
    expect(rendered).not.toContain(fixtureSecret);
    expect(rendered).not.toContain("MUSIC_TOKEN_CURRENT_SECRET:");
  });

  it("uses generated fixture files and never checks a token secret into Compose or examples", () => {
    const compose = readFileSync(resolve(repositoryRoot, "docker-compose.music-test.yml"), "utf8");
    const examples = [".env.music.example", ".env.music.test.example"]
      .map((name) => readFileSync(resolve(repositoryRoot, name), "utf8")).join("\n");
    expect(compose).toContain("MUSIC_TOKEN_CURRENT_SECRET_FILE: /run/secrets/music-token/current");
    expect(compose).toContain("./.artifacts/music-token-secrets:/run/secrets/music-token:ro");
    expect(compose).not.toMatch(/MUSIC_TOKEN_CURRENT_SECRET:\s*[^$]/);
    expect(examples).toContain("MUSIC_TOKEN_CURRENT_SECRET_FILE=/run/secrets/music-token/current");
    expect(examples).toContain("MUSIC_TOKEN_PREVIOUS_SECRET_FILE=/run/secrets/music-token/previous");
    expect(examples).not.toContain(fixtureSecret);
  });

  it("keeps all credential material out of browser source and built-time variable names", () => {
    const source = readFileSync(resolve(repositoryRoot, "explorers-earth/src/lib/localTunesApiClient.ts"), "utf8");
    const compose = readFileSync(resolve(repositoryRoot, "docker-compose.music-test.yml"), "utf8");
    expect(source).not.toMatch(/MUSIC_TOKEN_|SIGNING_KEY|import\.meta\.env/);
    expect(compose).not.toMatch(/args:[\s\S]{0,1000}MUSIC_TOKEN_/);
  });
});
