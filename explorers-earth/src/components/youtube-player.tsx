// YoutubePlayer component for music playback — compatible with react-player v3
// react-player v3 uses youtube-video-element (a custom element extending HTMLElement)
// The ref is the youtube-video-element, not a ReactPlayer instance.
// Standard HTML media events (play, pause, ended, timeupdate, durationchange, error) are dispatched.
import { useState, useRef, useEffect, useCallback } from 'react';
import ReactPlayer from 'react-player';
import { Song } from '../types/music';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  SkipForward,
  SkipBack,
  Shuffle,
  Repeat,
  Repeat1,
  Loader2,
  AlertCircle,
  Music2
} from 'lucide-react';
import { useToast } from '../hooks/useToast';
import Slider from './ui/slider';
import { useWebSocket } from '../hooks/useWebSocket';

type RepeatMode = 'none' | 'all' | 'one';

interface YoutubePlayerProps {
  currentSong?: Song;
  nextSong?: Song;
  previousSong?: Song;
  defaultAutoplay?: boolean;
  showAutoplayControl?: boolean;
  onSongFinished?: () => void;
  onPreviousSong?: () => void;
  onShuffleSongs?: () => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  fetchCurrentSong: () => Promise<Song | undefined>;
  guestUrl?: string;
}

export default function YoutubePlayer({
  currentSong,
  nextSong,
  defaultAutoplay = true,
  showAutoplayControl = false,
  onSongFinished,
  onPreviousSong,
  onShuffleSongs,
  onPlayStateChange,
  fetchCurrentSong,
  guestUrl,
}: YoutubePlayerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [autoplay] = useState(defaultAutoplay);
  const [isPlaying, setIsPlaying] = useState(defaultAutoplay);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [played, setPlayed] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('none');
  // react-player v3: ref is the youtube-video-element custom element
  const playerRef = useRef<any>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const playerErrorRetries = useRef(0);
  const MAX_RETRIES = 3;
  const lastPlayerStateUpdate = useRef<number>(0);
  const playerStateUpdateThrottle = 200;
  const isPlayingRef = useRef(defaultAutoplay);

  // Mutable refs to avoid stale closures in event listeners
  const seekingRef = useRef(false);
  const durationRef = useRef(0);
  const repeatModeRef = useRef<RepeatMode>('none');
  const onSongFinishedRef = useRef(onSongFinished);
  const handleSongCompleteRef = useRef<() => void>(() => { });

  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { seekingRef.current = seeking; }, [seeking]);
  useEffect(() => { durationRef.current = duration; }, [duration]);
  useEffect(() => { repeatModeRef.current = repeatMode; }, [repeatMode]);
  useEffect(() => { onSongFinishedRef.current = onSongFinished; }, [onSongFinished]);

  // Format time helper function
  const formatTime = (timeInSeconds: number): string => {
    if (!timeInSeconds || isNaN(timeInSeconds)) return '00:00';
    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Broadcast player state
  const broadcastPlayerState = useCallback((playing: boolean) => {
    const now = Date.now();
    if (now - lastPlayerStateUpdate.current > playerStateUpdateThrottle) {
      localStorage.setItem('youtube_autoplay', playing.toString());
      window.dispatchEvent(new CustomEvent('player-state-change', { detail: { playing } }));
      lastPlayerStateUpdate.current = now;
    }
  }, []);

  // Socket.IO setup for guest view
  const { sendMessage } = useWebSocket(
    (!showAutoplayControl && guestUrl && playerReady) ? guestUrl : '',
    (message) => {
      try {
        if (message.type === 'player_state' && !showAutoplayControl) {
          const now = Date.now();
          if (now - lastPlayerStateUpdate.current > playerStateUpdateThrottle) {
            const playing = (message.payload as any)?.playing ?? false;
            setIsPlaying(!!playing);
            lastPlayerStateUpdate.current = now;
            const el = playerRef.current;
            if (el) {
              if (playing) el.play?.().catch?.(() => { });
              else el.pause?.();
            }
          }
        }
      } catch (err) {
        console.error('Error handling WebSocket message:', err);
      }
    }
  );

  // Load preferences from localStorage
  useEffect(() => {
    const savedVolume = localStorage.getItem('youtube_volume');
    const savedShuffle = localStorage.getItem('youtube_shuffle');
    const savedRepeatMode = localStorage.getItem('youtube_repeat_mode') as RepeatMode;
    if (savedVolume !== null) setVolume(parseInt(savedVolume));
    if (savedShuffle !== null) setShuffle(savedShuffle === 'true');
    if (savedRepeatMode) setRepeatMode(savedRepeatMode);
  }, []);

  useEffect(() => {
    localStorage.setItem('youtube_volume', volume.toString());
    window.dispatchEvent(new CustomEvent('volume-change', { detail: { volume } }));
  }, [volume]);

  useEffect(() => { localStorage.setItem('youtube_shuffle', shuffle.toString()); }, [shuffle]);
  useEffect(() => { localStorage.setItem('youtube_repeat_mode', repeatMode); }, [repeatMode]);

  // Apply volume/mute to player element (volume is 0-1 in youtube-video-element)
  useEffect(() => {
    const el = playerRef.current;
    if (!el) return;
    const newVol = isMuted ? 0 : volume / 100;
    if (el.volume !== newVol) el.volume = newVol;
  }, [volume, isMuted]);

  // Song end API call
  const notifySongEnd = useCallback(async () => {
    try {
      const apiBaseUrl = import.meta.env.VITE_LOCAL_TUNES_API_URL || 'https://localtunes.earth';
      await fetch(`${apiBaseUrl}/api/playlist/currently-playing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songId: null })
      });
    } catch { /* ignore */ }
  }, []);

  // Handle song completion — uses refs to avoid stale closures
  const handleSongComplete = useCallback(async () => {
    const cb = onSongFinishedRef.current;
    if (!cb) return;
    switch (repeatModeRef.current) {
      case 'one': {
        const el = playerRef.current;
        if (el) {
          el.currentTime = 0;
          setPlayed(0);
          setCurrentTime(0);
          el.play?.().catch?.(() => { });
          setIsPlaying(true);
        }
        break;
      }
      default:
        // 'all' and 'none' both advance to next song
        cb();
        await notifySongEnd();
        break;
    }
  }, [notifySongEnd]);

  // Store latest handleSongComplete in ref for use in native event listener
  useEffect(() => {
    handleSongCompleteRef.current = handleSongComplete;
  }, [handleSongComplete]);

  const seekTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Timeline seeking
  const handleSeekChange = useCallback((value: number[]) => {
    const newPlayed = value[0] / 100;
    setPlayed(newPlayed);
    setCurrentTime(durationRef.current * newPlayed);
    setSeeking(true);

    if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
    seekTimeoutRef.current = setTimeout(async () => {
      setSeeking(false);
      const el = playerRef.current;
      if (el) {
        const seekTime = newPlayed * durationRef.current;
        el.currentTime = seekTime;
        setCurrentTime(seekTime);
        if (newPlayed >= 0.999) {
          await handleSongCompleteRef.current();
        }
      }
    }, 150);
  }, []);

  // Error handling with retries
  const handleError = useCallback(async (err?: any) => {
    console.error('Player error:', err);
    if (playerErrorRetries.current < MAX_RETRIES) {
      playerErrorRetries.current++;
      setIsLoading(true);
      setError("Attempting to recover playback...");
      setPlayerReady(false);
      await new Promise(resolve => setTimeout(resolve, 2000));
      setError(null);
      setIsLoading(true);
      return;
    }
    setError("Failed to play video");
    setIsLoading(false);
    setPlayerReady(false);

    if (autoplay && onSongFinishedRef.current) {
      toast("Could not play this video. Skipping to next song.", { variant: "destructive" });
      onSongFinishedRef.current();
      await notifySongEnd();
    }
  }, [autoplay, toast, notifySongEnd]);

  // Poll for current song updates
  useEffect(() => {
    const intervalId = setInterval(async () => {
      try {
        const newCurrentSong = await fetchCurrentSong();
        if (newCurrentSong && (!currentSong || newCurrentSong.youtubeId !== currentSong.youtubeId)) {
          setIsLoading(true);
          setError(null);
          setIsPlaying(autoplay);
          setPlayerReady(false);
          playerErrorRetries.current = 0;
          setPlayed(0);
          setCurrentTime(0);
          setDuration(0);
          broadcastPlayerState(autoplay);
        }
      } catch (e) {
        console.error("Error fetching current song:", e);
      }
    }, 2000);
    return () => clearInterval(intervalId);
  }, [fetchCurrentSong, currentSong, autoplay, broadcastPlayerState]);

  // 15-second loading timeout safety net
  useEffect(() => {
    if (!currentSong) return;
    const timeout = setTimeout(() => setIsLoading(false), 15000);
    return () => clearTimeout(timeout);
  }, [currentSong?.youtubeId]);

  // Attach native event listeners when playerReady flips to true
  // We attach them here using the playerRef which is set by react-player's callback ref
  useEffect(() => {
    const el = playerRef.current;
    if (!el || !playerReady) return;

    const onTimeUpdate = () => {
      if (seekingRef.current) return;
      const dur = el.duration;
      const ct = el.currentTime;
      if (dur && dur > 0 && !isNaN(dur)) {
        setCurrentTime(ct);
        setDuration(dur);
        setPlayed(ct / dur);
        durationRef.current = dur;
      }
    };

    const onDurationChange = () => {
      const dur = el.duration;
      if (dur && dur > 0 && !isNaN(dur)) {
        setDuration(dur);
        durationRef.current = dur;
      }
    };

    const onPlay = () => {
      setIsPlaying(true);
      setIsLoading(false);
    };

    const onPause = () => setIsPlaying(false);

    const onEnded = () => {
      // Small delay to avoid race with other state updates
      setTimeout(() => handleSongCompleteRef.current(), 100);
    };

    const onNativeError = () => handleError(el.error);

    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('durationchange', onDurationChange);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onEnded);
    el.addEventListener('error', onNativeError);

    return () => {
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('durationchange', onDurationChange);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('error', onNativeError);
    };
  }, [playerReady, handleError]);

  // react-player v3 onReady fires on 'loadstart' of the youtube-video-element
  const handleReady = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setPlayerReady(true);
    playerErrorRetries.current = 0;

    const el = playerRef.current;
    if (el) {
      // Volume is 0-1 in the youtube-video-element API
      el.volume = isMuted ? 0 : volume / 100;

      const shouldPlay = isPlayingRef.current;
      if (shouldPlay) {
        el.play?.().catch?.(() => { });
      } else {
        el.pause?.();
      }

      broadcastPlayerState(shouldPlay);
      if (onPlayStateChange) onPlayStateChange(shouldPlay);
    }
  }, [volume, isMuted, onPlayStateChange, broadcastPlayerState]);

  // Player control handlers
  const handlePlayPause = useCallback(() => {
    if (!playerReady) return;
    const newPlayingState = !isPlaying;
    setIsPlaying(newPlayingState);
    broadcastPlayerState(newPlayingState);

    const el = playerRef.current;
    if (el) {
      if (newPlayingState) el.play?.().catch?.(() => { });
      else el.pause?.();
    }

    if (showAutoplayControl) {
      try {
        sendMessage({ type: 'player_state', payload: { playing: newPlayingState }, timestamp: Date.now() });
      } catch { /* ignore */ }
    }

    if (onPlayStateChange) onPlayStateChange(newPlayingState);
  }, [playerReady, isPlaying, onPlayStateChange, broadcastPlayerState, showAutoplayControl, sendMessage]);

  const handlePrevious = useCallback(() => {
    if (onPreviousSong) { onPreviousSong(); broadcastPlayerState(autoplay); }
  }, [onPreviousSong, autoplay, broadcastPlayerState]);

  const handleNext = useCallback(() => {
    if (onSongFinished) { onSongFinished(); broadcastPlayerState(autoplay); }
  }, [onSongFinished, autoplay, broadcastPlayerState]);

  const handleVolumeChange = useCallback((value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(!isMuted);
    setVolume(isMuted ? 100 : 0);
  }, [isMuted]);

  const toggleShuffle = useCallback(() => {
    const newShuffleState = !shuffle;
    setShuffle(newShuffleState);
    if (onShuffleSongs && newShuffleState) onShuffleSongs();
  }, [shuffle, onShuffleSongs]);

  const toggleRepeat = useCallback(() => {
    const modes: RepeatMode[] = ['none', 'all', 'one'];
    const idx = modes.indexOf(repeatMode);
    setRepeatMode(modes[(idx + 1) % modes.length]);
  }, [repeatMode]);

  if (!currentSong) {
    return (
      <div className="w-full aspect-video bg-gray-800 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <Music2 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-400">No songs in playlist</p>
        </div>
      </div>
    );
  }

  if (error && playerErrorRetries.current >= MAX_RETRIES) {
    return (
      <div className="w-full aspect-video bg-gray-800 rounded-lg flex flex-col items-center justify-center gap-4 text-red-400">
        <AlertCircle className="h-12 w-12" />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Video player */}
      <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        )}

        {/*
          react-player v3:
          - Use `src` prop (not `url`) — the youtube-video-element uses `src` attribute
          - `ref` callback assigns the youtube-video-element custom element
          - `playing` prop handled by react-player's Player.js (calls el.play()/el.pause())
          - `volume` prop applied by Player.js as el.volume (0-1 range)
          - Native events (onPlay, onPause, onEnded) are passed through as React synthetic events
        */}
        <ReactPlayer
          ref={(node: any) => { playerRef.current = node; }}
          // @ts-expect-error — v3 uses src, v2 used url
          src={`https://www.youtube.com/watch?v=${currentSong.youtubeId}`}
          width="100%"
          height="100%"
          playing={isPlaying}
          volume={isMuted ? 0 : volume / 100}
          muted={isMuted}
          controls={false}
          loop={repeatMode === 'one'}
          onReady={handleReady}
          onError={handleError}
          config={{
            youtube: {
              modestbranding: 1,
              rel: 0,
              disablekb: 1,
              iv_load_policy: 3,
              playsinline: 1,
              origin: window.location.origin,
              enablejsapi: 1,
              widget_referrer: window.location.origin,
            } as any
          }}
        />
      </div>

      {/* Song info */}
      <div className="text-center">
        <h3 className="font-semibold text-lg text-white">{currentSong.title}</h3>
        <p className="text-gray-300">{currentSong.artist}</p>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <Slider
          value={[played * 100]}
          min={0}
          max={100}
          step={0.1}
          onValueChange={handleSeekChange}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center space-x-4">
        <button
          onClick={toggleShuffle}
          className="px-3 py-2 rounded-md transition-all duration-300"
          style={{
            backgroundColor: shuffle ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
            color: shuffle ? '#60a5fa' : '#d1d5db'
          }}
        >
          <Shuffle className="h-4 w-4" style={{ color: shuffle ? '#60a5fa' : '#d1d5db' }} />
        </button>

        <button
          onClick={handlePrevious}
          className="px-3 py-2 rounded-md transition-all duration-300 hover:bg-gray-700"
          style={{ backgroundColor: 'transparent', color: '#d1d5db' }}
        >
          <SkipBack className="h-4 w-4" style={{ color: '#d1d5db' }} />
        </button>

        <button
          onClick={handlePlayPause}
          disabled={!playerReady}
          className="rounded-full w-12 h-12 text-white flex items-center justify-center transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80"
          style={{ backgroundColor: '#2563eb' }}
        >
          {isPlaying ? (
            <Pause className="h-6 w-6" style={{ color: 'white' }} />
          ) : (
            <Play className="h-6 w-6 ml-0.5" style={{ color: 'white' }} />
          )}
        </button>

        <button
          onClick={handleNext}
          className="px-3 py-2 rounded-md transition-all duration-300 hover:bg-gray-700"
          style={{ backgroundColor: 'transparent', color: '#d1d5db' }}
        >
          <SkipForward className="h-4 w-4" style={{ color: '#d1d5db' }} />
        </button>

        <button
          onClick={toggleRepeat}
          className="px-3 py-2 rounded-md transition-all duration-300"
          style={{
            backgroundColor: repeatMode !== 'none' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
            color: repeatMode !== 'none' ? '#60a5fa' : '#d1d5db'
          }}
        >
          {repeatMode === 'one' ? (
            <Repeat1 className="h-4 w-4" style={{ color: '#60a5fa' }} />
          ) : (
            <Repeat className="h-4 w-4" style={{ color: repeatMode === 'all' ? '#60a5fa' : '#d1d5db' }} />
          )}
        </button>
      </div>

      {/* Volume control */}
      <div className="flex items-center space-x-2">
        <button
          onClick={toggleMute}
          className="px-3 py-2 rounded-md transition-all duration-300 hover:bg-gray-700"
          style={{ backgroundColor: 'transparent', color: '#d1d5db' }}
        >
          {isMuted ? (
            <VolumeX className="h-4 w-4" style={{ color: '#d1d5db' }} />
          ) : (
            <Volume2 className="h-4 w-4" style={{ color: '#d1d5db' }} />
          )}
        </button>
        <Slider
          value={[isMuted ? 0 : volume]}
          max={100}
          step={1}
          onValueChange={handleVolumeChange}
          className="flex-1"
        />
        <span className="text-xs text-gray-400 w-8">
          {Math.round(isMuted ? 0 : volume)}
        </span>
      </div>

      {/* Next song preview */}
      {nextSong && (
        <div className="text-center text-sm text-gray-400">
          <p>Next: {nextSong.title} - {nextSong.artist}</p>
        </div>
      )}
    </div>
  );
}
