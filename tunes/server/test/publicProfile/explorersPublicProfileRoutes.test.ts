import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { setupExplorersPublicProfileRoutes } from "../../routes/explorersPublicProfileRoutes";

describe("explorers public profile routes", () => {
  it("returns a safe public shell", async () => {
    const app = express();
    setupExplorersPublicProfileRoutes(app, { shell: async () => ({ username: "tk2727", public_profile: "Yes" }), category: async () => undefined });
    await request(app).get("/api/explorers/v1/profiles/tk2727").expect(200).expect({ username: "tk2727", public_profile: "Yes" });
  });
  it("returns the same safe 404 for an unavailable category", async () => {
    const app = express();
    setupExplorersPublicProfileRoutes(app, { category: async () => undefined });
    const response = await request(app).get("/api/explorers/v1/profiles/tk2727/recommendations/apps").expect(404);
    expect(response.body).toEqual({ version: "explorers-public-error/v1", error: { code: "NOT_FOUND" } });
  });

  it("sets public caching headers for an allowed category", async () => {
    const app = express();
    setupExplorersPublicProfileRoutes(app, { category: async () => ({ lists: [] }) });
    const response = await request(app).get("/api/explorers/v1/profiles/tk2727/recommendations/apps").expect(200);
    expect(response.headers["cache-control"]).toContain("max-age=30");
    expect(response.headers.etag).toBeDefined();
  });

  it("maps upstream failures to a safe retryable response", async () => {
    const app = express();
    setupExplorersPublicProfileRoutes(app, { category: async () => { throw new Error("upstream credentials must stay private"); } });
    const response = await request(app).get("/api/explorers/v1/profiles/tk2727/recommendations/apps").expect(503);
    expect(response.body.error.code).toBe("UNAVAILABLE");
    expect(JSON.stringify(response.body)).not.toContain("credentials");
  });

  it("rejects malformed public identifiers before calling the gateway", async () => {
    const category = vi.fn();
    const app = express();
    setupExplorersPublicProfileRoutes(app, { category });
    await request(app).get("/api/explorers/v1/profiles/tk2727%2Fadmin/recommendations/apps").expect(404);
    expect(category).not.toHaveBeenCalled();
  });

  it("honours the bounded page size and creator cache bypass", async () => {
    const category = vi.fn().mockResolvedValue({ lists: [] });
    const app = express();
    setupExplorersPublicProfileRoutes(app, { category });
    const response = await request(app).get("/api/explorers/v1/profiles/tk2727/recommendations/apps?limit=24").set("Cache-Control", "no-cache").expect(200);
    expect(category).toHaveBeenCalledWith("tk2727", "apps", 24, { bypassCache: true });
    expect(response.headers["cache-control"]).toContain("max-age=30");
  });

  it("maps shell upstream failures to a safe retryable response", async () => {
    const app = express();
    setupExplorersPublicProfileRoutes(app, { shell: async () => { throw new Error("private upstream detail"); }, category: async () => undefined });
    const response = await request(app).get("/api/explorers/v1/profiles/tk2727").expect(503);
    expect(response.body.error.code).toBe("UNAVAILABLE");
    expect(JSON.stringify(response.body)).not.toContain("private");
  });
});
