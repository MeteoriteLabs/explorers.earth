import { PublicApps, PublicAppList } from "../features/AppsAndTools";
import { PublicBooks, PublicBookList, PublicBookSubject } from "../features/Books";
import { PublicGames, PublicGamesGenre, PublicGamesList } from "../features/Games";
import Community from "../features/PublicHome/components/Community";
import MapView from "../features/PublicHome/components/MapView";
import PlaceMapView from "../features/PublicHome/components/PlaceMapView";
import PublicGuideDetailPage from "../features/PublicHome/components/PublicGuideDetailPage";
import PublicGuides from "../features/PublicHome/components/PublicGuides";
import PublicProfile from "../features/PublicHome/components/PublicProfile";
import { PublicMovies, PublicMovieGenre, PublicMovieList } from "../features/Movies";
import { PublicPeople, PublicPersonList, PublicPersonSector } from "../features/People";
import { PublicProducts, PublicProductList } from "../features/Products";
import PublicHomePage from "../pages/public/PublicHomePage";
import PublicMusic from "../pages/public/PublicMusic";
import type { PublicRouteId } from "./publicRouteContract";
import { withPublicRouteLeafIdentity } from "./publicRouteLeafIdentity";

const identified = (marker: string, Component: ComponentType) =>
  withPublicRouteLeafIdentity(marker, Component);

export const publicRouteLeafComponents = {
  profile: identified("public-profile-shell", PublicProfile),
  music: identified("public-music-page", PublicMusic),
  "places-index": identified("public-places-page", PublicHomePage),
  "places-detail": identified("public-place-detail", PublicHomePage),
  "places-map": identified("public-places-map", MapView),
  "places-detail-map": identified("public-place-map", MapView),
  "places-map-detail": identified("public-place-map", PlaceMapView),
  "guides-index": identified("public-guides-page", PublicGuides),
  "guides-detail": identified("public-guide-detail", PublicGuideDetailPage),
  community: identified("public-community-page", Community),
  "movies-index": identified("public-movies-page", PublicMovies),
  "movies-genre": identified("public-movie-genre", PublicMovieGenre),
  "movies-list": identified("public-movie-list", PublicMovieList),
  "books-index": identified("public-books-page", PublicBooks),
  "books-subject": identified("public-book-subject", PublicBookSubject),
  "books-list": identified("public-book-list", PublicBookList),
  "games-index": identified("public-games-page", PublicGames),
  "games-genre": identified("public-game-genre", PublicGamesGenre),
  "games-list": identified("public-game-list", PublicGamesList),
  "apps-index": identified("public-apps-page", PublicApps),
  "apps-list": identified("public-app-list", PublicAppList),
  "products-index": identified("public-products-page", PublicProducts),
  "products-list": identified("public-product-list", PublicProductList),
  "people-index": identified("public-people-page", PublicPeople),
  "people-sector": identified("public-people-sector", PublicPersonSector),
  "people-list": identified("public-person-list", PublicPersonList),
} satisfies Record<PublicRouteId, ComponentType>;
import type { ComponentType } from "react";
