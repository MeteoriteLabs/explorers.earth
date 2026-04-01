import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  MapPin, Music, Film, BookOpen, Gamepad2,
  ChevronRight
} from "lucide-react";

type CategoryKey = "places" | "music" | "movies" | "books" | "games";

interface CategoryConfig {
  key: CategoryKey;
  label: string;
  icon: React.ComponentType<any>;
  visibilityField: string;
  description: string;
  color: string;
  bgImages: string[];
}

const LivingIcon = ({ icon: Icon, category }: { icon: any, category: CategoryKey }) => {
  // Common animation variants
  const floating = {
    animate: {
      y: [0, -4, 0]
    },
    transition: { 
      duration: 3, 
      repeat: Infinity, 
      ease: "easeInOut" as const
    }
  };

  switch (category) {
    case "places":
      return (
        <motion.div {...floating}>
          <Icon size={24} />
        </motion.div>
      );
    case "music":
      return (
        <div className="relative flex items-center justify-center gap-[2px] h-6 w-6">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1 bg-white rounded-full"
              animate={{ height: ["20%", "70%", "20%"] }}
              transition={{ duration: 0.6 + i * 0.2, repeat: Infinity, ease: "easeInOut" }}
            />
          ))}
        </div>
      );
    case "movies":
      return (
        <div className="relative">
          <Icon size={24} />
          <motion.div 
            className="absolute inset-0 bg-blue-400/20 rounded-lg blur-lg"
            animate={{ opacity: [0, 0.5, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, times: [0, 0.1, 1] }}
          />
        </div>
      );
    case "books":
      return (
        <motion.div {...floating}>
          <Icon size={24} />
        </motion.div>
      );
    case "games":
      return (
        <div className="relative">
          <Icon size={24} />
          <motion.div 
            className="absolute top-1 left-2 w-1 h-1 bg-green-400 rounded-full"
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        </div>
      );
    default:
      return <Icon size={24} />;
  }
};

const AmbientMotion = ({ category }: { category: CategoryKey }) => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {/* Global Fluid Wave Animation */}
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

      {/* Category Specific Accents */}
      {category === "places" && (
        <motion.div 
          className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.05),transparent_70%)]"
          animate={{ x: [-50, 50], y: [-20, 20] }}
          transition={{ duration: 25, repeat: Infinity, repeatType: "mirror" }}
        />
      )}
      {category === "movies" && (
        <div className="absolute inset-0 bg-black/5 mix-blend-overlay">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-15 animate-pulse" />
        </div>
      )}
    </div>
  );
};

const CelestialSparkle = () => {
  return (
    <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-white rounded-full blur-[0.5px]"
          initial={{ 
            x: Math.random() * 100 + "%", 
            y: Math.random() * 100 + "%",
            opacity: 0,
            scale: 0 
          }}
          animate={{ 
            opacity: [0, 0.4, 0],
            scale: [0, 1, 0],
          }}
          transition={{ 
            duration: 2 + Math.random() * 3, 
            repeat: Infinity, 
            delay: Math.random() * 5,
            ease: "easeInOut"
          }}
        />
      ))}
    </div>
  );
};

const HorizontalGallery = ({ images }: { images: string[] }) => {
  const containerRef = useRef(null);
  
  // Create a tripled version of the images to ensure a gapless loop
  const loopedImages = [...images, ...images, ...images];

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  // X-movement driven by scroll (Multi-axis parallax)
  const x = useTransform(scrollYProgress, [0, 1], ["0%", "-33.3%"]);
  // Keep the existing Y parallax for vertical depth
  const y = useTransform(scrollYProgress, [0, 1], ["-5%", "5%"]);

  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full overflow-hidden">
      <motion.div 
        style={{ x, y, width: "300%", height: "130%", top: "-15%" }}
        className="absolute inset-0 flex"
      >
        {loopedImages.map((img, i) => (
          <div 
            key={i}
            className="h-full w-full bg-cover bg-center shrink-0 border-r border-black/20"
            style={{ backgroundImage: `url(${img})` }}
          />
        ))}
      </motion.div>
    </div>
  );
};

const CATEGORIES: CategoryConfig[] = [
  { 
    key: "places",  
    label: "Places",        
    icon: MapPin, 
    visibilityField: "public_recommendations",
    description: "Explore curated locations and favorite spots from around the world",
    color: "emerald",
    bgImages: [
      "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=2000",
      "https://images.unsplash.com/photo-1542224566-6e85f2e6772f?auto=format&fit=crop&q=80&w=2000",
      "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&q=80&w=2000"
    ]
  },
  { 
    key: "music",   
    label: "Music",         
    icon: Music, 
    visibilityField: "public_music",
    description: "Discover shared playlists and local tunes that define the vibe",
    color: "purple",
    bgImages: [
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=2000",
      "https://images.unsplash.com/photo-1493225255756-d9584f8606e9?auto=format&fit=crop&q=80&w=2000",
      "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=2000"
    ]
  },
  { 
    key: "movies",  
    label: "Movies & Shows", 
    icon: Film, 
    visibilityField: "public_movie",
    description: "Watch lists and cinematic recommendations for every mood",
    color: "blue",
    bgImages: [
      "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&q=80&w=2000",
      "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&q=80&w=2000",
      "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&q=80&w=2000"
    ]
  },
  { 
    key: "books",   
    label: "Books",         
    icon: BookOpen, 
    visibilityField: "public_books",
    description: "Literary picks and reading collections from classic to modern",
    color: "orange",
    bgImages: [
      "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&q=80&w=2000",
      "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&q=80&w=2000",
      "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=2000"
    ]
  },
  { 
    key: "games",   
    label: "Games",         
    icon: Gamepad2, 
    visibilityField: "public_games",
    description: "Gaming favorites and latest discoveries in the digital world",
    color: "pink",
    bgImages: [
      "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&q=80&w=2000",
      "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=2000",
      "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=2000"
    ]
  },
];

interface ProfileRecommendationsTabProps {
  accountData: {
    documentId?: string;
    public_recommendations?: string;
    public_music?: string;
    public_movie?: string;
    public_books?: string;
    public_games?: string;
  };
  username: string;
}

const AmbientParticles = () => {
  return (
    <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-[2px] h-[2px] bg-white/30 rounded-full blur-[1px]"
          initial={{ 
            x: Math.random() * 100 + "%", 
            y: Math.random() * 100 + "%",
            opacity: 0,
          }}
          animate={{ 
            x: ["0%", "100%"],
            opacity: [0, 0.3, 0],
          }}
          transition={{ 
            duration: 10 + Math.random() * 10, 
            repeat: Infinity, 
            delay: Math.random() * 5,
            ease: "linear"
          }}
        />
      ))}
    </div>
  );
};

const LightSweep = () => {
  return (
    <motion.div 
      className="absolute inset-0 z-10 pointer-events-none"
      initial={{ x: "-100%" }}
      animate={{ x: "200%" }}
      transition={{ 
        duration: 2.5, 
        repeat: Infinity, 
        repeatDelay: 6, 
        ease: "easeInOut" 
      }}
      style={{
        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
        transform: "skewX(-20deg)"
      }}
    />
  );
};

const RecommendationCard = ({ cat, username }: { cat: CategoryConfig; username: string }) => {
  const navigate = useNavigate();
  const cardRef = useRef<HTMLDivElement>(null);
  
  // Mouse position for Dynamic Aura
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const accentColor = getHexColor(cat.color);

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-20px" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onClick={() => navigate(`/${username}/${cat.key}`)}
      className="relative w-full h-[150px] md:h-[170px] overflow-hidden rounded-2xl md:rounded-[1.5rem] cursor-pointer group bg-slate-900/90"
    >
      {/* Background Image Container with Infinite Horizontal Scroll */}
      <div className="absolute inset-0 w-full h-full">
        <HorizontalGallery images={cat.bgImages} />
      </div>

      {/* Dynamic Aura (Flashlight effect) */}
      <motion.div
        className="absolute inset-0 pointer-events-none z-10"
        animate={{
          background: isHovering 
            ? `radial-gradient(400px circle at ${mousePos.x}px ${mousePos.y}px, ${accentColor}15, transparent 80%)`
            : `radial-gradient(400px circle at 50% 50%, transparent, transparent)`
        }}
        transition={{ duration: 0.3 }}
      />

      {/* Color Leak Gradient */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20 z-0"
        style={{ background: `linear-gradient(225deg, ${accentColor}30 0%, transparent 40%)` }}
      />

      {/* Light Sweep (Glass shine) */}
      <LightSweep />

      {/* Celestial Sparkle & Ambient Particles */}
      <CelestialSparkle />
      <AmbientParticles />

      {/* Ambient Motion Effects */}
      <AmbientMotion category={cat.key} />

      {/* Breathing Glow Layer (State-of-the-art dim/brighten cycle) */}
      <motion.div 
        className="absolute inset-0 bg-white/5 opacity-0 z-0 pointer-events-none"
        animate={{ opacity: [0.01, 0.08, 0.01] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Overlays and Blur Effects */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent transition-all duration-500 z-10" />
      
      {/* Sophisticated Masked Blur on the left */}
      <div className="absolute inset-0 z-10">
        <div 
          className="absolute inset-y-0 left-0 w-3/4 backdrop-blur-md" 
          style={{ 
            maskImage: "linear-gradient(to right, black 50%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to right, black 50%, transparent 100%)"
          }}
        />
      </div>

      {/* Content */}
      <div className="absolute inset-0 p-6 flex items-center z-20">
        <div className="flex items-center gap-4 w-full">
          <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-xl text-white border border-white/20 group-hover:bg-white/20 transition-all shrink-0">
            <LivingIcon icon={cat.icon} category={cat.key} />
          </div>
          <div className="flex flex-col min-w-0">
            <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight leading-none uppercase">
              {cat.label}
            </h3>
            <p className="text-white/60 text-[10px] md:text-xs font-medium tracking-wide mt-2 line-clamp-2 group-hover:text-white transition-colors">
              {cat.description}
            </p>
            {/* Story Reveal Element */}
            <motion.div 
              className="h-0.5 mt-2 bg-white/30 rounded-full overflow-hidden"
              initial={{ width: 0 }}
              whileHover={{ width: "100px" }}
              transition={{ duration: 0.6 }}
            >
              <div className="w-full h-full animate-progress" style={{ backgroundColor: accentColor }} />
            </motion.div>
          </div>

          {/* Action Indicator */}
          <div className="ml-auto opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300">
            <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white">
              <ChevronRight size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* Signature Animated Accent */}
      <motion.div 
        className="absolute bottom-0 left-0 h-1 z-30" 
        style={{ backgroundColor: accentColor }}
        initial={{ width: 0 }}
        whileInView={{ width: "40px" }}
        whileHover={{ width: "100%" }}
        transition={{ duration: 0.8 }}
      />
    </motion.div>
  );
};

const getHexColor = (color: string) => {
  switch (color) {
    case "emerald": return "#10b981";
    case "purple":  return "#a855f7";
    case "blue":    return "#3b82f6";
    case "orange":  return "#f97316";
    case "pink":    return "#ec4899";
    default:        return "#ffffff";
  }
};

const ProfileRecommendationsTab = ({ accountData, username }: ProfileRecommendationsTabProps) => {
  // Determine which categories are visible
  const visibleCategories = useMemo(() => {
    return CATEGORIES.filter(cat => {
      const field = cat.visibilityField as keyof typeof accountData;
      const value = accountData[field];
      // Default visible if not set (for places/recommendations)
      if (cat.key === "places") {
        return value === "Yes" || value === undefined || value === null;
      }
      return value === "Yes";
    });
  }, [accountData]);

  if (visibleCategories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-4">
          <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7 text-white/30" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
        </div>
        <p className="text-white/40 font-medium">No recommendations visible</p>
        <p className="text-white/25 text-sm mt-1">The user hasn't enabled any recommendation categories</p>
      </div>
    );
  }

  return (
    <div className="pt-2 pb-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 pb-4">
        {visibleCategories.map(cat => (
          <RecommendationCard key={cat.key} cat={cat} username={username} />
        ))}
      </div>
    </div>
  );
};

export default ProfileRecommendationsTab;
