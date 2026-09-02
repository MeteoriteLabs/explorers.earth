import { createHash } from "node:crypto";
import type { Express } from "express";
import { parsePublicCategory } from "../publicProfile/publicProfilePolicy";

export function setupExplorersPublicProfileRoutes(app: Express, dependencies: { shell?(username: string): Promise<unknown | undefined>; category(username: string, category: ReturnType<typeof parsePublicCategory>, limit: number): Promise<unknown | undefined> }): void {
  app.get("/api/explorers/v1/profiles/:username", async (req, res) => {
    const value = await dependencies.shell?.(req.params.username);
    if (!value) return res.status(404).json({ version: "explorers-public-error/v1", error: { code: "NOT_FOUND" } });
    return res.status(200).json(value);
  });
  app.get("/api/explorers/v1/profiles/:username/recommendations/:category", async (req, res) => {
    let category: ReturnType<typeof parsePublicCategory>;
    try { category = parsePublicCategory(req.params.category); }
    catch { return res.status(404).json({ version: "explorers-public-error/v1", error: { code: "NOT_FOUND" } }); }
    let value: unknown | undefined;
    try { value = await dependencies.category(req.params.username, category, 12); }
    catch {
      return res.status(503).json({ version: "explorers-public-error/v1", error: { code: "UNAVAILABLE", retryable: true } });
    }
    if (!value) return res.status(404).json({ version: "explorers-public-error/v1", error: { code: "NOT_FOUND" } });
    const etag = `"${createHash("sha256").update(JSON.stringify(value)).digest("base64url")}"`;
    res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=30");
    res.setHeader("ETag", etag);
    if (req.get("if-none-match") === etag) return res.status(304).end();
    return res.status(200).json(value);
  });
}
