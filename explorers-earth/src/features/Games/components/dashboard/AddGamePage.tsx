import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation } from "@apollo/client";
import {
  ArrowLeft, Search, Star, Upload, X, Loader2, Check,
  Gamepad2
} from "lucide-react";
import { toast } from "sonner";
import useAuthStore from "../../../../store/store";
import { GAMES_BY_LIST, GAME_CATEGORIES } from "../../api/query";
import {
  CREATE_RECOMMENDED_GAME, UPDATE_RECOMMENDED_GAME,
} from "../../api/mutation";
import igdbService, { type MappedGame } from "../../../../services/igdbService";
import { IGDBSearchResult } from "../../../../types/igdbTypes";
import { generateGameUploadPath, generateRandomFileName } from "../../../../utils/uploadPathGenerator";
import { deduplicateGames } from "../../utils/gameHelpers";
import type { RecommendedGame } from "../../types";
import TiptapEditor from "../../../Favorites/components/TiptapEditor";
import axios from "axios";

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

interface InlineSearchProps {
  onSelect: (item: IGDBSearchResult) => void;
}

const InlineSearch = ({ onSelect }: InlineSearchProps) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<IGDBSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const items = await igdbService.searchGames(query, 12);
        setResults(items);
      } catch (err: any) {
        setResults([]);
        console.error("Search error:", err);
        toast.error(err.message || "Failed to search for games");
      } finally {
        setLoading(false);
      }
    }, 500);
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
          placeholder="Search for a game..."
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 transition-colors"
        />
        {loading && (
          <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 animate-spin" />
        )}
      </div>

      {results.length > 0 && (
        <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
          {results.map((item) => {
            const thumb = igdbService.getCoverUrl(item.cover?.image_id, 'cover_small');
            const dev = igdbService.extractDeveloper(item.involved_companies);
            const year = igdbService.igdbTimestampToYear(item.first_release_date);
            const rating = igdbService.formatIgdbRating(item.total_rating);
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
                      <Gamepad2 size={14} className="text-white/20" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{item.name}</p>
                  <p className="text-xs text-white/50 truncate">{dev || "Unknown Developer"}</p>
                  {year && <p className="text-[11px] text-white/30">{year}</p>}
                </div>
                {rating && (
                  <span className="text-xs text-blue-400 flex-shrink-0 flex items-center gap-0.5">
                    <Star size={10} fill="currentColor" /> {rating}
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

const AddGamePage = () => {
  const { listId, gameId } = useParams<{ listId: string; gameId?: string }>();
  const navigate = useNavigate();
  const { user, token } = useAuthStore();
  const isEdit = Boolean(gameId);

  const [selectedGame, setSelectedGame] = useState<MappedGame | null>(null);
  const [note, setNote] = useState<any>("");
  const [userRating, setUserRating] = useState<number | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [newSnapshots, setNewSnapshots] = useState<File[]>([]);
  const [existingSnapshots, setExistingSnapshots] = useState<{ id: string; url: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [categoryId, setCategoryId] = useState<string>("");

  const username: string = (user as any)?.username || "";

  const { data: listData } = useQuery(GAMES_BY_LIST, {
    variables: { gameListDocumentId: listId, page: 0, pageSize: 200 },
    skip: !listId,
  });
  const existingGames: RecommendedGame[] = deduplicateGames(listData?.gameLists?.[0]?.recommended_games);

  const { data: categoriesData } = useQuery(GAME_CATEGORIES);
  const categories: { documentId: string; genre_name: string }[] = categoriesData?.gameCategories || [];

  useEffect(() => {
    if (isEdit && gameId && existingGames.length > 0) {
      const game = existingGames.find((b) => b.documentId === gameId);
      if (game) {
        setSelectedGame({
          igdb_id: game.igdb_id,
          igdb_slug: game.igdb_slug ?? null,
          title: game.title,
          cover_url: game.cover_url ?? null,
          cover_url_large: game.cover_url_large ?? null,
          igdb_image_id: game.igdb_image_id ?? null,
          summary: game.summary ?? null,
          release_date: game.release_date ?? null,
          release_year: game.release_year ?? null,
          igdb_rating: game.igdb_rating ?? null,
          igdb_rating_count: game.igdb_rating_count ?? null,
          genres: game.genres ?? [],
          platforms: game.platforms ?? [],
          developer: game.developer ?? null,
          publisher: game.publisher ?? null,
          game_modes: game.game_modes ?? [],
          screenshot_ids: game.screenshot_ids ?? [],
          igdb_url: game.igdb_url ?? null,
        });
        setNote(game.user_recommendation_note ?? "");
        setUserRating(game.user_rating ?? null);
        setIsPinned(game.is_pinned ?? false);
        setExistingSnapshots(game.media_details?.imageDetails ?? []);
        if (game.game_categories && game.game_categories.length > 0) {
          setCategoryId(game.game_categories[0].documentId);
        }
      }
    }
  }, [isEdit, gameId, existingGames.length]);

  const [createRecommendedGame] = useMutation(CREATE_RECOMMENDED_GAME);
  const [updateRecommendedGame] = useMutation(UPDATE_RECOMMENDED_GAME);

  const handleSelectGame = useCallback(async (item: IGDBSearchResult) => {
    let detailedItem = item;
    try {
      setUploadingCover(true);
      const details = await igdbService.getGameDetails(item.id);
      if (details) detailedItem = details;
    } catch {
      // ignore
    } finally {
      setUploadingCover(false);
    }
    
    const mapped = igdbService.transformIgdbResult(detailedItem);
    setSelectedGame(mapped);

    // Auto map genre
    if (categories.length > 0 && mapped.genres.length > 0) {
      const matched = categories.find(c => c.genre_name === mapped.genres[0]);
      if (matched) setCategoryId(matched.documentId);
    }
  }, [categories]);

  const handleSave = async () => {
    if (!selectedGame || !listId) return;
    setSaving(true);
    try {
      let finalCoverUrl = selectedGame.cover_url;
      let finalThumbnailUrl = selectedGame.cover_url_large;
      const TOKEN = token;

      // Function to download image as blob through a reliable proxy or direct fetch
      const downloadImageBlob = async (url: string) => {
        try {
          // First attempt: Direct fetch (works for some CDNs with wildcard CORS)
          const directResponse = await axios.get(url, { responseType: 'blob', timeout: 5000 }).catch(() => null);
          if (directResponse?.data) return directResponse.data;
          
          // Fallback: AllOrigins (reliable public proxy)
          const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
          const proxyResponse = await axios.get(proxyUrl, { responseType: 'blob', timeout: 10000 });
          return proxyResponse.data;
        } catch (err) {
          console.warn(`Failed to download image from ${url}:`, err);
          return null;
        }
      };

      const fullDirPath = generateGameUploadPath(username || "user", listId, String(selectedGame.igdb_id), "dummy.jpg");
      const directoryPath = fullDirPath.substring(0, fullDirPath.lastIndexOf('/'));

      // 1. Upload external IGDB covers to S3
      if (!isEdit && selectedGame.cover_url?.startsWith("http")) {
        try {
          setUploadingCover(true);
          const coverFilename = generateRandomFileName("cover", "jpg");
          const thumbFilename = generateRandomFileName("thumb", "jpg");

          const [coverBlob, thumbBlob] = await Promise.all([
            downloadImageBlob(selectedGame.cover_url),
            downloadImageBlob(selectedGame.cover_url_large || selectedGame.cover_url),
          ]);

          if (coverBlob) {
            const coverFile = new File([coverBlob], coverFilename, { type: "image/jpeg" });
            finalCoverUrl = await uploadFileToStrapi(coverFile, directoryPath, TOKEN);
          }
          if (thumbBlob) {
            const thumbFile = new File([thumbBlob], thumbFilename, { type: "image/jpeg" });
            finalThumbnailUrl = await uploadFileToStrapi(thumbFile, directoryPath, TOKEN);
          }
        } catch (err) {
          console.error("Failed to upload game covers to S3:", err);
        } finally {
          setUploadingCover(false);
        }
      }

      const uploadedSnapshots: { id: string; url: string }[] = [...existingSnapshots];

      // 2. Upload IGDB screenshots to S3 only on create
      if (!isEdit && selectedGame.screenshot_ids && selectedGame.screenshot_ids.length > 0 && uploadedSnapshots.length === 0) {
        try {
          // Upload top 8 screenshots to save space/time but still look great
          const ssUploadPromises = selectedGame.screenshot_ids.slice(0, 8).map(async (id) => {
            const ssUrl = `https://images.igdb.com/igdb/image/upload/t_720p/${id}.jpg`;
            const blob = await downloadImageBlob(ssUrl);
            if (blob) {
              const filename = `ss_${id}.jpg`;
              const file = new File([blob], filename, { type: "image/jpeg" });
              const s3Url = await uploadFileToStrapi(file, directoryPath, TOKEN);
              return { id: filename, url: s3Url };
            }
            return null;
          });

          const results = await Promise.all(ssUploadPromises);
          results.forEach(res => {
            if (res) uploadedSnapshots.push(res);
          });
        } catch (err) {
          console.error("Failed to upload IGDB screenshots:", err);
        }
      }

      // 3. Handle user manual photo uploads
      for (const file of newSnapshots) {
        try {
          const filename = generateRandomFileName(file.name);
          const fullPath = generateGameUploadPath(username || "user", listId, String(selectedGame.igdb_id), filename);
          const dirPath = fullPath.substring(0, fullPath.lastIndexOf('/'));
          const TOKEN = token;
          const url = await uploadFileToStrapi(file, dirPath, TOKEN);
          if (url) {
            uploadedSnapshots.push({ id: filename, url });
          }
        } catch (err) {
          console.error("Manual game snapshot upload failed:", err);
          toast.error(`Failed to upload snapshot: ${file.name}`);
        }
      }

      const mediaDetails = uploadedSnapshots.length > 0 ? { imageDetails: uploadedSnapshots } : null;

      if (isEdit && gameId) {
        await updateRecommendedGame({
          variables: {
            documentId: gameId,
            user_recommendation_note: note || null,
            user_rating: userRating,
            is_pinned: isPinned,
            pin_order: isPinned ? 0 : null,
            media_details: mediaDetails,
            game_categories: categoryId ? [categoryId] : null,
          },
        });
        toast.success("Game updated!");
      } else {
        const displayOrder = existingGames.length;
        await createRecommendedGame({
          variables: {
            igdb_id: selectedGame.igdb_id,
            igdb_slug: selectedGame.igdb_slug,
            title: selectedGame.title,
            igdb_image_id: selectedGame.igdb_image_id,
            cover_url: finalCoverUrl || null,
            cover_url_large: finalThumbnailUrl || null,
            summary: selectedGame.summary,
            release_date: selectedGame.release_date,
            release_year: selectedGame.release_year,
            igdb_rating: selectedGame.igdb_rating,
            igdb_rating_count: selectedGame.igdb_rating_count,
            genres: selectedGame.genres,
            platforms: selectedGame.platforms,
            developer: selectedGame.developer,
            publisher: selectedGame.publisher,
            game_modes: selectedGame.game_modes,
            screenshot_ids: selectedGame.screenshot_ids,
            igdb_url: selectedGame.igdb_url,
            user_recommendation_note: note || null,
            user_rating: userRating,
            is_pinned: isPinned,
            pin_order: isPinned ? 0 : null,
            display_order: displayOrder,
            game_list: listId,
            game_categories: categoryId ? [categoryId] : null,
            media_details: mediaDetails,
          },
        });
        toast.success("Game added to list!");
      }
      navigate(`/recommendations/games/${listId}`);
    } catch {
      toast.error("Failed to save game");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen text-dashboard">
      <div className="border-b border-dashboard-border px-4 md:px-6 py-3 flex items-center gap-3 sticky top-0 bg-dashboard-bg z-40 w-full">
        <button
          onClick={() => navigate(`/recommendations/games/${listId}`)}
          className="text-white/40 hover:text-white transition-colors flex-shrink-0"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm md:text-base font-semibold text-dashboard truncate">
            {isEdit ? "Edit Game" : "Add Game"}
          </h1>
          <p className="text-[10px] md:text-xs text-dashboard-muted mt-0.5 truncate">
            {isEdit
              ? "Update the details and save your changes"
              : selectedGame
                ? "Edit the details below before saving"
                : "Search and select a title from IGDB"}
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 pt-4 pb-32 space-y-6">
        {!selectedGame ? (
          <div className="bg-dashboard-sidebar rounded-2xl p-4 border border-dashboard-border shadow-2xl space-y-4">
            <InlineSearch onSelect={handleSelectGame} />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-dashboard-sidebar rounded-2xl overflow-hidden border border-dashboard-border shadow-xl">
              <div className="flex flex-col sm:flex-row p-4 md:p-5 gap-4 md:gap-5">
                <div className="w-24 md:w-32 flex-shrink-0 mx-auto sm:mx-0 shadow-lg rounded-lg overflow-hidden relative bg-white/5">
                  {(selectedGame.cover_url_large || selectedGame.cover_url) ? (
                    <img src={selectedGame.cover_url_large || selectedGame.cover_url!} alt={selectedGame.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full aspect-[3/4] flex items-center justify-center">
                      <Gamepad2 size={24} className="text-white/20" />
                    </div>
                  )}
                  {uploadingCover && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                      <Loader2 size={24} className="text-blue-400 animate-spin" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 py-1 text-center sm:text-left">
                  <h2 className="text-xl font-bold text-white leading-tight mb-1">{selectedGame.title}</h2>
                  <p className="text-sm text-dashboard-muted mb-2">
                    {selectedGame.developer}
                    {selectedGame.release_year ? ` • ${selectedGame.release_year}` : ""}
                  </p>
                  <p className="text-xs text-dashboard-muted line-clamp-3 md:line-clamp-4 leading-relaxed mb-4">
                    {selectedGame.summary}
                  </p>
                  {!isEdit && (
                    <button onClick={() => setSelectedGame(null)} className="text-xs text-blue-400 hover:text-blue-300 font-semibold px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 transition-colors">
                      Choose different game
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-dashboard-sidebar rounded-2xl p-6 border border-dashboard-border shadow-xl space-y-6">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Star size={16} className="text-blue-400" /> 
                My Review
              </h3>
              
              <div className="space-y-6">
                <div>
                  <label className="text-sm font-semibold text-dashboard mb-3 block">My Rating (Optional)</label>
                  <div className="flex flex-wrap gap-1 md:gap-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setUserRating(star === userRating ? null : star)}
                        className={`p-1 transition-all hover:scale-110 active:scale-95 ${userRating && userRating >= star ? "text-yellow-400" : "text-white/20 hover:text-white/40"}`}
                      >
                        <Star size={20} className="md:w-6 md:h-6" fill={userRating && userRating >= star ? "currentColor" : "none"} />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-dashboard mb-3 block">Category</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full bg-dashboard-muted border border-dashboard-border rounded-xl px-4 py-3 text-sm text-dashboard focus:outline-none focus:border-dashboard-accent appearance-none transition-colors"
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.documentId} value={c.documentId}>{c.genre_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-dashboard mb-3 block">My Thoughts</label>
                  <div className="focus-within:border-dashboard-accent transition-colors max-w-full overflow-hidden">
                    <TiptapEditor
                      value={note || ""}
                      onChange={(val) => setNote(val)}
                      placeholder="Why do you recommend this game?"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-dashboard-border">
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-white">Pin to Top Picks</h4>
                    <p className="text-xs text-dashboard-muted">Show this game prominently at the top of your list</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPinned(!isPinned)}
                    className={`w-12 h-6 rounded-full relative transition-colors ${isPinned ? "bg-blue-600" : "bg-white/20"}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${isPinned ? "left-7" : "left-1"}`} />
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-dashboard-sidebar rounded-2xl p-6 border border-dashboard-border shadow-xl">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-5">Personal Photos</h3>
              <p className="text-xs text-dashboard-muted mb-4">Add your own screenshots or photos of your physical copy.</p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {existingSnapshots.map((snap) => (
                  <div key={snap.id} className="relative aspect-square rounded-xl overflow-hidden border border-dashboard-border group">
                    <img src={snap.url.startsWith("http") ? snap.url : `${import.meta.env.VITE_REST_API_URL?.replace("/api", "") || "http://localhost:1337"}${snap.url}`} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setExistingSnapshots(s => s.filter(x => x.id !== snap.id))}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white/70 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                
                {newSnapshots.map((file, i) => (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-dashboard-border group">
                    <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setNewSnapshots(s => s.filter((_, idx) => idx !== i))}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white/70 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                
                <label className="aspect-square rounded-xl border-2 border-dashed border-dashboard-border hover:border-dashboard-accent flex flex-col items-center justify-center text-dashboard-muted hover:text-dashboard transition-colors cursor-pointer bg-white/5">
                  <Upload size={20} className="mb-2" />
                  <span className="text-xs font-semibold">Upload</span>
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) {
                        setNewSnapshots(prev => [...prev, ...Array.from(e.target.files!)]);
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
                  onClick={() => navigate(`/recommendations/games/${listId}`)}
                  className="px-6 py-3 rounded-xl bg-dashboard-muted hover:bg-white/10 text-sm text-white font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-dashboard-accent hover:opacity-90 text-sm text-white font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  {isEdit ? "Save Changes" : "Add to List"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddGamePage;
