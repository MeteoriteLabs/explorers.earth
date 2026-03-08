import type { Express } from "express";
import type { Server } from "http";
import { ensureLegacyRemainingRoutes } from "./legacyRemainingRoutes";

export function setupPageRoutes(app: Express): Server {
  return ensureLegacyRemainingRoutes(app);
}
