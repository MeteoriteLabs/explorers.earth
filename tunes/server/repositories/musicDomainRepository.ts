import type { Pool } from "pg";
import { hashGuestCapability, verifyGuestCapability } from "../policies/musicSurfacePolicy";

type QueryPool = Pick<Pool, "query">;

export class MusicDomainRepository {
  constructor(private readonly pool: QueryPool) {}

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
    return (await this.pool.query(
      "INSERT INTO playlists(user_id,name,description,is_visible_to_guests) VALUES ($1,$2,$3,false) RETURNING id,user_id,name,description,is_visible_to_guests,created_at,updated_at",
      [musicUserId, input.name, input.description],
    )).rows[0];
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
    return (await this.pool.query(
      `INSERT INTO playlist_songs(playlist_id,youtube_id,title,artist,thumbnail_url,position)
       SELECT p.id,$3,$4,$5,$6,COALESCE((SELECT MAX(ps.position)+1 FROM playlist_songs ps WHERE ps.playlist_id=$2),0)
       FROM playlists p WHERE p.user_id=$1 AND p.id=$2
       RETURNING id,playlist_id,youtube_id,title,artist,thumbnail_url,position,added_at`,
      [musicUserId, playlistId, input.youtubeId, input.title, input.artist, input.thumbnailUrl],
    )).rows[0];
  }

  async removePlaylistSong(musicUserId: number, playlistId: number, songId: number): Promise<boolean> {
    return (await this.pool.query(
      `DELETE FROM playlist_songs ps USING playlists p
       WHERE p.user_id=$1 AND ps.playlist_id=$2 AND p.id=ps.playlist_id AND ps.id=$3`,
      [musicUserId, playlistId, songId],
    )).rowCount === 1;
  }

  async reorderPlaylistSong(musicUserId: number, playlistId: number, songId: number, position: number): Promise<boolean> {
    return (await this.pool.query(
      `UPDATE playlist_songs ps SET position=$4 FROM playlists p
       WHERE p.user_id=$1 AND ps.playlist_id=$2 AND p.id=ps.playlist_id AND ps.id=$3`,
      [musicUserId, playlistId, songId, position],
    )).rowCount === 1;
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

  async ownerDashboard(musicUserId: number) {
    const rows = (await this.pool.query(
      `SELECT id,user_id AS "userId",youtube_id AS "youtubeId",title,artist,
              thumbnail_url AS "thumbnailUrl",position,status,played_at AS "playedAt"
         FROM songs WHERE user_id=$1 ORDER BY position`,
      [musicUserId],
    )).rows;
    return {
      songs: rows.filter((row) => row.status === "queued" || row.status === "playing"),
      currentlyPlaying: rows.find((row) => row.status === "playing"),
      playedSongs: rows.filter((row) => row.status === "played"),
    };
  }

  async addSong(musicUserId: number, input: { youtubeId: string; title: string; artist: string; thumbnailUrl: string }) {
    return (await this.pool.query(
      `INSERT INTO songs(user_id,youtube_id,title,artist,thumbnail_url,position,status)
       VALUES ($1,$2,$3,$4,$5,(SELECT COALESCE(MAX(position),-1)+1 FROM songs WHERE user_id=$1 AND status='queued'),'queued')
       RETURNING id,user_id,youtube_id,title,artist,thumbnail_url,position,status,played_at`,
      [musicUserId, input.youtubeId, input.title, input.artist, input.thumbnailUrl],
    )).rows[0];
  }

  async setPlaying(musicUserId: number, songId: number | null) {
    if (songId === null) {
      await this.pool.query(
        "UPDATE songs SET status='played',played_at=now() WHERE user_id=$1 AND status='playing'",
        [musicUserId],
      );
      return null;
    }
    return (await this.pool.query(
      `WITH previous AS (
         UPDATE songs SET status='played',played_at=now()
          WHERE user_id=$1 AND status='playing' AND id<>$2
       )
       UPDATE songs SET status='playing',played_at=NULL
        WHERE user_id=$1 AND id=$2
       RETURNING id,user_id,youtube_id,title,artist,thumbnail_url,position,status,played_at`,
      [musicUserId, songId],
    )).rows[0];
  }

  async updateSongPosition(musicUserId: number, songId: number, position: number) {
    return (await this.pool.query(
      "UPDATE songs SET position=$3 WHERE user_id=$1 AND id=$2 AND status='queued' RETURNING id,user_id,youtube_id,title,artist,thumbnail_url,position,status,played_at",
      [musicUserId, songId, position],
    )).rows[0];
  }

  async removeSong(musicUserId: number, songId: number): Promise<boolean> {
    return (await this.pool.query("DELETE FROM songs WHERE user_id=$1 AND id=$2", [musicUserId, songId])).rowCount === 1;
  }

  async removeSongs(musicUserId: number, songIds: number[]): Promise<number> {
    return (await this.pool.query("DELETE FROM songs WHERE user_id=$1 AND id=ANY($2::integer[])", [musicUserId, songIds])).rowCount ?? 0;
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
          'id',p.id,'name',p.name,'description',p.description,'isVisibleToGuests',p.is_visible_to_guests,
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
        : row.guest_capability_revoked_at && capabilityMatch ? "revoked"
          : !(row.has_visible_playlist ?? row.playlist_id) ? "private"
            : capabilityMatch ? "unlisted"
              : row.guest_discoverable ? "public" : "private";
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
      playlist: (row.has_visible_playlist ?? row.playlist_id) ? publicPlaylist : undefined,
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
}
