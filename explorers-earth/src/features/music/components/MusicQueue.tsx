import { useEffect, useRef, useState } from "react";
import type { MusicSong } from "../musicWorkspaceClient";

type QueueClient = {
  setPlaying(songId: number | null, idempotencyKey: string): Promise<void | MusicSong>;
  removeSong(songId: number, idempotencyKey: string): Promise<void>;
  removeSongs(songIds: number[], idempotencyKey: string): Promise<void>;
  moveSong(songId: number, position: number, idempotencyKey: string): Promise<MusicSong>;
};
export interface MusicQueueProps {
  songs: MusicSong[];
  client: QueueClient;
  onChanged: () => void | Promise<void>;
}
const key = (operation: string) => `music-${operation}-${crypto.randomUUID()}`;

export function MusicQueue({ songs, client, onChanged }: MusicQueueProps) {
  const [ordered, setOrdered] = useState(songs);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const canonicalRevision = useRef(0);
  const operationRevision = useRef(0);
  useEffect(() => {
    canonicalRevision.current += 1;
    setOrdered(songs);
  }, [songs]);

  async function mutate(operation: () => Promise<unknown>, failure = "Queue update failed. Try again.") {
    if (busy) return false;
    setBusy(true);
    setError(null);
    try {
      await operation();
      await onChanged();
      return true;
    } catch {
      setError(failure);
      try { await onChanged(); } catch { /* The visible error already contains reconciliation failure. */ }
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function move(index: number, target: number) {
    if (busy || target < 0 || target >= ordered.length || ordered[index]?.status !== "queued" || ordered[target]?.status !== "queued") return;
    const previous = ordered;
    const canonicalAtStart = canonicalRevision.current;
    const operation = ++operationRevision.current;
    const next = [...ordered];
    const [song] = next.splice(index, 1);
    next.splice(target, 0, song);
    setOrdered(next);
    setAnnouncement(`Moved ${song.title} to position ${target + 1}.`);
    setBusy(true);
    setError(null);
    try {
      await client.moveSong(song.id, target, key("move"));
      await onChanged();
    } catch {
      if (operationRevision.current === operation && canonicalRevision.current === canonicalAtStart) setOrdered(previous);
      setAnnouncement(`Could not move ${song.title}; the previous order was restored.`);
      setError("Queue update failed. Try again.");
      try { await onChanged(); } catch { /* The visible error contains reconciliation failure. */ }
    } finally {
      if (operationRevision.current === operation) setBusy(false);
    }
  }

  const selectedIds = ordered.filter((song) => selected.has(song.id)).map((song) => song.id);
  return <section aria-labelledby="music-queue-heading" className="space-y-4">
    <h2 id="music-queue-heading" className="text-xl font-semibold">Queue</h2>
    <div role="status" aria-live="polite" className="sr-only">{busy ? "Updating queue" : announcement}</div>
    {error && <p role="alert">{error}</p>}
    {ordered.length === 0 ? <p>Your queue is empty.</p> : <>
      <ul className="space-y-2">{ordered.map((song, index) => <li key={song.id} className="flex items-center gap-2">
        <input type="checkbox" aria-label={`Select ${song.title}`} checked={selected.has(song.id)} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(song.id)) next.delete(song.id); else next.add(song.id); return next; })} className="min-h-11 min-w-11" />
        <span className="flex-1"><strong>{song.title}</strong> <span>{song.artist}</span></span>
        <button type="button" disabled={busy} onClick={() => void mutate(() => client.setPlaying(song.id, key("play")))} aria-label={`Play ${song.title}`} className="min-h-11 min-w-11">Play</button>
        {song.status === "queued" && <>
          <button type="button" disabled={busy || index === 0 || ordered[index - 1]?.status !== "queued"} onClick={() => void move(index, index - 1)} aria-label={`Move ${song.title} up`} className="min-h-11 min-w-11">↑</button>
          <button type="button" disabled={busy || index === ordered.length - 1 || ordered[index + 1]?.status !== "queued"} onClick={() => void move(index, index + 1)} aria-label={`Move ${song.title} down`} className="min-h-11 min-w-11">↓</button>
        </>}
        <button type="button" disabled={busy} onClick={() => void mutate(() => client.removeSong(song.id, key("remove")))} aria-label={`Remove ${song.title}`} className="min-h-11 min-w-11">Remove</button>
      </li>)}</ul>
      <div className="flex gap-2">
        <button type="button" disabled={busy || selectedIds.length === 0} onClick={() => void mutate(async () => { await client.removeSongs(selectedIds, key("remove-many")); setSelected(new Set()); })} className="min-h-11 px-4">Remove {selectedIds.length} selected</button>
        <button type="button" disabled={busy || ordered.length === 0} onClick={() => void mutate(() => client.removeSongs(ordered.map((song) => song.id), key("clear")))} className="min-h-11 px-4">Clear queue</button>
      </div>
    </>}
  </section>;
}
