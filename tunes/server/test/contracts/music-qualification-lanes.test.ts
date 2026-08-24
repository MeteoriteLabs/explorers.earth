import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import * as musicCli from "../../../scripts/music-cli";
import * as musicQualification from "../../../scripts/music-qualification";
import { validateIntegrationDatabaseTarget } from "../integration-global-setup";
import {
  attestC10StandalonePostgresAuthority,
  parseC10StandalonePostgresAuthority,
  startC10StandalonePostgres,
  stopC10StandalonePostgres,
  validateC10StandalonePostgresInspect,
} from "../../../scripts/music-qualification-postgres";
import {
  parseMusicCliArguments,
  qualificationChildAmbientEnvironment,
  resolveC10IsolatedDockerExecutable,
  resolveC10IsolatedNpmExecutable,
  resolveC10StandalonePostgresPort,
  resolveNativeMusicReleaseLauncher,
  sanitizeMusicCheckpointData,
  sanitizeMusicChildArtifactOutput,
  sanitizeMusicCliText,
  selectMusicTimeToFirstGreen,
  withQualificationPostgresAuthority,
} from "../../../scripts/music-cli";
import {
  attachMusicQualificationMeasurements,
  MUSIC_QUALIFICATION_LANES,
  MUSIC_QUALIFICATION_REQUIREMENTS,
  MUSIC_QUALIFICATION_TASKS,
  parseMusicQualificationLoadMeasurements,
  parseMusicQualificationOperationalMeasurements,
  percentile,
  preferredQualificationPort,
  qualificationStageConcurrency,
  qualificationTaskUsesFixtureEnvironment,
  qualificationTaskEnvironment,
  runMusicQualificationLane,
  sanitizeQualificationText,
  type MusicQualificationReport,
  qualificationTelemetryIsBounded,
  qualificationReportMatchesAuthority,
} from "../../../scripts/music-qualification";

describe("portable Music qualification lanes", () => {
  it("dispatches release rehearsal through the canonical native launcher", () => {
    const windows = resolveNativeMusicReleaseLauncher("rehearsal", "win32");
    expect(windows.file).toBe("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe");
    expect(windows.args).toContain("-NoProfile");
    expect(windows.args.some((value) => value.endsWith("music-release-launcher.ps1"))).toBe(true);
    expect(windows.args.at(-1)).toBe("rehearsal");
    const linux = resolveNativeMusicReleaseLauncher("rehearsal", "linux");
    expect(linux.file).toBe("/bin/sh");
    expect(linux.args[0]).toMatch(/music-release-launcher\.sh$/);
    expect(linux.args[1]).toBe("rehearsal");
  });

  it("creates and verifies the documented canonical evidence manifest bytes", () => {
    // Production break caught: copied evidence has only an unverifiable digest,
    // or a platform-specific path/order/newline encoding changes its identity.
    const sandbox = mkdtempSync(join(tmpdir(), "music-evidence-manifest-"));
    try {
      const evidenceRoot = join(sandbox, "music-runs");
      const manifest = join(sandbox, "music-runs.manifest.tsv");
      mkdirSync(join(evidenceRoot, "nested"), { recursive: true });
      writeFileSync(join(evidenceRoot, "a.txt"), "abc");
      writeFileSync(join(evidenceRoot, "nested", "z.txt"), "");
      const tunesRoot = resolve(import.meta.dirname, "../../..");
      const manifestCli = resolve(tunesRoot, "scripts/music-evidence-manifest.ts");
      const tsxCli = resolve(tunesRoot, "node_modules/tsx/dist/cli.mjs");
      const invoke = (operation: "create" | "verify") => spawnSync(
        process.execPath, [tsxCli, manifestCli, operation, evidenceRoot, manifest], {
        cwd: tunesRoot,
        encoding: "utf8",
        windowsHide: true,
      });
      const create = invoke("create");
      expect(create.status, create.stderr).toBe(0);
      const canonical = [
        "a.txt\t3\tba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
        "nested/z.txt\t0\te3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      ].join("\n");
      expect(readFileSync(manifest, "utf8")).toBe(canonical);
      expect(create.stdout).toContain("7e73a630d4cb0a852d44e3d2664a5402803d6e64d417f5daba16474916bcd7b9");

      const verify = invoke("verify");
      expect(verify.status, verify.stderr).toBe(0);
      expect(verify.stdout).toContain("7e73a630d4cb0a852d44e3d2664a5402803d6e64d417f5daba16474916bcd7b9");

      writeFileSync(join(evidenceRoot, "a.txt"), "abd");
      const hostile = invoke("verify");
      expect(hostile.status).not.toBe(0);
      expect(hostile.stderr).toContain("evidence manifest verification failed");
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it("injects disposable fixture authority only into tasks that cross the real fixture boundary", () => {
    expect([
      "postgres-integration",
      "tunes-repository-coverage",
      "tunes-identity-repository-coverage",
      "load-postgres",
      "chaos-postgres",
      "real-docker-evidence",
    ].every(qualificationTaskUsesFixtureEnvironment)).toBe(true);
    expect([
      "tunes-unit",
      "tunes-full-unit",
      "isolated-cli-contract",
      "explorer-full-unit",
      "security-matrices",
      "release-rehearsal",
    ].some(qualificationTaskUsesFixtureEnvironment)).toBe(false);
    const cliSource = readFileSync(resolve(import.meta.dirname, "../../../scripts/music-cli.ts"), "utf8");
    expect(cliSource).toContain("qualificationTaskUsesFixtureEnvironment(task.id) ? activeFixtureEnvironment : {}");
    expect(cliSource).not.toContain("...activeFixtureEnvironment,\n          ...taskEnvironment");
  });

  it("strips standalone PG authority from every child outside the exact standalone-PG task allowlist", () => {
    const ambient = {
      PATH: "bounded-path",
      MUSIC_C10_STANDALONE_POSTGRES_ACK: "C10_LABELED_LOCAL_PG15",
      MUSIC_C10_STANDALONE_POSTGRES_PORT: "55539",
      MUSIC_C10_STANDALONE_POSTGRES_CONTAINER_ID: "a".repeat(64),
      MUSIC_C10_STANDALONE_POSTGRES_COMMIT: "c".repeat(40),
    };
    expect(qualificationChildAmbientEnvironment("tunes-full-unit", ambient)).toEqual({ PATH: "bounded-path" });
    expect(qualificationChildAmbientEnvironment("postgres-integration", ambient)).toEqual(ambient);
    expect(qualificationChildAmbientEnvironment("real-docker-evidence", ambient)).toEqual({ PATH: "bounded-path" });
    const hostileCasing = {
      Path: "bounded-path",
      music_c10_standalone_postgres_ack: "C10_LABELED_LOCAL_PG15",
      Music_C10_Standalone_Postgres_Port: "55539",
      MUSIC_c10_STANDALONE_POSTGRES_CONTAINER_ID: "a".repeat(64),
      music_C10_standalone_postgres_commit: "c".repeat(40),
    };
    expect(qualificationChildAmbientEnvironment("tunes-full-unit", hostileCasing)).toEqual({ Path: "bounded-path" });
    expect(qualificationChildAmbientEnvironment("postgres-integration", hostileCasing)).toEqual(hostileCasing);
    expect(qualificationChildAmbientEnvironment("real-docker-evidence", hostileCasing)).toEqual({ Path: "bounded-path" });
  });

  it("requires an explicit bounded loopback port acknowledgement for standalone PG qualification", () => {
    const containerId = "a".repeat(64);
    const commit = "c".repeat(40);
    expect(resolveC10StandalonePostgresPort({})).toBeUndefined();
    expect(resolveC10StandalonePostgresPort({
      MUSIC_C10_STANDALONE_POSTGRES_ACK: "C10_LABELED_LOCAL_PG15",
      MUSIC_C10_STANDALONE_POSTGRES_PORT: "55539",
      MUSIC_C10_STANDALONE_POSTGRES_CONTAINER_ID: containerId,
      MUSIC_C10_STANDALONE_POSTGRES_COMMIT: commit,
    })).toBe(55539);
    expect(() => resolveC10StandalonePostgresPort({
      MUSIC_C10_STANDALONE_POSTGRES_PORT: "55539",
    })).toThrow(/acknowledgement/i);
    expect(() => resolveC10StandalonePostgresPort({
      MUSIC_C10_STANDALONE_POSTGRES_ACK: "C10_LABELED_LOCAL_PG15",
      MUSIC_C10_STANDALONE_POSTGRES_PORT: "55432",
      MUSIC_C10_STANDALONE_POSTGRES_CONTAINER_ID: containerId,
      MUSIC_C10_STANDALONE_POSTGRES_COMMIT: commit,
    })).toThrow(/five-service/i);
  });

  it("attests the exact owned local PG15 container before exposing its port", () => {
    const containerId = "a".repeat(64);
    const imageId = `sha256:${"b".repeat(64)}`;
    const commit = "c".repeat(40);
    const authority = parseC10StandalonePostgresAuthority({
      MUSIC_C10_STANDALONE_POSTGRES_ACK: "C10_LABELED_LOCAL_PG15",
      MUSIC_C10_STANDALONE_POSTGRES_PORT: "55539",
      MUSIC_C10_STANDALONE_POSTGRES_CONTAINER_ID: containerId,
      MUSIC_C10_STANDALONE_POSTGRES_COMMIT: commit,
    });
    expect(authority).toEqual({ port: 55539, containerId, commit });
    const inspect = {
      Id: containerId,
      Name: `/music-c10-qualification-${commit.slice(0, 7)}-pg15`,
      Image: imageId,
      Config: {
        Image: "postgres:15-alpine",
        Labels: {
          "com.explorers.music.c10-qualification": "true",
          "com.explorers.music.owner": "task10",
          "com.explorers.music.commit": commit,
        },
      },
      State: { Running: true, Health: { Status: "healthy" } },
      HostConfig: { PortBindings: { "5432/tcp": [{ HostIp: "127.0.0.1", HostPort: "55539" }] } },
    };
    expect(validateC10StandalonePostgresInspect(authority!, {
      contextHost: "npipe:////./pipe/dockerDesktopLinuxEngine",
      imageId,
      inspect,
    })).toEqual(expect.objectContaining({ port: 55539, imageId }));
    expect(() => validateC10StandalonePostgresInspect(authority!, {
      contextHost: "tcp://prod.example:2376", imageId, inspect,
    })).toThrow(/local Docker/i);
    expect(() => validateC10StandalonePostgresInspect(authority!, {
      contextHost: "npipe:////./pipe/dockerDesktopLinuxEngine", imageId,
      inspect: { ...inspect, Config: { ...inspect.Config, Labels: {} } },
    })).toThrow(/owned PG15/i);
  });

  it("creates and removes an exact loopback-only lane-owned PG15 sidecar without exposing its password", async () => {
    // Break caught: PostgreSQL qualification silently falls back to the
    // five-service cluster and collides with its cluster-global runtime role.
    const commit = "c".repeat(40);
    const containerId = "a".repeat(64);
    const imageId = `sha256:${"b".repeat(64)}`;
    const contextHost = "npipe:////./pipe/dockerDesktopLinuxEngine";
    const passwordFile = "C:\\protected\\music-db-migrator";
    const mutations: string[][] = [];
    const inspect = {
      Id: containerId,
      Name: `/music-c10-qualification-${commit.slice(0, 7)}-pg15`,
      Image: imageId,
      Config: { Image: "postgres:15-alpine", Labels: {
        "com.explorers.music.c10-qualification": "true",
        "com.explorers.music.owner": "task10",
        "com.explorers.music.commit": commit,
      } },
      State: { Running: true, Health: { Status: "healthy" } },
      HostConfig: { PortBindings: { "5432/tcp": [{ HostIp: "127.0.0.1", HostPort: "55539" }] } },
    };
    const dockerRead = (args: string[]) => {
      if (args[0] === "context" && args[1] === "show") return "desktop-linux\n";
      if (args[0] === "context" && args[1] === "inspect") return JSON.stringify(contextHost);
      if (args.includes("image")) return `${imageId}\n`;
      if (args.includes("inspect") && args.includes(containerId)) return JSON.stringify(inspect);
      throw new Error(`unexpected read: ${args.join(" ")}`);
    };
    const authority = await startC10StandalonePostgres({ commit, port: 55539, passwordFile }, {
      dockerRead,
      dockerOptionalRead: () => undefined,
      dockerRun: (args) => { mutations.push(args); return containerId; },
      healthyInspect: async () => inspect,
    });
    expect(authority).toEqual({ port: 55539, containerId, commit, imageId, contextHost, owned: true });
    const creation = mutations[0]!.join(" ");
    expect(creation).toContain("127.0.0.1:55539:5432");
    expect(creation).toContain("POSTGRES_PASSWORD_FILE=/run/secrets/music-c10-postgres-password");
    expect(creation).toContain("readonly");
    expect(creation).not.toContain("secret-value");
    expect(JSON.stringify(authority)).not.toContain(passwordFile);

    await stopC10StandalonePostgres(authority, {
      dockerRead,
      dockerRun: (args) => { mutations.push(args); return ""; },
    });
    expect(mutations.at(-1)).toEqual(["--host", contextHost, "rm", "--force", containerId]);
  });

  it("releases a lane-owned PostgreSQL authority exactly once when qualification fails", async () => {
    // Break caught: a red task leaves the sidecar running, contaminating the
    // retry and retaining a mounted credential longer than the lane lifetime.
    const authority = { owned: true as const, containerId: "a".repeat(64) };
    const events: string[] = [];
    await expect(withQualificationPostgresAuthority({
      existing: undefined,
      acquire: async () => { events.push("acquire"); return authority; },
      release: async (value) => { events.push(`release:${value.containerId}`); },
      run: async (value) => { events.push(`run:${value.containerId}`); throw new Error("qualification red"); },
    })).rejects.toThrow("qualification red");
    expect(events).toEqual(["acquire", `run:${authority.containerId}`, `release:${authority.containerId}`]);
  });

  it("pins every Docker authority read to the validated local endpoint", () => {
    const containerId = "a".repeat(64);
    const imageId = `sha256:${"b".repeat(64)}`;
    const commit = "c".repeat(40);
    const contextHost = "npipe:////./pipe/dockerDesktopLinuxEngine";
    const calls: string[][] = [];
    const inspect = {
      Id: containerId,
      Name: `/music-c10-qualification-${commit.slice(0, 7)}-pg15`,
      Image: imageId,
      Config: { Image: "postgres:15-alpine", Labels: {
        "com.explorers.music.c10-qualification": "true",
        "com.explorers.music.owner": "task10",
        "com.explorers.music.commit": commit,
      } },
      State: { Running: true, Health: { Status: "healthy" } },
      HostConfig: { PortBindings: { "5432/tcp": [{ HostIp: "127.0.0.1", HostPort: "55539" }] } },
    };
    const authority = attestC10StandalonePostgresAuthority({
      MUSIC_C10_STANDALONE_POSTGRES_ACK: "C10_LABELED_LOCAL_PG15",
      MUSIC_C10_STANDALONE_POSTGRES_PORT: "55539",
      MUSIC_C10_STANDALONE_POSTGRES_CONTAINER_ID: containerId,
      MUSIC_C10_STANDALONE_POSTGRES_COMMIT: commit,
    }, commit, {
      dockerRead: (args) => {
        calls.push(args);
        if (args[0] === "context" && args[1] === "show") return "desktop-linux\n";
        if (args[0] === "context" && args[1] === "inspect") return JSON.stringify(contextHost);
        if (args.includes("--type")) return JSON.stringify(inspect);
        if (args.includes("image")) return `${imageId}\n`;
        throw new Error(`unexpected Docker read: ${args.join(" ")}`);
      },
    });
    expect(authority).toEqual(expect.objectContaining({ port: 55539, imageId }));
    expect(calls.slice(2)).toHaveLength(2);
    expect(calls.slice(2).every((args) => args[0] === "--host" && args[1] === contextHost)).toBe(true);
  });

  it("lets integration setup use only the acknowledged standalone PG target", () => {
    expect(validateIntegrationDatabaseTarget("postgresql://music_migrator:secret@127.0.0.1:55539/music_fixture", {
      MUSIC_C10_STANDALONE_POSTGRES_ACK: "C10_LABELED_LOCAL_PG15",
      MUSIC_C10_STANDALONE_POSTGRES_PORT: "55539",
      MUSIC_C10_STANDALONE_POSTGRES_CONTAINER_ID: "a".repeat(64),
      MUSIC_C10_STANDALONE_POSTGRES_COMMIT: "c".repeat(40),
    }).port).toBe("55539");
    expect(() => validateIntegrationDatabaseTarget("postgresql://music_migrator:secret@127.0.0.1:55539/music_fixture", {}))
      .toThrow(/exact disposable/i);
    expect(() => validateIntegrationDatabaseTarget("postgresql://music_migrator:secret@localhost:55539/music_fixture", {
      MUSIC_C10_STANDALONE_POSTGRES_ACK: "C10_LABELED_LOCAL_PG15",
      MUSIC_C10_STANDALONE_POSTGRES_PORT: "55539",
      MUSIC_C10_STANDALONE_POSTGRES_CONTAINER_ID: "a".repeat(64),
      MUSIC_C10_STANDALONE_POSTGRES_COMMIT: "c".repeat(40),
    })).toThrow(/exact disposable/i);
  });

  it("runs the isolated CLI contract behind a Docker mutation boundary", () => {
    const helper = readFileSync(resolve(import.meta.dirname, "../../../scripts/music-isolated-cli-contract.ts"), "utf8");
    expect(helper).toContain("fixture Docker mutation blocked");
    expect(helper).toContain("fakeDockerDirectory");
    expect(helper).toContain("MUSIC_C10_ISOLATED_DOCKER_SCRIPT");
    expect(helper).toContain("compose-config fixture model");
  });

  it("resolves the isolated Docker script explicitly on Windows and rejects ambient daemon authority", () => {
    const parent = mkdtempSync(join(tmpdir(), "music-c10-cli-contract-"));
    const directory = join(parent, "fake-docker");
    const script = join(directory, "fake-docker.cjs");
    const npmScript = join(directory, "fake-npm.cjs");
    try {
      mkdirSync(directory);
      writeFileSync(script, "process.exit(70);\n");
      writeFileSync(npmScript, "process.exit(70);\n");
      expect(resolveC10IsolatedDockerExecutable({
        MUSIC_C10_ISOLATED_DOCKER_ACK: "C10_MUTATION_BLOCKED",
        MUSIC_C10_ISOLATED_DOCKER_SCRIPT: script,
      }, { platform: "win32", nodeExecPath: "C:\\node\\node.exe", temporaryRoot: tmpdir() })).toEqual({
        file: "C:\\node\\node.exe",
        args: [script],
      });
      expect(resolveC10IsolatedNpmExecutable({
        MUSIC_C10_ISOLATED_DOCKER_ACK: "C10_MUTATION_BLOCKED",
        MUSIC_C10_ISOLATED_DOCKER_SCRIPT: script,
        MUSIC_C10_ISOLATED_NPM_EXECPATH: npmScript,
      }, { nodeExecPath: "C:\\node\\node.exe", temporaryRoot: tmpdir() })).toEqual({
        file: "C:\\node\\node.exe",
        args: [npmScript],
      });
      expect(() => resolveC10IsolatedDockerExecutable({
        MUSIC_C10_ISOLATED_DOCKER_ACK: "C10_MUTATION_BLOCKED",
        MUSIC_C10_ISOLATED_DOCKER_SCRIPT: script,
        DOCKER_HOST: "tcp://127.0.0.1:2375",
      }, { platform: "win32", nodeExecPath: "C:\\node\\node.exe", temporaryRoot: tmpdir() })).toThrow(/ambient Docker/i);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("exposes every lane through the one C0 Node CLI and root package contract", () => {
    for (const lane of ["fast", "pr", "nightly", "release"] as const) {
      expect(parseMusicCliArguments([`test:${lane}`])).toMatchObject({ command: `test:${lane}`, format: "human" });
    }
    const rootPackage = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../../package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    for (const lane of ["fast", "pr", "nightly"] as const) {
      expect(rootPackage.scripts[`music:test:${lane}`]).toBe(`npm run --silent music-cli -- test:${lane}`);
    }
    expect(rootPackage.scripts["music:test:release"]).toBeUndefined();
  });

  it("publishes explicit 100% critical-module coverage gates in both applications", () => {
    const root = resolve(import.meta.dirname, "../../../..");
    const tunesPackage = JSON.parse(readFileSync(resolve(root, "tunes/package.json"), "utf8")) as { scripts: Record<string, string> };
    const explorerPackage = JSON.parse(readFileSync(resolve(root, "explorers-earth/package.json"), "utf8")) as { scripts: Record<string, string> };
    for (const command of [tunesPackage.scripts["test:music-critical-coverage"], explorerPackage.scripts["test:music-critical-coverage"]]) {
      expect(command).toContain("coverage.thresholds.lines=100");
      expect(command).toContain("coverage.thresholds.branches=100");
      expect(command).toContain("coverage.thresholds.functions=100");
      expect(command).toContain("coverage.thresholds.statements=100");
      expect(command).toContain("coverage.thresholds.perFile=true");
    }
    const identityRepository = tunesPackage.scripts["test:music-c45:repository-coverage"];
    expect(identityRepository).toContain("server/repositories/musicIdentityRepository.ts");
    expect(identityRepository).toContain("coverage.thresholds.perFile=true");
    expect(identityRepository).toContain("coverage.thresholds.lines=100");
    expect(identityRepository).toContain("coverage.thresholds.branches=100");
    expect(MUSIC_QUALIFICATION_LANES.pr.stages.flatMap((stage) => stage.taskIds))
      .toContain("tunes-identity-repository-coverage");
    expect(qualificationTaskEnvironment("tunes-identity-repository-coverage"))
      .toMatchObject({ MUSIC_C3_POSTGRES_TEST: "1", MUSIC_C9_PUBLICATION_POSTGRES_TEST: "1" });
  });

  it("pins the four executable lanes to their hard wall-clock budgets", () => {
    expect(Object.fromEntries(Object.entries(MUSIC_QUALIFICATION_LANES)
      .map(([name, lane]) => [name, lane.budgetMs]))).toEqual({
      fast: 3 * 60_000,
      pr: 15 * 60_000,
      nightly: 45 * 60_000,
      release: 60 * 60_000,
    });
    expect(MUSIC_QUALIFICATION_LANES.fast.inherits).toEqual([]);
    expect(MUSIC_QUALIFICATION_LANES.pr.inherits).toEqual(["fast"]);
    expect(MUSIC_QUALIFICATION_LANES.nightly.inherits).toEqual(["pr"]);
    expect(MUSIC_QUALIFICATION_LANES.release.inherits).toEqual(["pr"]);
  });

  it("keeps long release recovery executables out of the 15-minute PR task and in release", () => {
    expect(MUSIC_QUALIFICATION_TASKS["tunes-full-unit"].npmArgs).toEqual(expect.arrayContaining([
      "--exclude", "server/test/deployment/**",
      "--exclude", "server/test/contracts/music-cli-contract.test.ts",
      "--maxWorkers=2",
      "--testTimeout=15000",
    ]));
    const deploymentContracts = [
      "music-command-plan.test.ts",
      "music-deploy-executable.test.ts",
      "music-deploy-workflow-security.test.ts",
      "music-deployment-files.test.ts",
      "music-deployment.test.ts",
      "music-health-routes.test.ts",
      "music-docker-release-authority.test.ts",
      "music-production-policy.test.ts",
      "music-publication-authority-verifier.test.ts",
      "music-readiness.test.ts",
      "registration-compat-process.test.ts",
      "registration-compat-traefik.test.ts",
    ].map((name) => `server/test/deployment/${name}`);
    const releaseArgs = MUSIC_QUALIFICATION_TASKS["release-rehearsal"].npmArgs;
    expect(deploymentContracts.every((path) => releaseArgs.includes(path))).toBe(true);
    expect(releaseArgs.filter((value) => value.startsWith("server/test/deployment/")))
      .toEqual(deploymentContracts);
    expect(qualificationTaskEnvironment("release-rehearsal")).toEqual({ MUSIC_C3_TRAEFIK_TEST: "1" });
    const outputFailure = (musicQualification as unknown as {
      qualificationTaskOutputFailure?: (taskId: string, stdout: string, stderr: string) => string | undefined;
    }).qualificationTaskOutputFailure;
    expect(outputFailure?.(
      "release-rehearsal",
      "Test Files  11 passed | 1 skipped (12)\nTests 172 passed | 3 skipped (175)",
      "",
    )).toContain("all 12 deployment test files");
    expect(outputFailure?.(
      "release-rehearsal",
      "Test Files  12 passed (12)\nTests 175 passed (175)",
      "",
    )).toBeUndefined();
    expect(MUSIC_QUALIFICATION_TASKS["isolated-cli-contract"].npmArgs)
      .toContain("tunes/scripts/music-isolated-cli-contract.ts");
    expect(MUSIC_QUALIFICATION_LANES.pr.stages.flatMap((stage) => stage.taskIds))
      .toContain("isolated-cli-contract");
  });

  it("gives every deployment process check bounded Windows scheduling headroom", () => {
    const source = readFileSync(resolve(
      import.meta.dirname,
      "../deployment/music-deploy-executable.test.ts",
    ), "utf8");
    expect(source).toContain(
      'const deploymentProcessRecoveryTimeoutMs = process.platform === "win32" ? 30_000 : 20_000;',
    );
    expect(source).not.toMatch(/\}, 20_000\);/);
    expect(source.match(/deploymentProcessRecoveryTimeoutMs/g)?.length).toBeGreaterThan(20);
  });

  it("gives the Windows checkpoint filesystem proof bounded scheduling headroom", () => {
    const source = readFileSync(resolve(
      import.meta.dirname,
      "../reconcileMusicIdentitiesCommand.test.ts",
    ), "utf8");
    expect(source).toContain(
      'const checkpointFilesystemTimeoutMs = process.platform === "win32" ? 10_000 : 5_000;',
    );
    expect(source).toMatch(/writes atomically with owner-only permissions and contains no identity rows[\s\S]*checkpointFilesystemTimeoutMs\);/);
  });

  it("adds real five-service browser and Docker evidence to nightly and release", () => {
    expect(MUSIC_QUALIFICATION_TASKS["fullstack-browser"].npmArgs)
      .toContain("music-auth-triggers.spec.ts");
    expect(MUSIC_QUALIFICATION_TASKS["fixture-fullstack-browser"].npmArgs)
      .toContain("music-fixture-fullstack.spec.ts");
    expect(MUSIC_QUALIFICATION_TASKS["real-docker-evidence"].npmArgs)
      .toContain("tunes/scripts/music-fixture-runtime.ts");
    expect(MUSIC_QUALIFICATION_TASKS["real-docker-release"].npmArgs).toEqual([]);
    expect(MUSIC_QUALIFICATION_TASKS["real-docker-release"].nativeReleaseMode).toBe("rehearsal");
    expect(MUSIC_QUALIFICATION_TASKS["interrupt-resume"].npmArgs)
      .toContain("tunes/scripts/music-interrupt-rehearsal.ts");
    const nightly = MUSIC_QUALIFICATION_LANES.nightly.stages.flatMap((stage) => stage.taskIds);
    const release = MUSIC_QUALIFICATION_LANES.release.stages.flatMap((stage) => stage.taskIds);
    expect(nightly).toEqual(expect.arrayContaining(["fullstack-browser", "accessibility-browser", "fixture-fullstack-browser"]));
    for (const id of ["fullstack-browser", "accessibility-browser", "fixture-fullstack-browser"] as const) {
      expect(MUSIC_QUALIFICATION_TASKS[id].npmArgs).toEqual(expect.arrayContaining(["test:e2e", "--project=chromium"]));
    }
    expect(release).toEqual(expect.arrayContaining([
      "fixture-fullstack-browser", "real-docker-evidence", "real-docker-release", "interrupt-resume",
    ]));

    const runtimeEvidence = readFileSync(resolve(import.meta.dirname, "../../../scripts/music-fixture-runtime.ts"), "utf8");
    expect(runtimeEvidence).toContain('import { MUSIC_COMPOSE_PROJECT } from "./music-compose-safety"');
    expect(runtimeEvidence).toContain("const project = MUSIC_COMPOSE_PROJECT");
    expect(runtimeEvidence).toContain('["stop", "tunes"]');
    expect(runtimeEvidence).toContain('["start", "tunes"]');
    expect(runtimeEvidence).toContain("outageObserved: true");
    expect(runtimeEvidence).toContain("recoveryVerified: true");
    expect(runtimeEvidence).toContain('"http://127.0.0.1:55000/api/register"');
    expect(runtimeEvidence).toContain("compatibilityRouteUsage: 0");
    const interruptRehearsal = readFileSync(resolve(import.meta.dirname, "../../../scripts/music-interrupt-rehearsal.ts"), "utf8");
    expect(interruptRehearsal).toContain('"test:fast", "--format", "json"');
    expect(interruptRehearsal).toContain("MUSIC_C10_INTERRUPT_PROBE");
    expect(interruptRehearsal).toContain("ownedChildrenTerminated === true");
    expect(interruptRehearsal).toContain('"--resume", interruptedEnvelope.checkpoint');
    const cli = readFileSync(resolve(import.meta.dirname, "../../../scripts/music-cli.ts"), "utf8");
    expect(cli).toContain('process.env.MUSIC_C10_INTERRUPT_PROBE === "1"');
    expect(cli).toContain('process.emit("SIGINT")');
  });

  it("collects identity load and telemetry labels through HTTP, repositories, and PostgreSQL", () => {
    expect(MUSIC_QUALIFICATION_TASKS["load-postgres"].npmArgs)
      .toContain("server/test/load/music-load-http-postgres.integration.test.ts");
    expect(qualificationTaskEnvironment("load-postgres")).toMatchObject({ MUSIC_C10_POSTGRES_TEST: "1" });
  });

  it("builds the five-service Explorer against the fixture Tunes authority", () => {
    const root = resolve(import.meta.dirname, "../../../..");
    const compose = readFileSync(resolve(root, "docker-compose.music-test.yml"), "utf8");
    const dockerfile = readFileSync(resolve(root, "explorers-earth/Dockerfile.music-fixture"), "utf8");
    expect(compose).toContain("VITE_LOCAL_TUNES_API_URL: https://music-fixture.invalid");
    expect(compose).not.toContain("VITE_LOCAL_TUNES_URL:");
    expect(dockerfile).toContain("ARG VITE_LOCAL_TUNES_API_URL");
    expect(dockerfile).toContain("VITE_LOCAL_TUNES_API_URL=$VITE_LOCAL_TUNES_API_URL");
    expect(dockerfile).toContain("RUN npm run build");
    expect(dockerfile).not.toContain("MUSIC_FIXTURE_BUILD");
    expect(dockerfile).not.toContain("VITE_LOCAL_TUNES_URL");
    const browserFixture = readFileSync(resolve(root, "explorers-earth/e2e/music-fixture-fullstack.spec.ts"), "utf8");
    expect(browserFixture).toContain('context.route("https://music-fixture.invalid/**"');
    expect(browserFixture).toContain('route.fetch({ url: `http://127.0.0.1:55000${upstream.pathname}${upstream.search}` })');
    expect(browserFixture).toContain('/google-auth/callback?access_token=fixture-read-only-token');
    expect(browserFixture).not.toContain("setupMockAuthentication");
  });

  it("runs the complete Explorer unit suite in PR while fast remains affected-only", () => {
    expect(MUSIC_QUALIFICATION_TASKS["explorer-music-unit"].npmArgs)
      .toContain("src/features/music");
    expect(MUSIC_QUALIFICATION_TASKS["explorer-full-unit"].npmArgs)
      .toEqual(["run", "test:unit", "--prefix", "explorers-earth"]);
    expect(MUSIC_QUALIFICATION_LANES.pr.stages.flatMap((stage) => stage.taskIds))
      .toContain("explorer-full-unit");
  });

  it("converts task-launch failures into sanitized lane evidence for the one diagnostic rerun", () => {
    const source = readFileSync(resolve(import.meta.dirname, "../../../scripts/music-cli.ts"), "utf8");
    const start = source.indexOf("async function runQualificationTask(");
    const end = source.indexOf("\nfunction createTestEnv", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(source.slice(start, end)).toContain("catch (error)");
    expect(source.slice(start, end)).toContain("stderr: redactedError(error)");
  });

  it("gives concurrent browser tasks isolated non-fixture dev-server ports", () => {
    const ports = ["browser-smoke", "fullstack-browser", "accessibility-browser"].map(preferredQualificationPort);
    expect(new Set(ports).size).toBe(ports.length);
    expect(ports.every((port) => Number.isSafeInteger(port) && port >= 56_000 && port <= 60_000)).toBe(true);
    expect(ports).not.toContain(51_337);
    expect(ports).not.toContain(55_173);
  });

  it("enables every historical Music PostgreSQL gate only for real-DB qualification tasks", () => {
    expect(qualificationTaskEnvironment("postgres-integration")).toEqual({
      MUSIC_C3_POSTGRES_TEST: "1",
      MUSIC_C4_POSTGRES_TEST: "1",
      MUSIC_C5_POSTGRES_TEST: "1",
      MUSIC_C6_POSTGRES_TEST: "1",
      MUSIC_C7_POSTGRES_TEST: "1",
      MUSIC_C8_POSTGRES_TEST: "1",
      MUSIC_C9_PUBLICATION_POSTGRES_TEST: "1",
      MUSIC_C10_POSTGRES_TEST: "1",
    });
    expect(qualificationTaskEnvironment("tunes-unit")).toEqual({});
  });

  it("assigns every C10 security, database, browser, load, chaos, and recovery requirement", () => {
    const required = new Set(MUSIC_QUALIFICATION_REQUIREMENTS);
    const assigned = new Set(Object.values(MUSIC_QUALIFICATION_TASKS)
      .flatMap((task) => task.requirements));
    expect(assigned).toEqual(required);

    for (const lane of Object.values(MUSIC_QUALIFICATION_LANES)) {
      expect(lane.stages.every((stage) => stage.taskIds.length > 0)).toBe(true);
    }
    expect(MUSIC_QUALIFICATION_LANES.pr.stages.some((stage) => stage.parallel)).toBe(true);
  });

  it("serializes filesystem-heavy critical coverage before the parallel PR workload", () => {
    const stages = MUSIC_QUALIFICATION_LANES.pr.stages;
    expect(stages[0]).toEqual({
      id: "pr-critical-coverage",
      parallel: false,
      taskIds: ["tunes-critical-coverage", "explorer-critical-coverage"],
    });
    expect(stages.slice(1).flatMap((stage) => stage.parallel ? stage.taskIds : []))
      .not.toContain("tunes-critical-coverage");
    expect(stages.slice(1).flatMap((stage) => stage.parallel ? stage.taskIds : []))
      .not.toContain("explorer-critical-coverage");
    expect(MUSIC_QUALIFICATION_TASKS["tunes-critical-coverage"].npmArgs)
      .toEqual(expect.arrayContaining(["--maxWorkers=1", "--fileParallelism=false"]));
  });

  it("caps the complete nightly and release scheduler instead of raising task timeouts", () => {
    for (const lane of ["nightly", "release"] as const) {
      for (const stage of [
        ...MUSIC_QUALIFICATION_LANES.fast.stages,
        ...MUSIC_QUALIFICATION_LANES.pr.stages,
        ...MUSIC_QUALIFICATION_LANES[lane].stages,
      ]) {
        expect(qualificationStageConcurrency(lane, stage, "win32")).toBe(1);
        expect(qualificationStageConcurrency(lane, stage, "linux")).toBeLessThanOrEqual(2);
      }
    }
    expect(qualificationStageConcurrency("pr", MUSIC_QUALIFICATION_LANES.pr.stages[1], "win32")).toBe(4);
  });

  it("enforces the nightly concurrency cap in the executable scheduler", async () => {
    let active = 0;
    let peak = 0;
    const report = await runMusicQualificationLane("nightly", {
      artifactDirectory: "unused",
      execute: async (task) => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 2));
        active -= 1;
        return {
          exitCode: 0,
          stdout: "ok",
          stderr: "",
          durationMs: 2,
          artifact: `artifact-${task.id}`,
        };
      },
      writeReport: async () => "qualification-report.json",
    });

    expect(report.status).toBe("success");
    expect(peak).toBe(process.platform === "win32" ? 1 : 2);
  });

  it("caps shared PostgreSQL and release rehearsal file parallelism", () => {
    for (const id of [
      "postgres-integration",
      "tunes-repository-coverage",
      "tunes-identity-repository-coverage",
      "load-postgres",
      "chaos-postgres",
      "release-rehearsal",
    ] as const) {
      expect(MUSIC_QUALIFICATION_TASKS[id].npmArgs).toEqual(expect.arrayContaining([
        "--maxWorkers=1",
        "--fileParallelism=false",
      ]));
    }
  });

  it("keeps an original failure red after one diagnostic rerun passes", async () => {
    const attempts = new Map<string, number>();
    const report = await runMusicQualificationLane("fast", {
      artifactDirectory: "unused",
      execute: async (task) => {
        const attempt = (attempts.get(task.id) ?? 0) + 1;
        attempts.set(task.id, attempt);
        return {
          exitCode: task.id === "music-types-scoped" && attempt === 1 ? 1 : 0,
          stdout: task.id === "music-types-scoped" ? "authorization=private-value" : "ok",
          stderr: "",
          durationMs: 10,
          artifact: `artifact-${task.id}-${attempt}`,
        };
      },
      writeReport: async () => "qualification-report.json",
    });

    expect(report.status).toBe("failure");
    expect(report.failureCodes).toContain("QUALIFICATION_TASK_FAILED");
    const failed = report.tasks.find((task) => task.id === "music-types-scoped");
    expect(failed).toMatchObject({ originalStatus: "failure", diagnosticStatus: "success", attempts: 2 });
    expect(report.telemetry.flakyDiagnosticReruns).toBe(1);
    expect(report.telemetry.taskStatus).toEqual(expect.objectContaining({ failure: 1 }));
  });

  it("fails a budget overrun with timing evidence", async () => {
    const report = await runMusicQualificationLane("fast", {
      artifactDirectory: "unused",
      execute: async (task) => ({
        exitCode: 0,
        stdout: "ok",
        stderr: "",
        durationMs: task.id === "music-types-scoped" ? 181_000 : 1,
        artifact: `artifact-${task.id}`,
      }),
      writeReport: async () => "qualification-report.json",
    });

    expect(report.status).toBe("failure");
    expect(report.failureCodes).toContain("QUALIFICATION_BUDGET_EXCEEDED");
    expect(report.timing).toMatchObject({ budgetMs: 180_000 });
    expect(report.timing.wallClockMs).toBeGreaterThan(180_000);
  });

  it("records cross-run lane percentiles and concrete release measurements", async () => {
    const report = await runMusicQualificationLane("fast", {
      artifactDirectory: "unused",
      priorLaneWallClockMs: [100, 200],
      measurements: {
        bootstrap: { status: "success", durationMs: 11 },
        doctor: { status: "success", durationMs: 12 },
        smoke: { status: "success", durationMs: 13 },
        coldFirstGreenMs: 36,
        warmFirstGreenMs: 13,
        fixtureAgeMs: 42,
        interruptCleanup: "verified",
        resume: "verified",
        documentationContractFailures: 0,
        compatibilityRouteUsage: 0,
        telemetryCardinality: "bounded",
        load: [],
        operations: [],
      },
      execute: async (task) => ({
        exitCode: 0, stdout: "", stderr: "", durationMs: 10, artifact: `artifact-${task.id}`,
      }),
      writeReport: async () => "qualification-report.json",
    });

    expect(report.timing).toMatchObject({
      wallClockMs: 10,
      laneSamples: 3,
      laneP50Ms: 100,
      laneP95Ms: 200,
    });
    expect(report.measurements).toMatchObject({
      bootstrap: { status: "success", durationMs: 11 },
      doctor: { status: "success", durationMs: 12 },
      smoke: { status: "success", durationMs: 13 },
      coldFirstGreenMs: 36,
      warmFirstGreenMs: 13,
      fixtureAgeMs: 42,
      interruptCleanup: "verified",
      resume: "verified",
      documentationContractFailures: 0,
      compatibilityRouteUsage: 0,
      telemetryCardinality: "bounded",
    });
  });

  it("keeps release red when mandatory executable measurements are absent or failed", () => {
    const report: MusicQualificationReport = {
      schemaVersion: "music-qualification/v1" as const,
      lane: "release" as const,
      status: "success",
      failureCodes: [],
      timing: { budgetMs: 1, wallClockMs: 1, taskP50Ms: 1, taskP95Ms: 1, laneSamples: 1, laneP50Ms: 1, laneP95Ms: 1 },
      tasks: [],
      telemetry: { taskStatus: { success: 0, failure: 0, timeout: 0 }, flakyDiagnosticReruns: 0 },
    };
    attachMusicQualificationMeasurements(report, {
      fixtureAgeMs: 1,
      interruptCleanup: "not-run",
      resume: "not-run",
      documentationContractFailures: 1,
      telemetryCardinality: "not-run",
      load: [],
      operations: [],
    });
    expect(report.status).toBe("failure");
    expect(report.failureCodes).toEqual(["QUALIFICATION_MEASUREMENT_FAILED"]);
    expect(report.measurementIssues).toEqual(expect.arrayContaining([
      "bootstrap-not-successful", "cold-first-green-missing-or-over-budget", "real-docker-release-missing",
      "compatibility-route-usage-not-zero", "telemetry-not-bounded",
    ]));
  });

  it("promotes only bounded load p50/p95 JSON into sanitized lane evidence", () => {
    expect(parseMusicQualificationLoadMeasurements([
      "test output",
      JSON.stringify({ schemaVersion: "music-load/v1", metric: "ensure", firstEnsure50Ms: 12,
        firstEnsureP50Ms: 10, firstEnsureP95Ms: 11, cachedP95Ms: 1, strapiCalls: 2, token: "must-not-pass" }),
      JSON.stringify({ schemaVersion: "other/v1", metric: "owner", ownerP95Ms: 2 }),
    ].join("\n"))).toEqual([{
      schemaVersion: "music-load/v1", metric: "ensure", firstEnsure50Ms: 12,
      firstEnsureP50Ms: 10, firstEnsureP95Ms: 11, cachedP95Ms: 1, strapiCalls: 2,
    }]);

    const realPathMeasurements = [
      { schemaVersion: "music-load/v1", metric: "ensure", firstEnsure50Ms: 12, firstEnsureP50Ms: 10,
        firstEnsureP95Ms: 11, cachedCalls: 200, cachedP50Ms: 1, cachedP95Ms: 1, strapiCalls: 2 },
      { schemaVersion: "music-load/v1", metric: "owner", ownerCalls: 200, ownerP50Ms: 1,
        ownerP95Ms: 2, strapiCalls: 0, invalidTokensRejected: 200 },
      { schemaVersion: "music-load/v1", metric: "postgres-pool", concurrentQueries: 50, poolMax: 4, p50Ms: 20, p95Ms: 50 },
      { schemaVersion: "music-load/v1", metric: "socket-owner-guest", ownerConnections: 12, guestConnections: 24,
        admittedConnections: 36, admissionP50Ms: 20, admissionP95Ms: 30, acceptedGuestRequests: 16,
        rateLimitedGuestRequests: 8, ownerGuestRequestDeliveries: 192, guestRequestP50Ms: 4,
        guestRequestP95Ms: 5, ownerPlayerStateEvents: 12, guestPlayerStateDeliveries: 288,
        playerStateP50Ms: 3, playerStateP95Ms: 4 },
      { schemaVersion: "music-load/v1", metric: "telemetry-labels", events: 274, distinctMetricKeySets: 1,
        maxMetricKeys: 8, forbiddenMetricKeys: 0, labelValueCardinality: 8,
        metricKeySet: "cache,circuit,conflict,latencyMs,outcome,retryCount,singleFlight,upstreamCallCount" },
    ] as const;
    expect(qualificationTelemetryIsBounded([...realPathMeasurements])).toBe(true);
    expect(qualificationTelemetryIsBounded(realPathMeasurements.slice(0, -1))).toBe(false);
    expect(qualificationTelemetryIsBounded([])).toBe(false);
  });

  it("derives cold and warm first-green only from one exact authority sequence", () => {
    const authority = { commit: "a".repeat(40), environmentFingerprint: "b".repeat(64) };
    const record = (runId: string, command: string, durationMs: number, status: "success" | "failure" = "success") => ({
      ...authority, runId, command, durationMs, status,
    });
    const measurement = selectMusicTimeToFirstGreen([
      { ...record("0", "bootstrap", 999), environmentFingerprint: "c".repeat(64) },
      record("1", "bootstrap", 10), record("2", "doctor", 20), record("3", "up", 30),
      record("4", "test:smoke", 40), record("5", "test:smoke", 5),
    ], authority);
    expect(measurement).toEqual({ coldFirstGreenMs: 100, warmFirstGreenMs: 5 });
    expect(selectMusicTimeToFirstGreen([record("1", "bootstrap", 10), record("2", "doctor", 20, "failure")], authority))
      .toEqual({ coldFirstGreenMs: undefined, warmFirstGreenMs: undefined });
  });

  it("accepts prior lane and load evidence only from a green exact authority", () => {
    const authority = { commit: "a".repeat(40), environmentFingerprint: "b".repeat(64) };
    expect(qualificationReportMatchesAuthority({ status: "success", authority }, authority)).toBe(true);
    expect(qualificationReportMatchesAuthority({ status: "failure", authority }, authority)).toBe(false);
    expect(qualificationReportMatchesAuthority({
      status: "success",
      authority: { ...authority, environmentFingerprint: "c".repeat(64) },
    }, authority)).toBe(false);
    expect(qualificationReportMatchesAuthority({ status: "success" }, authority)).toBe(false);

    const source = readFileSync(resolve(import.meta.dirname, "../../../scripts/music-cli.ts"), "utf8");
    expect(source).toContain("readQualificationLaneHistory(lane, context)");
    expect(source).toContain("readLatestQualificationLoadMeasurements(context)");
    expect(source).toContain("qualificationTelemetryIsBounded(measurements)");
  });

  it("derives interrupt, resume, and compatibility evidence only from executable operation envelopes", () => {
    expect(parseMusicQualificationOperationalMeasurements([
      JSON.stringify({ schemaVersion: "music-operation/v1", metric: "interrupt-resume",
        interruptCleanup: "verified", resume: "verified", secret: "must-not-pass" }),
      JSON.stringify({ schemaVersion: "music-operation/v1", metric: "real-docker-release",
        compatibilityRouteUsage: 0, migrationFailureObserved: true, readinessFailureObserved: true,
        rollbackRestored: true, unknownRollbackRefused: true, preFloorRollbackRefused: true,
        killSwitchVerified: true }),
    ].join("\n"))).toEqual([
      { schemaVersion: "music-operation/v1", metric: "interrupt-resume", interruptCleanup: "verified", resume: "verified" },
      { schemaVersion: "music-operation/v1", metric: "real-docker-release", compatibilityRouteUsage: 0,
        migrationFailureObserved: true, readinessFailureObserved: true, rollbackRestored: true,
        unknownRollbackRefused: true, preFloorRollbackRefused: true, killSwitchVerified: true },
    ]);
  });

  it("persists C0 command results and feeds sanitized history into executable lanes", () => {
    const source = readFileSync(resolve(import.meta.dirname, "../../../scripts/music-cli.ts"), "utf8");
    expect(source).toContain('"command-result.json"');
    expect(source).toContain("readQualificationLaneHistory(lane, context)");
    expect(source).toContain("attachMusicQualificationMeasurements(report, collectQualificationMeasurements(report.tasks, context))");
  });

  it("uses stable percentiles and redacts bounded evidence", () => {
    expect(percentile([50, 10, 40, 30, 20], 0.5)).toBe(30);
    expect(percentile([50, 10, 40, 30, 20], 0.95)).toBe(50);
    expect(sanitizeQualificationText(
      "postgresql://owner:private@localhost/music Bearer abc.def authorization=private token:private",
    )).toBe("postgresql://[REDACTED]@localhost/music Bearer [REDACTED] authorization=[REDACTED] token=[REDACTED]");
    const token68 = "Bearer a+b/c==";
    expect(sanitizeQualificationText(token68)).toBe("Bearer [REDACTED]");
    expect(sanitizeMusicCliText(token68)).toBe("Bearer [REDACTED]");
  });

  it("redacts exact bare generated authorities from child evidence", () => {
    const generatedSecret = "qLw5fZG2aN7pR8sT9uV0xY1z";
    const evidence = sanitizeMusicCliText(`child printed ${generatedSecret} without a key`, [generatedSecret]);
    expect(evidence).toBe("child printed [REDACTED] without a key");
    expect(evidence).not.toContain(generatedSecret);

    const source = readFileSync(resolve(import.meta.dirname, "../../../scripts/music-cli.ts"), "utf8");
    expect(source).toContain("qualificationSensitiveValues(activeFixtureEnvironment)");
    expect(source).toContain("sanitizeStructuredOutput(result.stdout, sensitiveValues)");
    expect(source).toContain("sanitizeStructuredOutput(result.stderr, sensitiveValues)");
  });

  it("sanitizes hostile checkpoint and Docker inspection corpora before persistence", () => {
    const repository = resolve(import.meta.dirname, "../../../..");
    const secretValues = ["session-value-private", "strapi-value-private"];
    const inspect = JSON.stringify([{
      Config: {
        Env: [
          "NODE_ENV=production",
          "SESSION_SECRET=session-value-private",
          "COOKIE_SECRET=cookie-value-private",
          "MUSIC_SIGNING_KEY_CURRENT_SECRET=signing-value-private",
          "STRAPI_ACCESS_TOKEN=strapi-value-private",
        ],
      },
      Mounts: [{ Source: `${repository}\\.artifacts\\music-token-secrets\\current-private` }],
      Trace: "at run (C:\\Users\\alice\\workspace\\music\\runner.ts:42:1) /home/bob/work/music",
    }]);
    const boundedInspect = sanitizeMusicChildArtifactOutput("docker", "inspect-containers", inspect, secretValues);
    expect(boundedInspect).toMatch(/^\[DOCKER_STRUCTURED_OUTPUT_REDACTED bytes=\d+\]$/);
    for (const forbidden of [
      ...secretValues, "cookie-value-private", "signing-value-private", "C:\\Users\\alice", "/home/bob",
      repository, "music-token-secrets", "current-private", '"Config"', '"Mounts"',
    ]) expect(boundedInspect).not.toContain(forbidden);

    const checkpoint = JSON.stringify(sanitizeMusicCheckpointData({
      schemaVersion: "music-cli/v1",
      artifacts: [resolve(repository, ".artifacts/music-runs/hostile/child-003-inspect-containers.log")],
      checkpoint: resolve(repository, ".artifacts/music-runs/hostile/checkpoint.json"),
      details: JSON.parse(inspect),
      error: `failure at C:\\Users\\alice\\workspace SESSION_SECRET=${secretValues[0]}`,
    }, secretValues));
    for (const forbidden of [
      ...secretValues, "cookie-value-private", "signing-value-private", "C:\\Users\\alice", "/home/bob", repository,
    ]) expect(checkpoint).not.toContain(forbidden);
    expect(checkpoint).toContain(".artifacts/music-runs/hostile/checkpoint.json");
    expect(checkpoint).toContain("SESSION_SECRET=[REDACTED]");
    expect(checkpoint).toContain("NODE_ENV=production");
  });

  it("redacts generic cryptographic authority keys across text, structured data, and value collection", () => {
    const publicationKey = "fixture-publication-current-key-material";
    const gateKey = "fixture-gate-attestation-key-material";
    const signingKey = "fixture-signing-key-material";
    const encryptionCredential = "fixture-encryption-credential-material";
    const text = sanitizeMusicCliText([
      `MUSIC_PUBLICATION_RESPONSE_CURRENT_KEY=${publicationKey}`,
      `music_gate_attestation_key=${gateKey}`,
      `signingKey=${signingKey}`,
      `encryption_credential=${encryptionCredential}`,
      `--publication-response-key ${publicationKey}`,
    ].join(" "));
    for (const value of [publicationKey, gateKey, signingKey, encryptionCredential]) {
      expect(text).not.toContain(value);
    }

    const structured = JSON.stringify(sanitizeMusicCheckpointData({
      Config: {
        Env: [
          `MUSIC_PUBLICATION_RESPONSE_CURRENT_KEY=${publicationKey}`,
          `Music_Gate_Attestation_Key=${gateKey}`,
        ],
      },
      nested: {
        privateKey: publicationKey,
        SIGNING_SECRET: signingKey,
        encryptionToken: encryptionCredential,
      },
      measurements: { invalidTokensRejected: 200, monkeyCount: 7 },
    }));
    for (const value of [publicationKey, gateKey, signingKey, encryptionCredential]) {
      expect(structured).not.toContain(value);
    }
    expect(structured).toContain('"invalidTokensRejected":200');
    expect(structured).toContain('"monkeyCount":7');

    const collect = (musicCli as unknown as {
      musicSensitiveEnvironmentValues?: (environment: Record<string, string>) => string[];
    }).musicSensitiveEnvironmentValues;
    expect(collect?.({
      MUSIC_PUBLICATION_RESPONSE_CURRENT_KEY: publicationKey,
      music_gate_attestation_key: gateKey,
      SIGNING_PRIVATE_KEY: signingKey,
      ENCRYPTION_CREDENTIAL: encryptionCredential,
      MUSIC_METRIC_KEY_COUNT: "8",
    })).toEqual([publicationKey, gateKey, signingKey, encryptionCredential]);
  });

  it("preserves bounded numeric telemetry while redacting adjacent secret-shaped fields", () => {
    const persisted = sanitizeMusicCheckpointData({
      measurements: {
        load: [{
          schemaVersion: "music-load/v1",
          metric: "telemetry-labels",
          ownerCalls: 200,
          invalidTokensRejected: 200,
          distinctMetricKeySets: 1,
          maxMetricKeys: 8,
          forbiddenMetricKeys: 0,
          metricKeySet: "cache,circuit,conflict,latencyMs,outcome,retryCount,singleFlight,upstreamCallCount",
          apiToken: "must-not-persist",
        }],
      },
    }) as { measurements: { load: Array<Record<string, unknown>> } };

    expect(persisted.measurements.load[0]?.invalidTokensRejected).toBe(200);
    expect(persisted.measurements.load[0]?.distinctMetricKeySets).toBe(1);
    expect(persisted.measurements.load[0]?.maxMetricKeys).toBe(8);
    expect(persisted.measurements.load[0]?.forbiddenMetricKeys).toBe(0);
    expect(persisted.measurements.load[0]?.metricKeySet).toBe(
      "cache,circuit,conflict,latencyMs,outcome,retryCount,singleFlight,upstreamCallCount",
    );
    expect(persisted.measurements.load[0]?.apiToken).toBe("[REDACTED]");
  });

  it("keeps qualification artifact paths portable and developer-anonymous", () => {
    const source = readFileSync(resolve(import.meta.dirname, "../../../scripts/music-cli.ts"), "utf8");
    expect(source).toContain("portableQualificationArtifact(artifact)");
    expect(source).toContain("portableQualificationArtifact(writeArtifact(");
    expect(source).toContain("checkpoint: checkpoint ? portableQualificationArtifact(checkpoint) : undefined");
    expect(source).toContain("portableQualificationArtifact(commandResult)");
    expect(source).toContain("if (!suppressEvidence)");
    expect(source).toContain("see ${portableQualificationArtifact(artifact)}");
    expect(source).toContain("assertQualificationSourceClean()");
    expect(source).toContain('"status", "--porcelain=v1", "--untracked-files=all"');
  });

  it("suppresses evidence only for an explicit preflight no-mutation refusal", () => {
    const source = readFileSync(resolve(import.meta.dirname, "../../../scripts/music-cli.ts"), "utf8");
    expect(source).toContain("suppressEvidence?: boolean");
    expect(source).toContain("const suppressEvidence = result.suppressEvidence === true");
    expect(source).not.toContain('result.error?.includes("MUSIC_FIXTURE_LEGACY_ENVIRONMENT_UNSUPPORTED")');
    expect(source.match(/suppressEvidence: true/g)).toHaveLength(2);
  });
});
