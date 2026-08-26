import { useRef, useState } from "react";
import type { MusicSong } from "../musicWorkspaceClient";

interface HistoryQueueClient { clearHistory(idempotencyKey: string): Promise<void> }
export interface MusicHistoryProps {
  songs: MusicSong[];
  loading?: boolean;
  queueClient: HistoryQueueClient;
  onChanged: () => void | Promise<void>;
}

export function MusicHistory({ songs, loading = false, queueClient, onChanged }: MusicHistoryProps) {
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);

  const clear = async () => {
    if (lock.current) return;
    lock.current = true; setClearing(true); setError("");
    try {
      try { await queueClient.clearHistory(`music-history-clear-${crypto.randomUUID()}`); }
      catch { setError("Could not clear history. Try again."); return; }
      try { await onChanged(); }
      catch { setError("History cleared, but the latest history could not be loaded."); }
    } finally { lock.current = false; setClearing(false); }
  };

  if (loading) return <section aria-label="Recently played"><p role="status" aria-live="polite">Loading listening history…</p></section>;
  if (songs.length === 0) return <section aria-label="Recently played"><p role="status">Songs you finish will appear here.</p></section>;

  return <section aria-label="Recently played">
    <ul aria-label="Recently played songs">{songs.map((song) => <li key={song.id}><strong>{song.title}</strong> <span>{song.artist}</span></li>)}</ul>
    <button type="button" style={{ minWidth: "44px", minHeight: "44px" }} disabled={clearing} onClick={() => { void clear(); }}>Clear history</button>
    {clearing && <p role="status" aria-live="polite">Clearing history…</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
