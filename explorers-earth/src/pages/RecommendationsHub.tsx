import { useNavigate } from "react-router-dom";
import { Compass, Film, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

const RecommendationsHub = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-dashboard-bg text-dashboard px-5 py-8 pb-24 max-w-lg mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 tracking-tight text-dashboard">Recommendations</h1>
        <p className="text-sm text-dashboard-muted leading-relaxed">
          Manage and share your curated lists of favorite locations and films.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5">
        {/* Places Card */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate("/recommendations/places")}
          className="flex items-center p-5 bg-gradient-to-br from-green-900/20 to-dashboard-sidebar border border-green-500/10 hover:border-green-500/30 rounded-3xl shadow-lg relative overflow-hidden group text-left transition-all"
        >
          <div className="absolute -top-4 -right-4 p-4 opacity-[0.03] group-hover:opacity-10 transform group-hover:scale-110 transition-all duration-500">
            <Compass size={120} />
          </div>
          
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-400/20 to-teal-500/20 text-green-400 flex items-center justify-center mr-5 shrink-0 shadow-inner border border-green-400/20">
            <Compass size={28} />
          </div>
          
          <div className="flex-1 relative z-10">
            <h2 className="text-xl font-bold text-dashboard mb-1">Locations</h2>
            <p className="text-xs text-dashboard-muted pr-4">Curate your favorite travel spots and hidden gems</p>
          </div>
          
          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors relative z-10 shrink-0">
            <ChevronRight size={16} className="text-dashboard-muted group-hover:text-dashboard transition-colors" />
          </div>
        </motion.button>

        {/* Movies Card */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate("/recommendations/movies")}
          className="flex items-center p-5 bg-gradient-to-br from-blue-900/20 to-dashboard-sidebar border border-blue-500/10 hover:border-blue-500/30 rounded-3xl shadow-lg relative overflow-hidden group text-left transition-all"
        >
          <div className="absolute -top-4 -right-4 p-4 opacity-[0.03] group-hover:opacity-10 transform group-hover:scale-110 transition-all duration-500">
            <Film size={120} />
          </div>
          
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-400/20 to-indigo-500/20 text-blue-400 flex items-center justify-center mr-5 shrink-0 shadow-inner border border-blue-400/20">
            <Film size={28} />
          </div>
          
          <div className="flex-1 relative z-10">
            <h2 className="text-xl font-bold text-dashboard mb-1">Movies & Shows</h2>
            <p className="text-xs text-dashboard-muted pr-4">Share your watchlists and top film picks</p>
          </div>
          
          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors relative z-10 shrink-0">
            <ChevronRight size={16} className="text-dashboard-muted group-hover:text-dashboard transition-colors" />
          </div>
        </motion.button>
      </div>
    </div>
  );
};

export default RecommendationsHub;
