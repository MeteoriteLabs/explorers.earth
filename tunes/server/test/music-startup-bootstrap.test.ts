import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  startMusicServer,
  type MusicServerRuntime,
} from "../config/music-startup";

const repositoryRoot = resolve(import.meta.dirname, "../../..");

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
    DB_USER: "music",
    DB_PASS: "fixture-production-password",
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
  it("validates the rendered live Compose environment exactly once before application import and listen", async () => {
    const environment = renderedProductionEnvironment();
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
      events.push("load-routes");
      return controlledRuntime(events);
    });
    await startMusicServer(environment, {
      resolveAddresses: resolver,
      readSecretFile: async () => Buffer.alloc(32, 0x61).toString("base64url"),
      loadRuntime,
    });
    expect(resolver).toHaveBeenCalledTimes(1);
    expect(loadRuntime).toHaveBeenCalledTimes(1);
    expect(events).toEqual(["resolve-dns", "load-routes", "create-app", "static", "listen"]);
  });

  it.each([
    ["HTTP URL", { STRAPI_URL: "http://cms.example.com" }, ["8.8.8.8"]],
    ["wrong proxy policy", { TRUST_PROXY_HOPS: "2" }, ["8.8.8.8"]],
    ["invalid numeric bound", { MUSIC_IDENTITY_MAX_PENDING: "Infinity" }, ["8.8.8.8"]],
    ["private DNS", {}, ["127.0.0.1"]],
  ])("rejects invalid live %s before importing or binding", async (_label, override, answers) => {
    const loadRuntime = vi.fn(async () => controlledRuntime([]));
    await expect(startMusicServer({ ...renderedProductionEnvironment(), ...override }, {
      resolveAddresses: async () => answers,
      readSecretFile: async () => Buffer.alloc(32, 0x61).toString("base64url"),
      loadRuntime,
    })).rejects.toThrow();
    expect(loadRuntime).not.toHaveBeenCalled();
  });

  it("retains the exact C0 fixture contract before importing the application", async () => {
    const fixture = parseEnvironmentFile(resolve(repositoryRoot, ".env.music.test.example"));
    const events: string[] = [];
    await startMusicServer(fixture, {
      resolveAddresses: async () => { throw new Error("fixture startup must not resolve DNS"); },
      readSecretFile: async () => Buffer.alloc(32, 0x62).toString("base64url"),
      loadRuntime: async () => {
        events.push("load-routes");
        return controlledRuntime(events);
      },
    });
    expect(events).toEqual(["load-routes", "create-app", "static", "listen"]);

    const loadInvalid = vi.fn(async () => controlledRuntime([]));
    const { MUSIC_FIXTURE_VERSION: _removed, ...invalid } = fixture;
    await expect(startMusicServer(invalid, {
      readSecretFile: async () => Buffer.alloc(32, 0x62).toString("base64url"),
      loadRuntime: loadInvalid,
    })).rejects.toThrow(/MUSIC_FIXTURE_VERSION/);
    expect(loadInvalid).not.toHaveBeenCalled();
  });
});
