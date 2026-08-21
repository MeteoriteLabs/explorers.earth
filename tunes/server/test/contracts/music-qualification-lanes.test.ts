import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseMusicCliArguments, sanitizeMusicCliText, selectMusicTimeToFirstGreen } from "../../../scripts/music-cli";
import {
  attachMusicQualificationMeasurements,
  MUSIC_QUALIFICATION_LANES,
  MUSIC_QUALIFICATION_REQUIREMENTS,
  MUSIC_QUALIFICATION_TASKS,
  parseMusicQualificationLoadMeasurements,
  parseMusicQualificationOperationalMeasurements,
  percentile,
  preferredQualificationPort,
  qualificationTaskEnvironment,
  runMusicQualificationLane,
  sanitizeQualificationText,
  type MusicQualificationReport,
  qualificationTelemetryIsBounded,
  qualificationReportMatchesAuthority,
} from "../../../scripts/music-qualification";

describe("portable Music qualification lanes", () => {
  it("exposes every lane through the one C0 Node CLI and root package contract", () => {
    for (const lane of ["fast", "pr", "nightly", "release"] as const) {
      expect(parseMusicCliArguments([`test:${lane}`])).toMatchObject({ command: `test:${lane}`, format: "human" });
    }
    const rootPackage = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../../package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    for (const lane of ["fast", "pr", "nightly", "release"] as const) {
      expect(rootPackage.scripts[`music:test:${lane}`]).toBe(`npm run --silent music-cli -- test:${lane}`);
    }
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
    ]));
    expect(MUSIC_QUALIFICATION_TASKS["release-rehearsal"].npmArgs)
      .toContain("server/test/deployment/music-deploy-executable.test.ts");
  });

  it("adds real five-service browser and Docker evidence to nightly and release", () => {
    expect(MUSIC_QUALIFICATION_TASKS["fixture-fullstack-browser"].npmArgs)
      .toContain("music-fixture-fullstack.spec.ts");
    expect(MUSIC_QUALIFICATION_TASKS["real-docker-evidence"].npmArgs)
      .toContain("tunes/scripts/music-fixture-runtime.ts");
    expect(MUSIC_QUALIFICATION_TASKS["real-docker-release"].npmArgs)
      .toContain("tunes/scripts/music-docker-release-rehearsal.ts");
    expect(MUSIC_QUALIFICATION_TASKS["interrupt-resume"].npmArgs)
      .toContain("tunes/scripts/music-interrupt-rehearsal.ts");
    const nightly = MUSIC_QUALIFICATION_LANES.nightly.stages.flatMap((stage) => stage.taskIds);
    const release = MUSIC_QUALIFICATION_LANES.release.stages.flatMap((stage) => stage.taskIds);
    expect(nightly).toContain("fixture-fullstack-browser");
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

    expect(qualificationTelemetryIsBounded([
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
    ])).toBe(true);
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
