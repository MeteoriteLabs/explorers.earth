import { requestMusicJson, type MusicRequest } from "./musicWorkspaceClient";

export interface MusicGuestSettings {
  allowSongRequests: boolean;
  allowGuestLocalPlayback: boolean;
  allowPlaylistSharing: boolean;
  allowRecentlyPlayedVisibility: boolean;
}
export type MusicGuestSettingsPatch = Partial<MusicGuestSettings>;

export function createMusicGuestSettingsClient(request: MusicRequest) {
  return {
    loadSettings: () => requestMusicJson<MusicGuestSettings>(request, { method: "GET", path: "/api/music/settings" }),
    updateSettings: (settings: MusicGuestSettingsPatch, idempotencyKey: string) => requestMusicJson<MusicGuestSettings>(request, {
      method: "PATCH", path: "/api/music/settings", body: settings, idempotencyKey,
    }),
  };
}
