import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";

const fixture = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../fixtures/strapi/music-identity/identity.fixture.json"), "utf8")) as {
  reconciliation: { schemaVersion: "strapi-music-reconciliation/v1"; sourceSnapshot: string; sourceChecksum: string };
  identities: Array<{ user: {
    documentId: string; username: string; email: string; provider: "local" | "google";
    confirmed: true; blocked: false; is_subscribed: boolean;
    accounts: Array<{ documentId: string; Account_Name: string; Account_Type: string; mobile_number: string; localtunes_integrated: "Yes" | "No" }>;
  } }>;
};
const user = fixture.identities[0]!.user;
const sourceIdentities = fixture.identities.map(({ user: identity }) => ({
  documentId: identity.documentId,
  username: identity.username,
  email: identity.email,
  provider: identity.provider,
  confirmed: identity.confirmed,
  blocked: identity.blocked,
  accounts: identity.accounts.map(({ documentId, Account_Name, Account_Type, mobile_number }) => ({
    documentId, Account_Name, Account_Type, mobile_number,
  })),
})).sort((left, right) => left.documentId.localeCompare(right.documentId));
const canonicalIdentities = sourceIdentities.map((identity) => ({
  userDocumentId: identity.documentId,
  accountDocumentId: identity.accounts[0]!.documentId,
  username: identity.username,
  email: identity.email,
  provider: identity.provider,
  accountName: identity.accounts[0]!.Account_Name,
  accountType: identity.accounts[0]!.Account_Type,
  accountMobile: identity.accounts[0]!.mobile_number,
}));
const sourceChecksum = createHash("sha256").update(canonicalIdentities.map((identity) => JSON.stringify(identity)).join("\n")).digest("hex");
if (sourceChecksum !== fixture.reconciliation.sourceChecksum) throw new Error("fixture reconciliation checksum does not match its identities");

const lifecycleAbsenceQuery = `query MusicIdentityAbsence($userDocumentId: ID!, $accountDocumentId: ID!) {
  usersPermissionsUser(documentId: $userDocumentId) { documentId }
  account(documentId: $accountDocumentId) { documentId }
}`;
const browserIdentityOperations = new Set([
  "MusicIdentityEligibility",
  "MusicPageEligibility",
  "CheckOnboardingStatus",
  "SidebarAccount",
  "user",
]);
const browserIdentity = {
  ...user,
  id: user.documentId,
  accounts: user.accounts.map((account) => ({
    ...account,
    profile_picture: null,
    public_recommendations: "No",
    public_music: "No",
    public_guides: "No",
    public_movie: "No",
    public_books: "No",
    public_games: "No",
    public_apps: "No",
    public_products: "No",
    public_people: "No",
    pinned_nav_tabs: [],
    auto_pinning: true,
  })),
};

function normalizeGraphql(source: string): string {
  return source.replace(/\s+/g, " ").trim();
}

export function fixtureResponse(input: {
  path: string;
  method: string | undefined;
  authorization: string | undefined;
}): { status: number; body: unknown } {
  if (input.path === "/health" && input.method === "GET") return { status: 200, body: { service: "strapi", status: "ready", fixtureVersion: "1" } };
  if (input.path === "/api/users/me" || input.path === "/api/accounts") {
    if (input.authorization !== "Bearer fixture-read-only-token") return { status: 403, body: { error: "fixture identity authority denied" } };
    if (input.method !== "GET") return { status: 405, body: { error: "fixture identity operation denied" } };
  }
  if (input.path === "/api/users/me") return { status: 200, body: browserIdentity };
  if (input.path === "/api/accounts") return { status: 200, body: { data: user.accounts, meta: { pagination: { page: 1, pageCount: 1, pageSize: 50, total: 1 } } } };
  return { status: 404, body: { error: "fixture route not found" } };
}

export function fixtureReconciliationResponse(input: {
  authorization: string | undefined;
  method: string | undefined;
  url: string;
}): { status: number; body: unknown } {
  if (input.authorization !== "Bearer fixture-read-only-token") return { status: 403, body: { error: "fixture reconciliation authority denied" } };
  if (input.method !== "GET") return { status: 405, body: { error: "fixture reconciliation operation denied" } };
  const url = new URL(input.url, "http://fixture");
  if (url.pathname !== "/api/music-identities") return { status: 404, body: { error: "fixture route not found" } };
  const allowedKeys = new Set(["pagination[page]", "pagination[pageSize]", "sort", "sourceSnapshot"]);
  if ([...url.searchParams.keys()].some((key) => !allowedKeys.has(key))) return { status: 400, body: { error: "fixture reconciliation query invalid" } };
  if ([...allowedKeys].some((key) => url.searchParams.getAll(key).length > 1)) return { status: 400, body: { error: "fixture reconciliation query duplicated" } };
  const pageRaw = url.searchParams.get("pagination[page]");
  const pageSizeRaw = url.searchParams.get("pagination[pageSize]");
  const page = pageRaw && /^\d+$/.test(pageRaw) ? Number(pageRaw) : 0;
  const pageSize = pageSizeRaw && /^\d+$/.test(pageSizeRaw) ? Number(pageSizeRaw) : 0;
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 1_000
      || url.searchParams.get("sort") !== "documentId:asc") {
    return { status: 400, body: { error: "fixture reconciliation pagination invalid" } };
  }
  const requestedSnapshot = url.searchParams.get("sourceSnapshot");
  if (requestedSnapshot && requestedSnapshot !== fixture.reconciliation.sourceSnapshot) {
    return { status: 409, body: { error: "fixture reconciliation snapshot changed" } };
  }
  const pageCount = Math.max(1, Math.ceil(sourceIdentities.length / pageSize));
  if (page > pageCount) return { status: 400, body: { error: "fixture reconciliation page invalid" } };
  return {
    status: 200,
    body: {
      data: sourceIdentities.slice((page - 1) * pageSize, page * pageSize),
      meta: {
        pagination: { page, pageSize, pageCount, total: sourceIdentities.length },
        reconciliation: { ...fixture.reconciliation, healthy: true },
      },
    },
  };
}

export function fixtureGraphqlResponse(input: {
  authorization: string | undefined;
  method: string | undefined;
  query: string;
  variables: Record<string, unknown>;
}): { status: number; body: unknown } {
  if (input.authorization !== "Bearer fixture-read-only-token") {
    return { status: 403, body: { error: "fixture lifecycle proof authority denied" } };
  }
  if (input.method !== "POST") return { status: 405, body: { error: "fixture lifecycle proof operation denied" } };
  const browserOperation = /^query\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/.exec(normalizeGraphql(input.query))?.[1];
  if (browserOperation && browserIdentityOperations.has(browserOperation)) {
    if (input.variables.documentId !== user.documentId) {
      return { status: 403, body: { error: "fixture browser identity subject denied" } };
    }
    return { status: 200, body: { data: { usersPermissionsUser: browserIdentity } } };
  }
  const exactRead = normalizeGraphql(input.query) === normalizeGraphql(lifecycleAbsenceQuery);
  if (!exactRead) return { status: 403, body: { error: "fixture lifecycle proof operation denied" } };
  const requestedUser = input.variables.userDocumentId;
  const requestedAccount = input.variables.accountDocumentId;
  if (typeof requestedUser !== "string" || typeof requestedAccount !== "string") {
    return { status: 400, body: { error: "fixture lifecycle proof variables invalid" } };
  }
  return { status: 200, body: { data: {
    usersPermissionsUser: requestedUser === user.documentId ? { documentId: user.documentId } : null,
    account: requestedAccount === user.accounts[0].documentId ? { documentId: user.accounts[0].documentId } : null,
  } } };
}

function argument(name: string): string | undefined { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; }

if (process.argv[1]?.replace(/\\/g, "/").endsWith("/scripts/music-fixture-server.ts")) {
  const port = Number(argument("--port"));
  if (!Number.isInteger(port)) throw new Error("usage: --port <port>");
  createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://fixture").pathname;
    if (path === "/api/music-identities") {
      const result = fixtureReconciliationResponse({
        authorization: request.headers.authorization,
        method: request.method,
        url: request.url ?? path,
      });
      response.writeHead(result.status, { "content-type": "application/json" });
      response.end(JSON.stringify(result.body));
      return;
    }
    if (path !== "/graphql") {
      const result = fixtureResponse({
        path,
        method: request.method,
        authorization: request.headers.authorization,
      });
      response.writeHead(result.status, { "content-type": "application/json" });
      response.end(JSON.stringify(result.body));
      return;
    }
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 64 * 1024) request.destroy();
    });
    request.on("end", () => {
      let decoded: { query?: unknown; variables?: unknown } = {};
      try { decoded = JSON.parse(body) as typeof decoded; }
      catch { /* handled as an invalid exact operation */ }
      const result = fixtureGraphqlResponse({
        authorization: request.headers.authorization,
        method: request.method,
        query: typeof decoded.query === "string" ? decoded.query : "",
        variables: decoded.variables && typeof decoded.variables === "object"
          ? decoded.variables as Record<string, unknown> : {},
      });
      response.writeHead(result.status, { "content-type": "application/json" });
      response.end(JSON.stringify(result.body));
    });
  }).listen(port, "0.0.0.0");
}
