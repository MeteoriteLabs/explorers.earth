import { useEffect } from "react";
import { publicProfileGatewayClient, type PublicCategory } from "./publicProfileGatewayClient";
import { subscribePublicProfileInvalidation } from "./publicProfileInvalidation";
import { mergePublicPage, PUBLIC_PROFILE_PAGE_SIZE, readPublicPageRows, type PublicProfilePageSize } from "./publicProfilePagination";
import { usePublicPagedResource, type PublicPagedState } from "./usePublicPagedResource";

export function usePublicProfileDetail(username: string | undefined, category: PublicCategory, slug: string | undefined, options: { pageSize?: PublicProfilePageSize; enabled?: boolean } = {}): PublicPagedState {
  const pageSize = options.pageSize ?? PUBLIC_PROFILE_PAGE_SIZE;
  const normalizedUsername = username?.trim().toLowerCase();
  const scope = normalizedUsername && slug ? `${normalizedUsername}\u0000${category}\u0000${slug}` : undefined;
  const state = usePublicPagedResource({
    scope, pageSize, enabled: Boolean(scope) && (options.enabled ?? true), showLoadingOnRevalidation: false,
    readFirst: (signal, bypass) => pageSize === 24
      ? publicProfileGatewayClient.detailPage(username!, category, slug!, { limit: 24 }, signal, bypass)
      : publicProfileGatewayClient.detail(username!, category, slug!, signal, bypass),
    readNext: (offset, signal, bypass) => publicProfileGatewayClient.detailPage(username!, category, slug!, { limit: pageSize, cursor: `o${offset}` }, signal, bypass),
    readRows: (data) => readPublicPageRows(data, category, true, pageSize),
    merge: (previous, next) => mergePublicPage(previous, next, category, true, pageSize),
  });
  useEffect(() => {
    if (!scope) return;
    const eventCategory = {
      places: "public_recommendations", movies: "public_movie", books: "public_books", games: "public_games",
      guides: "public_guides", apps: "public_apps", products: "public_products", people: "public_people",
    }[category];
    return subscribePublicProfileInvalidation((event) => {
      if (event.username.trim().toLowerCase() === normalizedUsername && event.category === eventCategory) void state.refetch();
    });
  }, [category, normalizedUsername, scope, state.refetch]);
  return state;
}
