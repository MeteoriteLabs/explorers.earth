import { createServer } from "node:http";

const user = {
  documentId: "fixture-user-document-id",
  username: "fixture-explorer",
  email: "fixture-explorer@example.invalid",
  provider: "local",
  confirmed: true,
  blocked: false,
  is_subscribed: false,
  accounts: [{
    documentId: "fixture-account-document-id",
    Account_Name: "Fixture Explorer",
    Account_Type: "Personal",
    mobile_number: "+10000000000",
    localtunes_integrated: "No",
  }],
};

const lifecycleAbsenceQuery = `query MusicIdentityAbsence($userDocumentId: ID!, $accountDocumentId: ID!) {
  usersPermissionsUser(documentId: $userDocumentId) { documentId }
  account(documentId: $accountDocumentId) { documentId }
}`;

function normalizeGraphql(source: string): string {
  return source.replace(/\s+/g, " ").trim();
}

export function fixtureResponse(path: string): { status: number; body: unknown } {
  if (path === "/health") return { status: 200, body: { service: "strapi", status: "ready", fixtureVersion: "1" } };
  if (path === "/api/users/me") return { status: 200, body: user };
  if (path === "/api/accounts") return { status: 200, body: { data: user.accounts, meta: { pagination: { page: 1, pageCount: 1, pageSize: 100, total: 1 } } } };
  return { status: 404, body: { error: "fixture route not found" } };
}

export function fixtureGraphqlResponse(input: {
  authorization: string | undefined;
  query: string;
  variables: Record<string, unknown>;
}): { status: number; body: unknown } {
  if (input.authorization !== "Bearer fixture-read-only-token") {
    return { status: 403, body: { error: "fixture lifecycle proof authority denied" } };
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
    if (path !== "/graphql") {
      const result = fixtureResponse(path);
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
        query: typeof decoded.query === "string" ? decoded.query : "",
        variables: decoded.variables && typeof decoded.variables === "object"
          ? decoded.variables as Record<string, unknown> : {},
      });
      response.writeHead(result.status, { "content-type": "application/json" });
      response.end(JSON.stringify(result.body));
    });
  }).listen(port, "0.0.0.0");
}
