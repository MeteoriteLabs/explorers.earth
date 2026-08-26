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
}

const controlSize = { minWidth: "44px", minHeight: "44px" };
const idempotencyKey = (operation: string) => `music-player-${operation}-${crypto.randomUUID()}`;
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;

export function MusicPlayer({ currentSong, queuedSongs, playedSongs, queueClient, onChanged, broadcastPlayerState }: MusicPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const recoveryAttempts = useRef(0);
  const skippedSongId = useRef<number | null>(null);
  const mediaRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    setPlaying(false); setProgress(0); setDuration(0); setMessage(""); setError("");
    recoveryAttempts.current = 0; skippedSongId.current = null;
  }, [currentSong?.id]);

  const broadcast = useCallback(async (songId: number, isPlaying: boolean) => {
    try { await broadcastPlayerState?.({ songId, playing: isPlaying }); } catch { /* Socket notification is optional. */ }
  }, [broadcastPlayerState]);

  const transition = useCallback(async (song: MusicSong | undefined, operation: "next" | "previous" | "skip") => {
    if (!song) return;
    setError("");
    try {
      await queueClient.setPlaying(song.id, idempotencyKey(operation));
    } catch {
      setError("Could not change songs. Try again.");
      return;
    }
    await broadcast(song.id, true);
    try { await onChanged(); }
    catch { setError("Song changed, but the latest queue could not be loaded."); }
  }, [broadcast, onChanged, queueClient]);

  const finish = useCallback(async () => {
    if (!currentSong) return;
    setError(""); setPlaying(false);
    try { await queueClient.setPlaying(null, idempotencyKey("ended")); }
    catch { setError("Could not finish this song. Try again."); return; }
    await broadcast(currentSong.id, false);
    try { await onChanged(); }
    catch { setError("Song finished, but the latest history could not be loaded."); }
  }, [broadcast, currentSong, onChanged, queueClient]);

  const handleMediaError = useCallback((cause: unknown) => {
    if (cause instanceof DOMException && cause.name === "NotAllowedError") {
      setPlaying(false); setMessage("Press play to start this song."); return;
    }
    if (!currentSong || skippedSongId.current === currentSong.id) return;
    if (recoveryAttempts.current < 2) {
      recoveryAttempts.current += 1;
      setPlaying(false);
      window.setTimeout(() => setPlaying(true), 250 * recoveryAttempts.current);
      return;
    }
    skippedSongId.current = currentSong.id;
    setPlaying(false);
    setMessage(`${currentSong.title} is unavailable. Skipping once.`);
    void transition(queuedSongs[0], "skip");
  }, [currentSong, queuedSongs, transition]);

  if (!currentSong) return <section aria-label="Music player"><p role="status">Choose a song to start listening.</p></section>;

  return (
    <section aria-label="Music player" className="motion-reduce:transition-none">
      <h2>{currentSong.title}</h2><p>{currentSong.artist}</p>
      <ReactPlayer
        ref={mediaRef}
        src={`https://www.youtube.com/watch?v=${currentSong.youtubeId}`}
        playing={playing}
        volume={volume}
        muted={muted}
        width="100%"
        height="auto"
        onPlay={() => { setPlaying(true); void broadcast(currentSong.id, true); }}
        onPause={() => { setPlaying(false); void broadcast(currentSong.id, false); }}
        onEnded={() => { if (queuedSongs[0]) void transition(queuedSongs[0], "next"); else void finish(); }}
        onError={handleMediaError}
        onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime || 0)}
      />
      <div>
        <button type="button" style={controlSize} aria-label="Previous song" disabled={!playedSongs[0]} onClick={() => { void transition(playedSongs[0], "previous"); }}>Previous</button>
        <button type="button" style={controlSize} aria-label={playing ? "Pause" : "Play"} onClick={() => { setMessage(""); setPlaying((value) => !value); }}>{playing ? "Pause" : "Play"}</button>
        <button type="button" style={controlSize} aria-label="Next song" disabled={!queuedSongs[0]} onClick={() => { void transition(queuedSongs[0], "next"); }}>Next</button>
      </div>
      <label>Playback position
        <input style={{ minHeight: "44px" }} aria-label="Playback position" type="range" min="0" max={duration || 0} value={progress} aria-valuetext={`${clock(progress)} of ${clock(duration)}`} onChange={(event) => {
          const nextTime = Number(event.target.value); setProgress(nextTime);
          if (mediaRef.current) mediaRef.current.currentTime = nextTime;
        }} />
      </label>
      <label>Volume
        <input style={{ minHeight: "44px" }} aria-label="Volume" type="range" min="0" max="100" value={Math.round(volume * 100)} aria-valuetext={`${Math.round(volume * 100)} percent`} onChange={(event) => setVolume(Number(event.target.value) / 100)} />
      </label>
      <button type="button" style={controlSize} aria-label={muted ? "Unmute" : "Mute"} onClick={() => setMuted((value) => !value)}>{muted ? "Unmute" : "Mute"}</button>
      {message && <p role="status" aria-live="polite">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
