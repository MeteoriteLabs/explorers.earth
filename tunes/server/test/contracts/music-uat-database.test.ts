import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateIntegrationDatabaseTarget } from "../integration-global-setup";
import {
  MUSIC_UAT_DATABASE_ACK,
  MUSIC_UAT_DATABASE_TEST_FILES,
  buildUatDatabaseTestCommand,
  parseUatDatabaseAuthority,
  startOwnedUatDatabase,
  stopOwnedUatDatabase,
  validateUatDatabaseInspect,
  withOwnedUatDatabase,
} from "../../../scripts/music-uat-database";

const runId = "1".repeat(32);
const database = `music_uat_${runId}`;
const commit = "c".repeat(40);
const containerId = "a".repeat(64);
const imageId = `sha256:${"b".repeat(64)}`;
const contextHost = "npipe:////./pipe/dockerDesktopLinuxEngine";

function authorityEnvironment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    MUSIC_UAT_DATABASE_ACK,
    MUSIC_UAT_DATABASE_RUN_ID: runId,
    MUSIC_UAT_DATABASE_NAME: database,
    MUSIC_UAT_DATABASE_PORT: "58543",
    MUSIC_UAT_DATABASE_CONTAINER_ID: containerId,
    MUSIC_UAT_DATABASE_COMMIT: commit,
    ...overrides,
  };
}

function ownedInspect() {
  return {
    Id: containerId,
    Name: `/explorers-music-uat-db-${runId}`,
    Image: imageId,
    Config: {
      Image: "postgres:15-alpine",
      Env: [
        "POSTGRES_USER=music_migrator",
        `POSTGRES_DB=${database}`,
        "POSTGRES_PASSWORD_FILE=/run/secrets/music-uat-database-password",
      ],
      Labels: {
        "com.explorers.music.fixture": "true",
        "com.explorers.music.project": "explorers-music-fixture",
        "com.explorers.music.uat-database": "true",
        "com.explorers.music.uat-run": runId,
        "com.explorers.music.database": database,
        "com.explorers.music.commit": commit,
      },
    },
    State: { Running: true, Health: { Status: "healthy" } },
    HostConfig: {
      PortBindings: { "5432/tcp": [{ HostIp: "127.0.0.1", HostPort: "58543" }] },
      Tmpfs: { "/var/lib/postgresql/data": "rw,noexec,nosuid,size=536870912" },
    },
    Mounts: [{ Type: "bind", Destination: "/run/secrets/music-uat-database-password", RW: false }],
  };
}

describe("owned Task-4 UAT database lane", () => {
  it("requires one complete unique fixture-owned database authority tuple", () => {
    expect(parseUatDatabaseAuthority({})).toBeUndefined();
    expect(parseUatDatabaseAuthority(authorityEnvironment())).toEqual({
      runId, database, port: 58543, containerId, commit,
    });
    expect(() => parseUatDatabaseAuthority({ MUSIC_UAT_DATABASE_ACK }))
      .toThrow(/exact acknowledgement.*run ID.*database.*port.*container ID.*commit/i);
    expect(() => parseUatDatabaseAuthority(authorityEnvironment({
      MUSIC_UAT_DATABASE_NAME: "music_fixture",
    }))).toThrow(/unique database/i);
    expect(() => parseUatDatabaseAuthority(authorityEnvironment({
      MUSIC_UAT_DATABASE_NAME: `music_uat_${"2".repeat(32)}`,
    }))).toThrow(/run ID/i);
    for (const hostile of [
      { DOCKER_HOST: "tcp://production.example:2376" },
      { DOCKER_CONTEXT: "production" },
      { DATABASE_URL: "postgresql://production.example/music" },
      { GATE_PROD: "1" },
    ]) {
      expect(() => parseUatDatabaseAuthority(authorityEnvironment(hostile))).toThrow(/ambient.*forbidden/i);
    }
  });

  it("attests exact local fixture labels, identity, loopback binding, secret mount, and tmpfs", () => {
    const authority = parseUatDatabaseAuthority(authorityEnvironment())!;
    expect(validateUatDatabaseInspect(authority, {
      contextHost, imageId, inspect: ownedInspect(),
    })).toEqual(expect.objectContaining({ database, imageId }));
    expect(() => validateUatDatabaseInspect(authority, {
      contextHost: "tcp://production.example:2376", imageId, inspect: ownedInspect(),
    })).toThrow(/local Docker/i);
    expect(() => validateUatDatabaseInspect(authority, {
      contextHost, imageId,
      inspect: { ...ownedInspect(), Config: { ...ownedInspect().Config, Labels: {} } },
    })).toThrow(/exact fixture-owned/i);
    expect(() => validateUatDatabaseInspect(authority, {
      contextHost, imageId,
      inspect: { ...ownedInspect(), HostConfig: { ...ownedInspect().HostConfig, Tmpfs: {} } },
    })).toThrow(/exact fixture-owned/i);
  });

  it("creates the unique database without an argument secret and always drops/removes the exact owner", async () => {
    const passwordFile = "C:\\protected\\music-uat-db-password";
    const mutations: string[][] = [];
    const drops: string[] = [];
    const dockerRead = (args: string[]) => {
      if (args[0] === "context" && args[1] === "show") return "desktop-linux\n";
      if (args[0] === "context" && args[1] === "inspect") return JSON.stringify(contextHost);
      if (args.includes("image")) return `${imageId}\n`;
      if (args.includes("inspect") && args.includes(containerId)) return JSON.stringify(ownedInspect());
      throw new Error(`unexpected read: ${args.join(" ")}`);
    };
    const authority = await startOwnedUatDatabase({
      runId, database, commit, port: 58543, passwordFile,
    }, {
      dockerRead,
      dockerOptionalRead: () => undefined,
      dockerRun: (args) => { mutations.push(args); return containerId; },
      healthyInspect: async () => ownedInspect(),
    });
    expect(authority).toEqual({
      runId, database, port: 58543, containerId, commit, imageId, contextHost, owned: true,
    });
    const creation = mutations[0]!;
    expect(creation).toEqual(expect.arrayContaining([
      "--rm",
      "--publish", "127.0.0.1:58543:5432",
      "--env", `POSTGRES_DB=${database}`,
      "--env", "POSTGRES_PASSWORD_FILE=/run/secrets/music-uat-database-password",
      "--tmpfs", "/var/lib/postgresql/data:rw,noexec,nosuid,size=536870912",
    ]));
    expect(creation.join(" ")).toContain("com.explorers.music.fixture=true");
    expect(creation.join(" ")).toContain(`com.explorers.music.uat-run=${runId}`);
    expect(creation.join(" ")).toContain(passwordFile);
    expect(creation.join(" ")).not.toContain("known-password-value");

    await stopOwnedUatDatabase(authority, {
      dockerRead,
      dockerOptionalRead: () => undefined,
      dockerRun: (args) => { mutations.push(args); return ""; },
      dropDatabase: async (owned) => { drops.push(owned.database); },
    });
    expect(drops).toEqual([database]);
    expect(mutations.at(-1)).toEqual(["--host", contextHost, "rm", "--force", "--volumes", containerId]);
  });

  it("releases the exact owned database once when the repository child fails", async () => {
    const authority = { owned: true as const, containerId };
    const events: string[] = [];
    await expect(withOwnedUatDatabase({
      acquire: async () => { events.push("acquire"); return authority; },
      run: async (value) => { events.push(`run:${value.containerId}`); throw new Error("repository lane red"); },
      release: async (value) => { events.push(`release:${value.containerId}`); },
    })).rejects.toThrow("repository lane red");
    expect(events).toEqual(["acquire", `run:${containerId}`, `release:${containerId}`]);
  });

  it("removes the exact container even when SQL drop reports failure", async () => {
    const mutations: string[][] = [];
    const dockerRead = (args: string[]) => {
      if (args[0] === "context" && args[1] === "show") return "desktop-linux\n";
      if (args[0] === "context" && args[1] === "inspect") return JSON.stringify(contextHost);
      if (args.includes("image")) return `${imageId}\n`;
      if (args.includes("inspect") && args.includes(containerId)) return JSON.stringify(ownedInspect());
      throw new Error(`unexpected read: ${args.join(" ")}`);
    };
    const authority = {
      runId, database, port: 58543, containerId, commit, imageId, contextHost, owned: true as const,
    };
    await expect(stopOwnedUatDatabase(authority, {
      dockerRead,
      dockerOptionalRead: () => undefined,
      dockerRun: (args) => { mutations.push(args); return ""; },
      dropDatabase: async () => { throw new Error("injected drop failure"); },
    })).rejects.toThrow(/database drop failed/i);
    expect(mutations).toEqual([
      ["--host", contextHost, "rm", "--force", "--volumes", containerId],
    ]);
  });

  it("removes the created exact ID when startup attestation fails", async () => {
    const mutations: string[][] = [];
    const dockerRead = (args: string[]) => {
      if (args[0] === "context" && args[1] === "show") return "desktop-linux\n";
      if (args[0] === "context" && args[1] === "inspect") return JSON.stringify(contextHost);
      if (args.includes("image")) return `${imageId}\n`;
      throw new Error(`unexpected read: ${args.join(" ")}`);
    };
    await expect(startOwnedUatDatabase({
      runId, database, commit, port: 58543, passwordFile: "C:\\protected\\music-uat-db-password",
    }, {
      dockerRead,
      dockerOptionalRead: () => undefined,
      dockerRun: (args) => { mutations.push(args); return containerId; },
      healthyInspect: async () => ({
        ...ownedInspect(),
        Config: { ...ownedInspect().Config, Labels: {} },
      }),
    })).rejects.toThrow(/exact fixture-owned/i);
    expect(mutations.at(-1)).toEqual([
      "--host", contextHost, "rm", "--force", "--volumes", containerId,
    ]);
  });

  it("allows integration setup to reach only the tuple-bound unique database", () => {
    const environment = authorityEnvironment();
    expect(validateIntegrationDatabaseTarget(
      `postgresql://music_migrator:secret@127.0.0.1:58543/${database}`,
      environment,
    ).pathname).toBe(`/${database}`);
    expect(() => validateIntegrationDatabaseTarget(
      "postgresql://music_migrator:secret@127.0.0.1:58543/music_fixture",
      environment,
    )).toThrow(/exact disposable/i);
    expect(() => validateIntegrationDatabaseTarget(
      `postgresql://music_migrator:secret@localhost:58543/${database}`,
      environment,
    )).toThrow(/exact disposable/i);
  });

  it("publishes one narrow root command and a frozen repository integration allowlist", () => {
    const repositoryRoot = resolve(import.meta.dirname, "../../../..");
    const rootPackage = JSON.parse(readFileSync(resolve(repositoryRoot, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const tunesPackage = JSON.parse(readFileSync(resolve(repositoryRoot, "tunes/package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(rootPackage.scripts["music:test:uat-database"])
      .toBe("npm --prefix tunes run music:test:uat-database --");
    expect(tunesPackage.scripts["music:test:uat-database"])
      .toBe("tsx scripts/music-uat-database.ts");
    const runnerSource = readFileSync(resolve(repositoryRoot, "tunes/scripts/music-uat-database.ts"), "utf8");
    expect(runnerSource).toContain("prepareFixtureMusicTokenSecret");
    expect(runnerSource).toContain("readSecureMusicSecretFile");
    expect(runnerSource).toContain("cleanupFixtureMusicTokenSecret");
    expect(runnerSource).not.toContain("writeFileSync(passwordFile");
    expect(MUSIC_UAT_DATABASE_TEST_FILES).toEqual([
      "server/test/migrations/music-migration.integration.test.ts",
      "server/test/music-credential.integration.test.ts",
      "server/test/music-domain-repository.integration.test.ts",
      "server/test/music-identity-projection.integration.test.ts",
      "server/test/music-publication-operation.integration.test.ts",
      "server/test/music-runtime-role.integration.test.ts",
      "server/test/musicLifecycle.integration.test.ts",
      "server/test/musicReconciler.integration.test.ts",
      "server/test/reconciliationRepository.integration.test.ts",
      "server/test/load/music-load-postgres.integration.test.ts",
    ]);
    expect(buildUatDatabaseTestCommand("C:\\node\\npm-cli.js")).toEqual({
      file: process.execPath,
      args: [
        "C:\\node\\npm-cli.js", "run", "test:integration", "--",
        ...MUSIC_UAT_DATABASE_TEST_FILES,
        "--maxWorkers=1", "--fileParallelism=false",
      ],
    });
  });
});
