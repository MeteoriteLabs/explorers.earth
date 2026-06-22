import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation } from "@apollo/client";
import {
  ArrowLeft, Search, Star, Upload, X, Loader2, Check,
  BookOpen, Calendar, Hash, ExternalLink, Plus,
} from "lucide-react";
import { toast } from "sonner";
import useAuthStore from "../../../../store/store";
import { BOOKS_BY_LIST, booksByListVars, refetchBooksByList } from "../../api/query";
import {
  CREATE_RECOMMENDED_BOOK, UPDATE_RECOMMENDED_BOOK,
} from "../../api/mutation";
import googleBooksService, { type GoogleBooksItem, type MappedBook } from "../../../../services/googleBooksService";
import { generateBookUploadPath, generateRandomFileName } from "../../../../utils/uploadPathGenerator";
import { deduplicateBooks } from "../../utils/bookHelpers";
import type { RecommendedBook, BuyLink } from "../../types";
import TiptapEditor from "../../../Favorites/components/TiptapEditor";
import axios from "axios";


// ─────────────────────────────────────────────────────────────
// S3 upload helper (reused pattern from Movies)
// ─────────────────────────────────────────────────────────────
async function uploadFileToStrapi(file: File, path: string, token: string | null): Promise<string> {
  const formData = new FormData();
  formData.append("files", file);
  formData.append("path", path);

  const res = await axios.post(`${import.meta.env.VITE_REST_API_URL}/upload`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  return res.data[0]?.url ?? "";
}

// ─────────────────────────────────────────────────────────────
// Inline Google Books Search Component
// ─────────────────────────────────────────────────────────────
interface InlineSearchProps {
  onSelect: (item: GoogleBooksItem) => void;
}

const InlineSearch = ({ onSelect }: InlineSearchProps) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GoogleBooksItem[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const items = await googleBooksService.searchBooks(query, 12);
        setResults(items);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title, author, or ISBN..."
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400/50 transition-colors"
        />
        {loading && (
          <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 animate-spin" />
        )}
      </div>

      {results.length > 0 && (
        <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
          {results.map((item) => {
            const vi = item.volumeInfo;
            const thumb = googleBooksService.getThumbnailUrl(vi);
            const authors = googleBooksService.formatAuthors(vi.authors);
            const year = googleBooksService.extractYear(vi.publishedDate);
            return (
              <button
                key={item.id}
                onClick={() => onSelect(item)}
                className="flex items-center gap-3 w-full text-left p-2.5 rounded-xl hover:bg-white/6 transition-colors border border-transparent hover:border-white/10"
              >
                <div className="w-10 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-white/5">
                  {thumb ? (
                    <img src={thumb} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen size={14} className="text-white/20" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{vi.title}</p>
                  <p className="text-xs text-white/50 truncate">{authors}</p>
                  {year && <p className="text-[11px] text-white/30">{year}</p>}
                </div>
                {vi.averageRating && (
                  <span className="text-xs text-amber-400 flex-shrink-0 flex items-center gap-0.5">
                    <Star size={10} fill="currentColor" /> {vi.averageRating}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {!loading && query.trim() && results.length === 0 && (
        <p className="text-sm text-white/30 text-center py-4">No results found for "{query}"</p>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Main AddBookPage
// ─────────────────────────────────────────────────────────────
const AddBookPage = () => {
  const { listId, bookId } = useParams<{ listId: string; bookId?: string }>();
  const navigate = useNavigate();
  const { user, token } = useAuthStore();
  const isEdit = Boolean(bookId);

  // Form state
  const [selectedBook, setSelectedBook] = useState<MappedBook | null>(null);
  const [note, setNote] = useState<any>("");
  const [userRating, setUserRating] = useState<number | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [buyLinks, setBuyLinks] = useState<BuyLink[]>([]);
  const [newLinkName, setNewLinkName] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newSnapshots, setNewSnapshots] = useState<File[]>([]);
  const [existingSnapshots, setExistingSnapshots] = useState<{ id: string; url: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const username: string = (user as any)?.username || "";

  // Load existing book list (for display_order)
  const { data: listData } = useQuery(BOOKS_BY_LIST, {
    variables: booksByListVars(listId ?? ""),
    skip: !listId,
  });
  const existingBooks: RecommendedBook[] = deduplicateBooks(listData?.bookLists?.[0]?.recommended_books);

  // Load book for edit mode
  useEffect(() => {
    if (isEdit && bookId && existingBooks.length > 0) {
      const book = existingBooks.find((b) => b.documentId === bookId);
      if (book) {
        setSelectedBook({
          volume_id: book.volume_id,
          title: book.title,
          subtitle: book.subtitle ?? null,
          authors: book.authors ?? [],
          year: book.year ?? "",
          cover_url: book.cover_url ?? "",
          cover_url_large: book.cover_url_large ?? "",
          subjects: book.subjects ?? [],
          publisher: book.publisher ?? null,
          page_count: book.page_count ?? null,
          google_rating: book.google_rating ?? null,
          description: book.description ?? null,
          isbn_13: book.isbn_13 ?? "",
          preview_link: book.preview_link ?? null,
          google_books_buy_link: null,
        });
        setNote(book.user_recommendation_note ?? "");
        setUserRating(book.user_rating ?? null);
        setIsPinned(book.is_pinned ?? false);
        setBuyLinks(book.buy_links ?? []);
        setExistingSnapshots(book.media_details?.imageDetails ?? []);
      }
    }
  }, [isEdit, bookId, existingBooks.length]);

  const [createRecommendedBook] = useMutation(CREATE_RECOMMENDED_BOOK);
  const [updateRecommendedBook] = useMutation(UPDATE_RECOMMENDED_BOOK);

  const handleSelectBook = useCallback((item: GoogleBooksItem) => {
    const mapped = googleBooksService.transformVolumeToBook(item);
    setSelectedBook(mapped);
    // Auto-populate buy link from Google Books
    if (mapped.google_books_buy_link) {
      setBuyLinks([{ name: "Google Books", url: mapped.google_books_buy_link, logo: "google-books" }]);
    }
  }, []);

  const handleAddBuyLink = () => {
    if (!newLinkUrl.trim()) return;
    setBuyLinks((prev) => [
      ...prev,
      { name: newLinkName.trim() || "Link", url: newLinkUrl.trim() },
    ]);
    setNewLinkName("");
    setNewLinkUrl("");
  };

  const handleSave = async () => {
    if (!selectedBook || !listId) return;
    setSaving(true);
    try {
      let finalCoverUrl = selectedBook.cover_url;
      let finalThumbnailUrl = selectedBook.cover_url_large;

      // For create mode: upload cover + thumbnail to S3
      if (!isEdit && selectedBook.cover_url?.startsWith("http")) {
        try {
          setUploadingCover(true);
          const coverFilename = generateRandomFileName("cover", "jpg");
          const thumbFilename = generateRandomFileName("thumb", "jpg");
          const fullCoverPath = generateBookUploadPath(username || "user", listId, selectedBook.volume_id, coverFilename);
          const directoryPath = fullCoverPath.substring(0, fullCoverPath.lastIndexOf('/'));

          const TOKEN = token;
          const qrtoken = localStorage.getItem('qrtoken');
          const PROXY_BASE = import.meta.env.VITE_INSTAGRAM_API_URL || 'http://localhost:5000';

          // Use the backend proxy for Google Books images to bypass CORS restrictions
          const buildProxyUrl = (url: string) => 
            `${PROXY_BASE}/api/instagram/media-proxy?url=${encodeURIComponent(url)}${qrtoken ? `&token=${qrtoken}` : ''}`;

          const [coverRes, thumbRes] = await Promise.all([
            axios.get(buildProxyUrl(selectedBook.cover_url), { responseType: 'blob' }).catch(() => null),
            axios.get(buildProxyUrl(selectedBook.cover_url_large || selectedBook.cover_url), { responseType: 'blob' }).catch(() => null),
          ]);

          if (coverRes?.data) {
            const coverFile = new File([coverRes.data], coverFilename, { type: "image/jpeg" });
            finalCoverUrl = await uploadFileToStrapi(coverFile, directoryPath, TOKEN);
          }
          if (thumbRes?.data) {
            const thumbFile = new File([thumbRes.data], thumbFilename, { type: "image/jpeg" });
            finalThumbnailUrl = await uploadFileToStrapi(thumbFile, directoryPath, TOKEN);
          }
        } catch (err) {
          console.error("Failed to upload book covers to S3:", err);
          // Fallback: keep original Google Books URL if re-upload fails
        } finally {
          setUploadingCover(false);
        }
      }

      // Upload manual snapshots
      const uploadedSnapshots: { id: string; url: string }[] = [...existingSnapshots];
      for (const file of newSnapshots) {
        try {
          const filename = generateRandomFileName(file.name);
          const fullPath = generateBookUploadPath(username || "user", listId, selectedBook.volume_id, filename);
          const dirPath = fullPath.substring(0, fullPath.lastIndexOf('/'));
          const TOKEN = token;
          const url = await uploadFileToStrapi(file, dirPath, TOKEN);
          if (url) {
            uploadedSnapshots.push({ id: filename, url });
          }
        } catch (err) {
          console.error("Manual book snapshot upload failed:", err);
          toast.error(`Failed to upload snapshot: ${file.name}`);
        }
      }

      const mediaDetails = uploadedSnapshots.length > 0 ? { imageDetails: uploadedSnapshots } : null;

      if (isEdit && bookId) {
        await updateRecommendedBook({
          variables: {
            documentId: bookId,
            user_recommendation_note: note || null,
            user_rating: userRating,
            buy_links: buyLinks.length > 0 ? buyLinks : [],
            is_pinned: isPinned,
            pin_order: isPinned ? 0 : null,
            media_details: mediaDetails,
          },
        });
        toast.success("Book updated!");
      } else {
        const displayOrder = existingBooks.length;
        await createRecommendedBook({
          variables: {
            volume_id: selectedBook.volume_id,
            title: selectedBook.title,
            subtitle: selectedBook.subtitle,
            authors: selectedBook.authors,
            year: selectedBook.year || null,
            cover_url: finalCoverUrl || null,
            cover_url_large: finalThumbnailUrl || null,
            subjects: selectedBook.subjects,
            publisher: selectedBook.publisher,
            page_count: selectedBook.page_count,
            google_rating: selectedBook.google_rating,
            description: selectedBook.description,
            isbn_13: selectedBook.isbn_13 || null,
            preview_link: selectedBook.preview_link,
            user_recommendation_note: note || null,
            user_rating: userRating,
            buy_links: buyLinks.length > 0 ? buyLinks : [],
            is_pinned: isPinned,
            pin_order: isPinned ? 0 : null,
            display_order: displayOrder,
            media_details: mediaDetails,
            book_list: listId,
            book_categories: [],
          },
          // Refetch the list view's exact query so the new book is in cache
          // before we navigate back — prevents the stale "empty list until reload".
          refetchQueries: refetchBooksByList(listId ?? ""),
          awaitRefetchQueries: true,
        });
        toast.success("Book added to list!");
      }
      navigate(`/recommendations/books/${listId}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen text-dashboard pb-32">
       {/* Sticky header */}
       <div className="border-b border-dashboard-border px-4 md:px-6 py-3 flex items-center gap-3 sticky top-0 bg-dashboard-bg z-40 w-full">
         <button
           onClick={() => navigate(`/recommendations/books/${listId}`)}
           className="text-white/40 hover:text-white transition-colors"
         >
           <ArrowLeft size={20} />
         </button>
         <div className="flex-1">
           <h1 className="text-base font-semibold text-dashboard">
             {isEdit ? "Edit Book" : "Add a Book"}
           </h1>
           <p className="text-xs text-dashboard-muted mt-0.5">
              {isEdit ? "Update the details and save your changes" : selectedBook ? "Edit the details below before saving" : "Find a book using Google Books"}
           </p>
         </div>
       </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 md:px-0">
        {/* Step 1: Search */}
        {!isEdit && (
          <div className="mb-4 bg-dashboard-sidebar border border-dashboard-border rounded-2xl p-4">
          {selectedBook ? (
            <div className="flex items-center gap-3">
              <div className="w-12 h-16 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
                {selectedBook.cover_url_large || selectedBook.cover_url ? (
                  <img
                    src={selectedBook.cover_url_large || selectedBook.cover_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <BookOpen size={16} className="text-white/20" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{selectedBook.title}</p>
                {selectedBook.subtitle && (
                  <p className="text-xs text-white/40 truncate">{selectedBook.subtitle}</p>
                )}
                <p className="text-xs text-white/50">{googleBooksService.formatAuthors(selectedBook.authors)}</p>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-white/30">
                  {selectedBook.year && <span className="flex items-center gap-0.5"><Calendar size={9} /> {selectedBook.year}</span>}
                  {selectedBook.page_count && <span className="flex items-center gap-0.5"><Hash size={9} /> {selectedBook.page_count}p</span>}
                  {selectedBook.google_rating && (
                    <span className="flex items-center gap-0.5 text-amber-400">
                      <Star size={9} fill="currentColor" /> {selectedBook.google_rating}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => { setSelectedBook(null); setBuyLinks([]); }}
                className="text-white/30 hover:text-white transition-colors flex-shrink-0"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <InlineSearch onSelect={handleSelectBook} />
          )}
        </div>
      )}

      {/* Selected book preview in edit mode */}
      {isEdit && selectedBook && (
        <div className="flex items-center gap-3 mb-6 bg-dashboard-sidebar border border-dashboard-border rounded-2xl p-4">
          <div className="w-12 h-16 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
            {selectedBook.cover_url_large || selectedBook.cover_url ? (
              <img src={selectedBook.cover_url_large || selectedBook.cover_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <BookOpen size={16} className="text-white/20" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{selectedBook.title}</p>
            <p className="text-xs text-white/50">{googleBooksService.formatAuthors(selectedBook.authors)}</p>
          </div>
        </div>
      )}

      {/* Form fields (only shown once a book is selected) */}
      {(selectedBook || isEdit) && (
        <div className="space-y-5">
          <div className="border-t border-dashboard-border pt-1">
            <p className="text-xs text-dashboard-muted uppercase tracking-wider mb-4 font-medium">
              Your Details
            </p>
          </div>

          {/* Personal note */}
          <div>
            <label className="text-sm font-semibold text-dashboard mb-2 block">
              Your Recommendation Note (optional)
            </label>
            <div className="focus-within:border-dashboard-accent transition-colors">
              <TiptapEditor
                value={note}
                initalValue={note}
                onChange={(val: string) => setNote(val)}
                placeholder="Why do you recommend this book? What makes it special?"
              />
            </div>
          </div>

          {/* User Rating */}
          <div className="mt-4">
            <label className="text-sm font-semibold text-dashboard mb-2 block">Your Rating</label>
            <div className="flex gap-1.5 flex-wrap">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setUserRating(userRating === star ? null : star)}
                  className={`p-1 transition-all hover:scale-110 active:scale-95 ${userRating && userRating >= star ? "text-amber-400" : "text-white/20 hover:text-white/40"}`}
                >
                  <Star size={24} fill={userRating && userRating >= star ? "currentColor" : "none"} />
                </button>
              ))}
            </div>
            {userRating && (
              <p className="text-xs text-white/30 mt-1">{userRating}/10</p>
            )}
          </div>

          {/* Pin to Top Reads */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPinned(!isPinned)}
              className={`w-5 h-5 rounded border transition-all flex items-center justify-center ${isPinned
                ? "bg-amber-500 border-amber-500"
                : "border-white/20 hover:border-amber-400/50"
                }`}
            >
              {isPinned && <Check size={12} className="text-gray-900" />}
            </button>
            <label className="text-sm text-dashboard cursor-pointer" onClick={() => setIsPinned(!isPinned)}>
              Pin to Top Reads
            </label>
          </div>

          {/* Buy / Find Links */}
          <div>
            <label className="text-sm font-semibold text-dashboard mb-2 block">Where to Find / Buy (optional)</label>
            {buyLinks.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {buyLinks.map((link, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2">
                    <ExternalLink size={12} className="text-white/40 flex-shrink-0" />
                    <span className="text-xs text-white/70 flex-1 truncate">{link.name}: {link.url}</span>
                    <button
                      onClick={() => setBuyLinks((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-white/30 hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              <input
                type="text"
                value={newLinkName}
                onChange={(e) => setNewLinkName(e.target.value)}
                placeholder="Name (e.g. Amazon)"
                className="flex-1 min-w-[120px] bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400/50 transition-colors"
              />
              <input
                type="url"
                value={newLinkUrl}
                onChange={(e) => setNewLinkUrl(e.target.value)}
                placeholder="https://..."
                onKeyDown={(e) => e.key === "Enter" && handleAddBuyLink()}
                className="flex-1 min-w-[160px] bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400/50 transition-colors"
              />
              <button
                onClick={handleAddBuyLink}
                disabled={!newLinkUrl.trim()}
                className="px-3 py-2 rounded-xl bg-white/8 hover:bg-white/12 text-white/70 text-xs disabled:opacity-40 transition-colors flex items-center gap-1"
              >
                <Plus size={12} /> Add
              </button>
            </div>
          </div>

          {/* Manual Snapshots */}
          <div>
            <label className="text-sm font-semibold text-dashboard mb-3 block">
              Photos (optional)
            </label>
            <div className="flex flex-col gap-3">
              {existingSnapshots.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {existingSnapshots.map((snap) => (
                    <div key={snap.id} className="relative w-24 h-24 rounded-xl overflow-hidden shadow-sm group">
                      <img
                        src={snap.url.startsWith("http") ? snap.url : `${import.meta.env.VITE_REST_API_URL?.replace("/api", "") || "http://localhost:1337"}${snap.url}`}
                        className="w-full h-full object-cover"
                        alt=""
                      />
                      <button
                        type="button"
                        onClick={() => setExistingSnapshots((prev) => prev.filter((s) => s.id !== snap.id))}
                        className="absolute top-1 right-1 bg-black/60 p-1 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {newSnapshots.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {newSnapshots.map((file, i) => (
                    <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden shadow-sm group border border-white/10">
                      <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" alt="" />
                      <button
                        type="button"
                        onClick={() => setNewSnapshots((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute top-1 right-1 bg-black/60 p-1 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="w-full md:w-auto self-start cursor-pointer flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 border-dashed rounded-xl px-5 py-3 text-sm text-white/70 transition-colors">
                <Upload size={16} className="text-white/50" />
                <span>Upload Images</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) {
                      setNewSnapshots((prev) => [...prev, ...Array.from(e.target.files!)]);
                    }
                  }}
                />
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-dashboard-border">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => navigate(`/recommendations/books/${listId}`)}
                className="px-6 py-3 rounded-xl bg-dashboard-muted hover:bg-white/10 text-sm text-white font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || (!selectedBook && !isEdit)}
                className="flex-1 py-3 rounded-xl bg-dashboard-accent hover:opacity-90 text-sm text-white font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {saving || uploadingCover ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    {uploadingCover ? "Uploading cover..." : "Saving..."}
                  </>
                ) : (
                  <>
                    <Check size={15} />
                    {isEdit ? "Save Changes" : "Add to List"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default AddBookPage;
