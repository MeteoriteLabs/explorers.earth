// ============================================================
// Google Books API Service Module
// ============================================================

const GOOGLE_BOOKS_BASE = "https://www.googleapis.com/books/v1";
const API_KEY = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY as string | undefined;

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
export interface GoogleBooksVolumeInfo {
  title: string;
  subtitle?: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string;
  description?: string;
  industryIdentifiers?: { type: string; identifier: string }[];
  pageCount?: number;
  categories?: string[];
  averageRating?: number;
  ratingsCount?: number;
  imageLinks?: {
    smallThumbnail?: string;
    thumbnail?: string;
    small?: string;
    medium?: string;
    large?: string;
    extraLarge?: string;
  };
  previewLink?: string;
  infoLink?: string;
  language?: string;
}

export interface GoogleBooksItem {
  id: string;
  volumeInfo: GoogleBooksVolumeInfo;
  saleInfo?: {
    buyLink?: string;
    saleability?: string;
  };
}

export interface GoogleBooksSearchResponse {
  totalItems: number;
  items?: GoogleBooksItem[];
}

// ─────────────────────────────────────────────────────────────
// Internal fetch helper
// ─────────────────────────────────────────────────────────────
async function booksFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${GOOGLE_BOOKS_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  if (API_KEY) url.searchParams.set("key", API_KEY);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Google Books API error: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

// ─────────────────────────────────────────────────────────────
// Search books (by title, author, ISBN, etc.)
// ─────────────────────────────────────────────────────────────
export async function searchBooks(query: string, maxResults = 20): Promise<GoogleBooksItem[]> {
  if (!query.trim()) return [];
  // If query looks like an ISBN (all digits, 10 or 13 chars), use isbn: prefix
  const isIsbn = /^\d{10,13}$/.test(query.replace(/-/g, ""));
  const q = isIsbn ? `isbn:${query.replace(/-/g, "")}` : query;

  const data = await booksFetch<GoogleBooksSearchResponse>("/volumes", {
    q,
    maxResults: String(maxResults),
    printType: "books",
    langRestrict: "en",
  });
  return data.items ?? [];
}

// ─────────────────────────────────────────────────────────────
// Get single volume details (for extra fields on select)
// ─────────────────────────────────────────────────────────────
export async function getVolumeDetails(volumeId: string): Promise<GoogleBooksItem> {
  return booksFetch<GoogleBooksItem>(`/volumes/${volumeId}`);
}

// ─────────────────────────────────────────────────────────────
// Image URL helpers — Google Books returns HTTP URLs, upgrade to HTTPS
// and try to get a higher zoom level
// ─────────────────────────────────────────────────────────────
export function getBestCoverUrl(volumeInfo: GoogleBooksVolumeInfo): string {
  const links = volumeInfo.imageLinks;
  if (!links) return "";
  const raw =
    links.extraLarge ||
    links.large ||
    links.medium ||
    links.small ||
    links.thumbnail ||
    links.smallThumbnail ||
    "";
  return upgradeToHttps(raw);
}

export function getThumbnailUrl(volumeInfo: GoogleBooksVolumeInfo): string {
  const links = volumeInfo.imageLinks;
  if (!links) return "";
  const raw = links.thumbnail || links.smallThumbnail || "";
  // Increase zoom for better quality thumbnail
  return upgradeToHttps(raw.replace("zoom=1", "zoom=2").replace("zoom=5", "zoom=2"));
}

export function upgradeToHttps(url: string): string {
  if (!url) return "";
  return url.replace(/^http:\/\//i, "https://");
}

// ─────────────────────────────────────────────────────────────
// Extract year from publishedDate (can be YYYY, YYYY-MM, or YYYY-MM-DD)
// ─────────────────────────────────────────────────────────────
export function extractYear(publishedDate: string | undefined): string {
  if (!publishedDate) return "";
  return publishedDate.substring(0, 4);
}

// ─────────────────────────────────────────────────────────────
// Extract ISBN (prefer ISBN-13)
// ─────────────────────────────────────────────────────────────
export function extractIsbn(volumeInfo: GoogleBooksVolumeInfo): string {
  const ids = volumeInfo.industryIdentifiers ?? [];
  const isbn13 = ids.find((i) => i.type === "ISBN_13");
  const isbn10 = ids.find((i) => i.type === "ISBN_10");
  return isbn13?.identifier || isbn10?.identifier || "";
}

// ─────────────────────────────────────────────────────────────
// Format authors for display
// ─────────────────────────────────────────────────────────────
export function formatAuthors(authors: string[] | undefined): string {
  if (!authors || authors.length === 0) return "Unknown Author";
  if (authors.length === 1) return authors[0];
  if (authors.length === 2) return authors.join(" & ");
  return `${authors[0]} et al.`;
}

// ─────────────────────────────────────────────────────────────
// Transform a Google Books item → shape ready to store in Strapi
// ─────────────────────────────────────────────────────────────
export interface MappedBook {
  volume_id: string;
  title: string;
  subtitle: string | null;
  authors: string[];
  year: string;
  cover_url: string;
  cover_url_large: string;
  subjects: string[];
  publisher: string | null;
  page_count: number | null;
  google_rating: number | null;
  description: string | null;
  isbn_13: string;
  preview_link: string | null;
  google_books_buy_link: string | null;
}

export function transformVolumeToBook(item: GoogleBooksItem): MappedBook {
  const vi = item.volumeInfo;
  return {
    volume_id: item.id,
    title: vi.title || "Untitled",
    subtitle: vi.subtitle ?? null,
    authors: vi.authors ?? [],
    year: extractYear(vi.publishedDate),
    cover_url: getBestCoverUrl(vi),
    cover_url_large: getThumbnailUrl(vi),
    subjects: vi.categories ?? [],
    publisher: vi.publisher ?? null,
    page_count: vi.pageCount ?? null,
    google_rating: vi.averageRating ?? null,
    description: vi.description ?? null,
    isbn_13: extractIsbn(vi),
    preview_link: vi.previewLink ?? null,
    google_books_buy_link: item.saleInfo?.buyLink ?? null,
  };
}

const googleBooksService = {
  searchBooks,
  getVolumeDetails,
  getBestCoverUrl,
  getThumbnailUrl,
  upgradeToHttps,
  extractYear,
  extractIsbn,
  formatAuthors,
  transformVolumeToBook,
};

export default googleBooksService;
