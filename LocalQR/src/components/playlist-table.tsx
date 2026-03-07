// PlaylistTable component for displaying songs in a table format
import { useState } from 'react';
import { Song } from '../types/music';
import Button from './ui/Button';
import Checkbox from './ui/checkbox';
import { 
  Play, 
  Plus, 
  Trash2, 
  ChevronUp, 
  ChevronDown,
  Music2,
  Clock
} from 'lucide-react';
import PlaylistCard, { PlaylistCardContent } from './ui/PlaylistCard';
import Badge from './ui/badge';

interface PlaylistTableProps {
  songs: Song[];
  showControls?: boolean;
  showAddToQueue?: boolean;
  showReorderControls?: boolean;
  isHistory?: boolean;
  currentPlayingSong?: Song;
  guestUrl?: string;
  onAddToQueue?: (song: Song) => void;
  onDeleteSong?: (songId: number) => void;
  onDeleteMultiple?: (songIds: number[]) => void;
  onReorderSongs?: (songIds: number[]) => void;
}

const SONGS_PER_PAGE = 10;

export default function PlaylistTable({
  songs,
  showControls = true,
  showAddToQueue = false,
  showReorderControls = true,
  isHistory = false,
  currentPlayingSong,
  onAddToQueue,
  onDeleteSong,
  onDeleteMultiple,
  onReorderSongs,
}: PlaylistTableProps) {
  const [selectedSongs, setSelectedSongs] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  // Pagination
  const totalPages = Math.ceil(songs.length / SONGS_PER_PAGE);
  const startIndex = (currentPage - 1) * SONGS_PER_PAGE;
  const endIndex = startIndex + SONGS_PER_PAGE;
  const currentSongs = songs.slice(startIndex, endIndex);

  // Handle song selection
  const handleSelectSong = (songId: number) => {
    const newSelected = new Set(selectedSongs);
    if (newSelected.has(songId)) {
      newSelected.delete(songId);
    } else {
      newSelected.add(songId);
    }
    setSelectedSongs(newSelected);
  };

  // Handle delete selected
  const handleDeleteSelected = () => {
    if (selectedSongs.size > 0 && onDeleteMultiple) {
      onDeleteMultiple(Array.from(selectedSongs));
      setSelectedSongs(new Set());
    }
  };

  // Handle reorder
  const handleReorder = (songId: number, direction: 'up' | 'down') => {
    const songIndex = songs.findIndex(song => song.id === songId);
    if (songIndex === -1) return;

    const newSongs = [...songs];
    const targetIndex = direction === 'up' ? songIndex - 1 : songIndex + 1;

    if (targetIndex >= 0 && targetIndex < songs.length) {
      [newSongs[songIndex], newSongs[targetIndex]] = [newSongs[targetIndex], newSongs[songIndex]];
      onReorderSongs?.(newSongs.map(song => song.id));
    }
  };

  // Get song status badge
  const getStatusBadge = (song: Song) => {
    if (song.id === currentPlayingSong?.id) {
      return <Badge variant="default" className="bg-green-500">Now Playing</Badge>;
    }
    if (song.status === 'playing') {
      return <Badge variant="secondary">Playing</Badge>;
    }
    if (song.status === 'played') {
      return <Badge variant="outline">Played</Badge>;
    }
    return <Badge variant="outline">Queued</Badge>;
  };

  if (songs.length === 0) {
    return (
      <PlaylistCard>
        <PlaylistCardContent className="p-8 text-center">
          <Music2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            {isHistory ? 'No songs have been played yet' : 'No songs in the playlist'}
          </p>
        </PlaylistCardContent>
      </PlaylistCard>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bulk actions */}
      {selectedSongs.size > 0 && (
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <span className="text-sm text-muted-foreground">
            {selectedSongs.size} song{selectedSongs.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            {showAddToQueue && onAddToQueue && (
              <Button
                size="small"
                variant="secondary"
                onClick={() => {
                  const selectedSongObjects = songs.filter(song => selectedSongs.has(song.id));
                  selectedSongObjects.forEach(song => onAddToQueue(song));
                  setSelectedSongs(new Set());
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add to Queue
              </Button>
            )}
            {onDeleteMultiple && (
              <Button
                size="small"
                variant="danger"
                onClick={handleDeleteSelected}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Selected
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Songs table */}
      <div className="space-y-2">
        {currentSongs.map((song, index) => (
          <PlaylistCard key={song.id} className="hover:shadow-md transition-shadow bg-black">
            <PlaylistCardContent className="p-4">
              <div className="flex items-center space-x-4">
                {/* Selection checkbox */}
                {showControls && (
                  <Checkbox
                    checked={selectedSongs.has(song.id)}
                    onCheckedChange={() => handleSelectSong(song.id)}
                  />
                )}

                {/* Thumbnail */}
                <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                  <img
                    src={song.thumbnailUrl}
                    alt={song.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
                    }}
                  />
                  {song.id === currentPlayingSong?.id && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                        <Play className="h-3 w-3 text-black ml-0.5" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Song info */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate">{song.title}</h4>
                  <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {getStatusBadge(song)}
                    {song.playedAt && (
                      <div className="flex items-center text-xs text-muted-foreground">
                        <Clock className="h-3 w-3 mr-1" />
                        {new Date(song.playedAt).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {/* Reorder controls */}
                  {showReorderControls && !isHistory && (
                    <div className="flex flex-col">
                      <Button
                        size="small"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => handleReorder(song.id, 'up')}
                        disabled={index === 0}
                      >
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button
                        size="small"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => handleReorder(song.id, 'down')}
                        disabled={index === songs.length - 1}
                      >
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </div>
                  )}

                  {/* Add to queue */}
                  {showAddToQueue && onAddToQueue && (
                    <button
                      onClick={() => {
                        console.log('Adding song to queue:', song);
                        onAddToQueue(song);
                      }}
                      className="px-3 py-1.5 rounded-md transition-all duration-300 flex items-center justify-center bg-gray-600 hover:bg-gray-700"
                      style={{ backgroundColor: '#4b5563' }}
                    >
                      <Plus className="h-4 w-4" style={{ color: 'white' }} />
                    </button>
                  )}

                  {/* Delete */}
                  {onDeleteSong && (
                    <Button
                      size="small"
                      variant="ghost"
                      onClick={() => onDeleteSong(song.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </PlaylistCardContent>
          </PlaylistCard>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2">
          <Button
            variant="secondary"
            size="small"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="secondary"
            size="small"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
