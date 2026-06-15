import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  MapPin, Music, Film, BookOpen, Gamepad2,
  ChevronRight
} from "lucide-react";
import TravelGuideIcon from "../assets/icons/TravelGuideIcon";

type CategoryKey = "places" | "music" | "movies" | "books" | "games" | "guides";

interface CategoryConfig {
  key: CategoryKey;
  label: string;
  icon: React.ComponentType<any>;
  description: string;
  color: string;
  path: string;
}

const CATEGORIES: CategoryConfig[] = [
  { 
    key: "places",  
    label: "Places",        
    icon: MapPin, 
    description: "Explore curated locations and favorite spots from around the world",
    color: "emerald",
    path: "/recommendations/places"
  },
  { 
    key: "music",   
    label: "Music",         
    icon: Music, 
    description: "Discover shared playlists and local tunes that define the vibe",
    color: "purple",
    path: "/music"
  },
  { 
    key: "movies",  
    label: "Movies & Shows", 
    icon: Film, 
    description: "Watch lists and cinematic recommendations for every mood",
    color: "blue",
    path: "/recommendations/movies"
  },
  { 
    key: "books",   
    label: "Books",         
    icon: BookOpen, 
    description: "Literary picks and reading collections from classic to modern",
    color: "orange",
    path: "/recommendations/books"
  },
  { 
    key: "games",   
    label: "Games",         
    icon: Gamepad2, 
    description: "Gaming favorites and latest discoveries in the digital world",
    color: "pink",
    path: "/recommendations/games"
  },
  { 
    key: "guides",  
    label: "Guides",        
    icon: TravelGuideIcon, 
    description: "Explore curated travel itineraries, maps, and local guides for your next trip",
    color: "amber",
    path: "/guides"
  },
];

// --- Sub-components from ProfileRecommendationsTab ---

const Bird = ({ delay }: { delay: number }) => (
  <motion.svg 
    width="34" 
    height="24" 
    viewBox="0 0 24 16" 
    animate={{ y: [0, -5, 0], rotate: [-2, 2, -2] }} 
    transition={{ duration: 3, repeat: Infinity, delay: delay, ease: "easeInOut" }}
  >
    <circle cx="12" cy="8" r="1.2" fill="currentColor" fillOpacity="0.9" />
    <path d="M11 8 L12 11 L13 8" fill="currentColor" fillOpacity="0.5" />
    <motion.path 
      d="M2 10 C 6 6, 10 6, 12 8 C 14 6, 18 6, 22 10" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="1.5" 
      strokeLinecap="round" 
      animate={{ 
        d: [
          "M2 10 C 6 6, 10 6, 12 8 C 14 6, 18 6, 22 10", 
          "M4 6 C 8 8, 10 8, 12 8 C 14 8, 16 8, 20 6"
        ] 
      }} 
      transition={{ duration: 1.5, repeat: Infinity, repeatType: "reverse", delay: delay, ease: "easeInOut" }} 
    />
  </motion.svg>
);

const FloatingItem = ({ children, x, delay, duration }: any) => (
  <motion.div className="absolute text-white/20" initial={{ x: x + "%", y: "110%" }} animate={{ y: "-20%", rotate: [0, 10, -10, 0] }} transition={{ duration, repeat: Infinity, delay, ease: "linear" }}>
    {children}
  </motion.div>
);

const AmbientMotion = ({ category }: { category: CategoryKey }) => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      <div className="absolute inset-0 opacity-10">
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <motion.path
            d="M0 50 Q 25 30, 50 50 T 100 50 V100 H0 Z"
            fill="white"
            animate={{ 
              d: [
                "M0 50 Q 25 30, 50 50 T 100 50 V100 H0 Z", 
                "M0 50 Q 25 70, 50 50 T 100 50 V100 H0 Z", 
                "M0 50 Q 25 30, 50 50 T 100 50 V100 H0 Z"
              ] 
            }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
        </svg>
      </div>
      {category === "movies" && (
        <div className="absolute inset-0 bg-black/5 mix-blend-overlay">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-15 animate-pulse" />
        </div>
      )}
    </div>
  );
};

const PlacesAnimatedBackground = () => {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start end", "end start"] });
  const y1 = useTransform(scrollYProgress, [0, 1], ["0px", "10px"]);
  const y2 = useTransform(scrollYProgress, [0, 1], ["0px", "25px"]);
  const y3 = useTransform(scrollYProgress, [0, 1], ["0px", "45px"]);
  const ySun = useTransform(scrollYProgress, [0, 1], ["0px", "5px"]);
  return (
    <div ref={containerRef} className="absolute inset-0 bg-slate-900 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-900/20 via-slate-900/40 to-slate-900 opacity-80" />
      <div className="absolute top-0 right-0 w-32 h-32 opacity-5 pointer-events-none">
        <svg viewBox="0 0 100 100" className="w-full h-full fill-none stroke-white" strokeWidth="0.5">
          <circle cx="100" cy="0" r="30" />
          <circle cx="100" cy="0" r="50" />
          <circle cx="100" cy="0" r="70" />
          <circle cx="100" cy="0" r="90" />
        </svg>
      </div>
      <motion.div style={{ y: ySun }} className="absolute top-[-20px] right-[10%] w-40 h-40 bg-emerald-500/10 rounded-full blur-[60px]" />
      <motion.div style={{ y: ySun }} className="absolute top-6 right-[15%] w-6 h-6 rounded-full bg-yellow-200/20 blur-sm z-0" animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }} transition={{ duration: 4, repeat: Infinity }} />
      {[...Array(4)].map((_, i) => (
        <motion.div key={i} className="absolute top-9 right-[15%] w-24 h-[1px] bg-gradient-to-r from-yellow-100/20 to-transparent origin-left z-0" style={{ rotate: (i * 45) + 160 + "deg", y: ySun }} animate={{ opacity: [0.05, 0.2, 0.05], scaleX: [0.8, 1.2, 0.8] }} transition={{ duration: 3, repeat: Infinity, delay: i * 0.7 }} />
      ))}
      <motion.svg style={{ y: y1 }} animate={{ x: ["-8%", "8%", "-8%"] }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="absolute bottom-0 w-[120%] -left-[10%] h-[85%] opacity-20" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M0 100 L15 50 L30 80 L50 30 L70 70 L85 45 L100 100 Z" fill="currentColor" className="text-emerald-300" />
      </motion.svg>
      <motion.svg style={{ y: y2 }} animate={{ x: ["5%", "-5%", "5%"] }} transition={{ duration: 15, repeat: Infinity, ease: "linear" }} className="absolute bottom-0 w-[120%] -left-[10%] h-[65%] opacity-30" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M0 100 L25 60 L45 85 L65 55 L85 90 L100 100 Z" fill="currentColor" className="text-emerald-500" />
      </motion.svg>
      <motion.svg style={{ y: y3 }} animate={{ x: ["-10%", "10%", "-10%"] }} transition={{ duration: 12, repeat: Infinity, ease: "linear" }} className="absolute bottom-[-10px] w-[120%] -left-[10%] h-[45%] opacity-40 scale-x-110" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M0 100 L20 80 L40 95 L60 75 L80 90 L100 85 L100 100 Z" fill="currentColor" className="text-emerald-700" />
      </motion.svg>
      {[...Array(5)].map((_, i) => (
        <motion.div key={i} className="absolute text-white/60 w-full z-10" initial={{ x: "-25%", y: (8 + (i * 10)) + "%" }} animate={{ x: "135%", y: (12 + (i * 7)) + "%" }} transition={{ duration: 18 + (i * 4), repeat: Infinity, delay: i * 4, ease: "linear" }}>
          <div className="flex gap-14">
            <Bird delay={i * 0.2} />
            {i % 2 === 0 && <Bird delay={i * 0.5 + 0.3} />}
          </div>
        </motion.div>
      ))}
    </div>
  );
};

const MusicAnimatedBackground = ({ isHovering }: { isHovering: boolean }) => {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start end", "end start"] });
  const y1 = useTransform(scrollYProgress, [0, 1], ["0px", "10px"]);
  const yMoon = useTransform(scrollYProgress, [0, 1], ["0px", "5px"]);
  return (
    <div ref={containerRef} className="absolute inset-0 bg-slate-950 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-purple-900/30 via-slate-950/20 to-slate-950 opacity-90" />
      <motion.div className="absolute -right-20 -top-10 w-96 h-96 opacity-[0.04] pointer-events-none z-0" animate={{ rotate: isHovering ? 360 : 0 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }}>
        <svg viewBox="0 0 100 100" className="w-full h-full text-white">
          <circle cx="50" cy="50" r="48" fill="currentColor" />
          {[...Array(40)].map((_, i) => (
            <circle key={i} cx="50" cy="50" r={46 - i} stroke="black" strokeWidth="0.1" fill="none" opacity="0.3" />
          ))}
          <circle cx="50" cy="50" r="12" fill="#a855f7" opacity="0.4" />
          <circle cx="50" cy="50" r="2" fill="black" />
        </svg>
      </motion.div>
      <motion.div className="absolute bottom-[-10%] left-[-5%] w-48 h-48 border border-purple-500/10 rounded-full" animate={{ scale: [1, 1.3, 1], opacity: [0.1, 0.3, 0.1] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} />
      <motion.div style={{ y: yMoon }} className="absolute top-[-10px] left-[15%] w-32 h-32 bg-purple-500/10 rounded-full blur-[50px]" />
      <motion.svg style={{ y: y1 }} className="absolute bottom-0 w-full h-[50%] opacity-20" viewBox="0 0 100 100" preserveAspectRatio="none">
        <motion.path d="M0 50 Q 25 40, 50 50 T 100 50 V 100 H 0 Z" fill="currentColor" className="text-purple-300" animate={{ d: ["M0 50 Q 25 40, 50 50 T 100 50 V 100 H 0 Z", "M0 50 Q 25 60, 50 50 T 100 50 V 100 H 0 Z", "M0 50 Q 25 40, 50 50 T 100 50 V 100 H 0 Z"] }} transition={{ duration: 6, repeat: Infinity }} />
      </motion.svg>
      <FloatingItem x={30} delay={0} duration={20}><Music size={14}/></FloatingItem>
      <FloatingItem x={70} delay={5} duration={25}><Music size={18}/></FloatingItem>
    </div>
  );
};

const MoviesAnimatedBackground = ({ isHovering }: { isHovering: boolean }) => {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start end", "end start"] });
  const ySky = useTransform(scrollYProgress, [0, 1], ["0px", "10px"]);
  return (
    <div ref={containerRef} className="absolute inset-0 bg-slate-950 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-blue-600/40 via-slate-950/20 to-slate-950 opacity-100" />
      <motion.div
        initial={{ x: -40, opacity: 0, rotate: -10 }}
        animate={{ 
          x: isHovering ? [0, 8, 0] : 0, 
          opacity: isHovering ? 0.65 : 0.45,
          rotate: isHovering ? [0, 4, 0] : [0, 2, 0]
        }}
        transition={{ 
          x: isHovering ? { duration: 5, repeat: Infinity, ease: "easeInOut" } : { duration: 0.8 },
          opacity: { duration: 0.8 },
          rotate: { duration: isHovering ? 5 : 8, repeat: Infinity, ease: "easeInOut" }
        }}
        className="absolute -left-20 top-1/2 -translate-y-1/2 w-96 h-96 blur-[0.5px] pointer-events-none z-0"
      >
        <svg viewBox="0 0 100 100" className="w-full h-full text-white/70">
          <circle cx="50" cy="50" r="48" stroke="currentColor" strokeWidth="1.2" fill="none" />
          <circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="0.5" fill="none" strokeDasharray="3 3" />
          <circle cx="50" cy="50" r="14" stroke="currentColor" strokeWidth="2" fill="none" />
          {[...Array(6)].map((_, i) => (
            <circle key={i} cx="50" cy="22" r="8" fill="currentColor" fillOpacity="0.6" transform={`rotate(${i * 60} 50 50)`} />
          ))}
          {[...Array(24)].map((_, i) => (
            <rect key={i} x="49" y="0" width="2" height="6" fill="currentColor" transform={`rotate(${i * 15} 50 50)`} />
          ))}
        </svg>
      </motion.div>
      <motion.div style={{ y: ySky }} className="absolute inset-0 opacity-20 blur-[80px]" animate={{ background: ["radial-gradient(circle at 20% 30%, #3b82f6 0%, transparent 50%)", "radial-gradient(circle at 80% 70%, #1d4ed8 0%, transparent 50%)", "radial-gradient(circle at 20% 30%, #3b82f6 0%, transparent 50%)"] }} transition={{ duration: 15, repeat: Infinity }} />
      {[...Array(3)].map((_, i) => (
        <motion.div key={i} className="absolute w-40 h-[1px] bg-gradient-to-r from-blue-400/10 to-transparent" style={{ top: 20 + i * 20 + "%", left: "-10%", rotate: -20, y: ySky }} animate={{ x: ["0%", "200%"], opacity: [0, 0.5, 0] }} transition={{ duration: 10 + i * 2, repeat: Infinity, delay: i * 3 }} />
      ))}
      {[...Array(3)].map((_, i) => (
        <motion.div key={i} className="absolute w-[120%] h-[120%] border-[2px] border-white/5 opacity-50 pointer-events-none" initial={{ x: "-20%", y: 20 + i * 20 + "%", rotate: 0 }} animate={{ x: "130%", rotate: 360 }} transition={{ duration: 15 + i * 5, repeat: Infinity, delay: i * 4, ease: "linear" }}>
          <div className="absolute inset-4 border-[1px] border-white/10" />
        </motion.div>
      ))}
      <FloatingItem x={40} delay={2} duration={22}><Film size={16}/></FloatingItem>
    </div>
  );
};

const BooksAnimatedBackground = ({ isHovering }: { isHovering: boolean }) => {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start end", "end start"] });
  const yDust = useTransform(scrollYProgress, [0, 1], ["0px", "15px"]);
  return (
    <div ref={containerRef} className="absolute inset-0 bg-slate-950 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-amber-600/30 via-slate-950/20 to-slate-950 opacity-100" />
      <motion.div 
        className="absolute right-[12%] top-1/2 -translate-y-1/2 pointer-events-none z-10 w-32 h-20 perspective-[1000px]"
        initial={{ rotate: -15 }}
        animate={{ 
          y: isHovering ? ["-50%", "-54%", "-50%"] : ["-50%", "-52%", "-50%"],
          x: isHovering ? [0, 15, -15, 0] : [0, 5, -5, 0],
          rotate: isHovering ? [-15, -12, -18, -15] : [-15, -14, -16, -15],
          opacity: isHovering ? 0.9 : 0.5
        }}
        transition={{ duration: isHovering ? 6 : 12, repeat: Infinity, ease: "easeInOut" }}
      >
        <motion.div className="absolute left-0 w-1/2 h-full bg-white/10 border border-white/20 rounded-l-[4px] origin-right backdrop-blur-[1px]" animate={{ rotateY: isHovering ? -35 : -25 }} style={{ transformStyle: "preserve-3d" }} />
        <motion.div className="absolute right-0 w-1/2 h-full bg-white/10 border border-white/20 rounded-r-[4px] origin-left backdrop-blur-[1px]" animate={{ rotateY: isHovering ? 35 : 25 }} style={{ transformStyle: "preserve-3d" }} />
        {[...Array(3)].map((_, i) => (
          <motion.div key={`page-${i}`} className="absolute left-1/2 w-[46%] h-[90%] top-[5%] bg-white/[0.06] border border-white/10 rounded-[2px] origin-left backdrop-blur-[1px] shadow-sm z-10" initial={{ rotateY: 25, opacity: 0 }} animate={{ rotateY: [25, -155], opacity: [0, 0.4, 0.4, 0], x: ["0px", "-2px", "0px"] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: i * 2 }} style={{ transformStyle: "preserve-3d" }} />
        ))}
        <div className="absolute left-1/2 -translate-x-1/2 inset-y-0 w-[3px] bg-white/40 blur-[1px] rounded-full z-20 shadow-[0_0_15px_white]" />
        <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-[6px] h-[4px] bg-amber-500/60 blur-[2px] rounded-full z-25" />
      </motion.div>
      <div className="absolute inset-0 opacity-[0.06] pointer-events-none flex items-end justify-around px-8 z-0">
        {[...Array(18)].map((_, i) => (
          <div key={i} className="bg-white/80 rounded-t-[1px]" style={{ width: (4 + (i % 3) * 2) + "px", height: (20 + (Math.sin(i * 1.8) * 15 + 15)) + "%", opacity: 0.2 + (i % 5) * 0.1 }} />
        ))}
      </div>
      {[...Array(6)].map((_, i) => (
        <motion.div key={i} className="absolute text-amber-100/15 font-serif select-none pointer-events-none" style={{ fontSize: 10 + (i * 2) + "px", y: yDust }} initial={{ x: (15 + i * 15) + "%", y: "110%", opacity: 0 }} animate={{ y: ["110%", "-20%"], opacity: [0, 0.4, 0] }} transition={{ duration: 25 + i * 4, repeat: Infinity, delay: i * 3 }}>
          {["A", "B", "C", "{}", "&", "¶"][i % 6]}
        </motion.div>
      ))}
      {[...Array(10)].map((_, i) => (
        <motion.div key={i} className="absolute w-[1px] h-[1px] bg-amber-100/30 rounded-full" initial={{ x: (Math.random() * 100) + "%", y: (Math.random() * 100) + "%" }} animate={{ y: ["0%", "100%"], opacity: [0, 0.4, 0] }} transition={{ duration: 8 + (i % 5) * 3, repeat: Infinity, delay: i * 0.8, ease: "linear" }} style={{ y: yDust }} />
      ))}
      <FloatingItem x={35} delay={1} duration={24}><BookOpen size={16}/></FloatingItem>
    </div>
  );
};

const GamesAnimatedBackground = ({ isHovering }: { isHovering: boolean }) => {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start end", "end start"] });
  const yScan = useTransform(scrollYProgress, [0, 1], ["0px", "20px"]);
  return (
    <div ref={containerRef} className="absolute inset-0 bg-slate-950 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-fuchsia-600/40 via-slate-950/20 to-slate-950 opacity-100" />
      <motion.div 
        className="absolute right-[10%] top-1/2 -translate-y-1/2 pointer-events-none z-10"
        initial={{ rotate: -15, x: 0 }}
        animate={{ 
          x: isHovering ? [0, 30, -30, 0] : [0, 10, -10, 0],
          y: isHovering ? ["-50%", "-54%", "-50%"] : ["-50%", "-52%", "-50%"],
          rotate: isHovering ? [-15, -10, -20, -15] : [-15, -13, -17, -15],
          opacity: isHovering ? 0.6 : 0.35
        }}
        transition={{ duration: isHovering ? 5 : 10, repeat: Infinity, ease: "easeInOut" }}
      >
        <svg width="120" height="95" viewBox="0 0 120 90">
          <path d="M20 70 Q 15 80, 25 85 Q 40 90, 60 70 Q 80 90, 95 85 Q 105 80, 100 70 L 105 30 Q 110 10, 60 10 Q 10 10, 15 30 Z" fill="white" fillOpacity="0.3" stroke="white" strokeWidth="1.5" />
          <motion.circle cx="45" cy="55" r="9" fill="black" fillOpacity="0.4" stroke="white" strokeWidth="0.5" animate={{ x: isHovering ? [-3, 3, -2, 4, 0] : 0, y: isHovering ? [-2, 2, 0, -3, 0] : 0 }} transition={{ duration: 2, repeat: Infinity }} />
          <motion.circle cx="75" cy="55" r="9" fill="black" fillOpacity="0.4" stroke="white" strokeWidth="0.5" animate={{ x: isHovering ? [3, -3, 4, -2, 0] : 0, y: isHovering ? [2, -2, 3, 0, 0] : 0 }} transition={{ duration: 2, repeat: Infinity, delay: 0.2 }} />
          <motion.circle cx="92" cy="33" r="4" fill="#f472b6" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity }} />
          <motion.circle cx="83" cy="42" r="4" fill="#ec4899" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.3 }} />
          <motion.circle cx="101" cy="42" r="4" fill="#ec4899" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.6 }} />
          <motion.circle cx="92" cy="51" r="4" fill="#f472b6" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.9 }} />
          <g opacity="0.6">
            <rect x="24" cy="38" width="12" height="4" fill="#38bdf8" rx="1" />
            <rect x="28" cy="34" width="4" height="12" fill="#38bdf8" rx="1" />
          </g>
        </svg>
      </motion.div>
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
      <motion.div style={{ translateY: yScan }} className="absolute inset-x-0 w-full h-[1px] bg-fuchsia-400/20 shadow-[0_0_15px_#f5d0fe] z-10" animate={{ top: ["-10%", "110%"] }} transition={{ duration: 6, repeat: Infinity, ease: "linear" }} />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[length:100%_4px] pointer-events-none" />
      <FloatingItem x={75} delay={3} duration={18}><Gamepad2 size={16}/></FloatingItem>
    </div>
  );
};

const GuidesAnimatedBackground = ({ isHovering }: { isHovering: boolean }) => {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start end", "end start"] });
  const yTranslate = useTransform(scrollYProgress, [0, 1], ["0px", "15px"]);
  return (
    <div ref={containerRef} className="absolute inset-0 bg-slate-950 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-amber-600/30 via-slate-950/20 to-slate-950 opacity-100" />
      <motion.div
        className="absolute right-[8%] top-1/2 -translate-y-1/2 pointer-events-none z-10"
        initial={{ rotate: 0, scale: 1 }}
        animate={{
          rotate: isHovering ? 90 : 0,
          scale: isHovering ? 1.05 : 1,
          opacity: isHovering ? 0.8 : 0.5
        }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
      >
        <svg width="85" height="85" viewBox="0 0 100 100" className="text-white/40">
          <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="1" fill="none" />
          <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="0.5" fill="none" strokeDasharray="2 2" />
          {[...Array(8)].map((_, i) => (
            <line
              key={i}
              x1="50"
              y1="8"
              x2="50"
              y2="14"
              stroke="currentColor"
              strokeWidth="1.5"
              transform={`rotate(${i * 45} 50 50)`}
            />
          ))}
          <motion.polygon
            points="50,18 54,50 50,82 46,50"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            animate={{
              rotate: isHovering ? [0, 12, -8, 4, 0] : [0, 3, -3, 0]
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            style={{ transformOrigin: "50px 50px" }}
          />
          <text x="50" y="28" fill="currentColor" fontSize="8" fontWeight="bold" textAnchor="middle">N</text>
        </svg>
      </motion.div>
      <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" style={{ y: yTranslate }}>
        <motion.path
          d="M -20 80 Q 20 20, 60 70 T 120 30"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="2"
          strokeDasharray="4 6"
          animate={{ strokeDashoffset: isHovering ? -20 : -10 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        />
        <circle cx="30" cy="40" r="3" fill="#f59e0b" className="animate-pulse" />
        <circle cx="70" cy="65" r="3" fill="#f59e0b" className="animate-pulse" />
      </svg>
      <FloatingItem x={20} delay={3} duration={22}><MapPin size={14} /></FloatingItem>
    </div>
  );
};

const CategoryBackground = ({ category, isHovering }: { category: CategoryKey, isHovering: boolean }) => {
  switch (category) {
    case "places": return <PlacesAnimatedBackground />;
    case "music":  return <MusicAnimatedBackground isHovering={isHovering} />;
    case "movies": return <MoviesAnimatedBackground isHovering={isHovering} />;
    case "books":  return <BooksAnimatedBackground isHovering={isHovering} />;
    case "games":  return <GamesAnimatedBackground isHovering={isHovering} />;
    case "guides": return <GuidesAnimatedBackground isHovering={isHovering} />;
    default:       return null;
  }
};

const CelestialSparkle = () => {
  return (
    <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
      {[...Array(6)].map((_, i) => (
        <motion.div key={i} className="absolute w-1 h-1 bg-white rounded-full blur-[0.5px]" initial={{ x: (Math.random() * 100) + "%", y: (Math.random() * 100) + "%", opacity: 0, scale: 0 }} animate={{ opacity: [0, 0.4, 0], scale: [0, 1, 0] }} transition={{ duration: 2 + Math.random() * 3, repeat: Infinity, delay: Math.random() * 5, ease: "easeInOut" }} />
      ))}
    </div>
  );
};

const AmbientParticles = () => {
  return (
    <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
      {[...Array(8)].map((_, i) => (
        <motion.div key={i} className="absolute w-[2px] h-[2px] bg-white/30 rounded-full blur-[1px]" initial={{ x: Math.random() * 100 + "%", y: Math.random() * 100 + "%", opacity: 0 }} animate={{ x: ["0%", "100%"], opacity: [0, 0.3, 0] }} transition={{ duration: 10 + Math.random() * 10, repeat: Infinity, delay: Math.random() * 5, ease: "linear" }} />
      ))}
    </div>
  );
};

const LightSweep = () => {
  return (
    <motion.div className="absolute inset-0 z-10 pointer-events-none" initial={{ x: "-100%" }} animate={{ x: "200%" }} transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 6, ease: "easeInOut" }} style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)", transform: "skewX(-20deg)" }} />
  );
};

const getHexColor = (color: string) => {
  switch (color) {
    case "emerald": return "#10b981";
    case "purple":  return "#a855f7";
    case "blue":    return "#3b82f6";
    case "orange":  return "#f97316";
    case "pink":    return "#ec4899";
    case "amber":   return "#f59e0b";
    default:        return "#ffffff";
  }
};

const RecommendationCard = ({ cat }: { cat: CategoryConfig }) => {
  const navigate = useNavigate();
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const accentColor = getHexColor(cat.color);

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onClick={() => navigate(cat.path)}
      className="relative w-full h-[150px] overflow-hidden rounded-2xl md:rounded-[1.5rem] cursor-pointer group bg-slate-900/90 shadow-xl"
    >
      <div className="absolute inset-0 w-full h-full z-10">
        <CategoryBackground category={cat.key} isHovering={isHovering} />
      </div>
      <motion.div className="absolute inset-0 pointer-events-none z-10" animate={{ background: isHovering ? `radial-gradient(400px circle at ${mousePos.x}px ${mousePos.y}px, ${accentColor}15, transparent 80%)` : `radial-gradient(400px circle at 50% 50%, transparent, transparent)` }} transition={{ duration: 0.3 }} />
      <div className="absolute inset-0 pointer-events-none opacity-20 z-0" style={{ background: `linear-gradient(225deg, ${accentColor}30 0%, transparent 40%)` }} />
      <LightSweep />
      <CelestialSparkle />
      <AmbientParticles />
      <AmbientMotion category={cat.key} />
      <motion.div className="absolute inset-0 bg-white/5 opacity-0 z-0 pointer-events-none" animate={{ opacity: [0.01, 0.08, 0.01] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} />
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent transition-all duration-500 z-5" />
      <div className="absolute inset-0 z-10">
        <div className="absolute inset-y-0 left-0 w-3/4 backdrop-blur-md" style={{ maskImage: "linear-gradient(to right, black 50%, transparent 100%)", WebkitMaskImage: "linear-gradient(to right, black 50%, transparent 100%)" }} />
      </div>

      <div className="absolute inset-0 p-6 md:p-8 flex items-center z-20">
        <div className="flex flex-col min-w-0">
          <h3 className="text-3xl md:text-4xl font-black text-white tracking-tighter leading-none uppercase group-hover:scale-105 transition-transform origin-left">
            {cat.label}
          </h3>
          <p className="text-white/70 text-[10px] md:text-xs font-semibold tracking-wide mt-2 line-clamp-2 group-hover:text-white transition-colors max-w-[85%]">
            {cat.description}
          </p>
          <motion.div className="h-0.5 mt-3 bg-white/20 rounded-full overflow-hidden" initial={{ width: 0 }} whileHover={{ width: "120px" }} transition={{ duration: 0.6 }}>
            <div className="w-full h-full animate-progress" style={{ backgroundColor: accentColor }} />
          </motion.div>
        </div>
        <div className="ml-auto opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300 shrink-0">
          <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white">
            <ChevronRight size={20} />
          </div>
        </div>
      </div>

      {cat.key === "music" ? (
        <div className="absolute bottom-0 left-0 right-0 h-12 flex items-end px-0 opacity-40 z-30 overflow-hidden pointer-events-none">
          {[...Array(40)].map((_, i) => (
            <motion.div key={i} className="flex-1 mx-[0.5px] rounded-t-[2px]" style={{ backgroundColor: accentColor }} animate={{ height: isHovering ? [(Math.random() * 40 + 40) + "%", (Math.random() * 40 + 60) + "%", (Math.random() * 40 + 40) + "%"] : [(Math.random() * 10 + 10) + "%", (Math.random() * 20 + 15) + "%", (Math.random() * 10 + 10) + "%"] }} transition={{ duration: 1.5 + Math.random() * 1.5, repeat: Infinity, ease: "easeInOut", delay: i * 0.04 }} />
          ))}
        </div>
      ) : cat.key === "movies" ? (
        <div className="absolute bottom-0 left-0 right-0 h-5 flex items-center opacity-70 z-30 overflow-hidden pointer-events-none border-t border-white/20 bg-black/40">
          <motion.div className="flex gap-1" animate={{ x: ["0%", "-33.3%"] }} transition={{ duration: 12, repeat: Infinity, ease: "linear" }}>
            {[...Array(25)].map((_, i) => (
              <div key={i} className="w-16 h-4 border-x border-white/30 shrink-0 flex items-center justify-center">
                <div className="w-4 h-1.5 bg-white/60 rounded-[1px]" />
              </div>
            ))}
          </motion.div>
          <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent" animate={{ opacity: isHovering ? 1 : 0 }} />
          <div className="absolute inset-0 shadow-[inset_0_0_15px_rgba(255,255,255,0.15)]" />
        </div>
      ) : cat.key === "books" ? (
        <div className="absolute bottom-0 left-0 right-0 h-3 flex flex-col justify-end gap-[1px] opacity-60 z-30 pointer-events-none p-0.5">
          {[...Array(3)].map((_, i) => (
            <motion.div key={i} className="h-[1px] w-full bg-amber-200/40" animate={{ opacity: isHovering ? [0.4, 0.9, 0.4] : 0.4 }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }} />
          ))}
          <div className="h-0.5 w-full bg-amber-600/40" style={{ width: isHovering ? "100%" : "40px", transition: "width 0.8s" }} />
        </div>
      ) : cat.key === "guides" ? (
        <div className="absolute bottom-0 left-0 right-0 h-4 flex items-center opacity-70 z-30 overflow-hidden pointer-events-none px-4">
          <motion.div className="w-full h-[2px] bg-amber-500/20 rounded-full relative">
            <motion.div 
              className="absolute inset-y-0 left-0 bg-amber-500 shadow-[0_0_10px_#f59e0b]" 
              animate={{ 
                left: isHovering ? ["0%", "85%", "0%"] : ["10%", "40%", "10%"] 
              }} 
              transition={{ duration: isHovering ? 2 : 4, repeat: Infinity, ease: "easeInOut" }} 
              style={{ width: "15%" }}
            />
          </motion.div>
        </div>
      ) : cat.key === "games" ? (
        <div className="absolute bottom-0 left-0 right-0 h-5 flex items-center opacity-70 z-30 overflow-hidden pointer-events-none px-2">
          <motion.div className="w-full h-1 bg-fuchsia-500/20 rounded-full relative" animate={{ opacity: isHovering ? 1 : 0.6 }}>
            <motion.div className="absolute inset-y-0 left-0 bg-fuchsia-500 shadow-[0_0_10px_#f5d0fe]" animate={{ width: isHovering ? ["0%", "100%", "0%"] : ["10%", "30%", "10%"] }} transition={{ duration: isHovering ? 2 : 4, repeat: Infinity, ease: "easeInOut" }} />
            {[...Array(10)].map((_, i) => (
               <motion.div key={i} className="absolute w-1 h-3 bg-fuchsia-300" style={{ left: (Math.random() * 100) + "%" }} animate={{ opacity: isHovering ? [0, 1, 0] : 0 }} transition={{ duration: 0.2, repeat: Infinity, delay: Math.random() }} />
            ))}
          </motion.div>
          <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_4px,rgba(255,255,255,0.05)_4px,rgba(255,255,255,0.05)_5px)]" />
        </div>
      ) : (
        <motion.div className="absolute bottom-0 left-0 h-1 z-30" style={{ backgroundColor: accentColor }} initial={{ width: 0 }} animate={{ width: "40px" }} whileHover={{ width: "100%" }} transition={{ duration: 0.8 }} />
      )}
    </motion.div>
  );
};

// --- Main RecommendationsHub Component ---

const RecommendationsHub = () => {
  return (
    <div className="min-h-screen bg-dashboard-bg text-dashboard px-5 py-8 pb-24 max-w-lg mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black mb-2 tracking-tight text-white uppercase font-poppins">Recommendations</h1>
        <p className="text-sm text-dashboard-muted leading-relaxed font-medium">
          Manage and share your curated lists of locations, movies, books, games and music.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5">
        {CATEGORIES.map(cat => (
          <RecommendationCard key={cat.key} cat={cat} />
        ))}
      </div>
    </div>
  );
};

export default RecommendationsHub;
