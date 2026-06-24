// PlaylistTable component for displaying songs in a table format
import { useState, useRef } from 'react';
import { Song } from '../types/music';
import {
  Play,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Music2,
  Clock,
  GripVertical,
} from 'lucide-react';
import Badge from './ui/badge';

interface PlaylistTableProps {
  songs: Song[];
  showControls?: boolean;
  showAddToQueue?: boolean;
  showReorderControls?: boolean;
  isHistory?: boolean;
  isPlaylist?: boolean;
  currentPlayingSong?: Song;
  guestUrl?: string;
  onPlaySong?: (song: Song) => void;
  onAddToQueue?: (song: Song) => void;
  onDeleteSong?: (songId: number) => void;
  onDeleteMultiple?: (songIds: number[]) => void;
  onReorderSongs?: (songIds: number[]) => void;
}

const SONGS_PER_PAGE = 10;

// Accent colour for the drag drop-zone indicator line
const ACCENT = '#22c55e'; // Tailwind green-500 — matches dashboard-accent

export default function PlaylistTable({
  songs,
  showAddToQueue = false,
  showReorderControls = true,
  isHistory = false,
  isPlaylist = false,
  currentPlayingSong,
  onPlaySong,
  onAddToQueue,
  onDeleteSong,
  onReorderSongs,
}: PlaylistTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const draggable = showReorderControls && !isHistory && !!onReorderSongs;

  // ── Drag state stored in refs so nothing re-renders during the drag ──
  const draggedIdRef   = useRef<number | null>(null);   // which song is being dragged
  const dragSourceEl   = useRef<HTMLElement | null>(null); // its DOM node
  const prevDragOverEl = useRef<HTMLElement | null>(null); // last highlighted target

  // Pagination
  const totalPages   = Math.ceil(songs.length / SONGS_PER_PAGE);
  const startIndex   = (currentPage - 1) * SONGS_PER_PAGE;
  const currentSongs = songs.slice(startIndex, startIndex + SONGS_PER_PAGE);

  // ── Up/down button reorder ──────────────────────────────────────────────
  const handleReorder = (songId: number, direction: 'up' | 'down') => {
    const idx = songs.findIndex(s => s.id === songId);
    if (idx === -1) return;
    const next = [...songs];
    const target = direction === 'up' ? idx - 1 : idx + 1;
    if (target >= 0 && target < songs.length) {
      [next[idx], next[target]] = [next[target], next[idx]];
      onReorderSongs?.(next.map(s => s.id));
    }
  };

  // ── Clear all drag visual state ─────────────────────────────────────────
  const clearDragVisuals = () => {
    if (dragSourceEl.current) {
      dragSourceEl.current.style.opacity   = '1';
      dragSourceEl.current.style.transform = '';
      dragSourceEl.current = null;
    }
    if (prevDragOverEl.current) {
      prevDragOverEl.current.style.borderTop    = '';
      prevDragOverEl.current.style.paddingTop   = '';
      prevDragOverEl.current = null;
    }
  };

  // ── Drag START ──────────────────────────────────────────────────────────
  // Key: store id in ref (no setState → no re-render → browser drag stays alive)
  // Key: use requestAnimationFrame to fade AFTER browser captures ghost image
  const handleDragStart = (e: React.DragEvent, songId: number) => {
    draggedIdRef.current = songId;
    dragSourceEl.current = e.currentTarget as HTMLElement;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(songId));
    // Fade the source card after ghost snapshot is taken
    const el = e.currentTarget as HTMLElement;
    requestAnimationFrame(() => {
      el.style.opacity   = '0.35';
      el.style.transform = 'scale(0.97)';
    });
  };

  // ── Drag OVER another card ──────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent, songId: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (songId === draggedIdRef.current) return;

    const el = e.currentTarget as HTMLElement;
    if (prevDragOverEl.current && prevDragOverEl.current !== el) {
      // Remove indicator from previous target
      prevDragOverEl.current.style.borderTop  = '';
      prevDragOverEl.current.style.paddingTop = '';
    }
    // Show a bright insertion line above this target card
    el.style.borderTop  = `2px solid ${ACCENT}`;
    el.style.paddingTop = '0';   // keep height stable
    prevDragOverEl.current = el;
  };

  // ── Drag LEAVE a card ───────────────────────────────────────────────────
  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if truly leaving the card (not moving over a child element)
    const el = e.currentTarget as HTMLElement;
    if (!el.contains(e.relatedTarget as Node)) {
      el.style.borderTop  = '';
      el.style.paddingTop = '';
      if (prevDragOverEl.current === el) prevDragOverEl.current = null;
    }
  };

  // ── DROP ────────────────────────────────────────────────────────────────
  const handleDrop = (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    clearDragVisuals();
    const from = draggedIdRef.current;
    draggedIdRef.current = null;
    if (from === null || from === targetId) return;

    const next   = [...songs];
    const fromIdx = next.findIndex(s => s.id === from);
    const toIdx   = next.findIndex(s => s.id === targetId);
    if (fromIdx !== -1 && toIdx !== -1) {
      const [removed] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, removed);
      onReorderSongs?.(next.map(s => s.id));
    }
  };

  // ── Drag END (fired on source even if dropped outside) ──────────────────
  const handleDragEnd = () => {
    clearDragVisuals();
    draggedIdRef.current = null;
  };

  // ── Empty state ─────────────────────────────────────────────────────────
  if (songs.length === 0) {
    return (
      <div className="py-8 text-center">
        <Music2 className="h-10 w-10 mx-auto text-gray-600 mb-3" />
        <p className="text-sm text-gray-500">
          {isHistory ? 'No songs have been played yet' : 'No songs in the playlist'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Song rows ── */}
      <div className="space-y-1">
        {currentSongs.map((song) => {
          const globalIdx = songs.findIndex(s => s.id === song.id);
          const isPlaying = isPlaylist
            ? song.youtubeId === currentPlayingSong?.youtubeId
            : song.id === currentPlayingSong?.id;

          return (
            <div
              key={song.id}
              draggable={draggable}
              onDragStart={draggable ? (e) => handleDragStart(e, song.id) : undefined}
              onDragOver={draggable  ? (e) => handleDragOver(e, song.id)  : undefined}
              onDragLeave={draggable ? handleDragLeave                     : undefined}
              onDrop={draggable      ? (e) => handleDrop(e, song.id)       : undefined}
              onDragEnd={draggable   ? handleDragEnd                        : undefined}
              className="flex items-center gap-2 p-2.5 rounded-lg bg-white/5 select-none transition-[opacity,transform] duration-150"
            >
              {/* ── DRAG HANDLE + UP/DOWN ── */}
              {showReorderControls && !isHistory && (
                <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                  <div
                    className={`transition-colors ${draggable ? 'cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-200' : 'text-gray-700'}`}
                    title="Drag to reorder"
                  >
                    <GripVertical className="h-4 w-4" />
                  </div>
                  <button
                    onClick={() => handleReorder(song.id, 'up')}
                    disabled={globalIdx === 0}
                    title="Move up"
                    className="h-4 w-4 flex items-center justify-center rounded text-gray-600 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => handleReorder(song.id, 'down')}
                    disabled={globalIdx === songs.length - 1}
                    title="Move down"
                    className="h-4 w-4 flex items-center justify-center rounded text-gray-600 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>
              )}

              {/* ── THUMBNAIL ── */}
              <div className="relative w-10 h-10 rounded overflow-hidden flex-shrink-0">
                <img
                  src={song.thumbnailUrl}
                  alt={song.title}
                  draggable={false}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
                  }}
                />
                {isPlaying && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center">
                      <Play className="h-2.5 w-2.5 text-black ml-0.5" />
                    </div>
                  </div>
                )}
              </div>

              {/* ── SONG INFO ── */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate leading-tight">{song.title}</p>
                <p className="text-xs text-gray-400 truncate">{song.artist}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {isPlaying && (
                    <Badge variant="default" className="bg-green-500 text-xs py-0 px-1.5">
                      Now Playing
                    </Badge>
                  )}
                  {song.playedAt && (
                    <div className="flex items-center text-xs text-gray-600">
                      <Clock className="h-3 w-3 mr-0.5" />
                      {new Date(song.playedAt).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              </div>

              {/* ── ACTION BUTTONS ── */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {onPlaySong && !isPlaying && (
                  <button
                    onClick={() => onPlaySong(song)}
                    title="Play"
                    className="p-1.5 rounded text-white/60 hover:text-white bg-dashboard-accent/40 hover:bg-dashboard-accent transition-colors"
                  >
                    <Play className="h-3.5 w-3.5" />
                  </button>
                )}
                {showAddToQueue && onAddToQueue && (
                  <button
                    onClick={() => onAddToQueue(song)}
                    title="Add to queue"
                    className="p-1.5 rounded text-white/60 hover:text-white bg-white/10 hover:bg-white/20 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
                {onDeleteSong && (
                  <button
                    onClick={() => onDeleteSong(song.id)}
                    title="Remove"
                    className="p-1.5 rounded text-red-400/60 hover:text-red-300 hover:bg-red-400/10 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-1">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="text-xs px-3 py-1.5 rounded bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="text-xs text-gray-500">{currentPage} / {totalPages}</span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="text-xs px-3 py-1.5 rounded bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}