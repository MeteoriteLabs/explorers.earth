import type { Express } from "express";
import type { Server } from "node:http";
import { parseMusicEnvironment } from "./music-environment";
import {
  resolveMusicIdentityRuntimeConfig,
  type MusicIdentityConfigDependencies,
  type MusicIdentityRuntimeConfig,
} from "./music-identity-config";

type Environment = Record<string, string | undefined>;

export interface MusicServerRuntime {
  createApp: (config: MusicIdentityRuntimeConfig) => Promise<{ app: Express; server: Server }>;
  setupVite: (app: Express, server: Server) => Promise<void>;
  serveStatic: (app: Express) => void;
}

export interface MusicStartupDependencies extends MusicIdentityConfigDependencies {
  loadRuntime?: () => Promise<MusicServerRuntime>;
  host?: string;
  port?: number;
}

async function loadProductionRuntime(): Promise<MusicServerRuntime> {
  const [{ createApp }, { setupVite, serveStatic }] = await Promise.all([
    import("../app"),
    import("../vite"),
  ]);
  return { createApp, setupVite, serveStatic };
}

/** The only startup discriminator. No routes, storage, or listener are loaded before it succeeds. */
export async function validateMusicStartupEnvironment(
  environment: Environment,
  dependencies: MusicIdentityConfigDependencies = {},
): Promise<MusicIdentityRuntimeConfig> {
  if (environment.MUSIC_MODE === "fixture") parseMusicEnvironment(environment);
  else if (environment.MUSIC_MODE !== "live") throw new Error("MUSIC_MODE must be live or fixture");
  return resolveMusicIdentityRuntimeConfig(environment, dependencies);
}

export async function createValidatedApp(
  environment: Environment = process.env,
  dependencies: MusicStartupDependencies = {},
): Promise<{ app: Express; server: Server }> {
  const config = await validateMusicStartupEnvironment(environment, dependencies);
  const runtime = await (dependencies.loadRuntime ?? loadProductionRuntime)();
  return runtime.createApp(config);
}

export async function startMusicServer(
  environment: Environment,
  dependencies: MusicStartupDependencies = {},
): Promise<{ app: Express; server: Server; config: MusicIdentityRuntimeConfig }> {
  const config = await validateMusicStartupEnvironment(environment, dependencies);
  const runtime = await (dependencies.loadRuntime ?? loadProductionRuntime)();
  const { app, server } = await runtime.createApp(config);
  if (app.get("env") === "development") await runtime.setupVite(app, server);
  else runtime.serveStatic(app);

  const port = dependencies.port ?? Number.parseInt(environment.PORT ?? "5000", 10);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) throw new Error("PORT must be a valid TCP port");
  const host = dependencies.host ?? "0.0.0.0";
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => reject(error);
    server.once("error", onError);
    server.listen(port, host, () => {
      server.off("error", onError);
      resolve();
    });
  });
  return { app, server, config };
}
