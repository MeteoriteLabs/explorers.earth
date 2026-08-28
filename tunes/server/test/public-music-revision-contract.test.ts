import { describe, expect, it } from "vitest";
import { PUBLIC_MUSIC_MUTATION_REVISION_COMPATIBILITY } from "../repositories/publicMusicRevision";

describe("public Music mutation revision compatibility", () => {
  it("keeps one explicit mutation-to-kind-to-transaction-to-revision oracle", () => {
    // Break caught: a new or legacy public-output mutation can silently bypass the one canonical snapshot revision.
    expect(PUBLIC_MUSIC_MUTATION_REVISION_COMPATIBILITY).toEqual([
      ["MusicPublicationOperationRepository.execute", "publication_changed", "publication-operation", "conditional"],
      ["MusicDomainRepository.createPlaylist", "playlists_changed", "playlist-collection", "accepted"],
      ["MusicDomainRepository.createPlaylistIdempotent", "playlists_changed", "playlist-collection", "accepted-not-replay"],
      ["MusicDomainRepository.updatePlaylist", "playlists_changed", "saved-playlist", "changed"],
      ["MusicDomainRepository.deletePlaylist", "playlists_changed", "saved-playlist", "deleted"],
      ["MusicDomainRepository.addPlaylistSong", "playlists_changed", "saved-playlist", "accepted"],
      ["MusicDomainRepository.addPlaylistSongIdempotent", "playlists_changed", "saved-playlist", "accepted-not-replay"],
      ["MusicDomainRepository.removePlaylistSong", "playlists_changed", "saved-playlist", "deleted"],
      ["MusicDomainRepository.reorderPlaylistSong", "playlists_changed", "saved-playlist", "changed"],
      ["MusicDomainRepository.setPlaylistVisibility", "playlists_changed", "saved-playlist", "changed"],
      ["MusicDomainRepository.replaceQueue", "queue_changed", "queue", "accepted-not-replay"],
      ["MusicDomainRepository.appendQueue", "queue_changed", "queue", "accepted-not-replay"],
      ["MusicDomainRepository.addSong", "queue_changed", "queue", "accepted"],
      ["MusicDomainRepository.updateSongPosition", "queue_changed", "queue", "changed"],
      ["MusicDomainRepository.removeSong", "queue_changed", "queue", "deleted"],
      ["MusicDomainRepository.removeSongs", "queue_changed", "queue", "deleted"],
      ["MusicDomainRepository.setPlaying", "playback_changed", "queue", "changed"],
      ["MusicDomainRepository.removeHistorySong", "playback_changed", "queue", "accepted-not-replay"],
      ["MusicDomainRepository.clearHistory", "playback_changed", "queue", "deleted"],
      ["MusicDomainRepository.updateGuestControls", "guest_controls_changed", "owner-state", "changed"],
      ["MusicDomainRepository.rotateGuestCapability", "publication_changed", "owner-state", "changed"],
      ["MusicDomainRepository.setPublicationMode", "publication_changed", "publication", "conditional"],
      ["MusicDomainRepository.revokeGuestCapability", "publication_changed", "owner-state", "changed"],
      ["MusicDomainRepository.setDiscoverable", "publication_changed", "owner-state", "changed"],
      ["MusicIdentityRepository.transitionIdentity", "publication_changed", "identity-lifecycle", "changed"],
      ["MusicIdentityRepository.suspendIdentity", "publication_changed", "identity-lifecycle", "changed"],
      ["MusicIdentityRepository.reactivateIdentity", "publication_changed", "identity-lifecycle", "changed"],
      ["MusicIdentityRepository.prepareDeletion", "publication_changed", "identity-lifecycle", "changed"],
      ["MusicIdentityRepository.cancelDeletion", "publication_changed", "identity-lifecycle", "changed"],
      ["MusicIdentityRepository.tombstoneIdentity", "publication_changed", "identity-lifecycle", "deleted"],
      ["MusicIdentityRepository.finalizeDeletion", "publication_changed", "identity-lifecycle", "deleted"],
    ]);
    expect(new Set(PUBLIC_MUSIC_MUTATION_REVISION_COMPATIBILITY.map(([method]) => method)).size)
      .toBe(PUBLIC_MUSIC_MUTATION_REVISION_COMPATIBILITY.length);
  });
});
