import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, ChevronLeft, ChevronRight, Star } from "lucide-react";
import type { RecommendedBook } from "../../types";
import { buildCoverUrl, formatAuthors } from "../../utils/bookHelpers";

interface TopReadsHeroProps {
  books: RecommendedBook[];
  onBookClick: (book: RecommendedBook) => void;
  showManageButton?: boolean;
  onManageClick?: () => void;
}

const TopReadsHero = ({ books, onBookClick, showManageButton = false, onManageClick }: TopReadsHeroProps) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  if (!books || books.length === 0) return null;

  const activeBook = books[activeIndex];
  const coverUrl = buildCoverUrl(activeBook.cover_url_large || activeBook.cover_url);
  const authors = formatAuthors(activeBook.authors);
  const subjects = activeBook.subjects?.slice(0, 3) || [];

  const updateScrollButtons = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5);
    }
  };

  useEffect(() => {
    updateScrollButtons();
  }, [books]);

  useEffect(() => {
    if (scrollRef.current) {
      const btn = scrollRef.current.children[activeIndex] as HTMLElement;
      if (btn) {
        btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeIndex]);

  useEffect(() => {
    if (books.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % books.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [books.length]);

  const handleScrollClick = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -300 : 300;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="relative w-full h-[60vh] min-h-[500px] max-h-[700px] rounded-2xl overflow-hidden bg-black shadow-2xl group/hero mb-12">
      {/* Cinematic Background Presentation */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeBook.documentId}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0 cursor-pointer overflow-hidden"
          onClick={() => onBookClick(activeBook)}
        >
          {/* Main Full-Cover Background */}
          <div className="absolute inset-0">
            <img
              src={coverUrl || "https://images.unsplash.com/photo-1512820790803-83ca734da794"}
              alt=""
              className="w-full h-full object-cover transform scale-110 blur-md opacity-60"
            />
            {/* The sharp cover centered or to the right */}
            <div className="absolute inset-0 flex items-center justify-end pr-[10%] lg:pr-[15%]">
               <motion.div 
                 initial={{ scale: 0.9, opacity: 0, x: 50 }}
                 animate={{ scale: 1, opacity: 1, x: 0 }}
                 transition={{ delay: 0.2, duration: 0.6 }}
                 className="h-[85%] aspect-[2/3] shadow-[0_0_100px_rgba(0,0,0,0.9)] rounded-lg overflow-hidden border border-white/10 hidden md:block"
               >
                 <img src={coverUrl} alt={activeBook.title} className="w-full h-full object-cover" />
               </motion.div>
            </div>
          </div>
          
          {/* Overlays for perfect legibility and cinematic feel */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/40 to-transparent w-full md:w-3/4" />
        </motion.div>
      </AnimatePresence>

      {/* Top Reads Heading - Increased Left Margin */}
      <div className="absolute top-8 left-10 md:top-12 md:left-16 z-50 pointer-events-none flex flex-col gap-1">
        <h2 className="text-xl md:text-2xl font-bold text-white flex items-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          <span className="w-1.5 h-6 bg-amber-500 mr-3 rounded-full inline-block"></span>
          Top Reads
        </h2>
      </div>

      {showManageButton && (
        <button
          onClick={onManageClick}
          className="absolute z-50 top-6 right-6 lg:top-8 lg:right-8 bg-amber-500 hover:bg-amber-400 text-black px-5 py-2.5 rounded-full text-sm font-black shadow-[0_0_20px_rgba(245,158,11,0.5)] flex items-center gap-2 border border-amber-400 transition-all hover:scale-105"
        >
          <Star size={16} className="text-black" fill="currentColor" />
          Manage Top Reads
        </button>
      )}

      {/* Main Content Area - Increased Left Padding */}
      <div className="absolute inset-0 flex flex-col justify-end p-10 md:p-16 z-20">
        <div className="flex justify-between items-end w-full">
          {/* Left Text Detail Section */}
          <div className="w-full lg:w-1/2 flex flex-col gap-4">
            <motion.h1 
              key={`title-${activeBook.documentId}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-4xl md:text-5xl lg:text-7xl font-black text-white leading-none font-poppins drop-shadow-2xl"
            >
              {activeBook.title}
            </motion.h1>
            
            <motion.div 
              key={`meta-${activeBook.documentId}`}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
              className="flex items-center gap-3 text-sm md:text-base text-white/90 font-bold tracking-tight"
            >
              {activeBook.year && <span className="text-amber-400">{activeBook.year}</span>}
              {activeBook.year && authors && <span className="text-white/40">•</span>}
              {authors && <span className="truncate max-w-[250px]">{authors}</span>}
              {subjects.length > 0 && <span className="text-white/40">•</span>}
              {subjects.length > 0 && <span className="text-amber-500/80">{subjects[0]}</span>}
            </motion.div>

            <motion.p 
              key={`desc-${activeBook.documentId}`}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
              className="text-white/80 text-sm md:text-base leading-relaxed line-clamp-3 max-w-xl font-medium drop-shadow-md"
            >
              {activeBook.description?.replace(/<[^>]+>/g, '') || "Explore this featured recommendation."}
            </motion.p>
            
            <motion.div 
              key={`btns-${activeBook.documentId}`}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
              className="flex items-center gap-4 mt-4"
            >
              <button 
                onClick={() => onBookClick(activeBook)}
                className="flex items-center gap-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold py-4 px-10 rounded-xl shadow-2xl shadow-amber-500/20 transition-all hover:scale-105 active:scale-95"
              >
                <BookOpen size={20} />
                See Details
              </button>
            </motion.div>
          </div>

          {/* Right Bottom Thumbnail Row */}
          <div className="hidden lg:flex flex-col items-end max-w-[35%]">
            <div className="relative group/thumbs w-full max-w-xl pl-12">
               {/* Nav arrows */}
               {canScrollLeft && (
                <button
                  onClick={() => handleScrollClick('left')}
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-30 bg-black/80 hover:bg-black text-white rounded-r-xl p-2 shadow-2xl opacity-0 group-hover/thumbs:opacity-100 transition-all backdrop-blur-md"
                >
                  <ChevronLeft size={24} />
                </button>
              )}
              {canScrollRight && (
                <button
                  onClick={() => handleScrollClick('right')}
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-30 bg-black/80 hover:bg-black text-white rounded-l-xl p-2 shadow-2xl opacity-0 group-hover/thumbs:opacity-100 transition-all backdrop-blur-md"
                >
                  <ChevronRight size={24} />
                </button>
              )}

              {/* Thumbnails */}
              <div 
                ref={scrollRef}
                onScroll={updateScrollButtons}
                className="flex gap-4 overflow-x-auto scrollbar-hide py-4 px-2"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {books.map((book, index) => {
                  const isSelected = index === activeIndex;
                  const thumbUrl = buildCoverUrl(book.cover_url);
                  return (
                    <button
                      key={`thumb-${book.documentId}`}
                      onClick={(e) => { e.stopPropagation(); setActiveIndex(index); }}
                      className={`relative flex-shrink-0 w-20 aspect-[2/3] rounded-md overflow-hidden transition-all duration-300 ${isSelected ? 'ring-2 ring-white scale-110 z-10 shadow-2xl' : 'opacity-50 hover:opacity-100 hover:scale-105 filter brightness-75 hover:brightness-100'}`}
                    >
                      <img 
                        src={thumbUrl || "https://images.unsplash.com/photo-1512820790803-83ca734da794"} 
                        alt={book.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/20" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopReadsHero;
