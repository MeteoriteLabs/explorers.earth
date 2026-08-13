import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import ts from "typescript";

export interface RouteSurface { method: string; path: string; classification: string; ownerSource: string; policy: string; lifecycle: string; source: string; line: number; }
interface EventSurface { direction: "receive" | "emit"; event: string; policy: string; ownerSource: string; lifecycle: string; source: string; line: number; }
interface JobSurface { kind: "setInterval" | "setTimeout"; lifecycle: string; source: string; line: number; }
export interface RuntimeSurfaceInventory { schemaVersion: "music-runtime-surface-inventory/v1"; routes: RouteSurface[]; events: EventSurface[]; jobs: JobSurface[]; }

function files(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = resolve(directory, name);
    if (name === "node_modules" || name === "test" || name === "__tests__") return [];
    if (statSync(path).isDirectory()) return files(path);
    return path.endsWith(".ts") ? [path] : [];
  });
}

function literal(node: ts.Node | undefined): string | undefined {
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : undefined;
}

function policyFor(text: string): string {
  const policies = ["requireAnyAuth", "requireAuth", "passport.authenticate", "authenticateToken", "csrf", "Limiter", "rateLimit"].filter((name) => text.includes(name));
  return policies.length ? policies.join("+") : "none";
}

function classificationFor(path: string, policy: string): string {
  if (path === "/graphql" || path.includes("strapi/graphql")) return "service-token-proxy";
  if (["/api/login", "/api/logout", "/api/check", "/api/csrf-token"].includes(path)) return "native-session";
  if (path.startsWith("/api/admin/")) return "admin-handler-review-required";
  if (policy !== "none") return "authenticated";
  if (["/api/playlist/:guestUrl", "/robots.txt", "/sitemap.xml", "/api/explorers-sitemap.xml", "/itunes-api/search", "/health/live", "/health/ready", "/api/music-entry/status"].includes(path)) return "public";
  if (/:(?:userId|username|sessionId)\b/.test(path) || path === "/api/auth/sync") return "owner-handler-review-required";
  return "handler-authorization-unknown";
}

function ownerFor(path: string, policy: string): string {
  if (path.startsWith("/api/admin/")) return /:userId\b/.test(path) ? "authenticated-admin-principal+path.userId" : "authenticated-admin-principal";
  if (path === "/api/auth/sync") return "request.body.strapiUser";
  if (path.includes(":guestUrl")) return "path.guestUrl";
  if (path.includes(":userId")) return "path.userId";
  if (path.includes(":username")) return "path.username";
  if (path.includes(":sessionId")) return "path.sessionId";
  return policy === "none" ? "handler-derived-or-none" : "authenticated-principal";
}

export function assertNoUnclassifiedSensitiveSurfaces(routes: RouteSurface[]): void {
  for (const route of routes) {
    const admin = route.path.startsWith("/api/admin/");
    const owner = /:(?:userId|username|sessionId)\b/.test(route.path) || route.path === "/api/auth/sync";
    if ((admin && (route.classification !== "admin-handler-review-required" || !route.ownerSource.includes("admin-principal"))) ||
        (owner && !admin && route.classification === "handler-authorization-unknown")) {
      throw new Error(`unclassified sensitive surface ${route.method} ${route.path}`);
    }
  }
}

function lifecycleFor(path: string, method: string): string {
  if (path.includes("reactivat")) return "reactivate";
  if (path.includes("block") || path.includes("deactiv")) return "block-or-deactivate";
  if (method === "DELETE") return "delete";
  return "request";
}

export function inventoryRuntimeSurfaces(repositoryRoot: string): RuntimeSurfaceInventory {
  const serverRoot = resolve(repositoryRoot, "tunes", "server");
  const routes: RouteSurface[] = [];
  const events: EventSurface[] = [];
  const jobs: JobSurface[] = [];
  for (const file of files(serverRoot)) {
    const sourceText = readFileSync(file, "utf8");
    const sourceFile = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const source = relative(repositoryRoot, file).replace(/\\/g, "/");
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
        if (ts.isPropertyAccessExpression(node.expression)) {
          const method = node.expression.name.text.toLowerCase();
          const target = node.expression.expression.getText(sourceFile);
          const path = literal(node.arguments[0]);
          if (["get", "post", "put", "patch", "delete", "use"].includes(method) && path?.startsWith("/")) {
            const middleware = node.arguments.slice(1, -1).map((argument) => argument.getText(sourceFile)).join(" ");
            const routePolicy = policyFor(middleware);
            const classification = classificationFor(path, routePolicy);
            let policy = routePolicy;
            if (classification === "public") policy = "explicit-public-contract";
            else if (policy === "none") policy = "handler-level-unverified";
            routes.push({ method: method.toUpperCase(), path, classification, ownerSource: ownerFor(path, routePolicy), policy, lifecycle: lifecycleFor(path, method.toUpperCase()), source, line });
          }
          const event = literal(node.arguments[0]);
          if ((method === "on" || method === "emit") && event && /^(?:io|socket|this\.io)/.test(target)) {
            events.push({ direction: method === "on" ? "receive" : "emit", event, policy: event === "connection" ? "session-middleware" : "socket-connection", ownerSource: "socket-session-or-room", lifecycle: event === "disconnect" ? "disconnect" : "event", source, line });
          }
        } else if (ts.isIdentifier(node.expression) && (node.expression.text === "setInterval" || node.expression.text === "setTimeout")) {
          jobs.push({ kind: node.expression.text, lifecycle: source.includes("reactivation-service") ? "reactivation-token-cleanup" : "scheduled-callback", source, line });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  const compare = (left: { source: string; line: number }, right: { source: string; line: number }) => left.source.localeCompare(right.source) || left.line - right.line;
  assertNoUnclassifiedSensitiveSurfaces(routes);
  return { schemaVersion: "music-runtime-surface-inventory/v1", routes: routes.sort(compare), events: events.sort(compare), jobs: jobs.sort(compare) };
}

export function writeRuntimeSurfaceInventory(repositoryRoot: string): string {
  const target = resolve(repositoryRoot, "docs", "architecture", "music-runtime-surface-inventory.json");
  writeFileSync(target, `${JSON.stringify(inventoryRuntimeSurfaces(repositoryRoot), null, 2)}\n`);
  return target;
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("/scripts/inventory-runtime-surfaces.ts") && process.argv.includes("--write")) {
  writeRuntimeSurfaceInventory(resolve(import.meta.dirname, "../.."));
}
