import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Film, Plus, Star, ChevronRight, X, Loader2, Search } from 'lucide-react';
import { AddIcon } from '../../../../../assets/icons/AddIcon';

// Stages:
// 0: view home list cards (2s)
// 1: hover card (1.2s)
// 2: click New List (0.5s)
// 3: modal typing (2s)
// 4: loading (0.8s)
// 5: transition into list view (0.5s)
// 6: search for movie (2.5s)
// 7: click add (1s)
// 8: movie added (2s) → loop

const STAGES = [2000, 1200, 500, 2000, 800, 500, 2500, 1000, 2000];

export default function MoviesMockup() {
  const [stage, setStage] = useState(0);
  const [typedListName, setTypedListName] = useState('');
  const [typedSearch, setTypedSearch] = useState('');
  const [movieAdded, setMovieAdded] = useState(false);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const next = (stage + 1) % STAGES.length;
    t = setTimeout(() => {
      if (next === 0) { setTypedListName(''); setTypedSearch(''); setMovieAdded(false); }
      setStage(next);
    }, STAGES[stage]);
    return () => clearTimeout(t);
  }, [stage]);

  useEffect(() => {
    if (stage !== 3) return;
    const target = 'Mind-Bending Sci-Fi';
    let i = typedListName.length;
    const iv = setInterval(() => { i++; setTypedListName(target.slice(0, i)); if (i >= target.length) clearInterval(iv); }, 70);
    return () => clearInterval(iv);
  }, [stage]);

  useEffect(() => {
    if (stage !== 6) return;
    const target = 'Interstellar';
    let i = 0;
    const iv = setInterval(() => { i++; setTypedSearch(target.slice(0, i)); if (i >= target.length) clearInterval(iv); }, 80);
    return () => clearInterval(iv);
  }, [stage]);

  useEffect(() => { if (stage === 7) setMovieAdded(true); }, [stage]);

  const showModal = stage >= 2 && stage <= 4;
  const showListView = stage >= 5;

  return (
    <div className="flex-1 flex flex-col bg-[#0F1419] h-full overflow-hidden select-none pointer-events-none">
      {/* Header */}
      <div className="flex items-center justify-between bg-[#1a1f2e]/60 px-3 py-2.5 rounded-2xl mb-3 mx-3 mt-3">
        <div className="flex flex-col items-start gap-1 bg-white/5 px-2.5 py-1.5 rounded-xl">
          <div className="w-8 h-4 bg-[#3498DB] rounded-full flex items-center px-0.5">
            <div className="w-3 h-3 rounded-full bg-white ml-auto shadow" />
          </div>
          <span className="text-[8px] text-white/60 leading-tight">Public Visibility</span>
        </div>
        <motion.div
          animate={showModal ? { scale: 0.94, opacity: 0.7 } : { scale: 1, opacity: 1 }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#3498DB] text-[10px] text-white font-medium shadow-lg"
        >
          <AddIcon size="3.5" /><span>New List</span>
        </motion.div>
      </div>

      <div className="px-3 flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {!showListView && (
            <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-2 gap-2.5">
              <motion.div
                animate={stage === 1 ? { y: -3, borderColor: 'rgba(255,255,255,0.2)' } : { y: 0, borderColor: 'rgba(255,255,255,0.05)' }}
                className="bg-[#1a1f2e] border rounded-xl p-2.5 cursor-pointer"
                style={{ borderColor: 'rgba(255,255,255,0.05)' }}
              >
                <div className="flex items-center justify-between mb-2 gap-1">
                  <h3 className="text-[10px] font-semibold text-white truncate flex-1">Top Picks</h3>
                  <span className="text-[7px] text-green-400 font-medium shrink-0">Published</span>
                </div>
                <div className="flex gap-1 mb-2">
                  {['bg-red-900/60','bg-blue-900/60','bg-purple-900/60'].map((c,i) => (
                    <div key={i} className={`w-8 ${c} rounded-sm overflow-hidden`}><div className="aspect-[2/3]" /></div>
                  ))}
                  <div className="w-8 bg-white/5 rounded-sm flex items-center justify-center aspect-[2/3]">
                    <span className="text-[7px] text-gray-500">+3</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[8px] text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <span>8 movies</span>
                    <span className="flex items-center gap-0.5 text-yellow-500/60"><Star size={7} fill="currentColor" /> 2</span>
                  </div>
                  <span className="text-[#3498DB] flex items-center gap-0.5">Open <ChevronRight size={9} /></span>
                </div>
              </motion.div>

              <div className="bg-[#1a1f2e] border rounded-xl p-2.5" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <div className="flex items-center justify-between mb-2 gap-1">
                  <h3 className="text-[10px] font-semibold text-white truncate flex-1">Classics</h3>
                  <span className="text-[7px] text-gray-500 shrink-0">Draft</span>
                </div>
                <div className="flex gap-1 mb-2">
                  {['bg-amber-900/60','bg-teal-900/60'].map((c,i) => (
                    <div key={i} className={`w-8 ${c} rounded-sm overflow-hidden`}><div className="aspect-[2/3]" /></div>
                  ))}
                </div>
                <div className="flex items-center justify-between text-[8px] text-gray-500">
                  <span>5 movies</span>
                  <span className="text-[#3498DB] flex items-center gap-0.5">Open <ChevronRight size={9} /></span>
                </div>
              </div>

              <div className="border-2 border-dashed border-white/10 rounded-xl p-2.5 flex flex-col items-center justify-center gap-1 text-gray-500 min-h-[80px]">
                <Plus size={16} /><span className="text-[9px]">Add new list</span>
              </div>
            </motion.div>
          )}

          {showListView && (
            <motion.div key="listview" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <Film size={14} className="text-[#3498DB]" />
                <span className="text-xs font-semibold text-white">Mind-Bending Sci-Fi</span>
                <span className="text-[8px] text-gray-500 ml-auto">0 movies</span>
              </div>

              <div className="bg-[#1a1f2e] border border-white/10 rounded-xl p-2.5">
                <div className="flex items-center gap-1.5 mb-2">
                  <Search size={10} className="text-[#3498DB]" />
                  <span className="text-[9px] text-white font-medium">Add Movies</span>
                </div>
                <div className="w-full bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-[9px] text-white flex items-center">
                  {typedSearch || <span className="text-gray-500">Search by movie title…</span>}
                  {stage === 6 && <motion.span animate={{ opacity:[0,1,0] }} transition={{ repeat:Infinity, duration:0.7 }} className="inline-block w-px h-2.5 bg-[#3498DB] ml-0.5" />}
                </div>
                <AnimatePresence>
                  {typedSearch.length > 3 && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-2 space-y-1.5">
                      {['Interstellar', 'Inception'].map((name, i) => (
                        <div key={i} className={`flex items-center gap-2 p-1.5 rounded-lg ${i === 0 && stage >= 7 ? 'bg-[#3498DB]/20 border border-[#3498DB]/30' : 'bg-white/5'}`}>
                          <div className={`w-6 ${i === 0 ? 'bg-indigo-900/60' : 'bg-gray-900/60'} rounded-sm shrink-0`}><div className="aspect-[2/3]" /></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[9px] text-white font-medium truncate">{name}</p>
                            <p className="text-[7px] text-gray-500">{i === 0 ? '2014 • Sci-Fi' : '2010 • Thriller'}</p>
                          </div>
                          <div className={`shrink-0 text-[7px] px-1.5 py-0.5 rounded font-medium ${i === 0 && stage >= 7 ? 'bg-green-500/20 text-green-400' : 'bg-[#3498DB]/20 text-[#3498DB]'}`}>
                            {i === 0 && stage >= 7 ? '✓ Added' : '+ Add'}
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <AnimatePresence>
                {movieAdded && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#1a1f2e] border border-white/10 rounded-xl p-2.5">
                    <p className="text-[8px] text-gray-500 mb-1.5">In this list</p>
                    <div className="flex gap-1.5 items-center">
                      <div className="w-8 bg-indigo-900/60 rounded-sm"><div className="aspect-[2/3]" /></div>
                      <div>
                        <p className="text-[9px] text-white font-medium">Interstellar</p>
                        <p className="text-[7px] text-gray-500">2014 • Sci-Fi</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-20 flex items-center justify-center p-3"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-[#1a1f2e] rounded-xl border border-white/10 p-4 w-full shadow-2xl"
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold text-white">Create New List</h2>
                <X size={12} className="text-gray-400" />
              </div>
              <div className="space-y-2">
                <div>
                  <label className="text-[9px] font-semibold text-white mb-1 block">List Name</label>
                  <div className="bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-[9px] text-white min-h-[26px]">
                    {typedListName || <span className="text-gray-500">e.g. Mind-Bending Sci-Fi</span>}
                    {stage === 3 && <motion.span animate={{ opacity:[0,1,0] }} transition={{ repeat:Infinity, duration:0.7 }} className="inline-block w-px h-2.5 bg-[#3498DB] ml-0.5 align-middle" />}
                  </div>
                </div>
                <div>
                  <label className="text-[9px] font-semibold text-white mb-1 block">Description</label>
                  <div className="bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-[9px] text-gray-500 h-12">Optional…</div>
                </div>
              </div>
              <div className="flex justify-end gap-1.5 pt-2.5 mt-2.5 border-t border-white/10">
                <button className="px-3 py-1 rounded-lg bg-red-500 text-[9px] text-white">Cancel</button>
                <button className="px-3 py-1 rounded-lg bg-blue-500 text-[9px] text-white flex items-center gap-1">
                  {stage === 4 && <Loader2 size={9} className="animate-spin" />}Create List
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
