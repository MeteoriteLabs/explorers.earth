import { createServer } from "node:http";

type FixtureService = "strapi" | "tunes" | "explorers";

const user = {
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
};

export function fixtureResponse(service: FixtureService, path: string): { status: number; body: unknown } {
  if (path === "/health") return { status: 200, body: { service, status: "ready", fixtureVersion: "1" } };
  if (service === "strapi" && path === "/api/users/me") return { status: 200, body: user };
  if (service === "strapi" && path === "/api/accounts") return { status: 200, body: { data: user.accounts, meta: { pagination: { page: 1, pageCount: 1, pageSize: 100, total: 1 } } } };
  if (service === "tunes" && path === "/api/smoke") return { status: 200, body: { status: "ready", identityOwner: user.documentId, accountContext: user.accounts[0].documentId } };
  if (service === "explorers" && path === "/") return { status: 200, body: { status: "ready", musicPath: "/music" } };
  return { status: 404, body: { error: "fixture route not found" } };
}

function argument(name: string): string | undefined { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; }

if (process.argv[1]?.replace(/\\/g, "/").endsWith("/scripts/music-fixture-server.ts")) {
  const service = argument("--service") as FixtureService;
  const port = Number(argument("--port"));
  if (!["strapi", "tunes", "explorers"].includes(service) || !Number.isInteger(port)) throw new Error("usage: --service strapi|tunes|explorers --port <port>");
  createServer((request, response) => {
    const result = fixtureResponse(service, new URL(request.url ?? "/", "http://fixture").pathname);
    response.writeHead(result.status, { "content-type": "application/json" });
    response.end(JSON.stringify(result.body));
  }).listen(port, "0.0.0.0");
}
