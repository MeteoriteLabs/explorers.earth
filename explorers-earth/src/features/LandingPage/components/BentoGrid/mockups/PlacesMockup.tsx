import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Plus, ChevronRight, X, Loader2, Search, Navigation } from 'lucide-react';
import { AddIcon } from '../../../../../assets/icons/AddIcon';

// Stage 0:  Home — city circles + visibility toggle            (2500ms)
// Stage 1:  Hover Paris circle                                 (1000ms)
// Stage 2:  Click "Add Location" → modal opens                 (500ms)
// Stage 3:  Type city name (Kyoto, Japan)                      (2000ms)
// Stage 4:  Submit loading → Kyoto added                       (800ms)
// Stage 5:  Kyoto circle appears                               (1500ms)
// Stage 6:  Click Paris → location detail view                (500ms)
// Stage 7:  Recommendations tab — filter + place cards grid    (2500ms)
// Stage 8:  ★ Open Eiffel Tower detail card from grid          (2500ms)
// Stage 9:  Switch Manage tab → click Add Place                (800ms)
// Stage 10: Add Place modal — type & select Google result      (2000ms)
// Stage 11: Musée d'Orsay appears in grid                     (2000ms)
// Stage 12: ★ Detailed place card (expanded view)              (2500ms)
// Stage 13: ★ Manage tab: QR code + shareable link             (2500ms)
// → loop

const STAGES = [2500, 1000, 500, 2000, 800, 1500, 500, 2500, 2500, 800, 2000, 2000, 2500, 2500];

const cities = [
  { name: 'Paris', img: '/landing/Paris.jpg', color: 'border-green-400', published: true },
  { name: 'Bali', img: '/landing/Bali.jpg', color: 'border-gray-500', published: false },
];

const placeCategories = ['View all', 'Landmarks', 'Culture', 'Food'];

const existingPlaces = [
  { name: 'Eiffel Tower', category: 'Landmarks', img: '/landing/Eiffel_Tower.jpg' },
  { name: 'Louvre Museum', category: 'Culture', img: '/landing/Louvre_Museum.jpg' },
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
      if (next === 9) setActiveLocTab('manage');
      if (next === 13) setActiveLocTab('manage');
      setStage(next);
    }, STAGES[stage]);
    return () => clearTimeout(t);
  }, [stage]);

  // Typing city name in stage 3
  useEffect(() => {
    if (stage !== 3) return;
    const target = 'Kyoto, Japan';
    let i = 0;
    const iv = setInterval(() => { i++; setTypedCity(target.slice(0, i)); if (i >= target.length) clearInterval(iv); }, 80);
    return () => clearInterval(iv);
  }, [stage]);

  // Typing place name in stage 10
  useEffect(() => {
    if (stage !== 10) return;
    const target = 'Musée d\'Orsay, Paris';
    let i = 0;
    const iv = setInterval(() => { i++; setTypedPlace(target.slice(0, i)); if (i >= target.length) clearInterval(iv); }, 70);
    return () => clearInterval(iv);
  }, [stage]);

  useEffect(() => { if (stage === 5) setCityAdded(true); }, [stage]);
  useEffect(() => { if (stage === 11) setPlaceAdded(true); }, [stage]);

  // Animate category filter change
  useEffect(() => {
    if (stage !== 7) return;
    const t = setTimeout(() => setActiveCat('Landmarks'), 1400);
    return () => clearTimeout(t);
  }, [stage]);

  const showAddLocationModal = stage >= 2 && stage <= 4;
  const showAddPlaceModal = stage === 10;
  const inLocationView = stage >= 6;
  const showOpenedCard = stage === 8;   // ★ Eiffel Tower detail open from grid
  const showDetailCard = stage === 12;  // Musée d'Orsay detail after adding
  const showManageQR = stage === 13;

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

              {/* City circles row — home view */}
              <div className="flex items-center gap-4">
                {cities.map((city, i) => (
                  <motion.div
                    key={city.name}
                    animate={stage === 1 && i === 0 ? { scale: 1.08 } : { scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <div className={`w-14 h-14 rounded-full border-[3px] overflow-hidden ${city.color} ${city.published ? 'shadow-[0_0_10px_rgba(74,222,128,0.3)]' : ''}`}>
                      <img src={city.img} alt={city.name} className="w-full h-full object-cover" />
                    </div>
                    <span className="text-[9px] text-white font-medium">{city.name}</span>
                  </motion.div>
                ))}

                {/* Kyoto circle appears after adding */}
                <AnimatePresence>
                  {cityAdded && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex flex-col items-center gap-1.5"
                    >
                      <div className="w-14 h-14 rounded-full border-[3px] border-gray-500 overflow-hidden">
                        <img src="/landing/Kyoto.jpg" alt="Kyoto" className="w-full h-full object-cover" />
                      </div>
                      <span className="text-[9px] text-white font-medium">Kyoto</span>
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

              {/* ── City circles row inside location detail ── */}
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 overflow-x-auto">
                  {/* Paris — active/selected */}
                  <motion.div
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="flex flex-col items-center gap-1 shrink-0"
                  >
                    <div className="w-11 h-11 rounded-full border-[2.5px] border-green-400 overflow-hidden shadow-[0_0_8px_rgba(74,222,128,0.35)]">
                      <img src="/landing/Paris.jpg" alt="Paris" className="w-full h-full object-cover" />
                    </div>
                    <span className="text-[7px] text-white font-medium">Paris</span>
                  </motion.div>

                  {/* Bali */}
                  <div className="flex flex-col items-center gap-1 shrink-0 opacity-60">
                    <div className="w-11 h-11 rounded-full border-[2.5px] border-gray-600 overflow-hidden">
                      <img src="/landing/Bali.jpg" alt="Bali" className="w-full h-full object-cover" />
                    </div>
                    <span className="text-[7px] text-white/70">Bali</span>
                  </div>

                  {/* Kyoto — if added */}
                  {cityAdded && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex flex-col items-center gap-1 shrink-0 opacity-60"
                    >
                      <div className="w-11 h-11 rounded-full border-[2.5px] border-gray-600 overflow-hidden">
                        <img src="/landing/Kyoto.jpg" alt="Kyoto" className="w-full h-full object-cover" />
                      </div>
                      <span className="text-[7px] text-white/70">Kyoto</span>
                    </motion.div>
                  )}
                </div>
                <span className="text-[8px] text-gray-500 shrink-0">View all</span>
              </div>

              {/* Recommendations / Manage tab switcher — matches Home.tsx exactly */}
              <div className="flex items-center justify-center shrink-0">
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
                  <motion.div key="recs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative">
                    <h3 className="text-xs font-bold text-white">My Recommendations</h3>
                    <p className="text-[8px] text-gray-500 mb-2">Paris</p>

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

                    {/* Place cards grid — real photos */}
                    <div className="grid grid-cols-2 gap-2">
                      {existingPlaces.map((place, i) => (
                        <motion.div
                          key={i}
                          animate={showOpenedCard && i === 0
                            ? { scale: 1.04, borderColor: 'rgba(52,152,219,0.7)' }
                            : { scale: 1, borderColor: 'rgba(255,255,255,0.05)' }
                          }
                          transition={{ type: 'spring', stiffness: 300 }}
                          className="bg-[#1a1f2e] rounded-xl overflow-hidden border"
                        >
                          <div className="h-20 relative">
                            <img src={place.img} alt={place.name} className="w-full h-full object-cover" />
                            <div className="absolute top-1.5 left-1.5 w-4 h-4 bg-black/40 rounded-full flex items-center justify-center">
                              <Navigation size={8} className="text-white" />
                            </div>
                          </div>
                          <div className="p-1.5">
                            <p className="text-[9px] text-white font-medium truncate">{place.name}</p>
                            <p className="text-[7px] text-gray-500">{place.category}</p>
                          </div>
                        </motion.div>
                      ))}

                      <AnimatePresence>
                        {placeAdded && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-[#1a1f2e] rounded-xl overflow-hidden border border-[#3498DB]/40"
                          >
                            <div className="h-20 relative">
                              <img src="/landing/Louvre_Museum.jpg" alt="Musée d'Orsay" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                              <div className="absolute top-1.5 left-1.5 w-4 h-4 bg-black/40 rounded-full flex items-center justify-center">
                                <Navigation size={8} className="text-white" />
                              </div>
                              <span className="absolute bottom-1.5 left-1.5 text-[6px] bg-[#3498DB] text-white px-1 py-0.5 rounded font-medium">New</span>
                            </div>
                            <div className="p-1.5">
                              <p className="text-[9px] text-white font-medium truncate">Musée d'Orsay</p>
                              <p className="text-[7px] text-gray-500">Culture</p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* ★ Stage 8: Eiffel Tower detail card slides up over the grid */}
                    <AnimatePresence>
                      {showOpenedCard && (
                        <motion.div
                          key="opened-card"
                          initial={{ opacity: 0, y: 40 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 40 }}
                          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                          className="absolute inset-0 bg-[#0F1419] rounded-2xl overflow-hidden border border-white/10 z-10"
                        >
                          {/* Hero */}
                          <div className="h-28 relative">
                            <img src="/landing/Eiffel_Tower.jpg" alt="Eiffel Tower" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                            <div className="absolute bottom-2 left-2 flex gap-1">
                              <span className="text-[7px] bg-[#3498DB] text-white px-1.5 py-0.5 rounded font-medium">Landmarks</span>
                              <span className="text-[7px] bg-green-500/20 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded font-medium">✓ Visited</span>
                            </div>
                          </div>
                          <div className="p-3 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="text-[10px] font-bold text-white">Eiffel Tower</h4>
                                <p className="text-[7px] text-gray-500 mt-0.5 flex items-center gap-1">
                                  <MapPin size={7} />Champ de Mars, Paris, France
                                </p>
                              </div>
                              <div className="flex items-center gap-0.5 shrink-0 bg-amber-500/10 border border-amber-500/20 rounded-lg px-1.5 py-1">
                                <svg className="w-2.5 h-2.5 text-amber-400 fill-amber-400" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                                <span className="text-[8px] text-amber-400 font-semibold">4.9</span>
                              </div>
                            </div>
                            <p className="text-[7px] text-gray-400 leading-relaxed line-clamp-2">
                              Iron lattice tower on the Champ de Mars — the most visited monument in the world and symbol of Paris.
                            </p>
                            <div className="flex gap-1.5 pt-1">
                              <div className="flex-1 bg-[#3498DB] text-center text-[7px] text-white py-1 rounded-lg font-medium">View Details</div>
                              <div className="flex-1 bg-white/5 text-center text-[7px] text-gray-300 py-1 rounded-lg font-medium border border-white/10">Share</div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                {/* Manage tab — stage 8: place list */}
                {activeLocTab === 'manage' && !showManageQR && (
                  <motion.div key="manage" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <p className="text-[8px] text-gray-500 mb-3">Manage places in Paris</p>
                    <div className="space-y-1.5">
                      {existingPlaces.map((place, i) => (
                        <div key={i} className="flex items-center gap-2 bg-[#1a1f2e] rounded-xl p-2 border border-white/5">
                          <img src={place.img} alt={place.name} className="w-8 h-8 rounded-lg object-cover shrink-0" />
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

                {/* ★ Stage 11: Detailed place card */}
                {activeLocTab === 'recommendations' && showDetailCard && (
                  <motion.div key="detail" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="bg-[#1a1f2e] border border-white/10 rounded-2xl overflow-hidden">
                    {/* Hero image */}
                    <div className="h-28 relative">
                      <img src="/landing/Eiffel_Tower.jpg" alt="Eiffel Tower" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-2 left-2 flex gap-1">
                        <span className="text-[7px] bg-[#3498DB] text-white px-1.5 py-0.5 rounded font-medium">Landmarks</span>
                        <span className="text-[7px] bg-green-500/20 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded font-medium">✓ Visited</span>
                      </div>
                    </div>
                    <div className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-[10px] font-bold text-white">Eiffel Tower</h4>
                          <p className="text-[7px] text-gray-500 mt-0.5 flex items-center gap-1">
                            <MapPin size={7} />Champ de Mars, Paris, France
                          </p>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0 bg-amber-500/10 border border-amber-500/20 rounded-lg px-1.5 py-1">
                          <svg className="w-2.5 h-2.5 text-amber-400 fill-amber-400" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                          <span className="text-[8px] text-amber-400 font-semibold">4.9</span>
                        </div>
                      </div>
                      <div className="text-[7px] text-gray-400 leading-relaxed line-clamp-2">
                        Iron lattice tower on the Champ de Mars — the most visited monument in the world and symbol of Paris.
                      </div>
                      <div className="flex gap-1.5 pt-1">
                        <div className="flex-1 bg-[#3498DB] text-center text-[7px] text-white py-1 rounded-lg font-medium">View Details</div>
                        <div className="flex-1 bg-white/5 text-center text-[7px] text-gray-300 py-1 rounded-lg font-medium border border-white/10">Share</div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ★ Stage 12: Manage — QR + shareable link */}
                {activeLocTab === 'manage' && showManageQR && (
                  <motion.div key="manage-qr" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex flex-col gap-2.5">
                    {/* Shareable link bar */}
                    <div className="bg-[#1a1f2e] border border-white/10 rounded-xl p-2.5">
                      <p className="text-[7px] text-gray-500 mb-1.5 uppercase tracking-wide font-semibold">Shareable Link</p>
                      <div className="flex items-center gap-1.5 bg-black/30 border border-white/10 rounded-lg px-2 py-1.5">
                        <span className="flex-1 text-[7px] text-gray-300 font-mono truncate">explorers.earth/alex/lucknow</span>
                        <div className="flex gap-1 shrink-0">
                          {['Copy','Open','Share'].map((lbl, i) => (
                            <div key={lbl} className="w-5 h-5 rounded bg-[#3498DB] flex items-center justify-center">
                              {i === 0 && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
                              {i === 1 && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>}
                              {i === 2 && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* QR Code */}
                    <div className="bg-[#1a1f2e] border border-white/10 rounded-xl p-2.5 flex items-center gap-3">
                      <div className="shrink-0 w-14 h-14 bg-white rounded-lg p-1 flex items-center justify-center">
                        <div className="grid grid-cols-5 gap-px w-full h-full">
                          {Array.from({length:25}).map((_,i) => {
                            const filled = [0,1,2,3,4,5,9,10,14,15,19,20,21,22,23,24,6,12,18].includes(i);
                            return <div key={i} className={`rounded-[1px] ${filled ? 'bg-black' : 'bg-transparent'}`} />;
                          })}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] text-white font-semibold">QR Code</p>
                        <p className="text-[7px] text-gray-500 mt-0.5 leading-relaxed">Scan to open your Lucknow recommendations page</p>
                        <div className="mt-1.5 flex gap-1">
                          <div className="text-[7px] bg-[#3498DB]/20 text-[#3498DB] border border-[#3498DB]/30 rounded px-1.5 py-0.5 font-medium">Download</div>
                        </div>
                      </div>
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
