import { createHash } from "node:crypto";
import type { Express } from "express";
import { parsePublicProfileRequest, parsePublicProfileUsername } from "../publicProfile/publicProfileContract";
import type { PublicCategory } from "../publicProfile/publicProfilePolicy";

const notFound = { version: "explorers-public-error/v1", error: { code: "NOT_FOUND" } };
const unavailable = { version: "explorers-public-error/v1", error: { code: "UNAVAILABLE", retryable: true } };

export function setupExplorersPublicProfileRoutes(app: Express, dependencies: { shell?(username: string): Promise<unknown | undefined>; category(username: string, category: PublicCategory, limit: number, options?: { bypassCache?: boolean }): Promise<unknown | undefined> }): void {
  app.get("/api/explorers/v1/profiles/:username", async (req, res) => {
    let username: string;
    try { username = parsePublicProfileUsername(req.params.username); }
    catch { return res.status(404).json(notFound); }
    let value: unknown | undefined;
    try { value = await dependencies.shell?.(username); }
    catch { return res.status(503).json(unavailable); }
    if (!value) return res.status(404).json(notFound);
    return res.status(200).json(value);
  });
  app.get("/api/explorers/v1/profiles/:username/recommendations/:category", async (req, res) => {
    let parsed: { username: string; category: PublicCategory; limit: number };
    try { parsed = parsePublicProfileRequest({ username: req.params.username, category: req.params.category, limit: req.query.limit }); }
    catch { return res.status(404).json(notFound); }
    let value: unknown | undefined;
    try { value = await dependencies.category(parsed.username, parsed.category, parsed.limit, { bypassCache: /(?:^|,)\s*no-cache\s*(?:,|$)/i.test(req.get("cache-control") ?? "") }); }
    catch {
      return res.status(503).json(unavailable);
    }
    if (!value) return res.status(404).json(notFound);
    const etag = `"${createHash("sha256").update(JSON.stringify(value)).digest("base64url")}"`;
    res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=30");
    res.setHeader("ETag", etag);
    if (req.get("if-none-match") === etag) return res.status(304).end();
    return res.status(200).json(value);
  });
}
