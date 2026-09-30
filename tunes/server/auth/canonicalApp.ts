import { randomUUID } from "node:crypto";
import express, { type Express, type Request, type Response } from "express";
import cookieParser from "cookie-parser";
import { fromNodeHeaders, toNodeHandler } from "#auth-runtime";
import type { Pool } from "pg";
import { ensureInitialAccount } from "./initialAccount";
import { createExplorersAuth, type ExplorersAuthConfig } from "./betterAuth";
import { accountDtoSchema, type ApiError } from "../../shared/explorersContract";
import { createRecoveryIntent, recoveryCookieOptions, recoveryIntentCookie, recoveryProofCookie,
  recoveryProofCookieOptions } from "./recoveryCallback";
import { revokeRecoveryProof } from "./recoveryProof";

function errorResponse(res: Response, status: number, code: ApiError["error"]["code"], message: string): void {
  res.status(status).json({ error: { code, message, requestId: randomUUID() } } satisfies ApiError);
}

export function createCanonicalApp(pool: Pool, config: ExplorersAuthConfig): { app: Express; auth: ReturnType<typeof createExplorersAuth> } {
  const app = express();
  const auth = createExplorersAuth(pool, config);

  // Better Auth must consume the original request stream before Express body parsers.
  const authHandler = toNodeHandler(auth);
  app.use("/api/auth", (request, response, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)
        && request.get("origin") !== config.baseURL) {
      return errorResponse(response, 403, "FORBIDDEN", "Auth request origin is not trusted");
    }
    next();
  });
  app.all("/api/auth", authHandler);
  app.all("/api/auth/*splat", authHandler);
  app.use(cookieParser());
  app.use(express.json({ limit: "64kb" }));
  app.get("/health/live", (_request, response) => response.status(200).json({ status: "live" }));

  app.post("/api/explorers/v1/recovery/start", async (request, response) => {
    if (request.get("origin") !== config.baseURL) {
      return errorResponse(response, 403, "FORBIDDEN", "Recovery request origin is not trusted");
    }
    response.clearCookie(recoveryIntentCookie, recoveryCookieOptions(config));
    response.clearCookie(recoveryProofCookie, recoveryProofCookieOptions(config));
    try {
      const previousProof = request.cookies?.[recoveryProofCookie];
      if (typeof previousProof === "string") await revokeRecoveryProof(pool, previousProof);
    } catch {
      return errorResponse(response, 503, "FORBIDDEN", "Recovery service is unavailable");
    }
    response.cookie(recoveryIntentCookie, createRecoveryIntent(config.secret), {
      ...recoveryCookieOptions(config), maxAge: 300_000,
    });
    response.status(204).end();
  });

  app.get("/api/explorers/v1/me", async (request: Request, response: Response) => {
    try {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      if (!session?.user?.id) return errorResponse(response, 401, "UNAUTHENTICATED", "Sign in is required");
      const userId = session.user.id;
      const provider = await pool.query<{ exists: boolean }>(
        "SELECT EXISTS(SELECT 1 FROM auth_account WHERE user_id=$1 AND provider_id='google') AS exists", [userId],
      );
      if (!provider.rows[0]?.exists) return errorResponse(response, 403, "FORBIDDEN", "Google identity is required");
      const security = await pool.query<{ blocked_at: Date | null }>(
        "SELECT blocked_at FROM user_security_state WHERE user_id=$1", [userId],
      );
      if (security.rows[0]?.blocked_at) return errorResponse(response, 403, "FORBIDDEN", "Account access is unavailable");
      const existing = await pool.query<{ status: string }>(`SELECT a.status FROM initial_account_bindings b
        JOIN creator_accounts a ON a.id=b.account_id WHERE b.user_id=$1`, [userId]);
      if (existing.rows[0] && existing.rows[0].status !== "active") {
        return errorResponse(response, 403, "FORBIDDEN", "Account access is unavailable");
      }
      const { accountId } = await ensureInitialAccount(pool, userId);
      const result = await pool.query<{
        id: string; handle: string | null; display_name: string | null; account_type: string | null;
        onboarding_status: string; status: string; revision: string;
      }>(`SELECT id,handle,display_name,account_type,onboarding_status,status,revision::text
        FROM creator_accounts WHERE id=$1`, [accountId]);
      const account = result.rows[0];
      if (!account || account.status !== "active") return errorResponse(response, 403, "FORBIDDEN", "Account access is unavailable");
      response.json({ account: accountDtoSchema.parse({
        id: account.id,
        handle: account.handle,
        displayName: account.display_name,
        accountType: account.account_type,
        onboardingStatus: account.onboarding_status,
        status: account.status,
        revision: Number(account.revision),
      }) });
    } catch {
      errorResponse(response, 503, "FORBIDDEN", "Account service is unavailable");
    }
  });

  return { app, auth };
}
