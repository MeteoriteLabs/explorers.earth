import type { PublicMusicResource, PublicMusicSong } from "../publicMusicClient";
import { derivePublicMusicViewPolicy } from "../publicMusicViewPolicy";

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

function SongRow({ song }: { song: PublicMusicSong }) {
  return (
    <li className="flex min-h-11 min-w-0 items-center gap-3 py-3">
      <SongArtwork song={song} />
      <SongDetails song={song} />
    </li>
  );
}

export function PublicMusicSections({ resource }: { resource: PublicMusicResource }) {
  const policy = derivePublicMusicViewPolicy(resource);
  const playableSong = policy.playerEligible
    ? resource.currentlyPlaying
      ?? (policy.queueVisible ? resource.queue.items[0] : undefined)
      ?? (policy.playlistsVisible
        ? resource.playlists.items.find((playlist) => playlist.songs.items.length > 0)?.songs.items[0]
        : undefined)
    : undefined;
  const hasVisibleContent = policy.currentVisible
    || (policy.queueVisible && resource.queue.items.length > 0)
    || (policy.historyVisible && resource.recentlyPlayed.items.length > 0)
    || (policy.playlistsVisible && resource.playlists.items.length > 0);

  if (!hasVisibleContent) {
    return (
      <div className="mt-8 rounded-xl bg-dashboard-card/60 px-5 py-10 text-center">
        <p className="text-base text-dashboard-text-muted">Nothing has been shared here yet</p>
      </div>
    );
  }

  return (
    <div className="mt-8 grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)]">
      {playableSong ? (
        <section className="min-w-0" data-testid="public-music-player" aria-labelledby="public-music-player-heading">
          <h2 id="public-music-player-heading" className="text-xl font-semibold">Play on this device</h2>
          <div className="mt-3 flex min-h-16 min-w-0 items-center gap-3 rounded-xl bg-dashboard-card p-4">
            <SongArtwork song={playableSong} />
            <SongDetails song={playableSong} />
          </div>
        </section>
      ) : null}

      {policy.queueVisible ? (
        <section className="min-w-0" aria-labelledby="public-music-queue-heading">
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
              {resource.queue.items.map((song) => <SongRow key={song.id} song={song} />)}
            </ol>
          ) : <p className="mt-3 text-dashboard-text-muted">Nothing queued yet</p>}
        </section>
      ) : null}

      {policy.playlistsVisible ? (
        <section className="min-w-0" aria-labelledby="public-music-playlists-heading">
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
                      {playlist.songs.items.map((song) => <SongRow key={song.id} song={song} />)}
                    </ol>
                  ) : <p className="mt-3 text-sm text-dashboard-text-muted">No songs in this playlist yet</p>}
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {policy.historyVisible ? (
        <section className="min-w-0" aria-labelledby="public-music-history-heading">
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
