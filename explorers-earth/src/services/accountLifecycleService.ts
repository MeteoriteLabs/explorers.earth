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
  const deleteAccount = async (dependencies: { upstreamDelete: () => Promise<void>; clearAuth: () => void }) => {
    await prepare();
    await markBoundary();
    await dependencies.upstreamDelete();
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
