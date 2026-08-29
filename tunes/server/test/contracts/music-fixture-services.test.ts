import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMusicFixtureService, fixtureGraphqlResponse, fixtureReconciliationResponse, fixtureResponse } from "../../../scripts/music-fixture-server.ts";

afterEach(() => vi.unstubAllGlobals());

const repositoryRoot = resolve(import.meta.dirname, "../../../..");

function checkedInGraphqlOperation(relativePath: string, operation: string): string {
  const source = readFileSync(resolve(repositoryRoot, relativePath), "utf8");
  const matches = [...source.matchAll(/gql`([\s\S]*?)`/g)]
    .map((match) => match[1])
    .filter((document) => new RegExp(`\\b(?:query|mutation)\\s+${operation}\\b`).test(document));
  if (matches.length !== 1) throw new Error(`expected one checked-in ${operation} document`);
  return matches[0]!;
}

describe("deterministic Music fixture services", () => {
  it("projects one configured namespaced identity and restores its allowlisted Account preference", () => {
    const service = createMusicFixtureService({
      username: "e2e-public-music-contract-owner",
      accountDocumentId: "e2e-public-music-contract-account",
      userDocumentId: "e2e-public-music-contract-user",
      token: "contract-fixture-token",
    });
    const authority = "Bearer contract-fixture-token";

    expect(service.response({ path: "/api/users/me", method: "GET", authorization: authority })).toMatchObject({
      status: 200,
      body: { username: "e2e-public-music-contract-owner", documentId: "e2e-public-music-contract-user",
        accounts: [{ documentId: "e2e-public-music-contract-account", public_music: "No" }] },
    });
    expect(service.response({ path: "/api/accounts/e2e-public-music-contract-account", method: "PUT", authorization: authority,
      body: { data: { public_music: "Yes" } } })).toMatchObject({ status: 200, body: { data: { public_music: "Yes" } } });
    expect(service.response({ path: "/api/accounts/e2e-public-music-contract-account", method: "GET", authorization: authority }))
      .toMatchObject({ status: 200, body: { data: { documentId: "e2e-public-music-contract-account", public_music: "Yes" } } });
    expect(service.response({ path: "/api/accounts/e2e-public-music-contract-account", method: "PUT", authorization: authority,
      body: { data: { public_music: "No" } } })).toMatchObject({ status: 200, body: { data: { public_music: "No" } } });

    for (const denied of [
      { path: "/api/accounts/wrong-account", method: "GET", authorization: authority },
      { path: "/api/accounts/e2e-public-music-contract-account", method: "GET", authorization: "Bearer wrong" },
      { path: "/api/accounts/e2e-public-music-contract-account", method: "PATCH", authorization: authority },
      { path: "/api/accounts/e2e-public-music-contract-account", method: "PUT", authorization: authority, body: { data: { public_music: "Maybe" } } },
      { path: "/api/accounts/e2e-public-music-contract-account", method: "PUT", authorization: authority, body: { data: { public_music: "Yes", Account_Name: "changed" } } },
    ]) expect(service.response(denied).status).not.toBe(200);
  });

  it("serves the exact checked-in profile documents with deterministic revisioned state and exact privileged restore", () => {
    const namespace = "e2e-public-music-profile-contract";
    const username = `${namespace}-owner`;
    const accountDocumentId = `${namespace}-account`;
    const userDocumentId = `${namespace}-user`;
    const token = "profile-contract-fixture-token";
    const authority = `Bearer ${token}`;
    const service = createMusicFixtureService({ username, accountDocumentId, userDocumentId, token });
    const tuple = { namespace, username, accountDocumentId, userDocumentId };
    const profileQuery = checkedInGraphqlOperation("explorers-earth/src/features/Profile/api/query.ts", "UsersPermissionsUser");
    const settingsQuery = checkedInGraphqlOperation("explorers-earth/src/features/Settings/api/mutation.ts", "UsersPermissionsUser");
    const updateMutation = checkedInGraphqlOperation("explorers-earth/src/features/Profile/hooks/useUpdateProfile.ts", "UpdateAccount");
    const visibilityMutation = checkedInGraphqlOperation("explorers-earth/src/features/Settings/api/mutation.ts", "UpdateAccount");
    const publicProfileQuery = checkedInGraphqlOperation("explorers-earth/src/features/PublicHome/api/query.ts", "PublicProfileData");

    const captured = service.response({
      path: "/__music-fixture/profile-state/snapshot", method: "POST", authorization: authority, body: tuple,
    });
    expect(captured).toMatchObject({
      status: 200,
      body: {
        version: "music-fixture-profile-state/v1",
        revision: 0,
        stateHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        snapshot: { version: "music-fixture-profile-snapshot/v1", revision: 0, account: {
          documentId: accountDocumentId,
          username,
          social_media: { theme_settings: expect.any(Object) },
          Feed_Data: [expect.objectContaining({ type: "image", url: "/images/tuneslogo.png" })],
          updatedAt: expect.any(String),
        } },
      },
    });
    const capturedBody = captured.body as { snapshot: unknown; stateHash: string };

    const before = service.graphql({ authorization: authority, method: "POST", query: profileQuery, variables: { documentId: userDocumentId } });
    expect(before).toMatchObject({ status: 200, body: { data: { usersPermissionsUser: { accounts: [{ updatedAt: expect.any(String) }] } } } });
    expect(service.graphql({ authorization: authority, method: "POST", query: settingsQuery, variables: { documentId: userDocumentId } }))
      .toMatchObject({ status: 200, body: { data: { usersPermissionsUser: { documentId: userDocumentId, accounts: [{ documentId: accountDocumentId }] } } } });
    const beforeUpdatedAt = (before.body as any).data.usersPermissionsUser.accounts[0].updatedAt;

    const socialMedia = {
      theme_settings: {
        preset: "neon-cyber", accentColor: "#F43F5E", wallpaperMode: "ambient-gradient",
        firstView: "books", visibleTabs: { recommendations: true, gallery: true, business: true },
        recommendations: { layout: "featured", categoryOrder: ["books", "places", "movies"] },
      },
    };
    const updated = service.graphql({
      authorization: authority,
      method: "POST",
      query: updateMutation,
      variables: {
        documentId: accountDocumentId,
        data: {
          Bio: "Revision one",
          Account_Name: "Profile Contract",
          Addresss: { city: "Fixture City" },
          Primary_Address: { address: "Fixture City" },
          Public_Profile_Address: "Fixture City",
          Feed_Data: [{ type: "fixture", value: "profile" }],
          social_media: socialMedia,
          Account_Type: "Personal",
          mobile_number_visibility: false,
        },
      },
    });
    expect(updated).toMatchObject({ status: 200, body: { data: { updateAccount: {
      documentId: accountDocumentId, Bio: "Revision one", social_media: socialMedia,
    } } } });

    const after = service.graphql({ authorization: authority, method: "POST", query: profileQuery, variables: { documentId: userDocumentId } });
    const afterAccount = (after.body as any).data.usersPermissionsUser.accounts[0];
    expect(Date.parse(afterAccount.updatedAt)).toBeGreaterThan(Date.parse(beforeUpdatedAt));
    expect(afterAccount).toMatchObject({ Bio: "Revision one", social_media: socialMedia, Feed_Data: [{ type: "fixture", value: "profile" }] });

    const visibility = service.graphql({
      authorization: authority,
      method: "POST",
      query: visibilityMutation,
      variables: { documentId: accountDocumentId, data: { public_music: "Yes" } },
    });
    expect(visibility).toMatchObject({ status: 200, body: { data: { updateAccount: {
      documentId: accountDocumentId, public_music: "Yes",
    } } } });

    const publicView = service.graphql({
      authorization: authority, method: "POST", query: publicProfileQuery,
      variables: { filters: { username: { eq: username } } },
    });
    expect(publicView).toMatchObject({ status: 200, body: { data: { accounts: [{
      documentId: accountDocumentId, Bio: "Revision one", social_media: socialMedia, public_music: "Yes",
    }] } } });

    const restored = service.response({
      path: "/__music-fixture/profile-state/restore", method: "POST", authorization: authority,
      body: { ...tuple, snapshot: capturedBody.snapshot },
    });
    expect(restored).toEqual({
      status: 200,
      body: { version: "music-fixture-profile-state/v1", restored: true, revision: 0, stateHash: capturedBody.stateHash },
    });
    const exact = service.graphql({ authorization: authority, method: "POST", query: profileQuery, variables: { documentId: userDocumentId } });
    expect((exact.body as any).data.usersPermissionsUser.accounts[0].updatedAt).toBe(beforeUpdatedAt);
    expect((exact.body as any).data.usersPermissionsUser.accounts[0].Bio).not.toBe("Revision one");
    expect((exact.body as any).data.usersPermissionsUser.accounts[0].public_music).toBe("No");
  });

  it("fails closed for non-registry GraphQL shapes, hostile profile fields, and mismatched privileged tuples", () => {
    const namespace = "e2e-public-music-profile-hostile";
    const username = `${namespace}-owner`;
    const accountDocumentId = `${namespace}-account`;
    const userDocumentId = `${namespace}-user`;
    const token = "hostile-contract-fixture-token";
    const authority = `Bearer ${token}`;
    const service = createMusicFixtureService({ username, accountDocumentId, userDocumentId, token });
    expect(() => createMusicFixtureService({
      username: "fixture-explorer", accountDocumentId: "fixture-account-document-id",
      userDocumentId: "fixture-user-document-id", token,
    })).toThrow("complete namespaced authority tuple");
    const updateMutation = checkedInGraphqlOperation("explorers-earth/src/features/Profile/hooks/useUpdateProfile.ts", "UpdateAccount");
    const profileQuery = checkedInGraphqlOperation("explorers-earth/src/features/Profile/api/query.ts", "UsersPermissionsUser");
    const tuple = { namespace, username, accountDocumentId, userDocumentId };

    const denied = [
      service.graphql({ authorization: authority, method: "POST", query: profileQuery.replace(/}\s*$/, "systemSettings { id } }"), variables: { documentId: userDocumentId } }),
      service.graphql({ authorization: authority, method: "POST", query: profileQuery.replace("username", "alias: username"), variables: { documentId: userDocumentId } }),
      service.graphql({ authorization: authority, method: "POST", query: updateMutation, variables: { documentId: accountDocumentId, data: { social_media: {}, administrator: true } } }),
      service.graphql({ authorization: authority, method: "POST", query: updateMutation, variables: { documentId: "other-account", data: { social_media: {} } } }),
      service.response({ path: "/__music-fixture/profile-state/snapshot", method: "POST", authorization: authority, body: { ...tuple, namespace: `${namespace}-other` } }),
      service.response({ path: "/__music-fixture/profile-state/snapshot", method: "POST", authorization: "Bearer wrong", body: tuple }),
      service.response({ path: "/__music-fixture/profile-state/snapshot", method: "GET", authorization: authority, body: tuple }),
    ];
    expect(denied.every(({ status }) => status !== 200)).toBe(true);
    expect(JSON.stringify(denied)).not.toContain(token);

    const nginx = readFileSync(resolve(repositoryRoot, "explorers-earth/nginx.music-fixture.conf"), "utf8");
    expect(nginx).not.toMatch(/proxy_pass[^\n]*strapi[\s\S]{0,300}__music-fixture\/profile-state|location[^\n]*__music-fixture\/profile-state/);
  });

  it("projects deterministic content for every exact checked-in public profile category document", () => {
    const namespace = "e2e-public-music-category-contract";
    const accountDocumentId = `${namespace}-account`;
    const service = createMusicFixtureService({
      username: `${namespace}-owner`, accountDocumentId, userDocumentId: `${namespace}-user`, token: "category-contract-fixture-token",
    });
    const authority = "Bearer category-contract-fixture-token";
    const operations = [
      ["GetPlacesLists", "recommendationLists"], ["GetMoviesLists", "movieLists"],
      ["GetBooksLists", "bookLists"], ["GetGamesLists", "gameLists"],
      ["GetAppsLists", "appLists"], ["GetProductsLists", "productLists"],
      ["GetPeopleLists", "personLists"], ["GetGuidesLists", "guides"],
    ] as const;
    for (const [operation, rootField] of operations) {
      const response = service.graphql({
        authorization: authority, method: "POST",
        query: checkedInGraphqlOperation("explorers-earth/src/features/PublicHome/components/ProfileRecommendationsTab.tsx", operation),
        variables: { accountDocumentId },
      });
      expect(response.status, operation).toBe(200);
      expect((response.body as any).data[rootField], operation).toEqual([expect.objectContaining({ documentId: expect.any(String) })]);
    }
  });

  it("binds the runner tuple to the actual loopback fixture process and restores the preference", async () => {
    const port = 52_000 + Math.floor(Math.random() * 1_000);
    const origin = `http://127.0.0.1:${port}`;
    const token = "contract-process-fixture-token";
    const eligibilityQuery = checkedInGraphqlOperation("explorers-earth/src/pages/Music.tsx", "MusicPageEligibility");
    const child = spawn(process.execPath, ["--experimental-strip-types", resolve(import.meta.dirname, "../../../scripts/music-fixture-server.ts"), "--port", String(port)], {
      env: { ...process.env, MUSIC_E2E_ACCOUNT_USERNAME: "e2e-public-music-process-owner",
        MUSIC_E2E_ACCOUNT_DOCUMENT_ID: "e2e-public-music-process-account", MUSIC_E2E_USER_DOCUMENT_ID: "e2e-public-music-process-user",
        MUSIC_E2E_STRAPI_TOKEN: token }, stdio: "ignore",
    });
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    try {
      let ready = false;
      for (let attempt = 0; attempt < 30 && !ready; attempt += 1) {
        await new Promise((resolveWait) => setTimeout(resolveWait, 50));
        try { ready = (await fetch(`${origin}/health`)).ok; } catch { /* starting */ }
      }
      expect(ready).toBe(true);
      const identity = await (await fetch(`${origin}/api/users/me`, { headers })).json();
      expect(identity).toMatchObject({ username: "e2e-public-music-process-owner", accounts: [{ documentId: "e2e-public-music-process-account" }] });
      const callback = await (await fetch(`${origin}/graphql`, { method: "POST", headers, body: JSON.stringify({
        query: eligibilityQuery,
        variables: { documentId: "e2e-public-music-process-user" },
      }) })).json();
      expect(callback.data.usersPermissionsUser).toMatchObject({ documentId: "e2e-public-music-process-user",
        accounts: [{ documentId: "e2e-public-music-process-account" }] });
      const before = await (await fetch(`${origin}/api/accounts/e2e-public-music-process-account`, { headers })).json();
      expect(before.data.public_music).toBe("No");
      await fetch(`${origin}/api/accounts/e2e-public-music-process-account`, { method: "PUT", headers, body: JSON.stringify({ data: { public_music: "Yes" } }) });
      await fetch(`${origin}/api/accounts/e2e-public-music-process-account`, { method: "PUT", headers, body: JSON.stringify({ data: { public_music: before.data.public_music } }) });
      const restored = await (await fetch(`${origin}/api/accounts/e2e-public-music-process-account`, { headers })).json();
      expect(restored.data.public_music).toBe("No");
    } finally { child.kill(); }
  });
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
      query: checkedInGraphqlOperation("explorers-earth/src/pages/Music.tsx", "MusicPageEligibility"),
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
