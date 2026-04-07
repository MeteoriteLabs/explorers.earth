// ============================================================
// TMDB Service Module
// All TMDB API calls + image URL builders
// ============================================================

import type {
  TMDBSearchResult,
  TMDBMovieDetail,
  TMDBTVDetail,
  TMDBWatchProvidersResult,
  WatchProvider,
  TMDBGenreObject,
} from "../features/Movies/types";

const TMDB_API_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

// Prefer the Read Access Token (Bearer) — TMDB's modern auth method.
// Falls back to the short API key for backward compatibility.
const TMDB_ACCESS_TOKEN = import.meta.env.VITE_TMDB_ACCESS_TOKEN as string | undefined;
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY as string | undefined;

const USE_BEARER = Boolean(TMDB_ACCESS_TOKEN);

// ─────────────────────────────────────────────────────────────
// Error Class
// ─────────────────────────────────────────────────────────────
export class TMDBError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown
  ) {
    super(message);
    this.name = "TMDBError";
  }
}

// ─────────────────────────────────────────────────────────────
// Internal fetch helper
// ─────────────────────────────────────────────────────────────
async function tmdbFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${TMDB_API_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  // If no Bearer token, fall back to api_key query param
  if (!USE_BEARER && TMDB_API_KEY) {
    url.searchParams.set("api_key", TMDB_API_KEY);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
  };

  if (USE_BEARER && TMDB_ACCESS_TOKEN) {
    headers["Authorization"] = `Bearer ${TMDB_ACCESS_TOKEN}`;
  }

  try {
    const response = await fetch(url.toString(), { headers });
    if (!response.ok) {
      throw new TMDBError(
        `TMDB API error: ${response.statusText}`,
        response.status
      );
    }
    return response.json() as Promise<T>;
  } catch (error) {
    if (error instanceof TMDBError) throw error;
    throw new TMDBError("Failed to fetch from TMDB", undefined, error);
  }
}

// ─────────────────────────────────────────────────────────────
// Search
// ─────────────────────────────────────────────────────────────
export async function searchMulti(query: string): Promise<TMDBSearchResult[]> {
  if (!query.trim()) return [];
  const data = await tmdbFetch<{ results: TMDBSearchResult[] }>("/search/multi", {
    query,
    include_adult: "false",
  });
  // Filter to only movies and TV shows (exclude persons)
  return (data.results || []).filter(
    (r) => r.media_type === "movie" || r.media_type === "tv"
  );
}

// ─────────────────────────────────────────────────────────────
// Movie detail
// ─────────────────────────────────────────────────────────────
export async function getMovieDetails(tmdbId: number): Promise<TMDBMovieDetail> {
  return tmdbFetch<TMDBMovieDetail>(`/movie/${tmdbId}`, {
    append_to_response: "credits",
  });
}

// ─────────────────────────────────────────────────────────────
// TV Show detail
// ─────────────────────────────────────────────────────────────
export async function getTVDetails(tmdbId: number): Promise<TMDBTVDetail> {
  return tmdbFetch<TMDBTVDetail>(`/tv/${tmdbId}`, {
    append_to_response: "credits",
  });
}

// ─────────────────────────────────────────────────────────────
// Watch Providers
// ─────────────────────────────────────────────────────────────
export async function getWatchProviders(
  tmdbId: number,
  mediaType: "movie" | "tv",
  region = "US"
): Promise<WatchProvider[]> {
  const path = mediaType === "movie" ? `/movie/${tmdbId}/watch/providers` : `/tv/${tmdbId}/watch/providers`;
  const data = await tmdbFetch<TMDBWatchProvidersResult>(path);
  const regionData = data.results?.[region];
  if (!regionData) return [];

  const all = [
    ...(regionData.flatrate ?? []),
    ...(regionData.rent ?? []),
    ...(regionData.buy ?? []),
  ];

  // Deduplicate by provider_id
  const seen = new Set<number>();
  return all
    .filter((p) => {
      if (seen.has(p.provider_id)) return false;
      seen.add(p.provider_id);
      return true;
    })
    .sort((a, b) => a.display_priority - b.display_priority)
    .slice(0, 8) // max 8 providers
    .map((p) => ({
      provider_id: p.provider_id,
      provider_name: p.provider_name,
      logo_path: p.logo_path,
      link: regionData.link,
    }));
}

// ─────────────────────────────────────────────────────────────
// Genres
// ─────────────────────────────────────────────────────────────
export async function getMovieGenres(): Promise<TMDBGenreObject[]> {
  const data = await tmdbFetch<{ genres: TMDBGenreObject[] }>("/genre/movie/list");
  return data.genres;
}

export async function getTVGenres(): Promise<TMDBGenreObject[]> {
  const data = await tmdbFetch<{ genres: TMDBGenreObject[] }>("/genre/tv/list");
  return data.genres;
}

// ─────────────────────────────────────────────────────────────
// Trending
// ─────────────────────────────────────────────────────────────
export async function getTrending(mediaType: "movie" | "tv" | "all" = "all"): Promise<TMDBSearchResult[]> {
  const data = await tmdbFetch<{ results: TMDBSearchResult[] }>(
    `/trending/${mediaType}/week`
  );
  return data.results || [];
}

// ─────────────────────────────────────────────────────────────
// Image URL Builders
// ─────────────────────────────────────────────────────────────
export function buildImageUrl(path: string | null | undefined, size: string): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export function buildPosterUrl(
  path: string | null | undefined,
  size: "w185" | "w342" | "w500" | "w780" = "w342"
): string {
  return buildImageUrl(path, size);
}

export function buildBackdropUrl(
  path: string | null | undefined,
  size: "w300" | "w780" | "w1280" = "w780"
): string {
  return buildImageUrl(path, size);
}

export function buildLogoUrl(
  path: string | null | undefined,
  size: "w92" | "w154" | "original" = "w92"
): string {
  return buildImageUrl(path, size);
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
export function extractYear(dateString: string | null | undefined): string {
  if (!dateString) return "";
  return dateString.substring(0, 4);
}

export function extractDirector(movie: TMDBMovieDetail): string | null {
  return movie.credits?.crew?.find((c) => c.job === "Director")?.name ?? null;
}

const tmdbService = {
  searchMulti,
  getMovieDetails,
  getTVDetails,
  getWatchProviders,
  getMovieGenres,
  getTVGenres,
  getTrending,
  buildImageUrl,
  buildPosterUrl,
  buildBackdropUrl,
  buildLogoUrl,
  extractYear,
  extractDirector,
};

export default tmdbService;
