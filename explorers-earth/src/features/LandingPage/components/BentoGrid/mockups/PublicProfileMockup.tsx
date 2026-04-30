import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Heart, Image, Star, Instagram, Youtube, Globe,
  QrCode, Link, Gamepad2, BookOpen, Film, Music
} from 'lucide-react';

// ── Walkthrough stages ──
// Phase A — Entry via public link:
//   0: URL bar animates (address types in)           1400ms
//   1: Profile content appears                       2000ms
//   2: Recommendations tab — all category cards      2500ms
//   3: Click "Places" → place cards slide in         2000ms
// Phase B — Entry via QR code scan:
//   4: QR code with scan line animation              1800ms
//   5: Profile content appears (same profile)        2000ms
//   6: Gallery tab active — feed grid                2000ms
// → loop to stage 0

const STAGES = [1400, 2000, 2500, 2000, 1800, 2000, 2000];

const recCategories = [
  { label: 'Places', Icon: MapPin, color: '#10b981', grad: 'from-emerald-900/70 to-emerald-800/40' },
  { label: 'Music', Icon: Music, color: '#a855f7', grad: 'from-purple-900/70 to-purple-800/40' },
  { label: 'Movies', Icon: Film, color: '#3b82f6', grad: 'from-blue-900/70 to-blue-800/40' },
  { label: 'Books', Icon: BookOpen, color: '#f97316', grad: 'from-amber-900/70 to-amber-800/40' },
  { label: 'Games', Icon: Gamepad2, color: '#ec4899', grad: 'from-fuchsia-900/70 to-fuchsia-800/40' },
];

const places = [
  { name: 'Eiffel Tower', cat: 'Landmarks', img: '/landing/Eiffel_Tower.jpg', rating: 4.9 },
  { name: 'Louvre Museum', cat: 'Culture', img: '/landing/Louvre_Museum.jpg', rating: 4.8 },
  { name: 'Montmartre', cat: 'Neighbourhood', img: '/landing/Paris.jpg', rating: 4.7 },
];

const feedCells = [
  { img: '/landing/Taylor_Swift_1.jpg', label: 'Concert' },
  { img: '/landing/Taylor_Swift_2.jpg', label: 'Stage' },
  { img: '/landing/Taylor_Swift_3.jpg', label: 'Tour' },
  { img: '/landing/Taylor_Swift_1.jpg', label: '' },
  { img: '/landing/Taylor_Swift_2.jpg', label: '' },
  { img: '/landing/Taylor_Swift_3.jpg', label: '' },
];

const socialIcons = [
  { Icon: Instagram, color: '#E1306C' },
  { Icon: Youtube, color: '#FF0000' },
  { Icon: Globe, color: '#3498DB' },
];

// ── Reusable profile body ──
function ProfileBody({ activeTab, stage }: { activeTab: 'recommendations' | 'gallery', stage: number }) {
  const [activeCat, setActiveCat] = useState<string | null>(null);

  useEffect(() => {
    if (stage === 3) setActiveCat('Places');
    else setActiveCat(null);
  }, [stage]);

  return (
    <div className="flex flex-col h-full">
      {/* Cover */}
      <div className="relative h-24  shrink-0 overflow-visible">
        <img src="/landing/Taylor_Swift_1.jpg" alt="Cover" className="absolute inset-0 w-full h-full object-cover object-top" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/80" />
      </div>

      {/* Avatar — sits on the boundary, fully visible */}
      <div className="flex justify-center -mt-9 shrink-0 z-10 relative">
        <div className="w-[4.5rem] h-[4.5rem] rounded-full border-[3px] border-green-400 overflow-hidden shadow-xl ring-4 ring-black">
          <img src="/landing/Taylor_Swift_Profile.png" alt="Taylor Swift" className="w-full h-full object-cover" />
        </div>
      </div>

      {/* Profile info */}
      <div className="flex flex-col items-center pt-1 pb-2 px-4 shrink-0">
        <h2 className="text-white text-xs font-bold">Taylor Swift</h2>
        <div className="flex items-center gap-1 text-gray-400 text-[8px] mt-0.5">
          <MapPin size={7} /><span>Nashville, TN</span>
        </div>
        <div className="flex items-center gap-3 mt-1.5">
          {socialIcons.map(({ Icon, color }, i) => (
            <Icon key={i} size={12} style={{ color }} />
          ))}
        </div>
        <p className="text-gray-400 text-[7px] text-center mt-1.5 leading-relaxed max-w-[200px] line-clamp-2">
          Singer-songwriter 🎵 Sharing my favourite places from around the world. 10x Grammy winner.
        </p>
      </div>

      {/* Tab bar — heart | image icons */}
      <div className="flex justify-center gap-8 border-b border-gray-800 px-2 shrink-0">
        {[
          { id: 'recommendations' as const, Icon: Heart },
          { id: 'gallery' as const, Icon: Image },
        ].map(({ id, Icon }) => (
          <div key={id}
            className={`py-1.5 border-b-2 transition-colors ${activeTab === id ? 'border-[#3498DB] text-white' : 'border-transparent text-gray-600'}`}>
            <Icon size={12} fill={activeTab === id ? 'currentColor' : 'none'} />
          </div>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden px-3 py-2">
        <AnimatePresence mode="wait">

          {/* Recommendations tab — shows all categories */}
          {activeTab === 'recommendations' && !activeCat && (
            <motion.div key="rec-cats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col gap-2">
              {recCategories.map(({ label, Icon, color, grad }, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className={`relative flex items-center gap-3 rounded-xl px-3 py-2 overflow-hidden bg-gradient-to-r ${grad} border border-white/5`}
                >
                  <Icon size={14} style={{ color }} />
                  <span className="text-white text-[10px] font-semibold uppercase tracking-wide">{label}</span>
                  {/* Bottom accent bar */}
                  <motion.div
                    className="absolute bottom-0 left-0 h-[2px] rounded-full"
                    animate={{ width: '40%' }}
                    style={{ backgroundColor: color }}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Places sub-view */}
          {activeTab === 'recommendations' && activeCat === 'Places' && (
            <motion.div key="places" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="space-y-1.5">
              <div className="flex items-center gap-2 mb-1.5">
                <MapPin size={10} className="text-emerald-400" />
                <span className="text-[9px] text-white font-semibold">Paris</span>
                <button className="ml-auto text-[7px] text-[#3498DB]">View all</button>
              </div>
              {places.map((p, i) => (
                <motion.div key={p.name} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                  className="flex items-center gap-2 bg-[#1a1f2e] rounded-xl p-1.5 border border-white/5">
                  <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
                    <img src={p.img} alt={p.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[8px] text-white font-medium truncate">{p.name}</p>
                    <p className="text-[7px] text-gray-500">{p.cat}</p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Star size={6} className="text-amber-400 fill-amber-400" />
                    <span className="text-[7px] text-amber-400">{p.rating}</span>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Gallery tab */}
          {activeTab === 'gallery' && (
            <motion.div key="gallery" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="grid grid-cols-3 gap-1">
                {feedCells.map((cell, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.06 }}
                    className="aspect-square rounded-md overflow-hidden relative"
                  >
                    <img src={cell.img} alt={cell.label} className="w-full h-full object-cover" />
                    {cell.label && (
                      <div className="absolute inset-0 flex items-end p-1 bg-gradient-to-t from-black/50 to-transparent">
                        <span className="text-[6px] text-white/80">{cell.label}</span>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}

export default function PublicProfileMockup() {
  const [stage, setStage] = useState(0);
  const [typedUrl, setTypedUrl] = useState('');

  useEffect(() => {
    const next = (stage + 1) % STAGES.length;
    const t = setTimeout(() => {
      if (next === 0) setTypedUrl('');
      setStage(next);
    }, STAGES[stage]);
    return () => clearTimeout(t);
  }, [stage]);

  // Type the URL in stage 0
  useEffect(() => {
    if (stage !== 0) return;
    const target = 'explorers.earth/taylorswift';
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setTypedUrl(target.slice(0, i));
      if (i >= target.length) clearInterval(iv);
    }, 55);
    return () => clearInterval(iv);
  }, [stage]);

  const inPhaseA = stage <= 3;  // URL entry
  const inPhaseB = stage >= 4;  // QR entry
  const showProfile = stage === 1 || stage === 2 || stage === 3 || stage === 5 || stage === 6;

  const activeTab: 'recommendations' | 'gallery' = stage === 6 ? 'gallery' : 'recommendations';

  return (
    <div className="flex-1 flex flex-col bg-black h-full overflow-hidden select-none pointer-events-none">

      <AnimatePresence mode="wait">

        {/* ═══ Phase A: Browser URL entry ═══ */}
        {inPhaseA && (
          <motion.div key="phase-a" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-full">

            {/* Fake browser address bar — Stage 0 only */}
            <AnimatePresence>
              {stage === 0 && (
                <motion.div
                  key="url-bar"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="flex items-center gap-2 bg-[#1a1f2e] border border-white/10 rounded-xl px-3 py-2 mx-3 mt-3 shrink-0"
                >
                  <Link size={9} className="text-[#3498DB] shrink-0" />
                  <div className="flex-1 text-[9px] font-mono text-white">
                    {typedUrl || <span className="text-gray-500">Type URL…</span>}
                    <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 0.7 }}
                      className="inline-block w-px h-2.5 bg-[#3498DB] ml-0.5 align-middle" />
                  </div>
                  <div className="w-4 h-4 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Profile content */}
            <AnimatePresence>
              {showProfile && inPhaseA && (
                <motion.div key="profile-a" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex-1 overflow-hidden">
                  <ProfileBody activeTab={activeTab} stage={stage} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ═══ Phase B: QR code scan entry ═══ */}
        {inPhaseB && (
          <motion.div key="phase-b" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-full">

            {/* QR scan animation — Stage 4 only */}
            <AnimatePresence>
              {stage === 4 && (
                <motion.div key="qr-scan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex-1 flex flex-col items-center justify-center gap-4 px-6">

                  {/* Phone frame with QR inside */}
                  <div className="relative w-32 h-40 bg-[#1a1f2e] rounded-2xl border border-white/10 flex items-center justify-center shadow-2xl overflow-hidden">
                    {/* Viewfinder corners */}
                    <div className="absolute inset-5 flex items-center justify-center">
                      {/* Corner lines */}
                      {[
                        'top-0 left-0 border-t-2 border-l-2',
                        'top-0 right-0 border-t-2 border-r-2',
                        'bottom-0 left-0 border-b-2 border-l-2',
                        'bottom-0 right-0 border-b-2 border-r-2',
                      ].map((cls, i) => (
                        <div key={i} className={`absolute w-4 h-4 border-[#3498DB] ${cls}`} />
                      ))}

                      {/* QR code grid */}
                      <div className="grid grid-cols-7 gap-px w-full opacity-60">
                        {Array.from({ length: 49 }).map((_, i) => {
                          const filled = [0,1,2,3,4,5,6,7,14,21,28,35,42,43,44,45,46,47,48,8,11,13,17,24,31,38].includes(i);
                          return <div key={i} className={`aspect-square rounded-[0.5px] ${filled ? 'bg-white' : 'bg-white/10'}`} />;
                        })}
                      </div>
                    </div>

                    {/* Scan line */}
                    <motion.div
                      className="absolute left-4 right-4 h-px bg-[#3498DB] shadow-[0_0_8px_#3498DB]"
                      animate={{ top: ['20%', '80%', '20%'] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  </div>

                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <QrCode size={11} className="text-[#3498DB]" />
                      <span className="text-white text-[10px] font-semibold">Scan to open profile</span>
                    </div>
                    <p className="text-gray-500 text-[8px]">Point camera at QR code</p>
                  </div>

                  {/* Loading indicator */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                    className="flex items-center gap-1.5"
                  >
                    <motion.div animate={{ scale: [0.8, 1, 0.8] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="w-1.5 h-1.5 rounded-full bg-[#3498DB]" />
                    <motion.div animate={{ scale: [0.8, 1, 0.8] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.15 }} className="w-1.5 h-1.5 rounded-full bg-[#3498DB]" />
                    <motion.div animate={{ scale: [0.8, 1, 0.8] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.3 }} className="w-1.5 h-1.5 rounded-full bg-[#3498DB]" />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Profile content after QR scan */}
            <AnimatePresence>
              {showProfile && inPhaseB && (
                <motion.div key="profile-b" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex-1 overflow-hidden">
                  <ProfileBody activeTab={activeTab} stage={stage} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
