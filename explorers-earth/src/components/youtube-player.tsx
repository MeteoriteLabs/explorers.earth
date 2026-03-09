// YoutubePlayer component for music playback
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
  const [autoplay, setAutoplay] = useState(defaultAutoplay);
  const [isPlaying, setIsPlaying] = useState(defaultAutoplay);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [played, setPlayed] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('none');
  const playerRef = useRef<any>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const playerErrorRetries = useRef(0);
  const MAX_RETRIES = 3;
  const lastPlayerStateUpdate = useRef<number>(0);
  const playerStateUpdateThrottle = 200;
  const progressPollInterval = useRef<NodeJS.Timeout | null>(null);

  // Safe wrapper to call getInternalPlayer
  const getInternalPlayer = useCallback(() => {
    if (!playerRef.current) return null;
    if (typeof playerRef.current.getInternalPlayer !== 'function') return null;
    try {
      return playerRef.current.getInternalPlayer();
    } catch {
      return null;
    }
  }, []);

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

            if (playerRef.current && playerReady) {
              const player = getInternalPlayer();
              if (player && typeof player.playVideo === 'function' && typeof player.pauseVideo === 'function') {
                try {
                  if (playing) {
                    player.playVideo();
                  } else {
                    player.pauseVideo();
                  }
                } catch (err) {
                  console.error('Error controlling YouTube player:', err);
                }
              }
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
    const savedAutoplay = localStorage.getItem('youtube_autoplay');
    const savedVolume = localStorage.getItem('youtube_volume');
    const savedShuffle = localStorage.getItem('youtube_shuffle');
    const savedRepeatMode = localStorage.getItem('youtube_repeat_mode') as RepeatMode;

    if (savedAutoplay !== null) {
      setAutoplay(savedAutoplay === 'true');
      setIsPlaying(savedAutoplay === 'true');
    }
    if (savedVolume !== null) {
      setVolume(parseInt(savedVolume));
    }
    if (savedShuffle !== null) {
      setShuffle(savedShuffle === 'true');
    }
    if (savedRepeatMode) {
      setRepeatMode(savedRepeatMode);
    }
  }, []);

  // Save preferences to localStorage
  useEffect(() => {
    localStorage.setItem('youtube_autoplay', isPlaying.toString());
  }, [isPlaying]);

  useEffect(() => {
    localStorage.setItem('youtube_volume', volume.toString());

    // Broadcast volume change event to persistent player
    const event = new CustomEvent('volume-change', {
      detail: { volume }
    });
    window.dispatchEvent(event);
  }, [volume]);

  useEffect(() => {
    localStorage.setItem('youtube_shuffle', shuffle.toString());
  }, [shuffle]);

  useEffect(() => {
    localStorage.setItem('youtube_repeat_mode', repeatMode);
  }, [repeatMode]);

  // Start manual progress polling
  const startProgressPolling = useCallback(() => {
    if (progressPollInterval.current) {
      clearInterval(progressPollInterval.current);
    }

    progressPollInterval.current = setInterval(() => {
      if (playerRef.current && isPlaying && !seeking) {
        try {
          const player = getInternalPlayer();
          if (player && typeof player.getCurrentTime === 'function' && typeof player.getDuration === 'function') {
            const current = player.getCurrentTime();
            const dur = player.getDuration();
            if (dur > 0 && !isNaN(dur) && !isNaN(current)) {
              setDuration(dur);
              setCurrentTime(current);
              setPlayed(current / dur);
            }
          }
        } catch {
          // silently ignore - player may not be ready yet
        }
      }
    }, 500);
  }, [isPlaying, seeking, getInternalPlayer]);

  // Stop manual progress polling
  const stopProgressPolling = useCallback(() => {
    if (progressPollInterval.current) {
      clearInterval(progressPollInterval.current);
      progressPollInterval.current = null;
    }
  }, []);

  // Handle progress updates from ReactPlayer
  const handleProgress = useCallback((state: { played: number; playedSeconds: number; loaded: number; loadedSeconds: number }) => {
    if (!seeking) {
      setPlayed(state.played);
      setCurrentTime(state.playedSeconds);
    }
  }, [seeking]);

  // Player ready handler
  const handlePlayerReady = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setPlayerReady(true);
    playerErrorRetries.current = 0;

    // Try multiple times to get duration with increasing delays
    const attemptDurationLoad = (attempt = 1) => {
      if (attempt > 10) return;

      setTimeout(() => {
        if (playerRef.current) {
          try {
            const player = getInternalPlayer();
            if (!player) {
              attemptDurationLoad(attempt + 1);
              return;
            }

            // Set volume
            if (typeof player.setVolume === 'function') {
              player.setVolume(volume);
            }

            // Get duration
            if (typeof player.getDuration === 'function') {
              const dur = player.getDuration();
              if (dur && dur > 0 && !isNaN(dur)) {
                setDuration(dur);

                // Start polling once we have duration
                startProgressPolling();

                // Sync play state
                const savedPlayState = localStorage.getItem('youtube_autoplay');
                const shouldPlay = savedPlayState === null ? defaultAutoplay : savedPlayState === 'true';

                if (shouldPlay && typeof player.playVideo === 'function') {
                  player.playVideo();
                  setIsPlaying(true);
                } else if (!shouldPlay && typeof player.pauseVideo === 'function') {
                  player.pauseVideo();
                  setIsPlaying(false);
                }

                broadcastPlayerState(shouldPlay);

                if (onPlayStateChange) {
                  onPlayStateChange(shouldPlay);
                }

                return; // Success, stop trying
              } else {
                attemptDurationLoad(attempt + 1);
              }
            } else {
              attemptDurationLoad(attempt + 1);
            }
          } catch {
            attemptDurationLoad(attempt + 1);
          }
        }
      }, attempt * 500); // Exponential backoff: 500ms, 1s, 1.5s, 2s, etc.
    };

    // Start attempting to load duration
    attemptDurationLoad(1);
  }, [volume, defaultAutoplay, onPlayStateChange, startProgressPolling, getInternalPlayer]);

  // Handle YouTube specific errors
  const handleYouTubeError = useCallback((error: any) => {
    console.error('YouTube player error:', error);

    const errorMessages: Record<number, string> = {
      2: 'Invalid video ID',
      5: 'HTML5 player error',
      100: 'Video not found',
      101: 'Video playback not allowed',
      150: 'Video playback not allowed'
    };

    let errorCode = 0;
    if (typeof error === 'object' && error !== null && 'data' in error) {
      errorCode = (error as any).data;
    }

    const errorMessage = errorMessages[errorCode] || 'Unknown YouTube error';
    handleError(new Error(errorMessage));
  }, []);

  // Handle song completion based on repeat mode
  const handleSongComplete = useCallback(async () => {
    if (!onSongFinished) return;

    switch (repeatMode) {
      case 'one':
        // Replay the current song
        if (playerRef.current) {
          playerRef.current.seekTo(0);
          setPlayed(0);
          setCurrentTime(0);
          setIsPlaying(true);
        }
        break;
      case 'all':
        // Move to next song
        await handleSongEnd();
        break;
      case 'none':
        // Only move to next if autoplay is enabled
        if (autoplay) {
          await handleSongEnd();
        } else {
          setIsPlaying(false);
        }
        break;
    }
  }, [repeatMode, autoplay, onSongFinished]);

  const seekTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Timeline seeking handlers
  const handleSeekChange = useCallback((value: number[]) => {
    const newPlayed = value[0] / 100;
    setPlayed(newPlayed);
    setCurrentTime(duration * newPlayed);
    setSeeking(true);

    // Clear any existing timeout
    if (seekTimeoutRef.current) {
      clearTimeout(seekTimeoutRef.current);
    }

    // Use a debounce to detect when user stops dragging
    seekTimeoutRef.current = setTimeout(async () => {
      setSeeking(false);
      if (playerRef.current) {
        const seekTime = newPlayed;
        playerRef.current.seekTo(seekTime);
        setCurrentTime(duration * seekTime);

        // If seeking to the end, handle based on repeat mode
        if (seekTime >= 0.999) {
          await handleSongComplete();
        }
      }
    }, 150);
  }, [duration, handleSongComplete]);

  // Song end handler
  const handleSongEnd = useCallback(async () => {
    if (!onSongFinished) return;

    try {
      const apiBaseUrl = import.meta.env.VITE_LOCAL_TUNES_API_URL || 'https://localtunes.earth';
      await fetch(`${apiBaseUrl}/api/playlist/currently-playing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songId: null })
      });

      stopProgressPolling();
      onSongFinished();
    } catch (error) {
      console.error('Error handling song end:', error);
      toast("Failed to update playback status", { variant: "destructive" });
    }
  }, [onSongFinished, toast, stopProgressPolling]);

  // Error handling with retries
  const handleError = useCallback(async (error: any) => {
    console.error('Player error:', error);

    // Try to recover by reloading
    if (playerRef.current && playerErrorRetries.current < MAX_RETRIES) {
      playerErrorRetries.current++;

      try {
        setIsLoading(true);
        setError("Attempting to recover playback...");
        setPlayerReady(false);
        stopProgressPolling();

        await new Promise(resolve => setTimeout(resolve, 2000));

        const player = getInternalPlayer();
        if (player && typeof player.loadVideoById === 'function' && currentSong?.youtubeId) {
          player.loadVideoById(currentSong.youtubeId);
          setError(null);
          return;
        }
      } catch (retryError) {
        console.error('Retry attempt failed:', retryError);
      }
    }

    // If retries exhausted, show error and skip
    setError("Failed to play video");
    setIsLoading(false);
    setPlayerReady(false);
    stopProgressPolling();

    if (autoplay && onSongFinished) {
      toast("Could not play this video. Skipping to next song.", { variant: "destructive" });

      try {
        const apiBaseUrl = import.meta.env.VITE_LOCAL_TUNES_API_URL || 'https://localtunes.earth';
        await fetch(`${apiBaseUrl}/api/playlist/currently-playing`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ songId: null })
        });

        await new Promise(resolve => setTimeout(resolve, 1000));
        onSongFinished();
      } catch (skipError) {
        console.error('Error while trying to skip song:', skipError);
        toast("Failed to skip to next song. Please try again.", { variant: "destructive" });
      }
    }
  }, [autoplay, currentSong, onSongFinished, toast, stopProgressPolling, getInternalPlayer]);

  // Player control handlers
  const handlePlayPause = useCallback(() => {
    if (!playerReady) return;

    const newPlayingState = !isPlaying;
    setIsPlaying(newPlayingState);
    broadcastPlayerState(newPlayingState);

    if (newPlayingState) {
      startProgressPolling();
    } else {
      stopProgressPolling();
    }

    if (onPlayStateChange) {
      onPlayStateChange(newPlayingState);
    }
  }, [playerReady, isPlaying, onPlayStateChange, startProgressPolling, stopProgressPolling]);

  const handlePrevious = useCallback(() => {
    if (onPreviousSong) {
      stopProgressPolling();
      onPreviousSong();
      broadcastPlayerState(autoplay);
    }
  }, [onPreviousSong, autoplay, stopProgressPolling]);

  const handleNext = useCallback(() => {
    if (onSongFinished) {
      stopProgressPolling();
      onSongFinished();
      broadcastPlayerState(autoplay);
    }
  }, [onSongFinished, autoplay, stopProgressPolling]);

  const handleVolumeChange = useCallback((value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(!isMuted);
    if (isMuted) {
      setVolume(100);
    } else {
      setVolume(0);
    }
  }, [isMuted]);

  const toggleShuffle = useCallback(() => {
    const newShuffleState = !shuffle;
    setShuffle(newShuffleState);
    if (onShuffleSongs && newShuffleState) {
      onShuffleSongs();
    }
  }, [shuffle, onShuffleSongs]);

  const toggleRepeat = useCallback(() => {
    const modes: RepeatMode[] = ['none', 'all', 'one'];
    const currentIndex = modes.indexOf(repeatMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setRepeatMode(modes[nextIndex]);
  }, [repeatMode]);

  // Broadcast player state
  const broadcastPlayerState = useCallback((playing: boolean) => {
    const now = Date.now();
    if (now - lastPlayerStateUpdate.current > playerStateUpdateThrottle) {
      localStorage.setItem('youtube_autoplay', playing.toString());

      const event = new CustomEvent('player-state-change', {
        detail: { playing }
      });
      window.dispatchEvent(event);

      if (showAutoplayControl) {
        try {
          sendMessage({
            type: 'player_state',
            payload: { playing },
            timestamp: Date.now()
          });
        } catch (err) {
          console.error('Error broadcasting player state to guests:', err);
        }
      }

      lastPlayerStateUpdate.current = now;
    }
  }, [showAutoplayControl, sendMessage]);

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
          stopProgressPolling();
          broadcastPlayerState(autoplay);
        }
      } catch (error) {
        console.error("Error fetching current song:", error);
      }
    }, 2000);

    return () => clearInterval(intervalId);
  }, [fetchCurrentSong, currentSong, autoplay, broadcastPlayerState, stopProgressPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopProgressPolling();
    };
  }, [stopProgressPolling]);

  // Start/stop polling based on playing state
  useEffect(() => {
    if (isPlaying) {
      startProgressPolling();
    } else {
      stopProgressPolling();
    }
  }, [isPlaying, startProgressPolling, stopProgressPolling]);

  // Aggressive duration loading - keep trying until we get it
  useEffect(() => {
    if (!currentSong || duration > 0) return;

    const durationInterval = setInterval(() => {
      if (playerRef.current && duration === 0) {
        try {
          const player = getInternalPlayer();
          if (player && typeof player.getDuration === 'function') {
            const dur = player.getDuration();
            if (dur && dur > 0 && !isNaN(dur)) {
              setDuration(dur);
            }
          }
        } catch {
          // silently ignore
        }
      }
    }, 300);

    // Stop trying after 30 seconds
    const timeout = setTimeout(() => {
      clearInterval(durationInterval);
    }, 30000);

    return () => {
      clearInterval(durationInterval);
      clearTimeout(timeout);
    };
  }, [currentSong, duration, getInternalPlayer]);

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

  if (error) {
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

        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-ts-comment */}
        {/* @ts-ignore - ReactPlayer type definition mismatch */}
        <ReactPlayer
          ref={playerRef as any}
          // @ts-expect-error - url prop type mismatch with react-player
          url={`https://www.youtube.com/watch?v=${currentSong.youtubeId}`}
          width="100%"
          height="100%"
          playing={isPlaying}
          volume={volume / 100}
          muted={isMuted}
          controls={false}
          loop={repeatMode === 'one'}
          progressInterval={1000}
          onError={handleYouTubeError}
          onEnded={handleSongComplete}
          onProgress={handleProgress as any}
          onDuration={(dur: number) => {
            if (dur && dur > 0 && !isNaN(dur)) {
              setDuration(dur);
            }
          }}
          onReady={handlePlayerReady}
          onStart={() => {
            setIsLoading(false);
          }}
          onPlay={() => {
            setIsPlaying(true);
            setIsLoading(false);

            if (!playerReady) {
              setPlayerReady(true);
            }

            // Try to get duration when play starts as another fallback
            if (playerRef.current && duration === 0) {
              try {
                const player = getInternalPlayer();
                if (player && typeof player.getDuration === 'function') {
                  const dur = player.getDuration();
                  if (dur && dur > 0 && !isNaN(dur)) {
                    setDuration(dur);
                  }
                }
              } catch {
                // silently ignore
              }
            }

            startProgressPolling();
          }}
          onPause={() => {
            setIsPlaying(false);
            stopProgressPolling();
          }}
          config={{
            youtube: {
              rel: 0,
              disablekb: 0,
              iv_load_policy: 3,
              playsinline: 1,
              enablejsapi: 1,
              origin: window.location.origin
            }
          } as any}
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
        {/* Shuffle */}
        <button
          onClick={toggleShuffle}
          className={`px-3 py-2 rounded-md transition-all duration-300 ${
            shuffle ? 'text-blue-400 bg-blue-100' : 'text-gray-300 hover:bg-gray-700'
          }`}
          style={{
            backgroundColor: shuffle ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
            color: shuffle ? '#60a5fa' : '#d1d5db'
          }}
        >
          <Shuffle className="h-4 w-4" style={{ color: shuffle ? '#60a5fa' : '#d1d5db' }} />
        </button>

        {/* Previous */}
        <button
          onClick={handlePrevious}
          className="px-3 py-2 rounded-md transition-all duration-300 text-gray-300 hover:bg-gray-700"
          style={{ backgroundColor: 'transparent', color: '#d1d5db' }}
        >
          <SkipBack className="h-4 w-4" style={{ color: '#d1d5db' }} />
        </button>

        {/* Play/Pause */}
        <button
          onClick={handlePlayPause}
          disabled={!playerReady}
          className="rounded-full w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#2563eb' }}
        >
          {isPlaying ? (
            <Pause className="h-6 w-6" style={{ color: 'white' }} />
          ) : (
            <Play className="h-6 w-6 ml-0.5" style={{ color: 'white' }} />
          )}
        </button>

        {/* Next */}
        <button
          onClick={handleNext}
          className="px-3 py-2 rounded-md transition-all duration-300 text-gray-300 hover:bg-gray-700"
          style={{ backgroundColor: 'transparent', color: '#d1d5db' }}
        >
          <SkipForward className="h-4 w-4" style={{ color: '#d1d5db' }} />
        </button>

        {/* Repeat */}
        <button
          onClick={toggleRepeat}
          className={`px-3 py-2 rounded-md transition-all duration-300 ${
            repeatMode !== 'none' ? 'text-blue-400 bg-blue-100' : 'text-gray-300 hover:bg-gray-700'
          }`}
          style={{
            backgroundColor: repeatMode !== 'none' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
            color: repeatMode !== 'none' ? '#60a5fa' : '#d1d5db'
          }}
        >
          {repeatMode === 'one' ? (
            <Repeat1 className="h-4 w-4" style={{ color: repeatMode === 'one' || repeatMode === 'all' ? '#60a5fa' : '#d1d5db' }} />
          ) : (
            <Repeat className="h-4 w-4" style={{ color: repeatMode === 'all' ? '#60a5fa' : '#d1d5db' }} />
          )}
        </button>
      </div>

      {/* Volume control */}
      <div className="flex items-center space-x-2">
        <button
          onClick={toggleMute}
          className="px-3 py-2 rounded-md transition-all duration-300 text-gray-300 hover:bg-gray-700"
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
          {Math.round((isMuted ? 0 : volume))}
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
