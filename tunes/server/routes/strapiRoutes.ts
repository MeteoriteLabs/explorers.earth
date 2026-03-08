import type { Express } from "express";
import type { Server } from "http";
import { ensureLegacyRemainingRoutes } from "./legacyRemainingRoutes";

export function setupStrapiRoutes(app: Express): Server {
  return ensureLegacyRemainingRoutes(app);
}
