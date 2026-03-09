// SearchSongs — redesigned unified search bar (tunes)
// Modes: manual search | youtube url | import playlist
// Single row: [icon + input] [action button] [chevron icon only]
import { useState, useCallback, useRef, useEffect } from "react";
import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUserSubscriptionPlanInfo } from "@/lib/strapi-queries";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { MusicLoader } from "@/components/ui/music-loader";
import {
  Search,
  Plus,
  Loader2,
  AlertCircle,
  Check,
  Link as LinkIcon,
  Download,
  ChevronDown,
  ChevronUp,
  ListMusic,
} from "lucide-react";

type SearchMode = "search" | "url" | "import";

type SearchResult = {
  id: { videoId: string };
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: { default: { url: string } };
  };
};

type Props = {
  guestUrl?: string;
  playlistId?: number;
  ownerUsername?: string;
};

function isYouTubeUrl(str: string): boolean {
  if (!str || typeof str !== "string") return false;
  const t = str.trim();
  const patterns = [
    /^https?:\/\/(?:www\.)?(?:youtu\.be|youtube\.com|m\.youtube\.com)/,
    /^youtu\.be\//,
    /^youtube\.com\//,
    /^m\.youtube\.com\//,
  ];
  for (const p of patterns) if (p.test(t)) return true;
  return /^[a-zA-Z0-9_-]{11}$/.test(t);
}

const MODES: { key: SearchMode; label: string; icon: React.ReactNode; placeholder: string; hint: string }[] = [
  {
    key: "search",
    label: "Manual Search",
    icon: <Search className="h-3.5 w-3.5" />,
    placeholder: "Search for songs, artists, or albums...",
    hint: "Search YouTube for songs by title, artist, or keywords",
  },
  {
    key: "url",
    label: "YouTube URL",
    icon: <LinkIcon className="h-3.5 w-3.5" />,
    placeholder: "Paste a YouTube URL or video ID...",
    hint: "Add any YouTube video directly — free & unlimited, no quota used",
  },
  {
    key: "import",
    label: "Import Playlist",
    icon: <ListMusic className="h-3.5 w-3.5" />,
    placeholder: "Paste YouTube Music or Spotify playlist URL...",
    hint: "Import a full YouTube Music or Spotify playlist at once",
  },
];

export default function SearchSongs({ guestUrl, playlistId, ownerUsername }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();

  const usernameForCheck = ownerUsername || user?.username;
  const {
    songRequests,
    songsQuota,
    isLoading: isLoadingSubscription,
    isActivePlan,
  } = useUserSubscriptionPlanInfo(usernameForCheck || undefined);

  const isLimitReached = songsQuota > 0 && songRequests >= songsQuota;
  const isPlanExpired = !isLoadingSubscription && !isActivePlan;

  const [mode, setMode] = useState<SearchMode>("search");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAddingFromUrl, setIsAddingFromUrl] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchId, setSearchId] = useState(Date.now());
  const [hasSearched, setHasSearched] = useState(false);

  const chevronBtnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });

  const currentMode = MODES.find((m) => m.key === mode)!;

  // Position the dropdown at fixed coords relative to the chevron button
  useEffect(() => {
    if (dropdownOpen && chevronBtnRef.current) {
      const rect = chevronBtnRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    }
  }, [dropdownOpen]);

  // Close on outside click
  useEffect(() => {
    const mouseHandler = (e: MouseEvent) => {
      if (chevronBtnRef.current && !chevronBtnRef.current.contains(e.target as Node)) {
        const dropEl = document.getElementById("tunes-search-mode-dropdown");
        if (dropEl && dropEl.contains(e.target as Node)) return;
        setDropdownOpen(false);
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDropdownOpen(false);
    };
    document.addEventListener("mousedown", mouseHandler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", mouseHandler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, []);

  const switchMode = (m: SearchMode) => {
    setMode(m);
    setDropdownOpen(false);
    setInputValue("");
    setResults([]);
    setHasSearched(false);
    setSelectedSongs(new Set());
    setNextPageToken(null);
    setHasMore(false);
    // Autofocus the input after mode switch
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // Add song mutation
  const addSongMutation = useMutation({
    mutationFn: async (songData: { youtubeId: string; title: string; artist: string; thumbnailUrl: string }) => {
      if (playlistId) {
        return apiRequest("POST", `/api/playlists/${playlistId}/songs${user?.username ? `?username=${user.username}` : ""}`, {
          songs: [songData],
        });
      }
      const url = guestUrl
        ? `/api/playlist/songs?guestUrl=${encodeURIComponent(guestUrl)}`
        : user?.username
          ? `/api/playlist/songs?username=${user.username}`
          : "/api/playlist/songs";
      return apiRequest("POST", url, songData);
    },
    onSuccess: () => {
      if (playlistId) {
        queryClient.invalidateQueries({ queryKey: ["/api/playlists", user?.id] });
      } else if (guestUrl || user?.guestUrl) {
        queryClient.invalidateQueries({ queryKey: [`/api/playlist/${guestUrl || user?.guestUrl}`] });
      }
      toast({ title: "Success", description: playlistId ? "Song added to playlist" : "Song added to queue" });
    },
    onError: (error) => {
      toast({ title: "Failed to add song", description: error instanceof Error ? error.message : "Could not add song", variant: "destructive" });
    },
  });

  const fetchResults = async (q: string, pageToken?: string) => {
    if (!q.trim()) return null;
    try {
      const response = await fetch("/api/youtube/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ query: q, pageToken, username: usernameForCheck }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || `Search failed: ${response.statusText}`);
      }
      const data = await response.json();
      return { items: data.items || [], nextPageToken: data.nextPageToken || null };
    } catch (error) {
      toast({ title: "Search failed", description: error instanceof Error ? error.message : "Could not search", variant: "destructive" });
      return null;
    }
  };

  const fetchVideoFromUrl = async (url: string): Promise<SearchResult | null> => {
    try {
      const response = await fetch("/api/youtube/video-from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "include",
        body: JSON.stringify({ url }),
      });
      const ct = response.headers.get("content-type");
      if (ct?.includes("text/html")) throw new Error("Endpoint not available");
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || err.message || "Failed to fetch video");
      }
      return await response.json();
    } catch (error) {
      toast({ title: "Failed to fetch video", description: error instanceof Error ? error.message : "Could not fetch", variant: "destructive" });
      return null;
    }
  };

  const handleAction = useCallback(async () => {
    const val = inputValue.trim();

    if (mode === "search") {
      if (!val || isLimitReached || isPlanExpired) return;
      setIsSearching(true);
      setResults([]);
      setNextPageToken(null);
      setHasMore(false);
      setSearchId(Date.now());
      setHasSearched(true);
      const result = await fetchResults(val);
      if (result) {
        setResults(result.items);
        setNextPageToken(result.nextPageToken);
        setHasMore(!!result.nextPageToken);
      }
      setIsSearching(false);
      return;
    }

    if (mode === "url") {
      if (!val) return;
      if (!isYouTubeUrl(val)) {
        toast({ title: "Invalid URL", description: "Please enter a valid YouTube URL", variant: "destructive" });
        return;
      }
      setIsAddingFromUrl(true);
      const video = await fetchVideoFromUrl(val);
      if (video) {
        try {
          await addSongMutation.mutateAsync({
            youtubeId: video.id.videoId,
            title: video.snippet.title,
            artist: video.snippet.channelTitle,
            thumbnailUrl: video.snippet.thumbnails.default.url,
          });
          setInputValue("");
        } catch { /* handled in mutation */ }
      }
      setIsAddingFromUrl(false);
      return;
    }

    if (mode === "import") {
      if (!val) { toast({ title: "Enter URL", description: "Please enter a playlist URL", variant: "destructive" }); return; }

      // Detect platform — matching import-playlist-modal.tsx detection logic
      const lowerVal = val.toLowerCase();
      const isYTPlaylist = lowerVal.includes("music.youtube.com") || lowerVal.includes("youtube.com");
      const isSpotify = lowerVal.includes("open.spotify.com") || lowerVal.includes("spotify.com");

      if (!isYTPlaylist && !isSpotify) {
        toast({ title: "Invalid URL", description: "Please enter a valid YouTube Music or Spotify playlist URL", variant: "destructive" });
        return;
      }

      const platform = isYTPlaylist ? "youtube" : "spotify";

      // Build API URL — same pattern as import-playlist-modal.tsx
      let playlistApiUrl: string;
      const resolvedUsername = user?.username || usernameForCheck;
      if (playlistId) {
        // Saved playlist — always append username so JWT auth branch can resolve user
        playlistApiUrl = resolvedUsername
          ? `/api/playlists/${playlistId}/import-${platform}?username=${encodeURIComponent(resolvedUsername)}`
          : `/api/playlists/${playlistId}/import-${platform}`;
      } else if (guestUrl) {
        playlistApiUrl = `/api/playlist/import-${platform}?guestUrl=${encodeURIComponent(guestUrl)}`;
      } else {
        // Authenticated user with JWT — server needs username to map JWT → Neon DB user
        playlistApiUrl = resolvedUsername
          ? `/api/playlist/import-${platform}?username=${encodeURIComponent(resolvedUsername)}`
          : `/api/playlist/import-${platform}`;
      }

      setIsImporting(true);
      try {
        const res = await apiRequest("POST", playlistApiUrl, { url: val });
        // Parse count from response (same as import-playlist-modal.tsx)
        const data = res && typeof res === "object" ? res as any : {};
        const addedCount = platform === "youtube"
          ? (Number(data.videosAdded) || 0)
          : (Number(data.songsAdded) || 0);
        toast({
          title: "Playlist imported",
          description: addedCount > 0
            ? `Added ${addedCount} song${addedCount !== 1 ? "s" : ""} from ${platform === "youtube" ? "YouTube" : "Spotify"} playlist`
            : "Songs have been added to your queue",
        });
        setInputValue("");
        // Invalidate the right query
        if (playlistId) {
          queryClient.invalidateQueries({ queryKey: ["/api/playlists", user?.id] });
        } else {
          const playlistUrl = guestUrl || user?.guestUrl;
          if (playlistUrl) {
            queryClient.invalidateQueries({ queryKey: [`/api/playlist/${playlistUrl}`] });
          }
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "";
        if (msg.toLowerCase().includes('private') || msg.toLowerCase().includes('public')) {
          toast({ title: "Playlist is private", description: "Please make your Spotify playlist public first: open the playlist → ⋯ menu → Make public.", variant: "destructive" });
        } else {
          toast({ title: "Import failed", description: msg || "Could not import playlist", variant: "destructive" });
        }
      } finally {
        setIsImporting(false);
      }
    }
  }, [mode, inputValue, isLimitReached, isPlanExpired, addSongMutation, guestUrl, user, toast]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleAction();
  };

  const loadMore = async () => {
    if (!inputValue.trim() || !nextPageToken || isLoadingMore || isPlanExpired) return;
    setIsLoadingMore(true);
    const result = await fetchResults(inputValue.trim(), nextPageToken);
    if (result) {
      setResults((prev) => [...prev, ...result.items]);
      setNextPageToken(result.nextPageToken);
      setHasMore(!!result.nextPageToken);
    }
    setIsLoadingMore(false);
  };

  const toggleSong = (videoId: string) => {
    const next = new Set(selectedSongs);
    if (next.has(videoId)) next.delete(videoId); else next.add(videoId);
    setSelectedSongs(next);
  };

  const addSelectedSongs = async () => {
    const songsToAdd = results.filter((r) => selectedSongs.has(r.id.videoId));
    let addedCount = 0;
    for (const song of songsToAdd) {
      try {
        await addSongMutation.mutateAsync({
          youtubeId: song.id.videoId,
          title: song.snippet.title,
          artist: song.snippet.channelTitle,
          thumbnailUrl: song.snippet.thumbnails.default.url,
        });
        addedCount++;
      } catch { /* continue */ }
    }
    if (addedCount > 0) {
      setSelectedSongs(new Set());
      setResults([]);
      setInputValue("");
      setHasSearched(false);
    }
  };

  const isActioning = isSearching || isAddingFromUrl || isImporting;
  const isActionDisabled = isActioning || !inputValue.trim() || (mode === "search" && (isLimitReached || isPlanExpired));

  const actionContent = () => {
    if (isActioning) return <MusicLoader size="sm" />;
    if (mode === "search") return <><Search className="h-3.5 w-3.5" /><span className="hidden sm:inline ml-1.5">Search</span></>;
    if (mode === "url") return <><Plus className="h-3.5 w-3.5" /><span className="hidden sm:inline ml-1.5">Add</span></>;
    return <><Download className="h-3.5 w-3.5" /><span className="hidden sm:inline ml-1.5">Import</span></>;
  };

  return (
    <div className="w-full space-y-0">
      {/* ── Quota / plan alerts ───────────────────────────────────────── */}
      {isPlanExpired && (
        <Alert variant="destructive" className="py-2.5 px-4 mb-3">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            No active subscription — search is disabled.{" "}
            <strong>Switch to YouTube URL to add songs for free.</strong>
          </AlertDescription>
        </Alert>
      )}
      {isLimitReached && !isLoadingSubscription && !isPlanExpired && (
        <Alert variant="destructive" className="py-2.5 px-4 mb-3">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Limit reached ({songRequests}/{songsQuota}).{" "}
            <strong>Switch to YouTube URL mode to add songs for free.</strong>
          </AlertDescription>
        </Alert>
      )}

      {/* ── Single-row control ─────────────────────────────────────────── */}
      <div className="flex items-stretch rounded-xl border border-border overflow-hidden transition-all duration-200 bg-card">
        {/* Mode icon + input */}
        <div className="relative flex-1 min-w-0">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-primary/60">
            {currentMode.icon}
          </span>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              mode === "search" && isPlanExpired
                ? "No active subscription plan"
                : mode === "search" && isLimitReached
                  ? "Song request limit reached"
                  : currentMode.placeholder
            }
            disabled={isActioning || (mode === "search" && (isLimitReached || isPlanExpired))}
            className={cn(
              "w-full h-11 pl-9 pr-3 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed text-foreground"
            )}
          />
        </div>

        {/* Divider */}
        <div className="w-px self-stretch bg-border" />

        {/* Action button — uses primary colour from CSS var */}
        <button
          onClick={handleAction}
          disabled={isActionDisabled}
          className="flex items-center px-4 text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {actionContent()}
        </button>

        {/* Divider */}
        <div className="w-px self-stretch bg-border" />

        {/* Chevron ICON ONLY — perfectly centered */}
        <button
          ref={chevronBtnRef}
          onClick={() => setDropdownOpen((o) => !o)}
          className="h-11 w-10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex-shrink-0"
          title="Switch mode"
        >
          {dropdownOpen
            ? <ChevronUp className="h-4 w-4" />
            : <ChevronDown className="h-4 w-4" />
          }
        </button>
      </div>

      {/* Hint */}
      <p className="text-xs px-0.5 pt-1.5 text-primary/70">
        {currentMode.hint}
      </p>

      {/* ── Dropdown — fixed position to escape any overflow:hidden parent ── */}
      {dropdownOpen && (
        <div
          id="tunes-search-mode-dropdown"
          className="fixed z-[9999] w-52 rounded-xl shadow-2xl border border-border bg-popover text-popover-foreground overflow-hidden"
          style={{ top: dropdownPos.top, right: dropdownPos.right }}
        >
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => switchMode(m.key)}
              className={cn(
                "w-full flex items-center gap-2.5 px-4 py-3 text-sm text-left transition-colors",
                m.key === mode
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <span className={m.key === mode ? "text-primary" : ""}>{m.icon}</span>
              <span>{m.label}</span>
              {m.key === mode && <Check className="h-3.5 w-3.5 ml-auto text-primary" />}
            </button>
          ))}
        </div>
      )}

      {/* ── Results — only shown when relevant ──────────────────────────── */}
      <div className="relative mt-3">
        {isSearching && (
          <div className="flex justify-center py-8">
            <MusicLoader size="lg" />
          </div>
        )}

        {!isSearching && hasSearched && mode === "search" && (
          <>
            {results.length > 0 ? (
              <>
                <p className="text-xs text-muted-foreground mb-2">
                  {results.length} result{results.length > 1 ? "s" : ""} — click to select
                </p>
                <div className="space-y-0.5 max-h-80 overflow-y-auto">
                  {results.map((result, idx) => {
                    const vid = result.id.videoId;
                    const selected = selectedSongs.has(vid);
                    return (
                      <div
                        key={`${searchId}-${vid}-${idx}`}
                        onClick={() => toggleSong(vid)}
                        className={cn(
                          "flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all duration-150 select-none border",
                          selected
                            ? "border-primary/40 bg-primary/10"
                            : "border-transparent hover:bg-accent"
                        )}
                      >
                        <img
                          src={result.snippet.thumbnails.default.url}
                          alt={result.snippet.title}
                          className="h-10 w-10 rounded-md object-cover flex-shrink-0 bg-muted"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{result.snippet.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{result.snippet.channelTitle}</p>
                        </div>
                        <div
                          className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all border",
                            selected ? "bg-primary border-primary" : "bg-transparent border-border"
                          )}
                        >
                          {selected && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                      </div>
                    );
                  })}

                  {/* Load more */}
                  {(hasMore || isLoadingMore) && (
                    <div className="flex justify-center py-2">
                      {isLoadingMore ? (
                        <MusicLoader size="sm" />
                      ) : (
                        <button
                          onClick={loadMore}
                          className="text-xs px-4 py-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors"
                        >
                          Load more
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* No results — only after search returned nothing */
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <AlertCircle className="h-7 w-7 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No results for "{inputValue}"</p>
                <p className="text-xs text-muted-foreground/60">Try other keywords or switch to YouTube URL mode</p>
              </div>
            )}
          </>
        )}

        {/* Floating add button — anchored to results section */}
        {selectedSongs.size > 0 && (
          <div className="sticky bottom-0 pt-2 mt-2 border-t border-border bg-card">
            <button
              onClick={addSelectedSongs}
              disabled={addSongMutation.isPending || isLimitReached || isPlanExpired}
              className="w-full py-2.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {addSongMutation.isPending ? <MusicLoader size="sm" /> : <Plus className="h-4 w-4" />}
              Add {selectedSongs.size} song{selectedSongs.size > 1 ? "s" : ""} to {playlistId ? "playlist" : "queue"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}