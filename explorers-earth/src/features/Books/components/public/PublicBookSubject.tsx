import { useState, useCallback, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@apollo/client";
import { ArrowLeft, Share2 } from "lucide-react";
import { toast } from "sonner";
import { BOOKS_BY_SUBJECT } from "../../api/query";
import { deduplicateBooks, slugToSubjectName } from "../../utils/bookHelpers";
import type { RecommendedBook } from "../../types";
import BookCoverCard from "./BookCoverCard";
import BookDetailModal from "./BookDetailModal";
import SEO from "../../../../components/SEO";
import { createCanonicalUrl } from "../../../../utils/getCurrentDomain";
import { usePublicRouteLifecycle } from "../../../../layouts/usePublicRouteLifecycle";
import { usePublicProfileBootstrapAccount } from "../../../../layouts/PublicProfileBootstrapContext";
import { PublicProfileFallbackRedirect } from "../../../../routes/PublicProfileFallbackRedirect";
import { resolvePublicChildState } from "../../../../routes/resolvePublicChildState";
import {
  mergePublicConnectionPage,
  usePublicConnectionPagination,
} from "../../../../hooks/usePublicConnectionPagination";
import { PublicConnectionPaginationControl } from "../../../../components/PublicConnectionPaginationControl";
import {
  publicLeafQueryContext,
  usePublicLeafRequestGeneration,
} from "../../../../layouts/PublicRouteReadinessContext";
import { publicTaxonomyLegacyLookupName, publicTaxonomyPath } from "../../../../routes/publicTaxonomyRoute";
import { createAnalyticsOptions, useTrackAnalytics } from "../../../../services/analyticsService";

const PublicBookSubject = () => {
  const { username, subjectSlug } = useParams<{ username: string; subjectSlug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const legacySubjectName = slugToSubjectName(subjectSlug ?? "");
  const legacySubjectLookupName = publicTaxonomyLegacyLookupName(subjectSlug ?? "", legacySubjectName);

  const accountDocumentId = usePublicProfileBootstrapAccount().documentId;
  const requestGeneration = usePublicLeafRequestGeneration(`${accountDocumentId}:${subjectSlug}`);

  const [modalState, setModalState] = useState<{ open: boolean; book: RecommendedBook | null }>({
    open: false,
    book: null,
  });

  const { data, loading, error, refetch, fetchMore } = useQuery(BOOKS_BY_SUBJECT, {
    context: publicLeafQueryContext,
    variables: {
      accountDocumentId,
      taxonomyDocumentId: subjectSlug,
      legacySubjectName: legacySubjectLookupName,
      pagination: { page: 1, pageSize: 200 },
    },
    skip: !accountDocumentId || !subjectSlug,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const subject = data?.bookCategories?.[0];
  const subjectName = subject?.subject_name ?? legacySubjectName;
  const analytics = useTrackAnalytics(createAnalyticsOptions.books(
    subject ? accountDocumentId : "",
    username,
    subject?.documentId,
    undefined,
    { variant: "filter", path: location.pathname },
  ));
  useEffect(() => {
    if (subject?.documentId && subjectSlug !== subject.documentId) {
      navigate({
        pathname: publicTaxonomyPath(username ?? "", "books", "subject", subject.documentId),
        search: location.search,
        hash: location.hash,
      }, { replace: true });
    }
  }, [location.hash, location.search, navigate, subject?.documentId, subjectSlug, username]);

  const handleShare = async () => {
    analytics.trackClick("share-button", { context: "books-filter", filterId: subject?.documentId });
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

  const subjectBooks: RecommendedBook[] = deduplicateBooks(
    data?.recommendedBooks_connection?.nodes,
  );
  const childState = resolvePublicChildState({
    loading,
    error,
    bootstrapReady: Boolean(accountDocumentId && subjectSlug),
    resourceKind: "child",
    entityExists: Boolean(subject),
    empty: Boolean(subject) && subjectBooks.length === 0,
  });

  usePublicRouteLifecycle({
    loading,
    error,
    retry: refetch,
    hasUsableData: Boolean(data),
    empty: childState === "empty",
  });

  const loadPage = useCallback(async (page: number, request: { isCurrent: () => boolean }) => {
    await fetchMore({
      variables: { pagination: { page, pageSize: 200 } },
      updateQuery: (previous, { fetchMoreResult }) => {
        if (!request.isCurrent()) return previous;
        if (!previous.recommendedBooks_connection || !fetchMoreResult?.recommendedBooks_connection) return previous;
        return {
          ...previous,
          recommendedBooks_connection: mergePublicConnectionPage(
            previous.recommendedBooks_connection,
            fetchMoreResult.recommendedBooks_connection,
          ),
        };
      },
    });
  }, [fetchMore]);
  const pagination = usePublicConnectionPagination({
    pageInfo: data?.recommendedBooks_connection?.pageInfo,
    loadPage,
    resetKey: `${accountDocumentId}:${subjectSlug}`,
  });

  const handleBookClick = useCallback((book: RecommendedBook) => {
    analytics.trackClick("book-card", {
      id: book.documentId,
      title: book.title,
      authors: book.authors?.join(", "),
      filterId: subject?.documentId,
      filterName: subjectName,
    });
    setModalState({ open: true, book });
  }, [analytics, subject?.documentId, subjectName]);

  const pageTitle = `${subjectName} Books | ${username}'s Book List | explorers`;
  const metaDescription = `Explore ${subjectBooks.length} book${subjectBooks.length !== 1 ? "s" : ""} on ${subjectName} recommended by ${username} on explorers.`;
  const seoKeywords = [subjectName, "books", `${username} books`, "explorers"];

  if (childState === "redirect") return <PublicProfileFallbackRedirect expectedGeneration={requestGeneration} />;
  if (!data) return null;

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
        <PublicConnectionPaginationControl
          hasNextPage={pagination.hasNextPage}
          isLoading={pagination.isLoadingNextPage}
          error={pagination.nextPageError}
          onLoadMore={() => void pagination.loadNextPage()}
          onRetry={() => void pagination.retryNextPage()}
          labelKey="sections.productCategories.categories.2.label"
        />
      </div>

      <BookDetailModal
        book={modalState.book}
        open={modalState.open}
        onClose={() => setModalState({ open: false, book: null })}
        onShare={(id) => analytics.trackClick("share-button", { context: "books-filter-detail", id })}
      />
      </div>
    </>
  );
};

export default PublicBookSubject;
