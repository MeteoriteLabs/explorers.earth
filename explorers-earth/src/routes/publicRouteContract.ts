export type PublicRouteOperation =
  | "account-bootstrap"
  | "places"
  | "movies"
  | "books"
  | "games"
  | "guides"
  | "apps"
  | "products"
  | "people";

export type PublicRouteFamily =
  | "profile"
  | "music"
  | "places"
  | "guides"
  | "community"
  | "movies"
  | "books"
  | "games"
  | "apps"
  | "products"
  | "people";

export type PublicRouteShell = "profile-root" | "collection" | "detail" | "map";
export type PublicRouteSkeleton = "profile-root" | "collection" | "detail" | "map";
export type PublicRouteAnalytics =
  | "custom-page-view"
  | "custom-page-view-and-interactions"
  | "ga-pathname-only";

export type PublicRouteVisibilityField =
  | "public_profile"
  | "public_recommendations"
  | "public_music"
  | "public_guides"
  | "public_movie"
  | "public_books"
  | "public_games"
  | "public_apps"
  | "public_products"
  | "public_people";

export type PublicRouteContractEntry = {
  readonly id: string;
  readonly index?: boolean;
  readonly path: string;
  readonly family: PublicRouteFamily;
  readonly visibilityField?: PublicRouteVisibilityField;
  readonly defaultVisible?: boolean;
  readonly marker: string;
  readonly shell: PublicRouteShell;
  readonly skeleton: PublicRouteSkeleton;
  readonly requiredOperations: readonly PublicRouteOperation[];
  readonly conditionalOperations: readonly PublicRouteOperation[];
  readonly analytics: PublicRouteAnalytics;
};

const rootOperations = ["account-bootstrap"] as const;
const profileConditionalOperations = [
  "places", "movies", "books", "games", "guides", "apps", "products", "people",
] as const;

export const publicRouteContract = [
  { id: "profile", index: true, path: "", family: "profile", visibilityField: "public_profile", defaultVisible: true, marker: "public-profile-shell", shell: "profile-root", skeleton: "profile-root", requiredOperations: rootOperations, conditionalOperations: profileConditionalOperations, analytics: "custom-page-view-and-interactions" },
  { id: "music", path: "music", family: "music", visibilityField: "public_music", marker: "public-music-page", shell: "collection", skeleton: "collection", requiredOperations: rootOperations, conditionalOperations: [], analytics: "ga-pathname-only" },
  { id: "places-index", path: "places", family: "places", visibilityField: "public_recommendations", marker: "public-places-page", shell: "collection", skeleton: "collection", requiredOperations: ["account-bootstrap", "places"], conditionalOperations: [], analytics: "custom-page-view-and-interactions" },
  { id: "places-detail", path: "places/:placeSlug", family: "places", visibilityField: "public_recommendations", marker: "public-place-detail", shell: "detail", skeleton: "detail", requiredOperations: ["account-bootstrap", "places"], conditionalOperations: [], analytics: "custom-page-view-and-interactions" },
  { id: "places-map", path: "places/map", family: "places", visibilityField: "public_recommendations", marker: "public-places-map", shell: "map", skeleton: "map", requiredOperations: ["account-bootstrap", "places"], conditionalOperations: [], analytics: "ga-pathname-only" },
  { id: "places-detail-map", path: "places/:placeSlug/map", family: "places", visibilityField: "public_recommendations", marker: "public-place-map", shell: "map", skeleton: "map", requiredOperations: ["account-bootstrap", "places"], conditionalOperations: [], analytics: "ga-pathname-only" },
  { id: "places-map-detail", path: "places/:place/placesmap", family: "places", visibilityField: "public_recommendations", marker: "public-place-map", shell: "map", skeleton: "map", requiredOperations: ["account-bootstrap", "places"], conditionalOperations: [], analytics: "ga-pathname-only" },
  { id: "guides-index", path: "guides", family: "guides", visibilityField: "public_guides", marker: "public-guides-page", shell: "collection", skeleton: "collection", requiredOperations: ["account-bootstrap", "guides"], conditionalOperations: [], analytics: "custom-page-view-and-interactions" },
  { id: "guides-detail", path: "guides/:guideSlug", family: "guides", visibilityField: "public_guides", marker: "public-guide-detail", shell: "detail", skeleton: "detail", requiredOperations: ["account-bootstrap", "guides"], conditionalOperations: [], analytics: "custom-page-view-and-interactions" },
  { id: "community", path: "community", family: "community", marker: "public-community-page", shell: "collection", skeleton: "collection", requiredOperations: rootOperations, conditionalOperations: [], analytics: "ga-pathname-only" },
  { id: "movies-index", path: "movies", family: "movies", visibilityField: "public_movie", marker: "public-movies-page", shell: "collection", skeleton: "collection", requiredOperations: ["account-bootstrap", "movies"], conditionalOperations: [], analytics: "custom-page-view-and-interactions" },
  { id: "movies-genre", path: "movies/genre/:genreSlug", family: "movies", visibilityField: "public_movie", marker: "public-movie-genre", shell: "detail", skeleton: "detail", requiredOperations: ["account-bootstrap", "movies"], conditionalOperations: [], analytics: "custom-page-view-and-interactions" },
  { id: "movies-list", path: "movies/:listSlug", family: "movies", visibilityField: "public_movie", marker: "public-movie-list", shell: "detail", skeleton: "detail", requiredOperations: ["account-bootstrap", "movies"], conditionalOperations: [], analytics: "custom-page-view-and-interactions" },
  { id: "books-index", path: "books", family: "books", visibilityField: "public_books", marker: "public-books-page", shell: "collection", skeleton: "collection", requiredOperations: ["account-bootstrap", "books"], conditionalOperations: [], analytics: "custom-page-view-and-interactions" },
  { id: "books-subject", path: "books/subject/:subjectSlug", family: "books", visibilityField: "public_books", marker: "public-book-subject", shell: "detail", skeleton: "detail", requiredOperations: ["account-bootstrap", "books"], conditionalOperations: [], analytics: "custom-page-view-and-interactions" },
  { id: "books-list", path: "books/:listSlug", family: "books", visibilityField: "public_books", marker: "public-book-list", shell: "detail", skeleton: "detail", requiredOperations: ["account-bootstrap", "books"], conditionalOperations: [], analytics: "custom-page-view-and-interactions" },
  { id: "games-index", path: "games", family: "games", visibilityField: "public_games", marker: "public-games-page", shell: "collection", skeleton: "collection", requiredOperations: ["account-bootstrap", "games"], conditionalOperations: [], analytics: "custom-page-view-and-interactions" },
  { id: "games-genre", path: "games/genre/:genreSlug", family: "games", visibilityField: "public_games", marker: "public-game-genre", shell: "detail", skeleton: "detail", requiredOperations: ["account-bootstrap", "games"], conditionalOperations: [], analytics: "custom-page-view-and-interactions" },
  { id: "games-list", path: "games/:listSlug", family: "games", visibilityField: "public_games", marker: "public-game-list", shell: "detail", skeleton: "detail", requiredOperations: ["account-bootstrap", "games"], conditionalOperations: [], analytics: "custom-page-view-and-interactions" },
  { id: "apps-index", path: "apps", family: "apps", visibilityField: "public_apps", marker: "public-apps-page", shell: "collection", skeleton: "collection", requiredOperations: ["account-bootstrap", "apps"], conditionalOperations: [], analytics: "custom-page-view-and-interactions" },
  { id: "apps-list", path: "apps/:listSlug", family: "apps", visibilityField: "public_apps", marker: "public-app-list", shell: "detail", skeleton: "detail", requiredOperations: ["account-bootstrap", "apps"], conditionalOperations: [], analytics: "custom-page-view-and-interactions" },
  { id: "products-index", path: "products", family: "products", visibilityField: "public_products", marker: "public-products-page", shell: "collection", skeleton: "collection", requiredOperations: ["account-bootstrap", "products"], conditionalOperations: [], analytics: "custom-page-view-and-interactions" },
  { id: "products-list", path: "products/:listSlug", family: "products", visibilityField: "public_products", marker: "public-product-list", shell: "detail", skeleton: "detail", requiredOperations: ["account-bootstrap", "products"], conditionalOperations: [], analytics: "custom-page-view-and-interactions" },
  { id: "people-index", path: "people", family: "people", visibilityField: "public_people", marker: "public-people-page", shell: "collection", skeleton: "collection", requiredOperations: ["account-bootstrap", "people"], conditionalOperations: [], analytics: "custom-page-view-and-interactions" },
  { id: "people-sector", path: "people/sector/:sectorSlug", family: "people", visibilityField: "public_people", marker: "public-people-sector", shell: "detail", skeleton: "detail", requiredOperations: ["account-bootstrap", "people"], conditionalOperations: [], analytics: "custom-page-view-and-interactions" },
  { id: "people-list", path: "people/:listSlug", family: "people", visibilityField: "public_people", marker: "public-person-list", shell: "detail", skeleton: "detail", requiredOperations: ["account-bootstrap", "people"], conditionalOperations: [], analytics: "custom-page-view-and-interactions" },
] as const satisfies readonly PublicRouteContractEntry[];

export type PublicRouteId = (typeof publicRouteContract)[number]["id"];

export function publicRoutePath(route: PublicRouteContractEntry, params: Readonly<Record<string, string>>): string {
  const pathname = `/${params.username}${route.path ? `/${route.path}` : ""}`;
  return pathname.replace(/:([A-Za-z][A-Za-z0-9_]*)/g, (_match, name: string) => params[name] ?? "example");
}
