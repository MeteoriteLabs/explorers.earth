import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Plus, ChevronRight, X, Loader2, Search, Navigation } from 'lucide-react';
import { AddIcon } from '../../../../../assets/icons/AddIcon';

// ── Exact walkthrough of the Places/Recommendations dashboard ──
// Stage 0: Home — public visibility toggle + "Add Location" + city circles  (2.5s)
// Stage 1: Hover on Lucknow city circle (1s)
// Stage 2: Click "Add Location" → modal opens (0.5s)
// Stage 3: Type city name into modal search field (2s)
// Stage 4: "Selected: Paris" appears → submit loading (0.8s)
// Stage 5: New city circle "Paris" appears on home screen (1.5s)
// Stage 6: Click on "Lucknow" → transitions into location detail view (0.5s)
// Stage 7: Location detail — Recommendations tab — place card grid with category filters (2.5s)
// Stage 8: Switch to "Manage" tab + click "Add Place" button (0.8s)
// Stage 9: Add Place modal — type place name (2s)
// Stage 10: Place added → shown in grid (2s) → loop

const STAGES = [2500, 1000, 500, 2000, 800, 1500, 500, 2500, 800, 2000, 2000];

const cities = [
  { name: 'Lucknow', color: 'border-green-400', thumb: 'bg-gradient-to-br from-amber-800 to-amber-600', published: true },
  { name: 'Delhi', color: 'border-gray-500', thumb: 'bg-gradient-to-br from-orange-800 to-orange-600', published: false },
];

const placeCategories = ['View all', 'Food & Drinks', 'Cafes', 'Markets'];

const existingPlaces = [
  { name: 'Tunday Kababi', category: 'Food & Drinks', color: 'from-red-900 to-red-700' },
  { name: 'Hazratganj Market', category: 'Markets', color: 'from-amber-900 to-amber-700' },
];

export default function PlacesMockup() {
  const [stage, setStage] = useState(0);
  const [typedCity, setTypedCity] = useState('');
  const [typedPlace, setTypedPlace] = useState('');
  const [cityAdded, setCityAdded] = useState(false);
  const [placeAdded, setPlaceAdded] = useState(false);
  const [activeLocTab, setActiveLocTab] = useState<'recommendations' | 'manage'>('recommendations');
  const [activeCat, setActiveCat] = useState('View all');

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const next = (stage + 1) % STAGES.length;
    t = setTimeout(() => {
      if (next === 0) {
        setTypedCity(''); setTypedPlace('');
        setCityAdded(false); setPlaceAdded(false);
        setActiveLocTab('recommendations'); setActiveCat('View all');
      }
      if (next === 7) setActiveLocTab('recommendations');
      if (next === 8) setActiveLocTab('manage');
      setStage(next);
    }, STAGES[stage]);
    return () => clearTimeout(t);
  }, [stage]);

  // Typing city name in stage 3
  useEffect(() => {
    if (stage !== 3) return;
    const target = 'Paris, France';
    let i = 0;
    const iv = setInterval(() => { i++; setTypedCity(target.slice(0, i)); if (i >= target.length) clearInterval(iv); }, 80);
    return () => clearInterval(iv);
  }, [stage]);

  // Typing place name in stage 9
  useEffect(() => {
    if (stage !== 9) return;
    const target = 'Royal Cafe Lucknow';
    let i = 0;
    const iv = setInterval(() => { i++; setTypedPlace(target.slice(0, i)); if (i >= target.length) clearInterval(iv); }, 70);
    return () => clearInterval(iv);
  }, [stage]);

  useEffect(() => { if (stage === 5) setCityAdded(true); }, [stage]);
  useEffect(() => { if (stage === 10) setPlaceAdded(true); }, [stage]);

  // Animate category filter change
  useEffect(() => {
    if (stage !== 7) return;
    const t = setTimeout(() => setActiveCat('Food & Drinks'), 1400);
    return () => clearTimeout(t);
  }, [stage]);

  const showAddLocationModal = stage >= 2 && stage <= 4;
  const showAddPlaceModal = stage === 9;
  const inLocationView = stage >= 6;

  return (
    <div className="flex-1 flex flex-col bg-[#0F1419] h-full overflow-hidden select-none pointer-events-none">
      {/* ── Header Row — always shown ── */}
      <div className="flex items-center justify-between bg-[#1a1f2e]/60 px-3 py-2.5 rounded-2xl mb-4 mx-3 mt-3 shrink-0">
        <div className="flex flex-col items-start gap-1 bg-white/5 px-2.5 py-1.5 rounded-xl">
          <div className="w-8 h-4 bg-[#3498DB] rounded-full flex items-center px-0.5">
            <div className="w-3 h-3 rounded-full bg-white ml-auto shadow" />
          </div>
          <span className="text-[8px] text-white/60 leading-tight">Public Visibility</span>
        </div>

        <AnimatePresence mode="wait">
          {!inLocationView ? (
            <motion.div
              key="add-location"
              animate={showAddLocationModal ? { scale: 0.94, opacity: 0.7 } : { scale: 1, opacity: 1 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#3498DB] text-[10px] text-white font-medium shadow-lg"
            >
              <AddIcon size="3.5" /><span>Add Location</span>
            </motion.div>
          ) : (
            <motion.div
              key="add-place"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={showAddPlaceModal ? { opacity: 0.7, scale: 0.94 } : { opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#3498DB] text-[10px] text-white font-medium shadow-lg"
            >
              <AddIcon size="3.5" /><span>Add Place</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="px-3 flex-1 overflow-hidden">
        <AnimatePresence mode="wait">

          {/* ══ HOME VIEW ══ */}
          {!inLocationView && (
            <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-4">

              {/* City circles row */}
              <div className="flex items-center gap-4">
                {cities.map((city, i) => (
                  <motion.div
                    key={city.name}
                    animate={stage === 1 && i === 0 ? { scale: 1.08 } : { scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <div className={`w-14 h-14 rounded-full border-[3px] overflow-hidden ${city.color} ${city.published ? 'shadow-[0_0_10px_rgba(74,222,128,0.3)]' : ''}`}>
                      <div className={`w-full h-full ${city.thumb}`} />
                    </div>
                    <span className="text-[9px] text-white font-medium">{city.name}</span>
                  </motion.div>
                ))}

                {/* New Paris circle on stage 5+ */}
                <AnimatePresence>
                  {cityAdded && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex flex-col items-center gap-1.5"
                    >
                      <div className="w-14 h-14 rounded-full border-[3px] border-gray-500 overflow-hidden">
                        <div className="w-full h-full bg-gradient-to-br from-blue-900 to-blue-700" />
                      </div>
                      <span className="text-[9px] text-white font-medium">Paris</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="text-[8px] text-gray-500 text-right">View all</div>
            </motion.div>
          )}

          {/* ══ LOCATION DETAIL VIEW (inside Lucknow) ══ */}
          {inLocationView && (
            <motion.div key="location-detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-3 h-full">

              {/* Published toggle row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-4 bg-[#3498DB] rounded-full flex items-center px-0.5">
                    <div className="w-3 h-3 rounded-full bg-white ml-auto shadow" />
                  </div>
                  <span className="text-[9px] text-white font-medium">Published</span>
                </div>
              </div>

              {/* Recommendations / Manage tab switcher — matches Home.tsx exactly */}
              <div className="flex items-center justify-center">
                <div className="flex items-center bg-white rounded-3xl shadow-sm">
                  {(['recommendations', 'manage'] as const).map((tab) => (
                    <motion.div
                      key={tab}
                      animate={activeLocTab === tab
                        ? { backgroundColor: '#3498DB', color: '#fff' }
                        : { backgroundColor: '#fff', color: '#000' }
                      }
                      transition={{ duration: 0.25 }}
                      className="px-3 py-1.5 text-[9px] font-medium rounded-2xl capitalize"
                    >
                      {tab === 'recommendations' ? 'Recommendations' : 'Manage'}
                    </motion.div>
                  ))}
                </div>
              </div>

              <AnimatePresence mode="wait">
                {/* Recommendations tab */}
                {activeLocTab === 'recommendations' && (
                  <motion.div key="recs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <h3 className="text-xs font-bold text-white">My Recommendations</h3>
                    <p className="text-[8px] text-gray-500 mb-2">Lucknow</p>

                    {/* Category filter pills */}
                    <div className="flex gap-1.5 mb-3 flex-wrap">
                      {placeCategories.map(cat => (
                        <motion.div
                          key={cat}
                          animate={activeCat === cat
                            ? { backgroundColor: '#3498DB', color: '#fff' }
                            : { backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)' }
                          }
                          className="px-2 py-1 rounded-lg text-[8px] font-medium"
                        >
                          {cat}
                        </motion.div>
                      ))}
                    </div>

                    {/* Place cards grid */}
                    <div className="grid grid-cols-2 gap-2">
                      {existingPlaces.map((place, i) => (
                        <div key={i} className="bg-[#1a1f2e] rounded-xl overflow-hidden border border-white/5">
                          <div className={`h-20 bg-gradient-to-b ${place.color} relative`}>
                            {/* Place photo mockup */}
                            <div className="absolute top-2 left-2 w-5 h-5 bg-white/10 rounded-full flex items-center justify-center">
                              <Navigation size={9} className="text-white" />
                            </div>
                          </div>
                          <div className="p-1.5">
                            <p className="text-[9px] text-white font-medium truncate">{place.name}</p>
                            <p className="text-[7px] text-gray-500">{place.category}</p>
                          </div>
                        </div>
                      ))}

                      <AnimatePresence>
                        {placeAdded && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-[#1a1f2e] rounded-xl overflow-hidden border border-[#3498DB]/40"
                          >
                            <div className="h-20 bg-gradient-to-b from-teal-900 to-teal-700 relative">
                              <div className="absolute top-2 left-2 w-5 h-5 bg-white/10 rounded-full flex items-center justify-center">
                                <Navigation size={9} className="text-white" />
                              </div>
                            </div>
                            <div className="p-1.5">
                              <p className="text-[9px] text-white font-medium truncate">Royal Cafe</p>
                              <p className="text-[7px] text-gray-500">Cafes</p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}

                {/* Manage tab */}
                {activeLocTab === 'manage' && (
                  <motion.div key="manage" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <p className="text-[8px] text-gray-500 mb-3">Manage places in Lucknow</p>
                    <div className="space-y-1.5">
                      {existingPlaces.map((place, i) => (
                        <div key={i} className="flex items-center gap-2 bg-[#1a1f2e] rounded-xl p-2 border border-white/5">
                          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${place.color} shrink-0`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[9px] text-white font-medium truncate">{place.name}</p>
                            <p className="text-[7px] text-gray-500">{place.category}</p>
                          </div>
                          <ChevronRight size={10} className="text-gray-500 shrink-0" />
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ══ Add Location Modal (stages 2-4) ══ */}
      <AnimatePresence>
        {showAddLocationModal && (
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm z-20 flex items-center justify-center p-3"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-[#1a1f2e] rounded-xl border border-white/10 p-4 w-full shadow-2xl"
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold text-white">Add Location</h2>
                <X size={12} className="text-gray-400" />
              </div>
              <div className="space-y-2.5">
                <div>
                  <label className="text-[9px] font-semibold text-white mb-1 block">Search Location</label>
                  <div className="w-full bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-[9px] text-white flex items-center gap-1.5 min-h-[28px]">
                    <Search size={9} className="text-gray-500 shrink-0" />
                    {typedCity || <span className="text-gray-500">Enter city, state or country (e.g. Paris)</span>}
                    {stage === 3 && <motion.span animate={{ opacity:[0,1,0] }} transition={{ repeat:Infinity, duration:0.7 }} className="inline-block w-px h-2.5 bg-[#3498DB] ml-0.5" />}
                  </div>
                  {typedCity.length > 5 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[8px] text-[#3498DB] bg-[#3498DB]/10 px-2 py-1 rounded mt-1">
                      Selected: Paris
                    </motion.div>
                  )}
                </div>
                <div>
                  <label className="text-[9px] font-semibold text-white mb-1 block">Note</label>
                  <div className="bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-[9px] text-gray-500 h-10">Optional…</div>
                </div>
                <div>
                  <label className="text-[9px] font-semibold text-white mb-1 block">Place URL</label>
                  <div className="bg-black/30 border border-white/10 rounded-lg px-2.5 py-1 text-[8px] text-gray-500 flex items-center gap-1">
                    <span className="text-gray-600">explorers.earth/username/</span>
                    <span className="text-white">{typedCity ? 'paris' : ''}</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-1.5 pt-2.5 mt-2.5 border-t border-white/10">
                <button className="px-3 py-1 rounded-lg bg-red-500 text-[9px] text-white">Cancel</button>
                <button className="px-3 py-1 rounded-lg bg-blue-500 text-[9px] text-white flex items-center gap-1">
                  {stage === 4 && <Loader2 size={9} className="animate-spin" />}Add Location
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ Add Place Modal (stage 9) ══ */}
      <AnimatePresence>
        {showAddPlaceModal && (
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm z-20 flex items-center justify-center p-3"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-[#1a1f2e] rounded-xl border border-white/10 p-4 w-full shadow-2xl"
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold text-white">Add Place</h2>
                <X size={12} className="text-gray-400" />
              </div>
              <div className="space-y-2.5">
                <div>
                  <label className="text-[9px] font-semibold text-white mb-1 block">Search Place</label>
                  <div className="w-full bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-[9px] text-white flex items-center gap-1.5 min-h-[28px]">
                    <MapPin size={9} className="text-[#3498DB] shrink-0" />
                    {typedPlace || <span className="text-gray-500">Search Google Places…</span>}
                    <motion.span animate={{ opacity:[0,1,0] }} transition={{ repeat:Infinity, duration:0.7 }} className="inline-block w-px h-2.5 bg-[#3498DB] ml-0.5" />
                  </div>
                  <AnimatePresence>
                    {typedPlace.length > 5 && (
                      <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-1.5 space-y-1">
                        {['Royal Cafe, Lucknow', 'Royal Restaurant, Lucknow'].map((name, i) => (
                          <div key={i} className={`flex items-center gap-2 p-1.5 rounded-lg ${i === 0 ? 'bg-[#3498DB]/20 border border-[#3498DB]/30' : 'bg-white/5'}`}>
                            <MapPin size={8} className="text-[#3498DB] shrink-0" />
                            <p className="text-[8px] text-white truncate">{name}</p>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div>
                  <label className="text-[9px] font-semibold text-white mb-1 block">Category</label>
                  <div className="bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-[9px] text-white">Cafes</div>
                </div>
              </div>
              <div className="flex justify-end gap-1.5 pt-2.5 mt-2.5 border-t border-white/10">
                <button className="px-3 py-1 rounded-lg bg-red-500 text-[9px] text-white">Cancel</button>
                <button className="px-3 py-1 rounded-lg bg-blue-500 text-[9px] text-white flex items-center gap-1">
                  Add Place
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
