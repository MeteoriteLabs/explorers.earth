import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { hashGuestCapability, verifyGuestCapability } from "../policies/musicSurfacePolicy";
import { MusicPublicationOperationRepository } from "./musicPublicationOperationRepository";
import type { MusicPublicationMode } from "../services/musicPublicationResponseCrypto";

type QueryPool = Pick<Pool, "query" | "connect">;

const QUEUE_MUTATION_LOCK = 0x4d51;
const SAVED_PLAYLIST_LOCK = 0x4d53;
const PLAYLIST_COLLECTION_LOCK = 0x4d54;
const PUBLICATION_LOCK = 0x4d50;
const MAX_SAVED_PLAYLISTS = 200;
const MAX_SONGS_PER_PLAYLIST = 500;

export class MusicDomainRepository {
  constructor(
    private readonly pool: QueryPool,
    private readonly publicationOperations?: MusicPublicationOperationRepository,
  ) {}

  async executePublicationCommand(musicUserId: number, idempotencyKey: string, mode: MusicPublicationMode) {
    if (!this.publicationOperations) throw new Error("Music publication response authority is unavailable.");
    return this.publicationOperations.execute(musicUserId, idempotencyKey, mode);
  }

  private async withAdvisoryLock<T>(namespace: number, resourceId: number, operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock($1,$2)", [namespace, resourceId]);
      const result = await operation(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async normalizeActiveQueue(client: PoolClient, musicUserId: number): Promise<void> {
    await client.query(
      `WITH ordered AS (
         SELECT id,(row_number() OVER (ORDER BY position,id)-1)::integer AS desired_position
           FROM songs WHERE user_id=$1 AND status IN ('queued','playing')
       )
       UPDATE songs s SET position=o.desired_position FROM ordered o
        WHERE s.user_id=$1 AND s.id=o.id`,
      [musicUserId],
    );
  }

  async listPlaylists(musicUserId: number) {
    return (await this.pool.query(
      `SELECT p.id,
              p.user_id AS "userId",
              p.name,
              p.description,
              p.is_visible_to_guests AS "isVisibleToGuests",
              p.created_at AS "createdAt",
              p.updated_at AS "updatedAt",
              COALESCE(
                jsonb_agg(
                  jsonb_build_object(
                    'id', ps.id,
                    'playlistId', ps.playlist_id,
                    'youtubeId', ps.youtube_id,
                    'title', ps.title,
                    'artist', ps.artist,
                    'thumbnailUrl', ps.thumbnail_url,
                    'position', ps.position,
                    'addedAt', ps.added_at
                  ) ORDER BY ps.position
                ) FILTER (WHERE ps.id IS NOT NULL),
                '[]'::jsonb
              ) AS songs
         FROM playlists p
         LEFT JOIN playlist_songs ps ON ps.playlist_id=p.id
        WHERE p.user_id=$1
        GROUP BY p.id
        ORDER BY p.created_at DESC`,
      [musicUserId],
    )).rows;
  }

  async getPlaylist(musicUserId: number, playlistId: number) {
    return (await this.pool.query(
      "SELECT id,user_id,name,description,is_visible_to_guests,created_at,updated_at FROM playlists WHERE user_id=$1 AND id=$2",
      [musicUserId, playlistId],
    )).rows[0];
  }

  async createPlaylist(musicUserId: number, input: { name: string; description: string | null }) {
    return this.withAdvisoryLock(PLAYLIST_COLLECTION_LOCK, musicUserId, async (client) => {
      const count = Number((await client.query(
        "SELECT count(*)::integer AS count FROM playlists WHERE user_id=$1",
        [musicUserId],
      )).rows[0]?.count ?? 0);
      if (count >= MAX_SAVED_PLAYLISTS) return undefined;
      return (await client.query(
        "INSERT INTO playlists(user_id,name,description,is_visible_to_guests) VALUES ($1,$2,$3,false) RETURNING id,user_id,name,description,is_visible_to_guests,created_at,updated_at",
        [musicUserId, input.name, input.description],
      )).rows[0];
    });
  }

  async updatePlaylist(musicUserId: number, playlistId: number, input: { name: string; description: string | null }) {
    return (await this.pool.query(
      "UPDATE playlists SET name=$3,description=$4,updated_at=now() WHERE user_id=$1 AND id=$2 RETURNING id,user_id,name,description,is_visible_to_guests,created_at,updated_at",
      [musicUserId, playlistId, input.name, input.description],
    )).rows[0];
  }

  async deletePlaylist(musicUserId: number, playlistId: number): Promise<boolean> {
    return (await this.pool.query("DELETE FROM playlists WHERE user_id=$1 AND id=$2", [musicUserId, playlistId])).rowCount === 1;
  }

  async addPlaylistSong(musicUserId: number, playlistId: number, input: { youtubeId: string; title: string; artist: string; thumbnailUrl: string }) {
    assertCanonicalYouTubeVideoId(input.youtubeId);
    return this.withAdvisoryLock(SAVED_PLAYLIST_LOCK, playlistId, async (client) => {
      const owned = (await client.query(
        `SELECT p.id,count(ps.id)::integer AS count
           FROM playlists p LEFT JOIN playlist_songs ps ON ps.playlist_id=p.id
          WHERE p.user_id=$1 AND p.id=$2 GROUP BY p.id`,
        [musicUserId, playlistId],
      )).rows[0];
      if (!owned) return undefined;
      if (Number(owned.count) >= MAX_SONGS_PER_PLAYLIST) return null;
      return (await client.query(
        `WITH owned AS (
           SELECT id FROM playlists WHERE user_id=$1 AND id=$2
         ), ordered AS (
           SELECT ps.id,(row_number() OVER (ORDER BY ps.position,ps.id)-1)::integer AS desired_position
             FROM playlist_songs ps WHERE ps.playlist_id=(SELECT id FROM owned)
         ), normalized AS (
           UPDATE playlist_songs ps SET position=o.desired_position FROM ordered o WHERE ps.id=o.id
         )
         INSERT INTO playlist_songs(playlist_id,youtube_id,title,artist,thumbnail_url,position)
         SELECT p.id,$3,$4,$5,$6,(SELECT count(*)::integer FROM ordered)
         FROM owned p
         RETURNING id,playlist_id,youtube_id,title,artist,thumbnail_url,position,added_at`,
        [musicUserId, playlistId, input.youtubeId, input.title, input.artist, input.thumbnailUrl],
      )).rows[0];
    });
  }

  private async withReadSnapshot<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const result = await operation(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async removePlaylistSong(musicUserId: number, playlistId: number, songId: number): Promise<boolean> {
    return (await this.pool.query(
      `DELETE FROM playlist_songs ps USING playlists p
       WHERE p.user_id=$1 AND ps.playlist_id=$2 AND p.id=ps.playlist_id AND ps.id=$3`,
      [musicUserId, playlistId, songId],
    )).rowCount === 1;
  }

  async reorderPlaylistSong(musicUserId: number, playlistId: number, songId: number, position: number): Promise<boolean> {
    return this.withAdvisoryLock(SAVED_PLAYLIST_LOCK, playlistId, async (client) => {
      const ids = (await client.query(
        `SELECT ps.id FROM playlist_songs ps JOIN playlists p ON p.id=ps.playlist_id
          WHERE p.user_id=$1 AND p.id=$2 ORDER BY ps.position,ps.id FOR UPDATE OF ps`,
        [musicUserId, playlistId],
      )).rows.map(({ id }) => id as number);
      const current = ids.indexOf(songId);
      if (current < 0) return false;
      ids.splice(current, 1);
      ids.splice(Math.max(0, Math.min(position, ids.length)), 0, songId);
      await client.query(
        `WITH desired AS (
           SELECT id,(ordinality-1)::integer AS position FROM unnest($3::integer[]) WITH ORDINALITY AS item(id,ordinality)
         )
         UPDATE playlist_songs ps SET position=d.position FROM desired d,playlists p
          WHERE p.user_id=$1 AND p.id=$2 AND ps.playlist_id=p.id AND ps.id=d.id`,
        [musicUserId, playlistId, ids],
      );
      return true;
    });
  }

  async setPlaylistVisibility(musicUserId: number, playlistId: number, visible: boolean): Promise<boolean> {
    return (await this.pool.query(
      "UPDATE playlists SET is_visible_to_guests=$3,updated_at=now() WHERE user_id=$1 AND id=$2",
      [musicUserId, playlistId, visible],
    )).rowCount === 1;
  }

  async listQueue(musicUserId: number) {
    return (await this.pool.query(
      "SELECT id,user_id,youtube_id,title,artist,thumbnail_url,position,status,played_at FROM songs WHERE user_id=$1 ORDER BY position",
      [musicUserId],
    )).rows;
  }

  private async advanceQueueRevision(client: PoolClient, musicUserId: number): Promise<void> {
    await client.query(
      "UPDATE users SET music_queue_revision=music_queue_revision+1 WHERE id=$1",
      [musicUserId],
    );
  }

  async replaceQueue(
    musicUserId: number,
    idempotencyKey: string,
    expectedRevision: number,
    songs: Array<{ playlistId: number; songId: number }>,
  ): Promise<
    | { status: "completed"; replayed: boolean; response: { version: "music-queue/v1"; revision: number; songs: unknown[] } }
    | { status: "stale"; revision: number }
    | { status: "conflict" }
    | { status: "not_found" }
  > {
    const operation = "queue.replace";
    const keyHash = createHash("sha256").update(idempotencyKey, "utf8").digest("hex");
    const requestHash = createHash("sha256")
      .update(JSON.stringify({ expectedRevision, songs }), "utf8")
      .digest("hex");
    return this.withAdvisoryLock(QUEUE_MUTATION_LOCK, musicUserId, async (client) => {
      await client.query(
        `DELETE FROM music_owner_operations
          WHERE music_user_id=$1 AND operation=$2 AND idempotency_key_hash=$3
            AND expires_at<=transaction_timestamp()`,
        [musicUserId, operation, keyHash],
      );
      await client.query(
        `WITH expired AS (
           SELECT ctid FROM music_owner_operations
            WHERE music_user_id=$1 AND expires_at<=transaction_timestamp()
            ORDER BY expires_at LIMIT 100
         )
         DELETE FROM music_owner_operations operation USING expired
          WHERE operation.ctid=expired.ctid`,
        [musicUserId],
      );
      const existing = (await client.query(
        `SELECT request_hash,status_code,response_body
           FROM music_owner_operations
          WHERE music_user_id=$1 AND operation=$2 AND idempotency_key_hash=$3
            AND expires_at>transaction_timestamp()`,
        [musicUserId, operation, keyHash],
      )).rows[0];
      if (existing) {
        if (existing.request_hash !== requestHash) return { status: "conflict" as const };
        return { status: "completed" as const, replayed: true, response: existing.response_body };
      }

      const owner = (await client.query(
        "SELECT u.music_queue_revision FROM users u WHERE u.id=$1 FOR UPDATE",
        [musicUserId],
      )).rows[0];
      if (!owner) return { status: "not_found" as const };
      const revision = Number(owner.music_queue_revision);
      if (revision !== expectedRevision) return { status: "stale" as const, revision };

      const playlistIds = songs.map(({ playlistId }) => playlistId);
      const songIds = songs.map(({ songId }) => songId);
      const sources = songs.length === 0 ? [] : (await client.query(
        `SELECT ps.id,ps.youtube_id,ps.title,ps.artist,ps.thumbnail_url,source.ordinality
           FROM unnest($2::integer[],$3::integer[]) WITH ORDINALITY AS source(playlist_id,song_id,ordinality)
           JOIN playlists p ON p.id=source.playlist_id AND p.user_id=$1
           JOIN playlist_songs ps ON ps.playlist_id=p.id AND ps.id=source.song_id
          ORDER BY source.ordinality`,
        [musicUserId, playlistIds, songIds],
      )).rows;
      if (sources.length !== songs.length) return { status: "not_found" as const };

      await client.query(
        "DELETE FROM songs WHERE user_id=$1 AND status IN ('queued','playing')",
        [musicUserId],
      );
      const inserted = sources.length === 0 ? [] : (await client.query(
        `INSERT INTO songs(user_id,youtube_id,title,artist,thumbnail_url,position,status)
         SELECT $1,source.youtube_id,source.title,source.artist,source.thumbnail_url,(source.ordinality-1)::integer,'queued'
           FROM unnest($2::text[],$3::text[],$4::text[],$5::text[]) WITH ORDINALITY
             AS source(youtube_id,title,artist,thumbnail_url,ordinality)
          ORDER BY source.ordinality
         RETURNING id,user_id,youtube_id,title,artist,thumbnail_url,position,status,played_at`,
        [
          musicUserId,
          sources.map(({ youtube_id }) => youtube_id),
          sources.map(({ title }) => title),
          sources.map(({ artist }) => artist),
          sources.map(({ thumbnail_url }) => thumbnail_url),
        ],
      )).rows.sort((left, right) => Number(left.position) - Number(right.position));
      const nextRevision = Number((await client.query(
        "UPDATE users SET music_queue_revision=music_queue_revision+1 WHERE id=$1 RETURNING music_queue_revision",
        [musicUserId],
      )).rows[0].music_queue_revision);
      const response = {
        version: "music-queue/v1" as const,
        revision: nextRevision,
        songs: inserted.map((row) => ({
          id: row.id,
          userId: row.user_id,
          youtubeId: row.youtube_id,
          title: row.title,
          artist: row.artist,
          thumbnailUrl: row.thumbnail_url,
          position: row.position,
          status: row.status,
          playedAt: row.played_at instanceof Date ? row.played_at.toISOString() : row.played_at ?? null,
        })),
      };
      await client.query(
        `INSERT INTO music_owner_operations(
           music_user_id,operation,idempotency_key_hash,request_hash,status_code,response_body,expires_at
         ) VALUES ($1,$2,$3,$4,200,$5::jsonb,transaction_timestamp()+interval '24 hours')`,
        [musicUserId, operation, keyHash, requestHash, JSON.stringify(response)],
      );
      return { status: "completed" as const, replayed: false, response };
    });
  }

  async ownerDashboard(musicUserId: number) {
    return this.withReadSnapshot(async (client) => {
      const rows = (await client.query(
        `SELECT id,user_id AS "userId",youtube_id AS "youtubeId",title,artist,
                thumbnail_url AS "thumbnailUrl",position,status,played_at AS "playedAt"
           FROM songs WHERE user_id=$1 ORDER BY position`,
        [musicUserId],
      )).rows;
      const publication = (await client.query(
        `SELECT guest_url,
                music_queue_revision,
                guest_discoverable,
                (guest_capability_hash IS NOT NULL AND guest_capability_revoked_at IS NULL) AS has_guest_capability
           FROM users WHERE id=$1`,
        [musicUserId],
      )).rows[0];
      return {
        queueRevision: Number(publication?.music_queue_revision ?? 0),
        songs: rows.filter((row) => row.status === "queued" || row.status === "playing"),
        currentlyPlaying: rows.find((row) => row.status === "playing"),
        playedSongs: rows.filter((row) => row.status === "played").sort((left, right) => {
          const leftTime = left.playedAt instanceof Date ? left.playedAt.getTime() : Date.parse(String(left.playedAt ?? ""));
          const rightTime = right.playedAt instanceof Date ? right.playedAt.getTime() : Date.parse(String(right.playedAt ?? ""));
          const timeDifference = (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
          return timeDifference || Number(right.id) - Number(left.id);
        }).slice(0, 500),
        publication: {
          mode: publication?.guest_discoverable === true ? "public"
            : publication?.has_guest_capability === true ? "unlisted" : "private",
          publicSlug: String(publication?.guest_url ?? ""),
        },
      };
    });
  }

  async addSong(musicUserId: number, input: { youtubeId: string; title: string; artist: string; thumbnailUrl: string }) {
    assertCanonicalYouTubeVideoId(input.youtubeId);
    return this.withAdvisoryLock(QUEUE_MUTATION_LOCK, musicUserId, async (client) => {
      const activeCount = Number((await client.query(
        "SELECT count(*)::integer AS count FROM songs WHERE user_id=$1 AND status IN ('queued','playing')",
        [musicUserId],
      )).rows[0]?.count ?? 0);
      if (activeCount >= 500) return undefined;
      const song = (await client.query(
        `WITH ordered AS (
           SELECT id,(row_number() OVER (ORDER BY position,id)-1)::integer AS desired_position
             FROM songs WHERE user_id=$1 AND status IN ('queued','playing')
         ), normalized AS (
           UPDATE songs s SET position=o.desired_position FROM ordered o WHERE s.user_id=$1 AND s.id=o.id
         )
         INSERT INTO songs(user_id,youtube_id,title,artist,thumbnail_url,position,status)
         VALUES ($1,$2,$3,$4,$5,(SELECT count(*)::integer FROM ordered),'queued')
         RETURNING id,user_id,youtube_id,title,artist,thumbnail_url,position,status,played_at`,
        [musicUserId, input.youtubeId, input.title, input.artist, input.thumbnailUrl],
      )).rows[0];
      await this.advanceQueueRevision(client, musicUserId);
      return song;
    });
  }

  async setPlaying(musicUserId: number, songId: number | null) {
    return this.withAdvisoryLock(QUEUE_MUTATION_LOCK, musicUserId, async (client) => {
      if (songId === null) {
        const completed = await client.query(
          "UPDATE songs SET status='played',played_at=now() WHERE user_id=$1 AND status='playing'",
          [musicUserId],
        );
        await this.normalizeActiveQueue(client, musicUserId);
        if ((completed.rowCount ?? 0) > 0) await this.advanceQueueRevision(client, musicUserId);
        return null;
      }
      const activated = (await client.query(
        `WITH target AS (
           SELECT id FROM songs WHERE user_id=$1 AND id=$2 FOR UPDATE
         ), previous AS (
           UPDATE songs SET status='played',played_at=now()
            WHERE user_id=$1 AND status='playing' AND id<>$2
              AND EXISTS (SELECT 1 FROM target)
         )
         UPDATE songs SET status='playing',played_at=NULL
          WHERE user_id=$1 AND id=$2 AND EXISTS (SELECT 1 FROM target)
         RETURNING id,user_id,youtube_id,title,artist,thumbnail_url,position,status,played_at`,
        [musicUserId, songId],
      )).rows[0];
      if (!activated) return undefined;
      await this.normalizeActiveQueue(client, musicUserId);
      await this.advanceQueueRevision(client, musicUserId);
      return (await client.query(
        "SELECT id,user_id,youtube_id,title,artist,thumbnail_url,position,status,played_at FROM songs WHERE user_id=$1 AND id=$2 AND status='playing'",
        [musicUserId, songId],
      )).rows[0];
    });
  }

  async updateSongPosition(musicUserId: number, songId: number, position: number) {
    return this.withAdvisoryLock(QUEUE_MUTATION_LOCK, musicUserId, async (client) => {
      const rows = (await client.query(
        "SELECT id,status FROM songs WHERE user_id=$1 AND status IN ('queued','playing') ORDER BY position,id FOR UPDATE",
        [musicUserId],
      )).rows as Array<{ id: number; status: string }>;
      const current = rows.findIndex(({ id, status }) => id === songId && status === "queued");
      if (current < 0) return undefined;
      const [target] = rows.splice(current, 1);
      rows.splice(Math.max(0, Math.min(position, rows.length)), 0, target);
      await client.query(
        `WITH desired AS (
           SELECT id,(ordinality-1)::integer AS position FROM unnest($2::integer[]) WITH ORDINALITY AS item(id,ordinality)
         )
         UPDATE songs s SET position=d.position FROM desired d WHERE s.user_id=$1 AND s.id=d.id`,
        [musicUserId, rows.map(({ id }) => id)],
      );
      await this.advanceQueueRevision(client, musicUserId);
      return (await client.query(
        "SELECT id,user_id,youtube_id,title,artist,thumbnail_url,position,status,played_at FROM songs WHERE user_id=$1 AND id=$2 AND status='queued'",
        [musicUserId, songId],
      )).rows[0];
    });
  }

  async removeSong(musicUserId: number, songId: number): Promise<boolean> {
    return this.withAdvisoryLock(QUEUE_MUTATION_LOCK, musicUserId, async (client) => {
      const removed = await client.query(
        "DELETE FROM songs WHERE user_id=$1 AND id=$2 RETURNING status",
        [musicUserId, songId],
      );
      if ((removed.rowCount ?? 0) > 0 && removed.rows.some(({ status }) => status === "queued" || status === "playing")) {
        await this.normalizeActiveQueue(client, musicUserId);
        await this.advanceQueueRevision(client, musicUserId);
      }
      return removed.rowCount === 1;
    });
  }

  async removeSongs(musicUserId: number, songIds: number[]): Promise<number> {
    return this.withAdvisoryLock(QUEUE_MUTATION_LOCK, musicUserId, async (client) => {
      const removed = await client.query(
        "DELETE FROM songs WHERE user_id=$1 AND id=ANY($2::integer[]) RETURNING status",
        [musicUserId, songIds],
      );
      if (removed.rows.some(({ status }) => status === "queued" || status === "playing")) {
        await this.normalizeActiveQueue(client, musicUserId);
        await this.advanceQueueRevision(client, musicUserId);
      }
      return removed.rowCount ?? 0;
    });
  }

  async clearHistory(musicUserId: number): Promise<number> {
    return (await this.pool.query("DELETE FROM songs WHERE user_id=$1 AND status='played'", [musicUserId])).rowCount ?? 0;
  }

  async rotateGuestCapability(musicUserId: number, capabilityHash: string) {
    return (await this.pool.query(
      "UPDATE users SET guest_capability_hash=$2,guest_capability_rotated_at=now(),guest_capability_revoked_at=NULL WHERE id=$1 RETURNING guest_capability_hash",
      [musicUserId, capabilityHash],
    )).rows[0];
  }

  async setPublicationMode(
    musicUserId: number,
    mode: "private" | "unlisted" | "public",
    capabilityHash?: string,
  ): Promise<{ mode: "private" | "unlisted" | "public"; publicSlug: string } | undefined> {
    if (mode === "unlisted" && !/^[a-f0-9]{64}$/.test(capabilityHash ?? "")) {
      throw new Error("A valid capability hash is required for unlisted publication.");
    }
    return this.withAdvisoryLock(PUBLICATION_LOCK, musicUserId, async (client) => {
      const row = (await client.query(
        `UPDATE users
            SET guest_discoverable=($2='public'),
                guest_capability_hash=CASE WHEN $2='unlisted' THEN $3 ELSE guest_capability_hash END,
                guest_capability_rotated_at=CASE WHEN $2='unlisted' THEN now() ELSE guest_capability_rotated_at END,
                guest_capability_revoked_at=CASE WHEN $2='unlisted' THEN NULL ELSE now() END
          WHERE id=$1
          RETURNING guest_url`,
        [musicUserId, mode, capabilityHash ?? null],
      )).rows[0];
      return row ? { mode, publicSlug: String(row.guest_url ?? "") } : undefined;
    });
  }

  async revokeGuestCapability(musicUserId: number): Promise<void> {
    await this.pool.query("UPDATE users SET guest_capability_revoked_at=now(),guest_discoverable=false WHERE id=$1", [musicUserId]);
  }

  async setDiscoverable(musicUserId: number, discoverable: boolean): Promise<void> {
    await this.pool.query("UPDATE users SET guest_discoverable=$2 WHERE id=$1", [musicUserId, discoverable]);
  }

  async resolveEntitlement(musicUserId: number) {
    const row = (await this.pool.query(
      "SELECT entitlement_state,entitlement_source_updated_at FROM users WHERE id=$1",
      [musicUserId],
    )).rows[0];
    return row ? { state: row.entitlement_state, sourceUpdatedAt: row.entitlement_source_updated_at } : undefined;
  }

  async resolveGuestResource(publicSlug: string, capability?: string) {
    const capabilityValid = typeof capability === "string" && /^[A-Za-z0-9_-]{43}$/.test(capability);
    const capabilityHash = capabilityValid
      ? hashGuestCapability(capability)
      : "0".repeat(64);
    const row = (await this.pool.query(
      `SELECT u.id,u.identity_status,u.guest_capability_hash,u.guest_capability_revoked_at,
        u.guest_discoverable,u.guest_url,u.username,u.venue_name,u.theme,
        u.allow_song_requests,u.allow_guest_play_on_device,u.allow_playlist_sharing,u.allow_recently_played_visibility,
        EXISTS(SELECT 1 FROM playlists vp WHERE vp.user_id=u.id AND vp.is_visible_to_guests=true) AS has_visible_playlist,
        (SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id',s.id,'userId',s.user_id,'youtubeId',s.youtube_id,'title',s.title,'artist',s.artist,
          'thumbnailUrl',s.thumbnail_url,'position',s.position,'status',s.status,'playedAt',s.played_at
        ) ORDER BY s.position) FILTER (WHERE s.id IS NOT NULL),'[]'::jsonb)
          FROM songs s WHERE s.user_id=u.id AND s.status IN ('queued','playing')) AS songs,
        (SELECT jsonb_build_object(
          'id',s.id,'userId',s.user_id,'youtubeId',s.youtube_id,'title',s.title,'artist',s.artist,
          'thumbnailUrl',s.thumbnail_url,'position',s.position,'status',s.status,'playedAt',s.played_at
        ) FROM songs s WHERE s.user_id=u.id AND s.status='playing' ORDER BY s.id LIMIT 1) AS currently_playing,
        (SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id',played.id,'userId',played.user_id,'youtubeId',played.youtube_id,'title',played.title,'artist',played.artist,
          'thumbnailUrl',played.thumbnail_url,'position',played.position,'status',played.status,'playedAt',played.played_at
        ) ORDER BY played.played_at DESC) FILTER (WHERE played.id IS NOT NULL),'[]'::jsonb)
          FROM (SELECT * FROM songs ps WHERE ps.user_id=u.id AND ps.status='played' ORDER BY ps.played_at DESC LIMIT 50) played) AS played_songs,
        (SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id',p.id,'userId',p.user_id,'name',p.name,'description',p.description,'isVisibleToGuests',p.is_visible_to_guests,
          'createdAt',p.created_at,'updatedAt',p.updated_at,
          'songs',(SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id',j.id,'playlistId',j.playlist_id,'youtubeId',j.youtube_id,'title',j.title,'artist',j.artist,
            'thumbnailUrl',j.thumbnail_url,'position',j.position,'addedAt',j.added_at
          ) ORDER BY j.position) FILTER (WHERE j.id IS NOT NULL),'[]'::jsonb) FROM playlist_songs j WHERE j.playlist_id=p.id)
        ) ORDER BY p.id) FILTER (WHERE p.id IS NOT NULL),'[]'::jsonb)
          FROM playlists p WHERE p.user_id=u.id AND p.is_visible_to_guests=true) AS visible_playlists
       FROM users u
         WHERE u.guest_url=$2 AND (u.guest_discoverable=true OR ($3::boolean AND u.guest_capability_hash=$1))
       LIMIT 1`,
      [capabilityHash, publicSlug, capabilityValid],
    )).rows[0];
    if (!row) return undefined;
    const capabilityMatch = capabilityValid
      && verifyGuestCapability(capability!, row.guest_capability_hash);
    const state = row.identity_status === "suspended" ? "suspended"
      : row.identity_status === "pending_deletion" ? "pending_deletion"
        : row.guest_discoverable ? "public"
          : row.guest_capability_revoked_at && capabilityMatch ? "revoked"
            : capabilityMatch ? "unlisted" : "private";
    const publicPlaylist = {
      songs: row.songs ?? [],
      user: {
        id: row.id,
        username: row.username,
        guestUrl: row.guest_url,
        venueName: row.venue_name,
        theme: row.theme,
        allowSongRequests: row.allow_song_requests,
        allowGuestPlayOnDevice: row.allow_guest_play_on_device,
        allowPlaylistSharing: row.allow_playlist_sharing,
        allowRecentlyPlayedVisibility: row.allow_recently_played_visibility,
      },
      currentlyPlaying: row.currently_playing ?? undefined,
      playedSongs: row.allow_recently_played_visibility ? row.played_songs ?? [] : [],
      allowGuestPlayOnDevice: row.allow_guest_play_on_device,
      allowRecentlyPlayedVisibility: row.allow_recently_played_visibility,
      playlists: row.allow_playlist_sharing ? row.visible_playlists ?? [] : undefined,
    };
    return {
      state,
      noindex: state === "unlisted",
      playlist: state === "public" || state === "unlisted" ? publicPlaylist : undefined,
    };
  }

  async resolveGuestSocketAuthority(capability: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(capability)) return undefined;
    const row = (await this.pool.query(
      `SELECT id,allow_song_requests,guest_capability_hash FROM users
       WHERE guest_capability_hash=$1 AND guest_capability_revoked_at IS NULL AND identity_status='active'`,
      [hashGuestCapability(capability)],
    )).rows[0];
    return row && verifyGuestCapability(capability, row.guest_capability_hash)
      ? { musicUserId: row.id, active: true as const, allowSongRequests: row.allow_song_requests === true }
      : undefined;
  }

  async resolveGuestRequestAuthority(publicSlug: string, capability?: string) {
    const capabilityValid = typeof capability === "string" && /^[A-Za-z0-9_-]{43}$/.test(capability);
    const capabilityHash = capabilityValid ? hashGuestCapability(capability) : null;
    const row = (await this.pool.query(
      `SELECT id,allow_song_requests,guest_discoverable,guest_capability_hash FROM users
       WHERE guest_url=$1 AND identity_status='active'
         AND (guest_discoverable=true OR ($3::boolean AND guest_capability_hash=$2 AND guest_capability_revoked_at IS NULL))`,
      [publicSlug, capabilityHash, capabilityValid],
    )).rows[0];
    const authorityValid = row?.guest_discoverable === true
      || (capabilityValid && verifyGuestCapability(capability, row?.guest_capability_hash));
    return row && authorityValid
      ? { musicUserId: row.id, active: true as const, allowSongRequests: row.allow_song_requests === true }
      : undefined;
  }

  async listPublishedMusicPlaylists() {
    return (await this.pool.query(
      `SELECT DISTINCT u.guest_url AS "guestUrl",u.updated_at AS "updatedAt"
         FROM users u
        WHERE u.identity_status='active'
          AND u.guest_url IS NOT NULL
          AND u.guest_discoverable=true
          AND EXISTS (
            SELECT 1 FROM playlists p
             WHERE p.user_id=u.id AND p.is_visible_to_guests=true
          )
        ORDER BY u.guest_url`,
    )).rows;
  }
}

function assertCanonicalYouTubeVideoId(value: string): void {
  if (!/^[A-Za-z0-9_-]{11}$/.test(value)) throw new TypeError("A canonical YouTube video ID is required.");
}
