import { readFileSync } from "node:fs";
import { link, mkdir, mkdtemp, readdir, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  HttpMusicReconciliationSource,
  assertMusicReconciliationResume,
  formatMusicReconciliationReport,
  interruptMusicReconciliationCheckpoint,
  readMusicReconciliationCheckpoint,
  reconcileMusicIdentities,
  writeMusicReconciliationCheckpoint,
  type MusicReconciliationCheckpoint,
  type MusicReconciliationResumeContext,
} from "../commands/reconcileMusicIdentities";
import {
  STRAPI_RECONCILIATION_SCHEMA_VERSION,
  type MusicReconciliationReport,
  type ReconciliationSourceMetadata,
} from "../services/musicReconciler";

const source: ReconciliationSourceMetadata = {
  schemaVersion: STRAPI_RECONCILIATION_SCHEMA_VERSION,
  sourceSnapshot: "snapshot-1",
  sourceChecksum: "a".repeat(64),
  total: 2,
  pageCount: 1,
};
const context: MusicReconciliationResumeContext = {
  commit: "a".repeat(40),
  fixtureVersion: "1",
  fixtureSchemaVersion: "strapi-identity-fixture/v1",
  environment: "fixture",
  environmentFingerprint: "b".repeat(64),
  gateValues: { MUSIC_RECONCILIATION_ENABLED: "false", MUSIC_RECONCILIATION_MAX_ROWS: "0" },
  thresholds: {
    pageSize: 100,
    maxRows: 1_000,
    batchSize: 100,
    maxChangeAbsolute: 2,
    maxChangePercent: 1,
    maxPages: 1_000,
    scanTimeoutMs: 1_800_000,
    requestTimeoutMs: 120_000,
    maxResponseBytes: 16 * 1024 * 1024,
    maxCanonicalBytes: 16 * 1024 * 1024,
    databaseLockTimeoutMs: 5_000,
    databaseStatementTimeoutMs: 120_000,
    databaseIdleTransactionTimeoutMs: 30_000,
  },
};

function checkpoint(overrides: Partial<MusicReconciliationCheckpoint> = {}): MusicReconciliationCheckpoint {
  return {
    schemaVersion: "music-reconciliation-checkpoint/v1",
    state: "reviewed",
    runId: "run-1",
    ...context,
    source,
    nextPage: 2,
    review: { source, planFingerprint: "c".repeat(64), approvalToken: "d".repeat(64) },
    report: {
      schemaVersion: "music-reconciliation/v1",
      runId: "run-1",
      status: "success",
      mode: "dry-run",
      source,
      local: { total: 2, eligible: 2 },
      changes: {
        matched: 2, missing: 0, firstMisses: 0, secondMisses: 0,
        projectedUpdates: 0, proposedChangePercent: 0, suspended: 0, tombstoneConflicts: 0, applied: false,
      },
      thresholds: { maxChangeAbsolute: 2, maxChangePercent: 1 },
      metrics: { pages: 1, databaseBatches: 1, durationMs: 5 },
      anomalies: [],
      planFingerprint: "c".repeat(64),
      approvalToken: "d".repeat(64),
    },
    ...overrides,
  };
}

describe("HttpMusicReconciliationSource", () => {
  it("uses the explicit stable paged read-only contract without leaking its token", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ data: [], meta: {} }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    const client = new HttpMusicReconciliationSource({
      baseUrl: "https://strapi.example.test/root/",
      serviceToken: "read-only-secret",
      timeoutMs: 1_000,
      maxResponseBytes: 4_096,
      fetchImpl,
    });

    await client.fetchPage({ page: 2, pageSize: 100, order: "documentId:asc", sourceSnapshot: "snap 1" });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe("https://strapi.example.test/api/music-identities?pagination%5Bpage%5D=2&pagination%5BpageSize%5D=100&sort=documentId%3Aasc&sourceSnapshot=snap+1");
    expect(init).toMatchObject({ method: "GET", redirect: "error", headers: { authorization: "Bearer read-only-secret", accept: "application/json" } });
    expect(JSON.stringify({ url, init }).replaceAll("read-only-secret", "[secret]")).not.toContain("read-only-secret");
  });

  it.each([
    ["non-success", new Response("no", { status: 503, headers: { "content-type": "application/json" } })],
    ["non-json", new Response("ok", { status: 200, headers: { "content-type": "text/plain" } })],
    ["oversized", new Response(JSON.stringify({ value: "x".repeat(128) }), { status: 200, headers: { "content-type": "application/json" } })],
    ["malformed", new Response("{", { status: 200, headers: { "content-type": "application/json" } })],
    ["empty", new Response(null, { status: 200, headers: { "content-type": "application/json" } })],
  ])("fails closed for a %s upstream response", async (_name, response) => {
    const client = new HttpMusicReconciliationSource({
      baseUrl: "https://strapi.example.test",
      serviceToken: "secret",
      timeoutMs: 100,
      maxResponseBytes: 64,
      fetchImpl: vi.fn(async () => response),
    });
    await expect(client.fetchPage({ page: 1, pageSize: 1, order: "documentId:asc" })).rejects.toThrow();
  });

  it("validates constructor bounds and advertised response length", async () => {
    const valid = { baseUrl: "https://strapi.example.test", serviceToken: "secret", timeoutMs: 100, maxResponseBytes: 64 };
    for (const options of [
      { ...valid, serviceToken: "" },
      { ...valid, serviceToken: "x".repeat(4_097) },
      { ...valid, timeoutMs: 0 },
      { ...valid, timeoutMs: 120_001 },
      { ...valid, timeoutMs: 1.5 },
      { ...valid, maxResponseBytes: 0 },
      { ...valid, maxResponseBytes: 16 * 1024 * 1024 + 1 },
      { ...valid, maxResponseBytes: 1.5 },
    ]) expect(() => new HttpMusicReconciliationSource(options)).toThrow();

    const client = new HttpMusicReconciliationSource({
      ...valid,
      fetchImpl: vi.fn(async () => new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json", "content-length": "1000" },
      })),
    });
    await expect(client.fetchPage({ page: 1, pageSize: 1, order: "documentId:asc" })).rejects.toThrow(/size limit/i);
  });

  it("uses the platform fetch only when no transport is injected", async () => {
    const original = globalThis.fetch;
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchImpl);
    try {
      const client = new HttpMusicReconciliationSource({
        baseUrl: "https://strapi.example.test", serviceToken: "secret", timeoutMs: 100, maxResponseBytes: 64,
      });
      await expect(client.fetchPage({ page: 1, pageSize: 1, order: "documentId:asc" })).resolves.toEqual({});
      expect(fetchImpl).toHaveBeenCalledOnce();
    } finally {
      vi.stubGlobal("fetch", original);
    }
  });

  it("cancels an unadvertised response stream as soon as the byte bound is crossed", async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(40));
        controller.enqueue(new Uint8Array(40));
      },
      cancel() { cancelled = true; },
    });
    const client = new HttpMusicReconciliationSource({
      baseUrl: "https://strapi.example.test", serviceToken: "secret", timeoutMs: 100, maxResponseBytes: 64,
      fetchImpl: vi.fn(async () => new Response(body, { status: 200, headers: { "content-type": "application/json" } })),
    });
    await expect(client.fetchPage({ page: 1, pageSize: 1, order: "documentId:asc" })).rejects.toThrow(/size limit/i);
    expect(cancelled).toBe(true);
  });
});

describe("music reconciliation checkpoints", () => {
  it("writes atomically with owner-only permissions and contains no identity rows", async () => {
    const directory = await mkdtemp(join(tmpdir(), "music-reconciliation-checkpoint-"));
    const path = join(directory, "checkpoint.json");
    await writeMusicReconciliationCheckpoint(path, checkpoint());

    expect(await readMusicReconciliationCheckpoint(path)).toEqual(checkpoint());
    const contents = readFileSync(path, "utf8");
    expect(contents).not.toContain("identities");
    expect(contents).not.toContain("email");
    if (process.platform !== "win32") expect((await stat(path)).mode & 0o777).toBe(0o600);
  });

  it.each([
    ["commit", { commit: "different" }],
    ["fixture version", { fixtureVersion: "2" }],
    ["fixture schema", { fixtureSchemaVersion: "changed" }],
    ["environment", { environment: "staging" as const }],
    ["environment fingerprint", { environmentFingerprint: "changed" }],
    ["gate", { gateValues: { ...context.gateValues, MUSIC_RECONCILIATION_ENABLED: "true" } }],
    ["threshold", { thresholds: { ...context.thresholds, maxChangeAbsolute: 3 } }],
  ])("rejects %s drift", (_name, drift) => {
    expect(() => assertMusicReconciliationResume(checkpoint(), { ...context, ...drift })).toThrow(/resume/i);
  });

  it("rejects source drift independently of other resume context", () => {
    expect(() => assertMusicReconciliationResume(checkpoint(), context, "snapshot-2")).toThrow(/source snapshot/i);
  });

  it("atomically marks only an in-progress checkpoint interrupted", async () => {
    const directory = await mkdtemp(join(tmpdir(), "music-reconciliation-interrupt-"));
    const path = join(directory, "checkpoint.json");
    await writeMusicReconciliationCheckpoint(path, checkpoint({ state: "scanning", review: undefined, report: undefined }));
    await expect(interruptMusicReconciliationCheckpoint(path)).resolves.toBe(true);
    await expect(readMusicReconciliationCheckpoint(path)).resolves.toMatchObject({ state: "interrupted" });
    await expect(interruptMusicReconciliationCheckpoint(path)).resolves.toBe(true);
    await expect(interruptMusicReconciliationCheckpoint(join(directory, "missing.json"))).resolves.toBe(false);
  });

  it("rejects semantically inconsistent checkpoints and invalid filesystem targets", async () => {
    const directory = await mkdtemp(join(tmpdir(), "music-reconciliation-invalid-"));
    const path = join(directory, "checkpoint.json");
    const invalidReviewed = [
      checkpoint({ state: "reviewed", review: undefined }),
      checkpoint({ state: "reviewed", report: { ...checkpoint().report!, mode: "apply" } }),
      checkpoint({ state: "reviewed", report: { ...checkpoint().report!, status: "blocked" } }),
      checkpoint({ state: "reviewed", report: { ...checkpoint().report!, runId: "another-run" } }),
      checkpoint({ state: "reviewed", review: { ...checkpoint().review!, planFingerprint: "e".repeat(64) } }),
      checkpoint({ state: "reviewed", review: { ...checkpoint().review!, approvalToken: "e".repeat(64) } }),
      checkpoint({ state: "reviewed", review: { ...checkpoint().review!, source: { ...source, sourceSnapshot: "snapshot-2" } } }),
      checkpoint({ state: "reviewed", source: { ...source, sourceSnapshot: "snapshot-2" } }),
    ];
    const invalidApplied = [
      checkpoint({ state: "applied", review: undefined, report: { ...checkpoint().report!, mode: "apply" } }),
      checkpoint({ state: "applied" }),
      checkpoint({ state: "applied", report: { ...checkpoint().report!, mode: "apply", status: "blocked" } }),
      checkpoint({ state: "applied", report: { ...checkpoint().report!, mode: "apply", changes: undefined } }),
      checkpoint({ state: "applied", report: { ...checkpoint().report!, mode: "apply", changes: { ...checkpoint().report!.changes!, applied: false } } }),
    ];
    for (const invalid of [...invalidReviewed, ...invalidApplied]) {
      await expect(writeMusicReconciliationCheckpoint(path, invalid)).rejects.toThrow();
    }

    const targetDirectory = join(directory, "target-directory");
    await mkdir(targetDirectory);
    const before = await readdir(directory);
    await expect(writeMusicReconciliationCheckpoint(targetDirectory, checkpoint())).rejects.toThrow();
    expect(await readdir(directory)).toEqual(before);

    await expect(readMusicReconciliationCheckpoint(targetDirectory)).rejects.toThrow(/invalid/i);
    await writeFile(path, "x");
    await expect(readMusicReconciliationCheckpoint(path)).rejects.toThrow(/invalid/i);
    await writeFile(path, "x".repeat(1024 * 1024 + 1));
    await expect(readMusicReconciliationCheckpoint(path)).rejects.toThrow(/invalid/i);
    const link = join(directory, "checkpoint-link.json");
    try {
      await symlink(path, link, "file");
      await expect(readMusicReconciliationCheckpoint(link)).rejects.toThrow(/invalid/i);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EPERM") throw error;
    }
  });
});

describe("reconcileMusicIdentities", () => {
  it("persists scanning and reviewed checkpoints around a default dry-run", async () => {
    const directory = await mkdtemp(join(tmpdir(), "music-reconcile-command-"));
    const path = join(directory, "checkpoint.json");
    const report = checkpoint().report!;
    const run = vi.fn(async (input: Parameters<Parameters<typeof reconcileMusicIdentities>[0]["reconciler"]["run"]>[0]) => {
      await input.onSourceCheckpoint?.({ ...source, nextPage: 2 });
      return report;
    });

    const result = await reconcileMusicIdentities({
      reconciler: { run },
      checkpointPath: path,
      context,
      run: {
        runId: "run-1", environment: "fixture", applyEnabled: false,
        pageSize: 100, maxRows: 1_000, batchSize: 100,
        maxChangeAbsolute: 2, maxChangePercent: 1,
      },
    });

    expect(result).toEqual(report);
    expect(run).toHaveBeenCalledWith(expect.objectContaining({ requestedMode: "dry-run" }));
    expect(await readMusicReconciliationCheckpoint(path)).toMatchObject({ state: "reviewed", source, review: { source } });
  });

  it("requires a reviewed resume artifact for apply and pins its source", async () => {
    const directory = await mkdtemp(join(tmpdir(), "music-reconcile-apply-"));
    const resumePath = join(directory, "review.json");
    const checkpointPath = join(directory, "apply.json");
    await writeMusicReconciliationCheckpoint(resumePath, checkpoint());
    await writeMusicReconciliationCheckpoint(checkpointPath, checkpoint({ state: "blocked", review: undefined, report: undefined }));
    const applied: MusicReconciliationReport = { ...checkpoint().report!, runId: "run-2", mode: "apply", changes: { ...checkpoint().report!.changes!, applied: true } };
    const run = vi.fn(async () => applied);

    await reconcileMusicIdentities({
      reconciler: { run }, checkpointPath, resumePath, context,
      run: {
        runId: "run-2", environment: "fixture", applyEnabled: true,
        requestedMode: "apply", approvalToken: "d".repeat(64),
        pageSize: 100, maxRows: 1_000, batchSize: 100,
        maxChangeAbsolute: 2, maxChangePercent: 1,
      },
    });

    expect(run).toHaveBeenCalledWith(expect.objectContaining({
      review: checkpoint().review,
      expectedSource: source,
      requestedMode: "apply",
    }));
    expect(await readMusicReconciliationCheckpoint(checkpointPath)).toMatchObject({ state: "applied", runId: "run-2" });
    expect(await readMusicReconciliationCheckpoint(resumePath)).toMatchObject({ state: "reviewed", runId: "run-1" });
  });

  it("refuses to overwrite the reviewed resume evidence", async () => {
    const directory = await mkdtemp(join(tmpdir(), "music-reconcile-preserve-review-"));
    const path = join(directory, "review.json");
    await writeMusicReconciliationCheckpoint(path, checkpoint());
    await expect(reconcileMusicIdentities({
      reconciler: { run: vi.fn() }, checkpointPath: path, resumePath: path, context,
      run: {
        runId: "run-2", environment: "fixture", applyEnabled: true,
        requestedMode: "apply", approvalToken: "d".repeat(64),
        pageSize: 100, maxRows: 1_000, batchSize: 100,
        maxChangeAbsolute: 2, maxChangePercent: 1,
      },
    })).rejects.toThrow(/distinct.*reviewed/i);
    expect(await readMusicReconciliationCheckpoint(path)).toMatchObject({ state: "reviewed", runId: "run-1" });
  });

  it("refuses a hard-linked output that aliases reviewed evidence", async () => {
    const directory = await mkdtemp(join(tmpdir(), "music-reconcile-hardlink-review-"));
    const resumePath = join(directory, "review.json");
    const checkpointPath = join(directory, "apply.json");
    await writeMusicReconciliationCheckpoint(resumePath, checkpoint());
    await link(resumePath, checkpointPath);

    await expect(reconcileMusicIdentities({
      reconciler: { run: vi.fn() }, checkpointPath, resumePath, context,
      run: {
        runId: "run-2", environment: "fixture", applyEnabled: true,
        requestedMode: "apply", approvalToken: "d".repeat(64),
        pageSize: 100, maxRows: 1_000, batchSize: 100,
        maxChangeAbsolute: 2, maxChangePercent: 1,
      },
    })).rejects.toThrow(/distinct.*reviewed/i);
    expect(await readMusicReconciliationCheckpoint(resumePath)).toMatchObject({ state: "reviewed", runId: "run-1" });
  });

  it("propagates non-missing filesystem failures while comparing review evidence", async () => {
    const directory = await mkdtemp(join(tmpdir(), "music-reconcile-invalid-path-"));
    const resumePath = join(directory, "review.json");
    await writeMusicReconciliationCheckpoint(resumePath, checkpoint());
    await expect(reconcileMusicIdentities({
      reconciler: { run: vi.fn() }, checkpointPath: `${directory}\0invalid.json`, resumePath, context,
      run: {
        runId: "run-2", environment: "fixture", applyEnabled: true,
        requestedMode: "apply", approvalToken: "d".repeat(64),
        pageSize: 100, maxRows: 1_000, batchSize: 100,
        maxChangeAbsolute: 2, maxChangePercent: 1,
      },
    })).rejects.toThrow();
  });

  it("refuses mismatched thresholds and apply without a reviewed checkpoint", async () => {
    const directory = await mkdtemp(join(tmpdir(), "music-reconcile-refusal-"));
    const path = join(directory, "checkpoint.json");
    const reconciler = { run: vi.fn(async () => checkpoint().report!) };
    await expect(reconcileMusicIdentities({
      reconciler, checkpointPath: path, context,
      run: { runId: "run", environment: "fixture", applyEnabled: false, pageSize: 99, maxRows: 1_000, batchSize: 100, maxChangeAbsolute: 2, maxChangePercent: 1 },
    })).rejects.toThrow(/threshold/i);
    await expect(reconcileMusicIdentities({
      reconciler, checkpointPath: path, context,
      run: { runId: "run", environment: "fixture", applyEnabled: true, requestedMode: "apply", pageSize: 100, maxRows: 1_000, batchSize: 100, maxChangeAbsolute: 2, maxChangePercent: 1 },
    })).rejects.toThrow(/reviewed/i);
    await writeMusicReconciliationCheckpoint(path, checkpoint({ state: "scanning", review: undefined, report: undefined }));
    await expect(reconcileMusicIdentities({
      reconciler, checkpointPath: join(directory, "apply.json"), resumePath: path, context,
      run: { runId: "run", environment: "fixture", applyEnabled: true, requestedMode: "apply", pageSize: 100, maxRows: 1_000, batchSize: 100, maxChangeAbsolute: 2, maxChangePercent: 1 },
    })).rejects.toThrow(/reviewed/i);
    expect(reconciler.run).not.toHaveBeenCalled();
  });

  it("checkpoints partial progress and every non-review terminal state", async () => {
    const directory = await mkdtemp(join(tmpdir(), "music-reconcile-terminal-"));
    const baseRun = { runId: "run-terminal", environment: "fixture" as const, applyEnabled: false, pageSize: 100, maxRows: 1_000, batchSize: 100, maxChangeAbsolute: 2, maxChangePercent: 1 };
    const blocked: MusicReconciliationReport = {
      schemaVersion: "music-reconciliation/v1", runId: "run-terminal", status: "blocked", mode: "dry-run",
      metrics: { pages: 0, databaseBatches: 0, durationMs: 1 }, anomalies: [{ code: "SOURCE_UNAVAILABLE", message: "unavailable" }],
    };
    const blockedPath = join(directory, "blocked.json");
    await reconcileMusicIdentities({
      reconciler: { run: async (input) => { await input.onSourceCheckpoint?.({ nextPage: 2 }); return blocked; } },
      checkpointPath: blockedPath, context, run: baseRun,
    });
    const blockedCheckpoint = await readMusicReconciliationCheckpoint(blockedPath);
    expect(blockedCheckpoint).toMatchObject({ state: "blocked", nextPage: 1 });
    expect(blockedCheckpoint).not.toHaveProperty("source");

    const incomplete: MusicReconciliationReport = { ...checkpoint().report!, runId: "run-terminal", approvalToken: undefined };
    const incompletePath = join(directory, "incomplete.json");
    await reconcileMusicIdentities({ reconciler: { run: async () => incomplete }, checkpointPath: incompletePath, context, run: baseRun });
    await expect(readMusicReconciliationCheckpoint(incompletePath)).resolves.toMatchObject({ state: "blocked" });

    const resumePath = join(directory, "review.json");
    await writeMusicReconciliationCheckpoint(resumePath, checkpoint());
    const unapplied: MusicReconciliationReport = { ...checkpoint().report!, runId: "run-terminal", mode: "apply", changes: { ...checkpoint().report!.changes!, applied: false } };
    const applyPath = join(directory, "unapplied.json");
    await reconcileMusicIdentities({
      reconciler: { run: async () => unapplied }, checkpointPath: applyPath, resumePath, context,
      run: { ...baseRun, applyEnabled: true, requestedMode: "apply", approvalToken: "d".repeat(64) },
    });
    await expect(readMusicReconciliationCheckpoint(applyPath)).resolves.toMatchObject({ state: "blocked", review: checkpoint().review });
  });
});

describe("formatMusicReconciliationReport", () => {
  it("emits redacted aggregate-only human and JSON reports", () => {
    const report = checkpoint().report!;
    const human = formatMusicReconciliationReport(report, "human");
    const json = formatMusicReconciliationReport(report, "json");
    expect(human).toContain("matched=2");
    expect(human).toContain("eligibleTotal=2");
    expect(human).toContain("changePercent=0");
    expect(human).toContain("maxChangeAbsolute=2 maxChangePercent=1");
    expect(human).not.toContain("approvalToken");
    expect(JSON.parse(json)).toMatchObject({ schemaVersion: "music-reconciliation/v1", changes: { matched: 2 } });
    expect(`${human}\n${json}`).not.toContain("email");
  });

  it("formats blocked reports with unavailable aggregates and anomaly codes", () => {
    const report: MusicReconciliationReport = {
      schemaVersion: "music-reconciliation/v1", runId: "blocked", status: "blocked", mode: "dry-run",
      metrics: { pages: 0, databaseBatches: 0, durationMs: 0 },
      anomalies: [{ code: "SOURCE_UNAVAILABLE", message: "The source is unavailable." }],
    };
    expect(formatMusicReconciliationReport(report, "human")).toContain("sourceTotal=unavailable localTotal=unavailable");
    expect(formatMusicReconciliationReport(report, "human")).toContain("anomalies=SOURCE_UNAVAILABLE");
  });
});
