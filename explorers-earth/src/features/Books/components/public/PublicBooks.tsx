import { useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useQuery, gql } from "@apollo/client";
import { Share2, Copy, Check, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { PUBLIC_BOOK_DATA } from "../../api/query";
import { deduplicateBooks } from "../../utils/bookHelpers";
import type { RecommendedBook, BookList } from "../../types";
import BookCarouselRow from "./BookCarouselRow";
import BookDetailModal from "./BookDetailModal";
import SubjectBrowse from "./SubjectBrowse";

const ACCOUNT_BY_USERNAME = gql`
  query AccountByUsername($username: String!) {
    usersPermissionsUsers(filters: { username: { eq: $username } }) {
      documentId
      username
      accounts {
        documentId
        Account_Name
      }
    }
  }
`;

const PublicBooks = () => {
  const { username } = useParams<{ username: string }>();

  const { data: userLookup } = useQuery(ACCOUNT_BY_USERNAME, {
    variables: { username },
    skip: !username,
  });

  const accountDocumentId = userLookup?.usersPermissionsUsers?.[0]?.accounts?.[0]?.documentId;

  const [modalState, setModalState] = useState<{ open: boolean; book: RecommendedBook | null }>({
    open: false,
    book: null,
  });
  const [copied, setCopied] = useState(false);

  const { data, loading } = useQuery(PUBLIC_BOOK_DATA, {
    variables: { accountDocumentId },
    skip: !accountDocumentId,
    fetchPolicy: "cache-and-network",
  });

  const lists: BookList[] = (data?.bookLists ?? []).map((l: BookList) => ({
    ...l,
    recommended_books: deduplicateBooks(l.recommended_books),
  }));

  // Collect all pinned books across all lists (Top Reads)
  const allBooks = lists.flatMap((l) => l.recommended_books);
  const topReads = allBooks
    .filter((b) => b.is_pinned)
    .sort((a, b) => (a.pin_order ?? 999) - (b.pin_order ?? 999));

  const handleBookClick = useCallback((book: RecommendedBook) => {
    setModalState({ open: true, book });
  }, []);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: `${username}'s Books`, url }); } catch { /* ignore */ }
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Link copied!");
    }
  };

  // Subjects for browse (aggregate across all books)
  const allSubjects = Array.from(
    new Set(allBooks.flatMap((b) => b.subjects ?? []).filter(Boolean))
  ).sort() as string[];

  const hasContent = lists.length > 0;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/8">
        <div className="flex items-center justify-between px-4 py-3 max-w-6xl mx-auto">
          <img src="/logo.svg" alt="explorers.earth" className="h-6 opacity-70" />
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/8 transition-all"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? "Copied!" : "Copy Link"}
            </button>
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/8 transition-all"
            >
              <Share2 size={13} /> Share
            </button>
          </div>
        </div>
      </div>

      <div className="pt-14 pb-20 px-4 md:px-8 max-w-6xl mx-auto">
        {/* Page headline */}
        <div className="py-6 md:py-8 mb-4">
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            <span className="text-amber-400">📚</span> Books
          </h1>
          {!loading && hasContent && (
            <p className="text-white/50 text-sm mt-1">
              {allBooks.length} book recommendation{allBooks.length !== 1 ? "s" : ""} across {lists.length} list{lists.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* Top Reads row */}
        {(loading || topReads.length > 0) && (
          <BookCarouselRow
            title="Top Reads"
            books={topReads}
            loading={loading}
            onBookClick={handleBookClick}
          />
        )}

        {/* Per-list carousel rows */}
        {lists.map((list) => (
          <BookCarouselRow
            key={list.documentId}
            title={list.List_Name}
            description={list.list_description}
            books={list.recommended_books}
            seeAllLink={`/${username}/books/${list.slug}`}
            onBookClick={handleBookClick}
          />
        ))}

        {/* Subject browse */}
        {allSubjects.length > 0 && (
          <SubjectBrowse
            subjects={allSubjects}
            username={username!}
          />
        )}

        {/* Empty state */}
        {!loading && !hasContent && (
          <div className="text-center py-32">
            <BookOpen size={56} className="text-white/15 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white/40 mb-2">No books yet</h2>
            <p className="text-white/25 text-sm">
              Check back soon for book recommendations.
            </p>
          </div>
        )}
      </div>

      {/* Book detail modal */}
      <BookDetailModal
        book={modalState.book}
        open={modalState.open}
        onClose={() => setModalState({ open: false, book: null })}
      />
    </div>
  );
};

export default PublicBooks;
