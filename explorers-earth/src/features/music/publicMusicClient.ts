import type { MusicPlaylist, MusicSong } from "./musicWorkspaceClient";

export interface PublicMusicResource {
  songs: MusicSong[];
  playlists: MusicPlaylist[];
}

export class PublicMusicError extends Error {
  constructor(
    public readonly code: "PUBLIC_NOT_FOUND" | "RATE_LIMITED" | "PUBLIC_UNAVAILABLE",
    public readonly retryAfterSeconds?: number,
  ) {
    super(code);
    this.name = "PublicMusicError";
  }
}

function normalizedBaseUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("The Music service URL must use HTTPS.");
  }
  return url.toString().replace(/\/$/, "");
}

export function createPublicMusicClient(baseUrl: string) {
  const base = normalizedBaseUrl(baseUrl);
  return {
    async load(publicSlug: string, capability?: string): Promise<PublicMusicResource> {
      if (!/^[A-Za-z0-9_-]{8,128}$/.test(publicSlug)) throw new PublicMusicError("PUBLIC_NOT_FOUND");
      const headers: Record<string, string> = { Accept: "application/json" };
      if (capability && /^[A-Za-z0-9_-]{43}$/.test(capability)) {
        headers["X-Music-Guest-Capability"] = capability;
      }
      const response = await fetch(`${base}/api/playlist/${encodeURIComponent(publicSlug)}`, { headers });
      if (response.status === 403 || response.status === 404) throw new PublicMusicError("PUBLIC_NOT_FOUND");
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("retry-after"));
        throw new PublicMusicError("RATE_LIMITED", Number.isFinite(retryAfter) ? retryAfter : 60);
      }
      if (!response.ok) throw new PublicMusicError("PUBLIC_UNAVAILABLE");
      return response.json() as Promise<PublicMusicResource>;
    },
  };
}

const musicBaseUrl = import.meta.env.VITE_LOCAL_TUNES_API_URL || "https://localtunes.earth";
export const publicMusicClient = createPublicMusicClient(musicBaseUrl);
