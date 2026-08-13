import { randomUUID } from "node:crypto";
import type { Express, NextFunction, Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";

export type ContainmentCode =
  | "AUTH_REQUIRED"
  | "AUTH_INVALID"
  | "AUTH_SUSPENDED"
  | "AMBIGUOUS_CREDENTIALS"
  | "AMBIGUOUS_OWNER_INPUT"
  | "REQUEST_INVALID"
  | "CSRF_INVALID"
  | "ORIGIN_FORBIDDEN"
  | "GRAPHQL_PROXY_REMOVED"
  | "SERVICE_CREDENTIAL_ROUTE_REMOVED"
  | "LEGACY_IDENTITY_ROUTE_REMOVED"
  | "LEGACY_OWNER_ROUTE_REMOVED"
  | "ADMIN_REQUIRED"
  | "PAYLOAD_TOO_LARGE"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "SOCKET_EVENT_FORBIDDEN"
  | "SOCKET_PAYLOAD_INVALID";

const SAFE_MESSAGES: Record<ContainmentCode, { message: string; action: string; retryable: boolean }> = {
  AUTH_REQUIRED: { message: "Authentication is required.", action: "authenticate", retryable: false },
  AUTH_INVALID: { message: "Authentication could not be verified.", action: "authenticate", retryable: false },
  AUTH_SUSPENDED: { message: "This Music account is unavailable.", action: "contact_support", retryable: false },
  AMBIGUOUS_CREDENTIALS: { message: "Use exactly one authentication method.", action: "retry", retryable: false },
  AMBIGUOUS_OWNER_INPUT: { message: "Owner fields are not accepted.", action: "retry", retryable: false },
  REQUEST_INVALID: { message: "The request is invalid.", action: "retry", retryable: false },
  CSRF_INVALID: { message: "The request could not be verified.", action: "refresh", retryable: true },
  ORIGIN_FORBIDDEN: { message: "This origin is not allowed.", action: "stop", retryable: false },
  GRAPHQL_PROXY_REMOVED: { message: "This GraphQL endpoint is no longer available.", action: "upgrade_client", retryable: false },
  SERVICE_CREDENTIAL_ROUTE_REMOVED: { message: "This service credential endpoint is no longer available.", action: "upgrade_client", retryable: false },
  LEGACY_IDENTITY_ROUTE_REMOVED: { message: "This identity endpoint is no longer available.", action: "upgrade_client", retryable: false },
  LEGACY_OWNER_ROUTE_REMOVED: { message: "This owner-targeted endpoint is no longer available.", action: "upgrade_client", retryable: false },
  ADMIN_REQUIRED: { message: "Administrator permission is required.", action: "stop", retryable: false },
  PAYLOAD_TOO_LARGE: { message: "The request payload is too large.", action: "reduce_payload", retryable: false },
  RATE_LIMITED: { message: "Too many requests.", action: "retry", retryable: true },
  INTERNAL_ERROR: { message: "Music is temporarily unavailable.", action: "retry", retryable: true },
  SOCKET_EVENT_FORBIDDEN: { message: "This socket event is not allowed.", action: "stop", retryable: false },
  SOCKET_PAYLOAD_INVALID: { message: "The socket payload is invalid.", action: "retry", retryable: false },
};

type RequestWithPrincipal = Request & {
  containmentPrincipal?: { kind: "session"; userId: number; isAdmin: boolean } | { kind: "strapi"; externalId: number };
  containmentRequestId?: string;
};

export function requestIdFor(req: Request): string {
  const request = req as RequestWithPrincipal;
  request.containmentRequestId ??= randomUUID();
  return request.containmentRequestId;
}

export function errorEnvelope(code: ContainmentCode, requestId: string = randomUUID()) {
  return { error: { code, ...SAFE_MESSAGES[code], requestId } };
}

export function sendContainmentError(res: Response, status: number, code: ContainmentCode, requestId: string) {
  res.setHeader("X-Request-Id", requestId);
  if (code === "RATE_LIMITED") res.setHeader("Retry-After", "60");
  console.warn("music_containment_failure", { code, requestId });
  return res.status(status).json(errorEnvelope(code, requestId));
}

export function allowedOrigins(): string[] {
  const configured = process.env.ALLOWED_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean);
  return configured?.length ? configured : ["http://localhost:5173"];
}

export function verifyStrapiToken(token: string): JwtPayload & { id: number } {
  const secret = process.env.STRAPI_JWT_SECRET;
  if (!secret) throw new Error("STRAPI_JWT_SECRET is required");
  const payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
  if (typeof payload === "string" || !Number.isInteger(payload.id) || Number(payload.id) <= 0) {
    throw new Error("invalid subject");
  }
  return payload as JwtPayload & { id: number };
}

type RejectedLegacyOwner = JwtPayload & { id: number };

/** A verified Strapi identity cannot authorize a legacy numeric Music owner. */
export function rejectLegacyBearerOwner(): RejectedLegacyOwner {
  throw new Error("Verified Strapi bearer requires the Music identity gateway");
}

const LIMITER_CAPACITY = 1024;
const authAttempts = new Map<string, { count: number; resetAt: number }>();

function evictLimiterEntries(now: number): void {
  authAttempts.forEach((value, key) => {
    if (value.resetAt <= now) authAttempts.delete(key);
  });
  while (authAttempts.size >= LIMITER_CAPACITY) authAttempts.delete(authAttempts.keys().next().value!);
}

export function consumeContainmentLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const current = authAttempts.get(key);
  if (!current || current.resetAt <= now) {
    evictLimiterEntries(now);
    authAttempts.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  current.count += 1;
  return current.count > limit;
}

export function containmentLimiterStats() {
  evictLimiterEntries(Date.now());
  return { size: authAttempts.size, capacity: LIMITER_CAPACITY };
}

export function resetContainmentLimiters(): void {
  if (process.env.NODE_ENV === "production") throw new Error("Limiter reset is unavailable in production");
  authAttempts.clear();
}

function clientAddress(req: Request): string {
  return req.socket.remoteAddress ?? "unknown";
}

function exactOrigin(req: Request): boolean {
  const origin = req.headers.origin;
  return typeof origin === "string" && allowedOrigins().includes(origin);
}

function validCsrf(req: Request): boolean {
  const header = req.headers["x-csrf-token"];
  const cookie = req.cookies?.["XSRF-TOKEN"];
  return typeof header === "string" && header.length >= 32 && header === cookie;
}

const NATIVE_MUTATIONS = new Set(["/api/login", "/api/register", "/api/logout"]);
const PUBLIC_CAPABILITY_MUTATIONS = [/^\/api\/verify-email\/[^/]+$/, /^\/api\/user\/request-reactivation$/];
const YOUTUBE_SEARCH_PATH = "/api/youtube/search";

export function setupNativeSessionContainment(app: Express): void {
  app.use((req, res, next) => {
    const requestId = requestIdFor(req);
    res.setHeader("X-Request-Id", requestId);
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
    if (PUBLIC_CAPABILITY_MUTATIONS.some((pattern) => pattern.test(req.path))) {
      if (consumeContainmentLimit(`capability:${clientAddress(req)}:${req.path.split("/").slice(0, 3).join("/")}`, 20, 60_000)) {
        return sendContainmentError(res, 429, "RATE_LIMITED", requestId);
      }
      return next();
    }
    if (req.method === "POST" && req.path === YOUTUBE_SEARCH_PATH) {
      if (!exactOrigin(req)) return sendContainmentError(res, 403, "ORIGIN_FORBIDDEN", requestId);
      return next();
    }
    const nativeSessionMutation = NATIVE_MUTATIONS.has(req.path) || /(?:^|;\s*)cosmic\.sid=/.test(req.headers.cookie ?? "");
    if (!nativeSessionMutation) return next();
    if (NATIVE_MUTATIONS.has(req.path) && consumeContainmentLimit(`auth:${clientAddress(req)}`, 30, 60_000)) return sendContainmentError(res, 429, "RATE_LIMITED", requestId);
    if (!exactOrigin(req)) return sendContainmentError(res, 403, "ORIGIN_FORBIDDEN", requestId);
    if (!validCsrf(req)) return sendContainmentError(res, 403, "CSRF_INVALID", requestId);
    next();
  });
}

const OWNER_INPUT_KEYS = new Set(["username", "currentUsername", "userId", "ownerId", "documentId", "strapiUser", "accountId"]);

function hasOwnerInput(req: Request): boolean {
  if (req.headers["x-username"] !== undefined) return true;
  if (Object.keys(req.query ?? {}).some((key) => OWNER_INPUT_KEYS.has(key))) return true;
  return !!req.body && typeof req.body === "object" && Object.keys(req.body).some((key) => OWNER_INPUT_KEYS.has(key));
}

function isProtected(path: string): boolean {
  return path === "/api/playlists" ||
    path.startsWith("/api/playlists/") ||
    path.startsWith("/api/user") ||
    path.startsWith("/api/admin") ||
    path.startsWith("/api/subscriptions/") ||
    path.startsWith("/api/payments/") ||
    path.startsWith("/api/youtube/") ||
    path.startsWith("/api/instagram/") ||
    path === "/api/playlist/currently-playing" ||
    path.startsWith("/api/playlist/import-") ||
    path.startsWith("/api/playlist/songs");
}

function isLegacyBareIdRoute(path: string): boolean {
  return /^\/api\/(?:playlists\/[^/]+|subscriptions\/(?:user-plans|song-limits)\/[^/]+|user\/devices\/[^/]+\/terminate)/.test(path);
}

export function setupOwnerContainment(app: Express): void {
  app.use(async (req, res, next) => {
    const requestId = requestIdFor(req);
    res.setHeader("X-Request-Id", requestId);

    if (req.path === "/graphql" || req.path === "/api/strapi/graphql") {
      return sendContainmentError(res, 410, "GRAPHQL_PROXY_REMOVED", requestId);
    }
    if (req.path === "/api/strapi/config" || req.path === "/api/debug/strapi") {
      return sendContainmentError(res, 410, "SERVICE_CREDENTIAL_ROUTE_REMOVED", requestId);
    }

    if (req.path === "/api/playlist/songs" && req.method === "POST" && typeof req.query.guestUrl === "string") {
      if (!/^[A-Za-z0-9_-]{8,128}$/.test(req.query.guestUrl)) return sendContainmentError(res, 400, "AMBIGUOUS_OWNER_INPUT", requestId);
      if (!exactOrigin(req)) return sendContainmentError(res, 403, "ORIGIN_FORBIDDEN", requestId);
      if (consumeContainmentLimit(`guest:${clientAddress(req)}:${req.query.guestUrl}`, 20, 60_000)) return sendContainmentError(res, 429, "RATE_LIMITED", requestId);
      return next();
    }

    const identityRoute = ["/api/auth/sync", "/api/auth/user-data", "/api/auth/onboarding-status"].includes(req.path);
    const publicCapability = req.path === "/api/user/request-reactivation" || req.path === "/api/user/reactivate";
    const protectedRoute = identityRoute || (isProtected(req.path) && !publicCapability);
    if (!protectedRoute) return next();
    if (identityRoute && consumeContainmentLimit(`legacy-identity:${clientAddress(req)}`, 30, 60_000)) {
      return sendContainmentError(res, 429, "RATE_LIMITED", requestId);
    }

    const request = req as RequestWithPrincipal;
    const sessionUser = req.isAuthenticated?.() && req.user ? req.user as any : undefined;
    const authHeader = req.headers.authorization;
    if (sessionUser && authHeader) return sendContainmentError(res, 400, "AMBIGUOUS_CREDENTIALS", requestId);

    if (sessionUser) {
      if (sessionUser.suspendedAt || sessionUser.isSuspended) return sendContainmentError(res, 403, "AUTH_SUSPENDED", requestId);
      request.containmentPrincipal = { kind: "session", userId: Number(sessionUser.id), isAdmin: sessionUser.isAdmin === true };
    } else if (authHeader) {
      const match = /^Bearer ([^\s]+)$/.exec(authHeader);
      if (!match) return sendContainmentError(res, 401, "AUTH_INVALID", requestId);
      try {
        const payload = verifyStrapiToken(match[1]);
        if (payload.suspended === true || payload.blocked === true) return sendContainmentError(res, 403, "AUTH_SUSPENDED", requestId);
        request.containmentPrincipal = { kind: "strapi", externalId: payload.id };
      } catch {
        return sendContainmentError(res, 401, "AUTH_INVALID", requestId);
      }
    } else {
      return sendContainmentError(res, 401, "AUTH_REQUIRED", requestId);
    }

    if (identityRoute) return sendContainmentError(res, 410, "LEGACY_IDENTITY_ROUTE_REMOVED", requestId);
    if (hasOwnerInput(req)) return sendContainmentError(res, 400, "AMBIGUOUS_OWNER_INPUT", requestId);
    if (req.method === "POST" && req.path === YOUTUBE_SEARCH_PATH) {
      if (!exactOrigin(req)) return sendContainmentError(res, 403, "ORIGIN_FORBIDDEN", requestId);
      const body = req.body;
      const bodyKeys = body && typeof body === "object" && !Array.isArray(body) ? Object.keys(body) : [];
      const validKeys = bodyKeys.every((key) => key === "query" || key === "pageToken");
      const validQuery = typeof body?.query === "string" && body.query.trim().length > 0 && body.query.length <= 200;
      const validPageToken = body?.pageToken === undefined || (typeof body.pageToken === "string" && body.pageToken.length <= 512);
      if (!validKeys || !validQuery || !validPageToken) return sendContainmentError(res, 400, "REQUEST_INVALID", requestId);
      const principalKey = request.containmentPrincipal.kind === "session"
        ? `session:${request.containmentPrincipal.userId}`
        : `strapi:${request.containmentPrincipal.externalId}`;
      if (consumeContainmentLimit(`youtube-search:${clientAddress(req)}:${principalKey}`, 30, 60_000)) {
        return sendContainmentError(res, 429, "RATE_LIMITED", requestId);
      }
      return next();
    }
    if (req.path.startsWith("/api/youtube/")) {
      return sendContainmentError(res, 410, "LEGACY_OWNER_ROUTE_REMOVED", requestId);
    }
    if (request.containmentPrincipal.kind === "strapi") return sendContainmentError(res, 410, "LEGACY_OWNER_ROUTE_REMOVED", requestId);
    if (req.path.startsWith("/api/admin") && !request.containmentPrincipal.isAdmin) {
      return sendContainmentError(res, 403, "ADMIN_REQUIRED", requestId);
    }
    if (req.path.startsWith("/api/subscriptions/") || isLegacyBareIdRoute(req.path)) {
      return sendContainmentError(res, 410, "LEGACY_OWNER_ROUTE_REMOVED", requestId);
    }

    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      if (!exactOrigin(req)) return sendContainmentError(res, 403, "ORIGIN_FORBIDDEN", requestId);
      if (!validCsrf(req)) return sendContainmentError(res, 403, "CSRF_INVALID", requestId);
    }
    next();
  });
}

export function assertContainmentStartup(environment: NodeJS.ProcessEnv): void {
  if (environment.NODE_ENV !== "production") return;
  const mandatory = ["DATABASE_URL", "SESSION_SECRET", "COOKIE_SECRET", "STRAPI_JWT_SECRET", "ALLOWED_ORIGINS"] as const;
  for (const name of mandatory) {
    const value = environment[name];
    if (!value || value.length < (name.endsWith("SECRET") ? 32 : 1)) throw new Error(`${name} is a mandatory production credential`);
  }
  const databaseUrl = environment.DATABASE_URL!.toLowerCase();
  if (/cosmic:cosmicpass@|postgres(?:ql)?:\/\/postgres:postgres@|localhost|127\.0\.0\.1/.test(databaseUrl)) {
    throw new Error("DATABASE_URL contains a default or non-production credential");
  }
}

const REDACTED_KEYS = /pass(word)?|secret|token|cookie|authorization|email|otp|verification|user(row)?|guest(url)?|room|capability/i;

function sanitizeLogValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[REDACTED]";
  if (typeof value === "string") {
    return value
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]")
      .replace(/Bearer\s+[^\s"']+/gi, "Bearer [REDACTED]")
      .replace(/("?(?:password|secret|token|cookie|email|otp|guestUrl|room)"?\s*[:=]\s*)"?[^,"}\s]+/gi, "$1[REDACTED]")
      .replace(/\b(room|guestUrl|capability)\s+[A-Za-z0-9_-]{8,}/gi, "$1 [REDACTED]");
  }
  if (Array.isArray(value)) return value.map((entry) => sanitizeLogValue(entry, depth + 1));
  if (value && typeof value === "object") {
    const safe: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) safe[key] = REDACTED_KEYS.test(key) ? "[REDACTED]" : sanitizeLogValue(entry, depth + 1);
    return safe;
  }
  return value;
}

const consoleMarker = Symbol.for("explorers.music.safe-console");

export function installSafeConsole(): void {
  const globalConsole = console as Console & { [consoleMarker]?: boolean };
  if (globalConsole[consoleMarker]) return;
  for (const method of ["log", "info", "warn", "error"] as const) {
    const original = console[method].bind(console);
    console[method] = ((...values: unknown[]) => {
      const sensitiveContext = typeof values[0] === "string" && /\b(user(?:name)?|login|session|cookie|guest|room|capability|authorization)\b/i.test(values[0]);
      const safe = values.map((value, index) => sensitiveContext && index > 0 && ["string", "number"].includes(typeof value)
        ? "[REDACTED]"
        : sanitizeLogValue(value));
      original(...safe);
    }) as typeof console[typeof method];
  }
  globalConsole[consoleMarker] = true;
}

export function containmentErrorHandler(error: any, req: Request, res: Response): void {
  const requestId = requestIdFor(req);
  if (error?.type === "entity.too.large" || error?.status === 413) {
    sendContainmentError(res, 413, "PAYLOAD_TOO_LARGE", requestId);
    return;
  }
  sendContainmentError(res, 500, "INTERNAL_ERROR", requestId);
}
