import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gamepad2, BookOpen, Film, ChevronRight, Star, Plus, ChevronDown } from 'lucide-react';

// 3-phase walkthrough cycling across Games → Books → Movies
// Phase 0 (3s)   — Hero + list cards overview (static)
// Phase 1 (3.5s) — List detail: Recommendations tab (poster-row list style matching production UI)
// Phase 2 (3.5s) — List detail: Manage tab (collapsible Manage + My QR sections)
// → next category → loop

type Category = 'games' | 'books' | 'movies';

interface Entry { name: string; year: string; genres: string[]; rating: number; duration: string; img: string; pinned: boolean; isShow?: boolean; }
interface CatList { name: string; count: number; status: string; pinned: number; total: number; entries: Entry[]; }
interface CatConfig {
  key: Category; label: string; Icon: React.ComponentType<any>;
  accentColor: string; listLabel: string; addLabel: string;
  topPick: { title: string; year: string; genres: string[]; img: string; };
  lists: CatList[];
}

const CATS: CatConfig[] = [
  {
    key: 'games', label: 'Games', Icon: Gamepad2, accentColor: '#ec4899', listLabel: 'games', addLabel: 'Add Game',
    topPick: { title: 'Elden Ring', year: '2022', genres: ['Action RPG', 'Open World'], img: '/landing/Paris.jpg' },
    lists: [
      {
        name: 'Top Picks', count: 6, status: 'Published', pinned: 2, total: 15,
        entries: [
          { name: 'Elden Ring', year: '2022', genres: ['Action', 'RPG'], rating: 9.5, duration: '100h', img: '/landing/Paris.jpg', pinned: true },
          { name: 'Cyberpunk 2077', year: '2020', genres: ['RPG', 'Open World'], rating: 8.2, duration: '60h', img: '/landing/Bali.jpg', pinned: false },
          { name: 'GTA V', year: '2013', genres: ['Action', 'Adventure'], rating: 9.1, duration: '80h', img: '/landing/Kyoto.jpg', pinned: true },
          { name: 'Tekken 7', year: '2015', genres: ['Fighting'], rating: 7.8, duration: '40h', img: '/landing/Eiffel_Tower.jpg', pinned: false },
        ],
      },
      { name: 'Wishlist', count: 12, status: 'Public', pinned: 0, total: 12, entries: [] },
      { name: 'Archived', count: 2, status: 'Draft', pinned: 0, total: 2, entries: [] },
    ],
  },
  {
    key: 'books', label: 'Books', Icon: BookOpen, accentColor: '#f97316', listLabel: 'books', addLabel: 'Add Book',
    topPick: { title: 'Rich Dad Poor Dad', year: '1997', genres: ['Finance', 'Self-Help'], img: '/landing/Kyoto.jpg' },
    lists: [
      {
        name: 'Top Reads', count: 7, status: 'Published', pinned: 3, total: 15,
        entries: [
          { name: 'Rich Dad Poor Dad', year: '1997', genres: ['Finance', 'Self-Help'], rating: 9.2, duration: '336p', img: '/landing/Kyoto.jpg', pinned: true },
          { name: 'Psychology of Money', year: '2020', genres: ['Finance'], rating: 8.9, duration: '256p', img: '/landing/Bali.jpg', pinned: false },
          { name: 'Atomic Habits', year: '2018', genres: ['Self-Help'], rating: 9.1, duration: '320p', img: '/landing/Paris.jpg', pinned: true },
          { name: 'Deep Work', year: '2016', genres: ['Productivity'], rating: 8.5, duration: '296p', img: '/landing/Eiffel_Tower.jpg', pinned: false },
        ],
      },
      { name: 'Travel Reads', count: 0, status: 'Draft', pinned: 0, total: 0, entries: [] },
      { name: 'Wishlist', count: 12, status: 'Public', pinned: 0, total: 12, entries: [] },
    ],
  },
  {
    key: 'movies', label: 'Movies & Shows', Icon: Film, accentColor: '#3b82f6', listLabel: 'movies', addLabel: 'Add Movie or Show',
    topPick: { title: 'Interstellar', year: '2014', genres: ['Sci-Fi', 'Adventure'], img: '/landing/Bali.jpg' },
    lists: [
      {
        name: 'fvrt', count: 8, status: 'Published', pinned: 3, total: 15,
        entries: [
          { name: 'Titanic', year: '1997', genres: ['Drama', 'Romance'], rating: 7.9, duration: '3h 14m', img: '/landing/Bali.jpg', pinned: true, isShow: false },
          { name: 'Fights Break Sphere', year: '2017', genres: ['Animation', 'Action & Adventure'], rating: 8.2, duration: '25m', img: '/landing/Paris.jpg', pinned: false, isShow: true },
          { name: 'Raw', year: '1993', genres: ['Reality'], rating: 6.8, duration: '2h 10m', img: '/landing/Kyoto.jpg', pinned: true, isShow: true },
          { name: 'Border 2', year: '2026', genres: ['Action', 'Drama'], rating: 6.4, duration: '3h 21m', img: '/landing/Eiffel_Tower.jpg', pinned: true, isShow: false },
          { name: 'Amagami SS', year: '2010', genres: ['Romance', 'Anime'], rating: 7.5, duration: '24m', img: '/landing/Louvre_Museum.jpg', pinned: false, isShow: true },
        ],
      },
      { name: 'Classics', count: 5, status: 'Draft', pinned: 0, total: 5, entries: [] },
      { name: 'Watch Later', count: 15, status: 'Public', pinned: 0, total: 15, entries: [] },
    ],
  },
];

const PHASE_DURATIONS = [3000, 3800, 3800];

// Fake QR pattern
const QR_FILLED = [0,1,2,3,4,5,7,11,12,13,16,18,19,20,21,22,23,24,25,27,30,32,34,36,37,38,39,40,42,43,47,49,50,51,52,53,54,56,60,61,62,63];

export default function RecommendationsMockup() {
  const [catIdx, setCatIdx] = useState(0);
  const [phase, setPhase] = useState(0);
  const manageScrollRef = React.useRef<HTMLDivElement>(null);

  const cat = CATS[catIdx];

  useEffect(() => {
    const nextPhase = (phase + 1) % PHASE_DURATIONS.length;
    const t = setTimeout(() => {
      if (nextPhase === 0) setCatIdx(prev => (prev + 1) % CATS.length);
      setPhase(nextPhase);
    }, PHASE_DURATIONS[phase]);
    return () => clearTimeout(t);
  }, [phase, catIdx]);

  // Auto-scroll manage tab to bottom
  useEffect(() => {
    if (phase === 2 && manageScrollRef.current) {
      const scrollDelay = setTimeout(() => {
        if (manageScrollRef.current) {
          manageScrollRef.current.scrollTop = manageScrollRef.current.scrollHeight;
          // Keep scrolling to ensure it reaches bottom
          const scrollInterval = setInterval(() => {
            if (manageScrollRef.current) {
              manageScrollRef.current.scrollTop = manageScrollRef.current.scrollHeight;
            }
          }, 100);
          setTimeout(() => clearInterval(scrollInterval), 800);
        }
      }, 200);
      return () => clearTimeout(scrollDelay);
    }
  }, [phase]);

  const activeList = cat.lists[0];

  return (
    <div className="flex-1 flex flex-col bg-[#0d1117] h-full overflow-hidden select-none pointer-events-none text-white">

      {/* Category tab indicator */}
      <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1.5 shrink-0">
        {CATS.map((c, i) => {
          const { Icon } = c;
          return (
            <motion.div key={c.key}
              animate={i === catIdx ? { opacity: 1, scale: 1 } : { opacity: 0.28, scale: 0.92 }}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[7px] font-bold border"
              style={{
                backgroundColor: i === catIdx ? c.accentColor + '20' : 'transparent',
                borderColor: i === catIdx ? c.accentColor + '55' : 'transparent',
                color: i === catIdx ? c.accentColor : 'white',
              }}
            >
              <Icon size={8} /><span>{c.label}</span>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence mode="wait">

        {/* ── Phase 0: Hero + list card grid (static) ── */}
        {phase === 0 && (
          <motion.div key={`home-${catIdx}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.3 }}
            className="flex-1 overflow-y-auto hide-scrollbar pb-10">
            {/* Hero */}
            <section className="relative w-full h-[150px] bg-black overflow-hidden mb-3 shadow-xl">
              <img src={cat.topPick.img} alt={cat.topPick.title} className="w-full h-full object-cover opacity-55" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0d1117] via-[#0d1117]/30 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#0d1117]/80 to-transparent" />
              <div className="absolute top-2 left-3">
                <span className="text-[7px] font-black uppercase tracking-widest text-yellow-400 flex items-center gap-1">
                  <span className="w-0.5 h-2.5 bg-yellow-400 rounded-full inline-block" />Top Pick
                </span>
              </div>
              <div className="absolute inset-0 p-3 flex flex-col justify-end">
                <div className="flex items-end gap-2">
                  <div className="flex-1 min-w-0">
                    <h1 className="text-[11px] font-black text-white leading-tight mb-0.5">{cat.topPick.title}</h1>
                    <div className="flex items-center gap-1 text-[6.5px] text-white/60 font-bold uppercase tracking-widest mb-1.5">
                      <span>{cat.topPick.year}</span><span className="text-white/30">•</span>
                      <span>{cat.topPick.genres.join(' / ')}</span>
                    </div>
                    <button className="text-white text-[6.5px] font-black py-0.5 px-1.5 rounded shadow-lg flex items-center gap-0.5"
                      style={{ backgroundColor: cat.accentColor }}>
                      <cat.Icon size={6} /> See Details
                    </button>
                  </div>
                  <div className="shrink-0 w-9 aspect-[2/3] rounded-md border border-white/20 overflow-hidden shadow-2xl">
                    <img src={cat.topPick.img} alt="poster" className="w-full h-full object-cover" />
                  </div>
                </div>
              </div>
            </section>

            {/* List cards 2-col */}
            <div className="px-3 grid grid-cols-2 gap-2">
              {cat.lists.map((list) => (
                <div key={list.name} className="bg-[#161b22] border border-white/5 rounded-xl p-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1">
                      <div className="w-0.5 h-2.5 rounded-full" style={{ backgroundColor: cat.accentColor }} />
                      <h3 className="text-[8px] font-black text-white leading-tight">{list.name}</h3>
                    </div>
                    <span className={`text-[6px] font-bold px-1 py-0.5 rounded-full leading-none ${
                      list.status === 'Published' ? 'text-green-400 bg-green-500/10' :
                      list.status === 'Draft' ? 'text-gray-400 bg-white/5' : 'text-blue-400 bg-blue-500/10'
                    }`}>{list.status}</span>
                  </div>
                  {list.entries?.length > 0 ? (
                    <div className="flex gap-0.5 mb-1.5">
                      {list.entries.slice(0, 3).map((e, i) => (
                        <div key={i} className="flex-1 rounded-sm overflow-hidden aspect-[2/3] bg-white/10">
                          <img src={e.img} alt={e.name} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-7 rounded-md bg-white/5 border border-dashed border-white/10 flex items-center justify-center mb-1.5">
                      <span className="text-[6px] text-gray-500">Empty</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-[6.5px] text-gray-500">{list.count} {cat.listLabel}</span>
                    <span className="text-[6.5px] flex items-center gap-0.5 font-bold" style={{ color: cat.accentColor }}>Open <ChevronRight size={7} /></span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Phase 1 & 2: List detail ── */}
        {(phase === 1 || phase === 2) && (
          <motion.div key={`detail-${catIdx}`} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col overflow-hidden">

            {/* List detail header */}
            <div className="px-3 py-2 flex items-center justify-between shrink-0 border-b border-white/5">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center">
                  <ChevronRight size={8} className="text-white rotate-180" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black text-white">{activeList.name}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[6.5px] text-white/40 font-bold">{activeList.count} {cat.listLabel}</span>
                    <span className="text-yellow-400">•</span>
                    <Star size={6} className="text-yellow-400 fill-yellow-400" />
                    <span className="text-[6.5px] text-yellow-400 font-bold">{activeList.pinned}/{activeList.total} pinned</span>
                  </div>
                </div>
              </div>
              {/* Published toggle */}
              <div className="flex items-center gap-1">
                <span className="text-[6.5px] text-white/50 font-bold">Published</span>
                <div className="w-6 h-3.5 bg-blue-500 rounded-full relative">
                  <div className="absolute right-0.5 top-0.5 bottom-0.5 aspect-square bg-white rounded-full shadow-sm" />
                </div>
              </div>
            </div>

            {/* Recommendations / Manage tab switcher */}
            <div className="px-3 py-2 flex items-center justify-center shrink-0">
              <div className="flex items-center bg-white rounded-3xl shadow-sm p-0.5 w-full max-w-[180px]">
                {(['recommendations', 'manage'] as const).map(tab => (
                  <button key={tab} className={`flex-1 py-1 text-[7.5px] font-black rounded-2xl transition-all duration-300 ${
                    (tab === 'recommendations' && phase === 1) || (tab === 'manage' && phase === 2)
                      ? 'bg-[#3498DB] text-white shadow-md' : 'text-black'
                  }`}>
                    {tab === 'recommendations' ? 'Recommendations' : 'Manage'}
                  </button>
                ))}
              </div>
            </div>

            <AnimatePresence mode="wait">

              {/* ── Phase 1: Recommendations — List style with banner & add button ── */}
              {phase === 1 && (
                <motion.div key="recs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex-1 overflow-y-auto hide-scrollbar px-3 pb-6 pt-2">
                  
                  {/* Top Picks banner */}
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-3 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2">
                      <Star size={10} className="text-amber-400 fill-amber-400" />
                      <span className="text-[9px] font-black text-amber-400 uppercase tracking-tight">
                        Manage Top Picks ({activeList.pinned}/{activeList.total})
                      </span>
                    </div>
                    <ChevronRight size={8} className="text-amber-400" />
                  </div>

                  {/* Add Movie/Show button */}
                  <button className="w-full py-2.5 mb-3 rounded-xl bg-blue-500 text-white text-[8px] font-black uppercase tracking-tighter flex items-center justify-center gap-1.5 shadow-lg hover:bg-blue-600 transition-colors">
                    <Plus size={9} />
                    {cat.addLabel}
                  </button>

                  {/* Movies list - single column with horizontal poster layout */}
                  <div className="space-y-2">
                    {activeList.entries.map((entry, i) => (
                      <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                        className="bg-[#1a1f2e] rounded-xl overflow-hidden border border-white/5 shadow-md flex gap-2.5 p-2">
                        
                        {/* Poster */}
                        <div className="w-12 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-white/5 border border-white/10">
                          <img src={entry.img} alt={entry.name} className="w-full h-full object-cover" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 flex flex-col justify-between py-0.5">
                          <div>
                            <p className="text-[8px] font-black text-white leading-tight truncate">{entry.name}</p>
                            <p className="text-[6.5px] text-white/50 uppercase tracking-tighter font-bold truncate">
                              {entry.year} • {entry.genres.join(', ')}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Star size={7} className="text-yellow-400 fill-yellow-400" />
                            <span className="text-[6.5px] font-bold text-yellow-400">{entry.rating}</span>
                            <span className="text-[6px] text-white/40">•</span>
                            <span className="text-[6.5px] text-white/50">{entry.duration}</span>
                          </div>
                        </div>

                        {/* Favorite star */}
                        <div className="flex-shrink-0 flex items-center justify-center">
                          <Star size={9} className={entry.pinned ? 'text-yellow-400 fill-yellow-400' : 'text-white/30'} />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ── Phase 2: Manage tab — collapsible sections ── */}
              {phase === 2 && (
                <motion.div key="manage" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  ref={manageScrollRef}
                  className="flex-1 px-3 py-4 space-y-3 overflow-y-auto" style={{ scrollBehavior: 'smooth' }}>
                  
                  {/* Manage section */}
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-[#1a1f2e] border border-white/5 rounded-2xl overflow-hidden shadow-lg">
                    <button className="w-full px-3.5 py-3 flex items-center justify-between hover:bg-white/5 transition-colors">
                      <span className="text-[9px] font-black text-white uppercase tracking-tight">Manage</span>
                      <ChevronDown size={8} className="text-white/50" />
                    </button>
                    
                    {/* Expanded manage content */}
                    <div className="px-3.5 pb-3 space-y-2 border-t border-white/5">
                      {/* Delete button */}
                      <button className="w-full py-2.5 px-3 rounded-xl border border-red-500/30 bg-red-500/5 text-red-400 text-[8px] font-black uppercase tracking-tighter flex items-center justify-center gap-1.5 hover:bg-red-500/10 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        Delete
                      </button>

                      {/* Edit button */}
                      <button className="w-full py-2.5 px-3 rounded-xl border border-white/10 bg-white/5 text-white text-[8px] font-black uppercase tracking-tighter flex items-center justify-center gap-1.5 hover:bg-white/10 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        Edit
                      </button>

                      {/* Published toggle */}
                      <div className="py-2.5 px-3 rounded-xl border border-green-500/20 bg-green-500/5 flex items-center justify-between">
                        <div>
                          <span className="text-[8.5px] font-black text-white uppercase tracking-tight block">Published</span>
                          <span className="text-[6.5px] text-white/40 uppercase tracking-widest font-bold">(Visible to public)</span>
                        </div>
                        <div className="w-7 h-4 bg-green-500 rounded-full relative shrink-0">
                          <div className="absolute right-0.5 top-0.5 bottom-0.5 aspect-square bg-white rounded-full shadow-sm" />
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* My QR section */}
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="bg-[#1a1f2e] border border-white/5 rounded-2xl overflow-hidden shadow-lg">
                    <button className="w-full px-3.5 py-3 flex items-center justify-between hover:bg-white/5 transition-colors">
                      <span className="text-[9px] font-black text-white uppercase tracking-tight">My QR</span>
                      <ChevronDown size={8} className="text-white/50" />
                    </button>

                    {/* Expanded QR content */}
                    <div className="px-3.5 pb-4 space-y-3 border-t border-white/5 pt-3">
                      {/* QR Code */}
                      <div className="flex flex-col items-center gap-2 py-3 px-2 rounded-xl border border-white/10 bg-white/5">
                        <span className="text-[7.5px] font-black text-white/60 uppercase tracking-tighter">My Recommendations</span>
                        <div className="w-24 h-24 bg-black rounded-lg border border-white/20 flex items-center justify-center overflow-hidden">
                          <svg viewBox="0 0 200 200" className="w-full h-full">
                            {/* QR pattern */}
                            {QR_FILLED.map(idx => {
                              const row = Math.floor(idx / 7);
                              const col = idx % 7;
                              return (
                                <rect key={idx} x={col * 28} y={row * 28} width={26} height={26} fill="white" />
                              );
                            })}
                          </svg>
                        </div>
                        <button className="text-[7px] font-bold bg-white text-black px-3 py-1.5 rounded-full">
                          Travel like a local
                        </button>
                      </div>

                      {/* Action buttons */}
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: 'Share Link', icon: 'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z' },
                          { label: 'Copy Link', icon: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z' },
                          { label: 'Download QR', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4' },
                        ].map(({ label: lbl, icon }) => (
                          <motion.button key={lbl}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="p-2 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center gap-1.5 hover:bg-white/10 transition-colors">
                            <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                            </svg>
                            <span className="text-[6px] font-black text-white/60 uppercase tracking-tighter text-center leading-tight">{lbl}</span>
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  </motion.div>

                  {/* Create List Form */}
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8, duration: 0.6 }}
                    className="bg-[#1a1f2e] border border-white/5 rounded-2xl overflow-hidden shadow-lg p-4">
                    <h3 className="text-[9px] font-black text-white uppercase tracking-tight mb-3">Create New List</h3>
                    
                    <div className="space-y-3">
                      {/* List Name Input */}
                      <div>
                        <label className="text-[7px] font-bold text-white/60 uppercase tracking-tighter block mb-1.5">List Name</label>
                        <input 
                          type="text" 
                          value="My Favorites" 
                          readOnly
                          className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-[8px] text-white placeholder-white/30 focus:outline-none"
                        />
                      </div>

                      {/* Description Input */}
                      <div>
                        <label className="text-[7px] font-bold text-white/60 uppercase tracking-tighter block mb-1.5">Description</label>
                        <textarea 
                          value="Collection of top picks and recommendations" 
                          readOnly
                          rows={2}
                          className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-[8px] text-white placeholder-white/30 focus:outline-none resize-none"
                        />
                      </div>

                      {/* Visibility Select */}
                      <div>
                        <label className="text-[7px] font-bold text-white/60 uppercase tracking-tighter block mb-1.5">Visibility</label>
                        <select 
                          disabled
                          defaultValue="published"
                          className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-[8px] text-white focus:outline-none cursor-not-allowed"
                        >
                          <option value="published">Published (Visible to all)</option>
                          <option value="private">Private</option>
                          <option value="draft">Draft</option>
                        </select>
                      </div>

                      {/* Submit Button */}
                      <button className="w-full py-2.5 rounded-lg bg-blue-500 text-white text-[8px] font-black uppercase tracking-tighter flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors">
                        <Plus size={8} />
                        Create List
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
