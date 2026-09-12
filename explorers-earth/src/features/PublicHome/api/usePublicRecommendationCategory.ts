import { useEffect, useRef } from "react";
import { publicProfileGatewayClient, type PublicCategory } from "./publicProfileGatewayClient";
import { subscribePublicProfileInvalidation } from "./publicProfileInvalidation";
import { mergePublicPage, PUBLIC_PROFILE_PAGE_SIZE, readPublicPageRows } from "./publicProfilePagination";
import { usePublicPagedResource, type PublicPagedState, type PublicPagePayload } from "./usePublicPagedResource";

export type PublicCategoryGatewayState = PublicPagedState;

export function usePublicRecommendationCategory(
  username: string | undefined,
  category: PublicCategory,
  enabled: boolean,
): PublicPagedState {
  const normalizedUsername = username?.trim().toLowerCase();
  const scope = normalizedUsername ? `${normalizedUsername}\u0000${category}` : undefined;
  const deferredInvalidation = useRef<string>();
  const state = usePublicPagedResource({
    scope, enabled, bypassFirst: Boolean(scope && deferredInvalidation.current === scope),
    readFirst: (signal, bypass) => publicProfileGatewayClient.category(username!, category, signal, bypass),
    readNext: (offset, signal, bypass) => publicProfileGatewayClient.categoryPage(username!, category, { limit: PUBLIC_PROFILE_PAGE_SIZE, cursor: `o${offset}` }, signal, bypass),
    peek: () => publicProfileGatewayClient.peekCategory(username!, category) as PublicPagePayload | undefined,
    readRows: (data) => readPublicPageRows(data, category, false),
    merge: (previous, next) => mergePublicPage(previous, next, category, false),
    showLoadingOnRevalidation: true,
  });

  useEffect(() => {
    if (enabled || deferredInvalidation.current !== scope) deferredInvalidation.current = undefined;
    const eventCategory = {
      places: "public_recommendations", movies: "public_movie", books: "public_books", games: "public_games",
      guides: "public_guides", apps: "public_apps", products: "public_products", people: "public_people",
    }[category];
    if (!normalizedUsername) return;
    return subscribePublicProfileInvalidation((event) => {
      if (event.username.trim().toLowerCase() !== normalizedUsername || event.category !== eventCategory) return;
      // The listener stays mounted while hidden; only this scope can consume it.
      if (enabled) void state.refetch();
      else deferredInvalidation.current = scope;
    });
  }, [category, enabled, normalizedUsername, scope, state.refetch]);

  return state;
}
