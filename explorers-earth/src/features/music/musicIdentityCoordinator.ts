export interface ExplorerAccountCandidate {
  documentId?: unknown;
  Account_Name?: unknown;
  Account_Type?: unknown;
  mobile_number?: unknown;
}

export interface SelectedMusicAccount {
  documentId: string;
}

export function selectCompletedAccount(accounts: readonly ExplorerAccountCandidate[] | null | undefined): SelectedMusicAccount | undefined {
  const complete = (accounts ?? []).filter((account) =>
    typeof account.documentId === "string" && account.documentId.length > 0
    && typeof account.Account_Name === "string" && account.Account_Name.trim().length > 0
    && typeof account.Account_Type === "string" && account.Account_Type.trim().length > 0
    && typeof account.mobile_number === "string" && account.mobile_number.trim().length > 0,
  );
  return complete.length === 1 ? { documentId: complete[0].documentId as string } : undefined;
}

export interface MusicIdentityEligibility {
  provider: "google" | "email";
  authenticated: boolean;
  verified: boolean;
  userDocumentId?: string;
  account?: SelectedMusicAccount;
}

export interface MusicIdentityCoordinator {
  reconcile(input: MusicIdentityEligibility): Promise<void>;
  retry(): Promise<void>;
  reset(): void;
  getSnapshot(): MusicIdentityCoordinatorStatus;
  subscribe(listener: () => void): () => void;
}

export type MusicIdentityCoordinatorStatus =
  | "idle" | "setting_up" | "ready" | "retryable" | "unavailable" | "conflict"
  | "auth_required" | "suspended" | "pending_deletion";

export function createMusicIdentityCoordinator(dependencies: {
  ensureIdentity: () => Promise<unknown>;
}): MusicIdentityCoordinator {
  let activeKey: string | undefined;
  let completedKey: string | undefined;
  let flight: Promise<void> | undefined;
  let lastEligible: MusicIdentityEligibility | undefined;
  let status: MusicIdentityCoordinatorStatus = "idle";
  let retryableFailures = 0;
  let generation = 0;
  const listeners = new Set<() => void>();

  const publish = (next: MusicIdentityCoordinatorStatus) => {
    if (status === next) return;
    status = next;
    for (const listener of listeners) listener();
  };

  const eligibleKey = (input: MusicIdentityEligibility): string | undefined => {
    if (!input.authenticated || !input.verified || !input.userDocumentId || !input.account?.documentId) return undefined;
    return `${input.userDocumentId}:${input.account.documentId}`;
  };

  const start = (key: string, force = false): Promise<void> => {
    if (!force && completedKey === key) return Promise.resolve();
    if (flight && activeKey === key) return flight;
    if (activeKey !== key) retryableFailures = 0;
    activeKey = key;
    const startedGeneration = generation;
    publish("setting_up");
    const current = Promise.resolve(dependencies.ensureIdentity()).then(() => {
      if (generation !== startedGeneration) return;
      completedKey = key;
      retryableFailures = 0;
      publish("ready");
    }).catch((cause: unknown) => {
      if (generation !== startedGeneration) throw cause;
      const error = cause as { code?: unknown; upstreamCode?: unknown; retryable?: unknown };
      const upstreamCode = typeof error?.upstreamCode === "string" ? error.upstreamCode : "";
      if (upstreamCode === "IDENTITY_PENDING_DELETION" || upstreamCode === "IDENTITY_TOMBSTONED") publish("pending_deletion");
      else if (upstreamCode === "IDENTITY_SUSPENDED") publish("suspended");
      else if (error?.code === "AUTH_REQUIRED" || upstreamCode === "AUTH_REQUIRED" || upstreamCode === "AUTH_INVALID") publish("auth_required");
      else if (["IDENTITY_CONFLICT", "ACCOUNT_AMBIGUOUS", "ACCOUNT_SWITCH_CONFLICT"].includes(upstreamCode)) publish("conflict");
      else {
        retryableFailures += 1;
        publish(retryableFailures >= 3 ? "unavailable" : "retryable");
      }
      throw cause;
    }).finally(() => {
      if (generation === startedGeneration && flight === current) flight = undefined;
    });
    flight = current;
    return current;
  };

  return {
    reconcile(input) {
      const key = eligibleKey(input);
      if (!key) return Promise.resolve();
      lastEligible = input;
      return start(key);
    },
    retry() {
      const key = lastEligible && eligibleKey(lastEligible);
      return key ? start(key, true) : Promise.resolve();
    },
    reset() {
      generation += 1;
      activeKey = undefined;
      completedKey = undefined;
      flight = undefined;
      lastEligible = undefined;
      retryableFailures = 0;
      publish("idle");
    },
    getSnapshot: () => status,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
