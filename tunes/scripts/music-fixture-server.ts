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

export function fixtureResponse(path: string): { status: number; body: unknown } {
  if (path === "/health") return { status: 200, body: { service: "strapi", status: "ready", fixtureVersion: "1" } };
  if (path === "/api/users/me") return { status: 200, body: user };
  if (path === "/api/accounts") return { status: 200, body: { data: user.accounts, meta: { pagination: { page: 1, pageCount: 1, pageSize: 100, total: 1 } } } };
  return { status: 404, body: { error: "fixture route not found" } };
}

function argument(name: string): string | undefined { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; }

if (process.argv[1]?.replace(/\\/g, "/").endsWith("/scripts/music-fixture-server.ts")) {
  const port = Number(argument("--port"));
  if (!Number.isInteger(port)) throw new Error("usage: --port <port>");
  createServer((request, response) => {
    const result = fixtureResponse(new URL(request.url ?? "/", "http://fixture").pathname);
    response.writeHead(result.status, { "content-type": "application/json" });
    response.end(JSON.stringify(result.body));
  }).listen(port, "0.0.0.0");
}
