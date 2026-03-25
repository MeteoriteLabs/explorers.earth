import { memo } from "react";
import { Star } from "lucide-react";
import type { RecommendedBook } from "../../types";
import { buildCoverUrl, formatAuthors } from "../../utils/bookHelpers";

interface BookCoverCardProps {
  book: RecommendedBook;
  onClick: (book: RecommendedBook) => void;
}

const FALLBACK = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='180' viewBox='0 0 120 180'><rect width='120' height='180' fill='%23171e2e'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='32' fill='%23ffffff20'>📚</text></svg>`;

const BookCoverCard = memo(({ book, onClick }: BookCoverCardProps) => {
  const coverUrl = buildCoverUrl(book.thumbnail_url || book.cover_url) || FALLBACK;
  const rating = book.user_rating ?? book.google_rating;
  const authors = formatAuthors(book.authors);

  return (
    <button
      onClick={() => onClick(book)}
      className="flex-shrink-0 w-[120px] group cursor-pointer text-left"
    >
      {/* Cover */}
      <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden shadow-lg mb-2 bg-white/5 ring-1 ring-white/8 group-hover:ring-amber-400/40 transition-all duration-300">
        <img
          src={coverUrl}
          alt={book.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = FALLBACK; }}
        />
        {/* Rating badge */}
        {rating && (
          <div className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5 bg-black/70 backdrop-blur-sm text-amber-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            <Star size={8} fill="currentColor" />
            <span>{Number(rating).toFixed(1)}</span>
          </div>
        )}
        {/* hover overlay */}
        <div className="absolute inset-0 bg-amber-400/0 group-hover:bg-amber-400/8 transition-all duration-300" />
      </div>

      {/* Title & Author */}
      <p className="text-xs font-semibold text-white/90 line-clamp-2 leading-tight mb-0.5">
        {book.title}
      </p>
      <p className="text-[10px] text-white/45 truncate">{authors}</p>
    </button>
  );
});

BookCoverCard.displayName = "BookCoverCard";
export default BookCoverCard;
