import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Heart, Image, Grid3x3, Film, BookOpen, Gamepad2, Music, Navigation, BookMarked, User, Music2, Gamepad, Globe, ExternalLink } from 'lucide-react';

// Phase A — via Instagram link:
//  0: Instagram profile (link visible)          2800ms
//  1: Link highlighted + pulsing               1200ms
//  2: Zoom in → Explorer overview              2200ms
//  3: Places page                              1800ms
//  4: Guides page                              1800ms
//  5: Music page                               1800ms
//  6: Movies page                              1800ms
//  7: Books page                               1800ms
//  8: Games page                               1800ms
//  9: Gallery                                  1800ms
// Phase B — via QR code:
// 10: QR code scan animation                   2200ms
// 11: Zoom in → Explorer overview (QR entry)   2200ms
// 12: Places page                              1800ms
// 13: Guides page                              1800ms
// 14: Music page                               1800ms
// 15: Movies page                              1800ms
// 16: Books page                               1800ms
// 17: Games page                               1800ms
// 18: Gallery                                  1800ms
// → loop
const STAGES = [2800,1200,2200,1800,1800,1800,1800,1800,1800,1800,2200,2200,1800,1800,1800,1800,1800,1800,1800];

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
  { id:'Games',  Icon:Gamepad,    label:'Games'  },
  { id:'Books',  Icon:BookOpen,   label:'Books'  },
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
        {[{Icon:Grid3x3,active:true},{Icon:Film,active:false},{Icon:User,active:false}].map(({Icon,active},i)=>(
          <div key={i} className={`flex-1 flex items-center justify-center py-2 ${active?'border-t border-white':'border-t border-transparent'}`}>
            <Icon size={14} className={active?'text-white':'text-gray-600'} />
          </div>
        ))}
      </div>

      {/* Photo grid */}
      <div className="grid grid-cols-3 gap-px flex-1 overflow-hidden">
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
function ZoomTransition() {
  return (
    <div className="flex flex-col h-full bg-black items-center justify-center">
      <motion.div
        initial={{ scale: 1, opacity: 1 }}
        animate={{ scale: 18, opacity: 0 }}
        transition={{ duration: 1.2, ease: 'easeIn' }}
        className="bg-[#3498DB]/20 border border-[#3498DB]/60 rounded-lg px-3 py-1.5 flex items-center gap-1.5"
      >
        <Globe size={10} className="text-[#3498DB]" />
        <span className="text-[9px] font-semibold text-[#3498DB]">explorers.earth/marcopolo</span>
      </motion.div>
    </div>
  );
}

// ── Explorer profile overview ──
const recCats = [
  { label:'Places', Icon:MapPin,   color:'#10b981', grad:'from-emerald-900/80 to-emerald-800/50' },
  { label:'Music',  Icon:Music,    color:'#a855f7', grad:'from-purple-900/80 to-purple-800/50'  },
  { label:'Movies', Icon:Film,     color:'#3b82f6', grad:'from-blue-900/80 to-blue-800/50'     },
  { label:'Books',  Icon:BookOpen, color:'#f97316', grad:'from-amber-900/80 to-amber-800/50'   },
  { label:'Games',  Icon:Gamepad2, color:'#ec4899', grad:'from-fuchsia-900/80 to-fuchsia-800/50'},
];

function ExplorerOverview() {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="relative h-20 shrink-0 overflow-hidden">
        <img src="/landing/Paris.jpg" alt="Cover" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/80" />
      </div>
      <div className="flex justify-center -mt-7 shrink-0 z-10 relative">
        <div className="w-14 h-14 rounded-full border-[3px] border-green-400 overflow-hidden ring-4 ring-black">
          <img src="/landing/marco_polo.jpg" alt="Marco" className="w-full h-full object-cover" />
        </div>
      </div>
      <div className="flex flex-col items-center pt-1 pb-2 px-3 shrink-0">
        <h2 className="text-white text-xs font-bold">Marco Polo</h2>
        <div className="flex items-center gap-1 text-gray-400 text-[8px] mt-0.5"><MapPin size={7}/><span>Kyoto, Japan</span></div>
        <p className="text-gray-400 text-[7px] text-center mt-1 max-w-[180px] line-clamp-2">🌍 Explorer · 47 countries · Sharing hidden gems & favourite places</p>
      </div>
      <div className="flex justify-center gap-8 border-b border-gray-800 shrink-0">
        <div className="py-1.5 border-b-2 border-[#3498DB] text-white"><Heart size={12} fill="currentColor"/></div>
        <div className="py-1.5 border-b-2 border-transparent text-gray-600"><Image size={12}/></div>
      </div>
      <div className="flex-1 overflow-hidden px-3 py-2 min-h-0">
        <div className="flex flex-col gap-1.5">
          {recCats.map(({label,Icon,color,grad},i)=>(
            <motion.div key={label} initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{delay:i*0.08}}
              className={`relative flex items-center gap-2.5 rounded-xl px-3 py-2 overflow-hidden bg-gradient-to-r ${grad} border border-white/5`}>
              <Icon size={12} style={{color}}/>
              <span className="text-white text-[9px] font-semibold uppercase tracking-wide">{label}</span>
              <motion.div className="absolute bottom-0 left-0 h-[2px] rounded-full" animate={{width:'40%'}} style={{backgroundColor:color}}/>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Places page ──
function PlacesPage() {
  const cities = [{name:'Paris',img:'/landing/Paris.jpg',active:true},{name:'Bali',img:'/landing/Bali.jpg',active:false},{name:'Kyoto',img:'/landing/Kyoto.jpg',active:false}];
  const places = [{name:'Eiffel Tower',cat:'Landmark',img:'/landing/Eiffel_Tower.jpg',r:4.9},{name:'Louvre Museum',cat:'Culture',img:'/landing/Louvre_Museum.jpg',r:4.8},{name:'Montmartre',cat:'District',img:'/landing/Paris.jpg',r:4.7}];
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex gap-3 px-3 pt-2 pb-1.5 shrink-0">
        {cities.map(c=>(
          <div key={c.name} className="flex flex-col items-center gap-1 shrink-0">
            <div className={`w-11 h-11 rounded-full overflow-hidden border-[2.5px] ${c.active?'border-green-400 shadow-[0_0_8px_rgba(74,222,128,0.4)]':'border-gray-600'}`}>
              <img src={c.img} alt={c.name} className="w-full h-full object-cover"/>
            </div>
            <span className={`text-[7px] font-medium ${c.active?'text-white':'text-gray-500'}`}>{c.name}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 px-3 mb-2 shrink-0">
        {['All','Landmark','Culture','Food'].map((p,i)=>(
          <div key={p} className={`px-2 py-0.5 rounded-lg text-[7px] font-medium ${i===0?'bg-[#3498DB] text-white':'bg-white/7 text-gray-400'}`}>{p}</div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 px-3 overflow-y-auto">
        {places.map((p,i)=>(
          <motion.div key={p.name} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.1}} className="bg-[#1a1f2e] rounded-xl overflow-hidden border border-white/5">
            <div className="h-16 relative"><img src={p.img} alt={p.name} className="w-full h-full object-cover"/><div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"/></div>
            <div className="p-1.5">
              <p className="text-[8px] text-white font-medium truncate">{p.name}</p>
              <div className="flex items-center justify-between">
                <p className="text-[7px] text-gray-500">{p.cat}</p>
                <span className="text-[6px] text-amber-400">★ {p.r}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── Guides page ──
function GuidesPage() {
  const guides = [{title:'Kyoto 7-Day Itinerary',loc:'Kyoto, Japan',img:'/landing/Kyoto.jpg',days:7},{title:'Bali Hidden Gems',loc:'Bali, Indonesia',img:'/landing/Bali.jpg',days:5},{title:'Paris Weekend Guide',loc:'Paris, France',img:'/landing/Eiffel_Tower.jpg',days:2}];
  return (
    <div className="flex flex-col flex-1 overflow-y-auto px-3 pt-2 gap-2">
      {guides.map((g,i)=>(
        <motion.div key={g.title} initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{delay:i*0.1}} className="bg-[#1a1f2e] rounded-xl overflow-hidden border border-white/5">
          <div className="h-14 relative"><img src={g.img} alt={g.title} className="w-full h-full object-cover"/><div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"/><div className="absolute bottom-1.5 left-2 flex gap-1"><span className="text-[6px] bg-[#3498DB] text-white px-1.5 py-0.5 rounded">{g.days} Days</span><span className="text-[6px] bg-green-500/20 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded">Published</span></div></div>
          <div className="p-2"><p className="text-[9px] text-white font-semibold">{g.title}</p><p className="text-[7px] text-gray-500 flex items-center gap-0.5 mt-0.5"><MapPin size={6}/>{g.loc}</p></div>
        </motion.div>
      ))}
    </div>
  );
}

// ── Category page (Music/Movies) ──
function CatPage({label,color,topImg,topName,topMeta,items,listName}:{label:string;color:string;topImg:string;topName:string;topMeta:string;items:{name:string;meta:string;img:string}[];listName:string}) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="mx-3 mt-2 mb-2 rounded-xl overflow-hidden relative h-20 shrink-0">
        <img src={topImg} alt={topName} className="w-full h-full object-cover"/>
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-transparent"/>
        <div className="absolute inset-0 p-3 flex flex-col justify-end">
          <div className="text-[6px] font-bold uppercase tracking-widest mb-0.5" style={{color}}>Top Picks</div>
          <p className="text-[9px] text-white font-bold">{topName}</p>
          <p className="text-[7px] text-gray-400">{topMeta}</p>
        </div>
      </div>
      <p className="text-[8px] text-gray-400 font-semibold uppercase tracking-wider px-3 mb-1.5">Public Lists</p>
      <div className="flex flex-col gap-1.5 px-3 overflow-y-auto">
        <div className="bg-[#1a1f2e] rounded-xl overflow-hidden border border-white/5">
          <div className="flex gap-0.5 h-10">{items.slice(0,2).map((it,i)=><div key={i} className="flex-1 overflow-hidden"><img src={it.img} alt={it.name} className="w-full h-full object-cover"/></div>)}</div>
          <div className="p-2 flex items-center justify-between"><div><p className="text-[8px] text-white font-semibold">{listName}</p><p className="text-[6px] text-gray-500">{items.length} {label.toLowerCase()}</p></div><span className="text-[6px] text-green-400">Public</span></div>
        </div>
        {items.map((it,i)=>(
          <motion.div key={it.name} initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}} transition={{delay:i*0.08}} className="flex items-center gap-2 bg-[#1a1f2e] rounded-xl p-1.5 border border-white/5">
            <div className="w-7 h-9 rounded-sm overflow-hidden shrink-0"><img src={it.img} alt={it.name} className="w-full h-full object-cover"/></div>
            <div className="flex-1 min-w-0"><p className="text-[8px] text-white font-medium truncate">{it.name}</p><p className="text-[7px] text-gray-500">{it.meta}</p></div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── Gallery tab ──
function GalleryPage() {
  const feedCells = ['/landing/Paris.jpg','/landing/Bali.jpg','/landing/Kyoto.jpg','/landing/Eiffel_Tower.jpg','/landing/Louvre_Museum.jpg','/landing/Bali.jpg'];
  return (
    <div className="flex flex-col flex-1 overflow-hidden px-3 pt-2">
      <div className="flex justify-center -mt-1 mb-2 shrink-0">
        <div className="w-12 h-12 rounded-full border-[3px] border-green-400 overflow-hidden ring-3 ring-black">
          <img src="/landing/marco_polo.jpg" alt="Marco" className="w-full h-full object-cover"/>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1 overflow-y-auto">
        {feedCells.map((src,i)=>(
          <motion.div key={i} initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}} transition={{delay:i*0.06}} className="aspect-square rounded-md overflow-hidden">
            <img src={src} alt="" className="w-full h-full object-cover"/>
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
function FooterNav({active}:{active:string}) {
  return (
    <div className="shrink-0 border-t border-white/5 bg-[#0a0e14] flex items-center justify-around px-1 py-1.5">
      {footerTabs.map(({id,Icon,label})=>(
        <div key={id} className={`flex flex-col items-center gap-0.5 px-0.5 relative ${active===id?'text-[#3498DB]':'text-gray-600'}`}>
          {active===id&&<motion.div layoutId="ftab" className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-[#3498DB]"/>}
          <Icon size={11}/><span className="text-[5.5px] font-medium leading-none">{label}</span>
        </div>
      ))}
    </div>
  );
}

const MUSIC_DATA = {label:'Music',color:'#a855f7',topImg:'/landing/Taylor_Swift_Music.jpg',topName:'Anti-Hero',topMeta:'Taylor Swift · Midnights',listName:'Favourites Playlist',items:[{name:'Anti-Hero',meta:'Taylor Swift',img:'/landing/Taylor_Swift_Music.jpg'},{name:'Cruel Summer',meta:'Taylor Swift',img:'/landing/Taylor_Swift_Music.jpg'}]};
const MOVIES_DATA = {label:'Movies',color:'#3b82f6',topImg:'/landing/Interstellar.jpg',topName:'Interstellar',topMeta:'2014 · Sci-Fi',listName:'Mind-Bending Sci-Fi',items:[{name:'Interstellar',meta:'2014 · Sci-Fi',img:'/landing/Interstellar.jpg'},{name:'Breaking Bad',meta:'Drama · Series',img:'/landing/Breaking_Bad.jpg'}]};
const BOOKS_DATA = {label:'Books',color:'#f97316',topImg:'/landing/Rich_Dad.jpg',topName:'Rich Dad Poor Dad',topMeta:'Robert T. Kiyosaki',listName:'My Finance Reads',items:[{name:'Rich Dad Poor Dad',meta:'Robert T. Kiyosaki',img:'/landing/Rich_Dad.jpg'}]};
const GAMES_DATA = {label:'Games',color:'#ec4899',topImg:'/landing/GTA.jpg',topName:'GTA: San Andreas',topMeta:'Rockstar Games',listName:'My Favourite RPGs',items:[{name:'GTA: San Andreas',meta:'Rockstar Games',img:'/landing/GTA.jpg'},{name:'GTA V',meta:'Rockstar Games',img:'/landing/GTA_2.jpg'}]};

const stageFooter: Record<number,string> = {
  2:'profile', 3:'Places', 4:'Guides', 5:'Music', 6:'Movies', 7:'Books', 8:'Games', 9:'profile',
  11:'profile', 12:'Places', 13:'Guides', 14:'Music', 15:'Movies', 16:'Books', 17:'Games', 18:'profile',
};

export default function PublicProfileMockup() {
  const [stage, setStage] = useState(0);

  useEffect(()=>{
    const next=(stage+1)%STAGES.length;
    const t=setTimeout(()=>setStage(next),STAGES[stage]);
    return()=>clearTimeout(t);
  },[stage]);

  const activeFooter = stageFooter[stage]??'profile';
  const showFooter = (stage>=2 && stage<=9) || (stage>=11 && stage<=18);
  const isZoomIn = stage===2 || stage===11;

  const renderMain = () => {
    // Phase A — Instagram link entry
    if(stage===0) return <InstaProfile linkHighlighted={false}/>;
    if(stage===1) return <InstaProfile linkHighlighted={true}/>;
    if(stage===2) return <ExplorerOverview/>;
    if(stage===3) return <PlacesPage/>;
    if(stage===4) return <GuidesPage/>;
    if(stage===5) return <CatPage {...MUSIC_DATA}/>;
    if(stage===6) return <CatPage {...MOVIES_DATA}/>;
    if(stage===7) return <CatPage {...BOOKS_DATA}/>;
    if(stage===8) return <CatPage {...GAMES_DATA}/>;
    if(stage===9) return <GalleryPage/>;
    // Phase B — QR scan entry
    if(stage===10) return <QRScan/>;
    if(stage===11) return <ExplorerOverview/>;
    if(stage===12) return <PlacesPage/>;
    if(stage===13) return <GuidesPage/>;
    if(stage===14) return <CatPage {...MUSIC_DATA}/>;
    if(stage===15) return <CatPage {...MOVIES_DATA}/>;
    if(stage===16) return <CatPage {...BOOKS_DATA}/>;
    if(stage===17) return <CatPage {...GAMES_DATA}/>;
    if(stage===18) return <GalleryPage/>;
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
        {(stage===10) && (
          <motion.div key="badge-b" initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}
            className="absolute top-2 right-2 z-30 bg-[#3498DB]/20 border border-[#3498DB]/40 rounded-full px-2 py-0.5">
            <span className="text-[6px] text-[#3498DB] font-semibold">Via QR Scan 📷</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.div key={stage}
          initial={isZoomIn ? {scale:3,opacity:0} : {opacity:0,y:4}}
          animate={isZoomIn ? {scale:1,opacity:1} : {opacity:1,y:0}}
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

