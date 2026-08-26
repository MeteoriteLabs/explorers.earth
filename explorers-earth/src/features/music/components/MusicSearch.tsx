import { useState } from "react";
import type { YouTubeSearchResponse, YouTubeVideo } from "../musicSearchClient";
import type { MusicSongInput } from "../musicQueueClient";
import type { MusicSong } from "../musicWorkspaceClient";

type SearchClient = {
  searchYouTube(query: string, pageToken?: string): Promise<YouTubeSearchResponse>;
  videoFromUrl(url: string): Promise<YouTubeVideo>;
};
type QueueClient = {
  addSong(song: MusicSongInput, idempotencyKey: string): Promise<MusicSong>;
  setPlaying(songId: number | null, idempotencyKey: string): Promise<void | MusicSong>;
};

export interface MusicSearchProps {
  searchClient: SearchClient;
  queueClient: QueueClient;
  onChanged: () => void | Promise<void>;
}

const key = (operation: string) => `music-${operation}-${crypto.randomUUID()}`;
const songInput = (video: YouTubeVideo): MusicSongInput => ({
  youtubeId: video.id.videoId,
  title: video.snippet.title,
  artist: video.snippet.channelTitle,
  thumbnailUrl: video.snippet.thumbnails.default.url,
});

export function MusicSearch({ searchClient, queueClient, onChanged }: MusicSearchProps) {
  const [mode, setMode] = useState<"search" | "url">("search");
  const [query, setQuery] = useState("");
  const [url, setUrl] = useState("");
  const [results, setResults] = useState<YouTubeVideo[] | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSearch(pageToken?: string) {
    if (!query.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await searchClient.searchYouTube(query.trim(), pageToken);
      setResults(response.items);
      setNextPageToken(response.nextPageToken);
      setSelected(new Set());
    } catch {
      setError("Music search is temporarily unavailable. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function lookupUrl() {
    if (!url.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      setResults([await searchClient.videoFromUrl(url.trim())]);
      setNextPageToken(null);
      setSelected(new Set());
    } catch {
      setError("Music lookup is temporarily unavailable. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function add(videos: YouTubeVideo[], playNow = false) {
    if (busy || videos.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      let firstAdded: MusicSong | undefined;
      for (const video of videos) {
        const added = await queueClient.addSong(songInput(video), key("add"));
        firstAdded ??= added;
      }
      if (playNow && firstAdded) await queueClient.setPlaying(firstAdded.id, key("play"));
      await onChanged();
      setSelected(new Set());
    } catch {
      setError("Queue update failed. The current queue was reloaded.");
      try { await onChanged(); } catch { /* The visible error already contains reconciliation failure. */ }
    } finally {
      setBusy(false);
    }
  }

  const selectedVideos = (results ?? []).filter((video) => selected.has(video.id.videoId));
  return <section aria-labelledby="music-search-heading" className="space-y-4">
    <h2 id="music-search-heading" className="text-xl font-semibold">Find music</h2>
    <div role="tablist" aria-label="Find music by">
      <button type="button" role="tab" aria-selected={mode === "search"} onClick={() => setMode("search")} className="min-h-11 px-4">Search</button>
      <button type="button" role="tab" aria-selected={mode === "url"} onClick={() => setMode("url")} className="min-h-11 px-4">URL</button>
    </div>
    {mode === "search" ? <form onSubmit={(event) => { event.preventDefault(); void runSearch(); }} className="flex gap-2">
      <label className="flex-1">Search music<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} className="min-h-11 w-full" /></label>
      <button type="submit" disabled={busy || !query.trim()} className="min-h-11 px-4">Search</button>
    </form> : <form onSubmit={(event) => { event.preventDefault(); void lookupUrl(); }} className="flex gap-2">
      <label className="flex-1">YouTube URL<input type="url" value={url} onChange={(event) => setUrl(event.target.value)} className="min-h-11 w-full" /></label>
      <button type="submit" disabled={busy || !url.trim()} className="min-h-11 px-4">Look up</button>
    </form>}
    {error && <div role="alert" className="space-y-2"><p>{error}</p>{mode === "search" && <button type="button" onClick={() => void runSearch()} className="min-h-11 px-4">Try search again</button>}</div>}
    <div aria-live="polite" className="sr-only">{busy ? "Working" : ""}</div>
    {results?.length === 0 && <p>No music found.</p>}
    {results && results.length > 0 && <>
      <ul className="space-y-2">{results.map((video) => <li key={video.id.videoId} className="flex items-center gap-3">
        <input type="checkbox" aria-label={`Select ${video.snippet.title}`} checked={selected.has(video.id.videoId)} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(video.id.videoId)) next.delete(video.id.videoId); else next.add(video.id.videoId); return next; })} className="min-h-11 min-w-11" />
        <span className="flex-1"><strong>{video.snippet.title}</strong> <span>{video.snippet.channelTitle}</span></span>
        <button type="button" disabled={busy} onClick={() => void add([video], true)} aria-label={`Play ${video.snippet.title} now`} className="min-h-11 min-w-11 px-3">Play now</button>
      </li>)}</ul>
      <div className="flex gap-2">
        <button type="button" disabled={busy || selectedVideos.length === 0} onClick={() => void add(selectedVideos)} className="min-h-11 px-4">Add {selectedVideos.length} selected to queue</button>
        {nextPageToken && <button type="button" disabled={busy} onClick={() => void runSearch(nextPageToken)} className="min-h-11 px-4">Next page</button>}
      </div>
    </>}
  </section>;
}
