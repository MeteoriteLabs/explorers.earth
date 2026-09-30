import { createHmac, randomUUID } from "node:crypto";
import pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCanonicalApp } from "../auth/canonicalApp";
import { resolveExplorersAuthConfig } from "../auth/betterAuth";
import { MediaService, MediaUnavailable } from "../application/media";
import type { Actor } from "../application/actor";
import type { ObjectStorage } from "../services/objectStorage";

const config = resolveExplorersAuthConfig({ EXPLORERS_PUBLIC_ORIGIN: "http://127.0.0.1:51474",
  EXPLORERS_AUTH_SECRET: "integration-secret-".repeat(4), GOOGLE_CLIENT_ID: "fixture-google-id", GOOGLE_CLIENT_SECRET: "fixture-google-secret" });
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==", "base64");
let pool: pg.Pool;
let composed: ReturnType<typeof createCanonicalApp>;

async function persona() {
  const userId = `media-${randomUUID()}`;
  await pool.query("INSERT INTO auth_user(id,name,email) VALUES ($1,'Owner',$2)", [userId, `${userId}@example.invalid`]);
  await pool.query("INSERT INTO auth_account(id,account_id,provider_id,user_id,updated_at) VALUES ($1,$2,'google',$3,now())",
    [randomUUID(), `google-${userId}`, userId]);
  const context = await composed.auth.$context;
  const session = await context.internalAdapter.createSession(userId, false);
  const signature = createHmac("sha256", config.secret).update(session.token).digest("base64");
  const cookie = `${context.authCookies.sessionToken.name}=${session.token}.${signature}`;
  const initial = await request(composed.app).get("/api/explorers/v1/me").set("cookie", cookie);
  expect(initial.status).toBe(200);
  return { cookie, userId, accountId: initial.body.account.id as string, revision: initial.body.account.revision as number };
}

async function upload(cookie: string, bytes = png, mime = "image/png", purpose = "profile") {
  return request(composed.app).post("/api/explorers/v1/media").set("cookie", cookie).set("origin", config.baseURL)
    .set("content-type", mime).set("x-media-purpose", purpose).set("x-file-name", "avatar.png").send(bytes);
}

describe("private local media", () => {
  beforeAll(() => { pool = new pg.Pool({ connectionString: process.env.DATABASE_URL_TEST, max: 4 }); composed = createCanonicalApp(pool, config); });
  afterAll(async () => { await pool?.end(); });

  it("denies anonymous upload, spoofed MIME and bytes", async () => {
    expect((await request(composed.app).post("/api/explorers/v1/media").set("origin", config.baseURL).set("content-type", "image/png").send(png)).status).toBe(401);
    const owner = await persona();
    expect((await upload(owner.cookie, Buffer.from("not an image"))).status).toBe(422);
    expect((await upload(owner.cookie, png, "image/jpeg")).status).toBe(422);
  });

  it("keeps detached bytes owner-only and publishes only after live attachment", async () => {
    const owner = await persona();
    const other = await persona();
    const uploaded = await upload(owner.cookie);
    expect(uploaded.status).toBe(201);
    const url = uploaded.body.media.url as string;
    expect((await request(composed.app).get(url)).status).toBe(404);
    expect((await request(composed.app).get(url).set("cookie", other.cookie)).status).toBe(404);
    expect((await request(composed.app).get(url).set("cookie", owner.cookie)).status).toBe(200);
    const attached = await request(composed.app).patch("/api/explorers/v1/account").set("cookie", owner.cookie)
      .set("origin", config.baseURL).send({ expectedRevision: owner.revision, profileImageId: uploaded.body.media.id });
    expect(attached.status).toBe(200);
    expect((await request(composed.app).get(url)).status).toBe(404);
    const head = await request(composed.app).head(url).set("cookie", owner.cookie);
    expect(head.status).toBe(200);
    expect(head.headers["cache-control"]).toBe("no-store");
    const partial = await request(composed.app).get(url).set("cookie", owner.cookie).set("range", "bytes=0-3");
    expect(partial.status).toBe(206);
    expect(partial.headers["content-range"]).toBe(`bytes 0-3/${png.length}`);
    expect(partial.body).toEqual(png.subarray(0, 4));
    const unsatisfiable = await request(composed.app).get(url).set("cookie", owner.cookie).set("range", "bytes=99999-");
    expect(unsatisfiable.status).toBe(416);
    const published = await request(composed.app).patch("/api/explorers/v1/account").set("cookie", owner.cookie)
      .set("origin", config.baseURL).send({ expectedRevision: owner.revision + 1,
        handle: `p${randomUUID().replaceAll("-", "").slice(0, 12)}`, displayName: "Public",
        accountType: "Creator", onboardingStatus: "complete" });
    expect(published.status).toBe(200);
    expect((await request(composed.app).get(url)).status).toBe(200);
    const detached = await request(composed.app).patch("/api/explorers/v1/account").set("cookie", owner.cookie)
      .set("origin", config.baseURL).send({ expectedRevision: owner.revision + 2, profileImageId: null });
    expect(detached.status).toBe(200);
    expect((await request(composed.app).get(url)).status).toBe(404);
    const deleted = await request(composed.app).delete(`/api/explorers/v1/media/${uploaded.body.media.id}`)
      .set("cookie", owner.cookie).set("origin", config.baseURL);
    expect(deleted.status).toBe(204);
    expect((await request(composed.app).get(url).set("cookie", owner.cookie)).status).toBe(404);
  });

  it("rejects wrong-owner attachment and deletion", async () => {
    const owner = await persona();
    const other = await persona();
    const uploaded = await upload(owner.cookie);
    expect(uploaded.status).toBe(201);
    const foreign = await request(composed.app).patch("/api/explorers/v1/account").set("cookie", other.cookie)
      .set("origin", config.baseURL).send({ expectedRevision: other.revision, profileImageId: uploaded.body.media.id });
    expect(foreign.status).toBe(422);
    expect((await request(composed.app).delete(`/api/explorers/v1/media/${uploaded.body.media.id}`).set("cookie", other.cookie).set("origin", config.baseURL)).status).toBe(404);
  });

  it("does not persist metadata on storage failure and removes bytes after metadata failure", async () => {
    const owner = await persona();
    const actor: Actor = { userId: owner.userId, accountId: owner.accountId, role: "owner",
      credential: { kind: "oauth", grantId: "test-only", scopes: ["media:create"] } };
    const input = { purpose: "profile" as const, filename: "avatar.png", mimeType: "image/png",
      length: png.length, bytes: png };
    const before = await pool.query("SELECT count(*)::integer AS count FROM media_assets WHERE account_id=$1", [owner.accountId]);
    const unavailable: ObjectStorage = { environment: "local", put: async () => { throw Error("storage offline"); },
      get: async () => png, delete: async () => undefined };
    await expect(new MediaService(pool, unavailable).createMedia(actor, input, { requestId: "test" }))
      .rejects.toBeInstanceOf(MediaUnavailable);
    const after = await pool.query("SELECT count(*)::integer AS count FROM media_assets WHERE account_id=$1", [owner.accountId]);
    expect(after.rows[0].count).toBe(before.rows[0].count);
    const removed: string[] = [];
    const storage: ObjectStorage = { environment: "local", put: async () => undefined,
      get: async () => png, delete: async (key) => { removed.push(key); } };
    const failingPool = { query: pool.query.bind(pool), connect: async () => { throw Error("metadata offline"); } } as unknown as pg.Pool;
    await expect(new MediaService(failingPool, storage).createMedia(actor, input, { requestId: "test" }))
      .rejects.toThrow("metadata offline");
    expect(removed).toHaveLength(1);
  });
});
