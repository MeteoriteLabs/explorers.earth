import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { clearMusicCredential, getMusicCredential, setMusicCredential } from "../musicCredentialStore";
import { createLocalTunesApiClient, MusicClientError } from "../localTunesApiClient";

const NOW = 1_800_000_000_000;
const freshCredential = { token: "fresh.music.credential", expiresAt: NOW + 600_000 };
const rotatedCredential = { token: "rotated.music.credential", expiresAt: NOW + 600_000 };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function ensureResponse(credential = freshCredential): Response {
  return json({
    version: "music-identity/v1",
    identity: { musicUserId: 41, status: "active" },
    credential,
  });
}

function expiredResponse(): Response {
  return json({
    version: "music-error/v1",
    error: {
      code: "TOKEN_EXPIRED", message: "Expired.", action: "authenticate", retryable: false, requestId: "request-expired",
    },
  }, 401);
}

function tokenResponse(code: "TOKEN_EXPIRED" | "TOKEN_INVALID" | "TOKEN_REVOKED"): Response {
  return json({
    version: "music-error/v1",
    error: { code, message: "Contained.", action: "authenticate", retryable: false, requestId: `request-${code}` },
  }, 401);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

beforeEach(() => clearMusicCredential());

describe("local Tunes API client", () => {
  it("has no caller-flippable fixture HTTP capability in the production client source", () => {
    const source = readFileSync(resolve(import.meta.dirname, "../localTunesApiClient.ts"), "utf8");
    expect(source).not.toMatch(/fixtureMode|fixtureHttpAllowed|http:\/\/127\.0\.0\.1|http:\/\/localhost/);
  });

  it.each([
    "http://music.example",
    "http://10.2.3.4:5000",
    "http://192.168.10.12:5000",
    "http://172.20.0.5:5000",
    "http://127.0.0.1:55000",
  ])("rejects cleartext Music origin %s before fetch without leaking a stored token", (baseUrl) => {
    const fetchImpl = vi.fn();
    setMusicCredential(freshCredential);
    let error: unknown;
    try {
      createLocalTunesApiClient({ baseUrl, fetchImpl, getStrapiBearer: async () => "unused-proof" });
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({ code: "REQUEST_INVALID" });
    expect(JSON.stringify(error)).not.toContain(freshCredential.token);
    expect(String((error as Error).message)).not.toContain(baseUrl);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each(["http://127.0.0.1:55000", "http://localhost:55000"])(
    "rejects loopback cleartext even when a caller tries the former fixture switch at %s",
    (baseUrl) => {
      setMusicCredential(freshCredential);
      const fetchImpl = vi.fn();
      expect(() => createLocalTunesApiClient({
        baseUrl, fixtureMode: true, fetchImpl, getStrapiBearer: async () => "unused-proof", now: () => NOW,
      } as never)).toThrow(expect.objectContaining({ code: "REQUEST_INVALID" }));
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it("coalesces 50 initial refreshes and keeps proof B on ensure and credential C on local calls", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith("/api/music/identity/ensure")) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return ensureResponse();
      }
      return json({ ok: true });
    });
    const getStrapiBearer = vi.fn(async () => "authoritative-strapi-proof");
    const client = createLocalTunesApiClient({
      baseUrl: "https://music.example",
      fetchImpl,
      getStrapiBearer,
      now: () => NOW,
    });
    const responses = await Promise.all(Array.from({ length: 50 }, () => client.request({ method: "GET", path: "/api/music/identity/current" })));
    expect(responses.every(({ status }) => status === 200)).toBe(true);
    expect(calls.filter(({ url }) => url.endsWith("/ensure"))).toHaveLength(1);
    expect(calls.filter(({ url }) => url.endsWith("/current"))).toHaveLength(50);
    expect(calls.find(({ url }) => url.endsWith("/ensure"))?.init).toMatchObject({
      method: "POST", headers: { Authorization: "Bearer authoritative-strapi-proof" },
    });
    expect(calls.filter(({ url }) => url.endsWith("/current"))[0].init).toMatchObject({
      headers: { Authorization: `Bearer ${freshCredential.token}` },
    });
    expect(getStrapiBearer).toHaveBeenCalledTimes(1);
  });

  it("exposes one bodyless single-flight automatic ensure without a downstream owner request", async () => {
    const fetchImpl = vi.fn(async () => ensureResponse());
    const client = createLocalTunesApiClient({
      baseUrl: "https://music.example",
      fetchImpl,
      getStrapiBearer: async () => "authoritative-strapi-proof",
      now: () => NOW,
    });
    await Promise.all(Array.from({ length: 25 }, () => client.ensureIdentity()));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith("https://music.example/api/music/identity/ensure", expect.objectContaining({
      method: "POST",
      headers: { Authorization: "Bearer authoritative-strapi-proof" },
      signal: expect.any(AbortSignal),
    }));
  });

  it("forces one bodyless single-flight snapshot refresh even while credential C is still fresh", async () => {
    setMusicCredential(freshCredential);
    const fetchImpl = vi.fn(async () => ensureResponse(rotatedCredential));
    const client = createLocalTunesApiClient({
      baseUrl: "https://music.example",
      fetchImpl,
      getStrapiBearer: async () => "authoritative-strapi-proof",
      now: () => NOW,
    });
    await Promise.all(Array.from({ length: 12 }, () => client.refreshIdentity()));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith("https://music.example/api/music/identity/ensure", expect.objectContaining({
      method: "POST",
      headers: { Authorization: "Bearer authoritative-strapi-proof" },
      signal: expect.any(AbortSignal),
    }));
    expect(getMusicCredential(NOW)).toEqual(rotatedCredential);
  });

  it("contains typed identity errors for the state selector without leaking upstream messages", async () => {
    const fetchImpl = vi.fn(async () => json({
      version: "music-error/v1",
      error: {
        code: "IDENTITY_CONFLICT",
        message: "sensitive upstream detail",
        action: "contact_support",
        retryable: false,
        requestId: "request-conflict",
      },
    }, 409));
    const client = createLocalTunesApiClient({
      baseUrl: "https://music.example",
      fetchImpl,
      getStrapiBearer: async () => "authoritative-strapi-proof",
      now: () => NOW,
    });
    const error = await client.ensureIdentity().catch((cause) => cause);
    expect(error).toMatchObject({ code: "AUTH_UNAVAILABLE", upstreamCode: "IDENTITY_CONFLICT", retryable: false });
    expect(error.message).not.toContain("sensitive upstream detail");
  });

  it.each([
    ["GET", undefined, 2, 1, true],
    ["HEAD", undefined, 2, 1, true],
    ["POST", "operation-idempotency-1", 2, 1, true],
    ["POST", undefined, 1, 0, false],
  ] as const)("bounds expired replay for %s with key %s", async (method, idempotencyKey, localCalls, ensureCalls, succeeds) => {
    setMusicCredential(freshCredential);
    let localAttempt = 0;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/ensure")) return ensureResponse(rotatedCredential);
      localAttempt += 1;
      return localAttempt === 1 ? expiredResponse() : json({ ok: true });
    });
    const client = createLocalTunesApiClient({
      baseUrl: "https://music.example", fetchImpl, getStrapiBearer: async () => "strapi-proof-with-enough-entropy", now: () => NOW,
    });
    const operation = client.request({ method, path: "/api/music/owner-action", idempotencyKey });
    if (succeeds) await expect(operation).resolves.toMatchObject({ status: 200 });
    else await expect(operation).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
    expect(fetchImpl.mock.calls.filter(([input]) => !String(input).endsWith("/ensure"))).toHaveLength(localCalls);
    expect(fetchImpl.mock.calls.filter(([input]) => String(input).endsWith("/ensure"))).toHaveLength(ensureCalls);
  });

  it("never loops after a second exact TOKEN_EXPIRED response", async () => {
    setMusicCredential(freshCredential);
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => String(input).endsWith("/ensure")
      ? ensureResponse(rotatedCredential) : expiredResponse());
    const client = createLocalTunesApiClient({
      baseUrl: "https://music.example", fetchImpl, getStrapiBearer: async () => "strapi-proof-with-enough-entropy", now: () => NOW,
    });
    await expect(client.request({ method: "GET", path: "/api/music/identity/current" }))
      .rejects.toMatchObject({ code: "AUTH_REQUIRED" });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it.each(["TOKEN_EXPIRED", "TOKEN_INVALID", "TOKEN_REVOKED"] as const)(
    "refreshes once for refreshable %s and preserves the terminal upstream status and code",
    async (code) => {
      setMusicCredential(freshCredential);
      let localAttempt = 0;
      const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).endsWith("/ensure")) return ensureResponse(rotatedCredential);
        localAttempt += 1;
        return tokenResponse(code);
      });
      const client = createLocalTunesApiClient({
        baseUrl: "https://music.example", fetchImpl, getStrapiBearer: async () => "strapi-proof-with-enough-entropy", now: () => NOW,
      });

      await expect(client.request({ method: "GET", path: "/api/music/dashboard" })).rejects.toMatchObject({
        code: "AUTH_REQUIRED",
        status: 401,
        upstreamCode: code,
      });
      expect(fetchImpl).toHaveBeenCalledTimes(3);
      expect(getMusicCredential(NOW)).toBeUndefined();
    },
  );

  it("aborts and detaches authority A so authority B cannot join or receive A's late success", async () => {
    const a = deferred<Response>();
    const b = deferred<Response>();
    const signals: AbortSignal[] = [];
    const fetchImpl = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (!String(input).endsWith("/ensure")) return Promise.resolve(json({ ok: true }));
      signals.push(init?.signal as AbortSignal);
      return signals.length === 1 ? a.promise : b.promise;
    });
    const client = createLocalTunesApiClient({
      baseUrl: "https://music.example", fetchImpl, getStrapiBearer: async () => "strapi-proof-with-enough-entropy", now: () => NOW,
    });

    client.setAuthority("user-a:account-a");
    const aFlight = client.ensureIdentity();
    const aResult = aFlight.catch((error) => error);
    await Promise.resolve();
    await Promise.resolve();
    client.setAuthority("user-b:account-b");
    const bFlight = client.ensureIdentity();
    await Promise.resolve();
    await Promise.resolve();

    expect(signals[0]?.aborted).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    a.resolve(ensureResponse(freshCredential));
    await expect(aResult).resolves.toMatchObject({ code: "AUTH_REQUIRED" });
    expect(getMusicCredential(NOW)).toBeUndefined();
    b.resolve(ensureResponse(rotatedCredential));
    await expect(bFlight).resolves.toBeUndefined();
    expect(getMusicCredential(NOW)).toEqual(rotatedCredential);
  });

  it("prevents authority A's late failure from clearing authority B's committed credential", async () => {
    const a = deferred<Response>();
    const b = deferred<Response>();
    let ensureCall = 0;
    const client = createLocalTunesApiClient({
      baseUrl: "https://music.example",
      fetchImpl: (input) => String(input).endsWith("/ensure") ? (++ensureCall === 1 ? a.promise : b.promise) : Promise.resolve(json({ ok: true })),
      getStrapiBearer: async () => "strapi-proof-with-enough-entropy",
      now: () => NOW,
    });
    client.setAuthority("user-a:account-a");
    const aFlight = client.ensureIdentity();
    const aResult = aFlight.catch((error) => error);
    await Promise.resolve();
    await Promise.resolve();
    client.setAuthority("user-b:account-b");
    const bFlight = client.ensureIdentity();
    await Promise.resolve();
    await Promise.resolve();
    b.resolve(ensureResponse(rotatedCredential));
    await bFlight;
    a.reject(new Error("late authority A failure"));
    await expect(aResult).resolves.toMatchObject({ code: "AUTH_REQUIRED" });
    expect(getMusicCredential(NOW)).toEqual(rotatedCredential);
  });

  it("continues local reads through a Strapi outage until expiry, then performs zero mutation", async () => {
    setMusicCredential(freshCredential);
    const localFetch = vi.fn(async () => json({ ok: true }));
    const noGateway = vi.fn(async () => { throw new Error("upstream unavailable sentinel"); });
    const available = createLocalTunesApiClient({
      baseUrl: "https://music.example", fetchImpl: localFetch, getStrapiBearer: noGateway, now: () => NOW,
    });
    await expect(available.request({ method: "GET", path: "/api/music/identity/current" })).resolves.toMatchObject({ status: 200 });
    expect(noGateway).not.toHaveBeenCalled();

    setMusicCredential({ token: "expired.music.credential", expiresAt: NOW });
    let mutations = 0;
    const unavailable = createLocalTunesApiClient({
      baseUrl: "https://music.example",
      fetchImpl: async () => { mutations += 1; return json({ ok: true }); },
      getStrapiBearer: noGateway,
      now: () => NOW,
    });
    const failure = unavailable.request({ method: "POST", path: "/api/music/owner-action", body: { action: "change" } });
    await expect(failure).rejects.toMatchObject({ code: "AUTH_UNAVAILABLE" });
    expect(mutations).toBe(0);
    await expect(failure.catch((error) => error)).resolves.not.toEqual(expect.objectContaining({ cause: expect.anything() }));
    expect(getMusicCredential(NOW)).toBeUndefined();
  });

  it("clears on logout and never exposes a credential in URL or sanitized errors", async () => {
    setMusicCredential(freshCredential);
    const urls: string[] = [];
    const client = createLocalTunesApiClient({
      baseUrl: "https://music.example",
      fetchImpl: async (input) => { urls.push(String(input)); throw new Error("network contained"); },
      getStrapiBearer: async () => "strapi-proof-with-enough-entropy",
      now: () => NOW,
    });
    const error = await client.request({ method: "GET", path: "/api/music/identity/current" }).catch((caught) => caught);
    expect(error).toBeInstanceOf(MusicClientError);
    expect(JSON.stringify(error)).not.toContain(freshCredential.token);
    expect(urls.join(" ")).not.toContain(freshCredential.token);
    client.logout();
    expect(getMusicCredential(NOW)).toBeUndefined();
  });
});
