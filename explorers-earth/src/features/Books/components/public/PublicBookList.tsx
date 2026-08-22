import { useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@apollo/client";
import { ArrowLeft, Star, Share2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { BOOK_LIST_BY_SLUG } from "../../api/query";
import { deduplicateBooks } from "../../utils/bookHelpers";
import type { RecommendedBook } from "../../types";
import BookCoverCard from "./BookCoverCard";
import BookDetailModal from "./BookDetailModal";
import SEO from "../../../../components/SEO";
import { createCanonicalUrl } from "../../../../utils/getCurrentDomain";
import { usePublicRouteLifecycle } from "../../../../layouts/usePublicRouteLifecycle";
import { PublicProfileFallbackRedirect } from "../../../../routes/PublicProfileFallbackRedirect";
import { shouldRedirectMissingPublicResource } from "../../../../routes/publicRouteResourceState";

const PublicBookList = () => {
  const { username, listSlug } = useParams<{ username: string; listSlug: string }>();
  const [modalState, setModalState] = useState<{ open: boolean; book: RecommendedBook | null }>({
    open: false,
    book: null,
  });

  const { data, loading, error, refetch } = useQuery(BOOK_LIST_BY_SLUG, {
    variables: { slug: listSlug, username },
    skip: !listSlug || !username,
    fetchPolicy: "cache-and-network",
  });

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: rawList?.List_Name || "Book List", url }); } catch { /* ignore */ }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied!");
      } catch (error) {
        console.error("Failed to copy text:", error);
      }
    }
  };

  const rawList = data?.bookLists?.[0];
  const books: RecommendedBook[] = deduplicateBooks(rawList?.recommended_books);

  usePublicRouteLifecycle({
    loading,
    error,
    retry: refetch,
    hasUsableData: Boolean(data),
    empty: !loading && !error && !rawList,
  });

  const missingResource = shouldRedirectMissingPublicResource({ loading, error, resource: rawList });

  const handleBookClick = useCallback((book: RecommendedBook) => {
    setModalState({ open: true, book });
  }, []);

  const pinnedBooks = books.filter((b) => b.is_pinned);
  const restBooks = books.filter((b) => !b.is_pinned);

  const pageTitle = rawList ? `${rawList.List_Name} | ${username}'s Book List | explorers` : `Book List | explorers`;
  const metaDescription = rawList?.list_description 
    ? rawList.list_description 
    : rawList 
      ? `Explore the curated book list "${rawList.List_Name}" containing ${books.length} books recommended by ${username} on explorers.`
      : "Explore book recommendations on explorers.";

  const seoKeywords = rawList 
    ? [`${rawList.List_Name}`, `${username} books`, "book list", "explorers"]
    : ["book list", "explorers"];

  const listImage = rawList?.cover_image?.url || (books[0]?.cover_url ? books[0].cover_url : undefined);

  if (missingResource) return <PublicProfileFallbackRedirect />;

  return (
    <>
      {!loading && rawList && (
        <SEO
          title={pageTitle}
          description={metaDescription}
          keywords={seoKeywords}
          canonical={createCanonicalUrl(`/${username}/books/${listSlug}`)}
          image={listImage}
          type="website"
          author={username}
          siteName="explorers"
        />
      )}
      <div className="min-h-screen bg-black text-white">
      {/* Fixed Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-[#2a2a2a]/90 backdrop-blur-sm border-b border-gray-700 h-14">
        <div className="max-w-4xl mx-auto flex items-center justify-between h-full px-6">
          <span
            className="text-white font-bold text-2xl cursor-pointer"
            onClick={() => window.location.href = "/"}
          >
            explorers.earth
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleShare}
              className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-all duration-300 flex items-center justify-center cursor-pointer"
              aria-label="Share"
            >
              <Share2 size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="pt-20 pb-20 px-4 md:px-8 max-w-6xl mx-auto">
        {/* Back link */}
        <div className="py-4">
          <Link to={`/${username}/books`} className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors">
            <ArrowLeft size={14} /> All Books
          </Link>
        </div>

        {loading && !data ? (
          <div className="space-y-6">
            <div className="h-8 w-64 bg-white/5 rounded-lg animate-pulse" />
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="aspect-[2/3] bg-white/8 rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
        ) : !rawList ? (
          <div className="text-center py-24">
            <p className="text-white/40">This list doesn't exist or isn't publicly visible.</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl md:text-3xl font-bold text-white">{rawList.List_Name}</h1>
              {rawList.list_description && (
                <p className="text-white/50 text-sm mt-1">{rawList.list_description}</p>
              )}
              <p className="text-white/30 text-xs mt-2">{books.length} book{books.length !== 1 ? "s" : ""}</p>
            </div>

            {/* Pinned / Top Reads section */}
            {pinnedBooks.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1.5 h-5 bg-amber-400 rounded-sm" />
                  <h2 className="text-lg font-bold text-white flex items-center gap-1.5">
                    <Star size={16} className="text-amber-400" fill="currentColor" /> Top Reads
                  </h2>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                  {pinnedBooks.map((book) => (
                    <BookCoverCard key={book.documentId} book={book} onClick={handleBookClick} />
                  ))}
                </div>
              </div>
            )}

            {/* All books grid */}
            {restBooks.length > 0 && (
              <div className="mb-8">
                {pinnedBooks.length > 0 && (
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1.5 h-5 bg-white/30 rounded-sm" />
                    <h2 className="text-lg font-bold text-white">All Books</h2>
                  </div>
                )}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                  {restBooks.map((book) => (
                    <BookCoverCard key={book.documentId} book={book} onClick={handleBookClick} />
                  ))}
                </div>
              </div>
            )}

            {books.length === 0 && (
              <p className="text-center text-white/30 py-16">No books in this list yet.</p>
            )}
          </>
        )}
      </div>

      <BookDetailModal
        book={modalState.book}
        open={modalState.open}
        onClose={() => setModalState({ open: false, book: null })}
      />
      </div>
    </>
  );
};

export default PublicBookList;
