import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { genreToSlug, extractUniqueGenres } from "../../utils/movieHelpers";
import type { RecommendedMovie } from "../../types";

interface GenreBrowseProps {
  movies: RecommendedMovie[];
  username: string;
}

// A palette of gradient pairs for genre cards
const GENRE_GRADIENTS = [
  ["#1a1a2e", "#16213e"],
  ["#0f3460", "#533483"],
  ["#1b1b2f", "#2d132c"],
  ["#0a3d62", "#1e3799"],
  ["#1a1a2e", "#7f1d1d"],
  ["#064663", "#04293a"],
  ["#2c003e", "#512b58"],
  ["#1b262c", "#0f3460"],
];

const GenreBrowse = ({ movies, username }: GenreBrowseProps) => {
  const allGenreArrays = movies.map(m => m.genres);
  const genres = extractUniqueGenres(allGenreArrays);

  // Count movies per genre
  const genreCount: Record<string, number> = {};
  for (const g of genres) {
    genreCount[g] = movies.filter(m => {
      const names = Array.isArray(m.genres)
        ? m.genres.map((x: any) => typeof x === "string" ? x : x?.name).filter(Boolean)
        : [];
      return names.includes(g);
    }).length;
  }

  // Only show genres with at least 1 movie
  const visibleGenres = genres.filter(g => genreCount[g] > 0);

  if (visibleGenres.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-white mb-4 px-4 md:px-0">Browse by Genre</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 px-4 md:px-0">
        {visibleGenres.map((genre, i) => {
          const gradient = GENRE_GRADIENTS[i % GENRE_GRADIENTS.length];
          return (
            <motion.div
              key={genre}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Link
                to={`/${username}/movies/genre/${genreToSlug(genre)}`}
                className="relative flex flex-col justify-between h-24 rounded-xl overflow-hidden p-3 border border-white/10 hover:border-blue-500/40 transition-all group"
                style={{
                  background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <ChevronRight size={14} className="self-end text-white/30 group-hover:text-white/60 transition-colors" />
                <div>
                  <p className="text-sm font-semibold text-white">{genre}</p>
                  <p className="text-xs text-white/40">{genreCount[genre]} movie{genreCount[genre] !== 1 ? "s" : ""}</p>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};

export default GenreBrowse;
