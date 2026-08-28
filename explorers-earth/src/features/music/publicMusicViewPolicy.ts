import type { PublicMusicResource } from "./publicMusicClient";

export interface PublicMusicViewPolicy {
  requestEligible: boolean;
  playerEligible: boolean;
  currentVisible: boolean;
  queueVisible: boolean;
  historyVisible: boolean;
  playlistsVisible: boolean;
}

export function derivePublicMusicViewPolicy(
  resource: Pick<PublicMusicResource, "permissions" | "currentlyPlaying">,
): PublicMusicViewPolicy {
  const currentVisible = resource.currentlyPlaying !== null
    && (resource.permissions.allowGuestPlayOnDevice || resource.permissions.allowQueueVisibility);

  return {
    requestEligible: resource.permissions.allowSongRequests,
    playerEligible: resource.currentlyPlaying !== null && resource.permissions.allowGuestPlayOnDevice,
    currentVisible,
    queueVisible: resource.permissions.allowQueueVisibility,
    historyVisible: resource.permissions.allowRecentlyPlayedVisibility,
    playlistsVisible: resource.permissions.allowPlaylistSharing,
  };
}
