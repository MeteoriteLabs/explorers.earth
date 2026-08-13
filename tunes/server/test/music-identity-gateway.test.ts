import { describe, expect, it, vi } from "vitest";
import {
  MusicIdentityError,
  musicEnsureResponseSchema,
  musicEnsureRequestSchema,
  musicErrorEnvelopeSchema,
  musicIdentityOpenApi,
} from "../../shared/musicError";
import {
  StrapiIdentityGateway,
  type ResolvedStrapiIdentity,
} from "../services/strapiIdentityGateway";
import { BoundedIdentityRateLimiter } from "../middleware/identityRateLimit";

const user = {
  documentId: "user-doc-1",
  username: "astronaut",
  email: "sentinel-email@example.invalid",
  provider: "local",
  confirmed: true,
  blocked: false,
};

const completeAccount = {
  documentId: "account-doc-1",
  Account_Name: "Moon Room",
  Account_Type: "Venue",
  mobile_number: "+15555550100",
};

function response(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function gateway(fetchImpl: typeof fetch, overrides: Partial<ConstructorParameters<typeof StrapiIdentityGateway>[0]> = {}) {
  return new StrapiIdentityGateway({
    baseUrl: "https://strapi.invalid",
    fetchImpl,
    maxConcurrency: 2,
    retries: 1,
    connectTimeoutMs: 100,
    readTimeoutMs: 100,
    overallTimeoutMs: 300,
    cacheTtlMs: 1_000,
    circuitFailureThreshold: 2,
    circuitOpenMs: 100,
    ...overrides,
  });
}

describe("Strapi identity gateway", () => {
  it.each([
    [{ ...user, confirmed: false }, "IDENTITY_INELIGIBLE"],
    [{ ...user, provider: "password" }, "IDENTITY_INELIGIBLE"],
    [{ ...user, provider: "google", confirmed: false }, undefined],
    [{ ...user, blocked: true }, "IDENTITY_INELIGIBLE"],
  ])("enforces authoritative provider eligibility", async (candidate, expectedCode) => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response(candidate))
      .mockResolvedValueOnce(response({ data: [completeAccount] }));
    const operation = gateway(fetchImpl).resolve("proof-with-enough-entropy", "request-1");
    if (expectedCode) await expect(operation).rejects.toMatchObject({ code: expectedCode });
    else await expect(operation).resolves.toMatchObject({ provider: "google" });
  });

  it("selects the sole completed account independent of array order", async () => {
    const incomplete = { ...completeAccount, documentId: "incomplete", mobile_number: null };
    for (const accounts of [[incomplete, completeAccount], [completeAccount, incomplete]]) {
      const fetchImpl = vi.fn<typeof fetch>()
        .mockResolvedValueOnce(response(user))
        .mockResolvedValueOnce(response({ data: accounts }));
      await expect(gateway(fetchImpl).resolve("proof-with-enough-entropy", "request-2"))
        .resolves.toMatchObject({ accountDocumentId: "account-doc-1" });
    }
  });

  it.each([
    [[], "ONBOARDING_INCOMPLETE"],
    [[completeAccount, { ...completeAccount, documentId: "account-doc-2" }], "ACCOUNT_AMBIGUOUS"],
    [[{ nonsense: true }], "UPSTREAM_MALFORMED"],
  ])("fails closed for zero, ambiguous, or malformed Accounts", async (accounts, code) => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response(user))
      .mockResolvedValueOnce(response({ data: accounts }));
    await expect(gateway(fetchImpl).resolve("proof-with-enough-entropy", "request-3"))
      .rejects.toMatchObject({ code });
  });

  it("propagates request ID, never sends proof in URL, retries 503 once, and honors Retry-After", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response({}, 503, { "retry-after": "0" }))
      .mockResolvedValueOnce(response(user))
      .mockResolvedValueOnce(response({ data: [completeAccount] }));
    await gateway(fetchImpl).resolve("sentinel-bearer-proof", "safe-request-id");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    for (const [url, init] of fetchImpl.mock.calls) {
      expect(String(url)).not.toContain("sentinel-bearer-proof");
      expect(new Headers(init?.headers).get("x-request-id")).toBe("safe-request-id");
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer sentinel-bearer-proof");
    }
  });

  it("does not retry/cache invalid proofs and caches only complete successful resolutions", async () => {
    const invalid = vi.fn<typeof fetch>().mockResolvedValue(response({}, 401));
    const badGateway = gateway(invalid);
    await expect(badGateway.resolve("invalid-proof-with-entropy", "request-4")).rejects.toMatchObject({ code: "AUTH_INVALID" });
    await expect(badGateway.resolve("invalid-proof-with-entropy", "request-5")).rejects.toMatchObject({ code: "AUTH_INVALID" });
    expect(invalid).toHaveBeenCalledTimes(2);

    const valid = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response(user))
      .mockResolvedValueOnce(response({ data: [completeAccount] }));
    const cachedGateway = gateway(valid);
    const first = await cachedGateway.resolve("valid-proof-with-entropy", "request-6");
    const second = await cachedGateway.resolve("valid-proof-with-entropy", "request-7");
    expect(second).toEqual(first);
    expect(valid).toHaveBeenCalledTimes(2);
    expect(cachedGateway.stats().cacheEntries).toBe(1);
  });

  it("enforces connect and read deadlines and never exposes an upstream body", async () => {
    const neverConnects = gateway((() => new Promise<Response>(() => undefined)) as typeof fetch, {
      retries: 0, connectTimeoutMs: 10, overallTimeoutMs: 30,
    });
    await expect(neverConnects.resolve("timeout-proof-with-entropy", "request-timeout"))
      .rejects.toMatchObject({ code: "UPSTREAM_UNAVAILABLE" });

    const sentinelBody = "sentinel-upstream-body";
    const slowBody = gateway((async () => ({
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => new Promise<string>(() => sentinelBody),
    }) as Response) as typeof fetch, { retries: 0, readTimeoutMs: 10, overallTimeoutMs: 30 });
    const failure = await slowBody.resolve("read-timeout-proof-with-entropy", "request-read-timeout").catch((error) => error);
    expect(failure).toMatchObject({ code: "UPSTREAM_UNAVAILABLE" });
    expect(JSON.stringify(failure)).not.toContain(sentinelBody);
  });

  it("bounds upstream concurrency and opens/half-opens its circuit", async () => {
    let active = 0;
    let peak = 0;
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active -= 1;
      return response({}, 503);
    });
    const bounded = gateway(fetchImpl, { retries: 0, maxConcurrency: 2, circuitFailureThreshold: 2, circuitOpenMs: 20 });
    const results = await Promise.allSettled(Array.from({ length: 8 }, (_, index) =>
      bounded.resolve(`proof-${index}-with-enough-entropy`, `request-${index}`)));
    expect(results.every((item) => item.status === "rejected")).toBe(true);
    expect(peak).toBeLessThanOrEqual(2);
    expect(bounded.stats().circuitState).toBe("open");
    const calls = fetchImpl.mock.calls.length;
    await expect(bounded.resolve("new-proof-with-enough-entropy", "request-open"))
      .rejects.toMatchObject({ code: "UPSTREAM_UNAVAILABLE" });
    expect(fetchImpl).toHaveBeenCalledTimes(calls);
    await new Promise((resolve) => setTimeout(resolve, 25));
    await expect(bounded.resolve("probe-proof-with-enough-entropy", "request-probe"))
      .rejects.toBeInstanceOf(MusicIdentityError);
    expect(fetchImpl.mock.calls.length).toBe(calls + 1);
  });

  it("exposes exact shared success and versioned safe error contracts", () => {
    expect(musicEnsureRequestSchema.parse(undefined)).toBeUndefined();
    expect(() => musicEnsureRequestSchema.parse({})).toThrow();
    expect(musicEnsureResponseSchema.parse({
      version: "music-identity/v1",
      identity: { musicUserId: 7, status: "active" },
    }).identity.musicUserId).toBe(7);
    expect(musicErrorEnvelopeSchema.parse({
      version: "music-error/v1",
      error: {
        code: "UPSTREAM_UNAVAILABLE",
        message: "Music identity is temporarily unavailable.",
        action: "retry",
        retryable: true,
        requestId: "request-safe",
      },
    }).error.code).toBe("UPSTREAM_UNAVAILABLE");
    expect(Object.keys(musicIdentityOpenApi.operation.post.responses).sort()).toEqual([
      "200", "400", "401", "403", "409", "429", "500", "502", "503",
    ]);
    expect(musicIdentityOpenApi.operation.post).not.toHaveProperty("requestBody");
  });
});

describe("bounded identity rate limiter", () => {
  it("limits both source and proof fingerprint with bounded TTL/cardinality", () => {
    let now = 1_000;
    const limiter = new BoundedIdentityRateLimiter({ limit: 2, windowMs: 100, maxEntries: 3, now: () => now });
    expect(limiter.check("ip:a", "fp:a").allowed).toBe(true);
    expect(limiter.check("ip:a", "fp:a").allowed).toBe(true);
    expect(limiter.check("ip:a", "fp:a")).toMatchObject({ allowed: false });
    limiter.check("ip:b", "fp:b");
    limiter.check("ip:c", "fp:c");
    limiter.check("ip:d", "fp:d");
    expect(limiter.size()).toBeLessThanOrEqual(3);
    now += 101;
    expect(limiter.check("ip:a", "fp:a").allowed).toBe(true);
  });
});
