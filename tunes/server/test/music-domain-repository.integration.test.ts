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
    expect(await domain.ownerDashboard(a.id)).toEqual({ songs: [], currentlyPlaying: undefined, playedSongs: [expect.objectContaining({ id: aSong.id, userId: a.id })] });
    expect(await domain.ownerDashboard(b.id)).toEqual({ songs: [], currentlyPlaying: undefined, playedSongs: [expect.objectContaining({ id: bSong.id, userId: b.id })] });
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
    expect(await domain.resolveGuestResource("c6-public-cap-b", bCapability)).toMatchObject({ state: "private" });
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
});
