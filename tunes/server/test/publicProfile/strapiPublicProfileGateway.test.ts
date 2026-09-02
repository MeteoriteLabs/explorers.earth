import { describe, expect, it, vi } from "vitest";
import { StrapiPublicProfileGateway } from "../../publicProfile/strapiPublicProfileGateway";

describe("StrapiPublicProfileGateway", () => {
  it("uses a fixed server-owned query and authorization header", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { appLists: [] } }), { status: 200 }));
    const gateway = new StrapiPublicProfileGateway({ origin: "https://cms.example", token: "server-only-token", fetchImpl });
    await gateway.resolveCategory("tk2727", "apps", 12);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://cms.example/graphql");
    expect(init.headers.authorization).toBe("Bearer server-only-token");
    expect(JSON.parse(init.body)).toMatchObject({ variables: { username: "tk2727", limit: 12 } });
  });

  it("returns the bounded App card fields required by the existing public overview", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { appLists: [] } }), { status: 200 }));
    await new StrapiPublicProfileGateway({ origin: "https://cms.example", token: "server-only-token", fetchImpl }).resolveCategory("tk2727", "apps", 12);
    const query = JSON.parse(fetchImpl.mock.calls[0][1].body).query;
    expect(query).toContain("recommended_apps(sort:[\"display_order:asc\"],pagination:{limit:12})");
    expect(query).toContain("title");
    expect(query).toContain("app_category{documentId name slug}");
  });

  it.each([["books", "recommended_books", "title"], ["products", "recommended_products", "title"]] as const)("returns bounded %s card data for the public overview", async (category, relation, requiredField) => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }));
    await new StrapiPublicProfileGateway({ origin: "https://cms.example", token: "server-only-token", fetchImpl }).resolveCategory("tk2727", category, 12);
    const query = JSON.parse(fetchImpl.mock.calls[0][1].body).query;
    expect(query).toContain(`${relation}(sort:["display_order:asc"],pagination:{limit:12})`);
    expect(query).toContain(requiredField);
  });

  it.each([["places", "recommended_places"], ["movies", "recommended_movies"], ["books", "recommended_books"], ["games", "recommended_games"], ["guides", "Guide_Media"], ["apps", "recommended_apps"], ["products", "recommended_products"], ["people", "recommended_people"]] as const)("uses the allowlisted %s projection", async (category, field) => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }));
    await new StrapiPublicProfileGateway({ origin: "https://cms.example", token: "server-only-token", fetchImpl }).resolveCategory("tk2727", category, 12);
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).query).toContain(field);
  });

  it("unwraps the allowlisted GraphQL data instead of forwarding its envelope", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { appLists: [{ documentId: "list-1" }] }, extensions: { traceId: "internal" } }), { status: 200 }));
    const value = await new StrapiPublicProfileGateway({ origin: "https://cms.example", token: "server-only-token", fetchImpl }).resolveCategory("tk2727", "apps", 12);
    expect(value).toEqual({ appLists: [{ documentId: "list-1" }] });
  });

  it("fails closed when Strapi returns GraphQL errors with an OK status", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: null, errors: [{ message: "Forbidden" }] }), { status: 200 }));
    await expect(new StrapiPublicProfileGateway({ origin: "https://cms.example", token: "server-only-token", fetchImpl }).resolveCategory("tk2727", "apps", 12)).rejects.toThrow("PUBLIC_PROFILE_UPSTREAM_FAILED");
  });

  it("fails closed when an account response contains GraphQL errors", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: null, errors: [{ message: "Forbidden" }] }), { status: 200 }));
    await expect(new StrapiPublicProfileGateway({ origin: "https://cms.example", token: "server-only-token", fetchImpl }).resolveAccount("tk2727")).rejects.toThrow("PUBLIC_PROFILE_UPSTREAM_FAILED");
  });

  it("uses a dedicated public shell projection and never requests a mobile number", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { accounts: [] } }), { status: 200 }));
    await new StrapiPublicProfileGateway({ origin: "https://cms.example", token: "server-only-token", fetchImpl }).resolveAccount("tk2727");
    const query = JSON.parse(fetchImpl.mock.calls[0][1].body).query;
    expect(query).toMatch(/pagination:\s*\{\s*limit:\s*1\s*\}\s*\)\s*\{\s*username\s+Account_Name/);
    expect(query).toContain("Account_Name");
    expect(query).toMatch(/profile_picture\s*\{\s*url\s+alternativeText/);
    expect(query).not.toMatch(/\bmobile_number\b/);
  });

  it("uses a fixed account-scoped Apps detail query rather than client-side list filtering", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { appLists: [] } }), { status: 200 }));
    await new StrapiPublicProfileGateway({ origin: "https://cms.example", token: "server-only-token", fetchImpl }).resolveDetail("tk2727", "apps", "useful-apps", 24);
    const payload = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(payload.variables).toMatchObject({ username: "tk2727", slug: "useful-apps", limit: 24 });
    expect(payload.query).toContain("slug:{eq:$slug}");
    expect(payload.query).toContain("recommended_apps(sort:[\"display_order:asc\"],pagination:{limit:$limit})");
  });

  it.each([
    ["places", "recommendationLists", "recommended_places"],
    ["movies", "movieLists", "recommended_movies"],
    ["books", "bookLists", "recommended_books"],
    ["games", "gameLists", "recommended_games"],
    ["guides", "guides", "guide_sections"],
    ["apps", "appLists", "recommended_apps"],
    ["products", "productLists", "recommended_products"],
    ["people", "personLists", "recommended_people"],
  ] as const)("uses an exact, account-scoped %s detail projection", async (category, collection, detailField) => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { [collection]: [] } }), { status: 200 }));
    await new StrapiPublicProfileGateway({ origin: "https://cms.example", token: "server-only-token", fetchImpl }).resolveDetail("tk2727", category, "published-list", 24);
    const payload = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(payload.variables).toMatchObject({ username: "tk2727", slug: "published-list", limit: 24 });
    expect(payload.query).toContain(`${collection}(filters:{account:{username:{eq:$username}},slug:{eq:$slug}`);
    expect(payload.query).toContain(detailField);
  });
});
