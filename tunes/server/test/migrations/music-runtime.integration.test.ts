import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../app";
import { pool } from "../../db";
import { MusicIdentityRepository } from "../../repositories/musicIdentityRepository";
import { storage } from "../../storage";

const runIntegration = process.env.MUSIC_C3_POSTGRES_TEST === "1";
const describePostgres = runIntegration ? describe.sequential : describe.skip;
const suffix = `runtime_${process.pid}_${Date.now()}`;
const rawTables = [
  "youtube_music_playlists", "youtube_music", "youtube_tokens", "youtube_playlists",
  "widgets", "youtube_api_calls", "playback_states",
] as const;

describePostgres("C3 real migrated runtime graph", () => {
  let app: Awaited<ReturnType<typeof createApp>>["app"];
  let server: Awaited<ReturnType<typeof createApp>>["server"];
  let userId: number;

  beforeAll(async () => {
    process.env.STRAPI_JWT_SECRET = "runtime-strapi-jwt-secret-at-least-thirty-two-bytes";
    process.env.ALLOWED_ORIGINS = "https://explorers.example.test";
    ({ app, server } = await createApp());
    const identity = await new MusicIdentityRepository(pool).createIdentity({
      username: suffix,
      password: "disabled-native-password",
      guestUrl: `${suffix}_guest`,
      venueName: "Runtime Venue",
      strapiUserDocumentId: `${suffix}_person`,
      strapiAccountDocumentId: `${suffix}_account`,
      guestCapabilityHash: "9".repeat(64),
      operationId: `${suffix}_provision`,
    });
    userId = identity.id;
  });

  afterAll(async () => {
    server?.close();
    await pool.query("DROP TRIGGER IF EXISTS runtime_delete_failure ON playback_states").catch(() => undefined);
    await pool.query("DROP FUNCTION IF EXISTS runtime_fail_delete()").catch(() => undefined);
    await pool.query("DELETE FROM users WHERE id=$1", [userId]).catch(() => undefined);
  });

  it("boots the real route graph and returns controlled identity tombstones without inserts or schema errors", async () => {
    const before = Number((await pool.query("SELECT count(*) AS count FROM users")).rows[0].count);
    for (const body of [
      { username: `${suffix}_native`, password: "native-password" },
      {
        username: `${suffix}_forged`, password: "native-password",
        strapiUserDocumentId: "forged-person", strapiAccountDocumentId: "forged-account",
        lifecycleOperationId: "forged-operation", guestCapabilityHash: "a".repeat(64),
      },
    ]) {
      const response = await request(app).post("/api/register").send(body);
      expect(response.status).toBe(410);
      expect(response.body.error?.code).toBe("LEGACY_IDENTITY_ROUTE_REMOVED");
      expect(JSON.stringify(response.body)).not.toMatch(/relation .* does not exist|column .* does not exist|null value in column/i);
    }
    await request(app).post("/graphql").send({ query: "mutation { deleteUsers { documentId } }" })
      .expect(410).expect(({ body }) => expect(body.error?.code).toBe("GRAPHQL_PROXY_REMOVED"));
    await request(app).post("/api/auth/sync").send({ strapiUser: { username: "forged" } })
      .expect(401).expect(({ body }) => expect(body.error?.code).toBe("AUTH_REQUIRED"));
    const after = Number((await pool.query("SELECT count(*) AS count FROM users")).rows[0].count);
    expect(after).toBe(before);
  });

  it("executes queue, playlist, session, SEO, page, email, admin, and settings storage against the migrated schema", async () => {
    const queueInput = (index: number) => ({
      youtubeId: `${suffix}_video_${index}`, title: `Song ${index}`, artist: "Artist",
      thumbnailUrl: "https://example.test/thumbnail.jpg", position: 999,
    });
    const first = await storage.addSong(userId, queueInput(1));
    const second = await storage.addSong(userId, queueInput(2));
    await storage.updateSongPosition(userId, second.id, 0);
    expect((await storage.getSongs(userId)).map(({ id, position }) => [id, position])).toEqual([[second.id, 0], [first.id, 1]]);

    const playlist = await storage.createPlaylist(userId, { name: `${suffix}_playlist`, description: "Runtime", isVisibleToGuests: true });
    await storage.addSongsToPlaylist(playlist.id, [queueInput(3), queueInput(4)]);
    expect((await storage.getPlaylistSongs(playlist.id)).map(({ youtubeId, position }) => [youtubeId, position]))
      .toEqual([[`${suffix}_video_3`, 0], [`${suffix}_video_4`, 1]]);

    await storage.createUserSession(userId, `${suffix}_session`, "127.0.0.1", { family: "runtime" });
    expect(await storage.getUserSessions(userId)).toHaveLength(1);

    const page = await storage.createPageContent({ slug: `${suffix}_page`, title: "Runtime", content: "<p>ready</p>", createdBy: userId, isPublished: true });
    expect((await storage.getPageContentBySlug(page.slug))?.id).toBe(page.id);
    const seo = await storage.updateSeoSettings({ siteTitle: `${suffix} SEO`, updatedBy: userId });
    expect((await storage.getSeoSettings())?.id).toBe(seo.id);
    const template = await storage.createEmailTemplate({
      name: `${suffix}_template`, subject: "Runtime", html_content: "<p>ready</p>", text_content: "ready",
      variables: {}, createdBy: userId, isActive: true,
    });
    const email = await storage.createEmailLog({ recipient: `${suffix}@example.test`, subject: "Runtime", status: "sent", templateId: template.id } as never);
    expect((await storage.getEmailLogsByRecipient(`${suffix}@example.test`)).logs.map(({ id }) => id)).toContain(email.id);
    const setting = await storage.createSystemSetting({ key: `${suffix}_setting`, value: "ready", category: "runtime", isSecret: false, updatedBy: userId });
    expect((await storage.getSystemSetting(setting.key))?.value).toBe("ready");
    const admin = await storage.getAllUsers(1, 1000);
    expect(admin.users.some(({ id }) => id === userId)).toBe(true);
  });

  it("rolls back all seven raw-only deletes on failure, then deletes/cascades them atomically", async () => {
    for (const table of rawTables) await pool.query(`INSERT INTO ${table}(user_id) VALUES ($1)`, [userId]);
    await pool.query(`CREATE FUNCTION runtime_fail_delete() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'runtime injected delete failure'; END; $$`);
    await pool.query(`CREATE TRIGGER runtime_delete_failure BEFORE DELETE ON playback_states
      FOR EACH ROW EXECUTE FUNCTION runtime_fail_delete()`);

    await expect(storage.deleteUser(userId)).rejects.toThrow("runtime injected delete failure");
    for (const table of rawTables) {
      expect(Number((await pool.query(`SELECT count(*) AS count FROM ${table} WHERE user_id=$1`, [userId])).rows[0].count), table).toBe(1);
    }
    expect(Number((await pool.query("SELECT count(*) AS count FROM users WHERE id=$1", [userId])).rows[0].count)).toBe(1);

    await pool.query("DROP TRIGGER runtime_delete_failure ON playback_states");
    await pool.query("DROP FUNCTION runtime_fail_delete()");
    const activeDeletion = await storage.deleteUser(userId);
    expect(activeDeletion.operationId).toMatch(/^storage-delete:[a-f0-9]{64}$/);
    for (const table of rawTables) {
      expect(Number((await pool.query(`SELECT count(*) AS count FROM ${table} WHERE user_id=$1`, [userId])).rows[0].count), table).toBe(0);
    }
    expect(Number((await pool.query("SELECT count(*) AS count FROM users WHERE id=$1", [userId])).rows[0].count)).toBe(0);
    const activeTombstone = (await pool.query(`SELECT lifecycle_operation_id FROM music_identity_tombstones
      WHERE strapi_user_document_id=$1`, [`${suffix}_person`])).rows[0];
    expect(activeTombstone.lifecycle_operation_id).toBe(activeDeletion.operationId);
    expect((await pool.query(`SELECT operation_phase FROM music_identity_lifecycle_operations
      WHERE operation_id=$1`, [activeDeletion.operationId])).rows[0].operation_phase).toBe("finalized");
  });

  it("finalizes and retries one prepared storage deletion saga without partial cleanup on conflict", async () => {
    const identity = await new MusicIdentityRepository(pool).createIdentity({
      username: `${suffix}_saga`, password: "disabled", guestUrl: `${suffix}_saga_guest`, venueName: "Saga Venue",
      strapiUserDocumentId: `${suffix}_saga_person`, strapiAccountDocumentId: `${suffix}_saga_account`,
      guestCapabilityHash: "8".repeat(64), operationId: `${suffix}_saga_provision`,
    });
    for (const table of rawTables) await pool.query(`INSERT INTO ${table}(user_id) VALUES ($1)`, [identity.id]);
    const operationId = `${suffix}_delete_saga`;
    await new MusicIdentityRepository(pool).transitionIdentity({
      strapiUserDocumentId: `${suffix}_saga_person`, operationId, kind: "request_deletion", targetStatus: "pending_deletion",
    });

    await expect(storage.deleteUser(identity.id, `${suffix}_conflict`)).rejects.toMatchObject({ code: "LIFECYCLE_OPERATION_CONFLICT" });
    for (const table of rawTables) {
      expect(Number((await pool.query(`SELECT count(*) AS count FROM ${table} WHERE user_id=$1`, [identity.id])).rows[0].count), table).toBe(1);
    }
    expect(Number((await pool.query("SELECT count(*) AS count FROM users WHERE id=$1", [identity.id])).rows[0].count)).toBe(1);

    await expect(storage.deleteUser(identity.id)).resolves.toMatchObject({ operationId, finalized: true });
    await expect(storage.deleteUser(identity.id, operationId)).resolves.toMatchObject({ operationId, finalized: false });
    expect((await pool.query(`SELECT count(*)::int AS count FROM music_identity_tombstones
      WHERE lifecycle_operation_id=$1`, [operationId])).rows[0].count).toBe(1);
    expect((await pool.query(`SELECT count(*)::int AS count FROM music_identity_lifecycle_operations
      WHERE operation_id=$1 AND operation_phase='finalized'`, [operationId])).rows[0].count).toBe(1);
    for (const table of rawTables) {
      expect(Number((await pool.query(`SELECT count(*) AS count FROM ${table} WHERE user_id=$1`, [identity.id])).rows[0].count), table).toBe(0);
    }
  });
});
