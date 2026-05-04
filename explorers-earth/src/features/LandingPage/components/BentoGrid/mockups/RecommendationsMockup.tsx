import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gamepad2, BookOpen, Film, Plus, Star, ChevronRight, X, Loader2, Search } from 'lucide-react';
import { AddIcon } from '../../../../../assets/icons/AddIcon';

// This single mockup cycles across three categories: Games → Books → Movies
// For each category it runs the same walkthrough:
//   Phase A: View home list cards
//   Phase B: Create list modal + typing
//   Phase C: Inside list → search to add an entry
//   Phase D: Entry added → brief pause
// Then switches to the next category

type Category = 'games' | 'books' | 'movies';

interface CategoryConfig {
  key: Category;
  label: string;
  Icon: React.ComponentType<any>;
  accentColor: string;
  listName: string;
  entryName: string;
  entryMeta: string;
  listLabel: string;
  cardColors: string[];
  imgs: string[];
  entryImg: string;
}

const CATS: CategoryConfig[] = [
  {
    key: 'games',
    label: 'Games',
    Icon: Gamepad2,
    accentColor: '#ec4899',
    listName: 'My Favourite RPGs',
    entryName: 'GTA: San Andreas',
    entryMeta: 'Rockstar Games',
    listLabel: 'games',
    cardColors: ['bg-green-900/60', 'bg-purple-900/60', 'bg-blue-900/60'],
    imgs: ['/landing/GTA.jpg', '/landing/GTA_2.jpg', '/landing/GTA.jpg'],
    entryImg: '/landing/GTA.jpg',
  },
  {
    key: 'books',
    label: 'Books',
    Icon: BookOpen,
    accentColor: '#f97316',
    listName: 'My Finance Reads',
    entryName: 'Rich Dad Poor Dad',
    entryMeta: 'Robert T. Kiyosaki',
    listLabel: 'books',
    cardColors: ['bg-amber-900/60', 'bg-blue-900/60', 'bg-green-900/60'],
    imgs: ['/landing/Rich_Dad.jpg', '/landing/Rich_Dad.jpg', '/landing/Rich_Dad.jpg'],
    entryImg: '/landing/Rich_Dad.jpg',
  },
  {
    key: 'movies',
    label: 'Movies & Shows',
    Icon: Film,
    accentColor: '#3b82f6',
    listName: 'Mind-Bending Sci-Fi',
    entryName: 'Interstellar',
    entryMeta: '2014 • Sci-Fi',
    listLabel: 'movies',
    cardColors: ['bg-red-900/60', 'bg-indigo-900/60', 'bg-teal-900/60'],
    imgs: ['/landing/Interstellar.jpg', '/landing/Breaking_Bad.jpg', '/landing/Interstellar.jpg'],
    entryImg: '/landing/Interstellar.jpg',
  },
];

// Timing per sub-phase within a category (ms)
const PHASE = [1800, 500, 1800, 800, 1500, 1000, 1200, 2200, 2200];
// 0: home cards
// 1: modal opens
// 2: typing list name
// 3: submit spinner
// 4: list view + search
// 5: typing search
// 6: entry added (brief)
// 7: ★ detailed entry card
// 8: ★ manage tab — QR + shareable link

export default function RecommendationsMockup() {
  const [catIdx, setCatIdx] = useState(0);
  const [phase, setPhase] = useState(0);
  const [typedList, setTypedList] = useState('');
  const [typedSearch, setTypedSearch] = useState('');
  const [entryAdded, setEntryAdded] = useState(false);

  const cat = CATS[catIdx];

  // Phase progression
  useEffect(() => {
    const nextPhase = (phase + 1) % PHASE.length;
    const t = setTimeout(() => {
      if (nextPhase === 0) {
        // Move to next category
        setTypedList(''); setTypedSearch(''); setEntryAdded(false);
        setCatIdx(prev => (prev + 1) % CATS.length);
      }
      setPhase(nextPhase);
    }, PHASE[phase]);
    return () => clearTimeout(t);
  }, [phase, catIdx]);

  // Reset text when entering typing phases
  useEffect(() => {
    if (phase === 2) {
      setTypedList('');
      const target = cat.listName;
      let i = 0;
      const iv = setInterval(() => { i++; setTypedList(target.slice(0, i)); if (i >= target.length) clearInterval(iv); }, 65);
      return () => clearInterval(iv);
    }
  }, [phase, cat.listName]);

  useEffect(() => {
    if (phase === 5) {
      setTypedSearch('');
      const target = cat.entryName;
      let i = 0;
      const iv = setInterval(() => { i++; setTypedSearch(target.slice(0, i)); if (i >= target.length) clearInterval(iv); }, 80);
      return () => clearInterval(iv);
    }
  }, [phase, cat.entryName]);

  useEffect(() => { if (phase === 6) setEntryAdded(true); }, [phase]);

  const showModal = phase === 1 || phase === 2 || phase === 3;
  const inListView = phase >= 4;

  return (
    <div className="flex-1 flex flex-col bg-[#0F1419] h-full overflow-hidden select-none pointer-events-none">

      {/* Category tab indicator */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2 shrink-0">
        {CATS.map((c, i) => {
          const { Icon } = c;
          return (
            <motion.div
              key={c.key}
              animate={i === catIdx ? { opacity: 1, scale: 1 } : { opacity: 0.3, scale: 0.9 }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-medium text-white"
              style={{ backgroundColor: i === catIdx ? c.accentColor + '25' : 'transparent', borderColor: i === catIdx ? c.accentColor + '60' : 'transparent', border: '1px solid' }}
            >
              <Icon size={9} style={{ color: i === catIdx ? c.accentColor : 'white' }} />
              <span style={{ color: i === catIdx ? c.accentColor : 'white' }}>{c.label}</span>
            </motion.div>
          );
        })}
      </div>

      <div className="px-3 pt-3 flex-1 overflow-hidden relative">
        <motion.div
          animate={{ y: (phase >= 4 && phase <= 6) ? -120 : 0 }}
          transition={{ duration: 1.5, ease: 'easeInOut' }}
          className="flex flex-col h-full overflow-y-auto overflow-x-hidden hide-scrollbar pb-24"
        >
          <AnimatePresence mode="wait">

          {/* Home: list cards */}
          {!inListView && (
            <motion.div key={`home-${catIdx}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#1a1f2e] border rounded-xl overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <div className="flex gap-0.5 h-16">
                    {cat.imgs.map((img, i) => (
                      <div key={i} className="flex-1 overflow-hidden first:rounded-tl-xl last:rounded-tr-xl">
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                  <div className="p-2">
                    <div className="flex items-center justify-between mb-1 gap-1">
                      <h3 className="text-[9px] font-semibold text-white truncate flex-1">Top Picks</h3>
                      <span className="text-[7px] text-green-400 font-medium shrink-0">Published</span>
                    </div>
                    <div className="flex items-center justify-between text-[7px] text-gray-500">
                      <span>6 {cat.listLabel}</span>
                      <span style={{ color: '#3498DB' }} className="flex items-center gap-0.5">Open <ChevronRight size={8} /></span>
                    </div>
                  </div>
                </div>

                <div className="bg-[#1a1f2e] border rounded-xl overflow-hidden opacity-80" style={{ borderColor: 'rgba(255,255,255,0.03)' }}>
                  <div className="flex gap-0.5 h-16">
                    {cat.imgs.map((img, i) => (
                      <div key={`dup-${i}`} className="flex-1 overflow-hidden first:rounded-tl-xl last:rounded-tr-xl opacity-50">
                         <img src={img} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                  <div className="p-2">
                    <div className="flex items-center justify-between mb-1 gap-1">
                      <h3 className="text-[9px] font-semibold text-white truncate flex-1">Wishlist</h3>
                    </div>
                    <div className="flex items-center justify-between text-[7px] text-gray-500">
                      <span>12 {cat.listLabel}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#1a1f2e] border rounded-xl overflow-hidden opacity-80" style={{ borderColor: 'rgba(255,255,255,0.03)' }}>
                  <div className="flex gap-0.5 h-16 bg-white/5">
                  </div>
                  <div className="p-2">
                    <div className="flex items-center justify-between mb-1 gap-1">
                      <h3 className="text-[9px] font-semibold text-white truncate flex-1">Archived</h3>
                    </div>
                    <div className="flex items-center justify-between text-[7px] text-gray-500">
                      <span>2 {cat.listLabel}</span>
                    </div>
                  </div>
                </div>

                <div className="border-2 border-dashed border-white/10 rounded-xl p-2 flex flex-col items-center justify-center gap-1 text-gray-500 min-h-[80px]">
                  <Plus size={14} /><span className="text-[8px]">Add new list</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Inside list view */}
          {inListView && (
            <motion.div key={`list-${catIdx}`} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <cat.Icon size={12} style={{ color: cat.accentColor }} />
                <span className="text-[10px] font-semibold text-white">{cat.listName}</span>
              </div>

              <div className="bg-[#1a1f2e] border border-white/10 rounded-xl p-2.5">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Search size={9} style={{ color: cat.accentColor }} />
                  <span className="text-[8px] text-white font-medium">Add {cat.listLabel}</span>
                </div>
                <div className="w-full bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-[8px] text-white flex items-center">
                  {typedSearch || <span className="text-gray-500">Search by title…</span>}
                  {phase === 5 && <motion.span animate={{ opacity:[0,1,0] }} transition={{ repeat:Infinity, duration:0.7 }} className="inline-block w-px h-2.5 ml-0.5" style={{ backgroundColor: cat.accentColor }} />}
                </div>

                <AnimatePresence>
                  {typedSearch.length > 2 && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-1.5 space-y-1">
                      {[cat.entryName, cat.entryName + ' II'].map((name, i) => (
                        <div key={i} className={`flex items-center gap-2 p-1.5 rounded-lg ${i === 0 && phase >= 6 ? 'border' : 'bg-white/5'}`}
                          style={{ backgroundColor: i === 0 && phase >= 6 ? cat.accentColor + '15' : undefined, borderColor: i === 0 && phase >= 6 ? cat.accentColor + '40' : undefined }}>
                          <div className="w-6 h-8 rounded-sm shrink-0 overflow-hidden">
                            <img src={cat.entryImg} alt={name} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[8px] text-white font-medium truncate">{name}</p>
                            <p className="text-[7px] text-gray-500">{cat.entryMeta}</p>
                          </div>
                          <div className="text-[7px] px-1.5 py-0.5 rounded font-medium shrink-0"
                            style={{ backgroundColor: i === 0 && phase >= 6 ? 'rgba(74,222,128,0.15)' : cat.accentColor + '20', color: i === 0 && phase >= 6 ? '#4ade80' : cat.accentColor }}>
                            {i === 0 && phase >= 6 ? '✓ Added' : '+ Add'}
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <AnimatePresence>
                {entryAdded && phase <= 7 && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#1a1f2e] border border-white/10 rounded-xl p-2">
                    <p className="text-[7px] text-gray-500 mb-1">In this list</p>
                    <div className="flex gap-1.5 items-center">
                      <div className="w-7 h-9 rounded-sm shrink-0 overflow-hidden">
                        <img src={cat.entryImg} alt={cat.entryName} className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <p className="text-[8px] text-white font-medium">{cat.entryName}</p>
                        <p className="text-[7px] text-gray-500">{cat.entryMeta}</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ★ Phase 7: Detailed entry card */}
              <AnimatePresence>
                {phase === 7 && (
                  <motion.div key="detail" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="bg-[#1a1f2e] border border-white/10 rounded-2xl overflow-hidden">
                    {/* Cover with real image */}
                    <div className="h-20 relative">
                      <img src={cat.entryImg} alt={cat.entryName} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                      <div className="absolute bottom-1.5 left-2 flex gap-1">
                        <span className="text-[6px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: cat.accentColor + '30', color: cat.accentColor, border: `1px solid ${cat.accentColor}50` }}>{cat.listLabel}</span>
                        <span className="text-[6px] bg-green-500/20 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded font-medium">✓ Added</span>
                      </div>
                    </div>
                    <div className="p-2.5 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-[9px] font-bold text-white">{cat.entryName}</h4>
                          <p className="text-[7px] text-gray-500 mt-0.5">{cat.entryMeta}</p>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5">
                          <svg className="w-2 h-2 text-amber-400 fill-amber-400" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                          <span className="text-[7px] text-amber-400 font-semibold">4.9</span>
                        </div>
                      </div>
                      <p className="text-[7px] text-gray-400 leading-relaxed line-clamp-2">
                        {cat.key === 'games' ? 'A challenging open-world action RPG set in the Lands Between.' : cat.key === 'books' ? 'Epic science fiction saga exploring politics, religion and ecology.' : 'Mind-bending sci-fi odyssey exploring love, time and space.'}
                      </p>
                      <div className="flex gap-1 pt-0.5">
                        <div className="flex-1 text-center text-[7px] text-white py-1 rounded-lg font-medium" style={{ backgroundColor: cat.accentColor }}>View Details</div>
                        <div className="flex-1 bg-white/5 text-center text-[7px] text-gray-300 py-1 rounded-lg font-medium border border-white/10">Share</div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ★ Phase 8: Manage tab — QR + shareable link */}
              <AnimatePresence>
                {phase === 8 && (
                  <motion.div key="manage-qr" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex flex-col gap-2">
                    {/* Shareable link */}
                    <div className="bg-[#1a1f2e] border border-white/10 rounded-xl p-2">
                      <p className="text-[7px] text-gray-500 mb-1 uppercase tracking-wide font-semibold">Shareable Link</p>
                      <div className="flex items-center gap-1 bg-black/30 border border-white/10 rounded-lg px-1.5 py-1">
                        <span className="flex-1 text-[6.5px] text-gray-300 font-mono truncate">explorers.earth/alex/{cat.listLabel}/{cat.listName.toLowerCase().replace(/\s+/g,'-')}</span>
                        <div className="flex gap-0.5 shrink-0">
                          {['Copy','Open','Share'].map((lbl, i) => (
                            <div key={lbl} className="w-4 h-4 rounded flex items-center justify-center" style={{ backgroundColor: cat.accentColor }}>
                              {i === 0 && <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
                              {i === 1 && <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>}
                              {i === 2 && <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    {/* QR */}
                    <div className="bg-[#1a1f2e] border border-white/10 rounded-xl p-2 flex items-center gap-2.5">
                      <div className="shrink-0 w-12 h-12 bg-white rounded-lg p-1 flex items-center justify-center">
                        <div className="grid grid-cols-5 gap-px w-full h-full">
                          {Array.from({length:25}).map((_,i) => {
                            const filled = [0,1,2,3,4,5,9,10,14,15,19,20,21,22,23,24,6,12,18].includes(i);
                            return <div key={i} className={`rounded-[1px] ${filled ? 'bg-black' : 'bg-transparent'}`} />;
                          })}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[8px] text-white font-semibold">QR Code</p>
                        <p className="text-[6.5px] text-gray-500 mt-0.5 leading-relaxed">Scan to open {cat.listName}</p>
                        <div className="mt-1 text-[6.5px] px-1.5 py-0.5 rounded font-medium inline-block" style={{ backgroundColor: cat.accentColor + '20', color: cat.accentColor, border: `1px solid ${cat.accentColor}40` }}>Download</div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Create list modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-20 flex items-center justify-center p-3"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-[#1a1f2e] rounded-xl border border-white/10 p-4 w-full shadow-2xl"
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[11px] font-bold text-white">Create New List</h2>
                <X size={11} className="text-gray-400" />
              </div>
              <div className="space-y-2">
                <div>
                  <label className="text-[8px] font-semibold text-white mb-1 block">List Name</label>
                  <div className="bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-[8px] text-white min-h-[24px]">
                    {typedList || <span className="text-gray-500">e.g. {cat.listName}</span>}
                    {phase === 2 && <motion.span animate={{ opacity:[0,1,0] }} transition={{ repeat:Infinity, duration:0.7 }} className="inline-block w-px h-2.5 ml-0.5 align-middle" style={{ backgroundColor: '#3498DB' }} />}
                  </div>
                </div>
                <div>
                  <label className="text-[8px] font-semibold text-white mb-1 block">Description</label>
                  <div className="bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-[8px] text-gray-500 h-10">Optional…</div>
                </div>
              </div>
              <div className="flex justify-end gap-1.5 pt-2 mt-2 border-t border-white/10">
                <button className="px-2.5 py-1 rounded-lg bg-red-500 text-[8px] text-white">Cancel</button>
                <button className="px-2.5 py-1 rounded-lg bg-blue-500 text-[8px] text-white flex items-center gap-1">
                  {phase === 3 && <Loader2 size={8} className="animate-spin" />}Create List
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
