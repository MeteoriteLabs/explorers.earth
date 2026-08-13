import { afterEach, describe, expect, it, vi } from "vitest";
import { fixtureResponse } from "../../../scripts/music-fixture-server.ts";

afterEach(() => vi.unstubAllGlobals());

describe("deterministic Music fixture services", () => {
  it("serves the repository-shaped Strapi current-user contract", () => {
    // Production break caught: fixture Strapi reports only version metadata, so
    // smoke tests never exercise identity, Account, lifecycle, or entitlement.
    expect(fixtureResponse("/api/users/me")).toMatchObject({
      status: 200,
      body: {
        documentId: "fixture-user-document-id",
        blocked: false,
        is_subscribed: false,
        accounts: [{
          documentId: "fixture-account-document-id",
          Account_Name: "Fixture Explorer",
          Account_Type: "Personal",
          mobile_number: "+10000000000",
          localtunes_integrated: "No",
        }],
      },
    });
  });

  it("accepts Explorers HTML while requiring JSON from fixture APIs", async () => {
    // Production break caught: smoke parses the real Explorers SPA root as
    // JSON, so a healthy Nginx-served application necessarily fails smoke.
    vi.stubGlobal("fetch", async (input: string | URL | Request) => {
      const url = String(input);
      return url === "http://127.0.0.1:55173/"
        ? new Response("<!doctype html><html><body>Explorers</body></html>", { status: 200, headers: { "content-type": "text/html; charset=utf-8" } })
        : new Response(JSON.stringify({ status: "ready" }), { status: 200, headers: { "content-type": "application/json" } });
    });

    await expect(import("../../../scripts/music-smoke.ts")).resolves.toBeDefined();
  });
});
