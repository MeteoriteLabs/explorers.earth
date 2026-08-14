import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { BoundedIdentityRateLimiter } from "../middleware/identityRateLimit";
import { setupMusicIdentityBodylessPreflight, setupMusicIdentityRoutes } from "../routes/musicIdentityRoutes";
import { decisionForRoute } from "../policies/musicSurfacePolicy";

const status = {
  operationId: "e36d710f-a5d3-4476-9d2f-34226a2af4aa",
  musicUserId: 12,
  identityStatus: "pending_deletion" as const,
  phase: "prepared" as const,
  state: "completed" as const,
  boundaryCrossed: false,
  retryable: false,
  deadLetter: false,
  upstreamUserDocumentId: "user-document-a",
  upstreamAccountDocumentId: "account-document-a",
};

function appFor(overrides: Record<string, unknown> = {}, routeOverrides: Record<string, unknown> = {}) {
  const app = express();
  setupMusicIdentityBodylessPreflight(app);
  app.use(express.json());
  const lifecycle = {
    prepareDeletion: vi.fn(async () => status),
    status: vi.fn(async () => status),
    markDeletionBoundary: vi.fn(async () => ({ ...status, boundaryCrossed: true, state: "requested" as const })),
    cancelDeletion: vi.fn(async () => ({ ...status, identityStatus: "suspended" as const, state: "cancelled" as const })),
    ...overrides,
  };
  setupMusicIdentityRoutes(app, {
    ensure: vi.fn(),
    mintCredential: vi.fn(),
    resolvePrincipal: vi.fn(),
    lifecycle,
    limiter: new BoundedIdentityRateLimiter({ limit: 20, globalLimit: 100, windowMs: 60_000, maxEntries: 100 }),
    fingerprint: () => "safe-fingerprint",
    isMusicCredential: (token: string) => token.startsWith("music."),
    requestIdFactory: () => "generated-request",
    logger: vi.fn(),
    ...routeOverrides,
  } as never);
  return { app, lifecycle };
}

describe("mounted Music lifecycle identity boundary", () => {
  it("returns the durable server operation without exposing local owner IDs", async () => {
    // Break caught: a lifecycle route accepts owner input or leaks numeric/local identity authority.
    const { app, lifecycle } = appFor();
    const response = await request(app)
      .post("/api/music/identity/lifecycle/prepare")
      .set("Authorization", `Bearer ${"b".repeat(32)}`)
      .set("X-Request-Id", "request-prepare")
      .expect(200);
    expect(response.headers["x-request-id"]).toBe("request-prepare");
    expect(response.body).toEqual({
      version: "music-lifecycle/v1",
      operation: {
        operationId: status.operationId,
        status: "pending_deletion",
        phase: "prepared",
        state: "completed",
        boundaryCrossed: false,
        retryable: false,
        deadLetter: false,
        upstreamUserDocumentId: "user-document-a",
        upstreamAccountDocumentId: "account-document-a",
      },
    });
    expect(JSON.stringify(response.body)).not.toContain("musicUserId");
    expect(lifecycle.prepareDeletion).toHaveBeenCalledWith("b".repeat(32), "request-prepare");
  });

  it("rejects bodies, query owner hints, and Music credentials on every mutation", async () => {
    // Break caught: lifecycle authority falls back to browser-supplied identity or a C5 token.
    const { app } = appFor();
    await request(app).post("/api/music/identity/lifecycle/prepare?userId=12")
      .set("Authorization", `Bearer ${"b".repeat(32)}`).expect(400);
    await request(app).post("/api/music/identity/lifecycle/boundary")
      .set("Authorization", `Bearer ${"b".repeat(32)}`).send({ operationId: status.operationId }).expect(400);
    await request(app).post("/api/music/identity/lifecycle/cancel")
      .set("Authorization", "Bearer music.local.owner.token").expect(401);
  });

  it("serves reload-safe status and a typed dead-letter escalation", async () => {
    // Break caught: reload loses the durable state or an exhausted operation looks healthy.
    const { app } = appFor({
      status: vi.fn(async () => ({ ...status, state: "failed", boundaryCrossed: true, deadLetter: true })),
    });
    const response = await request(app).get("/api/music/identity/lifecycle/status")
      .set("Authorization", `Bearer ${"b".repeat(32)}`).expect(200);
    expect(response.body.operation).toMatchObject({ state: "failed", deadLetter: true, retryable: false });
  });

  it("applies new-entry admission to prepare without blocking durable recovery", async () => {
    // Break caught: a disabled cohort can start deletion, or the kill switch strands an existing operation.
    const { app, lifecycle } = appFor({}, { entryEnabled: () => false });
    await request(app).post("/api/music/identity/lifecycle/prepare")
      .set("Authorization", `Bearer ${"b".repeat(32)}`).expect(503);
    await request(app).get("/api/music/identity/lifecycle/status")
      .set("Authorization", `Bearer ${"b".repeat(32)}`).expect(200);
    expect(lifecycle.prepareDeletion).not.toHaveBeenCalled();
    expect(lifecycle.status).toHaveBeenCalledOnce();
  });

  it("classifies every lifecycle route as the Explorer identity boundary", () => {
    // Break caught: generated authorization falls back to a retired/owner CRUD classification.
    for (const path of ["prepare", "status", "boundary", "cancel"]) {
      expect(decisionForRoute({ method: path === "status" ? "GET" : "POST", path: `/api/music/identity/lifecycle/${path}`, classification: "private" }))
        .toBe("strapi-identity");
    }
  });
});
