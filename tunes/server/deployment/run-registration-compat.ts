import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { errorEnvelope } from "../containment-error-contract";

const port = Number(process.env.PORT ?? "5100");
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("invalid compatibility port");
const host = process.env.MUSIC_COMPAT_HOST ?? "0.0.0.0";

const server = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/health/live") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end('{"status":"live"}');
    return;
  }
  if (request.method === "POST" && request.url === "/api/register") {
    request.resume();
    const requestId = randomUUID();
    response.writeHead(410, { "content-type": "application/json", "x-request-id": requestId, "cache-control": "no-store" });
    response.end(JSON.stringify(errorEnvelope("LEGACY_IDENTITY_ROUTE_REMOVED", requestId)));
    return;
  }
  response.writeHead(404, { "content-type": "application/json", "cache-control": "no-store" });
  response.end('{"error":{"code":"NOT_FOUND"}}');
});

server.listen(port, host, () => {
  if (process.env.MUSIC_COMPAT_REPORT_ADDRESS === "1") {
    const address = server.address();
    if (address && typeof address !== "string") process.stdout.write(`${JSON.stringify({ port: address.port })}\n`);
  }
});
