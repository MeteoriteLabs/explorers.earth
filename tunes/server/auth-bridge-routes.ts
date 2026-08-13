import type { Express } from "express";
import { requestIdFor, sendContainmentError } from "./security-containment";

/**
 * The browser-controlled identity bridge is intentionally retained only as a
 * fail-closed tombstone for old clients. There is no body-controlled owner
 * compatibility path. C4's bodyless ensure endpoint is registered separately
 * and this tombstone remains for old clients.
 */
export function setupAuthBridgeRoutes(app: Express) {
  const removed = (req: any, res: any) =>
    sendContainmentError(res, 410, "LEGACY_IDENTITY_ROUTE_REMOVED", requestIdFor(req));

  app.post("/api/auth/sync", removed);
  app.get("/api/auth/user-data", removed);
  app.get("/api/auth/onboarding-status", removed);
}
