import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@apollo/client";
import { motion } from "framer-motion";
import {
  BookOpen, Plus, Eye, EyeOff, Star, ChevronRight,
  Loader2, X,
} from "lucide-react";
import { toast } from "sonner";
import useAuthStore from "../../../../store/store";
import { BOOK_LISTS_BY_ACCOUNT } from "../../api/query";
import { CREATE_BOOK_LIST, UPDATE_BOOK_LIST } from "../../api/mutation";
import { generateSlug, deduplicateBooks, buildCoverUrl } from "../../utils/bookHelpers";
import type { BookList, RecommendedBook } from "../../types";
import { gql } from "@apollo/client";
import TopReadsHero from "../public/TopReadsHero";
import TopReadsMobileHero from "../public/TopReadsMobileHero";
import TopReadsManager from "./TopReadsManager";
import BookDetailModal from "../public/BookDetailModal";

// Query to get exact account documentId from the usersPermissionsUser relation
const MY_ACCOUNT = gql`
  query MyAccountForBooks($documentId: ID!) {
    usersPermissionsUser(documentId: $documentId) {
      accounts {
        documentId
      }
    }
  }
`;

// ─────────────────────────────────────────────────────────────
// Inline Create List Modal
// ─────────────────────────────────────────────────────────────
interface CreateListModalProps {
  accountDocumentId: string;
  existingCount: number;
  onClose: () => void;
  onCreated: () => void;
}

const CreateListModal = ({ accountDocumentId, existingCount, onClose, onCreated }: CreateListModalProps) => {
  const { user } = useAuthStore();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [createBookList] = useMutation(CREATE_BOOK_LIST);

  const slug = generateSlug(name);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createBookList({
        variables: {
          List_Name: name.trim(),
          list_description: description.trim() || null,
          slug,
          visibility: false,
          display_order: existingCount,
          account: accountDocumentId,
        },
        refetchQueries: [BOOK_LISTS_BY_ACCOUNT],
      });
      toast.success("Book list created!");
      onCreated();
      onClose();
    } catch {
      toast.error("Failed to create list. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4 md:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-dashboard-sidebar rounded-xl border border-dashboard-border p-6 md:p-8 w-full max-w-2xl shadow-2xl"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-dashboard">Create New Book List</h2>
          <button onClick={onClose} className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-dashboard-muted hover:text-dashboard transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="text-sm font-semibold text-dashboard mb-2 block">List Name</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My Favorite Science Fiction"
              className="w-full bg-dashboard-muted border border-dashboard-border rounded-lg px-4 py-3 text-sm text-dashboard placeholder-dashboard-muted focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-dashboard mb-2 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this list about?"
              rows={3}
              className="w-full bg-dashboard-muted border border-dashboard-border rounded-lg px-4 py-3 text-sm text-dashboard placeholder-dashboard-muted focus:outline-none focus:border-amber-500 transition-colors resize-none"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-dashboard mb-2 block">List URL</label>
            <div className="flex items-center gap-2 text-xs text-dashboard-muted overflow-hidden">
              <span className="truncate">/{user?.username}/{slug}</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-dashboard-border">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-lg bg-[#ef4444] hover:bg-[#dc2626] text-sm text-white font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={saving || !name.trim()}
              className="px-6 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-sm text-white font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Create List
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────
// Book List Card
// ─────────────────────────────────────────────────────────────
const BookListCard = ({
  list,
  onOpen,
  onToggleVisibility,
  togglingId,
}: {
  list: BookList;
  onOpen: () => void;
  onToggleVisibility: (id: string, current: boolean) => void;
  togglingId: string | null;
}) => {
  const uniqueBooks = deduplicateBooks(list.recommended_books);
  const bookCount = uniqueBooks.length;
  const pinnedCount = uniqueBooks.filter(b => b.is_pinned).length;
  const previewBooks = uniqueBooks.slice(0, 5);

  return (
    <motion.div
      onClick={onOpen}
      className="bg-dashboard-sidebar border border-white/5 md:border-dashboard-border/30 rounded-2xl p-5 hover:border-white/15 cursor-pointer transition-all group"
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-dashboard truncate">{list.List_Name}</h3>
          {list.list_description && (
            <p className="text-xs text-dashboard-muted mt-0.5 line-clamp-2">{list.list_description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisibility(list.documentId, list.visibility);
            }}
            disabled={togglingId === list.documentId || bookCount === 0}
            className={`text-xs px-2.5 py-1 rounded-full border flex items-center gap-1 transition-all ${
              list.visibility
                ? "border-green-500/40 text-green-400 bg-green-500/10"
                : "border-white/15 text-white/40"
            } disabled:opacity-40`}
          >
            {list.visibility ? <Eye size={11} /> : <EyeOff size={11} />}
            {list.visibility ? "Published" : "Draft"}
          </button>
        </div>
      </div>

      {previewBooks.length > 0 ? (
        <div className="flex gap-1.5 mb-4">
          {previewBooks.map((b) => (
            <div key={b.documentId} className="w-12 rounded-md overflow-hidden flex-shrink-0 bg-white/5 shadow-sm">
              <div className="aspect-[2/3]">
                {b.cover_url ? (
                  <img
                    src={buildCoverUrl(b.cover_url)}
                    alt={b.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-amber-950/20 flex items-center justify-center">
                    <BookOpen size={12} className="text-amber-600/30" />
                  </div>
                )}
              </div>
            </div>
          ))}
          {bookCount > 5 && (
            <div className="w-12 rounded-md flex items-center justify-center bg-white/5 flex-shrink-0 aspect-[2/3]">
              <span className="text-xs text-dashboard-muted font-medium">+{bookCount - 5}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="h-16 rounded-lg bg-white/3 border border-dashed border-dashboard-border flex items-center justify-center mb-4">
          <p className="text-xs text-dashboard-muted">No books yet</p>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-dashboard-muted">
        <div className="flex items-center gap-3">
          <span>{bookCount} book{bookCount !== 1 ? "s" : ""}</span>
          {pinnedCount > 0 && (
            <span className="flex items-center gap-1 text-amber-500/60">
              <Star size={10} fill="currentColor" /> {pinnedCount} pinned
            </span>
          )}
        </div>
        <span className="flex items-center gap-1 text-amber-500 group-hover:text-amber-400 transition-colors font-semibold">
          Open <ChevronRight size={13} />
        </span>
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────
// Main BooksHome Component
// ─────────────────────────────────────────────────────────────
const BooksHome = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showManageTopReads, setShowManageTopReads] = useState(false);
  const [selectedBook, setSelectedBook] = useState<RecommendedBook | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const { data: myAccountData } = useQuery(MY_ACCOUNT, {
    variables: { documentId: user?.documentId },
    skip: !user?.documentId,
  });

  const accountDocumentId: string = myAccountData?.usersPermissionsUser?.accounts?.[0]?.documentId || "";

  const { data, loading, refetch } = useQuery(BOOK_LISTS_BY_ACCOUNT, {
    variables: { accountDocumentId },
    skip: !accountDocumentId,
    fetchPolicy: "cache-and-network",
  });

  const [updateBookList] = useMutation(UPDATE_BOOK_LIST);

  const lists: BookList[] = data?.bookLists ?? [];

  const allBooks = useMemo(() => {
    if (!lists) return [];
    return lists.flatMap(l => l.recommended_books || []);
  }, [lists]);

  const topReads = useMemo(() => {
    return deduplicateBooks(allBooks.filter((b: any) => b.is_pinned))
      .sort((a: any, b: any) => (a.pin_order || 999) - (b.pin_order || 999));
  }, [allBooks]);

  const handleBookClick = (book: any) => {
    setSelectedBook(book);
  };

  const handleToggleVisibility = async (documentId: string, currentVisibility: boolean) => {
    setTogglingId(documentId);
    try {
      await updateBookList({
        variables: { documentId, visibility: !currentVisibility },
        refetchQueries: [BOOK_LISTS_BY_ACCOUNT],
      });
    } catch {
      toast.error("Failed to update visibility.");
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="px-6 pt-8 pb-24 md:p-6 md:pb-6 max-w-4xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-dashboard flex items-center gap-2">
            <BookOpen size={24} className="text-amber-500" /> Books
          </h1>
          <p className="text-sm text-dashboard-light mt-1">
            {lists.length > 0 ? `${lists.length} list${lists.length !== 1 ? "s" : ""}` : "Curate and share your book recommendations"}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-sm text-white font-medium transition-colors shadow-lg shadow-amber-900/30"
        >
          <Plus size={16} /> New List
        </button>
      </div>

      {loading && lists.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-dashboard-muted rounded-2xl h-52 animate-pulse" />
          ))}
        </div>
      ) : lists.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-2xl bg-amber-900/20 border border-amber-800/30 flex items-center justify-center mb-5">
            <BookOpen size={36} className="text-amber-500/60" />
          </div>
          <h2 className="text-lg font-semibold text-dashboard mb-2">No book lists yet</h2>
          <p className="text-sm text-dashboard-light max-w-sm mb-6">
            Create your first book list to start sharing your favorite recommendations.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-sm text-white font-medium transition-colors"
          >
            <Plus size={16} /> Create First List
          </button>
        </div>
      ) : (
        <>
          {/* Top Reads Hero Section */}
          {topReads.length > 0 && (
            <div className="mb-8">
              <div className="hidden lg:block">
                <TopReadsHero 
                  books={topReads} 
                  onBookClick={handleBookClick} 
                  showManageButton={true}
                  onManageClick={() => setShowManageTopReads(true)}
                />
              </div>
              <div className="block lg:hidden">
                <TopReadsMobileHero
                  books={topReads}
                  onBookClick={handleBookClick}
                  showManageButton={true}
                  onManageClick={() => setShowManageTopReads(true)}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lists.map(list => (
              <BookListCard
                key={list.documentId}
                list={list}
                onOpen={() => navigate(`/recommendations/books/${list.documentId}`)}
                onToggleVisibility={handleToggleVisibility}
                togglingId={togglingId}
              />
            ))}
            {/* Add new list card */}
            <motion.button
              onClick={() => setShowCreateModal(true)}
              className="border-2 border-dashed border-dashboard-border rounded-2xl p-5 flex flex-col items-center justify-center gap-2 text-dashboard-muted hover:text-dashboard hover:border-dashboard-border transition-all duration-200 min-h-[160px]"
              whileHover={{ scale: 1.01 }}
            >
              <Plus size={24} />
              <span className="text-sm font-semibold">Add new list</span>
            </motion.button>
          </div>
        </>
      )}

      {/* Modals */}
      {showCreateModal && accountDocumentId && (
        <CreateListModal
          accountDocumentId={accountDocumentId}
          existingCount={lists.length}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => refetch()}
        />
      )}

      {showManageTopReads && (
        <TopReadsManager
          books={topReads}
          allBooks={deduplicateBooks(allBooks)}
          onClose={() => setShowManageTopReads(false)}
          onRefetch={() => refetch()}
        />
      )}

      {selectedBook && (
        <BookDetailModal
          open={!!selectedBook}
          book={selectedBook}
          onClose={() => setSelectedBook(null)}
        />
      )}
    </div>
  );
};

export default BooksHome;
