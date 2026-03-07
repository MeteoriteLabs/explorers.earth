import { Song } from "@shared/schema";
import { Music2 } from "lucide-react";

type Props = {
  currentSong?: Song;
};

export default function CurrentPlayingSong({ currentSong }: Props) {
  if (!currentSong) {
    return (
      <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
        <Music2 className="h-8 w-8 text-muted-foreground" />
        <p className="text-muted-foreground">No song playing</p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 p-4 bg-primary/5 rounded-lg border border-primary/10">
      <img
        src={currentSong.thumbnailUrl}
        alt={currentSong.title}
        className="h-16 w-16 rounded-md object-cover"
        onError={(e) => {
          (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
        }}
      />
      <div className="flex-grow overflow-hidden">
        <h3 className="font-semibold text-lg text-primary">Now Playing</h3>
        <p className="font-medium truncate">{currentSong.title}</p>
        <p className="text-sm text-muted-foreground truncate">{currentSong.artist}</p>
      </div>
      <Music2 className="h-8 w-8 text-primary animate-pulse" />
    </div>
  );
}
