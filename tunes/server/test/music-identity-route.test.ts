import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { setupMusicIdentityBodylessPreflight, setupMusicIdentityRoutes } from "../routes/musicIdentityRoutes";
import { MusicIdentityError, musicErrorEnvelopeSchema } from "../../shared/musicError";
import { BoundedIdentityRateLimiter } from "../middleware/identityRateLimit";

function appFor(ensure = vi.fn(async () => ({
  id: 41,
  strapiUserDocumentId: "user-doc",
  strapiAccountDocumentId: "account-doc",
  identityStatus: "active" as const,
  sessionVersion: 1,
})), entryEnabled = true) {
  const app = express();
  setupMusicIdentityBodylessPreflight(app);
  app.use(express.json({ limit: "1kb" }));
  const logs: unknown[] = [];
  setupMusicIdentityRoutes(app, {
    ensure,
    limiter: new BoundedIdentityRateLimiter({ limit: 20, windowMs: 1_000, maxEntries: 100 }),
    logger: (entry) => logs.push(entry),
    fingerprint: () => "safe-fingerprint",
    requestIdFactory: () => "generated-request-id",
    entryEnabled: () => entryEnabled,
  });
  return { app, ensure, logs };
}

describe("POST /api/music/identity/ensure", () => {
  it("fails closed before proof resolution while the server entry kill switch is active", async () => {
    const { app, ensure } = appFor(undefined, false);
    const response = await request(app)
      .post("/api/music/identity/ensure")
      .set("authorization", "Bearer proof-with-enough-entropy");
    expect(response.status).toBe(503);
    expect(response.headers["retry-after"]).toBe("60");
    expect(response.body.error.code).toBe("ENTRY_DISABLED");
    expect(ensure).not.toHaveBeenCalled();
  });

  it("accepts only one strict bearer and an absent body/query/owner identity", async () => {
    const { app, ensure } = appFor();
    const ok = await request(app)
      .post("/api/music/identity/ensure")
      .set("authorization", "Bearer proof-with-enough-entropy")
      .set("x-request-id", "bounded-request-1");
    expect(ok.status).toBe(200);
    expect(ok.headers["x-request-id"]).toBe("bounded-request-1");
    expect(ok.body).toEqual({ version: "music-identity/v1", identity: { musicUserId: 41, status: "active" } });
    expect(ensure).toHaveBeenCalledWith("proof-with-enough-entropy", "bounded-request-1");

    const invalidRequests = [
      request(app).post("/api/music/identity/ensure"),
      request(app).post("/api/music/identity/ensure").set("cookie", "cosmic.sid=forged-native-session"),
      request(app).post("/api/music/identity/ensure").set("authorization", "bearer proof-with-enough-entropy"),
      request(app).post("/api/music/identity/ensure").set("authorization", "Bearer proof one two"),
      request(app).post("/api/music/identity/ensure").set("authorization", "Bearer proof-with-enough-entropy").send({}),
      request(app).post("/api/music/identity/ensure").set("authorization", "Bearer proof-with-enough-entropy").set("content-type", "application/json").send('{"unterminated"'),
      request(app).post("/api/music/identity/ensure?username=forged").set("authorization", "Bearer proof-with-enough-entropy"),
      request(app).post("/api/music/identity/ensure").set("authorization", "Bearer proof-with-enough-entropy").set("x-owner-id", "forged"),
      request(app).post("/api/music/identity/ensure").set("authorization", "Bearer proof-with-enough-entropy").set("x-username", "forged"),
    ];
    for (const operation of invalidRequests) {
      const response = await operation;
      expect([400, 401]).toContain(response.status);
      expect(musicErrorEnvelopeSchema.safeParse(response.body).success).toBe(true);
      expect(response.headers["x-request-id"]).toBeTruthy();
    }
    expect(ensure).toHaveBeenCalledTimes(1);
  });

  it("rejects duplicate Authorization fields and non-exact path aliases", async () => {
    const { app, ensure } = appFor();
    const duplicate = await request(app)
      .post("/api/music/identity/ensure")
      .set("authorization", ["Bearer proof-with-enough-entropy", "Bearer second-proof-with-entropy"]);
    expect(duplicate.status).toBe(401);
    await request(app).post("/api/music/identity/ensure/").set("authorization", "Bearer proof-with-enough-entropy").expect(404);
    await request(app).post("/API/music/identity/ensure").set("authorization", "Bearer proof-with-enough-entropy").expect(404);
    expect(ensure).not.toHaveBeenCalled();
  });

  it("replaces unsafe request IDs and emits safe 429/503 responses with Retry-After", async () => {
    const unavailable = vi.fn(async () => {
      throw new MusicIdentityError("UPSTREAM_UNAVAILABLE", 503, "Music identity is temporarily unavailable.", "retry", true, 3);
    });
    const { app, logs } = appFor(unavailable);
    const response = await request(app)
      .post("/api/music/identity/ensure")
      .set("authorization", "Bearer sentinel-secret-proof")
      .set("x-request-id", "unsafe/value");
    expect(response.status).toBe(503);
    expect(response.headers["retry-after"]).toBe("3");
    expect(response.headers["x-request-id"]).toBe("generated-request-id");
    const serialized = JSON.stringify({ body: response.body, logs });
    expect(serialized).not.toContain("sentinel-secret-proof");
    expect(serialized).not.toContain("unsafe");
    expect(serialized).not.toContain("stack");
  });

  it("coalesces the whole 50-way operation for one proof", async () => {
    let calls = 0;
    const ensure = vi.fn(async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return {
        id: 9,
        strapiUserDocumentId: "user-doc",
        strapiAccountDocumentId: "account-doc",
        identityStatus: "active" as const,
        sessionVersion: 1,
      };
    });
    const { MusicProjectionService } = await import("../services/musicProjectionService");
    const service = new MusicProjectionService({ resolve: async () => ({
      userDocumentId: "user-doc",
      accountDocumentId: "account-doc",
      username: "astronaut",
      email: "safe@example.invalid",
      provider: "local" as const,
      accountName: "Moon Room",
      accountType: "Venue",
      accountMobile: "+15555550100",
    }) }, { ensureIdentity: ensure } as never);
    const results = await Promise.all(Array.from({ length: 50 }, (_, index) =>
      service.ensure("one-shared-proof", `request-${index}`)));
    expect(new Set(results.map((item) => item.id))).toEqual(new Set([9]));
    expect(calls).toBe(1);
    expect(service.stats().inflight).toBe(0);
  });

  it("keeps the exact upstream budget at two calls for a 50-way same-proof load", async () => {
    const { StrapiIdentityGateway } = await import("../services/strapiIdentityGateway");
    const fetchImpl = vi.fn<typeof fetch>()
      .mockImplementationOnce(async () => {
        await new Promise((resolve) => setTimeout(resolve, 15));
        return new Response(JSON.stringify({
          documentId: "load-user", username: "load", email: "load@example.invalid",
          provider: "local", confirmed: true, blocked: false,
        }), { status: 200 });
      })
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{
        documentId: "load-account", Account_Name: "Load", Account_Type: "Venue", mobile_number: "+15555550111",
      }] }), { status: 200 }));
    const gateway = new StrapiIdentityGateway({
      baseUrl: "https://strapi.invalid", fetchImpl, maxConcurrency: 2, retries: 0,
      connectTimeoutMs: 100, readTimeoutMs: 100, overallTimeoutMs: 500, cacheTtlMs: 1_000,
      circuitFailureThreshold: 2, circuitOpenMs: 100,
    });
    const ensureIdentity = vi.fn(async () => ({
      id: 77, strapiUserDocumentId: "load-user", strapiAccountDocumentId: "load-account",
      identityStatus: "active" as const, sessionVersion: 1,
    }));
    const { MusicProjectionService } = await import("../services/musicProjectionService");
    const service = new MusicProjectionService(gateway, { ensureIdentity });
    const results = await Promise.all(Array.from({ length: 50 }, (_, index) => service.ensure("same-load-proof-with-entropy", `load-${index}`)));
    expect(new Set(results.map(({ id }) => id))).toEqual(new Set([77]));
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(ensureIdentity).toHaveBeenCalledTimes(1);
    expect(service.stats().coalesced).toBe(49);
  });

  it("bounds a same-source invalid-proof storm before upstream amplification", async () => {
    const ensure = vi.fn(async () => {
      throw new MusicIdentityError("AUTH_INVALID", 401, "The Explorer proof is invalid or expired.", "authenticate", false);
    });
    const app = express();
    setupMusicIdentityBodylessPreflight(app);
    setupMusicIdentityRoutes(app, {
      ensure,
      limiter: new BoundedIdentityRateLimiter({ limit: 3, windowMs: 60_000, maxEntries: 8 }),
      fingerprint: (proof) => proof,
    });
    const responses = await Promise.all(Array.from({ length: 20 }, (_, index) => request(app)
      .post("/api/music/identity/ensure")
      .set("authorization", `Bearer invalid-proof-${index}-with-entropy`)));
    expect(ensure).toHaveBeenCalledTimes(3);
    expect(responses.filter(({ status }) => status === 429)).toHaveLength(17);
    expect(responses.every(({ body }) => musicErrorEnvelopeSchema.safeParse(body).success)).toBe(true);
  });
});
