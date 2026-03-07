import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Volume2, Play, Pause, SkipForward, Music2, SkipBack, Shuffle, Repeat, Repeat1 } from "lucide-react";
import { useMusicControls } from "@/hooks/use-music-controls";
import { cn } from "@/lib/utils";

interface PersistentMusicControlsProps {
  currentSong?: {
    title: string;
    artist: string;
    thumbnailUrl: string;
  };
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious?: () => void;
  onVolumeChange: (value: number) => void;
  volume: number;
  shuffle?: boolean;
  onToggleShuffle?: () => void;
  repeatMode?: 'none' | 'all' | 'one';
  onToggleRepeat?: () => void;
}

export function PersistentMusicControls({
  currentSong,
  isPlaying,
  onPlayPause,
  onNext,
  onPrevious,
  onVolumeChange,
  volume,
  shuffle = false,
  onToggleShuffle,
  repeatMode = 'none',
  onToggleRepeat,
}: PersistentMusicControlsProps) {
  const { showPersistentControls } = useMusicControls();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Add a slight delay for the animation
    if (showPersistentControls) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [showPersistentControls]);

  if (!isVisible) return null;

  return (
    <Card className={cn(
      "fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ease-in-out",
      showPersistentControls ? "translate-y-0" : "translate-y-full"
    )}>
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            {currentSong ? (
              <>
                <img
                  src={currentSong.thumbnailUrl}
                  alt={currentSong.title}
                  className="h-12 w-12 rounded-md object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{currentSong.title}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {currentSong.artist}
                  </p>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Music2 className="h-5 w-5" />
                <span>No song playing</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:gap-1">
            {/* Main playback controls with shuffle and repeat */}
            <div className="flex items-center justify-center gap-1">
              {/* Shuffle button on the left */}
              {onToggleShuffle && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggleShuffle}
                  className={`h-7 w-7 ${shuffle ? 'text-primary' : ''}`}
                  disabled={!currentSong}
                  title="Shuffle"
                >
                  <Shuffle className="h-4 w-4" />
                </Button>
              )}
              
              {/* Previous button */}
              {onPrevious && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onPrevious}
                  disabled={!currentSong}
                  className="h-7 w-7"
                >
                  <SkipBack className="h-4 w-4" />
                </Button>
              )}
              
              {/* Play/Pause button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={onPlayPause}
                disabled={!currentSong}
                className="h-9 w-9"
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </Button>
              
              {/* Next button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={onNext}
                disabled={!currentSong}
                className="h-7 w-7"
              >
                <SkipForward className="h-4 w-4" />
              </Button>
              
              {/* Repeat button on the right */}
              {onToggleRepeat && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggleRepeat}
                  className={`h-7 w-7 ${repeatMode !== 'none' ? 'text-primary' : ''}`}
                  disabled={!currentSong}
                  title={`Repeat ${repeatMode}`}
                >
                  {repeatMode === 'one' ? (
                    <Repeat1 className="h-4 w-4" />
                  ) : (
                    <Repeat className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
            
            {/* Volume controls in a row with autoplay */}
            <div className="flex items-center gap-2 justify-between w-full sm:w-auto">
              <div className="flex items-center gap-1 flex-1 max-w-[130px]">
                <Volume2 className="h-4 w-4 text-muted-foreground" />
                <Slider
                  value={[volume]}
                  max={100}
                  step={1}
                  className="w-24 flex-1"
                  onValueChange={(value) => onVolumeChange(value[0])}
                />
              </div>
              
              {/* Space for future autoplay toggle or other controls */}
              <div className="flex items-center gap-1">
                {/* This is where the autoplay toggle would go if implemented in the future */}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
