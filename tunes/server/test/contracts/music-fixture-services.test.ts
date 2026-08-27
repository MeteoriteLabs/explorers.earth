import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fixtureGraphqlResponse, fixtureReconciliationResponse, fixtureResponse } from "../../../scripts/music-fixture-server.ts";

afterEach(() => vi.unstubAllGlobals());

describe("deterministic Music fixture services", () => {
  it("routes authenticated browser mutations to the isolated fixture origin rather than a synthetic or production host", () => {
    // A real browser must reach the fixture Tunes gateway through its own
    // origin.  A Playwright-only route interception can make a broken bundle
    // appear healthy while the browser would otherwise call an invalid host.
    const repository = resolve(import.meta.dirname, "../../../..");
    const compose = readFileSync(resolve(repository, "docker-compose.music-test.yml"), "utf8");
    const nginx = readFileSync(resolve(repository, "explorers-earth/nginx.music-fixture.conf"), "utf8");
    const dockerfile = readFileSync(resolve(repository, "explorers-earth/Dockerfile.music-fixture"), "utf8");

    // `publicMusicClient` intentionally permits insecure transport only for
    // localhost.  The fixture must use that narrow exception rather than
    // weakening the production HTTPS/origin contract for 127.0.0.1.
    expect(compose).toContain("VITE_LOCAL_TUNES_API_URL: http://localhost:55173");
    expect(compose).toContain("VITE_API_URL: http://localhost:55173/graphql");
    expect(compose).toContain("VITE_REST_API_URL: http://localhost:55173");
    expect(compose).not.toContain("VITE_LOCAL_TUNES_API_URL: https://music-fixture.invalid");
    expect(nginx).toMatch(/location ~ \^\/\(api\/music\(\?:\/\|\$\)\|api\/playlists\(\?:\/\|\$\)\|api\/playlist\(\?:\/\|\$\)\|api\/youtube\(\?:\/\|\$\)\)/);
    expect(nginx).toContain("proxy_pass http://tunes:5000;");
    // Same-origin GETs do not carry an Origin header. The fixture proxy must
    // attest its exact local browser origin before the strict gateway guard
    // evaluates owner rollout reads.
    expect(nginx).toContain("proxy_set_header Origin $scheme://$http_host;");
    expect(nginx).toContain("location = /api/users/me");
    expect(nginx).toContain("location = /graphql");
    expect(nginx).toContain("proxy_pass http://strapi:1337;");
    expect(dockerfile).toContain("COPY explorers-earth/nginx.music-fixture.conf /etc/nginx/conf.d/default.conf");
  });

  it("serves the repository-shaped Strapi current-user contract", () => {
    // Production break caught: fixture Strapi reports only version metadata, so
    // smoke tests never exercise identity, Account, lifecycle, or entitlement.
    expect(fixtureResponse({
      path: "/api/users/me", method: "GET", authorization: "Bearer fixture-read-only-token",
    })).toMatchObject({
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
    for (const denied of [
      { path: "/api/users/me", method: "GET", authorization: undefined },
      { path: "/api/users/me", method: "DELETE", authorization: "Bearer fixture-read-only-token" },
      { path: "/api/accounts", method: "POST", authorization: "Bearer fixture-read-only-token" },
    ]) expect(fixtureResponse(denied).status).not.toBe(200);

    expect(fixtureResponse({
      path: "/api/accounts", method: "GET", authorization: "Bearer fixture-read-only-token",
    })).toMatchObject({
      status: 200,
      body: { meta: { pagination: { page: 1, pageCount: 1, pageSize: 50, total: 1 } } },
    });
  });

  it("allows only the exact immutable-ID absence proof for the deterministic credential", () => {
    const allowed = fixtureGraphqlResponse({
      authorization: "Bearer fixture-read-only-token",
      method: "POST",
      query: `query MusicIdentityAbsence($userDocumentId: ID!, $accountDocumentId: ID!) {
        usersPermissionsUser(documentId: $userDocumentId) { documentId }
        account(documentId: $accountDocumentId) { documentId }
      }`,
      variables: {
        userDocumentId: "fixture-user-document-id",
        accountDocumentId: "fixture-account-document-id",
      },
    });
    expect(allowed).toEqual({ status: 200, body: { data: {
      usersPermissionsUser: { documentId: "fixture-user-document-id" },
      account: { documentId: "fixture-account-document-id" },
    } } });

    const mutation = fixtureGraphqlResponse({
      authorization: "Bearer fixture-read-only-token",
      method: "POST",
      query: "mutation { deleteAccount(documentId: \"fixture-account-document-id\") { documentId } }",
      variables: {},
    });
    expect(mutation.status).toBe(403);
    expect(JSON.stringify(mutation.body)).not.toContain("fixture-read-only-token");

    const appendedRead = fixtureGraphqlResponse({
      authorization: "Bearer fixture-read-only-token",
      method: "POST",
      query: `query MusicIdentityAbsence($userDocumentId: ID!, $accountDocumentId: ID!) {
        usersPermissionsUser(documentId: $userDocumentId) { documentId }
        account(documentId: $accountDocumentId) { documentId }
        systemSettings { id }
      }`,
      variables: {
        userDocumentId: "fixture-user-document-id",
        accountDocumentId: "fixture-account-document-id",
      },
    });
    expect(appendedRead.status).toBe(403);
    expect(fixtureGraphqlResponse({
      authorization: "Bearer fixture-read-only-token",
      method: "GET",
      query: `query MusicIdentityAbsence($userDocumentId: ID!, $accountDocumentId: ID!) {
        usersPermissionsUser(documentId: $userDocumentId) { documentId }
        account(documentId: $accountDocumentId) { documentId }
      }`,
      variables: { userDocumentId: "fixture-user-document-id", accountDocumentId: "fixture-account-document-id" },
    }).status).toBe(405);
  });

  it("serves the authenticated Explorer browser identity reads through the real fixture Strapi contract", () => {
    const allowed = fixtureGraphqlResponse({
      authorization: "Bearer fixture-read-only-token",
      method: "POST",
      query: `query MusicPageEligibility($documentId: ID!) {
        usersPermissionsUser(documentId: $documentId) {
          documentId provider confirmed blocked
          accounts { documentId Account_Name Account_Type mobile_number }
        }
      }`,
      variables: { documentId: "fixture-user-document-id" },
    });
    expect(allowed).toMatchObject({
      status: 200,
      body: { data: { usersPermissionsUser: {
        documentId: "fixture-user-document-id",
        provider: "local",
        confirmed: true,
        accounts: [{ documentId: "fixture-account-document-id" }],
      } } },
    });

    for (const denied of [
      { query: "query UnexpectedRead($documentId: ID!) { usersPermissionsUser(documentId: $documentId) { email } }", variables: { documentId: "fixture-user-document-id" } },
      { query: "query MusicPageEligibility($documentId: ID!) { usersPermissionsUser(documentId: $documentId) { documentId } }", variables: { documentId: "other-user" } },
      { query: "mutation MusicPageEligibility { deleteUsersPermissionsUser(documentId: \"fixture-user-document-id\") { documentId } }", variables: {} },
    ]) {
      expect(fixtureGraphqlResponse({
        authorization: "Bearer fixture-read-only-token", method: "POST", ...denied,
      }).status).not.toBe(200);
    }
  });

  it("serves only the exact stable reconciliation page to its read-only authority", () => {
    const allowed = fixtureReconciliationResponse({
      authorization: "Bearer fixture-read-only-token",
      method: "GET",
      url: "/api/music-identities?pagination%5Bpage%5D=1&pagination%5BpageSize%5D=100&sort=documentId%3Aasc",
    });
    expect(allowed).toMatchObject({
      status: 200,
      body: {
        data: [{ documentId: "fixture-user-document-id", accounts: [{ documentId: "fixture-account-document-id" }] }],
        meta: {
          pagination: { page: 1, pageSize: 100, pageCount: 1, total: 1 },
          reconciliation: {
            schemaVersion: "strapi-music-reconciliation/v1",
            sourceSnapshot: "fixture-reconciliation-snapshot-v1",
            sourceChecksum: expect.stringMatching(/^[a-f0-9]{64}$/),
            healthy: true,
          },
        },
      },
    });
    for (const denied of [
      { authorization: undefined, method: "GET", url: "/api/music-identities?pagination%5Bpage%5D=1&pagination%5BpageSize%5D=100&sort=documentId%3Aasc" },
      { authorization: "Bearer fixture-read-only-token", method: "POST", url: "/api/music-identities?pagination%5Bpage%5D=1&pagination%5BpageSize%5D=100&sort=documentId%3Aasc" },
      { authorization: "Bearer fixture-read-only-token", method: "GET", url: "/api/music-identities?pagination%5Bpage%5D=1&pagination%5BpageSize%5D=100&sort=username%3Aasc" },
      { authorization: "Bearer fixture-read-only-token", method: "GET", url: "/api/music-identities?pagination%5Bpage%5D=1&pagination%5BpageSize%5D=100&sort=documentId%3Aasc&sourceSnapshot=changed" },
    ]) {
      const response = fixtureReconciliationResponse(denied);
      expect(response.status).not.toBe(200);
      expect(JSON.stringify(response.body)).not.toContain("fixture-read-only-token");
    }
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
