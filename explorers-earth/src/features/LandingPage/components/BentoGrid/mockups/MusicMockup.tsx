import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ListMusic, Settings2, History, Library, Search, Play, Pause, Trash2, GripVertical, Music2 } from 'lucide-react';
import { AddIcon } from '../../../../../assets/icons/AddIcon';

// Stages:
// 0: Queue tab (scroll top)
// 1: Queue tab (scroll down to show more songs)
// 2: Queue tab (scroll up)
// 3: Switch to Guests tab
// 4: Switch to Recent tab
// 5: Switch to Playlists tab
const STAGE_DURATIONS = [2500, 2500, 1500, 2000, 2000, 2500];

const songs = [
  { title: 'Anti-Hero', artist: 'Taylor Swift', img: '/landing/Taylor_Swift_Music.jpg' },
  { title: 'Cruel Summer', artist: 'Taylor Swift', img: '/landing/Taylor_Swift_Music.jpg' },
  { title: 'Shake It Off', artist: 'Taylor Swift', img: '/landing/Taylor_Swift_Music.jpg' },
  { title: 'Blank Space', artist: 'Taylor Swift', img: '/landing/Taylor_Swift_Music.jpg' },
  { title: 'Lover', artist: 'Taylor Swift', img: '/landing/Taylor_Swift_Music.jpg' },
  { title: 'Style', artist: 'Taylor Swift', img: '/landing/Taylor_Swift_Music.jpg' },
];

export default function MusicMockup() {
  const [stage, setStage] = useState(0);
  const [activeTab, setActiveTab] = useState<'queue' | 'recently-played' | 'playlists' | 'guest-controls'>('queue');

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    if (stage === 0) {
      t = setTimeout(() => setStage(1), STAGE_DURATIONS[0]);
    } else if (stage === 1) {
      t = setTimeout(() => setStage(2), STAGE_DURATIONS[1]);
    } else if (stage === 2) {
      setActiveTab('guest-controls');
      t = setTimeout(() => setStage(3), STAGE_DURATIONS[2]);
    } else if (stage === 3) {
      setActiveTab('recently-played');
      t = setTimeout(() => setStage(4), STAGE_DURATIONS[3]);
    } else if (stage === 4) {
      setActiveTab('playlists');
      t = setTimeout(() => setStage(5), STAGE_DURATIONS[4]);
    } else if (stage === 5) {
      setActiveTab('queue');
      t = setTimeout(() => setStage(0), STAGE_DURATIONS[5]);
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
      <motion.div
        animate={{ y: stage === 1 ? -120 : 0 }}
        transition={{ duration: 1.5, ease: 'easeInOut' }}
        className="flex flex-col space-y-3 flex-1"
      >
        {/* ── Add Songs section ── */}
        <div className="bg-black/20 rounded-xl p-3 shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <Search className="w-3.5 h-3.5 text-dashboard-accent" />
            <p className="text-white text-xs font-semibold">Add Songs</p>
          </div>
          <div className="w-full bg-dashboard-muted border border-white/10 rounded-lg px-3 py-1.5 text-[10px] text-gray-500 flex items-center gap-2">
            <Search className="w-3 h-3 text-gray-500" />
            Search YouTube for a song…
          </div>
        </div>

        {/* ── Video Player (Now Playing) ── */}
        <div className="bg-black/40 rounded-xl overflow-hidden shrink-0 border border-[#3498DB]/20 shadow-[0_0_15px_rgba(52,152,219,0.1)] relative">
          <div className="w-full aspect-video relative">
            <img src={songs[0].img} alt={songs[0].title} className="w-full h-full object-cover opacity-80" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            
            {/* Play/Pause overlay in center */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center cursor-pointer border border-white/10 hover:bg-black/70 transition-colors">
                {stage % 2 === 0 ? <Play className="w-4 h-4 text-white fill-current ml-0.5" /> : <Pause className="w-4 h-4 text-white fill-current" />}
              </div>
            </div>

            {/* Bottom info & progress bar */}
            <div className="absolute bottom-0 left-0 right-0 p-3 pt-4">
              <div className="flex items-end justify-between mb-2">
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <motion.div animate={{ height: [3, 7, 3] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-0.5 bg-[#3498DB] rounded-full" />
                    <motion.div animate={{ height: [7, 3, 7] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-0.5 bg-[#3498DB] rounded-full" />
                    <motion.div animate={{ height: [5, 9, 5] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-0.5 bg-[#3498DB] rounded-full" />
                    <p className="text-[#3498DB] text-[7px] font-bold uppercase tracking-wide">Now Playing</p>
                  </div>
                  <p className="text-white text-xs font-bold truncate">{songs[0].title}</p>
                  <p className="text-gray-300 text-[9px] truncate">{songs[0].artist}</p>
                </div>
              </div>
              
              {/* Progress bar */}
              <div className="flex items-center gap-2">
                <span className="text-[7px] text-gray-400 font-medium">1:24</span>
                <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden relative">
                  <motion.div 
                    initial={{ width: "30%" }}
                    animate={{ width: stage % 2 === 0 ? "35%" : "30%" }}
                    transition={{ duration: 2.5, ease: "linear" }}
                    className="absolute top-0 left-0 bottom-0 bg-[#3498DB] rounded-full"
                  />
                </div>
                <span className="text-[7px] text-gray-400 font-medium">3:20</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Tab Switcher ── */}
        <div className="flex items-center justify-center mx-auto bg-white rounded-3xl w-fit shadow-sm shrink-0">
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
        <div className="bg-black/20 rounded-xl overflow-hidden shrink-0 min-h-[220px]">
          <div className="p-3 h-full">
            <AnimatePresence mode="wait">
              {activeTab === 'queue' && (
                <motion.div key="queue" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {/* Queue items */}
                  {songs.slice(1).map((s, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 mb-1 rounded-lg hover:bg-white/5 group">
                      <GripVertical className="w-3 h-3 text-gray-600 shrink-0" />
                      <div className="w-7 h-7 rounded shrink-0 overflow-hidden">
                        <img src={s.img} alt={s.title} className="w-full h-full object-cover" />
                      </div>
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
              {activeTab === 'guest-controls' && (
                <motion.div key="guests" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg border border-white/10">
                    <span className="text-[10px] text-white font-medium">Allow Guests to add songs</span>
                    <div className="w-6 h-3.5 bg-[#3498DB] rounded-full flex items-center px-0.5"><div className="w-2.5 h-2.5 bg-white rounded-full ml-auto"/></div>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg border border-white/10 opacity-50">
                    <span className="text-[10px] text-white font-medium">Require approval</span>
                    <div className="w-6 h-3.5 bg-gray-600 rounded-full flex items-center px-0.5"><div className="w-2.5 h-2.5 bg-white rounded-full"/></div>
                  </div>
                </motion.div>
              )}
              {activeTab === 'recently-played' && (
                <motion.div key="recent" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-2 text-center text-gray-500 text-[9px]">
                  No recently played songs.
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
