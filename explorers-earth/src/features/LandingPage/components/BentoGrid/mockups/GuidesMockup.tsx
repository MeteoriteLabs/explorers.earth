import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Loader2, ChevronRight, Pencil, Trash2, Eye } from 'lucide-react';
import { AddIcon } from '../../../../../assets/icons/AddIcon';

// Stages:
// 0: Home — show guide cards list
// 1: Hover a guide card
// 2: Click "Create Guide"  → button pulses
// 3: Show a "Create Guide" step form UI
// 4: Back to home with the new card appearing

const STAGE_DURATIONS = [2000, 1200, 600, 2500, 2500];

const guideCards = [
  {
    title: 'Kyoto 7-Day Itinerary',
    type: 'Itinerary',
    days: 7,
    location: 'Kyoto, Japan',
    tag: 'Published',
    color: 'bg-red-900/20',
    img: '/landing/Kyoto.jpg',
  },
  {
    title: 'Bali Hidden Gems',
    type: 'Theme',
    days: 5,
    location: 'Bali, Indonesia',
    tag: 'Draft',
    color: 'bg-amber-900/20',
    img: '/landing/Bali.jpg',
  },
  {
    title: 'Paris Weekend Break',
    type: 'Itinerary',
    days: 3,
    location: 'Paris, France',
    tag: 'Published',
    color: 'bg-green-900/20',
    img: '/landing/Paris.jpg',
  },
  {
    title: 'Louvre Art Guide',
    type: 'Theme',
    days: 1,
    location: 'Paris, France',
    tag: 'Draft',
    color: 'bg-blue-900/20',
    img: '/landing/Louvre_Museum.jpg',
  },
];

const GuideCardView = ({ card, hovered }: { card: typeof guideCards[0]; hovered?: boolean }) => (
  <motion.div
    animate={hovered ? { y: -3, borderColor: 'rgba(255,255,255,0.2)' } : { y: 0, borderColor: 'rgba(255,255,255,0.05)' }}
    transition={{ type: 'spring', stiffness: 300 }}
    className={`${card.color} rounded-2xl border overflow-hidden cursor-pointer`}
    style={{ borderColor: 'rgba(255,255,255,0.05)' }}
  >
    {/* Cover image */}
    <div className="h-20 relative overflow-hidden">
      <img src={card.img} alt={card.title} className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
      <div className="absolute bottom-2 left-2 flex gap-1">
        <span className={`text-[7px] px-1.5 py-0.5 rounded-full font-medium ${card.tag === 'Published' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>{card.tag}</span>
        <span className="text-[7px] text-gray-400 bg-black/40 px-1.5 py-0.5 rounded-full">{card.type}</span>
      </div>
    </div>
    <div className="p-3">
      <h3 className="text-xs font-semibold text-white truncate">{card.title}</h3>
      <p className="text-[9px] text-gray-400 flex items-center gap-1 mt-0.5">
        <MapPin size={8} /> {card.location} • {card.days} days
      </p>
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1.5">
          {hovered && (
            <>
              <div className="p-1 rounded-md bg-white/5 text-gray-400"><Pencil size={9} /></div>
              <div className="p-1 rounded-md bg-white/5 text-gray-400"><Eye size={9} /></div>
              <div className="p-1 rounded-md bg-white/5 text-red-400"><Trash2 size={9} /></div>
            </>
          )}
        </div>
        <span className="flex items-center gap-0.5 text-dashboard-accent text-[9px] font-medium">Open <ChevronRight size={9} /></span>
      </div>
    </div>
  </motion.div>
);

export default function GuidesMockup() {
  const [stage, setStage] = useState(0);
  const [showNewCard, setShowNewCard] = useState(false);
  const [createStep, setCreateStep] = useState(0); // 0 = step 1, 1 = step 2

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    if (stage === 0) {
      t = setTimeout(() => setStage(1), STAGE_DURATIONS[0]);
    } else if (stage === 1) {
      t = setTimeout(() => setStage(2), STAGE_DURATIONS[1]);
    } else if (stage === 2) {
      t = setTimeout(() => setStage(3), STAGE_DURATIONS[2]);
    } else if (stage === 3) {
      // advance create step indicator mid-way
      const t2 = setTimeout(() => setCreateStep(1), 1200);
      t = setTimeout(() => {
        setStage(4);
        setShowNewCard(true);
        setCreateStep(0);
      }, STAGE_DURATIONS[3]);
      return () => { clearTimeout(t); clearTimeout(t2); };
    } else if (stage === 4) {
      t = setTimeout(() => {
        setStage(0);
        setShowNewCard(false);
      }, STAGE_DURATIONS[4]);
    }
    return () => clearTimeout(t);
  }, [stage]);

  return (
    <div className="flex-1 flex flex-col bg-[#0F1419] h-full overflow-hidden select-none pointer-events-none relative">
      <motion.div
        animate={{ y: (stage === 1) ? -80 : 0 }}
        transition={{ duration: 1.5, ease: 'easeInOut' }}
        className="px-3 pt-4 flex-1 flex flex-col pb-24"
      >
        <AnimatePresence mode="wait">
          {stage !== 3 ? (
            /* ── Guide Cards Grid ── */
            <motion.div
              key="cards"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="grid grid-cols-1 gap-3"
            >
              {guideCards.map((card, i) => (
                <GuideCardView key={i} card={card} hovered={stage === 1 && i === 0} />
              ))}

              <AnimatePresence>
                {showNewCard && (
                  <motion.div
                    key="new-card"
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-2xl border overflow-hidden bg-blue-900/20"
                    style={{ borderColor: 'rgba(52,152,219,0.4)' }}
                  >
                    {/* Cover */}
                    <div className="h-20 relative overflow-hidden">
                      <img src="/landing/Eiffel_Tower.jpg" alt="Paris" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                      <div className="absolute bottom-2 left-2 flex gap-1">
                        <span className="text-[7px] px-1.5 py-0.5 rounded-full font-medium bg-gray-500/20 text-gray-400">Draft</span>
                        <span className="text-[7px] text-gray-400 bg-black/40 px-1.5 py-0.5 rounded-full">Itinerary</span>
                      </div>
                    </div>
                    <div className="p-3">
                      <h3 className="text-xs font-semibold text-white truncate">Paris Weekend Guide</h3>
                      <p className="text-[9px] text-gray-400 flex items-center gap-1 mt-0.5">
                        <MapPin size={8} /> Paris, France • 3 days
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            /* ── Create Guide Wizard (Step indicator) ── */
            <motion.div
              key="create"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
              className="bg-dashboard-sidebar rounded-2xl p-4 border border-white/10"
            >
              {/* Step progress */}
              <div className="flex items-center gap-2 mb-4">
                {['Basic Info', 'Sections', 'Preview'].map((label, i) => (
                  <React.Fragment key={i}>
                    <div className={`flex items-center gap-1 text-[9px] font-medium px-2 py-1 rounded-full ${i <= createStep ? 'bg-dashboard-accent text-white' : 'bg-white/5 text-gray-500'}`}>
                      <span>{i + 1}</span>
                      <span className="hidden sm:inline">{label}</span>
                    </div>
                    {i < 2 && <div className={`flex-1 h-px ${i < createStep ? 'bg-dashboard-accent' : 'bg-white/10'}`} />}
                  </React.Fragment>
                ))}
              </div>

              <div className="space-y-2.5">
                <div>
                  <label className="text-[9px] font-semibold text-white mb-1 block">Guide Title</label>
                  <div className="w-full bg-dashboard-bg border border-white/10 rounded-lg px-3 py-1.5 text-[10px] text-white">
                    Paris Weekend Guide
                    <motion.span animate={{ opacity: [0,1,0] }} transition={{ repeat: Infinity, duration: 0.8 }}
                      className="inline-block w-px h-3 bg-dashboard-accent ml-0.5 align-middle" />
                  </div>
                </div>
                <div>
                  <label className="text-[9px] font-semibold text-white mb-1 block">Guide Type</label>
                  <div className="w-full bg-dashboard-bg border border-white/10 rounded-lg px-3 py-1.5 text-[10px] text-white">Itinerary</div>
                </div>
                <div>
                  <label className="text-[9px] font-semibold text-white mb-1 block">Destination</label>
                  <div className="w-full bg-dashboard-bg border border-white/10 rounded-lg px-3 py-1.5 text-[10px] text-white flex items-center gap-1">
                    <MapPin size={9} className="text-dashboard-accent" /> Paris, France
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 mt-3 border-t border-white/10">
                <button className="px-3 py-1.5 rounded-lg bg-red-500 text-[9px] text-white font-medium">Cancel</button>
                <button className="px-3 py-1.5 rounded-lg bg-blue-500 text-[9px] text-white font-medium flex items-center gap-1">
                  {createStep === 0 && <Loader2 size={9} className="animate-spin" />}
                  Next Step
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
