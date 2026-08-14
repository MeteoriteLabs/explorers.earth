import { beforeEach, describe, expect, it, vi } from "vitest";
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

beforeEach(() => clearMusicCredential());

describe("local Tunes API client", () => {
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
