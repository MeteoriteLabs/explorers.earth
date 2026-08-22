import { useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@apollo/client";
import { ArrowLeft, Share2 } from "lucide-react";
import { toast } from "sonner";
import { BOOK_CATEGORIES, BOOKS_BY_SUBJECT } from "../../api/query";
import { deduplicateBooks, slugToSubjectName, subjectToSlug } from "../../utils/bookHelpers";
import type { RecommendedBook } from "../../types";
import BookCoverCard from "./BookCoverCard";
import BookDetailModal from "./BookDetailModal";
import SEO from "../../../../components/SEO";
import { createCanonicalUrl } from "../../../../utils/getCurrentDomain";
import { usePublicRouteLifecycle } from "../../../../layouts/usePublicRouteLifecycle";
import { usePublicProfileBootstrapAccount } from "../../../../layouts/PublicProfileBootstrapContext";
import { PublicProfileFallbackRedirect } from "../../../../routes/PublicProfileFallbackRedirect";
import { shouldRedirectMissingPublicResource } from "../../../../routes/publicRouteResourceState";

const PublicBookSubject = () => {
  const { username, subjectSlug } = useParams<{ username: string; subjectSlug: string }>();
  const subjectName = slugToSubjectName(subjectSlug ?? "");

  const accountDocumentId = usePublicProfileBootstrapAccount().documentId;

  const [modalState, setModalState] = useState<{ open: boolean; book: RecommendedBook | null }>({
    open: false,
    book: null,
  });

  const { data, loading: booksLoading, error: booksError, refetch: refetchBooks } = useQuery(BOOKS_BY_SUBJECT, {
    variables: { accountDocumentId },
    skip: !accountDocumentId,
    fetchPolicy: "cache-and-network",
  });
  const { data: categoriesData, loading: categoriesLoading, error: categoriesError, refetch: refetchCategories } = useQuery(BOOK_CATEGORIES, {
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const loading = booksLoading || categoriesLoading;
  const error = booksError ?? categoriesError;
  const subject = categoriesData?.bookCategories?.find(
    (category: { subject_name?: string | null }) => subjectToSlug(category.subject_name ?? "") === subjectSlug,
  );

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: `${subjectName} Books`, url }); } catch { /* ignore */ }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied!");
      } catch (error) {
        console.error("Failed to copy text:", error);
      }
    }
  };

  // Filter locally by subject slug
  const allBooks: RecommendedBook[] = deduplicateBooks(data?.recommendedBooks ?? []);
  const subjectBooks = allBooks.filter((b) =>
    (b.subjects ?? []).some(
      (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") === subjectSlug
    )
  );

  const retry = useCallback(async () => {
    await Promise.all([refetchBooks(), refetchCategories()]);
  }, [refetchBooks, refetchCategories]);

  usePublicRouteLifecycle({
    loading,
    error,
    retry,
    hasUsableData: Boolean(data && categoriesData),
    empty: !loading && !error && Boolean(subject) && subjectBooks.length === 0,
  });

  const missingResource = shouldRedirectMissingPublicResource({
    loading,
    error,
    resource: subject,
  });

  const handleBookClick = useCallback((book: RecommendedBook) => {
    setModalState({ open: true, book });
  }, []);

  const pageTitle = `${subjectName} Books | ${username}'s Book List | explorers`;
  const metaDescription = `Explore ${subjectBooks.length} book${subjectBooks.length !== 1 ? "s" : ""} on ${subjectName} recommended by ${username} on explorers.`;
  const seoKeywords = [subjectName, "books", `${username} books`, "explorers"];

  if (missingResource) return <PublicProfileFallbackRedirect />;
  if (!data || !categoriesData) return null;

  return (
    <>
      {!loading && (
        <SEO
          title={pageTitle}
          description={metaDescription}
          keywords={seoKeywords}
          canonical={createCanonicalUrl(`/${username}/books/subject/${subjectSlug}`)}
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
        <div className="py-4">
          <a href={`/${username}/books`} className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors">
            <ArrowLeft size={14} /> All Books
          </a>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-white">{subjectName}</h1>
          <p className="text-white/30 text-sm mt-1">
            {subjectBooks.length} book{subjectBooks.length !== 1 ? "s" : ""}
          </p>
        </div>

        {subjectBooks.length === 0 ? (
          <p className="text-center text-white/30 py-16">No books found for this subject.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
            {subjectBooks.map((book) => (
              <BookCoverCard key={book.documentId} book={book} onClick={handleBookClick} />
            ))}
          </div>
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

export default PublicBookSubject;
