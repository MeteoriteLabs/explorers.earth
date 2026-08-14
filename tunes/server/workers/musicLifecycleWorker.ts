export type AuthoritativeAbsence = "absent" | "present" | "unknown" | "outage";

export interface ClaimedLifecycleDeletion {
  operationId: string;
  musicUserId: number;
  userDocumentId: string;
  accountDocumentId: string;
  attemptCount: number;
}

interface LifecycleWorkerRepository {
  claimDueDeletions(input: { now: Date; batchSize: number; maxAttempts: number }): Promise<ClaimedLifecycleDeletion[]>;
  finalizeDeletion(operation: ClaimedLifecycleDeletion): Promise<boolean>;
  recordDeletionObservation(operation: ClaimedLifecycleDeletion, observation: Exclude<AuthoritativeAbsence, "absent">, deadLetter: boolean): Promise<void>;
}

export function lifecycleBackoffMs(attempt: number): number {
  const boundedAttempt = Math.max(1, Math.min(20, Math.trunc(attempt)));
  return Math.min(300_000, 1_000 * 2 ** (boundedAttempt - 1));
}

export async function runMusicLifecycleWorkerOnce(input: {
  repository: LifecycleWorkerRepository;
  proveAbsence: (identity: { userDocumentId: string; accountDocumentId: string }) => Promise<AuthoritativeAbsence>;
  maxAttempts: number;
  batchSize: number;
  now?: Date;
}): Promise<{ claimed: number; finalized: number; deferred: number; deadLettered: number }> {
  const operations = await input.repository.claimDueDeletions({
    now: input.now ?? new Date(),
    batchSize: input.batchSize,
    maxAttempts: input.maxAttempts,
  });
  let finalized = 0;
  let deferred = 0;
  let deadLettered = 0;
  for (const operation of operations) {
    let observation: AuthoritativeAbsence;
    try {
      observation = await input.proveAbsence({
        userDocumentId: operation.userDocumentId,
        accountDocumentId: operation.accountDocumentId,
      });
    } catch {
      observation = "outage";
    }
    if (observation === "absent") {
      await input.repository.finalizeDeletion(operation);
      finalized += 1;
      continue;
    }
    const deadLetter = operation.attemptCount >= input.maxAttempts;
    await input.repository.recordDeletionObservation(operation, observation, deadLetter);
    if (deadLetter) deadLettered += 1;
    else deferred += 1;
  }
  return { claimed: operations.length, finalized, deferred, deadLettered };
}

export async function manuallyRepairMusicDeletion(input: {
  operation: ClaimedLifecycleDeletion;
  proveAbsence: (identity: { userDocumentId: string; accountDocumentId: string }) => Promise<AuthoritativeAbsence>;
  finalizeDeletion: (operation: ClaimedLifecycleDeletion) => Promise<boolean>;
}): Promise<boolean> {
  const proof = await input.proveAbsence(input.operation);
  if (proof !== "absent") return false;
  await input.finalizeDeletion(input.operation);
  return true;
}

export function startMusicLifecycleWorker(input: {
  intervalMs: number;
  runOnce: () => Promise<void>;
  onError: (error: unknown) => void;
}): { stop(): void } {
  if (!Number.isSafeInteger(input.intervalMs) || input.intervalMs < 1_000 || input.intervalMs > 3_600_000) {
    throw new Error("Music lifecycle worker interval is invalid");
  }
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    void input.runOnce().catch(input.onError).finally(() => { running = false; });
  }, input.intervalMs);
  timer.unref?.();
  return { stop: () => clearInterval(timer) };
}
