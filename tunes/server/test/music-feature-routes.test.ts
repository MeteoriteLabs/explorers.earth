import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { setupMusicFeatureRoutes } from "../routes/musicFeatureRoutes";
import { MusicPrincipalError } from "../middleware/musicPrincipal";

describe("GET /api/music/features", () => {
  it("requires a verified Music principal and passes only that principal to the decision service", async () => {
    const decide = vi.fn(() => ({ ownerWorkspace: false, guestWorkspace: false, playlistImports: false, exposureId: "opaque", expiresAt: "2026-08-26T00:00:00.000Z" }));
    const app = express();
    setupMusicFeatureRoutes(app, {
      resolvePrincipal: async (token) => {
        if (token !== "aaa.bbb.ccc") throw new Error("invalid");
        return { musicUserId: 11, subject: "subject", accountDocumentId: "account", sessionVersion: 2 };
      },
      decide,
      requestIdFactory: () => "feature-request",
    });
    expect((await request(app).get("/api/music/features")).status).toBe(401);
    const response = await request(app).get("/api/music/features").set("Authorization", "Bearer aaa.bbb.ccc");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ownerWorkspace: false, guestWorkspace: false, playlistImports: false, exposureId: "opaque", expiresAt: "2026-08-26T00:00:00.000Z" });
    expect(decide).toHaveBeenCalledWith(expect.objectContaining({ musicUserId: 11, accountDocumentId: "account" }));
  });

  it("does not misreport an unavailable decision service as an authentication failure", async () => {
    const app = express();
    setupMusicFeatureRoutes(app, {
      resolvePrincipal: async () => ({ musicUserId: 11, subject: "subject", accountDocumentId: "account", sessionVersion: 2 }),
      decide: () => { throw new Error("unavailable"); }, requestIdFactory: () => "feature-request",
    });
    const response = await request(app).get("/api/music/features").set("Authorization", "Bearer aaa.bbb.ccc");
    expect(response.status).toBe(503);
    expect(response.body.error).toMatchObject({ code: "SERVICE_UNAVAILABLE", retryable: true, requestId: "feature-request" });
  });

  it("preserves fail-closed lifecycle authority errors and never evaluates a decision", async () => {
    const decide = vi.fn(); const app = express();
    setupMusicFeatureRoutes(app, {
      resolvePrincipal: async () => { throw new MusicPrincipalError("IDENTITY_SUSPENDED", 403, "This Music identity is suspended."); },
      decide, requestIdFactory: () => "feature-request",
    });
    const response = await request(app).get("/api/music/features").set("Authorization", "Bearer aaa.bbb.ccc");
    expect(response.status).toBe(403);
    expect(response.body.error).toMatchObject({ code: "IDENTITY_SUSPENDED", retryable: false });
    expect(decide).not.toHaveBeenCalled();
  });
});
