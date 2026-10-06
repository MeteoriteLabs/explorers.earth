import { randomUUID } from "node:crypto";
import type { Express } from "express";
import type { Pool } from "pg";
import type { ExplorersAuth, ExplorersAuthConfig } from "../auth/betterAuth";
import { requireActor, sendActorError } from "../middleware/explorersPrincipal";
import { AuthorizationError } from "../application/authorization";
import type { AccountMusicRepository } from "../music/accountMusicRepository";
import type { CanonicalMusicCredentialSubjectState } from "../middleware/musicPrincipal";
import type { MintedMusicToken } from "../services/musicTokenService";

export interface ExplorersMusicIdentityDependencies {
  pool: Pool;
  auth: ExplorersAuth;
  config: ExplorersAuthConfig;
  accounts: AccountMusicRepository;
  resolveCanonicalSubject(accountId: string): Promise<CanonicalMusicCredentialSubjectState>;
  mintCanonical(input: { accountId: string; musicUserId: number; sessionVersion: number }): MintedMusicToken;
}

/**
 * ADR-006 and ADR-008. Canonical Music owner provisioning: the subject comes from the
 * server-side Actor carried by the session cookie, so the request has no body, no
 * bearer and no client-supplied account identifier. There is no Strapi proof exchange.
 */
export function setupExplorersMusicIdentityRoutes(
  app: Express,
  dependencies: ExplorersMusicIdentityDependencies,
): void {
  const { pool, auth, config, accounts } = dependencies;
  app.post("/api/explorers/v1/music/identity/ensure", async (request, response) => {
    if (request.get("origin") !== config.baseURL) {
      return response.status(403).json({
        error: { code: "FORBIDDEN", message: "Origin is not trusted", requestId: randomUUID() },
      });
    }
    try {
      const actor = await requireActor(request, auth, pool);
      // Provisioning is idempotent on account_music_identity's primary key, so a
      // repeated ensure returns the same venue rather than creating a second one.
      const ensured = await accounts.ensureMusicAccount(actor);
      // Re-read rather than trust the write: the credential's session version must be
      // the venue's own counter, because that is what credential revocation bumps.
      const state = await dependencies.resolveCanonicalSubject(ensured.accountId);
      const venue = state.venue;
      if (!venue || state.tombstoned) {
        throw new AuthorizationError(404, "NOT_FOUND", "Music account is unavailable");
      }
      if (venue.identityStatus === "suspended") {
        throw new AuthorizationError(403, "FORBIDDEN", "This Music identity is suspended");
      }
      if (venue.identityStatus === "pending_deletion") {
        throw new AuthorizationError(403, "FORBIDDEN", "This Music identity is pending deletion");
      }
      const credential = dependencies.mintCanonical({
        accountId: ensured.accountId,
        musicUserId: venue.musicUserId,
        sessionVersion: venue.sessionVersion,
      });
      return response.status(200).json({
        version: "music-identity/v1",
        identity: { musicUserId: venue.musicUserId, status: "active" },
        credential,
      });
    } catch (error) {
      // AuthorizationError keeps its status; anything else surfaces as 503 without
      // leaking internals, which the client treats as temporarily unavailable.
      return sendActorError(request, response, error);
    }
  });
}
