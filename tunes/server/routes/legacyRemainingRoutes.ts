import type { Express } from "express";
import type { Server } from "http";
import { setupLegacyRemainingRoutes } from "../legacy-routes";

const legacyServers = new WeakMap<Express, Server>();

export function ensureLegacyRemainingRoutes(app: Express): Server {
  const existingServer = legacyServers.get(app);
  if (existingServer) {
    return existingServer;
  }

  const server = setupLegacyRemainingRoutes(app);
  legacyServers.set(app, server);
  return server;
}
