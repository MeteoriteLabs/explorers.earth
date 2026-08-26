import { MusicClientError, type LocalMusicRequest, type MusicClientErrorCode } from "../../lib/localTunesApiClient";
import {
  parseMusicEntitlementResponse,
} from "./musicEntitlementContract";
import {
  parseMusicPublicationResponse,
  type MusicPublicationCommandResponse,
  type MusicPublicationMode,
} from "../../../../tunes/shared/musicPublicationContract";

export type { MusicEntitlementResponse, MusicEntitlementState } from "./musicEntitlementContract";

export interface MusicSong {
  id: number;
  youtubeId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  position: number;
  status: "queued" | "playing" | "played";
  playedAt: string | null;
}

export interface MusicPlaylist {
  id: number;
  name: string;
  description: string | null;
  isVisibleToGuests: boolean;
  songs: MusicSong[];
}

export type { MusicPublicationMode } from "../../../../tunes/shared/musicPublicationContract";

export interface MusicDashboardResponse {
  queueRevision: number;
  songs: MusicSong[];
  currentlyPlaying: MusicSong | null;
  playedSongs: MusicSong[];
  publication: { mode: MusicPublicationMode; publicSlug: string };
}

export type MusicRequest = (input: LocalMusicRequest) => Promise<Response>;

export async function requestMusicJson<T>(request: MusicRequest, input: LocalMusicRequest): Promise<T> {
  const response = await request(input);
  if (!response.ok) throw await containedWorkspaceError(response);
  return response.json() as Promise<T>;
}

export async function requestMusicEmpty(request: MusicRequest, input: LocalMusicRequest): Promise<void> {
  const response = await request(input);
  if (!response.ok) throw await containedWorkspaceError(response);
}

export async function containedWorkspaceError(response: Response): Promise<MusicClientError> {
  let upstreamCode: string | undefined;
  let retryable = false;
  try {
    const body = await response.clone().json() as { error?: { code?: unknown; retryable?: unknown } };
    upstreamCode = typeof body.error?.code === "string" ? body.error.code : undefined;
    retryable = body.error?.retryable === true;
  } catch {
    // The response body is intentionally contained; status remains canonical.
  }
  const retryAfter = Number(response.headers.get("retry-after"));
  const requestIdHeader = response.headers.get("x-request-id");
  const requestId = requestIdHeader && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(requestIdHeader)
    ? requestIdHeader
    : undefined;
  const code: MusicClientErrorCode = response.status === 401 ? "AUTH_REQUIRED"
    : response.status === 400 ? "REQUEST_INVALID"
      : response.status === 403 || response.status === 409 ? "AUTH_UNAVAILABLE" : "SERVICE_UNAVAILABLE";
  return new MusicClientError(
    code,
    response.status,
    response.status === 401 ? "Music authorization is required." : "Music is temporarily unavailable.",
    Number.isSafeInteger(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
    upstreamCode,
    retryable,
    requestId,
  );
}

export function createMusicWorkspaceClient(request: MusicRequest) {
  return {
    async load() {
      const [playlists, dashboard, entitlement] = await Promise.all([
        requestMusicJson<MusicPlaylist[]>(request, { method: "GET", path: "/api/playlists" }),
        requestMusicJson<MusicDashboardResponse>(request, { method: "GET", path: "/api/music/dashboard" }),
        requestMusicJson<unknown>(request, { method: "GET", path: "/api/music/entitlement" }).then(parseMusicEntitlementResponse),
      ]);
      return { playlists, dashboard, entitlement };
    },
    createPlaylist(name: string, description: string | null, idempotencyKey: string) {
      return requestMusicJson<MusicPlaylist>(request, { method: "POST", path: "/api/playlists", body: { name, description }, idempotencyKey });
    },
    renamePlaylist(playlistId: number, name: string, description: string | null, idempotencyKey: string) {
      return requestMusicJson<MusicPlaylist>(request, { method: "PATCH", path: `/api/playlists/${playlistId}`, body: { name, description }, idempotencyKey });
    },
    deletePlaylist(playlistId: number, idempotencyKey: string) {
      return requestMusicEmpty(request, { method: "DELETE", path: `/api/playlists/${playlistId}`, idempotencyKey });
    },
    setPlaylistVisibility(playlistId: number, isVisibleToGuests: boolean, idempotencyKey: string) {
      return requestMusicEmpty(request, { method: "PATCH", path: `/api/playlists/${playlistId}/visibility`, body: { isVisibleToGuests }, idempotencyKey });
    },
    reorderPlaylistSong(playlistId: number, songId: number, position: number, idempotencyKey: string) {
      return requestMusicEmpty(request, { method: "PATCH", path: `/api/playlists/${playlistId}/reorder`, body: { songId, position }, idempotencyKey });
    },
    async setPublication(mode: MusicPublicationMode, idempotencyKey: string): Promise<MusicPublicationCommandResponse> {
      const response = await request({
        method: "POST", path: "/api/music/publication", body: { mode }, idempotencyKey,
      });
      if (!response.ok) throw await containedWorkspaceError(response);
      return parseMusicPublicationResponse(await response.json(), mode);
    },
  };
}
