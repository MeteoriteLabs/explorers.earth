// ============================================================
// Game Utilities — slug, format helpers, rich text
// ============================================================

// ─────────────────────────────────────────────────────────────
// Slug generation (for game lists — same logic as Movies/Books)
// ─────────────────────────────────────────────────────────────
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 100);
}

// ─────────────────────────────────────────────────────────────
// Genre/category helpers
// ─────────────────────────────────────────────────────────────
export function genreToSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function slugToGenreName(slug: string): string {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function extractUniqueGenres(genreArrays: (string[] | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const arr of genreArrays) {
    if (!arr) continue;
    for (const s of arr) {
      if (s && !seen.has(s)) {
        seen.add(s);
        result.push(s);
      }
    }
  }
  return result.sort();
}

export function parseGenres(genres: unknown): string[] {
  if (!genres) return [];
  if (Array.isArray(genres)) return genres.filter((s) => typeof s === "string");
  return [];
}

// ─────────────────────────────────────────────────────────────
// Format rating
// ─────────────────────────────────────────────────────────────
export function formatRating(rating: number | null | undefined): string {
  if (!rating) return "";
  return rating.toFixed(1);
}

// ─────────────────────────────────────────────────────────────
// Rich Text Blocks helper
// ─────────────────────────────────────────────────────────────
export function extractNoteText(note: any): string {
  if (!note) return "";
  if (typeof note === "string") return note;
  if (Array.isArray(note)) {
    return note
      .map((block) => {
        if (block?.children && Array.isArray(block.children)) {
          return block.children.map((c: any) => c.text || "").join("");
        }
        return "";
      })
      .join("\n")
      .trim();
  }
  return "";
}

// ─────────────────────────────────────────────────────────────
// Deduplicate games (fixes Draft & Publish duplication from Strapi)
// ─────────────────────────────────────────────────────────────
export function deduplicateGames<T extends { documentId: string }>(
  games: T[] | null | undefined
): T[] {
  if (!games || !Array.isArray(games)) return [];
  const map = new Map<string, T>();
  for (const b of games) {
    if (b?.documentId && !map.has(b.documentId)) {
      map.set(b.documentId, b);
    }
  }
  return Array.from(map.values());
}

// ─────────────────────────────────────────────────────────────
// Cover URL helper
// ─────────────────────────────────────────────────────────────
export function buildCoverUrl(coverUrl: string | null | undefined): string {
  if (!coverUrl) return "";
  // If it's already an absolute URL (S3, IGDB), use as-is
  if (coverUrl.startsWith("http")) return coverUrl;
  // If it's a Strapi relative path, prefix with the REST API URL
  if (coverUrl.startsWith("/")) {
    const base =
      import.meta.env.VITE_REST_API_URL?.replace("/api", "") || "http://localhost:1337";
    return `${base}${coverUrl}`;
  }
  return coverUrl;
}
