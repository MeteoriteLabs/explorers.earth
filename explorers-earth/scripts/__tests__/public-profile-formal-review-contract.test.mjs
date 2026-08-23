import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

test("npm spawn plans stay shell-free on Linux, macOS, and Windows", async () => {
  const { createNpmSpawnPlan } = await import("../npm-spawn-plan.mjs");

  assert.deepEqual(createNpmSpawnPlan("linux", ["run", "dev"], {
    execPath: "/usr/bin/node",
    npmCliPath: "/usr/lib/node_modules/npm/bin/npm-cli.js",
  }), {
    command: "/usr/bin/node",
    args: ["/usr/lib/node_modules/npm/bin/npm-cli.js", "run", "dev"],
    shell: false,
  });
  assert.deepEqual(createNpmSpawnPlan("darwin", ["run", "dev"], {
    execPath: "/opt/homebrew/bin/node",
    npmCliPath: "/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js",
  }), {
    command: "/opt/homebrew/bin/node",
    args: ["/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js", "run", "dev"],
    shell: false,
  });
  assert.deepEqual(createNpmSpawnPlan("win32", ["run", "dev"], {
    execPath: "C:/Program Files/nodejs/node.exe",
    npmCliPath: "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js",
  }), {
    command: "C:/Program Files/nodejs/node.exe",
    args: ["C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js", "run", "dev"],
    shell: false,
  });
});

test("protected Playwright policy never reuses a server and suppresses raw server output", async () => {
  const { playwrightRuntimePolicy } = await import("../playwright-runtime-policy.mjs");

  assert.deepEqual(
    playwrightRuntimePolicy({ project: "real-account", reuseRequested: true }),
    { reuseExistingServer: false, stdout: "ignore", stderr: "ignore" },
  );
  assert.deepEqual(
    playwrightRuntimePolicy({ project: "deterministic", reuseRequested: true }),
    { reuseExistingServer: true, stdout: "pipe", stderr: "pipe" },
  );
});

test("protected prerequisite validation fails closed before suite execution", async () => {
  const { validateProtectedPrerequisites } = await import("../protected-prerequisites.mjs");
  assert.throws(
    () => validateProtectedPrerequisites({}),
    /ENV_MISSING.*E2E_PROFILE_USERNAME.*E2E_PROFILE_STORAGE_STATE.*E2E_PROFILE_LIVE_WRITES/s,
  );
});

test("protected prerequisite validation reuses the full mutation environment doctor and exact account marker", async () => {
  const { validateProtectedPrerequisites } = await import("../protected-prerequisites.mjs");
  const complete = {
    E2E_PROFILE_USERNAME: "fixture-owner",
    E2E_PROFILE_STORAGE_STATE: "fixture-state.json",
    E2E_PROFILE_NON_OWNER_STORAGE_STATE: "fixture-non-owner-state.json",
    E2E_PROFILE_GALLERY_FILE: "fixture-gallery.png",
    E2E_PROFILE_RUN_ID: "qa-run-id",
    E2E_PROFILE_LIVE_WRITES: "1",
    E2E_PROFILE_LIVE_WRITE_CONFIRMATION: "I_APPROVE_PROFILE_MUTATION_AND_RESTORE",
    E2E_PROFILE_ROUTE_FIXTURES: JSON.stringify({ params: { placeSlug: "p", place: "p", guideSlug: "g", genreSlug: "g", subjectSlug: "s", sectorSlug: "s", listSlug: "l" }, enabledRouteIds: ["profile"], hiddenPath: "/fixture/books", deletedPath: "/fixture/books/deleted", unknownUsername: "unknown-fixture" }),
    VITE_API_URL: "https://api.fixture.invalid/graphql",
    VITE_PUBLIC_READ_ACCESS_TOKEN: "dedicated-read",
    VITE_ANALYTICS_WRITE_ACCESS_TOKEN: "dedicated-analytics",
    PUBLIC_API_CAPABILITY_SCOPE: "public-profile-read",
    PUBLIC_API_EXPECTED_ORIGIN: "https://fixture.invalid",
    PUBLIC_API_ORIGIN_POLICY: "fixture-only",
    PUBLIC_API_RATE_LIMIT_POLICY: "bounded",
    PUBLIC_API_CONTROLLED_FIXTURE: "fixture-owner",
    PUBLIC_API_PRIVATE_ACCOUNT_ID: "account-id",
    PUBLIC_API_PRIVATE_LIST_ID: "list-id",
    PUBLIC_API_PRIVATE_ITEM_ID: "item-id",
    PUBLIC_API_PRIVATE_LIST_SLUG: "list-slug",
    PUBLIC_API_RUN_ID: "qa-run-id",
    PUBLIC_PROFILE_MUTATION_APPROVED: "true",
    PUBLIC_PROFILE_TEST_ACCOUNT_MARKER: "public-profile-mutation-fixture",
    PUBLIC_API_ANALYTICS_QA_SINK: "qa-sink",
    PUBLIC_API_ANALYTICS_CANARY_MUTATION: "canary",
    PUBLIC_API_ANALYTICS_CLEANUP_MUTATION: "cleanup",
    PUBLIC_API_ANALYTICS_CLEANUP_VERIFY_QUERY: "verify",
    PUBLIC_API_ANALYTICS_RUN_CLEANUP_MUTATION: "mutation { cleanup: deleteQaRun }",
    PUBLIC_API_ANALYTICS_RUN_CLEANUP_VERIFY_QUERY: "query { remaining: qaRunEvents }",
  };

  assert.doesNotThrow(() => validateProtectedPrerequisites(complete));
  assert.throws(
    () => validateProtectedPrerequisites({ ...complete, PUBLIC_PROFILE_MUTATION_APPROVED: undefined }),
    /LIVE_WRITE_NOT_APPROVED/,
  );
  assert.throws(
    () => validateProtectedPrerequisites({ ...complete, PUBLIC_PROFILE_TEST_ACCOUNT_MARKER: "wrong-account" }),
    /ACCOUNT_MARKER_MISMATCH/,
  );
});

test("protected global setup fails before any protected test callback can begin", async () => {
  const { runProtectedGlobalSetup } = await import("../playwright-global-setup.mjs");
  let laterTestStarted = false;

  await assert.rejects(
    () => runProtectedGlobalSetup({
      projectNames: ["real-account"],
      env: {},
      onProtectedReady: () => { laterTestStarted = true; },
    }),
    /ENV_MISSING|LIVE_WRITE_NOT_APPROVED/,
  );
  assert.equal(laterTestStarted, false);
});

test("protected mutation setup cannot start callbacks before analytics cleanup and capability proof", async () => {
  const { runProtectedGlobalSetup } = await import("../playwright-global-setup.mjs");
  const { validateProtectedPrerequisites } = await import("../protected-prerequisites.mjs");
  const { runAnalyticsRunCleanupPreflight } = await import("../verify-public-api-access.mjs");
  const complete = {
    E2E_PROFILE_USERNAME: "fixture-owner", E2E_PROFILE_STORAGE_STATE: "owner.json",
    E2E_PROFILE_NON_OWNER_STORAGE_STATE: "non-owner.json", E2E_PROFILE_GALLERY_FILE: "gallery.png",
    E2E_PROFILE_RUN_ID: "qa-run",
    E2E_PROFILE_LIVE_WRITES: "1", E2E_PROFILE_LIVE_WRITE_CONFIRMATION: "I_APPROVE_PROFILE_MUTATION_AND_RESTORE",
    E2E_PROFILE_ROUTE_FIXTURES: JSON.stringify({ params: { placeSlug: "p", place: "p", guideSlug: "g", genreSlug: "g", subjectSlug: "s", sectorSlug: "s", listSlug: "l" }, enabledRouteIds: ["profile"], hiddenPath: "/fixture/books", deletedPath: "/fixture/books/deleted", unknownUsername: "unknown" }),
    VITE_API_URL: "https://api.fixture.invalid/graphql", VITE_PUBLIC_READ_ACCESS_TOKEN: "read", VITE_ANALYTICS_WRITE_ACCESS_TOKEN: "write",
    PUBLIC_API_CAPABILITY_SCOPE: "published-read-only", PUBLIC_API_EXPECTED_ORIGIN: "https://fixture.invalid",
    PUBLIC_API_ORIGIN_POLICY: JSON.stringify({ allowOrigins: ["https://fixture.invalid"] }), PUBLIC_API_RATE_LIMIT_POLICY: JSON.stringify({ environment: "non-production", limit: 1, windowSeconds: 1 }),
    PUBLIC_API_CONTROLLED_FIXTURE: "true", PUBLIC_API_PRIVATE_ACCOUNT_ID: "a", PUBLIC_API_PRIVATE_LIST_ID: "l", PUBLIC_API_PRIVATE_ITEM_ID: "i", PUBLIC_API_PRIVATE_LIST_SLUG: "s",
    PUBLIC_API_RUN_ID: "qa-run", PUBLIC_PROFILE_MUTATION_APPROVED: "true", PUBLIC_PROFILE_TEST_ACCOUNT_MARKER: "public-profile-mutation-fixture",
    PUBLIC_API_ANALYTICS_QA_SINK: "qa-sink", PUBLIC_API_ANALYTICS_CANARY_MUTATION: "mutation { canary: x }",
    PUBLIC_API_ANALYTICS_CLEANUP_MUTATION: "mutation { cleanup: x }", PUBLIC_API_ANALYTICS_CLEANUP_VERIFY_QUERY: "query { remaining: x }",
    PUBLIC_API_ANALYTICS_RUN_CLEANUP_MUTATION: "mutation { cleanup: deleteQaRun }", PUBLIC_API_ANALYTICS_RUN_CLEANUP_VERIFY_QUERY: "query { remaining: qaRunEvents }",
  };
  assert.doesNotThrow(() => validateProtectedPrerequisites(complete));
  let callback = false;
  await assert.rejects(() => runProtectedGlobalSetup({
    projectNames: ["real-account"], mode: "mutation", env: complete,
    verifyReleasePrerequisites: async () => ({ code: "ANALYTICS_CLEANUP_FAILED" }),
    onProtectedReady: () => { callback = true; },
  }), /ANALYTICS_CLEANUP_FAILED/);
  assert.equal(callback, false);

  const operations = [];
  await assert.rejects(() => runProtectedGlobalSetup({
    projectNames: ["real-account"], mode: "mutation", env: complete,
    verifyReleasePrerequisites: async () => runAnalyticsRunCleanupPreflight({
      endpoint: "https://fixture.invalid/graphql", token: "write", baseRunId: "qa-run", qaSink: "qa-sink",
      documents: { canary: "mutation { canary: x }", cleanupRun: "mutation { cleanup: x }", remainingRun: "query { remaining: x }" },
      writeRecoveryArtifact: async () => "/redacted/recovery.json",
      fetchImpl: async (_url, options) => {
        const { operationName } = JSON.parse(options.body); operations.push(operationName);
        if (operationName === "PreflightQaBrowserRun") throw new Error("lost acknowledgement");
        if (operationName === "EmergencyCleanupQaBrowserRun") return Response.json({ data: { cleanup: true } });
        return Response.json({ data: { remaining: [] } });
      },
    }),
    onProtectedReady: () => { callback = true; },
  }), /ANALYTICS_RUN_CLEANUP_UNAVAILABLE/);
  assert.deepEqual(operations, ["PreflightQaBrowserRun", "EmergencyCleanupQaBrowserRun", "EmergencyVerifyQaBrowserRun"]);
  assert.equal(callback, false);

  await assert.rejects(() => runProtectedGlobalSetup({
    projectNames: ["real-account"], mode: "mutation", env: complete,
    verifyReleasePrerequisites: async () => runAnalyticsRunCleanupPreflight({
      endpoint: "https://fixture.invalid/graphql", token: "write", baseRunId: "qa-run", qaSink: "qa-sink",
      documents: { canary: "mutation { canary: x }", cleanupRun: "mutation { cleanup: x }", remainingRun: "query { remaining: x }" },
      writeRecoveryArtifact: async () => { throw new Error("private disk path"); },
      fetchImpl: async (_url, options) => {
        const { operationName } = JSON.parse(options.body);
        if (operationName === "PreflightQaBrowserRun") throw new Error("lost acknowledgement");
        if (operationName === "EmergencyCleanupQaBrowserRun") return Response.json({ data: { cleanup: true } });
        return Response.json({ data: { remaining: [] } });
      },
    }),
    onProtectedReady: () => { callback = true; },
  }), /ANALYTICS_RUN_CLEANUP_UNAVAILABLE/);
  assert.equal(callback, false);
});

test("protected fixture and run-cleanup block paths are stable and named", async () => {
  const { validateProtectedReadOnlyPrerequisites, validateProtectedPrerequisites, validateRouteFixtureCoverage } = await import("../protected-prerequisites.mjs");
  assert.throws(() => validateProtectedReadOnlyPrerequisites({
    VITE_API_URL: "https://fixture.invalid/graphql", VITE_PUBLIC_READ_ACCESS_TOKEN: "read",
    E2E_PROFILE_USERNAME: "fixture", E2E_PROFILE_ROUTE_FIXTURES: "{}",
  }), /ROUTE_FIXTURE_INVALID/);
  const source = ["protected-prerequisites.mjs", "verify-public-profile-env.mjs"]
    .map((file) => fs.readFileSync(path.join(process.cwd(), "scripts", file), "utf8")).join("\n");
  assert.match(source, /ANALYTICS_CLEANUP_FAILED/);
  assert.match(source, /ANALYTICS_CANARY_REQUIRED/);
  assert.match(source, /ACCOUNT_MARKER_MISMATCH/);
  assert.match(source, /LIVE_WRITE_NOT_APPROVED/);
  assert.equal(typeof validateProtectedPrerequisites, "function");
  assert.throws(() => validateRouteFixtureCoverage({ enabledRouteIds: ["profile"] }, { public_profile: true }), /ROUTE_FIXTURE_COVERAGE_MISMATCH/);
  assert.throws(() => validateRouteFixtureCoverage({ enabledRouteIds: ["profile", "places-map", "places-detail-map", "places-map-detail", "community", "books-index"] }, { public_profile: true }), /ROUTE_FIXTURE_COVERAGE_MISMATCH/);
  const placesRoutes = ["profile", "places-index", "places-detail", "places-map", "places-detail-map", "places-map-detail", "community"];
  assert.doesNotThrow(() => validateRouteFixtureCoverage({ enabledRouteIds: placesRoutes, params: { placeSlug: "place-1" } }, { public_profile: true, public_recommendations: true }, { placeSlugs: ["place-1"] }));
  assert.throws(() => validateRouteFixtureCoverage({ enabledRouteIds: placesRoutes, params: {} }, { public_profile: true, public_recommendations: true }, { placeSlugs: ["place-1"] }), /ROUTE_FIXTURE_COVERAGE_MISMATCH/);
  assert.throws(() => validateRouteFixtureCoverage({ enabledRouteIds: placesRoutes, params: { placeSlug: "stale" } }, { public_profile: true, public_recommendations: true }, { placeSlugs: ["place-1"] }), /ROUTE_FIXTURE_COVERAGE_MISMATCH/);
  const movieRoutes = ["profile", "places-map", "places-detail-map", "places-map-detail", "community", "movies-index", "movies-genre", "movies-list"];
  assert.throws(() => validateRouteFixtureCoverage({ enabledRouteIds: movieRoutes, params: { movieGenreSlug: "movie-list-1", movieListSlug: "movie-list-1", placeSlug: "place-1" } }, { public_profile: true, public_movie: true }, { placeSlugs: ["place-1"], movieGenreSlugs: ["movie-genre-1"], movieListSlugs: ["movie-list-1"] }), /ROUTE_FIXTURE_COVERAGE_MISMATCH/);
  assert.throws(() => validateRouteFixtureCoverage({ enabledRouteIds: movieRoutes, params: { movieGenreSlug: "same", movieListSlug: "same", placeSlug: "place-1" } }, { public_profile: true, public_movie: true }, { placeSlugs: ["place-1"], movieGenreSlugs: ["same"], movieListSlugs: ["same"] }), /ROUTE_FIXTURE_COVERAGE_MISMATCH/);
});

test("protected read-only setup requires only the dedicated public-read tier", async () => {
  const { runProtectedGlobalSetup } = await import("../playwright-global-setup.mjs");
  let ready = false;
  await runProtectedGlobalSetup({
    projectNames: ["real-account"],
    mode: "read-only",
    env: { VITE_API_URL: "https://fixture.invalid/graphql", VITE_PUBLIC_READ_ACCESS_TOKEN: "read-only", E2E_PROFILE_USERNAME: "published-fixture", E2E_PROFILE_ROUTE_FIXTURES: JSON.stringify({ params: { placeSlug: "p", place: "p", guideSlug: "g", genreSlug: "g", subjectSlug: "s", sectorSlug: "s", listSlug: "l" }, enabledRouteIds: ["profile", "places-map", "places-detail-map", "places-map-detail", "community"], hiddenPath: "/fixture/books", deletedPath: "/fixture/books/deleted", unknownUsername: "unknown-fixture" }) },
    verifyReadOnlyPrerequisites: async () => ({ code: "PUBLIC_API_READY", accountVisibility: { public_profile: true }, fixtureIdentities: { placeSlugs: ["p"] } }),
    onProtectedReady: () => { ready = true; },
  });
  assert.equal(ready, true);
  await assert.rejects(
    () => runProtectedGlobalSetup({ projectNames: ["real-account"], mode: "read-only", env: {} }),
    /ENV_MISSING/,
  );
});

test("protected public parity binds accent and recommendations layout to production markers", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "e2e", "real-account", "profile-public-contract.spec.ts"), "utf8");
  assert.match(source, /data-accent-color/);
  assert.match(source, /recommendations-\$\{snapshot\.layout\}/);
  assert.match(source, /public accent must match the saved dashboard swatch/);
  assert.match(source, /assertPublicSnapshot\(publicPage, mutatedSnapshot\)/);
  assert.match(source, /assertPublicSnapshot\(publicPage, baselineSnapshot\)/);
});

test("Task 0 capabilities own every runtime GraphQL operation identity", async () => {
  const capabilities = await import("../public-api-capabilities.mjs");
  const all = [capabilities.ACCOUNT_BOOTSTRAP, ...capabilities.PUBLIC_COLLECTION_OPERATIONS];

  for (const capability of all) {
    assert.ok(Array.isArray(capability.runtimeOperationNames), `${capability.id} aliases missing`);
    assert.ok(capability.runtimeOperationNames.length > 0, `${capability.id} aliases empty`);
    assert.equal(new Set(capability.runtimeOperationNames).size, capability.runtimeOperationNames.length);
  }
  assert.ok(capabilities.ACCOUNT_BOOTSTRAP.runtimeOperationNames.includes("PublicProfileBootstrap"));
  assert.ok(
    capabilities.PUBLIC_COLLECTION_OPERATIONS.find((entry) => entry.id === "books")
      .runtimeOperationNames.includes("PublicBookLists"),
  );
});

test("protected output and attachment summaries are content-redacted", async () => {
  const { redactProtectedText, writeProtectedReport } = await import(
    "../protected-playwright-report.mjs"
  );
  const secret = "live-secret-token";
  const source = `Authorization: Bearer ${secret}\nemail=owner@example.com`;
  const redacted = redactProtectedText(source, [secret]);

  assert.doesNotMatch(redacted, /live-secret-token|owner@example\.com/);
  assert.match(redacted, /\[REDACTED\]/);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "protected-report-"));
  const output = path.join(root, "summary.json");
  await writeProtectedReport(output, {
    title: `journey ${secret}`,
    error: source,
    attachments: [{ name: "trace", path: `C:/private/${secret}/trace.zip`, body: source }],
  }, [secret]);
  const saved = fs.readFileSync(output, "utf8");
  assert.doesNotMatch(saved, /live-secret-token|owner@example\.com|C:\/private/);
  assert.doesNotMatch(saved, /"body"/);
});

test("failure artifact names include project, case, viewport, attempt, and kind", async () => {
  const { deterministicFailureArtifactName } = await import(
    "../playwright-artifact-name.mjs"
  );
  const input = {
    project: "deterministic",
    caseId: "books/list refresh",
    viewport: { width: 375, height: 667 },
    attempt: 2,
  };
  assert.equal(
    deterministicFailureArtifactName({ ...input, kind: "screenshot" }),
    "deterministic--books-list-refresh--375x667--attempt-2--screenshot.png",
  );
  assert.equal(
    deterministicFailureArtifactName({ ...input, kind: "trace" }),
    "deterministic--books-list-refresh--375x667--attempt-2--trace.zip",
  );
});

test("protected reporter redacts stdout and report content and removes raw attachments", async () => {
  const { default: ProtectedReporter } = await import("../protected-playwright-reporter.mjs");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "protected-reporter-"));
  const outputFile = path.join(root, "safe", "summary.json");
  const rawAttachment = path.join(root, "test-results", "trace.zip");
  fs.mkdirSync(path.dirname(rawAttachment), { recursive: true });
  fs.writeFileSync(rawAttachment, "live-secret-token owner@example.com");
  const stdout = [];
  const reporter = new ProtectedReporter({
    outputFile,
    secrets: ["live-secret-token"],
    writeStdout: (chunk) => stdout.push(chunk),
    artifactRoot: root,
  });

  reporter.onStdOut(Buffer.from("Bearer live-secret-token owner@example.com"));
  await reporter.onTestEnd(
    { titlePath: () => ["real", "owner@example.com"] },
    {
      status: "failed",
      retry: 0,
      errors: [{ message: "Bearer live-secret-token" }],
      attachments: [{ name: "trace", contentType: "application/zip", path: rawAttachment }],
    },
  );
  await reporter.onEnd({ status: "failed" });

  assert.doesNotMatch(stdout.join(""), /live-secret-token|owner@example\.com/);
  assert.equal(fs.existsSync(rawAttachment), false);
  const report = fs.readFileSync(outputFile, "utf8");
  assert.doesNotMatch(report, /live-secret-token|owner@example\.com|trace\.zip/);
});

test("protected reporting is allowlist-only under adversarial recursive Playwright values", async () => {
  const { createProtectedReport } = await import("../protected-playwright-report.mjs");
  const report = createProtectedReport({
    status: "failed",
    runId: "qa-run-17",
    tests: [{
      code: "PROTECTED_TEST_FAILED",
      status: "failed",
      operation: "profile-save-restore",
      error: {
        message: "owner@example.com Secret bio +10000000001",
        stack: "C:/private/account/profile.spec.ts:91",
        dom: "<main data-address='Secret street'>Fixture Owner</main>",
        nested: [{ token: "live-secret-token", phone: "+10000000001" }],
      },
      attachments: [{ path: "C:/private/trace.zip", body: "raw DOM snapshot" }],
    }],
  });

  assert.deepEqual(Object.keys(report).sort(), ["code", "runId", "status", "tests"]);
  assert.deepEqual(Object.keys(report.tests[0]).sort(), ["code", "operation", "status"]);
  assert.deepEqual(report, {
    code: "PROTECTED_RUN_COMPLETE",
    runId: "qa-run-17",
    status: "failed",
    tests: [{ code: "PROTECTED_TEST_FAILED", status: "failed", operation: "profile-save-restore" }],
  });
  assert.doesNotMatch(JSON.stringify(report), /owner|bio|address|phone|dom|secret|token|private|trace/i);
});

test("deterministic reporter copies ordinary failure artifacts to stable names", async () => {
  const { default: ArtifactReporter } = await import("../deterministic-artifact-reporter.mjs");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "artifact-reporter-"));
  const screenshot = path.join(root, "input", "test-failed-1.png");
  const trace = path.join(root, "input", "trace.zip");
  fs.mkdirSync(path.dirname(screenshot), { recursive: true });
  fs.writeFileSync(screenshot, Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+Av6vWQAAAABJRU5ErkJggg==",
    "base64",
  ));
  fs.writeFileSync(trace, "fixture trace");
  const reporter = new ArtifactReporter({ outputDir: path.join(root, "stable") });
  await reporter.onTestEnd(
    {
      titlePath: () => ["route matrix", "books/list refresh"],
      parent: { project: () => ({ name: "deterministic", use: { viewport: { width: 375, height: 667 } } }) },
    },
    {
      status: "failed",
      retry: 2,
      attachments: [
        { name: "screenshot", contentType: "image/png", path: screenshot },
        { name: "trace", contentType: "application/zip", path: trace },
      ],
    },
  );

  assert.deepEqual(fs.readdirSync(path.join(root, "stable")).sort(), [
    "deterministic--route-matrix-books-list-refresh--1x1--attempt-2--screenshot.png",
    "deterministic--route-matrix-books-list-refresh--1x1--attempt-2--trace.zip",
  ]);
});

test("coverage verifier separates strict pure modules from truthful legacy modules", async () => {
  const { verifyCoverageReports } = await import("../verify-public-profile-coverage.mjs");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "public-profile-coverage-"));
  const purePath = path.join(root, "pure.json");
  const legacyPath = path.join(root, "legacy.json");
  const metric = (pct) => ({ total: 1, covered: 1, skipped: 0, pct });
  const moduleMetric = { lines: metric(100), statements: metric(100), functions: metric(100), branches: metric(100) };

  fs.writeFileSync(purePath, JSON.stringify({
    total: moduleMetric,
    ...Object.fromEntries([
      "publicRouteContract.ts",
      "publicRouteResourceState.ts",
      "resolvePublicChildState.ts",
      "publicRouteReadiness.ts",
      "apolloTransport.ts",
    ].map((name) => [`C:/src/${name}`, moduleMetric])),
  }));
  fs.writeFileSync(legacyPath, JSON.stringify({
    total: { ...moduleMetric, branches: metric(73.4) },
    ...Object.fromEntries([
      "PublicProfileFallbackRedirect.tsx",
      "PublicProfileBootstrapContext.tsx",
      "PublicRouteReadinessContext.tsx",
      "usePublicRouteLifecycle.ts",
      "analyticsService.ts",
    ].map((name) => [`C:/src/${name}`, moduleMetric])),
  }));

  assert.deepEqual(verifyCoverageReports({
    pureSummaryPath: purePath,
    legacySummaryPath: legacyPath,
  }), { pureBranches: 100, legacyBranches: 73.4 });

  const incompleteLegacy = JSON.parse(fs.readFileSync(legacyPath, "utf8"));
  delete incompleteLegacy["C:/src/analyticsService.ts"];
  fs.writeFileSync(legacyPath, JSON.stringify(incompleteLegacy));
  assert.throws(
    () => verifyCoverageReports({ pureSummaryPath: purePath, legacySummaryPath: legacyPath }),
    /LEGACY_COVERAGE_MODULES_MISSING:analyticsService\.ts/,
  );
});
