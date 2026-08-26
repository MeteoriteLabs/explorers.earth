import { describe, expect, it } from "vitest";
import { hashGuestCapability } from "../policies/musicSurfacePolicy";
import { MusicDomainRepository } from "../repositories/musicDomainRepository";

function recordingPool(rows: unknown[] = []) {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  const query = async (text: string, values: unknown[] = []) => {
    calls.push({ text: text.replace(/\s+/g, " ").trim(), values });
    return { rows, rowCount: rows.length };
  };
  return {
    calls,
    pool: {
      query,
      async connect() {
        return {
          async query(text: string, values: unknown[] = []) {
            if (/^(?:BEGIN|COMMIT|ROLLBACK|SELECT pg_advisory_xact_lock)/.test(text)) return { rows: [], rowCount: 0 };
            return query(text, values);
          },
          release() {},
        };
      },
    },
  };
}

describe("MusicDomainRepository owner predicates", () => {
  it("replaces an owner queue in one locked transaction and returns canonical ordered state", async () => {
    // Break caught: queue replacement becomes a delete/add sequence outside one owner lock.
    const calls: Array<{ text: string; values: unknown[] }> = [];
    let select = 0;
    const client = {
      async query(text: string, values: unknown[] = []) {
        calls.push({ text: text.replace(/\s+/g, " ").trim(), values });
        if (/SELECT request_hash,status_code,response_body/.test(text)) return { rows: [], rowCount: 0 };
        if (/SELECT u\.music_queue_revision/.test(text)) return { rows: [{ music_queue_revision: 4 }], rowCount: 1 };
        if (/SELECT ps\.id/.test(text)) return { rows: [
          { id: 31, youtube_id: "b", title: "B", artist: "Artist B", thumbnail_url: "https://img/b" },
          { id: 30, youtube_id: "a", title: "A", artist: "Artist A", thumbnail_url: "https://img/a" },
        ], rowCount: 2 };
        if (/INSERT INTO songs/.test(text)) return { rows: [
          { id: 101, user_id: 7, youtube_id: "b", title: "B", artist: "Artist B", thumbnail_url: "https://img/b", position: 0, status: "queued", played_at: null },
          { id: 102, user_id: 7, youtube_id: "a", title: "A", artist: "Artist A", thumbnail_url: "https://img/a", position: 1, status: "queued", played_at: null },
        ], rowCount: 2 };
        if (/UPDATE users SET music_queue_revision/.test(text)) return { rows: [{ music_queue_revision: 5 }], rowCount: 1 };
        if (/SELECT id,user_id/.test(text)) { select += 1; return { rows: [], rowCount: 0 }; }
        return { rows: [], rowCount: 1 };
      },
      release() {},
    };
    const repository = new MusicDomainRepository({ query: async () => { throw new Error("outside transaction"); }, connect: async () => client } as never);
    await expect(repository.replaceQueue(7, "replace-key", 4, [
      { playlistId: 9, songId: 31 }, { playlistId: 9, songId: 30 },
    ])).resolves.toEqual({
      status: "completed", replayed: false,
      response: { version: "music-queue/v1", revision: 5, songs: [
        { id: 101, userId: 7, youtubeId: "b", title: "B", artist: "Artist B", thumbnailUrl: "https://img/b", position: 0, status: "queued", playedAt: null },
        { id: 102, userId: 7, youtubeId: "a", title: "A", artist: "Artist A", thumbnailUrl: "https://img/a", position: 1, status: "queued", playedAt: null },
      ] },
    });
    expect(calls[0].text).toBe("BEGIN");
    expect(calls.some(({ text }) => /pg_advisory_xact_lock/.test(text))).toBe(true);
    expect(calls.some(({ text }) => /JOIN playlists p/.test(text) && /p.user_id=\$1/.test(text))).toBe(true);
    expect(calls.some(({ text }) => /DELETE FROM songs/.test(text) && /status IN \('queued','playing'\)/.test(text))).toBe(true);
    expect(calls.at(-1)?.text).toBe("COMMIT");
    expect(select).toBe(0);
  });

  it("rejects stale revisions and foreign playlist songs before deleting the active queue", async () => {
    const results = [
      { rows: [], rowCount: 0 }, { rows: [{ music_queue_revision: 8 }], rowCount: 1 },
    ];
    const statements: string[] = [];
    const client = { async query(text: string) {
      statements.push(text.replace(/\s+/g, " ").trim());
      if (/^(BEGIN|COMMIT|ROLLBACK)|pg_advisory_xact_lock/.test(text)) return { rows: [], rowCount: 0 };
      if (/DELETE FROM music_owner_operations/.test(text)) return { rows: [], rowCount: 0 };
      return results.shift() ?? { rows: [], rowCount: 0 };
    }, release() {} };
    const repository = new MusicDomainRepository({ query: async () => ({ rows: [] }), connect: async () => client } as never);
    await expect(repository.replaceQueue(7, "stale", 7, [{ playlistId: 9, songId: 31 }]))
      .resolves.toEqual({ status: "stale", revision: 8 });
    expect(statements.some((text) => /DELETE FROM songs/.test(text))).toBe(false);

    const foreignStatements: string[] = [];
    const foreignClient = { async query(text: string) {
      foreignStatements.push(text.replace(/\s+/g, " ").trim());
      if (/SELECT request_hash/.test(text)) return { rows: [], rowCount: 0 };
      if (/SELECT u\.music_queue_revision/.test(text)) return { rows: [{ music_queue_revision: 0 }], rowCount: 1 };
      if (/SELECT ps\.id/.test(text)) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 0 };
    }, release() {} };
    const foreign = new MusicDomainRepository({ query: async () => ({ rows: [] }), connect: async () => foreignClient } as never);
    await expect(foreign.replaceQueue(7, "foreign", 0, [{ playlistId: 99, songId: 31 }]))
      .resolves.toEqual({ status: "not_found" });
    expect(foreignStatements.some((text) => /DELETE FROM songs/.test(text))).toBe(false);
  });

  it("rolls back an injected queue replacement failure", async () => {
    const statements: string[] = [];
    const client = { async query(text: string) {
      statements.push(text.replace(/\s+/g, " ").trim());
      if (/SELECT request_hash/.test(text)) return { rows: [], rowCount: 0 };
      if (/SELECT u\.music_queue_revision/.test(text)) return { rows: [{ music_queue_revision: 0 }], rowCount: 1 };
      if (/SELECT ps\.id/.test(text)) return { rows: [{ id: 1, youtube_id: "a", title: "A", artist: "A", thumbnail_url: "https://img" }], rowCount: 1 };
      if (/INSERT INTO songs/.test(text)) throw new Error("injected queue failure");
      return { rows: [], rowCount: 1 };
    }, release() {} };
    const repository = new MusicDomainRepository({ query: async () => ({ rows: [] }), connect: async () => client } as never);
    await expect(repository.replaceQueue(7, "failure", 0, [{ playlistId: 9, songId: 1 }])).rejects.toThrow("injected queue failure");
    expect(statements).toContain("ROLLBACK");
    expect(statements).not.toContain("COMMIT");
  });

  it("uses the database clock to expire replay keys and performs only bounded owner cleanup", async () => {
    // Break caught: expired responses replay forever, block safe reuse, or trigger an unbounded global delete.
    const statements: Array<{ text: string; values: unknown[] }> = [];
    const client = { async query(text: string, values: unknown[] = []) {
      statements.push({ text: text.replace(/\s+/g, " ").trim(), values });
      if (/SELECT request_hash,status_code,response_body/.test(text)) return { rows: [], rowCount: 0 };
      if (/SELECT u\.music_queue_revision/.test(text)) return { rows: [{ music_queue_revision: 2 }], rowCount: 1 };
      if (/UPDATE users SET music_queue_revision/.test(text)) return { rows: [{ music_queue_revision: 3 }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    }, release() {} };
    const repository = new MusicDomainRepository({ query: async () => ({ rows: [] }), connect: async () => client } as never);
    await expect(repository.replaceQueue(7, "expired-key", 2, [])).resolves.toMatchObject({ status: "completed", replayed: false });
    const targeted = statements.find(({ text }) => /DELETE FROM music_owner_operations\s+WHERE music_user_id=\$1 AND operation=\$2 AND idempotency_key_hash=\$3/.test(text));
    expect(targeted?.text).toMatch(/expires_at<=transaction_timestamp\(\)/);
    expect(targeted?.values).toHaveLength(3);
    const cleanup = statements.find(({ text }) => /WITH expired AS/.test(text));
    expect(cleanup?.text).toMatch(/music_user_id=\$1[\s\S]*expires_at<=transaction_timestamp\(\)[\s\S]*LIMIT 100/i);
    expect(cleanup?.values).toEqual([7]);
    expect(statements.find(({ text }) => /SELECT request_hash/.test(text))?.text)
      .toMatch(/expires_at>transaction_timestamp\(\)/i);
  });
  it("owner-predicates every playlist read/update/delete family", async () => {
    // Break caught: a resource ID alone can observe or mutate another owner's playlist.
    const harness = recordingPool();
    const repository = new MusicDomainRepository(harness.pool);
    await repository.listPlaylists(17);
    await repository.getPlaylist(17, 44);
    await repository.updatePlaylist(17, 44, { name: "safe", description: null });
    await repository.deletePlaylist(17, 44);
    for (const call of harness.calls) {
      expect(call.text.toLowerCase()).toMatch(/(?:user_id|id)\s*=\s*\$1/);
      expect(call.values[0]).toBe(17);
    }
    expect(harness.calls.slice(1).every((call) => call.text.toLowerCase().includes("id=$2") || call.text.toLowerCase().includes("id = $2"))).toBe(true);
    expect(harness.calls[0].text.toLowerCase()).toContain("jsonb_agg");
    expect(harness.calls[0].text.toLowerCase()).toContain("left join playlist_songs");
  });

  it("owner-predicates every queue read/update/delete family", async () => {
    // Break caught: a song ID alone can update/delete user B's queue row.
    const harness = recordingPool();
    const repository = new MusicDomainRepository(harness.pool);
    await repository.listQueue(23);
    await repository.addSong(23, { youtubeId: "abcdefghijk", title: "title", artist: "artist", thumbnailUrl: "https://img" });
    await repository.setPlaying(23, 71);
    await repository.updateSongPosition(23, 71, 2);
    await repository.removeSong(23, 71);
    await repository.removeSongs(23, [71, 72]);
    await repository.clearHistory(23);
    for (const [index, call] of harness.calls.entries()) {
      if (index === 1) {
        expect(call.text.toLowerCase()).toContain("insert into songs(user_id");
        expect(call.values[0]).toBe(23);
        continue;
      }
      expect(call.text.toLowerCase()).toMatch(/(?:user_id|id)\s*=\s*\$1/);
      expect(call.values[0]).toBe(23);
    }
    expect(harness.calls.some((call) => /id\s*=\s*\$2/.test(call.text.toLowerCase()))).toBe(true);
    expect(harness.calls.some((call) => call.text.toLowerCase().includes("status in ('queued','playing')"))).toBe(true);
  });

  it("builds the private owner dashboard from only owner-predicated rows", async () => {
    const harness = recordingPool([
      { id: 1, userId: 23, youtubeId: "q", status: "queued" },
      { id: 2, userId: 23, youtubeId: "p", status: "playing" },
      { id: 3, userId: 23, youtubeId: "h", status: "played" },
    ]);
    const result = await new MusicDomainRepository(harness.pool).ownerDashboard(23);
    expect(harness.calls[0].text.toLowerCase()).toMatch(/user_id\s*=\s*\$1/);
    expect(harness.calls[0].values).toEqual([23]);
    expect(result).toEqual({
      songs: [expect.objectContaining({ id: 1 }), expect.objectContaining({ id: 2 })],
      currentlyPlaying: expect.objectContaining({ id: 2 }),
      playedSongs: [expect.objectContaining({ id: 3 })],
      queueRevision: 0,
      publication: { mode: "private", publicSlug: "" },
    });
  });

  it("orders owner played history by most recent play time", async () => {
    const harness = recordingPool([
      { id: 3, userId: 23, status: "played", playedAt: "2026-08-25T10:00:00.000Z" },
      { id: 4, userId: 23, status: "played", playedAt: "2026-08-25T11:00:00.000Z" },
    ]);
    const result = await new MusicDomainRepository(harness.pool).ownerDashboard(23);
    expect(result.playedSongs.map((song) => song.id)).toEqual([4, 3]);
  });

  it.each(["abcdefghij", "abcdefghijkl", "A".repeat(65)])("rejects noncanonical repository YouTube ID %s before a query", async (youtubeId) => {
    const harness = recordingPool();
    const repository = new MusicDomainRepository(harness.pool);
    await expect(repository.addSong(23, { youtubeId, title: "title", artist: "artist", thumbnailUrl: "https://img" })).rejects.toThrow("canonical YouTube video ID");
    await expect(repository.addPlaylistSong(23, 7, { youtubeId, title: "title", artist: "artist", thumbnailUrl: "https://img" })).rejects.toThrow("canonical YouTube video ID");
    expect(harness.calls).toEqual([]);
  });

  it("advances the owner queue revision inside each canonical active-queue mutation transaction", async () => {
    // Break caught: a stale tab can replace over an add/play/reorder/remove because its expected revision stayed current.
    for (const execute of [
      (repository: MusicDomainRepository) => repository.addSong(7, { youtubeId: "abcdefghijk", title: "A", artist: "A", thumbnailUrl: "https://img" }),
      (repository: MusicDomainRepository) => repository.setPlaying(7, 1),
      (repository: MusicDomainRepository) => repository.updateSongPosition(7, 1, 0),
      (repository: MusicDomainRepository) => repository.removeSong(7, 1),
      (repository: MusicDomainRepository) => repository.removeSongs(7, [1, 2]),
    ]) {
      const statements: string[] = [];
      const client = { async query(text: string) {
        statements.push(text.replace(/\s+/g, " ").trim());
        if (/SELECT id,status FROM songs/.test(text)) return { rows: [{ id: 1, status: "queued" }], rowCount: 1 };
        if (/DELETE FROM songs/.test(text)) return { rows: [{ status: "queued" }], rowCount: 1 };
        if (/RETURNING id,user_id/.test(text)) return { rows: [{ id: 1, user_id: 7, position: 0, status: "queued" }], rowCount: 1 };
        return { rows: [], rowCount: 1 };
      }, release() {} };
      await execute(new MusicDomainRepository({ query: async () => { throw new Error("outside transaction"); }, connect: async () => client } as never));
      expect(statements.some((text) => /UPDATE users SET music_queue_revision=music_queue_revision\+1 WHERE id=\$1/.test(text))).toBe(true);
      expect(statements.at(-1)).toBe("COMMIT");
    }
  });

  it.each([
    [{ guest_url: "random-public-slug", guest_discoverable: false, has_guest_capability: false }, "private"],
    [{ guest_url: "random-public-slug", guest_discoverable: false, has_guest_capability: true }, "unlisted"],
    [{ guest_url: "random-public-slug", guest_discoverable: true, has_guest_capability: true }, "public"],
  ] as const)("returns owner-readable publication link state without capability material", async (publicationRow, mode) => {
    const calls: Array<{ text: string; values: unknown[] }> = [];
    let index = 0;
    const pool = {
      query: async (text: string, values: unknown[] = []) => {
        calls.push({ text, values });
        index += 1;
        return { rows: index === 1 ? [] : [publicationRow], rowCount: index === 1 ? 0 : 1 };
      },
      connect: async () => { throw new Error("not used"); },
    };
    const result = await new MusicDomainRepository(pool).ownerDashboard(41);
    expect(result.publication).toEqual({ mode, publicSlug: "random-public-slug" });
    expect(JSON.stringify(result)).not.toMatch(/capability|hash/i);
    expect(calls).toHaveLength(2);
    expect(calls.every((call) => call.values[0] === 41)).toBe(true);
    expect(calls[1].text.toLowerCase()).not.toMatch(/guest_capability_hash\s+as/);
  });

  it("owner-predicates every saved-playlist song and visibility mutation", async () => {
    // Break caught: the child song ID is ownerless even though the parent playlist was checked elsewhere.
    const harness = recordingPool();
    const repository = new MusicDomainRepository(harness.pool);
    await repository.addPlaylistSong(29, 80, { youtubeId: "abcdefghijk", title: "t", artist: "a", thumbnailUrl: "https://img" });
    await repository.removePlaylistSong(29, 80, 91);
    await repository.reorderPlaylistSong(29, 80, 91, 3);
    await repository.setPlaylistVisibility(29, 80, true);
    expect(harness.calls.every((call) => call.values[0] === 29)).toBe(true);
    expect(harness.calls.every((call) => /user_id\s*=\s*\$1/.test(call.text.toLowerCase()))).toBe(true);
    expect(harness.calls[1].text.toLowerCase()).toMatch(/playlist_id\s*=\s*\$2/);
    expect(harness.calls[2].text.toLowerCase()).toContain("join playlists p on p.id=ps.playlist_id");
    expect(harness.calls[2].text.toLowerCase()).toContain("p.id=$2");
  });

  it("rotates and revokes a guest capability only for the resolved owner", async () => {
    // Break caught: capability rotation targets a caller-selected user or leaves prior authority active.
    const harness = recordingPool([{ guest_capability_hash: "f".repeat(64) }]);
    const repository = new MusicDomainRepository(harness.pool);
    await repository.rotateGuestCapability(31, "f".repeat(64));
    await repository.revokeGuestCapability(31);
    expect(harness.calls[0].text.toLowerCase()).toContain("where id=$1");
    expect(harness.calls[0].values).toEqual([31, "f".repeat(64)]);
    expect(harness.calls[1].text.toLowerCase()).toContain("where id=$1");
    expect(harness.calls[1].values).toEqual([31]);
  });

  it.each([
    ["private", undefined],
    ["public", undefined],
    ["unlisted", "f".repeat(64)],
  ] as const)("changes publication to %s with one owner-predicated write in one transaction", async (mode, capabilityHash) => {
    const harness = recordingPool([{ guest_url: "public-slug" }]);
    const repository = new MusicDomainRepository(harness.pool);
    await repository.setPublicationMode(31, mode, capabilityHash);
    const writes = harness.calls.filter((call) => /update users/i.test(call.text));
    expect(writes).toHaveLength(1);
    expect(writes[0].text.toLowerCase()).toContain("where id=$1");
    expect(writes[0].values[0]).toBe(31);
    expect(writes[0].values[1]).toBe(mode);
    expect(JSON.stringify(harness.calls)).not.toContain("capability\":");
  });

  it("rolls back an injected publication write failure without a second partial write or commit", async () => {
    const statements: string[] = [];
    const pool = {
      query: async () => { throw new Error("pool query must not be used"); },
      async connect() {
        return {
          async query(text: string) {
            statements.push(text.replace(/\s+/g, " ").trim());
            if (/UPDATE users/i.test(text)) throw new Error("injected publication failure");
            return { rows: [], rowCount: 0 };
          },
          release() {},
        };
      },
    };
    const repository = new MusicDomainRepository(pool as never);
    await expect(repository.setPublicationMode(31, "unlisted", "f".repeat(64))).rejects.toThrow("injected publication failure");
    expect(statements.filter((text) => /UPDATE users/i.test(text))).toHaveLength(1);
    expect(statements).toContain("ROLLBACK");
    expect(statements).not.toContain("COMMIT");
  });

  it("resolves socket guest authority by hash with lifecycle and revocation in SQL", async () => {
    // Break caught: socket handshake reads a plaintext URL or skips local revocation/lifecycle truth.
    const capability = "A".repeat(43);
    const harness = recordingPool([{
      id: 31,
      allow_song_requests: true,
      guest_capability_hash: hashGuestCapability(capability),
    }]);
    const repository = new MusicDomainRepository(harness.pool);
    await expect(repository.resolveGuestSocketAuthority(capability)).resolves.toEqual({
      musicUserId: 31,
      active: true,
      allowSongRequests: true,
    });
    expect(harness.calls[0].text.toLowerCase()).toContain("guest_capability_hash=$1");
    expect(harness.calls[0].text.toLowerCase()).toContain("guest_capability_revoked_at is null");
    expect(harness.calls[0].text.toLowerCase()).toContain("identity_status='active'");
    expect(harness.calls[0].values[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(harness.calls[0].values[0]).not.toBe(capability);
  });

  it("independently verifies returned REST and socket capability hashes", async () => {
    // Break caught: database equality alone becomes the capability verifier and no constant-time check runs in process.
    const capability = "B".repeat(43);
    const mismatch = "0".repeat(64);
    const socketHarness = recordingPool([{
      id: 31,
      allow_song_requests: true,
      guest_capability_hash: mismatch,
    }]);
    await expect(new MusicDomainRepository(socketHarness.pool).resolveGuestSocketAuthority(capability)).resolves.toBeUndefined();

    const resourceHarness = recordingPool([{
      id: 31,
      identity_status: "active",
      guest_capability_hash: mismatch,
      guest_capability_revoked_at: null,
      guest_discoverable: false,
      guest_url: "public-slug",
      playlist_id: 7,
      name: "private",
      description: null,
    }]);
    await expect(new MusicDomainRepository(resourceHarness.pool).resolveGuestResource("public-slug", capability)).resolves.toMatchObject({
      state: "private",
    });
    expect(resourceHarness.calls[0].text.replace(/\s+/g, " ")).toMatch(/u\.guest_url=\$2 AND \(u\.guest_discoverable=true OR \(\$3::boolean AND u\.guest_capability_hash=\$1\)\)/);
  });

  it("returns the complete safe public playlist product shape", async () => {
    // Break caught: the live guest page dereferences user/settings/songs while the canonical repository returned only a playlist name.
    const harness = recordingPool([{
      id: 31,
      identity_status: "active",
      guest_capability_hash: "f".repeat(64),
      guest_capability_revoked_at: null,
      guest_discoverable: true,
      guest_url: "public-slug",
      username: "display",
      venue_name: "Venue",
      theme: { primary: "#123456" },
      allow_song_requests: true,
      allow_guest_play_on_device: false,
      allow_playlist_sharing: true,
      allow_recently_played_visibility: true,
      songs: [{ id: 1, youtubeId: "queue" }],
      currently_playing: { id: 2, youtubeId: "playing" },
      played_songs: [{ id: 3, youtubeId: "played" }],
      visible_playlists: [{ id: 7, songs: [{ id: 8, youtubeId: "saved" }] }],
      playlist_id: 7,
      name: "public",
      description: null,
    }]);
    const result = await new MusicDomainRepository(harness.pool).resolveGuestResource("public-slug");
    expect(result).toMatchObject({
      state: "public",
      playlist: {
        songs: [{ id: 1, youtubeId: "queue" }],
        user: { username: "display", venueName: "Venue", allowPlaylistSharing: true },
        currentlyPlaying: { id: 2, youtubeId: "playing" },
        playedSongs: [{ id: 3, youtubeId: "played" }],
        allowGuestPlayOnDevice: false,
        playlists: [{ id: 7, songs: [{ id: 8, youtubeId: "saved" }] }],
      },
    });
    expect(harness.calls[0].text.toLowerCase()).toContain("visible_playlists");
  });

  it("authorizes song requests for an active public publication without a capability", async () => {
    const harness = recordingPool([{
      id: 44,
      allow_song_requests: true,
      guest_discoverable: true,
      guest_capability_hash: null,
    }]);

    await expect(
      new MusicDomainRepository(harness.pool).resolveGuestRequestAuthority("public-owner"),
    ).resolves.toEqual({ musicUserId: 44, active: true, allowSongRequests: true });
    expect(harness.calls[0].values).toEqual(["public-owner", null, false]);
  });

  it("validates and locks the owner playback target before retiring the current song", async () => {
    const harness = recordingPool();
    await new MusicDomainRepository(harness.pool).setPlaying(23, 71);
    const transition = harness.calls[0].text.toLowerCase();
    expect(transition).toMatch(/target as \( select id from songs where user_id=\$1 and id=\$2 for update \)/);
    expect(transition).toMatch(/status='playing'.*exists \(select 1 from target\)/);
  });

  it("keeps a public resource reachable when a supplied stale capability was revoked", async () => {
    const capability = "B".repeat(43);
    const harness = recordingPool([{
      id: 31,
      identity_status: "active",
      guest_capability_hash: hashGuestCapability(capability),
      guest_capability_revoked_at: new Date("2026-08-24T00:00:00Z"),
      guest_discoverable: true,
      guest_url: "public-after-unlisted",
      playlist_id: 7,
      name: "public",
      description: null,
    }]);

    await expect(
      new MusicDomainRepository(harness.pool).resolveGuestResource("public-after-unlisted", capability),
    ).resolves.toMatchObject({ state: "public" });
  });

  it("keeps an active discoverable owner reachable with the exact empty public playlist shape", async () => {
    const harness = recordingPool([{
      id: 31,
      identity_status: "active",
      guest_capability_hash: null,
      guest_capability_revoked_at: null,
      guest_discoverable: true,
      guest_url: "public-empty",
      username: "display",
      venue_name: null,
      theme: null,
      allow_song_requests: false,
      allow_guest_play_on_device: false,
      allow_playlist_sharing: true,
      allow_recently_played_visibility: false,
      has_visible_playlist: false,
      songs: [],
      currently_playing: null,
      played_songs: [],
      visible_playlists: [],
    }]);
    await expect(new MusicDomainRepository(harness.pool).resolveGuestResource("public-empty")).resolves.toMatchObject({
      state: "public",
      playlist: { songs: [], playlists: [] },
    });
  });

  it("serves an empty unlisted publication to its valid capability", async () => {
    const capability = "C".repeat(43);
    const harness = recordingPool([{
      id: 31,
      identity_status: "active",
      guest_capability_hash: hashGuestCapability(capability),
      guest_capability_revoked_at: null,
      guest_discoverable: false,
      guest_url: "unlisted-empty",
      username: "display",
      venue_name: null,
      theme: null,
      allow_song_requests: false,
      allow_guest_play_on_device: false,
      allow_playlist_sharing: true,
      allow_recently_played_visibility: false,
      has_visible_playlist: false,
      songs: [],
      currently_playing: null,
      played_songs: [],
      visible_playlists: [],
    }]);

    await expect(new MusicDomainRepository(harness.pool).resolveGuestResource("unlisted-empty", capability)).resolves.toMatchObject({
      state: "unlisted",
      noindex: true,
      playlist: { songs: [], playlists: [] },
    });
  });

  it("lists discoverable public playlists independently of revoked guest capabilities", async () => {
    // Break caught: publishing publicly revokes an unlisted capability, but that must not remove the public URL from discovery.
    const harness = recordingPool([{
      guestUrl: "public-slug",
      updatedAt: new Date("2026-08-23T00:00:00.000Z"),
    }]);

    await expect(new MusicDomainRepository(harness.pool).listPublishedMusicPlaylists()).resolves.toEqual([{
      guestUrl: "public-slug",
      updatedAt: new Date("2026-08-23T00:00:00.000Z"),
    }]);
    expect(harness.calls[0].text.toLowerCase()).toContain("u.guest_discoverable=true");
    expect(harness.calls[0].text.toLowerCase()).toContain("u.identity_status='active'");
    expect(harness.calls[0].text.toLowerCase()).not.toContain("guest_capability_revoked_at");
  });
});
