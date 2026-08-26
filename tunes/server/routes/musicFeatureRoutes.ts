import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import { MusicPrincipalError, resolveMusicPrincipalRequest, type MusicPrincipal } from "../middleware/musicPrincipal";
import type { MusicFeatureExposure } from "../services/musicFeatureDecisionService";

export function setupMusicFeatureRoutes(app: Express, dependencies: {
  resolvePrincipal(token: string): Promise<MusicPrincipal>;
  decide(principal: MusicPrincipal): MusicFeatureExposure;
  requestIdFactory?: () => string;
}): void {
  app.get("/api/music/features", async (req: Request, res: Response) => {
    const requestId = dependencies.requestIdFactory?.() ?? randomUUID();
    res.setHeader("X-Request-Id", requestId);
    let principal: MusicPrincipal;
    try {
      principal = await resolveMusicPrincipalRequest(req, dependencies.resolvePrincipal);
    } catch (cause) {
      const failure = cause instanceof MusicPrincipalError ? cause : new MusicPrincipalError("TOKEN_INVALID", 401, "A valid Music credential is required.");
      res.status(failure.status).json({ version: "music-error/v1", error: { code: failure.code, message: failure.message, action: failure.status === 403 ? "contact_support" : "sign_in", retryable: false, requestId } });
      return;
    }
    try {
      res.status(200).json(dependencies.decide(principal));
    } catch {
      res.setHeader("Retry-After", "1");
      res.status(503).json({ version: "music-error/v1", error: { code: "SERVICE_UNAVAILABLE", message: "Music features are temporarily unavailable.", action: "retry", retryable: true, requestId } });
    }
  });
}
