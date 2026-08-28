import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import ReactPlayer from "react-player";
import type { PublicMusicSong } from "../publicMusicClient";

export interface PublicMusicPlayerProps {
  song: PublicMusicSong;
  allowed?: boolean;
  onPlaybackStart?: () => void;
}

function mediaErrorMessage(cause: unknown): string | null {
  if (cause instanceof DOMException && cause.name === "NotAllowedError") return null;
  const code = typeof cause === "object" && cause !== null && "currentTarget" in cause
    && typeof cause.currentTarget === "object" && cause.currentTarget !== null && "error" in cause.currentTarget
    && typeof cause.currentTarget.error === "object" && cause.currentTarget.error !== null && "code" in cause.currentTarget.error
    && typeof cause.currentTarget.error.code === "number"
    ? cause.currentTarget.error.code
    : undefined;
  if (code === 100) {
    return "This video is no longer available. Choose another track.";
  }
  if (code === 101 || code === 150) {
    return "This video cannot be played here. Choose another track.";
  }
  if (code === 2) return "Playback could not connect. Check your connection and try again.";
  if (cause instanceof TypeError) return "Playback could not connect. Check your connection and try again.";
  return "Playback is unavailable right now. Choose another track or try again.";
}

export function PublicMusicPlayer({ song, allowed = true, onPlaybackStart }: PublicMusicPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const mediaRef = useRef<HTMLVideoElement | null>(null);
  const generation = useRef(0);
  const playbackAcknowledged = useRef(false);

  useEffect(() => {
    generation.current += 1;
    setPlaying(false);
    setMessage("");
    setError("");
    playbackAcknowledged.current = false;
    return () => { generation.current += 1; };
  }, [allowed, song.id]);

  if (!allowed) return null;

  const toggle = async () => {
    setError("");
    if (playing) {
      mediaRef.current?.pause();
      setPlaying(false);
      setMessage(`${song.title} is paused`);
      return;
    }
    const requestGeneration = generation.current;
    try {
      await mediaRef.current?.play();
      if (generation.current !== requestGeneration) return;
      setPlaying(true);
      setMessage(`${song.title} is playing on this device`);
    } catch (cause) {
      if (generation.current !== requestGeneration) return;
      handleError(cause);
    }
  };

  const handleError = (cause: unknown) => {
    setPlaying(false);
    const normalized = mediaErrorMessage(cause);
    if (normalized === null) {
      setError("");
      setMessage("Press play to start this song on your device.");
      return;
    }
    setMessage("");
    setError(normalized);
  };

  return (
    <div className="mt-3 min-w-0 rounded-xl bg-dashboard-card p-4">
      <div className="flex min-w-0 items-center gap-3">
        {song.thumbnailUrl ? <img className="h-14 w-14 shrink-0 rounded object-cover" src={song.thumbnailUrl} alt="" /> : null}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{song.title}</p>
          <p className="truncate text-sm text-dashboard-text-muted">{song.artist}</p>
        </div>
        <button
          type="button"
          aria-label={playing ? `Pause ${song.title}` : `Play ${song.title} on this device`}
          aria-pressed={playing}
          onClick={() => { void toggle(); }}
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full bg-dashboard-accent text-[var(--dash-accent-text)]"
        >
          {playing ? <Pause aria-hidden="true" className="h-5 w-5 fill-current" /> : <Play aria-hidden="true" className="h-5 w-5 fill-current" />}
        </button>
      </div>
      <div className="mt-4 aspect-video overflow-hidden rounded-lg bg-black">
        <ReactPlayer
          ref={mediaRef}
          src={`https://www.youtube.com/watch?v=${song.youtubeId}`}
          playing={playing}
          width="100%"
          height="100%"
          onPlay={() => {
            setPlaying(true);
            if (!playbackAcknowledged.current) {
              playbackAcknowledged.current = true;
              onPlaybackStart?.();
            }
          }}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setMessage(`${song.title} has finished.`);
          }}
          onError={handleError}
        />
      </div>
      {message ? <p role="status" aria-live="polite" className="mt-3 text-sm text-dashboard-text-muted">{message}</p> : null}
      {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
