import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Image, Grid3x3, Film, BookOpen, Gamepad2, Navigation, BookMarked, User, Music2, Gamepad, Globe, ExternalLink, ChevronRight, Star, Search, Instagram, ListMusic, RotateCcw, Smartphone } from 'lucide-react';

// Phase A — via Instagram link:
//  0: Instagram profile (link visible)          2800ms
//  1: Link highlighted + pulsing               1000ms
//  2: Zoom into link (expansion)               1000ms
//  3: Explorer overview                        2200ms
//  4: Places page                              1800ms
//  5: Guides page                              1800ms
//  6: Music page                               1800ms
//  7: Movies page                              1800ms
//  8: Books page                               1800ms
//  9: Games page                               1800ms
// 10: Gallery                                  1800ms
// Phase B — via QR code:
// 11: QR code scan animation                   2200ms
// 12: Zoom into QR (expansion)                 1000ms
// 13: Explorer overview (QR entry)             2200ms
// 14: Places page                              1800ms
// 15: Guides page                              1800ms
// 16: Music page                               1800ms
// 17: Movies page                              1800ms
// 18: Books page                               1800ms
// 19: Games page                               1800ms
// 20: Gallery                                  1800ms
// → loop
const STAGES = [2800,1000,1000,2200,1800,1800,1800,1800,1800,1800,1800,2200,1000,2200,1800,1800,1800,1800,1800,1800,1800];

const GRID_IMGS = [
  '/landing/Paris.jpg', '/landing/Bali.jpg', '/landing/Kyoto.jpg',
  '/landing/Eiffel_Tower.jpg', '/landing/Louvre_Museum.jpg', '/landing/Paris.jpg',
  '/landing/Bali.jpg', '/landing/Kyoto.jpg', '/landing/Eiffel_Tower.jpg',
];

const HIGHLIGHTS = ['Paris 🗼','Bali 🌴','Kyoto 🏯','Patagonia 🏔️','Morocco 🕌'];

const footerTabs = [
  { id:'Places', Icon:Navigation, label:'Places' },
  { id:'Guides', Icon:BookMarked, label:'Guides' },
  { id:'profile',Icon:User,       label:'Profile'},
  { id:'Music',  Icon:Music2,     label:'Music'  },
  { id:'Movies', Icon:Film,       label:'Movies' },
  { id:'Books',  Icon:BookOpen,   label:'Books'  },
  { id:'Games',  Icon:Gamepad,    label:'Games'  },
];

// ── Instagram profile ──
function InstaProfile({ linkHighlighted }: { linkHighlighted: boolean }) {
  return (
    <div className="flex flex-col h-full bg-black text-white overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border border-white/40 rounded-sm flex items-center justify-center">
            <div className="w-1.5 h-1.5 border-l border-b border-white/40 -rotate-45 translate-x-px" />
          </div>
          <span className="text-[11px] font-bold tracking-tight">marcopolo.explores</span>
          <div className="w-3 h-3 rounded-full bg-blue-500 flex items-center justify-center">
            <span className="text-[5px] text-white font-bold">✓</span>
          </div>
        </div>
        <div className="flex gap-3 text-white/70">
          <span className="text-[10px]">＋</span>
          <span className="text-[10px]">☰</span>
        </div>
      </div>

      {/* Profile section */}
      <div className="px-3 shrink-0">
        <div className="flex items-center gap-4 mb-2">
          {/* Avatar with gradient ring */}
          <div className="p-[2px] rounded-full shrink-0" style={{ background: 'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)' }}>
            <div className="w-14 h-14 rounded-full border-2 border-black overflow-hidden">
              <img src="/landing/marco_polo.jpg" alt="Marco" className="w-full h-full object-cover" />
            </div>
          </div>
          {/* Stats */}
          <div className="flex gap-4 flex-1 justify-around">
            {[['847','Posts'],['248K','Followers'],['892','Following']].map(([n,l])=>(
              <div key={l} className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-white">{n}</span>
                <span className="text-[8px] text-gray-400">{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bio */}
        <div className="mb-2">
          <p className="text-[9px] font-semibold text-white">Marco Polo ✈️</p>
          <p className="text-[8px] text-gray-300 leading-relaxed">Explorer & Travel Photographer</p>
          <p className="text-[8px] text-gray-300">🌍 47 countries · Hidden gems hunter</p>
          <p className="text-[8px] text-gray-300 mb-1">📍 Currently: Kyoto, Japan</p>

          {/* Explorers link — the key element */}
          <motion.div
            animate={linkHighlighted ? { scale:[1,1.06,1.04], backgroundColor:['rgba(52,152,219,0)', 'rgba(52,152,219,0.18)', 'rgba(52,152,219,0.22)'] } : {}}
            transition={{ duration: 0.5, repeat: linkHighlighted ? Infinity : 0 }}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 w-fit"
            style={linkHighlighted ? { border:'1px solid rgba(52,152,219,0.5)' } : {}}
          >
            <Globe size={8} className="text-[#3498DB] shrink-0" />
            <span className="text-[8px] font-semibold" style={{ color:'#3498DB' }}>
              explorers.earth/marcopolo
            </span>
            {linkHighlighted && <ExternalLink size={7} className="text-[#3498DB]" />}
          </motion.div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mb-3">
          {['Follow','Message','▾'].map((b,i)=>(
            <button key={b} className={`${i<2?'flex-1':''} py-1 rounded-lg text-[8px] font-semibold ${i===0?'bg-[#3498DB] text-white':i===1?'bg-[#262626] text-white border border-white/10':'bg-[#262626] text-white border border-white/10 px-2'}`}>{b}</button>
          ))}
        </div>

        {/* Highlights */}
        <div className="flex gap-3 pb-2 overflow-x-auto">
          {HIGHLIGHTS.map(h=>(
            <div key={h} className="flex flex-col items-center gap-1 shrink-0">
              <div className="w-10 h-10 rounded-full border border-gray-700 overflow-hidden bg-gray-800 flex items-center justify-center">
                <span className="text-[14px]">{h.split(' ')[1]||'🌍'}</span>
              </div>
              <span className="text-[6px] text-gray-400 truncate w-10 text-center">{h.split(' ')[0]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-t border-white/10 shrink-0">
        {[{Icon:Grid3x3,active:true},{Icon:Image,active:false},{Icon:User,active:false}].map(({Icon,active},i)=>(
          <div key={i} className={`flex-1 flex items-center justify-center py-2 ${active?'border-t border-white':'border-t border-transparent'}`}>
            <Icon size={14} className={active?'text-white':'text-gray-600'} />
          </div>
        ))}
      </div>

      {/* Photo grid */}
      <div className="grid grid-cols-3 gap-px flex-1 overflow-y-auto">
        {GRID_IMGS.map((src,i)=>(
          <div key={i} className="relative overflow-hidden aspect-square">
            <img src={src} alt="" className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Zoom transition frame ──
function ZoomTransition({ text }: { text: string }) {
  return (
    <div className="flex flex-col h-full bg-black items-center justify-center overflow-hidden">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: [1, 2, 8], opacity: [1, 1, 0] }}
        transition={{ duration: 1, ease: 'easeIn' }}
        className="bg-[#3498DB]/20 border border-[#3498DB]/60 rounded-lg px-6 py-3 flex items-center gap-3"
      >
        <Globe size={16} className="text-[#3498DB]" />
        <span className="text-sm font-bold text-[#3498DB] whitespace-nowrap">{text}</span>
      </motion.div>
    </div>
  );
}

// ── Explorer profile overview ──
function ExplorerOverview() {
  const [activeTab, setActiveTab] = useState<'rec' | 'feed' | 'send'>('rec');

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-[#0a0e14] font-poppins">
      <div className="flex-1 overflow-y-auto hide-scrollbar">
        {/* Header section - Maximum reduction */}
        <div className="relative pt-3 pb-1 px-6 flex flex-col items-center shrink-0">
          <div className="absolute top-0 inset-x-0 h-20">
            <img src="/landing/Paris.jpg" alt="Cover" className="w-full h-full object-cover opacity-10" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e14] to-transparent" />
          </div>

          <div className="relative z-10 flex flex-col items-center">
            <div className="w-12 h-12 rounded-full border-[2px] border-green-400 p-0.5 overflow-hidden shadow-2xl mb-1.5">
              <img src="/landing/marco_polo.jpg" alt="Avatar" className="w-full h-full rounded-full object-cover" />
            </div>
            <h2 className="text-white text-xs font-black tracking-tight mb-0">Marco Polo</h2>
            <div className="flex items-center gap-1 text-white/40 text-[7px] mb-1.5">
              <Navigation size={6} className="fill-white/10" />
              <span>Kyoto, Japan</span>
            </div>
            
            <div className="flex items-center gap-3 mb-2">
              <Instagram size={10} className="text-white/60" />
              <Globe size={10} className="text-white/60" />
              <Film size={10} className="text-white/60" />
            </div>

            <p className="text-white/40 text-[7.5px] text-center max-w-[220px] leading-tight mb-2 font-medium">
              Explorer & Storyteller documenting the Silk Road.
            </p>

            {/* Tab switch */}
            <div className="flex items-center gap-8 mb-2 pb-0.5 border-b border-white/5">
              <button onClick={() => setActiveTab('rec')} className={`pb-1 relative ${activeTab==='rec'?'text-white':'text-white/30'}`}>
                <Heart size={12} fill={activeTab==='rec'?'currentColor':'none'} />
                {activeTab==='rec' && <motion.div layoutId="t-line" className="absolute bottom-0 inset-x-0 h-0.5 bg-blue-400 rounded-full" />}
              </button>
              <button onClick={() => setActiveTab('feed')} className={`pb-1 relative ${activeTab==='feed'?'text-white':'text-white/30'}`}>
                <Grid3x3 size={12} />
                {activeTab==='feed' && <motion.div layoutId="t-line" className="absolute bottom-0 inset-x-0 h-0.5 bg-blue-400 rounded-full" />}
              </button>
              <button className="pb-1 text-white/30"><Navigation size={12} className="rotate-45" /></button>
            </div>
          </div>

          <div className="w-full px-2">
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                {/* PLACES */}
                <div className="h-[52px] rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 p-2 border border-white/10 flex flex-col justify-center overflow-hidden relative shrink-0 shadow-lg">
                  <h3 className="text-[11px] font-black text-white tracking-tighter uppercase leading-none mb-0.5">PLACES</h3>
                  <p className="text-[6px] text-white/60 leading-tight font-bold">Curated locations</p>
                  <div className="absolute top-1 right-2 w-8 h-8 bg-white/5 rounded-full blur-md" />
                </div>
                {/* MUSIC */}
                <div className="h-[52px] rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 p-2 border border-white/10 flex flex-col justify-center overflow-hidden relative shrink-0 shadow-lg">
                  <h3 className="text-[11px] font-black text-white tracking-tighter uppercase leading-none mb-0.5">Music</h3>
                  <p className="text-[6px] text-white/60 leading-tight font-bold">Local vibes</p>
                  <div className="absolute bottom-1 right-2 flex items-end gap-0.5 h-3">
                    {[...Array(6)].map((_,i)=><div key={i} className="w-0.5 bg-white/30 rounded-full" style={{height: `${40+Math.random()*60}%`}} />)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* MOVIES */}
                <div className="h-[52px] rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 p-2 border border-white/10 flex flex-col justify-center overflow-hidden relative shrink-0 shadow-lg">
                  <h3 className="text-[11px] font-black text-white tracking-tighter uppercase leading-none mb-0.5">Movies</h3>
                  <p className="text-[6px] text-white/60 leading-tight font-bold">Cinematic picks</p>
                  <div className="absolute bottom-1 right-2 w-full h-0.5 border-y border-white/10" />
                </div>
                {/* BOOKS */}
                <div className="h-[52px] rounded-xl bg-gradient-to-br from-orange-600 to-orange-800 p-2 border border-white/10 flex flex-col justify-center overflow-hidden relative shrink-0 shadow-lg">
                  <h3 className="text-[11px] font-black text-white tracking-tighter uppercase leading-none mb-0.5">Books</h3>
                  <p className="text-[6px] text-white/60 leading-tight font-bold">Literary collections</p>
                  <BookOpen className="absolute bottom-1 right-1 text-white/10" size={16} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* GAMES */}
                <div className="h-[52px] rounded-xl bg-gradient-to-br from-fuchsia-600 to-fuchsia-800 p-2 border border-white/10 flex flex-col justify-center overflow-hidden relative shrink-0 shadow-lg">
                  <h3 className="text-[11px] font-black text-white tracking-tighter uppercase leading-none mb-0.5">Games</h3>
                  <p className="text-[6px] text-white/60 leading-tight font-bold">Latest discoveries</p>
                  <Gamepad2 className="absolute top-1/2 right-4 -translate-y-1/2 text-white/10 rotate-12" size={20} />
                </div>
                {/* EMPTY SLOT */}
                <div className="h-[52px]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Places page ──
function PlacesPage() {
  const cities = [{name:'Paris',img:'/landing/Paris.jpg',active:true},{name:'Bali',img:'/landing/Bali.jpg',active:false},{name:'Kyoto',img:'/landing/Kyoto.jpg',active:false}];
  const places = [
    {name:'Eiffel Tower',cat:'Landmark',img:'/landing/Eiffel_Tower.jpg',r:4.9,d:'1.2km'},
    {name:'Louvre Museum',cat:'Culture',img:'/landing/Louvre_Museum.jpg',r:4.8,d:'2.5km'},
    {name:'Musée d\'Orsay',cat:'Culture',img:'/landing/Louvre_Museum.jpg',r:4.9,d:'1.8km'},
    {name:'Montmartre',cat:'District',img:'/landing/Paris.jpg',r:4.7,d:'4.0km'}
  ];
  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-[#0F1419]">
      {/* Header section */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between shrink-0">
        <h2 className="text-white text-base font-bold">Places</h2>
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[10px] text-gray-400 font-medium">
          Sort by: Trending <ChevronRight size={10} className="rotate-90"/>
        </div>
      </div>

      <div className="flex gap-4 px-4 pb-4 shrink-0 overflow-x-auto hide-scrollbar">
        {cities.map(c=>(
          <div key={c.name} className="flex flex-col items-center gap-1.5 shrink-0">
            <div className={`w-14 h-14 rounded-full overflow-hidden border-[3px] p-0.5 ${c.active?'border-green-400 shadow-[0_0_15px_rgba(74,222,128,0.3)]':'border-white/10'}`}>
              <img src={c.img} alt={c.name} className="w-full h-full rounded-full object-cover"/>
            </div>
            <span className={`text-[9px] font-bold tracking-tight ${c.active?'text-white':'text-gray-500'}`}>{c.name}</span>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white text-xs font-bold">My Recommendations</h3>
            <div className="flex gap-1.5">
              {['All','Culture','Food'].map((t,i)=>(
                <span key={t} className={`px-2 py-0.5 rounded-lg text-[8px] font-bold ${i===0?'bg-blue-500 text-white':'bg-white/5 text-gray-500 border border-white/5'}`}>{t}</span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {places.map((p,i)=>(
              <motion.div key={p.name} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*0.08}} className="bg-[#1a1f2e] rounded-2xl overflow-hidden border border-white/5 shadow-lg group">
                <div className="h-24 relative overflow-hidden">
                  <img src={p.img} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"/>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"/>
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                    <span className="text-[7px] text-white/60 font-medium">{p.d} away</span>
                    <div className="flex items-center gap-0.5 bg-black/40 backdrop-blur-md px-1.5 py-0.5 rounded-full border border-white/10">
                      <Star size={7} className="text-amber-400 fill-amber-400"/>
                      <span className="text-[7px] text-white font-bold">{p.r}</span>
                    </div>
                  </div>
                </div>
                <div className="p-2.5">
                  <p className="text-[10px] text-white font-bold leading-tight">{p.name}</p>
                  <p className="text-[8px] text-gray-500 mt-0.5">{p.cat} • Paris</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Guides page ──
function GuidesPage() {
  const guides = [
    {title:'Luxury Golden Triangle: Lucknow to Agra',loc:'Lucknow, Agra, Delhi',img:'/landing/Paris.jpg',days:3,likes:'1.2k',tags:['Lucknow','Agra']},
    {title:'Heritage Walk of Agra',loc:'Agra, India',img:'/landing/Bali.jpg',days:1,likes:842,tags:['History','Art']},
    {title:'Hidden Gems of Delhi',loc:'Delhi, India',img:'/landing/Kyoto.jpg',days:2,likes:324,tags:['Secret','Delhi']},
    {title:'Royal Lucknow Food Tour',loc:'Lucknow, India',img:'/landing/Eiffel_Tower.jpg',days:1,likes:512,tags:['Food','Royal']}
  ];
  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-[#0a0e14] font-poppins">
      <div className="px-4 pt-4 pb-2 shrink-0">
        <h1 className="text-xl font-black text-white mb-1 tracking-tight">Travel Guides</h1>
        <p className="text-[9px] text-white/40 font-medium tracking-tight mb-4">{guides.length} guides available</p>
        
        <div className="flex gap-2 mb-6">
          <button className="px-3 py-1.5 bg-blue-600 rounded-md text-[9px] font-bold text-white">All Locations</button>
          <button className="px-3 py-1.5 bg-white/5 text-white/60 border border-white/10 rounded-md text-[9px] font-bold">Agra</button>
          <button className="ml-auto p-1.5 px-3 border border-white/10 rounded-md text-[9px] font-bold text-white flex items-center gap-2">
            <Grid3x3 size={10} /> Filters
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar px-4 pb-10">
        <div className="grid grid-cols-2 gap-3">
          {guides.map((g,i)=>(
            <motion.div key={i} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*0.1}} className="flex flex-col group">
              <div className="aspect-[4/3] rounded-xl overflow-hidden relative border border-white/5 shadow-xl">
                <img src={g.img} alt={g.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/60 backdrop-blur-md rounded text-[7px] font-bold text-white flex items-center gap-1">
                  <BookMarked size={7} /> {g.days} Days
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                <div className="absolute bottom-2 left-2 right-2">
                  <h3 className="text-[9px] font-black text-white leading-tight line-clamp-2 mb-1.5 drop-shadow-lg">{g.title}</h3>
                  <div className="flex flex-wrap gap-1">
                    {g.tags.map(t=><span key={t} className="px-1 py-0.5 bg-white/10 backdrop-blur-md rounded text-[5px] font-bold text-white/70 tracking-tighter">{t}</span>)}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Category page (Movies/Games/Books) — 3-phase automated walkthrough ──
// Phase 0: Hero + list overview cards (static, no premature scroll)
// Phase 1: Drill into first list → show items in 2-col grid + Recommendations tab active
// Phase 2: Switch to Manage tab → show control dashboard
function CatPage({ label, data }: { label: string; data: any }) {
  const { topPick, lists } = data;
  // phase: 0 = home overview, 1 = list detail (recommendations), 2 = list detail (manage)
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    setPhase(0);
    const t1 = setTimeout(() => setPhase(1), 2800); // stay on home for 2.8s
    const t2 = setTimeout(() => setPhase(2), 5600); // show manage after 2.8s more
    const t3 = setTimeout(() => setPhase(0), 8400); // loop back
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [label]); // reset when category changes

  const firstList = lists[0];

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-[#0F1419] font-poppins">
      <AnimatePresence mode="wait">

        {/* ── Phase 0: Home overview ── */}
        {phase === 0 && (
          <motion.div key="home" initial={{ opacity: 0, x: 0 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.35 }} className="flex-1 overflow-y-auto hide-scrollbar pb-20">
            {/* Hero */}
            <section className="relative w-full h-[220px] bg-black overflow-hidden mb-5 shadow-2xl">
              <img src={topPick.img} alt={topPick.title} className="w-full h-full object-cover opacity-60" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0F1419] via-[#0F1419]/30 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#0F1419]/80 to-transparent" />
              <div className="absolute top-3 left-4">
                <span className="text-[9px] font-black text-yellow-400 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-1 h-3 bg-yellow-400 rounded-full inline-block" />Top Pick
                </span>
              </div>
              <div className="absolute inset-0 p-4 flex flex-col justify-end">
                <div className="flex items-end gap-3">
                  <div className="flex-1 min-w-0">
                    <h1 className="text-lg font-black text-white leading-tight mb-1 drop-shadow-lg">{topPick.title}</h1>
                    <div className="flex items-center gap-1.5 text-[7px] text-white/80 font-bold uppercase tracking-widest mb-2">
                      <span>{topPick.year}</span><span className="text-white/30">•</span>
                      <span>{topPick.genres.slice(0,2).join(" / ")}</span>
                    </div>
                    <button className="flex items-center gap-1 bg-[#3498DB] text-white text-[8px] font-black py-1 px-2.5 rounded-lg shadow-lg tracking-tight">
                      <Grid3x3 size={8} /> See Details
                    </button>
                  </div>
                  <div className="shrink-0 w-14 aspect-[3/4] rounded-lg border border-white/20 overflow-hidden shadow-2xl">
                    <img src={topPick.poster || topPick.img} alt="poster" className="w-full h-full object-cover" />
                  </div>
                </div>
              </div>
            </section>

            {/* Lists */}
            {lists.map((list: any) => (
              <section key={list.name} className="mb-6 px-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-0.5 h-4 bg-yellow-400 rounded-full" />
                    <h2 className="text-[11px] font-black text-white tracking-tight">{list.name}</h2>
                  </div>
                  <div className="flex items-center gap-1 text-blue-400">
                    <span className="text-[8px] font-black uppercase tracking-widest">See all</span>
                    <ChevronRight size={10} />
                  </div>
                </div>
                <div className="flex gap-3 overflow-x-auto hide-scrollbar -mx-4 px-4 pb-1">
                  {list.items.map((it: any, i: number) => (
                    <div key={i} className="flex-none w-[90px]">
                      <div className="aspect-[3/4] rounded-xl overflow-hidden mb-1.5 border border-white/5 shadow-lg">
                        <img src={it.img} alt={it.name} className="w-full h-full object-cover" />
                      </div>
                      <p className="text-[9px] font-bold text-white/90 truncate">{it.name}</p>
                      <p className="text-[7px] text-white/40 uppercase tracking-wider truncate">{it.meta}</p>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </motion.div>
        )}

        {/* ── Phase 1 & 2: List detail view ── */}
        {(phase === 1 || phase === 2) && (
          <motion.div key="detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.35 }} className="flex-1 flex flex-col overflow-hidden">
            {/* Detail header */}
            <div className="px-4 py-3 flex items-center gap-3 shrink-0 border-b border-white/5 bg-[#0F1419]">
              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                <ChevronRight size={12} className="text-white rotate-180" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-[11px] font-black text-white truncate">{firstList.name}</h2>
                <p className="text-[7px] text-white/40 uppercase tracking-widest font-bold">{firstList.items.length} items • {label}</p>
              </div>
            </div>

            {/* Recommendations / Manage tab switcher */}
            <div className="px-4 py-2.5 flex items-center justify-center shrink-0">
              <div className="flex items-center bg-white rounded-3xl shadow-sm p-0.5">
                {(['recommendations', 'manage'] as const).map((tab) => (
                  <button key={tab} className={`px-3.5 py-1 text-[8px] font-black rounded-2xl capitalize transition-all duration-300 ${
                    (tab === 'recommendations' && phase === 1) || (tab === 'manage' && phase === 2)
                      ? 'bg-[#3498DB] text-white shadow-md' : 'text-black'
                  }`}>
                    {tab === 'recommendations' ? 'Recommendations' : 'Manage'}
                  </button>
                ))}
              </div>
            </div>

            <AnimatePresence mode="wait">
              {/* Recommendations: 2-col grid of items */}
              {phase === 1 && (
                <motion.div key="items" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 overflow-y-auto hide-scrollbar px-4 pb-6">
                  <div className="grid grid-cols-2 gap-3">
                    {firstList.items.map((it: any, i: number) => (
                      <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                        className="bg-[#1a1f2e] rounded-2xl overflow-hidden border border-white/5 shadow-lg">
                        <div className="aspect-[4/3] relative overflow-hidden">
                          <img src={it.img} alt={it.name} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                          <div className="absolute bottom-2 left-2 right-2">
                            <p className="text-[8px] font-black text-white leading-tight truncate drop-shadow-md">{it.name}</p>
                          </div>
                        </div>
                        <div className="px-2.5 py-2">
                          <p className="text-[7px] text-white/40 uppercase tracking-widest font-bold truncate">{it.meta}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Manage tab: control dashboard */}
              {phase === 2 && (
                <motion.div key="manage" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 px-4 py-4 space-y-3 overflow-y-auto hide-scrollbar">
                  <div>
                    <p className="text-[10px] font-black text-white tracking-tight uppercase">Manage List</p>
                    <p className="text-[7px] text-white/40 uppercase tracking-[0.2em] font-bold mt-0.5">{firstList.name} • {firstList.items.length} items</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { label: 'Edit List', color: 'blue', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
                      { label: 'Share', color: 'green', icon: 'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z' },
                      { label: 'Draft', color: 'amber', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
                      { label: 'Delete', color: 'red', icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' },
                    ].map(({ label: lbl, color, icon }) => (
                      <motion.div key={lbl} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                        className={`${color === 'red' ? 'bg-red-500/10 border-red-500/20' : 'bg-[#1a1f2e] border-white/5'} border rounded-2xl p-4 flex flex-col items-center gap-2.5 shadow-xl`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          color === 'blue' ? 'bg-blue-500/10 text-blue-400' :
                          color === 'green' ? 'bg-green-500/10 text-green-400' :
                          color === 'amber' ? 'bg-amber-500/10 text-amber-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                          </svg>
                        </div>
                        <span className={`text-[9px] font-black uppercase tracking-tighter ${color === 'red' ? 'text-red-400' : 'text-white'}`}>{lbl}</span>
                      </motion.div>
                    ))}
                  </div>

                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-3.5 flex items-center justify-between shadow-lg">
                    <div>
                      <span className="text-[10px] font-black text-white uppercase tracking-tighter block">Visibility</span>
                      <span className="text-[7px] text-white/40 font-bold uppercase tracking-widest">Live on profile</span>
                    </div>
                    <div className="w-7 h-4 bg-blue-500 rounded-full relative shrink-0">
                      <div className="absolute right-0.5 top-0.5 bottom-0.5 aspect-square bg-white rounded-full shadow-sm" />
                    </div>
                  </div>

                  {/* Published status row */}
                  <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-3.5 flex items-center gap-3 shadow-lg">
                    <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-green-400 uppercase tracking-tight block">Published</span>
                      <span className="text-[7px] text-white/40 font-bold uppercase tracking-widest">Visible to all explorers</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Music Public Page (Production Accurate UI) ──
function MusicPublicPage() {
  const [activeLocTab, setActiveLocTab] = useState<'recommendations' | 'manage'>('recommendations');
  const tsImages = ['/landing/Paris.jpg', '/landing/Bali.jpg', '/landing/Kyoto.jpg', '/landing/Louvre_Museum.jpg', '/landing/Eiffel_Tower.jpg'];
  const [imgIdx, setImgIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setImgIdx(p => (p + 1) % tsImages.length), 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-black font-poppins">
      <div className="px-4 py-3 flex items-center justify-between shrink-0 bg-black/50 backdrop-blur-md z-10 border-b border-white/5">
        <h2 className="text-white text-[10px] font-black tracking-tight uppercase">Marco Polo</h2>
        <div className="flex gap-2">
          <div className="bg-white/5 px-2 py-1 rounded-md flex items-center gap-1.5 border border-white/10">
            <svg className="w-2.5 h-2.5 text-white/60" fill="currentColor" viewBox="0 0 24 24"><path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
            <span className="text-[7px] font-bold text-white uppercase tracking-tighter">Share</span>
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="px-4 py-3 flex items-center justify-center shrink-0">
        <div className="flex items-center bg-white rounded-3xl shadow-sm p-0.5">
          {(['recommendations', 'manage'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveLocTab(tab)}
              className={`px-4 py-1.5 text-[9px] font-bold rounded-2xl capitalize transition-all duration-300 ${
                activeLocTab === tab ? 'bg-[#3498DB] text-white shadow-md' : 'text-black'
              }`}
            >
              {tab === 'recommendations' ? 'Recommendations' : 'Manage'}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeLocTab === 'recommendations' ? (
          <motion.div key="recs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 overflow-y-auto hide-scrollbar p-4 space-y-4">
            {/* Featured Card */}
            <div className="flex flex-col items-center">
              <div className="w-48 aspect-video rounded-2xl overflow-hidden shadow-2xl mb-4 border border-white/10 relative">
                <AnimatePresence mode="wait">
                  <motion.img 
                    key={imgIdx}
                    src={tsImages[imgIdx]} 
                    initial={{ opacity: 0, scale: 1.1 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 1 }}
                    className="w-full h-full object-cover" 
                  />
                </AnimatePresence>
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              </div>
              <h1 className="text-base font-black text-white text-center leading-tight tracking-tight drop-shadow-md">Taylor Swift - The Eras Tour (Live)</h1>
              <p className="text-[9px] text-blue-400 font-black tracking-[0.2em] uppercase mt-1">Taylor Swift</p>
            </div>

            {/* Request a Song Card */}
            <div className="bg-[#1a1f2e] rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
               <div className="px-4 py-3 flex items-center justify-between border-b border-white/5 bg-white/[0.02]">
                  <div className="flex items-center gap-2">
                     <Search size={10} className="text-white/40" />
                     <span className="text-[9px] font-black text-white uppercase tracking-widest">Search</span>
                  </div>
                  <ChevronRight size={12} className="text-white/40 rotate-90" />
               </div>
               <div className="p-5 flex flex-col gap-4">
                  <div>
                     <h2 className="text-sm font-black text-white mb-1 tracking-tight">Request a Song</h2>
                     <p className="text-[8px] text-white/40 font-bold uppercase tracking-widest">Add to Marco's playlist</p>
                  </div>
                  <div className="relative">
                     <div className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-[9px] text-white/40 flex items-center gap-2">
                        <Search size={10} className="text-white/20" />
                        <span className="font-medium">Search for songs...</span>
                        <div className="ml-auto bg-blue-600/20 p-1 rounded shadow-inner">
                           <Search size={8} className="text-blue-400" />
                        </div>
                     </div>
                  </div>
                  <div className="flex flex-col items-center gap-3 py-4">
                     <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/20 border border-white/5 shadow-inner">
                        <Music2 size={18} />
                     </div>
                     <p className="text-[8px] text-white/40 text-center leading-relaxed font-bold uppercase tracking-widest">
                        Enter a song or artist name<br/>
                        <span className="text-white/10 italic text-[7px]">e.g. "Cruel Summer" or "Taylor Swift"</span>
                     </p>
                  </div>
               </div>
            </div>

            {/* Sections */}
            {['Queue', 'Recently Played', 'Play on Your Device'].map(label => (
              <div key={label} className="bg-[#1a1f2e] rounded-xl border border-white/5 px-4 py-3.5 flex items-center justify-between shadow-xl">
                 <div className="flex items-center gap-3">
                    <div className="w-4 h-4 text-white/40">
                      {label.includes('Queue') && <ListMusic size={14} />}
                      {label.includes('Recently') && <RotateCcw size={14} />}
                      {label.includes('Play') && <Smartphone size={14} />}
                    </div>
                    <span className="text-[9px] font-black text-white uppercase tracking-widest">{label}</span>
                 </div>
                 <ChevronRight size={12} className="text-white/40 rotate-90" />
              </div>
            ))}
          </motion.div>
        ) : (
          <motion.div key="manage" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 px-6 py-4 space-y-4">
            <div className="flex flex-col gap-1">
              <p className="text-xs font-black text-white tracking-tight uppercase">Music Settings</p>
              <p className="text-[8px] text-white/40 uppercase tracking-[0.2em] font-bold">Configure your music page</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#1a1f2e] border border-white/5 rounded-2xl p-4 flex flex-col items-center gap-3 shadow-xl">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </div>
                <span className="text-[9px] font-black text-white uppercase tracking-tighter">Edit Playlist</span>
              </div>
              <div className="bg-[#1a1f2e] border border-white/5 rounded-2xl p-4 flex flex-col items-center gap-3 shadow-xl">
                <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center text-green-400">
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                </div>
                <span className="text-[9px] font-black text-white uppercase tracking-tighter">Share Link</span>
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex items-center justify-between shadow-lg">
               <div className="flex flex-col">
                  <span className="text-[10px] font-black text-white uppercase tracking-tighter">Request Songs</span>
                  <span className="text-[8px] text-white/40 font-bold uppercase tracking-widest">Allow public requests</span>
               </div>
               <div className="w-7 h-4 bg-blue-500 rounded-full relative p-0.5">
                  <div className="absolute right-0.5 top-0.5 bottom-0.5 aspect-square bg-white rounded-full shadow-sm" />
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Gallery tab ──
function GalleryPage() {
  const feedCells = ['/landing/Paris.jpg','/landing/Bali.jpg','/landing/Kyoto.jpg','/landing/Eiffel_Tower.jpg','/landing/Louvre_Museum.jpg','/landing/Bali.jpg','/landing/Paris.jpg','/landing/Kyoto.jpg','/landing/Eiffel_Tower.jpg'];
  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-[#0F1419]">
      <div className="flex flex-col items-center pt-6 pb-4 shrink-0">
        <div className="w-20 h-20 rounded-full border-[4px] border-green-400 overflow-hidden ring-4 ring-black shadow-2xl mb-3">
          <img src="/landing/marco_polo.jpg" alt="Marco" className="w-full h-full object-cover"/>
        </div>
        <h2 className="text-white text-sm font-bold">Marco Polo</h2>
        <p className="text-gray-500 text-[9px] mt-1">explorers.earth/marcopolo</p>
      </div>
      
      <div className="px-4 mb-2 flex items-center justify-between">
        <p className="text-[10px] text-white font-bold uppercase tracking-wider">Feed</p>
        <div className="flex gap-2">
          <div className="w-4 h-4 rounded bg-white/10 flex items-center justify-center text-white/40"><Image size={10}/></div>
          <div className="w-4 h-4 rounded bg-transparent flex items-center justify-center text-white/20"><Film size={10}/></div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-0.5 overflow-y-auto hide-scrollbar px-0.5 pb-10">
        {feedCells.map((src,i)=>(
          <motion.div key={i} initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} transition={{delay:i*0.04}} className="aspect-square overflow-hidden bg-white/5 relative group">
            <img src={src} alt="" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"/>
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"/>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── QR scan ──
function QRScan() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center gap-4 px-6">
      <div className="relative w-28 h-36 bg-[#1a1f2e] rounded-2xl border border-white/10 flex items-center justify-center shadow-2xl overflow-hidden">
        <div className="absolute inset-4">
          {['top-0 left-0 border-t-2 border-l-2','top-0 right-0 border-t-2 border-r-2','bottom-0 left-0 border-b-2 border-l-2','bottom-0 right-0 border-b-2 border-r-2'].map((cls,i)=>(
            <div key={i} className={`absolute w-4 h-4 border-[#3498DB] ${cls}`}/>
          ))}
          <div className="grid grid-cols-7 gap-px w-full mt-2 opacity-60">
            {Array.from({length:49}).map((_,i)=>{
              const f=[0,1,2,3,4,5,6,7,14,21,28,35,42,43,44,45,46,47,48].includes(i);
              return <div key={i} className={`aspect-square rounded-[0.5px] ${f?'bg-white':'bg-white/10'}`}/>;
            })}
          </div>
        </div>
        <motion.div className="absolute left-4 right-4 h-px bg-[#3498DB] shadow-[0_0_8px_#3498DB]"
          animate={{top:['20%','80%','20%']}} transition={{duration:1.8,repeat:Infinity,ease:'easeInOut'}}/>
      </div>
      <div className="text-center">
        <p className="text-white text-[10px] font-semibold mb-1">Scan to open Explorer profile</p>
        <p className="text-gray-500 text-[8px]">explorers.earth/marcopolo</p>
      </div>
    </div>
  );
}

// ── Footer nav ──
// ── Footer nav ──
function FooterNav({active}:{active:string}) {
  return (
    <div className="shrink-0 border-t border-white/5 bg-[#0a0e14] flex items-center justify-around px-1 py-1.5">
      {footerTabs.map(({id,Icon,label})=>(
        <div key={id} className={`flex flex-col items-center gap-0.5 px-0.5 relative transition-colors duration-300 ${active===id?'text-[#3498DB]':'text-gray-600'}`}>
          {active===id && (
            <motion.div 
              layoutId="ftab" 
              className="absolute -top-[1.5px] left-[15%] right-[15%] h-[1.5px] bg-[#3498DB] rounded-full shadow-[0_0_8px_rgba(52,152,219,0.5)]" 
            />
          )}
          <Icon size={12}/>
          <span className="text-[5.5px] font-medium leading-none">{label}</span>
        </div>
      ))}
    </div>
  );
}

const MOVIES_DATA = {
  label: 'Movies',
  accentColor: '#3b82f6',
  topPick: {
    title: 'Interstellar',
    year: '2014',
    genres: ['Sci-Fi', 'Adventure', 'Drama'],
    summary: 'A team of explorers travel through a wormhole in space in an attempt to ensure humanity\'s survival.',
    img: '/landing/Bali.jpg',
    poster: '/landing/Bali.jpg'
  },
  lists: [
    {
      name: 'Mind-Bending',
      items: [
        { name: 'Interstellar', meta: 'Nolan', img: '/landing/Bali.jpg' },
        { name: 'Inception', meta: 'Nolan', img: '/landing/Paris.jpg' },
        { name: 'Tenet', meta: 'Nolan', img: '/landing/Kyoto.jpg' },
        { name: 'The Prestige', meta: 'Nolan', img: '/landing/Bali.jpg' },
      ]
    }
  ]
};

const BOOKS_DATA = {
  label: 'Books',
  accentColor: '#f97316',
  topPick: {
    title: 'Rich Dad Poor Dad',
    year: '1997',
    genres: ['Finance', 'Self-Help'],
    summary: 'Advocates the importance of financial literacy, financial independence and building wealth.',
    img: '/landing/Kyoto.jpg',
    poster: '/landing/Kyoto.jpg'
  },
  lists: [
    {
      name: 'Finance Classics',
      items: [
        { name: 'Rich Dad Poor Dad', meta: 'Kiyosaki', img: '/landing/Kyoto.jpg' },
        { name: 'Psychology of Money', meta: 'Housel', img: '/landing/Bali.jpg' },
        { name: 'Atomic Habits', meta: 'Clear', img: '/landing/Paris.jpg' },
        { name: 'Deep Work', meta: 'Newport', img: '/landing/Kyoto.jpg' },
      ]
    }
  ]
};

const GAMES_DATA = {
  label: 'Games',
  accentColor: '#ec4899',
  topPick: {
    title: 'GTA V: Special Edition',
    year: '2013',
    genres: ['Shooter', 'Open World'],
    summary: 'The Grand Theft Auto V Special Edition includes full retail copy of the game and collectible artwork.',
    img: '/landing/Paris.jpg',
    poster: '/landing/Paris.jpg'
  },
  lists: [
    {
      name: 'Top Favorites',
      items: [
        { name: 'Grand Theft Auto V', meta: 'Rockstar', img: '/landing/Paris.jpg' },
        { name: 'Cyberpunk 2077', meta: 'CDPR', img: '/landing/Bali.jpg' },
        { name: 'Elden Ring', meta: 'FromSoft', img: '/landing/Kyoto.jpg' },
        { name: 'Tekken 7', meta: 'Namco', img: '/landing/Paris.jpg' },
      ]
    }
  ]
};

const stageFooter: Record<number,string> = {
  3:'profile', 4:'Places', 5:'Guides', 6:'Music', 7:'Movies', 8:'Books', 9:'Games', 10:'profile',
  13:'profile', 14:'Places', 15:'Guides', 16:'Music', 17:'Movies', 18:'Books', 19:'Games', 20:'profile',
};

export default function PublicProfileMockup() {
  const [stage, setStage] = useState(0);

  useEffect(()=>{
    const next=(stage+1)%STAGES.length;
    const t=setTimeout(()=>setStage(next),STAGES[stage]);
    return()=>clearTimeout(t);
  },[stage]);

  const activeFooter = stageFooter[stage]??'profile';
  const showFooter = (stage>=3 && stage<=10) || (stage>=13 && stage<=20);
  const isZoomIn = stage===3 || stage===13;
  const isTransition = stage===2 || stage===12;

  const renderMain = () => {
    // Phase A — Instagram link entry
    if(stage===0) return <InstaProfile linkHighlighted={false}/>;
    if(stage===1) return <InstaProfile linkHighlighted={true}/>;
    if(stage===2) return <ZoomTransition text="explorers.earth/marcopolo" />;
    if(stage===3) return <ExplorerOverview/>;
    if(stage===4) return <PlacesPage/>;
    if(stage===5) return <GuidesPage/>;
    if(stage===6) return <MusicPublicPage />;
    if(stage===7) return <CatPage label="Movies" data={MOVIES_DATA} />;
    if(stage===8) return <CatPage label="Books" data={BOOKS_DATA} />;
    if(stage===9) return <CatPage label="Games" data={GAMES_DATA} />;
    if(stage===10) return <GalleryPage/>;
    // Phase B — QR scan entry
    if(stage===11) return <QRScan/>;
    if(stage===12) return <ZoomTransition text="Opening Explorer Profile..." />;
    if(stage===13) return <ExplorerOverview/>;
    if(stage===14) return <PlacesPage/>;
    if(stage===15) return <GuidesPage/>;
    if(stage===16) return <MusicPublicPage />;
    if(stage===17) return <CatPage label="Movies" data={MOVIES_DATA} />;
    if(stage===18) return <CatPage label="Books" data={BOOKS_DATA} />;
    if(stage===19) return <CatPage label="Games" data={GAMES_DATA} />;
    if(stage===20) return <GalleryPage/>;
    return <ExplorerOverview/>;
    return <ExplorerOverview/>;
  };

  return (
    <div className="flex-1 flex flex-col bg-black h-full overflow-hidden select-none pointer-events-none">

      {/* Phase badges */}
      <AnimatePresence>
        {(stage===0||stage===1) && (
          <motion.div key="badge-a" initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}
            className="absolute top-2 right-2 z-30 bg-pink-500/20 border border-pink-500/40 rounded-full px-2 py-0.5">
            <span className="text-[6px] text-pink-300 font-semibold">Via Link 🔗</span>
          </motion.div>
        )}
        {(stage===11) && (
          <motion.div key="badge-b" initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}
            className="absolute top-2 right-2 z-30 bg-[#3498DB]/20 border border-[#3498DB]/40 rounded-full px-2 py-0.5">
            <span className="text-[6px] text-[#3498DB] font-semibold">Via QR Scan 📷</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.div key={stage}
          initial={isZoomIn ? {scale:3,opacity:0} : isTransition ? {opacity:0} : {opacity:0,y:4}}
          animate={isZoomIn ? {scale:1,opacity:1} : isTransition ? {opacity:1} : {opacity:1,y:0}}
          exit={{opacity:0}}
          transition={isZoomIn ? {duration:0.7,ease:'easeOut'} : {duration:0.3}}
          className="flex flex-col flex-1 overflow-hidden min-h-0"
        >
          {renderMain()}
          {showFooter && <FooterNav active={activeFooter}/>}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

