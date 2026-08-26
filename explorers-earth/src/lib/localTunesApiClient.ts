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
  signal?: AbortSignal;
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

export function createLocalTunesApiClient(dependencies: LocalTunesApiClientDependencies): LocalTunesApiClient {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const now = dependencies.now ?? Date.now;
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
    refreshFlight?.controller.abort();
    refreshFlight = undefined;
    for (const controller of requestControllers.keys()) controller.abort();
    requestControllers.clear();
    clearMusicCredential();
  }

  async function refresh(): Promise<MusicCredential> {
    const generation = authorityGeneration;
    const subject = authoritySubject;
    if (refreshFlight && refreshFlight.generation === generation && refreshFlight.subject === subject) return refreshFlight.promise;
    const controller = new AbortController();
    const flight = (async () => {
      try {
        const proof = await dependencies.getStrapiBearer();
        if (!authorityStillCurrent(generation, subject)) throw staleAuthority();
        if (!proof || !STRAPI_PROOF_PATTERN.test(proof)) throw new Error("proof unavailable");
        const response = await fetchImpl(`${baseUrl}/api/music/identity/ensure`, {
          method: "POST",
          headers: { Authorization: `Bearer ${proof}` },
          signal: controller.signal,
        });
        if (!authorityStillCurrent(generation, subject)) throw staleAuthority();
        if (response.status !== 200) throw await containedEnsureError(response);
        const body = await response.json() as {
          credential?: { token?: unknown; expiresAt?: unknown };
        };
        const credential = body.credential;
        if (!credential || typeof credential.token !== "string"
            || typeof credential.expiresAt !== "number"
            || !Number.isSafeInteger(credential.expiresAt)
            || credential.expiresAt <= now()) throw new Error("credential malformed");
        const result = { token: credential.token, expiresAt: credential.expiresAt };
        if (!authorityStillCurrent(generation, subject)) throw staleAuthority();
        setMusicCredential(result);
        return result;
      } catch (cause) {
        if (authorityStillCurrent(generation, subject)) clearMusicCredential();
        if (!authorityStillCurrent(generation, subject) || controller.signal.aborted) throw staleAuthority();
        if (cause instanceof MusicClientError) throw cause;
        throw new MusicClientError("AUTH_UNAVAILABLE", 503, "Music authorization is temporarily unavailable.", 1);
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
    return getMusicCredential(now()) ?? refresh();
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
    const abortFromCaller = () => controller.abort(input.signal?.reason);
    if (input.signal?.aborted) { abortFromCaller(); throw staleAuthority(); }
    else input.signal?.addEventListener("abort", abortFromCaller, { once: true });
    requestControllers.set(controller, generation);
    try {
      const response = await fetchImpl(`${baseUrl}${input.path}`, { method: input.method, headers, body, signal: controller.signal });
      if (!authorityStillCurrent(generation, subject) || controller.signal.aborted) throw staleAuthority();
      return response;
    } catch {
      if (!authorityStillCurrent(generation, subject) || controller.signal.aborted) throw staleAuthority();
      throw new MusicClientError("SERVICE_UNAVAILABLE", 503, "Music is temporarily unavailable.", 1);
    } finally {
      input.signal?.removeEventListener("abort", abortFromCaller);
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

async function containedEnsureError(response: Response): Promise<MusicClientError> {
  try {
    const body = await response.json() as { error?: { code?: unknown; retryable?: unknown } };
    const upstreamCode = typeof body.error?.code === "string" ? body.error.code : undefined;
    const retryAfter = Number(response.headers.get("retry-after"));
    return new MusicClientError(
      response.status === 401 ? "AUTH_REQUIRED" : "AUTH_UNAVAILABLE",
      response.status,
      response.status === 401 ? "Music authorization is required." : "Music authorization is temporarily unavailable.",
      Number.isSafeInteger(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
      upstreamCode,
      body.error?.retryable === true,
    );
  } catch (cause) {
    if (cause instanceof MusicClientError) return cause;
    return new MusicClientError("AUTH_UNAVAILABLE", response.status, "Music authorization is temporarily unavailable.");
  }
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
