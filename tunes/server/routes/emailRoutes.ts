import type { Express } from "express";
import type { Server } from "http";
import { ensureLegacyRemainingRoutes } from "./legacyRemainingRoutes";

export function setupEmailRoutes(app: Express): Server {
  return ensureLegacyRemainingRoutes(app);
}
