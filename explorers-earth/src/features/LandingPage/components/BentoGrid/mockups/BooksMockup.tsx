import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, ChevronRight } from 'lucide-react';

// 3-phase automated walkthrough:
// Phase 0 (3s)   — Hero section + list cards overview (static)
// Phase 1 (3.5s) — Drill into "Top Reads" list → 2-col item grid, Recommendations tab active
// Phase 2 (3.5s) — Switch to Manage tab → control dashboard
// → loop

const PHASE_DURATIONS = [3000, 3500, 3500];

const TOP_PICK = {
  title: 'Rich Dad Poor Dad',
  year: '1997',
  genres: ['Finance', 'Self-Help'],
  img: '/landing/Kyoto.jpg',
  poster: '/landing/Kyoto.jpg',
};

const LISTS = [
  {
    name: 'Top Reads',
    count: 7,
    status: 'Published',
    items: [
      { name: 'Rich Dad Poor Dad', meta: 'Kiyosaki', img: '/landing/Kyoto.jpg' },
      { name: 'Psychology of Money', meta: 'Morgan Housel', img: '/landing/Bali.jpg' },
      { name: 'Atomic Habits', meta: 'James Clear', img: '/landing/Paris.jpg' },
      { name: 'Deep Work', meta: 'Cal Newport', img: '/landing/Eiffel_Tower.jpg' },
    ],
  },
  {
    name: 'Travel Reads',
    count: 0,
    status: 'Draft',
    items: [],
  },
  {
    name: 'Wishlist',
    count: 12,
    status: 'Public',
    items: [
      { name: 'Dune', meta: 'Frank Herbert', img: '/landing/Louvre_Museum.jpg' },
      { name: 'Foundation', meta: 'Isaac Asimov', img: '/landing/Bali.jpg' },
    ],
  },
];

const MANAGE_ACTIONS = [
  { label: 'Edit List', color: 'blue',  icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
  { label: 'Share',    color: 'green', icon: 'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z' },
  { label: 'Draft',   color: 'amber', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
  { label: 'Delete',  color: 'red',   icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' },
];

export default function BooksMockup() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setPhase(p => (p + 1) % PHASE_DURATIONS.length), PHASE_DURATIONS[phase]);
    return () => clearTimeout(t);
  }, [phase]);

  const activeList = LISTS[0];

  return (
    <div className="flex-1 flex flex-col bg-[#0F1419] h-full overflow-hidden select-none pointer-events-none font-poppins">
      <AnimatePresence mode="wait">

        {/* ── Phase 0: Hero + list overview ── */}
        {phase === 0 && (
          <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}
            className="flex-1 overflow-y-auto hide-scrollbar pb-16">

            {/* Hero */}
            <section className="relative w-full h-[190px] bg-black overflow-hidden mb-4 shadow-2xl">
              <img src={TOP_PICK.img} alt={TOP_PICK.title} className="w-full h-full object-cover opacity-60" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0F1419] via-[#0F1419]/40 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#0F1419]/80 to-transparent" />
              <div className="absolute top-3 left-4">
                <span className="text-[8px] font-black text-yellow-400 uppercase tracking-widest flex items-center gap-1">
                  <span className="w-0.5 h-3 bg-yellow-400 rounded-full inline-block" />Top Pick
                </span>
              </div>
              <div className="absolute inset-0 p-3 flex flex-col justify-end">
                <div className="flex items-end gap-2.5">
                  <div className="flex-1 min-w-0">
                    <h1 className="text-sm font-black text-white leading-tight mb-1 drop-shadow-lg">{TOP_PICK.title}</h1>
                    <div className="flex items-center gap-1 text-[7px] text-white/70 font-bold uppercase tracking-widest mb-2">
                      <span>{TOP_PICK.year}</span><span className="text-white/30">•</span>
                      <span>{TOP_PICK.genres.join(' / ')}</span>
                    </div>
                    <button className="flex items-center gap-1 bg-[#3498DB] text-white text-[7px] font-black py-1 px-2 rounded-md shadow-lg">
                      <BookOpen size={7} /> See Details
                    </button>
                  </div>
                  <div className="shrink-0 w-12 aspect-[2/3] rounded-md border border-white/20 overflow-hidden shadow-2xl">
                    <img src={TOP_PICK.poster} alt="poster" className="w-full h-full object-cover" />
                  </div>
                </div>
              </div>
            </section>

            {/* Lists */}
            <div className="px-3 space-y-2">
              {LISTS.map((list) => (
                <div key={list.name} className="bg-[#1a1f2e] border border-white/5 rounded-xl p-2.5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-0.5 h-3 bg-amber-400 rounded-full" />
                      <h3 className="text-[10px] font-black text-white">{list.name}</h3>
                    </div>
                    <span className={`text-[7px] font-bold px-1.5 py-0.5 rounded-full ${
                      list.status === 'Published' ? 'text-green-400 bg-green-500/10' :
                      list.status === 'Draft' ? 'text-gray-400 bg-white/5' :
                      'text-blue-400 bg-blue-500/10'
                    }`}>{list.status}</span>
                  </div>
                  {list.items.length > 0 ? (
                    <div className="flex gap-1 mb-2">
                      {list.items.slice(0, 4).map((it, i) => (
                        <div key={i} className="w-7 rounded-sm overflow-hidden aspect-[2/3] bg-white/10 shrink-0">
                          <img src={it.img} alt={it.name} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-8 rounded-md bg-white/5 border border-dashed border-white/10 flex items-center justify-center mb-2">
                      <span className="text-[7px] text-gray-500">No books yet</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] text-gray-500">{list.count} books</span>
                    <span className="text-[8px] text-amber-400 flex items-center gap-0.5 font-bold">Open <ChevronRight size={8} /></span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Phase 1 & 2: List detail ── */}
        {(phase === 1 || phase === 2) && (
          <motion.div key="detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col overflow-hidden">

            {/* Header */}
            <div className="px-3 py-2.5 flex items-center gap-2 shrink-0 border-b border-white/5">
              <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                <ChevronRight size={10} className="text-white rotate-180" />
              </div>
              <BookOpen size={12} className="text-amber-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <h2 className="text-[10px] font-black text-white truncate">{activeList.name}</h2>
                <p className="text-[7px] text-white/40 uppercase tracking-widest font-bold">{activeList.count} books • Books</p>
              </div>
            </div>

            {/* Tab switcher */}
            <div className="px-3 py-2 flex items-center justify-center shrink-0">
              <div className="flex items-center bg-white rounded-3xl shadow-sm p-0.5">
                {(['recommendations', 'manage'] as const).map(tab => (
                  <button key={tab} className={`px-3 py-1 text-[8px] font-black rounded-2xl transition-all duration-300 ${
                    (tab === 'recommendations' && phase === 1) || (tab === 'manage' && phase === 2)
                      ? 'bg-[#3498DB] text-white shadow-md' : 'text-black'
                  }`}>
                    {tab === 'recommendations' ? 'Recommendations' : 'Manage'}
                  </button>
                ))}
              </div>
            </div>

            <AnimatePresence mode="wait">
              {/* Phase 1: 2-col item grid */}
              {phase === 1 && (
                <motion.div key="items" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex-1 overflow-y-auto hide-scrollbar px-3 pb-4">
                  <div className="grid grid-cols-2 gap-2.5">
                    {activeList.items.map((it, i) => (
                      <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                        className="bg-[#1a1f2e] rounded-xl overflow-hidden border border-white/5 shadow-lg">
                        <div className="aspect-[4/3] relative overflow-hidden">
                          <img src={it.img} alt={it.name} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                          <div className="absolute bottom-1.5 left-2 right-2">
                            <p className="text-[8px] font-black text-white leading-tight truncate drop-shadow">{it.name}</p>
                          </div>
                        </div>
                        <div className="px-2 py-1.5">
                          <p className="text-[7px] text-white/40 uppercase tracking-widest font-bold truncate">{it.meta}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Phase 2: Manage dashboard */}
              {phase === 2 && (
                <motion.div key="manage" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex-1 px-3 py-3 space-y-3 overflow-y-auto hide-scrollbar">
                  <div>
                    <p className="text-[10px] font-black text-white uppercase tracking-tight">Manage List</p>
                    <p className="text-[7px] text-white/40 uppercase tracking-[0.2em] font-bold mt-0.5">{activeList.name} • {activeList.count} books</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {MANAGE_ACTIONS.map(({ label, color, icon }) => (
                      <motion.div key={label} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                        className={`${color === 'red' ? 'bg-red-500/10 border-red-500/20' : 'bg-[#1a1f2e] border-white/5'} border rounded-xl p-3 flex flex-col items-center gap-2 shadow-lg`}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                          color === 'blue' ? 'bg-blue-500/10 text-blue-400' :
                          color === 'green' ? 'bg-green-500/10 text-green-400' :
                          color === 'amber' ? 'bg-amber-500/10 text-amber-400' :
                          'bg-red-500/20 text-red-400'}`}>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                          </svg>
                        </div>
                        <span className={`text-[8px] font-black uppercase tracking-tight ${color === 'red' ? 'text-red-400' : 'text-white'}`}>{label}</span>
                      </motion.div>
                    ))}
                  </div>

                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-black text-white uppercase block">Visibility</span>
                      <span className="text-[7px] text-white/40 font-bold uppercase tracking-widest">Live on profile</span>
                    </div>
                    <div className="w-7 h-4 bg-blue-500 rounded-full relative shrink-0">
                      <div className="absolute right-0.5 top-0.5 bottom-0.5 aspect-square bg-white rounded-full shadow-sm" />
                    </div>
                  </div>

                  <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 shrink-0">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <div>
                      <span className="text-[8px] font-black text-green-400 uppercase block">Published</span>
                      <span className="text-[7px] text-white/40 font-bold uppercase tracking-widest">Visible to all explorers</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
