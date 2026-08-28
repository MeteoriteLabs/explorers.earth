import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import ReactPlayer from "react-player";
import type { PublicMusicSong } from "../publicMusicClient";

export interface PublicMusicPlayerProps {
  song: PublicMusicSong;
  allowed?: boolean;
}

function mediaErrorMessage(cause: unknown): string | null {
  if (cause instanceof DOMException && cause.name === "NotAllowedError") return null;
  if (cause === 100 || (typeof cause === "object" && cause !== null && "data" in cause && cause.data === 100)) {
    return "This video is no longer available. Choose another track.";
  }
  if ([101, 150].includes(cause as number)
    || (typeof cause === "object" && cause !== null && "data" in cause && [101, 150].includes(cause.data as number))) {
    return "This video cannot be played here. Choose another track.";
  }
  if (cause instanceof TypeError) return "Playback could not connect. Check your connection and try again.";
  return "Playback is unavailable right now. Choose another track or try again.";
}

export function PublicMusicPlayer({ song, allowed = true }: PublicMusicPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setPlaying(false);
    setMessage("");
    setError("");
  }, [allowed, song.id]);

  if (!allowed) return null;

  const toggle = () => {
    setError("");
    setMessage(`${song.title} is ${playing ? "paused" : "playing on this device"}`);
    setPlaying((value) => !value);
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
          onClick={toggle}
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full bg-dashboard-accent text-[var(--dash-accent-text)]"
        >
          {playing ? <Pause aria-hidden="true" className="h-5 w-5 fill-current" /> : <Play aria-hidden="true" className="h-5 w-5 fill-current" />}
        </button>
      </div>
      <div className="mt-4 aspect-video overflow-hidden rounded-lg bg-black">
        <ReactPlayer
          src={`https://www.youtube.com/watch?v=${song.youtubeId}`}
          playing={playing}
          width="100%"
          height="100%"
          onPlay={() => setPlaying(true)}
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
