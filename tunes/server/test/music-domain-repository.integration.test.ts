import { createHash } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrateMusicDatabase } from "../db/migrate";
import { createGuestCapability, hashGuestCapability } from "../policies/musicSurfacePolicy";
import { MusicDomainRepository } from "../repositories/musicDomainRepository";
import { MusicIdentityRepository, type EnsureMusicIdentityInput } from "../repositories/musicIdentityRepository";

const exactTarget = process.env.DATABASE_URL_TEST ?? "postgresql://music_migrator:music@127.0.0.1:55432/music_fixture";
const enabled = process.env.MUSIC_C6_POSTGRES_TEST === "1";
const describePg = enabled ? describe.sequential : describe.skip;
const databaseName = `music_c6_domains_${process.pid}`;
let admin: pg.Pool;
let pool: pg.Pool;
let domain: MusicDomainRepository;
let identities: MusicIdentityRepository;

function identityInput(suffix: string): EnsureMusicIdentityInput {
  return {
    userDocumentId: `c6-user-${suffix}`,
    accountDocumentId: `c6-account-${suffix}`,
    username: `c6-${suffix}`,
    email: `c6-${suffix}@example.invalid`,
    provider: "local",
    accountName: `C6 ${suffix}`,
    accountType: "Venue",
    accountMobile: "+15555550100",
    internalUsername: `c6-internal-${suffix}`,
    password: `disabled-${suffix}`,
    guestUrl: `c6-public-${suffix}`,
    guestCapabilityHash: createHash("sha256").update(`initial-${suffix}`).digest("hex"),
    operationId: `c6-provision-${suffix}`,
    requestId: `c6-request-${suffix}`,
  };
}

describePg("C6 owner predicates on real PostgreSQL 15", () => {
  beforeAll(async () => {
    admin = new pg.Pool({ connectionString: exactTarget });
    expect((await admin.query("SHOW server_version")).rows[0].server_version).toMatch(/^15\./);
    await admin.query(`CREATE DATABASE ${databaseName}`);
    const target = new URL(exactTarget);
    target.pathname = `/${databaseName}`;
    pool = new pg.Pool({ connectionString: target.toString(), max: 8 });
    await migrateMusicDatabase(pool);
    domain = new MusicDomainRepository(pool);
    identities = new MusicIdentityRepository(pool);
  });

  afterAll(async () => {
    await pool?.end();
    await admin?.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()", [databaseName]);
    await admin?.query(`DROP DATABASE IF EXISTS ${databaseName}`);
    await admin?.end();
  });

  it("isolates playlist and queue read/update/delete families between A and B", async () => {
    // Break caught: a known playlist/song ID bypasses a missing owner predicate on real PostgreSQL.
    const a = await identities.ensureIdentity(identityInput("a"));
    const b = await identities.ensureIdentity(identityInput("b"));
    const bPlaylist = await domain.createPlaylist(b.id, { name: "B private", description: null }) as { id: number };
    expect(await domain.getPlaylist(a.id, bPlaylist.id)).toBeUndefined();
    expect(await domain.updatePlaylist(a.id, bPlaylist.id, { name: "stolen", description: null })).toBeUndefined();
    expect(await domain.deletePlaylist(a.id, bPlaylist.id)).toBe(false);
    expect((await domain.getPlaylist(b.id, bPlaylist.id) as { name: string }).name).toBe("B private");

    const bPlaylistSong = await domain.addPlaylistSong(b.id, bPlaylist.id, { youtubeId: "saved-b", title: "B saved", artist: "B", thumbnailUrl: "https://img/saved-b" }) as { id: number };
    expect(await domain.listPlaylists(a.id)).toEqual([]);
    expect(await domain.listPlaylists(b.id)).toEqual([
      expect.objectContaining({ id: bPlaylist.id, songs: [expect.objectContaining({ id: bPlaylistSong.id, youtubeId: "saved-b" })] }),
    ]);
    expect(await domain.removePlaylistSong(a.id, bPlaylist.id, bPlaylistSong.id)).toBe(false);
    expect(await domain.reorderPlaylistSong(a.id, bPlaylist.id, bPlaylistSong.id, 8)).toBe(false);
    expect(await domain.setPlaylistVisibility(a.id, bPlaylist.id, true)).toBe(false);
    expect((await pool.query("SELECT position FROM playlist_songs WHERE id=$1", [bPlaylistSong.id])).rows[0].position).toBe(0);
    expect((await pool.query("SELECT is_visible_to_guests FROM playlists WHERE id=$1", [bPlaylist.id])).rows[0].is_visible_to_guests).toBe(false);

    const bSong = await domain.addSong(b.id, { youtubeId: "b-yt", title: "B song", artist: "B", thumbnailUrl: "https://img/b" }) as { id: number };
    expect(await domain.setPlaying(a.id, bSong.id)).toBeUndefined();
    expect(await domain.updateSongPosition(a.id, bSong.id, 44)).toBeUndefined();
    expect(await domain.removeSong(a.id, bSong.id)).toBe(false);
    expect(await domain.removeSongs(a.id, [bSong.id])).toBe(0);
    await pool.query("UPDATE songs SET status='played' WHERE id=$1", [bSong.id]);
    expect(await domain.clearHistory(a.id)).toBe(0);
    expect(await domain.listQueue(a.id)).toEqual([]);
    expect(await domain.listQueue(b.id)).toEqual([expect.objectContaining({ id: bSong.id, user_id: b.id, status: "played" })]);

    const aSong = await domain.addSong(a.id, { youtubeId: "a-yt", title: "A song", artist: "A", thumbnailUrl: "https://img/a" }) as { id: number };
    await domain.setPlaying(a.id, aSong.id);
    await domain.setPlaying(a.id, null);
    expect(await domain.listQueue(a.id)).toEqual([expect.objectContaining({ id: aSong.id, status: "played" })]);
    expect(await domain.listQueue(b.id)).toEqual([expect.objectContaining({ id: bSong.id, status: "played" })]);
    expect(await domain.ownerDashboard(a.id)).toEqual({ songs: [], currentlyPlaying: undefined, playedSongs: [expect.objectContaining({ id: aSong.id, userId: a.id })], publication: expect.objectContaining({ mode: "unlisted", publicSlug: "c6-public-a" }) });
    expect(await domain.ownerDashboard(b.id)).toEqual({ songs: [], currentlyPlaying: undefined, playedSongs: [expect.objectContaining({ id: bSong.id, userId: b.id })], publication: expect.objectContaining({ mode: "unlisted", publicSlug: "c6-public-b" }) });
  });

  it("isolates entitlement, publication, capability rotation, and guest resolution", async () => {
    // Break caught: owner A can rotate/publish B or a revoked/private resource becomes discoverable.
    const a = await identities.ensureIdentity(identityInput("cap-a"));
    const b = await identities.ensureIdentity(identityInput("cap-b"));
    await pool.query("UPDATE users SET entitlement_state='entitled',entitlement_version=1,entitlement_source_updated_at=now() WHERE id=$1", [b.id]);
    expect(await domain.resolveEntitlement(a.id)).toMatchObject({ state: "unknown" });
    expect(await domain.resolveEntitlement(b.id)).toMatchObject({ state: "entitled", sourceUpdatedAt: expect.any(Date) });

    const bCapability = createGuestCapability();
    await domain.rotateGuestCapability(b.id, hashGuestCapability(bCapability));
    await domain.setDiscoverable(a.id, true);
    expect((await pool.query("SELECT guest_discoverable FROM users WHERE id=$1", [b.id])).rows[0].guest_discoverable).toBe(false);
    expect(await domain.resolveGuestResource("c6-public-cap-b", bCapability)).toMatchObject({ state: "unlisted", noindex: true });
    expect(await domain.resolveGuestResource("not-b", bCapability)).toBeUndefined();
    expect(await domain.resolveGuestResource(bCapability)).toBeUndefined();

    const bPlaylist = await domain.createPlaylist(b.id, { name: "B guest", description: null }) as { id: number };
    const saved = await domain.addPlaylistSong(b.id, bPlaylist.id, { youtubeId: "saved-public", title: "Saved public", artist: "B", thumbnailUrl: "https://img/saved-public" }) as { id: number };
    const queued = await domain.addSong(b.id, { youtubeId: "queued-public", title: "Queued public", artist: "B", thumbnailUrl: "https://img/queued-public" }) as { id: number };
    await domain.setPlaying(b.id, queued.id);
    await pool.query("UPDATE playlists SET is_visible_to_guests=true WHERE id=$1", [bPlaylist.id]);
    await pool.query("UPDATE users SET allow_playlist_sharing=true WHERE id=$1", [b.id]);
    expect(await domain.resolveGuestResource("c6-public-cap-b", bCapability)).toMatchObject({ state: "unlisted", noindex: true });
    await domain.setDiscoverable(b.id, true);
    expect(await domain.resolveGuestResource("c6-public-cap-b")).toMatchObject({
      state: "public",
      noindex: false,
      playlist: {
        songs: [expect.objectContaining({ id: queued.id, youtubeId: "queued-public" })],
        currentlyPlaying: expect.objectContaining({ id: queued.id, youtubeId: "queued-public" }),
        user: expect.objectContaining({ id: b.id, username: "c6-internal-cap-b", venueName: "C6 cap-b" }),
        playlists: [expect.objectContaining({ id: bPlaylist.id, songs: [expect.objectContaining({ id: saved.id, youtubeId: "saved-public" })] })],
      },
    });
    await domain.revokeGuestCapability(b.id);
    expect(await domain.resolveGuestResource("c6-public-cap-b", bCapability)).toMatchObject({ state: "revoked" });
    expect(await domain.resolveGuestResource("c6-public-cap-b")).toBeUndefined();
  });

  it("binds guest request capability and public slug in one owner-predicated query", async () => {
    // Break caught: capability A plus slug B selected either owner before the queue mutation.
    const a = await identities.ensureIdentity(identityInput("request-a"));
    const b = await identities.ensureIdentity(identityInput("request-b"));
    const capabilityA = createGuestCapability();
    const capabilityB = createGuestCapability();
    await domain.rotateGuestCapability(a.id, hashGuestCapability(capabilityA));
    await domain.rotateGuestCapability(b.id, hashGuestCapability(capabilityB));
    await pool.query("UPDATE users SET allow_song_requests=true WHERE id=ANY($1::integer[])", [[a.id, b.id]]);

    const crossOwner = await domain.resolveGuestRequestAuthority("c6-public-request-b", capabilityA);
    expect(crossOwner).toBeUndefined();
    expect((await pool.query("SELECT count(*)::int AS count FROM songs WHERE user_id=ANY($1::integer[])", [[a.id, b.id]])).rows[0].count).toBe(0);

    const sameOwner = await domain.resolveGuestRequestAuthority("c6-public-request-a", capabilityA);
    expect(sameOwner).toEqual({ musicUserId: a.id, active: true, allowSongRequests: true });
    await domain.addSong(sameOwner!.musicUserId, {
      youtubeId: "request-a-song", title: "A request", artist: "A", thumbnailUrl: "https://img/request-a",
    });
    expect((await pool.query("SELECT user_id,youtube_id FROM songs WHERE user_id=ANY($1::integer[]) ORDER BY user_id", [[a.id, b.id]])).rows)
      .toEqual([{ user_id: a.id, youtube_id: "request-a-song" }]);
  });

  it("serializes concurrent queue, saved-song, and playback mutations per owner", async () => {
    // Break caught: MAX(position)+1 races produce duplicates and competing setPlaying calls leave two playing rows.
    const a = await identities.ensureIdentity(identityInput("concurrent-a"));
    const b = await identities.ensureIdentity(identityInput("concurrent-b"));
    const playlistA = await domain.createPlaylist(a.id, { name: "A concurrent", description: null }) as { id: number };

    await Promise.all(Array.from({ length: 16 }, (_, index) => domain.addSong(a.id, {
      youtubeId: `queue-${index}`, title: `Queue ${index}`, artist: "A", thumbnailUrl: `https://img/queue-${index}`,
    })));
    const queue = (await pool.query(
      "SELECT id,position FROM songs WHERE user_id=$1 ORDER BY position,id",
      [a.id],
    )).rows as Array<{ id: number; position: number }>;
    expect(queue.map(({ position }) => position)).toEqual(Array.from({ length: 16 }, (_, index) => index));
    expect(new Set(queue.map(({ position }) => position)).size).toBe(16);

    await Promise.all(Array.from({ length: 16 }, (_, index) => domain.addPlaylistSong(a.id, playlistA.id, {
      youtubeId: `saved-${index}`, title: `Saved ${index}`, artist: "A", thumbnailUrl: `https://img/saved-${index}`,
    })));
    const savedPositions = (await pool.query(
      "SELECT position FROM playlist_songs WHERE playlist_id=$1 ORDER BY position,id",
      [playlistA.id],
    )).rows.map(({ position }) => position);
    expect(savedPositions).toEqual(Array.from({ length: 16 }, (_, index) => index));
    expect(new Set(savedPositions).size).toBe(16);

    const bSong = await domain.addSong(b.id, {
      youtubeId: "queue-b", title: "Queue B", artist: "B", thumbnailUrl: "https://img/queue-b",
    }) as { id: number };
    await Promise.all([
      ...queue.map(({ id }) => domain.setPlaying(a.id, id)),
      domain.setPlaying(b.id, bSong.id),
    ]);
    expect((await pool.query("SELECT count(*)::int AS count FROM songs WHERE user_id=$1 AND status='playing'", [a.id])).rows[0].count).toBe(1);
    expect((await pool.query("SELECT count(*)::int AS count FROM songs WHERE user_id=$1 AND status='playing'", [b.id])).rows[0].count).toBe(1);
  });

  it("normalizes active queue and saved-playlist positions through playback and competing reorders", async () => {
    // Break caught: playing rows are omitted from MAX(position), and reorder writes duplicate occupied positions without locks.
    const a = await identities.ensureIdentity(identityInput("reorder-a"));
    const b = await identities.ensureIdentity(identityInput("reorder-b"));
    const only = await domain.addSong(a.id, {
      youtubeId: "only", title: "Only", artist: "A", thumbnailUrl: "https://img/only",
    }) as { id: number };
    await domain.setPlaying(a.id, only.id);
    await Promise.all(Array.from({ length: 4 }, (_, index) => domain.addSong(a.id, {
      youtubeId: `after-playing-${index}`, title: `After ${index}`, artist: "A", thumbnailUrl: `https://img/after-${index}`,
    })));
    const activeBeforeReorder = (await pool.query(
      "SELECT id,position,status FROM songs WHERE user_id=$1 AND status IN ('queued','playing') ORDER BY position,id",
      [a.id],
    )).rows as Array<{ id: number; position: number; status: string }>;
    expect(activeBeforeReorder.map(({ position }) => position)).toEqual([0, 1, 2, 3, 4]);
    expect(activeBeforeReorder.filter(({ status }) => status === "playing")).toHaveLength(1);

    const queued = activeBeforeReorder.filter(({ status }) => status === "queued");
    await Promise.all([
      domain.updateSongPosition(a.id, queued[2].id, 0),
      domain.updateSongPosition(a.id, queued[3].id, 0),
    ]);
    const activeAfterReorder = (await pool.query(
      "SELECT position,status FROM songs WHERE user_id=$1 AND status IN ('queued','playing') ORDER BY position,id",
      [a.id],
    )).rows as Array<{ position: number; status: string }>;
    expect(activeAfterReorder.map(({ position }) => position)).toEqual([0, 1, 2, 3, 4]);
    expect(new Set(activeAfterReorder.map(({ position }) => position)).size).toBe(5);
    expect(activeAfterReorder.filter(({ status }) => status === "playing")).toHaveLength(1);

    const playlistA = await domain.createPlaylist(a.id, { name: "A reorder", description: null }) as { id: number };
    const saved = await Promise.all(Array.from({ length: 4 }, (_, index) => domain.addPlaylistSong(a.id, playlistA.id, {
      youtubeId: `saved-reorder-${index}`, title: `Saved reorder ${index}`, artist: "A", thumbnailUrl: `https://img/saved-reorder-${index}`,
    }))) as Array<{ id: number }>;
    await Promise.all([
      domain.reorderPlaylistSong(a.id, playlistA.id, saved[2].id, 1),
      domain.reorderPlaylistSong(a.id, playlistA.id, saved[3].id, 1),
    ]);
    const savedAfterReorder = (await pool.query(
      "SELECT position FROM playlist_songs WHERE playlist_id=$1 ORDER BY position,id",
      [playlistA.id],
    )).rows.map(({ position }) => position);
    expect(savedAfterReorder).toEqual([0, 1, 2, 3]);
    expect(new Set(savedAfterReorder).size).toBe(4);

    const bSong = await domain.addSong(b.id, { youtubeId: "b-stable", title: "B stable", artist: "B", thumbnailUrl: "https://img/b-stable" }) as { id: number };
    const bPlaylist = await domain.createPlaylist(b.id, { name: "B stable", description: null }) as { id: number };
    const bSaved = await domain.addPlaylistSong(b.id, bPlaylist.id, { youtubeId: "b-saved", title: "B saved", artist: "B", thumbnailUrl: "https://img/b-saved" }) as { id: number };
    expect(await domain.updateSongPosition(a.id, bSong.id, 0)).toBeUndefined();
    expect(await domain.reorderPlaylistSong(a.id, bPlaylist.id, bSaved.id, 0)).toBe(false);
    expect((await pool.query("SELECT position FROM songs WHERE id=$1", [bSong.id])).rows[0].position).toBe(0);
    expect((await pool.query("SELECT position FROM playlist_songs WHERE id=$1", [bSaved.id])).rows[0].position).toBe(0);
  });

  it("normalizes every history replay, stop, and competing playback transition without crossing owners", async () => {
    // Break caught: replaying a historical row restores its stale occupied position and null stop leaves active gaps.
    const ownerA = await identities.ensureIdentity(identityInput("replay-a"));
    const ownerB = await identities.ensureIdentity(identityInput("replay-b-owner"));
    const songA = await domain.addSong(ownerA.id, {
      youtubeId: "replay-a", title: "Replay A", artist: "A", thumbnailUrl: "https://img/replay-a",
    }) as { id: number };
    const songB = await domain.addSong(ownerA.id, {
      youtubeId: "replay-b", title: "Replay B", artist: "A", thumbnailUrl: "https://img/replay-b",
    }) as { id: number };
    const songC = await domain.addSong(ownerA.id, {
      youtubeId: "replay-c", title: "Replay C", artist: "A", thumbnailUrl: "https://img/replay-c",
    }) as { id: number };
    const otherSongs = await Promise.all(["one", "two"].map(async (name) => domain.addSong(ownerB.id, {
      youtubeId: `other-${name}`, title: `Other ${name}`, artist: "B", thumbnailUrl: `https://img/other-${name}`,
    }))) as Array<{ id: number }>;
    await domain.setPlaying(ownerB.id, otherSongs[1].id);
    const ownerBBefore = (await pool.query(
      "SELECT id,position,status,played_at FROM songs WHERE user_id=$1 ORDER BY id",
      [ownerB.id],
    )).rows;

    await domain.setPlaying(ownerA.id, songB.id);
    await domain.setPlaying(ownerA.id, songA.id);
    const songD = await domain.addSong(ownerA.id, {
      youtubeId: "replay-d", title: "Replay D", artist: "A", thumbnailUrl: "https://img/replay-d",
    }) as { id: number };
    expect((await pool.query("SELECT position,status FROM songs WHERE id=$1", [songB.id])).rows[0])
      .toEqual({ position: 1, status: "played" });

    await domain.setPlaying(ownerA.id, songB.id);
    const afterReplay = (await pool.query(
      "SELECT id,position,status FROM songs WHERE user_id=$1 AND status IN ('queued','playing') ORDER BY position,id",
      [ownerA.id],
    )).rows as Array<{ id: number; position: number; status: string }>;
    expect(afterReplay.map(({ position }) => position)).toEqual([0, 1, 2]);
    expect(new Set(afterReplay.map(({ position }) => position)).size).toBe(3);
    expect(afterReplay.filter(({ status }) => status === "playing")).toEqual([
      expect.objectContaining({ id: songB.id }),
    ]);

    await domain.setPlaying(ownerA.id, null);
    const afterStop = (await pool.query(
      "SELECT position,status FROM songs WHERE user_id=$1 AND status IN ('queued','playing') ORDER BY position,id",
      [ownerA.id],
    )).rows as Array<{ position: number; status: string }>;
    expect(afterStop.map(({ position }) => position)).toEqual([0, 1]);
    expect(afterStop.every(({ status }) => status === "queued")).toBe(true);

    await Promise.all([
      domain.setPlaying(ownerA.id, songB.id),
      domain.updateSongPosition(ownerA.id, songD.id, 0),
      domain.setPlaying(ownerA.id, songC.id),
    ]);
    const afterCompetition = (await pool.query(
      "SELECT position,status FROM songs WHERE user_id=$1 AND status IN ('queued','playing') ORDER BY position,id",
      [ownerA.id],
    )).rows as Array<{ position: number; status: string }>;
    expect(afterCompetition.map(({ position }) => position)).toEqual([0, 1]);
    expect(new Set(afterCompetition.map(({ position }) => position)).size).toBe(2);
    expect(afterCompetition.filter(({ status }) => status === "playing")).toHaveLength(1);

    await domain.setPlaying(ownerA.id, null);
    const afterCompetingStop = (await pool.query(
      "SELECT position,status FROM songs WHERE user_id=$1 AND status IN ('queued','playing') ORDER BY position,id",
      [ownerA.id],
    )).rows as Array<{ position: number; status: string }>;
    expect(afterCompetingStop.map(({ position }) => position)).toEqual([0]);
    expect(afterCompetingStop.every(({ status }) => status === "queued")).toBe(true);
    expect((await pool.query(
      "SELECT id,position,status,played_at FROM songs WHERE user_id=$1 ORDER BY id",
      [ownerB.id],
    )).rows).toEqual(ownerBBefore);
  });

  it("keeps current playback when the requested target is missing or belongs to another owner", async () => {
    const ownerA = await identities.ensureIdentity(identityInput("playback-target-a"));
    const ownerB = await identities.ensureIdentity(identityInput("playback-target-b"));
    const current = await domain.addSong(ownerA.id, {
      youtubeId: "current-a", title: "Current A", artist: "A", thumbnailUrl: "https://img/current-a",
    }) as { id: number };
    const foreign = await domain.addSong(ownerB.id, {
      youtubeId: "foreign-b", title: "Foreign B", artist: "B", thumbnailUrl: "https://img/foreign-b",
    }) as { id: number };
    await domain.setPlaying(ownerA.id, current.id);

    await expect(domain.setPlaying(ownerA.id, foreign.id)).resolves.toBeUndefined();
    await expect(domain.setPlaying(ownerA.id, 2_147_483_647)).resolves.toBeUndefined();
    expect((await pool.query("SELECT status,played_at FROM songs WHERE id=$1", [current.id])).rows[0])
      .toEqual({ status: "playing", played_at: null });
  });

  it("lists only active explicitly discoverable users with a visible playlist for the sitemap", async () => {
    // Break caught: lifecycle, unlisted, and zero-visible pages entered discovery, or capability revocation hid a public page.
    const suffixes = ["sitemap-live", "sitemap-suspended", "sitemap-pending", "sitemap-private", "sitemap-unlisted", "sitemap-revoked", "sitemap-zero"];
    const rows = new Map<string, Awaited<ReturnType<MusicIdentityRepository["ensureIdentity"]>>>();
    for (const suffix of suffixes) rows.set(suffix, await identities.ensureIdentity(identityInput(suffix)));
    for (const suffix of suffixes.filter((value) => value !== "sitemap-zero")) {
      const identity = rows.get(suffix)!;
      const playlist = await domain.createPlaylist(identity.id, { name: suffix, description: null }) as { id: number };
      await domain.setPlaylistVisibility(identity.id, playlist.id, true);
    }
    await pool.query("UPDATE users SET guest_discoverable=true WHERE id=ANY($1::integer[])", [[...rows.values()].map(({ id }) => id)]);
    await identities.transitionIdentity({
      strapiUserDocumentId: "c6-user-sitemap-suspended",
      operationId: "c6-sitemap-suspend",
      kind: "suspend",
      targetStatus: "suspended",
    });
    await identities.transitionIdentity({
      strapiUserDocumentId: "c6-user-sitemap-pending",
      operationId: "c6-sitemap-delete",
      kind: "request_deletion",
      targetStatus: "pending_deletion",
    });
    await pool.query("UPDATE users SET guest_discoverable=false WHERE id=ANY($1::integer[])", [[rows.get("sitemap-private")!.id, rows.get("sitemap-unlisted")!.id]]);
    await pool.query("UPDATE users SET guest_capability_revoked_at=now() WHERE id=$1", [rows.get("sitemap-revoked")!.id]);

    expect(await domain.listPublishedMusicPlaylists()).toEqual([
      expect.objectContaining({ guestUrl: "c6-public-sitemap-live", updatedAt: expect.any(Date) }),
      expect.objectContaining({ guestUrl: "c6-public-sitemap-revoked", updatedAt: expect.any(Date) }),
    ]);
  });
});
