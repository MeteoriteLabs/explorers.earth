import { useState, useCallback, useEffect } from "react";
import { useParams, useOutletContext } from "react-router-dom";
import { useQuery, gql } from "@apollo/client";
import { ArrowLeft, Share2 } from "lucide-react";
import { toast } from "sonner";
import { BOOKS_BY_SUBJECT } from "../../api/query";
import { deduplicateBooks, slugToSubjectName } from "../../utils/bookHelpers";
import type { RecommendedBook } from "../../types";
import BookCoverCard from "./BookCoverCard";
import BookDetailModal from "./BookDetailModal";
import SEO from "../../../../components/SEO";
import { createCanonicalUrl } from "../../../../utils/getCurrentDomain";

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

const PublicBookSubject = () => {
  const { username, subjectSlug } = useParams<{ username: string; subjectSlug: string }>();
  const outletContext = useOutletContext<{ setIsPageLoaded?: (val: boolean) => void } | null>();
  const subjectName = slugToSubjectName(subjectSlug ?? "");

  const { data: userLookup } = useQuery(ACCOUNT_BY_USERNAME, {
    variables: { username },
    skip: !username,
  });

  const accountDocumentId = userLookup?.usersPermissionsUsers?.[0]?.accounts?.[0]?.documentId;

  const [modalState, setModalState] = useState<{ open: boolean; book: RecommendedBook | null }>({
    open: false,
    book: null,
  });

  const { data, loading } = useQuery(BOOKS_BY_SUBJECT, {
    variables: { accountDocumentId },
    skip: !accountDocumentId,
    fetchPolicy: "cache-and-network",
  });

  useEffect(() => {
    if (!loading) {
      outletContext?.setIsPageLoaded?.(true);
    }
  }, [loading, outletContext]);

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

  const handleBookClick = useCallback((book: RecommendedBook) => {
    setModalState({ open: true, book });
  }, []);

  const pageTitle = `${subjectName} Books | ${username}'s Book List | explorers`;
  const metaDescription = `Explore ${subjectBooks.length} book${subjectBooks.length !== 1 ? "s" : ""} on ${subjectName} recommended by ${username} on explorers.`;
  const seoKeywords = [subjectName, "books", `${username} books`, "explorers"];

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

        {loading && !data ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="aspect-[2/3] bg-white/8 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : subjectBooks.length === 0 ? (
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
