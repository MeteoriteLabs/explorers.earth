import type { TypePolicies } from '@apollo/client';

/**
 * Apollo cache normalization policy.
 *
 * Strapi v5 entities are keyed by `documentId`, not `id`. With the default
 * `new InMemoryCache()` (no keyFields) Apollo can't normalize these entities,
 * so a publish mutation's returned `{ documentId, visibility }` does NOT patch
 * the entity the list query already rendered — the status label sticks on
 * "Draft (Private)" until a manual reload. Keying these types by `documentId`
 * makes the mutation result merge into the same cache entity → the label flips
 * with no refetch.
 *
 * Scope: only the three LIST types (the publish-label fix). The item types
 * (RecommendedBook/Game/Movie) are intentionally NOT normalized here yet —
 * adding them is safe only once we confirm every query selects their
 * `documentId`, otherwise it would change item-level cache behavior app-wide.
 *
 * Type names follow the Strapi v5 GraphQL convention (collection `book-list`
 * → type `BookList`). A name that doesn't match a real type is a no-op, so this
 * cannot regress behavior; confirm via introspection if a label still sticks.
 *
 * NOTE: keep the intentional `visibility` (Books) vs `Visibility` (Games/Movies)
 * field-casing difference — each matches its own Strapi collection.
 */
export const typePolicies: TypePolicies = {
  BookList: { keyFields: ['documentId'] },
  GameList: { keyFields: ['documentId'] },
  MovieList: { keyFields: ['documentId'] },
};
