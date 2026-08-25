import type { NextFunction, Request, Response } from "express";
import { requestIdFor, sendContainmentError, verifyStrapiToken } from "./security-containment";

type ContainmentRequest = Request & { jwtAuthenticated?: boolean; strapiUserId?: number };

/**
 * Verify a Strapi bearer at the identity boundary. It deliberately does not map
 * a mutable username (header/query/body) to a Music owner. That projection is a
 * later gateway concern; contained legacy owner routes fail closed meanwhile.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const requestId = requestIdFor(req);
  const sessionAuthenticated = !!(req.isAuthenticated?.() && req.user);
  const authHeader = req.headers.authorization;
  if (sessionAuthenticated && authHeader) return sendContainmentError(res, 400, "AMBIGUOUS_CREDENTIALS", requestId);
  if (sessionAuthenticated) return next();
  const match = typeof authHeader === "string" ? /^Bearer ([^\s]+)$/.exec(authHeader) : null;
  if (!match) return sendContainmentError(res, 401, "AUTH_REQUIRED", requestId);
  try {
    const payload = verifyStrapiToken(match[1]);
    if (payload.suspended === true || payload.blocked === true) {
      return sendContainmentError(res, 403, "AUTH_SUSPENDED", requestId);
    }
    const request = req as ContainmentRequest;
    request.jwtAuthenticated = true;
    request.strapiUserId = payload.id;
    next();
  } catch {
    return sendContainmentError(res, 401, "AUTH_INVALID", requestId);
  }
}

export function requireAnyAuth(req: Request, res: Response, next: NextFunction) {
  void requireAuth(req, res, next);
}
