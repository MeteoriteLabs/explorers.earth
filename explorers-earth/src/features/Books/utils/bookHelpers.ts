// ============================================================
// Book Utilities — slug, format helpers, rich text
// ============================================================

// ─────────────────────────────────────────────────────────────
// Slug generation (for book lists — same logic as Movies)
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
// Subject/category helpers
// ─────────────────────────────────────────────────────────────
export function subjectToSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function slugToSubjectName(slug: string): string {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function extractUniqueSubjects(subjectArrays: (string[] | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const arr of subjectArrays) {
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

export function parseSubjects(subjects: unknown): string[] {
  if (!subjects) return [];
  if (Array.isArray(subjects)) return subjects.filter((s) => typeof s === "string");
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
// Format page count
// ─────────────────────────────────────────────────────────────
export function formatPageCount(count: number | null | undefined): string {
  if (!count) return "";
  return `${count} pages`;
}

// ─────────────────────────────────────────────────────────────
// Format authors array for display
// ─────────────────────────────────────────────────────────────
export function formatAuthors(authors: string[] | null | undefined): string {
  if (!authors || authors.length === 0) return "Unknown Author";
  if (authors.length === 1) return authors[0];
  if (authors.length === 2) return authors.join(" & ");
  return `${authors[0]} et al.`;
}

// ─────────────────────────────────────────────────────────────
// Parse authors (stored as JSON array in Strapi)
// ─────────────────────────────────────────────────────────────
export function parseAuthors(authors: unknown): string[] {
  if (!authors) return [];
  if (Array.isArray(authors)) return authors.filter((a) => typeof a === "string");
  if (typeof authors === "string") return [authors];
  return [];
}

// ─────────────────────────────────────────────────────────────
// Rich Text Blocks helper (same as Movies)
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
// Deduplicate books (fixes Draft & Publish duplication from Strapi)
// ─────────────────────────────────────────────────────────────
export function deduplicateBooks<T extends { documentId: string }>(
  books: T[] | null | undefined
): T[] {
  if (!books || !Array.isArray(books)) return [];
  const map = new Map<string, T>();
  for (const b of books) {
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
  // If it's already an absolute URL (S3 or Google Books), use as-is
  if (coverUrl.startsWith("http")) return coverUrl;
  // If it's a Strapi relative path, prefix with the REST API URL
  if (coverUrl.startsWith("/")) {
    const base =
      import.meta.env.VITE_REST_API_URL?.replace("/api", "") || "http://localhost:1337";
    return `${base}${coverUrl}`;
  }
  return coverUrl;
}
