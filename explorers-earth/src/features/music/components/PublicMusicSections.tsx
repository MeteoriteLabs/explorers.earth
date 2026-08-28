import { useLayoutEffect, useRef, useState, type ComponentProps, type FocusEvent, type PointerEvent } from "react";
import type { PublicMusicResource, PublicMusicSong } from "../publicMusicClient";
import { derivePublicMusicViewPolicy } from "../publicMusicViewPolicy";
import { PublicMusicPlayer } from "./PublicMusicPlayer";
import { PublicMusicRequest } from "./PublicMusicRequest";
import type { PublicMusicProductEvent } from "../publicMusicAnalytics";

function useSectionEngagement(section: "player" | "request" | "queue" | "playlists" | "history", enabled: boolean, onAnalytics?: (event: PublicMusicProductEvent) => void) {
  const engaged = useRef(false);
  const pointerInside = useRef(false);
  const focusInside = useRef(false);
  useLayoutEffect(() => {
    if (enabled) return;
    engaged.current = false;
    pointerInside.current = false;
    focusInside.current = false;
  }, [enabled]);
  const enter = () => {
    if (engaged.current) return;
    engaged.current = true;
    onAnalytics?.({ name: "section_opened", section });
  };
  return {
    onPointerEnter: (_event: PointerEvent<HTMLElement>) => { pointerInside.current = true; enter(); },
    onPointerLeave: (_event: PointerEvent<HTMLElement>) => {
      pointerInside.current = false;
      if (!focusInside.current) engaged.current = false;
    },
    onFocusCapture: (event: FocusEvent<HTMLElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        focusInside.current = true;
        enter();
      }
    },
    onBlurCapture: (event: FocusEvent<HTMLElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        focusInside.current = false;
        if (!pointerInside.current) engaged.current = false;
      }
    },
  };
}

function CollectionSummary({ shown, total, noun }: { shown: number; total: number; noun?: string }) {
  if (total <= shown) return null;
  return (
    <p className="text-sm text-dashboard-text-muted">
      Showing {shown} of {total}{noun ? ` ${noun}` : ""}
    </p>
  );
}

function SongArtwork({ song }: { song: PublicMusicSong }) {
  return song.thumbnailUrl ? (
    <img className="h-11 w-11 shrink-0 rounded object-cover" src={song.thumbnailUrl} alt="" />
  ) : null;
}

function SongDetails({ song }: { song: PublicMusicSong }) {
  return (
    <span className="min-w-0">
      <span className="block truncate font-medium">{song.title}</span>
      <span className="block truncate text-sm text-dashboard-text-muted">{song.artist}</span>
    </span>
  );
}

function SongRow({ song, playable = false, selected = false, onSelect }: {
  song: PublicMusicSong;
  playable?: boolean;
  selected?: boolean;
  onSelect?: (song: PublicMusicSong) => void;
}) {
  return (
    <li className="flex min-h-11 min-w-0 items-center gap-3 py-3">
      {playable ? (
        <button
          type="button"
          aria-label={`Choose ${song.title} to play on this device`}
          aria-current={selected ? "true" : undefined}
          onClick={() => onSelect?.(song)}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-accent"
        >
          <SongArtwork song={song} />
          <SongDetails song={song} />
          {selected ? <span className="ml-auto shrink-0 text-xs font-semibold">Selected</span> : null}
        </button>
      ) : (
        <>
          <SongArtwork song={song} />
          <SongDetails song={song} />
        </>
      )}
    </li>
  );
}

export function PublicMusicSections({ resource, publicSlug, capability, headingId = "public-music-heading", onReconcile, requestClient, onAnalytics }: {
  resource: PublicMusicResource;
  publicSlug?: string;
  capability?: string;
  headingId?: string;
  onReconcile?: () => void;
  requestClient?: ComponentProps<typeof PublicMusicRequest>["client"];
  onAnalytics?: (event: PublicMusicProductEvent) => void;
}) {
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [revocationAnnouncement, setRevocationAnnouncement] = useState("");
  const playerHasFocus = useRef(false);
  const previousPlayerEligible = useRef(false);
  const requestHasFocus = useRef(false);
  const previousRequestEligible = useRef(false);
  const [requestRevoked, setRequestRevoked] = useState(false);
  const policy = derivePublicMusicViewPolicy(resource);
  const playableSong = policy.playerEligible
    ? resource.currentlyPlaying
      ?? (policy.queueVisible ? resource.queue.items[0] : undefined)
      ?? (policy.playlistsVisible
        ? resource.playlists.items.find((playlist) => playlist.songs.items.length > 0)?.songs.items[0]
        : undefined)
    : undefined;
  const selectableSongs = policy.playerEligible
    ? [
      ...(policy.currentVisible && resource.currentlyPlaying ? [resource.currentlyPlaying] : []),
      ...(policy.queueVisible ? resource.queue.items : []),
      ...(policy.playlistsVisible ? resource.playlists.items.flatMap((playlist) => playlist.songs.items) : []),
    ]
    : [];
  const selectedSong = selectableSongs.find(({ id }) => id === selectedSongId) ?? playableSong;
  const selectedSource: "current" | "queue" | "playlist" = selectedSongId
    ? resource.queue.items.some(({ id }) => id === selectedSongId) ? "queue" : "playlist"
    : "current";
  const requestEligible = policy.requestEligible && Boolean(publicSlug) && !requestRevoked;
  const hasVisibleContent = requestEligible
    || policy.currentVisible
    || (policy.queueVisible && resource.queue.items.length > 0)
    || (policy.historyVisible && resource.recentlyPlayed.items.length > 0)
    || (policy.playlistsVisible && resource.playlists.items.length > 0);
  const requestEngagement = useSectionEngagement("request", requestEligible, onAnalytics);
  const playerEngagement = useSectionEngagement("player", Boolean(playableSong), onAnalytics);
  const queueEngagement = useSectionEngagement("queue", hasVisibleContent && policy.queueVisible, onAnalytics);
  const playlistsEngagement = useSectionEngagement("playlists", hasVisibleContent && policy.playlistsVisible, onAnalytics);
  const historyEngagement = useSectionEngagement("history", hasVisibleContent && policy.historyVisible, onAnalytics);

  useLayoutEffect(() => {
    const revoked = previousPlayerEligible.current && !policy.playerEligible;
    previousPlayerEligible.current = policy.playerEligible;
    if (policy.playerEligible) setRevocationAnnouncement("");
    if (!revoked || !playerHasFocus.current) return;
    playerHasFocus.current = false;
    setRevocationAnnouncement("Playback on this device is no longer available.");
    document.getElementById(headingId)?.focus();
  }, [headingId, policy.playerEligible]);
  useLayoutEffect(() => {
    const revoked = previousRequestEligible.current && !requestEligible;
    previousRequestEligible.current = requestEligible;
    if (!revoked) return;
    setRevocationAnnouncement("Song requests are no longer available.");
    if (!requestHasFocus.current) return;
    requestHasFocus.current = false;
    document.getElementById(headingId)?.focus();
  }, [headingId, requestEligible]);
  const revokeRequest = () => {
    setRequestRevoked(true);
    onReconcile?.();
  };
  const revocationStatus = revocationAnnouncement
    ? <p role="status" aria-live="polite" className="sr-only">{revocationAnnouncement}</p>
    : null;

  if (!hasVisibleContent) {
    return (
      <>
        <div className="mt-8 rounded-xl bg-dashboard-card/60 px-5 py-10 text-center">
          <p className="text-base text-dashboard-text-muted">Nothing has been shared here yet</p>
        </div>
        {revocationStatus}
      </>
    );
  }

  return (
    <div className="mt-8 grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)]">
      {requestEligible && publicSlug ? <div {...requestEngagement} onFocusCapture={(event) => { requestHasFocus.current = true; requestEngagement.onFocusCapture(event); }} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) requestHasFocus.current = false; requestEngagement.onBlurCapture(event); }}><PublicMusicRequest publicSlug={publicSlug} capability={capability} allowed client={requestClient} onCanonicalRevoked={revokeRequest} onRequestOutcome={(outcome) => onAnalytics?.({ name: "request_submitted", outcome })} /></div> : null}
      {playableSong ? (
        <section
          className="min-w-0"
          data-testid="public-music-player"
          aria-labelledby="public-music-player-heading"
          {...playerEngagement}
          onFocusCapture={(event) => { playerHasFocus.current = true; playerEngagement.onFocusCapture(event); }}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) playerHasFocus.current = false;
            playerEngagement.onBlurCapture(event);
          }}
        >
          <h2 id="public-music-player-heading" className="text-xl font-semibold">Play on this device</h2>
          {selectedSong ? <PublicMusicPlayer key={selectedSong.id} song={selectedSong} allowed={policy.playerEligible} onPlaybackStart={() => onAnalytics?.({ name: "playback_started", source: selectedSource })} /> : null}
        </section>
      ) : null}

      {revocationStatus}

      {policy.queueVisible ? (
        <section className="min-w-0" aria-labelledby="public-music-queue-heading" {...queueEngagement}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="public-music-queue-heading" className="text-xl font-semibold">Up next</h2>
            <CollectionSummary shown={resource.queue.items.length} total={resource.queue.total} />
          </div>
          {!policy.playerEligible && policy.currentVisible && resource.currentlyPlaying ? (
            <div className="mt-3 flex min-h-16 min-w-0 items-center gap-3 rounded-xl bg-dashboard-card p-4">
              <SongArtwork song={resource.currentlyPlaying} />
              <span className="min-w-0">
                <span className="block text-xs font-semibold uppercase tracking-wide text-dashboard-accent">Playing now</span>
                <SongDetails song={resource.currentlyPlaying} />
              </span>
            </div>
          ) : null}
          {resource.queue.items.length > 0 ? (
            <ol className="mt-3 divide-y divide-dashboard-border" aria-label="Up next">
              {resource.queue.items.map((song) => (
                <SongRow
                  key={song.id}
                  song={song}
                  playable={policy.playerEligible}
                  selected={selectedSong?.id === song.id}
                  onSelect={(selection) => { setSelectedSongId(selection.id); onAnalytics?.({ name: "song_selected", source: "queue" }); }}
                />
              ))}
            </ol>
          ) : <p className="mt-3 text-dashboard-text-muted">Nothing queued yet</p>}
        </section>
      ) : null}

      {policy.playlistsVisible ? (
        <section className="min-w-0" aria-labelledby="public-music-playlists-heading" {...playlistsEngagement}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="public-music-playlists-heading" className="text-xl font-semibold">Shared playlists</h2>
            <CollectionSummary shown={resource.playlists.items.length} total={resource.playlists.total} noun="playlists" />
          </div>
          {resource.playlists.items.length === 0 ? (
            <p className="mt-3 text-dashboard-text-muted">No shared playlists yet</p>
          ) : (
            <div className="mt-4 grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-1">
              {resource.playlists.items.map((playlist) => (
                <article key={playlist.id} className="min-w-0 rounded-xl bg-dashboard-card p-5">
                  <h3 className="truncate text-lg font-semibold">{playlist.name}</h3>
                  {playlist.description ? <p className="mt-1 break-words text-sm text-dashboard-text-muted">{playlist.description}</p> : null}
                  <CollectionSummary shown={playlist.songs.items.length} total={playlist.songs.total} noun="songs" />
                  {playlist.songs.items.length > 0 ? (
                    <ol className="mt-3 divide-y divide-dashboard-border" aria-label={`${playlist.name} songs`}>
                      {playlist.songs.items.map((song) => (
                        <SongRow
                          key={song.id}
                          song={song}
                          playable={policy.playerEligible}
                          selected={selectedSong?.id === song.id}
                          onSelect={(selection) => { setSelectedSongId(selection.id); onAnalytics?.({ name: "playlist_opened" }); onAnalytics?.({ name: "song_selected", source: "playlist" }); }}
                        />
                      ))}
                    </ol>
                  ) : <p className="mt-3 text-sm text-dashboard-text-muted">No songs in this playlist yet</p>}
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {policy.historyVisible ? (
        <section className="min-w-0" aria-labelledby="public-music-history-heading" {...historyEngagement}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="public-music-history-heading" className="text-xl font-semibold">Recently played</h2>
            <CollectionSummary shown={resource.recentlyPlayed.items.length} total={resource.recentlyPlayed.total} />
          </div>
          {resource.recentlyPlayed.items.length > 0 ? (
            <ol className="mt-3 divide-y divide-dashboard-border" aria-label="Recently played">
              {resource.recentlyPlayed.items.map((song) => <SongRow key={song.id} song={song} />)}
            </ol>
          ) : <p className="mt-3 text-dashboard-text-muted">Nothing played recently</p>}
        </section>
      ) : null}
    </div>
  );
}
