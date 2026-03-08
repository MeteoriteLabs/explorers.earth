import type { Express } from "express";
import type { Server } from "http";
import { ensureLegacyRemainingRoutes } from "./legacyRemainingRoutes";

export function setupAdminRoutes(app: Express): Server {
  return ensureLegacyRemainingRoutes(app);
}