import type { PublicCategory } from "./publicProfileGatewayClient";
import type { PublicPagePayload } from "./usePublicPagedResource";

export const PUBLIC_PROFILE_PAGE_SIZE = 12;
export type PublicProfilePageSize = 12 | 24;
export function validatePublicPageSize(pageSize: PublicProfilePageSize): PublicProfilePageSize {
  if (pageSize !== 12 && pageSize !== 24) return invalid();
  return pageSize;
}
export const PUBLIC_PROFILE_PAGE_FIELDS = {
  places: { root: "recommendationLists", child: "recommended_places" },
  movies: { root: "movieLists", child: "recommended_movies" },
  books: { root: "bookLists", child: "recommended_books" },
  games: { root: "gameLists", child: "recommended_games" },
  guides: { root: "guides", child: "guide_sections" },
  apps: { root: "appLists", child: "recommended_apps" },
  products: { root: "productLists", child: "recommended_products" },
  people: { root: "personLists", child: "recommended_people" },
} as const satisfies Record<PublicCategory, { root: string; child: string }>;

function invalid(): never { throw new Error("PUBLIC_PROFILE_INVALID_RESPONSE"); }
function documentRow(value: unknown): Record<string, unknown> & { documentId: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  const row = value as Record<string, unknown>;
  if (typeof row.documentId !== "string" || !row.documentId.trim()) return invalid();
  return row as Record<string, unknown> & { documentId: string };
}

export function readPublicPageRows(data: PublicPagePayload, category: PublicCategory, detail: boolean, pageSize: PublicProfilePageSize = PUBLIC_PROFILE_PAGE_SIZE): unknown[] {
  validatePublicPageSize(pageSize);
  if (!data || typeof data !== "object" || Array.isArray(data)) return invalid();
  const { root, child } = PUBLIC_PROFILE_PAGE_FIELDS[category];
  const roots = data[root];
  if (!Array.isArray(roots)) return invalid();
  let rows: unknown = roots;
  if (detail) {
    if (roots.length === 0) throw new Error("PUBLIC_PROFILE_404");
    if (roots.length !== 1) return invalid();
    rows = documentRow(roots[0])[child];
  }
  if (!Array.isArray(rows)) return invalid();
  // Preserve null slots for raw cursor cardinality; the rendered merge omits them.
  rows.forEach((row) => { if (row !== null) documentRow(row); });
  return rows;
}

export function mergePublicPage(previous: PublicPagePayload, next: PublicPagePayload, category: PublicCategory, detail: boolean, pageSize: PublicProfilePageSize = PUBLIC_PROFILE_PAGE_SIZE): PublicPagePayload {
  const previousRows = readPublicPageRows(previous, category, detail, pageSize);
  const nextRows = readPublicPageRows(next, category, detail, pageSize);
  const { root, child } = PUBLIC_PROFILE_PAGE_FIELDS[category];
  const seen = new Set<string>();
  const rows = [...previousRows, ...nextRows].filter((row) => {
    if (row === null) return false;
    const id = documentRow(row).documentId;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  if (!detail) return { ...previous, [root]: rows };
  const parent = documentRow(previous[root][0]);
  if (parent.documentId !== documentRow(next[root][0]).documentId) return invalid();
  return { ...previous, [root]: [{ ...parent, [child]: rows }] };
}
