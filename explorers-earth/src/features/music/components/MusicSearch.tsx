import { useRef, useState, type KeyboardEvent } from "react";
import type { YouTubeSearchResponse, YouTubeVideo } from "../musicSearchClient";
import type { MusicSongInput } from "../musicQueueClient";
import type { MusicSong } from "../musicWorkspaceClient";

type SearchClient = { searchYouTube(query: string, pageToken?: string): Promise<YouTubeSearchResponse>; videoFromUrl(url: string): Promise<YouTubeVideo> };
type QueueClient = { addSong(song: MusicSongInput, idempotencyKey: string): Promise<MusicSong>; setPlaying(songId: number | null, idempotencyKey: string): Promise<void | MusicSong> };
export interface MusicSearchProps { searchClient: SearchClient; queueClient: QueueClient; onChanged: () => void | Promise<void> }
type Mode = "search" | "url";
type ErrorKind = "search" | "lookup" | "queue" | "refresh" | null;
type PendingPlay = { songId: number; youtubeId: string; title: string; phase: "play" | "refresh" };
const key = (operation: string) => `music-${operation}-${crypto.randomUUID()}`;
const songInput = (video: YouTubeVideo): MusicSongInput => ({ youtubeId: video.id.videoId, title: video.snippet.title, artist: video.snippet.channelTitle, thumbnailUrl: video.snippet.thumbnails.default.url });

export function MusicSearch({ searchClient, queueClient, onChanged }: MusicSearchProps) {
  const [mode, setMode] = useState<Mode>("search");
  const [query, setQuery] = useState("");
  const [url, setUrl] = useState("");
  const [results, setResults] = useState<YouTubeVideo[] | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchBusy, setSearchBusy] = useState(false);
  const [mutationBusy, setMutationBusy] = useState(false);
  const [error, setError] = useState<ErrorKind>(null);
  const [pendingPlay, setPendingPlay] = useState<PendingPlay | null>(null);
  const generation = useRef(0);
  const requestLock = useRef<number | null>(null);
  const searchTab = useRef<HTMLButtonElement>(null);
  const urlTab = useRef<HTMLButtonElement>(null);

  const invalidateDiscovery = () => { generation.current += 1; requestLock.current = null; setSearchBusy(false); setResults(null); setNextPageToken(null); setSelected(new Set()); setError(null); };
  const chooseMode = (next: Mode) => { if (next !== mode) invalidateDiscovery(); setMode(next); };
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    let next: Mode | null = null;
    const focusedMode: Mode = event.currentTarget === searchTab.current ? "search" : "url";
    if (event.key === "ArrowRight") next = focusedMode === "search" ? "url" : "search";
    if (event.key === "ArrowLeft") next = focusedMode === "search" ? "url" : "search";
    if (event.key === "End") next = "url";
    if (event.key === "Home") next = "search";
    if (!next) return;
    event.preventDefault(); chooseMode(next); (next === "search" ? searchTab : urlTab).current?.focus();
  };

  async function runSearch(pageToken?: string) {
    const snapshot = { mode: "search" as const, query: query.trim(), pageToken };
    if (!snapshot.query || requestLock.current !== null) return;
    const requestGeneration = ++generation.current; requestLock.current = requestGeneration; setSearchBusy(true); setError(null);
    try {
      const response = await searchClient.searchYouTube(snapshot.query, snapshot.pageToken);
      if (generation.current !== requestGeneration) return;
      setResults(response.items); setNextPageToken(response.nextPageToken); setSelected(new Set());
    } catch { if (generation.current === requestGeneration) setError("search"); }
    finally { if (requestLock.current === requestGeneration) requestLock.current = null; if (generation.current === requestGeneration) setSearchBusy(false); }
  }
  async function lookupUrl() {
    const snapshot = { mode: "url" as const, url: url.trim() };
    if (!snapshot.url || requestLock.current !== null) return;
    const requestGeneration = ++generation.current; requestLock.current = requestGeneration; setSearchBusy(true); setError(null);
    try {
      const video = await searchClient.videoFromUrl(snapshot.url);
      if (generation.current !== requestGeneration) return;
      setResults([video]); setNextPageToken(null); setSelected(new Set());
    } catch { if (generation.current === requestGeneration) setError("lookup"); }
    finally { if (requestLock.current === requestGeneration) requestLock.current = null; if (generation.current === requestGeneration) setSearchBusy(false); }
  }
  async function reconcile() { try { await onChanged(); } catch { /* Visible mutation error remains authoritative. */ } }
  const markCommitted = (youtubeId: string) => setSelected((current) => { const next = new Set(current); next.delete(youtubeId); return next; });

  async function refreshCommitted(play: PendingPlay) {
    const refreshing = { ...play, phase: "refresh" as const };
    setPendingPlay(refreshing);
    try { await onChanged(); setPendingPlay(null); setError(null); }
    catch { setPendingPlay(refreshing); setError("refresh"); }
  }
  async function retryRefresh() {
    if (mutationBusy) return;
    setMutationBusy(true);
    try { await onChanged(); setPendingPlay(null); setError(null); }
    catch { setError("refresh"); }
    finally { setMutationBusy(false); }
  }
  async function retryPlaying(play: PendingPlay) {
    if (mutationBusy) return;
    setMutationBusy(true); setError(null);
    try { await queueClient.setPlaying(play.songId, key("play")); await refreshCommitted(play); }
    catch { setError("queue"); await reconcile(); }
    finally { setMutationBusy(false); }
  }
  async function add(videos: YouTubeVideo[], playNow = false) {
    if (mutationBusy || videos.length === 0) return;
    setMutationBusy(true); setError(null);
    try {
      for (const video of videos) {
        const added = await queueClient.addSong(songInput(video), key("add"));
        markCommitted(video.id.videoId);
        if (playNow) {
          const play: PendingPlay = { songId: added.id, youtubeId: video.id.videoId, title: video.snippet.title, phase: "play" };
          setPendingPlay(play);
          try { await queueClient.setPlaying(added.id, key("play")); await refreshCommitted(play); }
          catch { setError("queue"); await reconcile(); return; }
          return;
        }
      }
      await onChanged();
    } catch { setError("queue"); await reconcile(); }
    finally { setMutationBusy(false); }
  }

  const selectedVideos = (results ?? []).filter((video) => selected.has(video.id.videoId));
  const errorText = error === "search" ? "Music search is temporarily unavailable. Try again." : error === "lookup" ? "Music lookup is temporarily unavailable. Try again." : error === "queue" ? "Queue update failed. The current queue was reloaded." : error === "refresh" ? "The song was queued and played, but the latest queue could not be loaded." : null;
  return <section aria-labelledby="music-search-heading" className="space-y-4">
    <h2 id="music-search-heading" className="text-xl font-semibold">Find music</h2>
    <div role="tablist" aria-label="Find music by">
      <button ref={searchTab} id="music-search-tab" type="button" role="tab" aria-selected={mode === "search"} aria-controls="music-search-panel" tabIndex={mode === "search" ? 0 : -1} onKeyDown={onTabKey} onClick={() => chooseMode("search")} className="min-h-11 px-4">Search</button>
      <button ref={urlTab} id="music-url-tab" type="button" role="tab" aria-selected={mode === "url"} aria-controls="music-url-panel" tabIndex={mode === "url" ? 0 : -1} onKeyDown={onTabKey} onClick={() => chooseMode("url")} className="min-h-11 px-4">URL</button>
    </div>
    <div role="tabpanel" id={mode === "search" ? "music-search-panel" : "music-url-panel"} aria-labelledby={mode === "search" ? "music-search-tab" : "music-url-tab"}>
      {mode === "search" ? <form onSubmit={(event) => { event.preventDefault(); void runSearch(); }} className="flex gap-2">
        <label className="flex-1">Search music<input type="search" value={query} onChange={(event) => { setQuery(event.target.value); invalidateDiscovery(); }} className="min-h-11 w-full" /></label>
        <button type="submit" disabled={searchBusy || !query.trim()} className="min-h-11 px-4">Search</button>
      </form> : <form onSubmit={(event) => { event.preventDefault(); void lookupUrl(); }} className="flex gap-2">
        <label className="flex-1">YouTube URL<input type="url" value={url} onChange={(event) => { setUrl(event.target.value); invalidateDiscovery(); }} className="min-h-11 w-full" /></label>
        <button type="submit" disabled={searchBusy || !url.trim()} className="min-h-11 px-4">Look up</button>
      </form>}
    </div>
    {errorText && <div role="alert" className="space-y-2"><p>{errorText}</p>{error === "search" && <button type="button" onClick={() => void runSearch()} className="min-h-11 px-4">Try search again</button>}{error === "refresh" && <button type="button" disabled={mutationBusy} onClick={() => void retryRefresh()} className="min-h-11 px-4">Retry refreshing queue</button>}</div>}
    <div aria-live="polite" className="sr-only">{searchBusy ? "Searching" : mutationBusy ? "Updating queue" : ""}</div>
    {results?.length === 0 && <p>No music found.</p>}
    {results && results.length > 0 && <>
      <ul className="space-y-2">{results.map((video) => { const pending = pendingPlay?.youtubeId === video.id.videoId ? pendingPlay : null; return <li key={video.id.videoId} className="flex items-center gap-3">
        <input type="checkbox" aria-label={`Select ${video.snippet.title}`} checked={selected.has(video.id.videoId)} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(video.id.videoId)) next.delete(video.id.videoId); else next.add(video.id.videoId); return next; })} className="min-h-11 min-w-11" />
        <span className="flex-1"><strong>{video.snippet.title}</strong> <span>{video.snippet.channelTitle}</span></span>
        <button type="button" disabled={mutationBusy || pending?.phase === "refresh"} onClick={() => pending?.phase === "play" ? void retryPlaying(pending) : void add([video], true)} aria-label={pending?.phase === "play" ? `Retry playing ${video.snippet.title}` : pending?.phase === "refresh" ? `${video.snippet.title} is playing` : `Play ${video.snippet.title} now`} className="min-h-11 min-w-11 px-3">{pending?.phase === "play" ? "Retry play" : pending?.phase === "refresh" ? "Playing" : "Play now"}</button>
      </li>; })}</ul>
      <div className="flex gap-2">
        <button type="button" disabled={mutationBusy || selectedVideos.length === 0} onClick={() => void add(selectedVideos)} className="min-h-11 px-4">Add {selectedVideos.length} selected to queue</button>
        {nextPageToken && <button type="button" disabled={searchBusy} onClick={() => void runSearch(nextPageToken)} className="min-h-11 px-4">Next page</button>}
      </div>
    </>}
  </section>;
}
