import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ListMusic, Settings2, History, Library, Search, Play, Trash2, GripVertical, Music2 } from 'lucide-react';
import { AddIcon } from '../../../../../assets/icons/AddIcon';

// Stages:
// 0: Show Queue tab with a "Now Playing" song + 2 queued songs
// 1: Animate switch to "Playlists" tab
// 2: Show playlists tab content
// 3: Switch back to Queue tab
const STAGE_DURATIONS = [2500, 400, 2500, 400];

const songs = [
  { title: 'Midnight City Explorer', artist: 'Lofi Beats', thumb: 'bg-purple-900/60' },
  { title: 'Ocean Drive', artist: 'Synthwave', thumb: 'bg-blue-900/60' },
  { title: 'Café Racer', artist: 'Jazz Hop', thumb: 'bg-amber-900/60' },
];

export default function MusicMockup() {
  const [stage, setStage] = useState(0);
  const [activeTab, setActiveTab] = useState<'queue' | 'recently-played' | 'playlists' | 'guest-controls'>('queue');

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    if (stage === 0) {
      t = setTimeout(() => setStage(1), STAGE_DURATIONS[0]);
    } else if (stage === 1) {
      setActiveTab('playlists');
      t = setTimeout(() => setStage(2), STAGE_DURATIONS[1]);
    } else if (stage === 2) {
      t = setTimeout(() => setStage(3), STAGE_DURATIONS[2]);
    } else if (stage === 3) {
      setActiveTab('queue');
      t = setTimeout(() => setStage(0), STAGE_DURATIONS[3]);
    }
    return () => clearTimeout(t);
  }, [stage]);

  const tabs = [
    { id: 'queue' as const, label: 'Queue', icon: <ListMusic className="w-3 h-3" /> },
    { id: 'guest-controls' as const, label: 'Guests', icon: <Settings2 className="w-3 h-3" /> },
    { id: 'recently-played' as const, label: 'Recent', icon: <History className="w-3 h-3" /> },
    { id: 'playlists' as const, label: 'Playlists', icon: <Library className="w-3 h-3" /> },
  ];

  return (
    <div className="flex-1 flex flex-col bg-[#0F1419] h-full overflow-hidden select-none pointer-events-none space-y-3 p-3">
      {/* ── Top Row ── */}
      <div className="flex items-center justify-between bg-dashboard-sidebar/40 px-3 py-2.5 rounded-xl">
        <div className="flex flex-col items-start gap-1 bg-dashboard-muted/50 px-2.5 py-1.5 rounded-xl">
          <div className="w-8 h-4 bg-dashboard-accent rounded-full flex items-center px-0.5">
            <div className="w-3 h-3 rounded-full bg-white ml-auto shadow" />
          </div>
          <span className="text-[8px] text-white leading-tight">Public Visibility</span>
        </div>
        <button className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-dashboard-accent text-[10px] text-white font-medium shadow-lg shadow-blue-900/30">
          <AddIcon size="3.5" />
          <span>New Playlist</span>
        </button>
      </div>

      {/* ── Add Songs section ── */}
      <div className="bg-black/20 rounded-xl p-3">
        <div className="flex items-center gap-2 mb-2">
          <Search className="w-3.5 h-3.5 text-dashboard-accent" />
          <p className="text-white text-xs font-semibold">Add Songs</p>
        </div>
        <div className="w-full bg-dashboard-muted border border-white/10 rounded-lg px-3 py-1.5 text-[10px] text-gray-500 flex items-center gap-2">
          <Search className="w-3 h-3 text-gray-500" />
          Search YouTube for a song…
        </div>
      </div>

      {/* ── Now Playing ── */}
      <div className="bg-black/20 rounded-xl p-3 flex items-center gap-3">
        <div className={`w-10 h-10 rounded shrink-0 ${songs[0].thumb}`} />
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-medium truncate">{songs[0].title}</p>
          <p className="text-gray-400 text-[9px] truncate">{songs[0].artist}</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-dashboard-accent flex items-center justify-center shrink-0">
          <Play className="w-3.5 h-3.5 text-white fill-current ml-0.5" />
        </div>
      </div>

      {/* ── Tab Switcher ── */}
      <div className="flex items-center justify-center mx-auto bg-white rounded-3xl w-fit shadow-sm">
        {tabs.map(tab => (
          <motion.div
            key={tab.id}
            animate={activeTab === tab.id
              ? { backgroundColor: '#3498DB', color: '#fff' }
              : { backgroundColor: '#fff', color: '#000' }
            }
            transition={{ duration: 0.3 }}
            className="flex items-center justify-center gap-1 px-3 py-1.5 text-[9px] font-medium rounded-2xl whitespace-nowrap"
          >
            {tab.icon}
            <span>{tab.label}</span>
          </motion.div>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className="bg-black/20 rounded-xl overflow-hidden flex-1">
        <div className="p-3 h-full">
          <AnimatePresence mode="wait">
            {activeTab === 'queue' && (
              <motion.div key="queue" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {/* Now Playing row */}
                <div className="flex items-center gap-2 p-2 mb-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className={`w-8 h-8 rounded shrink-0 ${songs[0].thumb}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[8px] text-green-400 mb-0.5">Now Playing</p>
                    <p className="text-[10px] text-white font-medium truncate">{songs[0].title}</p>
                    <p className="text-[9px] text-gray-400 truncate">{songs[0].artist}</p>
                  </div>
                </div>
                {/* Queue items */}
                {songs.slice(1).map((s, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 mb-1 rounded-lg hover:bg-white/5 group">
                    <GripVertical className="w-3 h-3 text-gray-600 shrink-0" />
                    <div className={`w-7 h-7 rounded shrink-0 ${s.thumb}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-white font-medium truncate">{s.title}</p>
                      <p className="text-[9px] text-gray-400 truncate">{s.artist}</p>
                    </div>
                    <Trash2 className="w-3 h-3 text-gray-600 shrink-0 opacity-0 group-hover:opacity-100" />
                  </div>
                ))}
              </motion.div>
            )}
            {activeTab === 'playlists' && (
              <motion.div key="playlists" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] text-gray-500">2 playlists</span>
                  <button className="flex items-center gap-1 px-2 py-1 rounded-lg bg-dashboard-accent text-[9px] text-white">
                    <AddIcon size="3" /> New Playlist
                  </button>
                </div>
                {[{ name: 'Chill Vibes', count: 12 }, { name: 'Morning Jams', count: 8 }].map((p, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 mb-1 bg-dashboard-muted/30 rounded-lg border border-white/5">
                    <div className="w-8 h-8 rounded bg-dashboard-muted flex items-center justify-center shrink-0">
                      <Music2 size={12} className="text-dashboard-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-white font-medium">{p.name}</p>
                      <p className="text-[9px] text-gray-500">{p.count} songs</p>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
