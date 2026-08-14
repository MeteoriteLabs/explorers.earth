import { describe, expect, it, vi } from "vitest";
import { lifecycleBackoffMs, manuallyRepairMusicDeletion, runMusicLifecycleWorkerOnce, startMusicLifecycleWorker } from "../workers/musicLifecycleWorker";
import { authorizationMatrixFromInventory } from "../policies/musicSurfacePolicy";

const operation = {
  operationId: "delete-operation-a",
  musicUserId: 7,
  userDocumentId: "user-document-a",
  accountDocumentId: "account-document-a",
  attemptCount: 2,
};

describe("music lifecycle worker", () => {
  it("finalizes only authoritative absence and leaves present or unknown identities intact", async () => {
    // Break caught: destructive cleanup on presence, uncertainty, or an upstream outage.
    const claimed = [
      operation,
      { ...operation, operationId: "delete-operation-b", musicUserId: 8, userDocumentId: "user-document-b" },
      { ...operation, operationId: "delete-operation-c", musicUserId: 9, userDocumentId: "user-document-c" },
    ];
    const repository = {
      claimDueDeletions: vi.fn(async () => claimed),
      finalizeDeletion: vi.fn(async () => true),
      recordDeletionObservation: vi.fn(async () => undefined),
    };
    const proveAbsence = vi.fn(async ({ userDocumentId }: { userDocumentId: string }) =>
      userDocumentId.endsWith("a") ? "absent" as const
        : userDocumentId.endsWith("b") ? "present" as const : "unknown" as const);

    const result = await runMusicLifecycleWorkerOnce({ repository, proveAbsence, maxAttempts: 5, batchSize: 10 });

    expect(result).toEqual({ claimed: 3, finalized: 1, deferred: 2, deadLettered: 0 });
    expect(repository.finalizeDeletion).toHaveBeenCalledTimes(1);
    expect(repository.finalizeDeletion).toHaveBeenCalledWith(operation);
    expect(repository.recordDeletionObservation).toHaveBeenCalledTimes(2);
  });

  it("dead-letters at the bounded maximum and exposes a manual repair seam", async () => {
    // Break caught: unbounded retries or silently abandoning an exhausted operation.
    const exhausted = { ...operation, attemptCount: 5 };
    const repository = {
      claimDueDeletions: vi.fn(async () => [exhausted]),
      finalizeDeletion: vi.fn(async () => true),
      recordDeletionObservation: vi.fn(async () => undefined),
    };

    const result = await runMusicLifecycleWorkerOnce({
      repository,
      proveAbsence: async () => "outage",
      maxAttempts: 5,
      batchSize: 1,
    });

    expect(result.deadLettered).toBe(1);
    expect(repository.recordDeletionObservation).toHaveBeenCalledWith(exhausted, "outage", true);
  });

  it("normalizes thrown absence checks to outage and passes an explicit scan timestamp", async () => {
    const now = new Date("2026-08-14T12:00:00.000Z");
    const repository = {
      claimDueDeletions: vi.fn(async () => [operation]),
      finalizeDeletion: vi.fn(async () => true),
      recordDeletionObservation: vi.fn(async () => undefined),
    };
    await expect(runMusicLifecycleWorkerOnce({
      repository, proveAbsence: async () => { throw new Error("secret outage"); }, maxAttempts: 5, batchSize: 1, now,
    })).resolves.toEqual({ claimed: 1, finalized: 0, deferred: 1, deadLettered: 0 });
    expect(repository.claimDueDeletions).toHaveBeenCalledWith({ now, batchSize: 1, maxAttempts: 5 });
    expect(repository.recordDeletionObservation).toHaveBeenCalledWith(operation, "outage", false);
  });

  it("manually repairs only after a fresh authoritative absence proof", async () => {
    const finalizeDeletion = vi.fn(async () => true);
    await expect(manuallyRepairMusicDeletion({
      operation, proveAbsence: async () => "present", finalizeDeletion,
    })).resolves.toBe(false);
    expect(finalizeDeletion).not.toHaveBeenCalled();
    await expect(manuallyRepairMusicDeletion({
      operation, proveAbsence: async () => "absent", finalizeDeletion,
    })).resolves.toBe(true);
    expect(finalizeDeletion).toHaveBeenCalledWith(operation);
  });

  it("uses bounded exponential backoff", () => {
    // Break caught: a zero, negative, or unbounded retry interval.
    expect([1, 2, 3, 20].map((attempt) => lifecycleBackoffMs(attempt))).toEqual([
      1_000, 2_000, 4_000, 300_000,
    ]);
  });

  it("runs one bounded scan at a time and stops without per-user timers", async () => {
    // Break caught: overlapping intervals multiply worker calls during an outage.
    vi.useFakeTimers();
    let release!: () => void;
    const runOnce = vi.fn(() => new Promise<void>((resolve) => { release = resolve; }));
    const worker = startMusicLifecycleWorker({ intervalMs: 1_000, runOnce, onError: vi.fn() });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(runOnce).toHaveBeenCalledTimes(1);
    release();
    await vi.runAllTicks();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(runOnce).toHaveBeenCalledTimes(2);
    worker.stop();
    vi.useRealTimers();
  });

  it("rejects unsafe worker intervals", () => {
    for (const intervalMs of [999, 3_600_001, 1_000.5]) {
      expect(() => startMusicLifecycleWorker({ intervalMs, runOnce: async () => undefined, onError: vi.fn() })).toThrow("interval is invalid");
    }
  });

  it("contains a failed scan and continues on the next bounded tick", async () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    const runOnce = vi.fn()
      .mockRejectedValueOnce(new Error("database unavailable"))
      .mockResolvedValue(undefined);
    const worker = startMusicLifecycleWorker({ intervalMs: 1_000, runOnce, onError });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(onError).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(runOnce).toHaveBeenCalledTimes(2);
    worker.stop();
    vi.useRealTimers();
  });

  it("classifies the lifecycle worker as internal service authority in the generated matrix", () => {
    // Break caught: a destructive worker job is omitted from authorization review.
    const matrix = authorizationMatrixFromInventory({
      routes: [], events: [], jobs: [{
        kind: "setInterval", lifecycle: "scheduled-callback",
        source: "tunes/server/workers/musicLifecycleWorker.ts", line: 1,
      }],
    });
    expect(matrix.jobs).toEqual([{
      kind: "setInterval",
      lifecycle: "scheduled-callback",
      source: "tunes/server/workers/musicLifecycleWorker.ts",
      decision: "internal-service",
      allowed: { internalService: true, browser: false, public: false },
    }]);
  });
});
