import { Song } from '@shared/schema';
import { cn } from '@/lib/utils';
import { PlayCircle, PauseCircle, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MiniPlayerControlProps {
  currentSong?: Song;
  isPlaying: boolean;
  onPlayPause: () => void;
  onSkipNext: () => void;
  className?: string;
}

export function MiniPlayerControl({
  currentSong,
  isPlaying,
  onPlayPause,
  onSkipNext,
  className,
}: MiniPlayerControlProps) {
  if (!currentSong) return null;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex items-center">
        {/* Song thumbnail */}
        <div className="relative w-10 h-10 flex-shrink-0 mr-2">
          <img
            src={currentSong.thumbnailUrl}
            alt={currentSong.title}
            className="w-full h-full object-cover rounded"
          />
        </div>
        
        {/* Song info - only show on larger screens */}
        <div className="hidden sm:block overflow-hidden mr-2">
          <p className="text-sm font-medium truncate max-w-[150px]">
            {currentSong.title}
          </p>
          <p className="text-xs text-muted-foreground truncate max-w-[150px]">
            {currentSong.artist}
          </p>
        </div>
      </div>
      
      {/* Controls */}
      <div className="flex items-center">
        <Button
          onClick={onPlayPause}
          variant="ghost"
          size="sm"
          className="w-8 h-8 p-0"
        >
          {isPlaying ? (
            <PauseCircle className="h-6 w-6 text-primary" />
          ) : (
            <PlayCircle className="h-6 w-6 text-primary" />
          )}
          <span className="sr-only">{isPlaying ? 'Pause' : 'Play'}</span>
        </Button>
        
        <Button
          onClick={onSkipNext}
          variant="ghost"
          size="sm"
          className="w-8 h-8 p-0"
        >
          <SkipForward className="h-5 w-5 text-primary" />
          <span className="sr-only">Next</span>
        </Button>
      </div>
    </div>
  );
}