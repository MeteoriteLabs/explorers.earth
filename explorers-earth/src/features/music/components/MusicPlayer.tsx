import { useCallback, useEffect, useRef, useState } from "react";
import ReactPlayer from "react-player";
import type { MusicSong } from "../musicWorkspaceClient";

interface PlayerQueueClient {
  setPlaying(songId: number | null, idempotencyKey: string): Promise<void | MusicSong>;
}

export interface MusicPlayerProps {
  currentSong: MusicSong | null;
  queuedSongs: MusicSong[];
  playedSongs: MusicSong[];
  queueClient: PlayerQueueClient;
  onChanged: () => void | Promise<void>;
  broadcastPlayerState?: (state: { songId: number; playing: boolean }) => void | Promise<void>;
  readOnly?: boolean;
}

const controlSize = { minWidth: "44px", minHeight: "44px" };
const idempotencyKey = (operation: string) => `music-player-${operation}-${crypto.randomUUID()}`;
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;

export function MusicPlayer({ currentSong, queuedSongs, playedSongs, queueClient, onChanged, broadcastPlayerState, readOnly = false }: MusicPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [transitionPending, setTransitionPending] = useState(false);
  const recoveryAttempts = useRef(0);
  const skippedSongId = useRef<number | null>(null);
  const mediaRef = useRef<HTMLVideoElement | null>(null);
  const recoveryTimers = useRef(new Set<number>());
  const generation = useRef(0);
  const transitionLock = useRef(false);
  const playAfterChange = useRef<number | null>(null);
  const mounted = useRef(true);
  const currentSongId = currentSong?.id ?? null;
  const previousSong = playedSongs.reduce<MusicSong | undefined>((latest, song) => {
    if (!latest) return song;
    const latestTime = latest.playedAt ? Date.parse(latest.playedAt) : 0;
    const songTime = song.playedAt ? Date.parse(song.playedAt) : 0;
    return songTime > latestTime || (songTime === latestTime && song.id > latest.id) ? song : latest;
  }, undefined);

  const clearRecovery = useCallback(() => {
    recoveryTimers.current.forEach((timer) => window.clearTimeout(timer));
    recoveryTimers.current.clear();
  }, []);

  useEffect(() => {
    generation.current += 1;
    clearRecovery();
    const shouldPlay = currentSongId !== null && playAfterChange.current === currentSongId;
    playAfterChange.current = null;
    setPlaying(shouldPlay); setProgress(0); setDuration(0); setMessage(""); setError("");
    recoveryAttempts.current = 0; skippedSongId.current = null;
  }, [clearRecovery, currentSongId]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; generation.current += 1; clearRecovery(); transitionLock.current = false; };
  }, [clearRecovery]);

  const broadcast = useCallback(async (songId: number, isPlaying: boolean) => {
    if (readOnly) return;
    try { await broadcastPlayerState?.({ songId, playing: isPlaying }); } catch { /* Socket notification is optional. */ }
  }, [broadcastPlayerState, readOnly]);

  const transition = useCallback(async (song: MusicSong | undefined, operation: "next" | "previous" | "skip") => {
    if (!song || transitionLock.current) return;
    transitionLock.current = true; setTransitionPending(true); setError("");
    const operationGeneration = generation.current;
    try {
      await queueClient.setPlaying(song.id, idempotencyKey(operation));
    } catch {
      if (operation === "skip") clearRecovery();
      if (generation.current === operationGeneration) {
        setError("Could not change songs. Try again.");
      }
      transitionLock.current = false; if (mounted.current) setTransitionPending(false);
      return;
    }
    if (generation.current === operationGeneration) playAfterChange.current = song.id;
    try { await onChanged(); }
    catch { if (generation.current === operationGeneration) setError("Song changed, but the latest queue could not be loaded."); }
    finally {
      if (operation === "skip") clearRecovery();
      transitionLock.current = false; if (mounted.current) setTransitionPending(false);
    }
  }, [clearRecovery, onChanged, queueClient]);

  const finish = useCallback(async () => {
    if (!currentSong || transitionLock.current) return;
    transitionLock.current = true; setTransitionPending(true); setError(""); setPlaying(false); clearRecovery();
    const operationGeneration = generation.current;
    try { await queueClient.setPlaying(null, idempotencyKey("ended")); }
    catch {
      if (generation.current === operationGeneration) {
        skippedSongId.current = null;
        setError("Could not finish this song. Try again.");
      }
      transitionLock.current = false; if (mounted.current) setTransitionPending(false);
      return;
    }
    if (generation.current === operationGeneration) await broadcast(currentSong.id, false);
    try { await onChanged(); }
    catch { if (generation.current === operationGeneration) setError("Song finished, but the latest history could not be loaded."); }
    finally { transitionLock.current = false; if (mounted.current) setTransitionPending(false); }
  }, [broadcast, clearRecovery, currentSong, onChanged, queueClient]);

  const handleMediaError = useCallback((cause: unknown) => {
    if (cause instanceof DOMException && cause.name === "NotAllowedError") {
      clearRecovery(); setPlaying(false); setMessage("Press play to start this song."); return;
    }
    if (!currentSong || skippedSongId.current === currentSong.id || transitionLock.current) return;
    if (recoveryAttempts.current < 2) {
      recoveryAttempts.current += 1;
      setPlaying(false);
      const songGeneration = generation.current;
      const recoverySongId = currentSong.id;
      const timer = window.setTimeout(() => {
        recoveryTimers.current.delete(timer);
        if (generation.current === songGeneration && skippedSongId.current !== recoverySongId) setPlaying(true);
      }, 250 * recoveryAttempts.current);
      recoveryTimers.current.add(timer);
      return;
    }
    skippedSongId.current = currentSong.id;
    clearRecovery(); setPlaying(false);
    if (queuedSongs[0]) {
      setMessage(`${currentSong.title} is unavailable. Skipping once.`);
      void transition(queuedSongs[0], "skip");
    } else {
      setMessage(`${currentSong.title} is unavailable. Finishing playback.`);
      void finish();
    }
  }, [clearRecovery, currentSong, finish, queuedSongs, transition]);

  if (!currentSong) return <section aria-label="Music player"><p role="status">Choose a song to start listening.</p></section>;

  return (
    <section aria-label="Music player" className="space-y-4 motion-reduce:transition-none">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-lg font-semibold text-dashboard">{currentSong.title}</h2><p className="truncate text-sm text-dashboard-muted">{currentSong.artist}</p></div><button type="button" style={controlSize} aria-label={showVideo ? "Hide video" : "Show video"} aria-pressed={showVideo} onClick={() => setShowVideo((visible) => !visible)} className="shrink-0 rounded-xl border border-dashboard bg-dashboard-muted px-3 text-sm font-semibold text-dashboard">{showVideo ? "Hide video" : "Show video"}</button></div>
      <div data-testid="video-surface" aria-hidden={!showVideo} className={showVideo ? "mt-4 aspect-video overflow-hidden rounded-xl" : "h-0 overflow-hidden opacity-0 pointer-events-none"}>
      <ReactPlayer
        ref={mediaRef}
        src={`https://www.youtube.com/watch?v=${currentSong.youtubeId}`}
        playing={playing}
        volume={volume}
        muted={muted}
        width="100%"
        height="auto"
        onPlay={() => { clearRecovery(); setPlaying(true); void broadcast(currentSong.id, true); }}
        onPause={() => { setPlaying(false); void broadcast(currentSong.id, false); }}
        onEnded={() => { if (readOnly) { setPlaying(false); setMessage("Reconnect to continue the queue."); } else if (queuedSongs[0]) void transition(queuedSongs[0], "next"); else void finish(); }}
        onError={handleMediaError}
        onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime || 0)}
      />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button type="button" style={controlSize} aria-label="Previous song" disabled={readOnly || !previousSong || transitionPending} onClick={() => { void transition(previousSong, "previous"); }} className="rounded-xl border border-dashboard bg-dashboard-muted px-3 text-sm font-semibold disabled:opacity-45">Previous</button>
        <button type="button" style={controlSize} aria-label={playing ? "Pause" : "Play"} onClick={() => { setMessage(""); setPlaying((value) => !value); }} className="rounded-xl bg-dashboard-accent px-3 text-sm font-semibold text-[var(--dash-accent-text)]">{playing ? "Pause" : "Play"}</button>
        <button type="button" style={controlSize} aria-label="Next song" disabled={readOnly || !queuedSongs[0] || transitionPending} onClick={() => { void transition(queuedSongs[0], "next"); }} className="rounded-xl border border-dashboard bg-dashboard-muted px-3 text-sm font-semibold disabled:opacity-45">Next</button>
      </div>
      <label className="grid gap-1 text-sm font-medium text-dashboard"><span className="flex justify-between"><span>Playback position</span><span className="text-dashboard-muted">{clock(progress)} / {clock(duration)}</span></span>
        <input className="w-full accent-dashboard-accent" style={{ minHeight: "44px" }} aria-label="Playback position" type="range" min="0" max={duration || 0} value={progress} aria-valuetext={`${clock(progress)} of ${clock(duration)}`} onChange={(event) => {
          const nextTime = Number(event.target.value); setProgress(nextTime);
          if (mediaRef.current) mediaRef.current.currentTime = nextTime;
        }} />
      </label>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
        <label className="grid gap-1 text-sm font-medium text-dashboard"><span>Volume</span>
          <input className="w-full accent-dashboard-accent" style={{ minHeight: "44px" }} aria-label="Volume" type="range" min="0" max="100" value={Math.round(volume * 100)} aria-valuetext={`${Math.round(volume * 100)} percent`} onChange={(event) => setVolume(Number(event.target.value) / 100)} />
        </label>
        <button type="button" style={controlSize} aria-label={muted ? "Unmute" : "Mute"} onClick={() => setMuted((value) => !value)} className="rounded-xl border border-dashboard bg-dashboard-muted px-3 text-sm font-semibold">{muted ? "Unmute" : "Mute"}</button>
      </div>
      {message && <p role="status" aria-live="polite">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
