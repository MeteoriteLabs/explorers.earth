import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync as nodeMkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import {
  startMusicServer,
  type MusicServerRuntime,
} from "../config/music-startup";
import type { MusicDatabaseConnection } from "../config/music-database-config";

const windowsEffectiveUserSid = process.platform === "win32"
  ? execFileSync("whoami.exe", ["/user", "/fo", "csv", "/nh"], { encoding: "utf8", windowsHide: true })
    .match(/,"([^"]+)"\s*$/)?.[1]
  : undefined;

function mkdtempSync(prefix: string): string {
  const directory = nodeMkdtempSync(prefix);
  if (process.platform === "win32") {
    if (!windowsEffectiveUserSid) throw new Error("Windows test runner SID is unavailable");
    execFileSync("icacls.exe", [directory, "/inheritance:r", "/grant:r",
      `*${windowsEffectiveUserSid}:(OI)(CI)(F)`, "*S-1-5-18:(OI)(CI)(F)", "*S-1-5-32-544:(OI)(CI)(F)"],
    { windowsHide: true });
  }
  return directory;
}

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const signingRoot = mkdtempSync(resolve(tmpdir(), "music-startup-key-"));
const signingPath = resolve(signingRoot, "current");
const runtimeDatabasePasswordPath = resolve(signingRoot, "database-runtime");
const lifecycleProofPath = resolve(signingRoot, "lifecycle-proof");
const publicationResponsePath = resolve(signingRoot, "publication-response");
writeFileSync(signingPath, Buffer.alloc(32, 0x61).toString("base64url"), { mode: 0o600 });
writeFileSync(runtimeDatabasePasswordPath, Buffer.alloc(32, 0x62).toString("base64url"), { mode: 0o600 });
writeFileSync(lifecycleProofPath, "dedicated-read-only-lifecycle-proof-token", { mode: 0o600 });
writeFileSync(publicationResponsePath, Buffer.alloc(32, 0x63).toString("base64url"), { mode: 0o600 });
chmodSync(signingPath, 0o600);
chmodSync(runtimeDatabasePasswordPath, 0o600);
chmodSync(lifecycleProofPath, 0o600);
chmodSync(publicationResponsePath, 0o600);
afterAll(() => rmSync(signingRoot, { recursive: true, force: true }));

function withSigningFile(environment: Record<string, string>): Record<string, string> {
  const fixture = environment.MUSIC_MODE === "fixture";
  return {
    ...environment,
    MUSIC_TOKEN_CURRENT_SECRET: "",
    MUSIC_TOKEN_CURRENT_SECRET_FILE: signingPath,
    DATABASE_URL: "",
    MUSIC_DATABASE_HOST: fixture ? "postgres" : "db",
    MUSIC_DATABASE_PORT: "5432",
    MUSIC_DATABASE_NAME: fixture ? "music_fixture" : "music",
    MUSIC_DATABASE_USER: "music_runtime_login",
    MUSIC_DATABASE_MIGRATOR_USER: "music_migrator",
    MUSIC_DATABASE_PASSWORD_FILE: runtimeDatabasePasswordPath,
    STRAPI_LIFECYCLE_PROOF_TOKEN: fixture ? "fixture-read-only-token" : "",
    STRAPI_LIFECYCLE_PROOF_TOKEN_FILE: fixture ? "" : lifecycleProofPath,
    MUSIC_PUBLICATION_RESPONSE_CURRENT_KEY: fixture
      ? "fHVy90h-cc6NG5lHj0Q_P8Gpg_HBwSp0reMX9lu19zI"
      : "",
    MUSIC_PUBLICATION_RESPONSE_CURRENT_KEY_FILE: fixture ? "" : publicationResponsePath,
  };
}

function parseEnvironmentFile(path: string): Record<string, string> {
  return Object.fromEntries(readFileSync(path, "utf8").split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]));
}

function renderedProductionEnvironment(): Record<string, string> {
  const digestA = `sha256:${"a".repeat(64)}`;
  const digestB = `sha256:${"b".repeat(64)}`;
  const environment = {
    ...process.env,
    ACME_EMAIL: "ops@example.invalid",
    DB_USER: "legacy-owner",
    DB_PASS: "legacy-owner-password-sentinel",
    DB_MIGRATOR_USER: "music_migrator",
    DB_MIGRATOR_PASSWORD_FILE_HOST: "C:/fixture/db-migrator",
    DB_RUNTIME_USER: "music_runtime_login",
    DB_RUNTIME_PASSWORD_FILE_HOST: "C:/fixture/db-runtime",
    DB_NAME: "music",
    SESSION_SECRET: "production-session-secret-at-least-32-characters",
    COOKIE_SECRET: "production-cookie-secret-at-least-32-characters",
    STRAPI_URL: "https://cms.example.com",
    MUSIC_STRAPI_ALLOWED_ORIGINS: "https://cms.example.com",
    STRAPI_ACCESS_TOKEN: "read-only-token",
    STRAPI_JWT_SECRET: "production-jwt-secret-at-least-32-characters",
    MUSIC_GATE_ATTESTATION_KEY: "production-gate-key-at-least-32-characters",
    MUSIC_TOKEN_CURRENT_KID: "production-current",
    MUSIC_TOKEN_SECRET_DIRECTORY_HOST: "C:/fixture/music-token-secrets",
    MUSIC_PUBLICATION_RESPONSE_CURRENT_KID: "production-publication-current",
    MUSIC_PUBLICATION_RESPONSE_KEY_DIRECTORY_HOST: "C:/fixture/music-publication-response",
    STRAPI_LIFECYCLE_PROOF_TOKEN_FILE_HOST: "C:/fixture/strapi-lifecycle-proof",
    EXPLORERS_IMAGE: `ghcr.io/example/explorers@${digestA}`,
    TUNES_BLUE_IMAGE: `ghcr.io/example/tunes@${digestA}`,
    TUNES_BLUE_DIGEST: digestA,
    TUNES_BLUE_COMMIT: "a".repeat(40),
    TUNES_GREEN_IMAGE: `ghcr.io/example/tunes@${digestB}`,
    TUNES_GREEN_DIGEST: digestB,
    TUNES_GREEN_COMMIT: "b".repeat(40),
    TUNES_CANDIDATE_IMAGE: `ghcr.io/example/tunes@${digestA}`,
    TUNES_CANDIDATE_DIGEST: digestA,
    TUNES_CANDIDATE_COMMIT: "a".repeat(40),
    TUNES_COMPAT_IMAGE: `ghcr.io/example/tunes@${digestA}`,
  };
  const rendered = JSON.parse(execFileSync("docker", ["compose", "-f", "docker-compose.yml", "config", "--format", "json"], {
    cwd: repositoryRoot,
    env: environment,
    encoding: "utf8",
  })) as { services: Record<string, { environment: Record<string, string> }> };
  return rendered.services["tunes-blue"].environment;
}

function controlledRuntime(events: string[]): MusicServerRuntime {
  const server = {
    once: () => server,
    off: () => server,
    listen: (_port: number, _host: string, callback: () => void) => {
      events.push("listen");
      callback();
      return server;
    },
  };
  return {
    createApp: async () => {
      events.push("create-app");
      return { app: { get: () => "production" }, server };
    },
    setupVite: async () => { events.push("vite"); },
    serveStatic: () => { events.push("static"); },
  } as unknown as MusicServerRuntime;
}

describe("discriminated Music startup bootstrap", () => {
  it("uses an injected runtime database resolver after validating the fixture contract", async () => {
    const environment = withSigningFile(parseEnvironmentFile(resolve(repositoryRoot, ".env.music.test.example")));
    const database: MusicDatabaseConnection = {
      connectionString: "postgresql://music_runtime_login:test@127.0.0.1:55432/music_fixture",
      database: "music_fixture",
      host: "127.0.0.1",
      password: "test",
      port: 55432,
      user: "music_runtime_login",
    };
    const resolveDatabaseConnection = vi.fn(async () => database);

    await startMusicServer(environment, {
      resolveDatabaseConnection,
      verifyDatabaseConnection: async () => undefined,
      ensureAnalyticsSchema: async () => undefined,
      loadRuntime: async () => controlledRuntime([]),
    });

    expect(resolveDatabaseConnection).toHaveBeenCalledTimes(1);
    expect(environment.DATABASE_URL).toBe(database.connectionString);
  });

  it("validates the rendered live Compose environment exactly once before application import and listen", async () => {
    const environment = withSigningFile(renderedProductionEnvironment());
    for (const fixtureOnly of [
      "MUSIC_FIXTURE_VERSION", "STRAPI_FIXTURE_URL", "DATABASE_URL_TEST",
      "MUSIC_SIGNING_KEY_CURRENT_ID", "MUSIC_SIGNING_KEY_CURRENT_SECRET",
      "MUSIC_SIGNING_KEY_PREVIOUS_ID", "MUSIC_SIGNING_KEY_PREVIOUS_SECRET",
      "MUSIC_PROVISIONING_KILL_SWITCH", "MUSIC_PROVISIONING_COHORT",
      "MUSIC_RECONCILIATION_ENABLED", "MUSIC_RECONCILIATION_MAX_ROWS",
    ]) expect(environment).not.toHaveProperty(fixtureOnly);

    const events: string[] = [];
    const resolver = vi.fn(async () => {
      events.push("resolve-dns");
      return ["8.8.8.8", "2606:4700:4700::1111"];
    });
    const loadRuntime = vi.fn(async () => {
      expect(environment.DATABASE_URL).toMatch(/^postgresql:\/\/music_runtime_login:[A-Za-z0-9_-]+@db:5432\/music$/);
      events.push("load-routes");
      return controlledRuntime(events);
    });
    await startMusicServer(environment, {
      resolveAddresses: resolver,
      verifyDatabaseConnection: async () => { events.push("verify-runtime-db"); },
      ensureAnalyticsSchema: async () => { events.push("ensure-analytics-schema"); },
      loadRuntime,
    });
    expect(resolver).toHaveBeenCalledTimes(1);
    expect(loadRuntime).toHaveBeenCalledTimes(1);
    expect(events).toEqual(["resolve-dns", "verify-runtime-db", "ensure-analytics-schema", "load-routes", "create-app", "static", "listen"]);
  });

  it("rejects a wrong runtime database credential before importing routes or binding", async () => {
    const loadRuntime = vi.fn(async () => controlledRuntime([]));
    const verifyDatabaseConnection = vi.fn(async () => { throw new Error("runtime database authentication failed"); });
    await expect(startMusicServer(withSigningFile(renderedProductionEnvironment()), {
      resolveAddresses: async () => ["8.8.8.8"],
      verifyDatabaseConnection,
      loadRuntime,
    } as never)).rejects.toThrow(/database authentication/i);
    expect(verifyDatabaseConnection).toHaveBeenCalledTimes(1);
    expect(loadRuntime).not.toHaveBeenCalled();
  });

  it.each([
    ["missing runtime user", { MUSIC_DATABASE_USER: "" }],
    ["missing runtime secret", { MUSIC_DATABASE_PASSWORD_FILE: "" }],
    ["owner/migrator runtime user", { MUSIC_DATABASE_USER: "music_migrator" }],
  ])("rejects %s before importing routes or binding", async (_label, override) => {
    const loadRuntime = vi.fn(async () => controlledRuntime([]));
    await expect(startMusicServer({ ...withSigningFile(renderedProductionEnvironment()), ...override }, {
      resolveAddresses: async () => ["8.8.8.8"],
      loadRuntime,
    })).rejects.toThrow(/database|runtime|credential|role|secret/i);
    expect(loadRuntime).not.toHaveBeenCalled();
  });

  it.each([
    ["HTTP URL", { STRAPI_URL: "http://cms.example.com" }, ["8.8.8.8"]],
    ["wrong proxy policy", { TRUST_PROXY_HOPS: "2" }, ["8.8.8.8"]],
    ["invalid numeric bound", { MUSIC_IDENTITY_MAX_PENDING: "Infinity" }, ["8.8.8.8"]],
    ["private DNS", {}, ["127.0.0.1"]],
  ])("rejects invalid live %s before importing or binding", async (_label, override, answers) => {
    const loadRuntime = vi.fn(async () => controlledRuntime([]));
    await expect(startMusicServer({ ...withSigningFile(renderedProductionEnvironment()), ...override }, {
      resolveAddresses: async () => answers,
      loadRuntime,
    })).rejects.toThrow();
    expect(loadRuntime).not.toHaveBeenCalled();
  });

  it("retains the exact C0 fixture contract before importing the application", async () => {
    const fixture = withSigningFile(parseEnvironmentFile(resolve(repositoryRoot, ".env.music.test.example")));
    const events: string[] = [];
    await startMusicServer(fixture, {
      resolveAddresses: async () => { throw new Error("fixture startup must not resolve DNS"); },
      verifyDatabaseConnection: async () => undefined,
      ensureAnalyticsSchema: async () => undefined,
      loadRuntime: async () => {
        events.push("load-routes");
        return controlledRuntime(events);
      },
    });
    expect(events).toEqual(["load-routes", "create-app", "static", "listen"]);

    const loadInvalid = vi.fn(async () => controlledRuntime([]));
    const { MUSIC_FIXTURE_VERSION: _removed, ...invalid } = fixture;
    await expect(startMusicServer(invalid, {
      loadRuntime: loadInvalid,
    })).rejects.toThrow(/MUSIC_FIXTURE_VERSION/);
    expect(loadInvalid).not.toHaveBeenCalled();
  });

  it("rejects an insecure live key file before route import or listener bind", async () => {
    const insecurePath = resolve(signingRoot, "startup-world-readable-sentinel");
    writeFileSync(insecurePath, Buffer.alloc(32, 0x66).toString("base64url"), { mode: 0o644 });
    chmodSync(insecurePath, 0o644);
    const loadRuntime = vi.fn(async () => controlledRuntime([]));
    const failure = startMusicServer({
      ...withSigningFile(renderedProductionEnvironment()),
      MUSIC_TOKEN_CURRENT_SECRET_FILE: insecurePath,
    }, { resolveAddresses: async () => ["8.8.8.8"], platform: "linux", effectiveUserId: 0, loadRuntime });
    await expect(failure).rejects.toThrow(/secret|secure|permission/i);
    await expect(failure).rejects.not.toThrow(/world-readable-sentinel/);
    expect(loadRuntime).not.toHaveBeenCalled();
  });
});
