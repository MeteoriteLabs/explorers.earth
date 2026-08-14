export interface AccountLifecycleStatus {
  version: "music-lifecycle/v1";
  operation: {
    operationId: string;
    status: "pending_deletion" | "suspended" | "tombstoned";
    phase: "prepared" | "finalized";
    state: "completed" | "requested" | "running" | "failed" | "cancelled";
    boundaryCrossed: boolean;
    retryable: boolean;
    deadLetter: boolean;
    upstreamUserDocumentId: string;
    upstreamAccountDocumentId: string;
  };
}

export class AccountLifecycleError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
    readonly retryable: boolean,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "AccountLifecycleError";
  }
}

export function createAccountLifecycleService(input: {
  baseUrl: string;
  getBearer: () => string | undefined;
  fetchImpl?: typeof fetch;
}) {
  const origin = normalizeOrigin(input.baseUrl);
  const fetchImpl = input.fetchImpl ?? fetch;

  const request = async (method: "GET" | "POST", action: "prepare" | "status" | "boundary" | "cancel") => {
    const bearer = input.getBearer();
    if (!bearer || !/^[A-Za-z0-9._~-]{16,4096}$/.test(bearer)) {
      throw new AccountLifecycleError("AUTH_REQUIRED", 401, "Sign in again to continue account deletion.", false);
    }
    let response: Response;
    try {
      response = await fetchImpl(`${origin}/api/music/identity/lifecycle/${action}`, {
        method,
        headers: { Authorization: `Bearer ${bearer}` },
      });
    } catch {
      throw new AccountLifecycleError("SERVICE_UNAVAILABLE", 503, "Account deletion is temporarily unavailable.", true);
    }
    const body = await response.json().catch(() => undefined) as any;
    if (!response.ok) {
      throw new AccountLifecycleError(
        typeof body?.error?.code === "string" ? body.error.code : "SERVICE_UNAVAILABLE",
        response.status,
        typeof body?.error?.message === "string" ? body.error.message : "Account deletion is temporarily unavailable.",
        body?.error?.retryable === true,
        typeof body?.error?.requestId === "string" ? body.error.requestId : response.headers.get("x-request-id") ?? undefined,
      );
    }
    return body as AccountLifecycleStatus;
  };

  const prepare = () => request("POST", "prepare");
  const status = () => request("GET", "status");
  const markBoundary = () => request("POST", "boundary");
  const cancel = () => request("POST", "cancel");
  const requireDeletableOperation = (result: AccountLifecycleStatus) => {
    if (result.operation.status !== "pending_deletion"
        || result.operation.phase !== "prepared"
        || result.operation.deadLetter
        || typeof result.operation.upstreamUserDocumentId !== "string"
        || typeof result.operation.upstreamAccountDocumentId !== "string") {
      throw new AccountLifecycleError(
        "LIFECYCLE_TERMINAL", 409,
        "Account deletion is complete or requires manual review.", false,
      );
    }
  };
  const deleteAccount = async (dependencies: {
    readAccountPresence: (expectedAccountDocumentId: string) => Promise<
      { status: "present"; accountDocumentId: string }
      | { status: "absent" | "unknown" }
    >;
    deleteExplorerAccount: (accountDocumentId: string) => Promise<string | null>;
    deleteExplorerUser: () => Promise<string | null>;
    clearAuth: () => void;
  }) => {
    const prepared = await prepare();
    requireDeletableOperation(prepared);
    const boundary = await markBoundary();
    requireDeletableOperation(boundary);
    if (prepared.operation.operationId !== boundary.operation.operationId
        || prepared.operation.upstreamUserDocumentId !== boundary.operation.upstreamUserDocumentId
        || prepared.operation.upstreamAccountDocumentId !== boundary.operation.upstreamAccountDocumentId) {
      throw new AccountLifecycleError(
        "LIFECYCLE_IDENTITY_CONFLICT", 409,
        "Account deletion identity changed unexpectedly. Contact support.", false,
      );
    }
    const presence = await dependencies.readAccountPresence(boundary.operation.upstreamAccountDocumentId);
    if (presence.status === "unknown") {
      throw new AccountLifecycleError(
        "UPSTREAM_ACCOUNT_UNKNOWN",
        503,
        "The Explorer Account state could not be verified. Try again without signing out.",
        true,
      );
    }
    if (presence.status === "present") {
      const deletedDocumentId = await dependencies.deleteExplorerAccount(presence.accountDocumentId);
      if (deletedDocumentId !== presence.accountDocumentId) {
        throw new AccountLifecycleError(
          "UPSTREAM_ACCOUNT_DELETE_UNCONFIRMED",
          503,
          "Explorer Account deletion was not confirmed. Try again without signing out.",
          true,
        );
      }
    }
    const deletedUserDocumentId = await dependencies.deleteExplorerUser();
    if (deletedUserDocumentId !== boundary.operation.upstreamUserDocumentId) {
      throw new AccountLifecycleError(
        "UPSTREAM_USER_DELETE_UNCONFIRMED",
        503,
        "Explorer user deletion was not confirmed. Try again without signing out.",
        true,
      );
    }
    dependencies.clearAuth();
  };
  return { prepare, status, markBoundary, cancel, deleteAccount };
}

function normalizeOrigin(raw: string): string {
  let parsed: URL;
  try { parsed = new URL(raw); }
  catch { throw new AccountLifecycleError("REQUEST_INVALID", 400, "The Music service origin is invalid.", false); }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new AccountLifecycleError("REQUEST_INVALID", 400, "The Music service origin is invalid.", false);
  }
  return parsed.origin;
}
