import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Music, Film, BookOpen, Gamepad2, ChevronRight } from 'lucide-react';

// Mirrors RecommendationsHub — 5 category cards with their animated background colors
// Walkthrough: cycles through hovering each card

const categories = [
  { key: 'places', label: 'Places', Icon: MapPin, color: '#10b981', grad: 'from-emerald-900/60' },
  { key: 'music', label: 'Music', Icon: Music, color: '#a855f7', grad: 'from-purple-900/60' },
  { key: 'movies', label: 'Movies & Shows', Icon: Film, color: '#3b82f6', grad: 'from-blue-900/60' },
  { key: 'books', label: 'Books', Icon: BookOpen, color: '#f97316', grad: 'from-amber-900/60' },
  { key: 'games', label: 'Games', Icon: Gamepad2, color: '#ec4899', grad: 'from-fuchsia-900/60' },
];

const descriptions: Record<string, string> = {
  places: 'Explore curated locations and favourite spots',
  music: 'Shared playlists and local tunes',
  movies: 'Watchlists for every mood',
  books: 'Literary picks and reading collections',
  games: 'Gaming favourites and latest discoveries',
};

export default function PlacesMockup() {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Auto-cycle hover to show the walkthrough
  useEffect(() => {
    let idx = 0;
    const cycle = () => {
      setHoveredIdx(idx);
      idx = (idx + 1) % categories.length;
    };
    cycle();
    const iv = setInterval(cycle, 1600);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="flex-1 flex flex-col bg-[#0F1419] h-full p-5 select-none pointer-events-none">
      {/* Page title — matches RecommendationsHub */}
      <div className="mb-5">
        <h1 className="text-2xl font-black tracking-tight text-white uppercase font-poppins">Recommendations</h1>
        <p className="text-xs text-gray-500 font-medium mt-1">
          Manage and share your curated lists of locations, movies, books, games and music.
        </p>
      </div>

      {/* Category cards grid */}
      <div className="flex flex-col gap-3 flex-1">
        {categories.map((cat, i) => {
          const { Icon } = cat;
          const isHovered = hoveredIdx === i;
          return (
            <motion.div
              key={cat.key}
              animate={isHovered ? { scale: 1.02, y: -2 } : { scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className={`relative flex-1 min-h-[60px] rounded-2xl overflow-hidden cursor-pointer group bg-slate-900`}
            >
              {/* Gradient background */}
              <div className={`absolute inset-0 bg-gradient-to-r ${cat.grad} to-slate-900/20 transition-opacity duration-500 ${isHovered ? 'opacity-100' : 'opacity-60'}`} />

              {/* Accent glow on hover */}
              <AnimatePresence>
                {isHovered && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0"
                    style={{ background: `radial-gradient(circle at 20% 50%, ${cat.color}20, transparent 60%)` }}
                  />
                )}
              </AnimatePresence>

              {/* Frosted left panel (matches real component) */}
              <div className="absolute inset-y-0 left-0 w-3/5 backdrop-blur-sm" style={{ maskImage: 'linear-gradient(to right, black 50%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to right, black 50%, transparent 100%)' }} />

              {/* Content */}
              <div className="absolute inset-0 p-4 flex items-center z-10">
                <div className="flex flex-col min-w-0 flex-1">
                  <h3
                    className="text-lg font-black text-white tracking-tighter leading-none uppercase transition-transform origin-left"
                    style={{ transform: isHovered ? 'scale(1.05)' : 'scale(1)' }}
                  >
                    {cat.label}
                  </h3>
                  <p className="text-[10px] font-semibold tracking-wide mt-1 line-clamp-1 transition-colors" style={{ color: isHovered ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.5)' }}>
                    {descriptions[cat.key]}
                  </p>
                  {/* Hover underline bar */}
                  <motion.div
                    className="h-0.5 mt-2 rounded-full"
                    animate={{ width: isHovered ? 80 : 0 }}
                    transition={{ duration: 0.5 }}
                    style={{ backgroundColor: cat.color }}
                  />
                </div>

                {/* Arrow on hover */}
                <AnimatePresence>
                  {isHovered && (
                    <motion.div
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      className="ml-auto shrink-0 w-8 h-8 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white"
                    >
                      <ChevronRight size={16} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Bottom accent line (matches real component) */}
              <motion.div
                className="absolute bottom-0 left-0 h-[3px] rounded-r-full z-20"
                animate={{ width: isHovered ? '100%' : 32 }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
                style={{ backgroundColor: cat.color }}
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
