import {
  clearMusicCredential,
  getMusicCredential,
  setMusicCredential,
  type MusicCredential,
} from "./musicCredentialStore";

export type LocalMusicMethod = "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface LocalMusicRequest {
  method: LocalMusicMethod;
  path: string;
  body?: unknown;
  idempotencyKey?: string;
}

export type MusicClientErrorCode = "AUTH_REQUIRED" | "AUTH_UNAVAILABLE" | "SERVICE_UNAVAILABLE" | "REQUEST_INVALID";

export class MusicClientError extends Error {
  constructor(
    readonly code: MusicClientErrorCode,
    readonly status: number,
    message: string,
    readonly retryAfterSeconds?: number,
    readonly upstreamCode?: string,
    readonly retryable = false,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "MusicClientError";
  }
}

export interface LocalTunesApiClientDependencies {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  getStrapiBearer: () => Promise<string | undefined>;
  now?: () => number;
  refreshWindowMs?: number;
  delay?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
}

export interface LocalTunesApiClient {
  setAuthority(subject: string | undefined): void;
  ensureIdentity(): Promise<void>;
  refreshIdentity(): Promise<void>;
  request(input: LocalMusicRequest): Promise<Response>;
  logout(): void;
}

const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const STRAPI_PROOF_PATTERN = /^[A-Za-z0-9._~-]{16,4096}$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const MUSIC_ERROR_ACTIONS = new Set(["authenticate", "complete_onboarding", "contact_support", "retry", "none"]);
const ENSURE_ERROR_CODES = new Map<number, ReadonlySet<string>>([
  [400, new Set(["REQUEST_INVALID"])],
  [401, new Set(["AUTH_REQUIRED", "AUTH_INVALID"])],
  [403, new Set(["IDENTITY_INELIGIBLE", "ONBOARDING_INCOMPLETE", "IDENTITY_SUSPENDED"])],
  [409, new Set(["ACCOUNT_AMBIGUOUS", "ACCOUNT_SWITCH_CONFLICT", "IDENTITY_CONFLICT", "IDENTITY_TOMBSTONED", "IDENTITY_PENDING_DELETION"])],
  [429, new Set(["RATE_LIMITED"])],
  [500, new Set(["INTERNAL_ERROR"])],
  [502, new Set(["UPSTREAM_MALFORMED"])],
  [503, new Set(["UPSTREAM_UNAVAILABLE", "DATABASE_UNAVAILABLE", "ENTRY_DISABLED"])],
]);
const AUTHORITY_ABORT = Object.freeze({ kind: "authority" });
const DEADLINE_ABORT = Object.freeze({ kind: "deadline" });
export const MUSIC_IDENTITY_RELIABILITY_CONTRACT = Object.freeze({
  refreshWindowMs: 60_000,
  maxAttempts: 3,
  defaultRetryAfterMs: 1_000,
  maxRetryAfterMs: 1_000,
  deadlineMs: 4_500,
});

export function createLocalTunesApiClient(dependencies: LocalTunesApiClientDependencies): LocalTunesApiClient {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const now = dependencies.now ?? Date.now;
  const refreshWindowMs = dependencies.refreshWindowMs ?? MUSIC_IDENTITY_RELIABILITY_CONTRACT.refreshWindowMs;
  const delay = dependencies.delay ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const baseUrl = normalizedBaseUrl(dependencies.baseUrl);
  let authoritySubject: string | undefined;
  let authorityGeneration = 0;
  let refreshFlight: { generation: number; subject: string | undefined; controller: AbortController; promise: Promise<MusicCredential> } | undefined;
  const requestControllers = new Map<AbortController, number>();

  const authorityStillCurrent = (generation: number, subject: string | undefined) =>
    generation === authorityGeneration && subject === authoritySubject;

  const staleAuthority = () => new MusicClientError("AUTH_REQUIRED", 401, "Music authorization is required.");

  function advanceAuthority(subject: string | undefined, force = false): void {
    if (!force && subject === authoritySubject) return;
    authoritySubject = subject;
    authorityGeneration += 1;
    refreshFlight?.controller.abort(AUTHORITY_ABORT);
    refreshFlight = undefined;
    for (const controller of requestControllers.keys()) controller.abort(AUTHORITY_ABORT);
    requestControllers.clear();
    clearMusicCredential();
  }

  async function refresh(): Promise<MusicCredential> {
    const generation = authorityGeneration;
    const subject = authoritySubject;
    if (refreshFlight && refreshFlight.generation === generation && refreshFlight.subject === subject) return refreshFlight.promise;
    const controller = new AbortController();
    let lastError: MusicClientError | undefined;
    const deadline = setTimeout(() => controller.abort(DEADLINE_ABORT), MUSIC_IDENTITY_RELIABILITY_CONTRACT.deadlineMs);
    const flight = (async () => {
      try {
        const proof = await abortable(Promise.resolve(dependencies.getStrapiBearer()), controller.signal);
        if (!proof || !STRAPI_PROOF_PATTERN.test(proof)) throw new Error("proof unavailable");
        for (let attempt = 1; ; attempt += 1) {
          const response = await abortable(Promise.resolve(fetchImpl(`${baseUrl}/api/music/identity/ensure`, {
            method: "POST",
            headers: { Authorization: `Bearer ${proof}` },
            signal: controller.signal,
          })), controller.signal);
          if (response.status !== 200) {
            const error = await containedEnsureError(response, controller.signal);
            lastError = error;
            if (!error.retryable || attempt === MUSIC_IDENTITY_RELIABILITY_CONTRACT.maxAttempts) throw error;
            await abortable(delay(Math.min(
              (error.retryAfterSeconds ?? MUSIC_IDENTITY_RELIABILITY_CONTRACT.defaultRetryAfterMs / 1_000) * 1_000,
              MUSIC_IDENTITY_RELIABILITY_CONTRACT.maxRetryAfterMs,
            ), controller.signal), controller.signal);
            continue;
          }
          const body = await abortable(Promise.resolve(response.json()), controller.signal) as {
            credential?: { token?: unknown; expiresAt?: unknown };
          };
          const credential = body.credential;
          if (!credential || typeof credential.token !== "string"
              || typeof credential.expiresAt !== "number"
              || !Number.isSafeInteger(credential.expiresAt)
              || credential.expiresAt <= now()) throw new Error("credential malformed");
          const result = { token: credential.token, expiresAt: credential.expiresAt };
          setMusicCredential(result);
          return result;
        }
      } catch (cause) {
        if (authorityStillCurrent(generation, subject)) clearMusicCredential();
        if (!authorityStillCurrent(generation, subject) || controller.signal.reason === AUTHORITY_ABORT) throw staleAuthority();
        if (controller.signal.reason === DEADLINE_ABORT) {
          throw new MusicClientError(
            "AUTH_UNAVAILABLE",
            503,
            "Music authorization is temporarily unavailable.",
            lastError?.retryAfterSeconds,
            lastError?.upstreamCode,
            false,
            lastError?.requestId,
          );
        }
        if (cause instanceof MusicClientError) throw cause;
        throw new MusicClientError("AUTH_UNAVAILABLE", 503, "Music authorization is temporarily unavailable.", 1);
      } finally {
        clearTimeout(deadline);
      }
    })();
    refreshFlight = { generation, subject, controller, promise: flight };
    try {
      return await flight;
    } finally {
      if (refreshFlight?.promise === flight) refreshFlight = undefined;
    }
  }

  async function credential(): Promise<MusicCredential> {
    const timestamp = now();
    const current = getMusicCredential(timestamp);
    if (current && current.expiresAt - timestamp > refreshWindowMs) return current;
    if (current) clearMusicCredential();
    return refresh();
  }

  async function send(input: LocalMusicRequest, active: MusicCredential): Promise<Response> {
    const headers: Record<string, string> = { Authorization: `Bearer ${active.token}` };
    if (input.idempotencyKey) headers["Idempotency-Key"] = input.idempotencyKey;
    let body: string | undefined;
    if (input.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(input.body);
    }
    const generation = authorityGeneration;
    const subject = authoritySubject;
    const controller = new AbortController();
    requestControllers.set(controller, generation);
    try {
      const response = await fetchImpl(`${baseUrl}${input.path}`, { method: input.method, headers, body, signal: controller.signal });
      if (!authorityStillCurrent(generation, subject)) throw staleAuthority();
      return response;
    } catch {
      if (!authorityStillCurrent(generation, subject) || controller.signal.aborted) throw staleAuthority();
      throw new MusicClientError("SERVICE_UNAVAILABLE", 503, "Music is temporarily unavailable.", 1);
    } finally {
      requestControllers.delete(controller);
    }
  }

  async function request(input: LocalMusicRequest): Promise<Response> {
    validateRequest(input);
    const initial = await credential();
    const first = await send(input, initial);
    const firstUpstreamCode = first.status === 401 ? await responseErrorCode(first) : undefined;
    if (first.status !== 401 || !["TOKEN_EXPIRED", "TOKEN_INVALID", "TOKEN_REVOKED"].includes(firstUpstreamCode ?? "")) return first;
    clearMusicCredential();
    const safeReplay = input.method === "GET" || input.method === "HEAD"
      || (input.idempotencyKey !== undefined && IDEMPOTENCY_PATTERN.test(input.idempotencyKey));
    if (!safeReplay) {
      throw new MusicClientError("AUTH_REQUIRED", 401, "Music authorization expired; retry the action explicitly.", undefined, firstUpstreamCode);
    }
    const renewed = await refresh();
    const second = await send(input, renewed);
    if (second.status === 401) {
      const upstreamCode = await responseErrorCode(second);
      clearMusicCredential();
      throw new MusicClientError("AUTH_REQUIRED", 401, "Music authorization is required.", undefined, upstreamCode);
    }
    return second;
  }

  return {
    setAuthority: (subject) => advanceAuthority(subject),
    ensureIdentity: async () => { await credential(); },
    refreshIdentity: async () => {
      clearMusicCredential();
      await refresh();
    },
    request,
    logout: () => advanceAuthority(undefined, true),
  };
}

async function containedEnsureError(response: Response, signal: AbortSignal): Promise<MusicClientError> {
  const requestIdHeader = response.headers.get("x-request-id");
  const requestId = requestIdHeader && REQUEST_ID_PATTERN.test(requestIdHeader) ? requestIdHeader : undefined;
  const fallback = () => new MusicClientError(
    response.status === 401 ? "AUTH_REQUIRED" : response.status === 400 ? "REQUEST_INVALID" : "AUTH_UNAVAILABLE",
    response.status,
    response.status === 401 ? "Music authorization is required." : "Music authorization is temporarily unavailable.",
    undefined,
    undefined,
    false,
    requestId,
  );
  try {
    const body = await abortable(Promise.resolve(response.json()), signal) as unknown;
    if (!validEnsureErrorEnvelope(body, response.status, requestId)) return fallback();
    const retryAfterHeader = response.headers.get("retry-after");
    if ((response.status === 429 || response.status === 503) && !retryAfterHeader) return fallback();
    if (retryAfterHeader && !/^[1-9][0-9]*$/.test(retryAfterHeader)) return fallback();
    const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : undefined;
    return new MusicClientError(
      response.status === 401 ? "AUTH_REQUIRED" : "AUTH_UNAVAILABLE",
      response.status,
      response.status === 401 ? "Music authorization is required." : "Music authorization is temporarily unavailable.",
      retryAfterSeconds,
      body.error.code,
      body.error.retryable,
      requestId,
    );
  } catch (cause) {
    if (signal.aborted) throw cause;
    return fallback();
  }
}

interface ContainedEnsureErrorEnvelope {
  version: "music-error/v1";
  error: { code: string; message: string; action: string; retryable: boolean; requestId: string };
}

function validEnsureErrorEnvelope(
  value: unknown,
  status: number,
  requestId: string | undefined,
): value is ContainedEnsureErrorEnvelope {
  if (!value || typeof value !== "object" || !hasExactKeys(value, ["version", "error"])) return false;
  const envelope = value as { version?: unknown; error?: unknown };
  if (envelope.version !== "music-error/v1" || !envelope.error || typeof envelope.error !== "object"
      || !hasExactKeys(envelope.error, ["code", "message", "action", "retryable", "requestId"])) return false;
  const error = envelope.error as Record<string, unknown>;
  if (typeof error.code !== "string" || !ENSURE_ERROR_CODES.get(status)?.has(error.code)
      || typeof error.message !== "string" || error.message.length < 1 || error.message.length > 160
      || typeof error.action !== "string" || !MUSIC_ERROR_ACTIONS.has(error.action)
      || typeof error.retryable !== "boolean" || (error.retryable !== (error.action === "retry"))
      || typeof error.requestId !== "string" || error.requestId !== requestId) return false;
  return status !== 401 && status !== 403 || error.retryable === false;
}

function hasExactKeys(value: object, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every((key) => keys.includes(key));
}

function abortable<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    operation.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

function validateRequest(input: LocalMusicRequest): void {
  if (!input.path.startsWith("/") || input.path.startsWith("//")
      || !["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"].includes(input.method)
      || (input.idempotencyKey !== undefined && !IDEMPOTENCY_PATTERN.test(input.idempotencyKey))) {
    throw new MusicClientError("REQUEST_INVALID", 400, "The Music request is invalid.");
  }
}

async function responseErrorCode(response: Response): Promise<string | undefined> {
  try {
    const body = await response.clone().json() as { error?: { code?: unknown } };
    return typeof body.error?.code === "string" ? body.error.code : undefined;
  } catch {
    return undefined;
  }
}

function normalizedBaseUrl(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new MusicClientError("REQUEST_INVALID", 400, "The Music service origin is invalid.");
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password
      || parsed.search || parsed.hash || parsed.pathname !== "/") {
    throw new MusicClientError("REQUEST_INVALID", 400, "The Music service origin is invalid.");
  }
  return parsed.origin;
}
