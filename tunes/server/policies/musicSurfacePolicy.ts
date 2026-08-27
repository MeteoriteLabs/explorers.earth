import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const MUSIC_ENTITLEMENT_MAX_AGE_SECONDS = 600;

export type MusicEntitlementState = "unknown" | "included" | "eligible" | "entitled" | "revoked";

const MUSIC_ENTITLEMENT_STATES = new Set<MusicEntitlementState>([
  "unknown", "included", "eligible", "entitled", "revoked",
]);

export function isMusicEntitlementState(value: unknown): value is MusicEntitlementState {
  return typeof value === "string" && MUSIC_ENTITLEMENT_STATES.has(value as MusicEntitlementState);
}

export function entitlementDecision(
  entitlement: { state: MusicEntitlementState; sourceUpdatedAt?: Date },
  now = new Date(),
): { coreRead: true; coreMutation: true; paidMutation: boolean } {
  if (!isMusicEntitlementState(entitlement.state)) throw new Error("Unsupported Music entitlement state.");
  const timestamp = entitlement.sourceUpdatedAt?.getTime();
  const ageMilliseconds = timestamp === undefined ? Number.POSITIVE_INFINITY : now.getTime() - timestamp;
  return {
    coreRead: true,
    coreMutation: true,
    paidMutation: entitlement.state === "entitled"
      && Number.isFinite(ageMilliseconds)
      && ageMilliseconds >= 0
      && ageMilliseconds <= MUSIC_ENTITLEMENT_MAX_AGE_SECONDS * 1_000,
  };
}

export function createGuestCapability(): string {
  return randomBytes(32).toString("base64url");
}

export function hashGuestCapability(capability: string): string {
  return createHash("sha256").update(capability, "utf8").digest("hex");
}

export function verifyGuestCapability(capability: string, expectedHash: string): boolean {
  if (!/^[A-Za-z0-9_-]{43}$/.test(capability) || !/^[a-f0-9]{64}$/.test(expectedHash)) return false;
  const actual = Buffer.from(hashGuestCapability(capability), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export type MusicSurfaceDecision =
  | "public"
  | "strapi-identity"
  | "owner"
  | "paid-owner"
  | "guest"
  | "native-session"
  | "tombstone"
  | "admin-tombstone"
  | "owner-or-guest"
  | "unclassified";

export interface RuntimeRouteSurface {
  method: string;
  path: string;
  classification: string;
  source: string;
}

export interface RuntimeEventSurface {
  direction: "receive" | "emit";
  event: string;
  source: string;
}

const PUBLIC_PATHS = new Set([
  "/health/live",
  "/health/ready",
  "/api/music-entry/status",
  "/robots.txt",
  "/sitemap.xml",
  "/api/explorers-sitemap.xml",
  "/itunes-api/search",
  "/api/user/request-reactivation",
  "/api/user/reactivate",
  "/api/music-fixture/readiness",
  "/api-docs",
]);

const PAID_PREFIXES = [
  "/api/payments/",
  "/api/subscriptions/",
  "/api/gemini/",
  "/api/playlist/import-",
  "/api/music/paid/",
];

const OWNER_PREFIXES = [
  "/api/playlists",
  "/api/playlist/",
  "/api/user",
  "/api/system-settings/",
  "/api/youtube/",
  "/api/instagram/",
  "/apps/",
  "/products/",
  "/people/",
  "/proxy-image",
  "/api/email/",
  "/api/seo",
];

export function decisionForRoute(route: Pick<RuntimeRouteSurface, "method" | "path" | "classification">): MusicSurfaceDecision {
  if (route.classification === "admin-tombstone") return "admin-tombstone";
  if (route.classification === "tombstone") return "tombstone";
  if (route.path === "/api/music/identity/ensure" || route.path.startsWith("/api/music/identity/lifecycle/")) return "strapi-identity";
  if (route.path === "/api/music/identity/current") return "owner";
  if (route.path === "/api/music/entitlement" || route.path === "/api/music/dashboard" || route.path === "/api/music/features" || route.path === "/api/music/guest-controls") return "owner";
  if (route.path === "/api/music/publication" || route.path === "/api/music/queue/replace" || route.path === "/api/music/queue/append") return "owner";
  if (route.path === "/api/playlist/:guestUrl") return "guest";
  if (route.path === "/api/playlist/:guestUrl/requests") return "guest";
  if (route.path === "/api/playlist/:guestUrl/youtube/search" || route.path === "/api/playlist/:guestUrl/youtube/video-from-url") return "guest";
  if (PUBLIC_PATHS.has(route.path) || route.classification === "public") return "public";
  if (route.path.startsWith("/api/admin/")) return "admin-tombstone";
  if (route.path === "/graphql" || route.path === "/api/strapi/graphql"
      || route.path === "/api/strapi/config" || route.path === "/api/debug/strapi"
      || route.path.startsWith("/api/auth/") || route.path === "/api/register"
      || route.path === "/api/connect/google" || route.path === "/api") return "tombstone";
  if (["/api/login", "/api/logout", "/api/check", "/api/csrf-token"].includes(route.path)) return "native-session";
  if (PAID_PREFIXES.some((prefix) => route.path.startsWith(prefix))) return "paid-owner";
  if (OWNER_PREFIXES.some((prefix) => route.path === prefix || route.path.startsWith(prefix))) return "owner";
  if (route.classification === "authenticated") return "owner";
  return "tombstone";
}

function allowedFor(decision: MusicSurfaceDecision) {
  return {
    unauthenticated: decision === "public" || decision === "guest" || decision === "native-session",
    owner: decision === "owner" || decision === "paid-owner" || decision === "owner-or-guest",
    otherUser: false,
    suspended: false,
    pendingDeletion: false,
    staleEntitlement: decision === "owner",
    guestValid: decision === "guest" || decision === "owner-or-guest",
    guestInvalid: false,
    guestRevoked: false,
    internalAdmin: false,
    nativeSession: decision === "native-session",
  };
}

export function authorizationMatrixFromInventory(inventory: {
  routes: RuntimeRouteSurface[];
  events: RuntimeEventSurface[];
  jobs?: Array<{ kind: string; lifecycle: string; source: string; line: number }>;
  retirementMatchers?: Array<{
    family: string;
    path: string;
    match: "exact" | "prefix";
    classification: "tombstone" | "admin-tombstone";
    exclusions?: readonly string[];
  }>;
}) {
  return {
    routes: inventory.routes.map((route) => {
      const decision = decisionForRoute(route);
      const allowed = allowedFor(decision);
      if (decision === "guest" && route.method !== "GET") allowed.unauthenticated = false;
      return { method: route.method, path: route.path, source: route.source, decision, allowed };
    }),
    events: inventory.events.map((event) => {
      const decision: MusicSurfaceDecision = event.direction === "emit" && event.event === "guest_request" ? "owner"
        : event.direction === "emit" && event.event === "player_state" ? "guest"
        : event.event === "guest_request" ? "guest"
        : event.event === "connection" ? "owner-or-guest"
          : event.event === "disconnect" || event.direction === "emit" ? "public"
          : event.event === "player_state" ? "owner" : "tombstone";
      return { direction: event.direction, event: event.event, source: event.source, decision, allowed: allowedFor(decision) };
    }),
    jobs: (inventory.jobs ?? []).map(({ line: _line, ...job }) => ({
      ...job,
      decision: "internal-service" as const,
      allowed: { internalService: true, browser: false, public: false },
    })),
    retirementMatchers: (inventory.retirementMatchers ?? []).map((rule) => ({
      ...rule,
      decision: rule.classification,
      allowed: allowedFor(rule.classification),
    })),
  };
}
