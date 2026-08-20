import type { LocalMusicRequest } from "../../lib/localTunesApiClient";

export interface MusicSong {
  id: number;
  title: string;
  artist: string;
  thumbnailUrl: string;
  position: number;
}

export interface MusicPlaylist {
  id: number;
  name: string;
  description: string | null;
  isVisibleToGuests: boolean;
  songs: MusicSong[];
}

export type MusicPublicationMode = "private" | "unlisted" | "public";

export interface MusicDashboardResponse {
  songs: MusicSong[];
  currentlyPlaying: MusicSong | null;
  playedSongs: MusicSong[];
  publication: { mode: MusicPublicationMode; publicSlug: string };
}

export interface MusicEntitlementResponse {
  state: "unknown" | "included" | "eligible" | "entitled" | "revoked";
  coreRead: boolean;
  coreMutation: boolean;
  paidMutation: boolean;
  maxAgeSeconds: number;
}

type Request = (input: LocalMusicRequest) => Promise<Response>;

async function json<T>(request: Request, input: LocalMusicRequest): Promise<T> {
  const response = await request(input);
  if (!response.ok) throw new Error("Music request failed.");
  return response.json() as Promise<T>;
}

async function empty(request: Request, input: LocalMusicRequest): Promise<void> {
  const response = await request(input);
  if (!response.ok) throw new Error("Music request failed.");
}

export function createMusicWorkspaceClient(request: Request) {
  return {
    async load() {
      const [playlists, dashboard, entitlement] = await Promise.all([
        json<MusicPlaylist[]>(request, { method: "GET", path: "/api/playlists" }),
        json<MusicDashboardResponse>(request, { method: "GET", path: "/api/music/dashboard" }),
        json<MusicEntitlementResponse>(request, { method: "GET", path: "/api/music/entitlement" }),
      ]);
      return { playlists, dashboard, entitlement };
    },
    createPlaylist(name: string, description: string | null, idempotencyKey: string) {
      return json<MusicPlaylist>(request, { method: "POST", path: "/api/playlists", body: { name, description }, idempotencyKey });
    },
    renamePlaylist(playlistId: number, name: string, description: string | null, idempotencyKey: string) {
      return json<MusicPlaylist>(request, { method: "PATCH", path: `/api/playlists/${playlistId}`, body: { name, description }, idempotencyKey });
    },
    deletePlaylist(playlistId: number, idempotencyKey: string) {
      return empty(request, { method: "DELETE", path: `/api/playlists/${playlistId}`, idempotencyKey });
    },
    setPlaylistVisibility(playlistId: number, isVisibleToGuests: boolean, idempotencyKey: string) {
      return empty(request, { method: "PATCH", path: `/api/playlists/${playlistId}/visibility`, body: { isVisibleToGuests }, idempotencyKey });
    },
    reorderPlaylistSong(playlistId: number, songId: number, position: number, idempotencyKey: string) {
      return empty(request, { method: "PATCH", path: `/api/playlists/${playlistId}/reorder`, body: { songId, position }, idempotencyKey });
    },
    async setPublication(mode: MusicPublicationMode, idempotencyKey: string): Promise<{ capability?: string }> {
      if (mode === "private") {
        await empty(request, { method: "POST", path: "/api/music/guest-capability/revoke", idempotencyKey });
        return {};
      }
      if (mode === "public") {
        await empty(request, { method: "POST", path: "/api/music/publication/publish", idempotencyKey });
        return {};
      }
      const rotated = await json<{ capability: string }>(request, {
        method: "POST", path: "/api/music/guest-capability/rotate", idempotencyKey: `${idempotencyKey}:rotate`,
      });
      await empty(request, {
        method: "POST", path: "/api/music/publication/unpublish", idempotencyKey: `${idempotencyKey}:unpublish`,
      });
      return { capability: rotated.capability };
    },
  };
}
