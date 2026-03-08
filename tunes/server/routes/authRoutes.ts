import type { Express } from "express";
import { setupAuth } from "../auth";

export function setupAuthRoutes(app: Express): void {
  setupAuth(app);
}
