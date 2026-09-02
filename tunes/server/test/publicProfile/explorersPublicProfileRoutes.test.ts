import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
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
});
