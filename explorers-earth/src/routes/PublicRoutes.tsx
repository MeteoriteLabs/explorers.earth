import type { ReactElement } from "react";
import { Route } from "react-router-dom";

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
import PublicLayout from "../layouts/PublicLayout";
import PublicHomePage from "../pages/public/PublicHomePage";
import PublicMusic from "../pages/public/PublicMusic";
import { PublicProfileFallbackRedirect } from "./PublicProfileFallbackRedirect";
import { publicRouteContract, type PublicRouteId } from "./publicRouteContract";
import TabVisibilityGuard from "./validators/TabVisibilityGuard";
import { UsernameValidator } from "./validators/UsernameValidator";

const publicRouteElements: Record<PublicRouteId, ReactElement> = {
  profile: <PublicProfile />,
  music: <PublicMusic />,
  "places-index": <PublicHomePage />,
  "places-detail": <PublicHomePage />,
  "places-map": <MapView />,
  "places-detail-map": <MapView />,
  "places-map-detail": <PlaceMapView />,
  "guides-index": <PublicGuides />,
  "guides-detail": <PublicGuideDetailPage />,
  community: <Community />,
  "movies-index": <PublicMovies />,
  "movies-genre": <PublicMovieGenre />,
  "movies-list": <PublicMovieList />,
  "books-index": <PublicBooks />,
  "books-subject": <PublicBookSubject />,
  "books-list": <PublicBookList />,
  "games-index": <PublicGames />,
  "games-genre": <PublicGamesGenre />,
  "games-list": <PublicGamesList />,
  "apps-index": <PublicApps />,
  "apps-list": <PublicAppList />,
  "products-index": <PublicProducts />,
  "products-list": <PublicProductList />,
  "people-index": <PublicPeople />,
  "people-sector": <PublicPersonSector />,
  "people-list": <PublicPersonList />,
};

function withVisibilityGuard(route: (typeof publicRouteContract)[number]): ReactElement {
  const element = publicRouteElements[route.id];

  if (route.visibility === "always-visible") return element;

  const visibilityField = "visibilityField" in route ? route.visibilityField : undefined;
  const defaultVisible = "defaultVisible" in route ? route.defaultVisible : undefined;

  if (!visibilityField) {
    throw new Error(`Guarded public route ${route.id} requires a visibility field`);
  }

  return (
    <TabVisibilityGuard tabField={visibilityField} defaultVisible={defaultVisible}>
      {element}
    </TabVisibilityGuard>
  );
}

const PublicRoutes = [
  <Route key="public-routes" path=":username/*" element={<PublicLayout />}>
    <Route element={<UsernameValidator />}>
      {publicRouteContract.map((route) => (
        <Route
          key={route.id}
          id={route.id}
          index={"index" in route && route.index}
          path={"index" in route && route.index ? undefined : route.path}
          element={withVisibilityGuard(route)}
        />
      ))}
      <Route path="*" element={<PublicProfileFallbackRedirect />} />
    </Route>
  </Route>,
];

export default PublicRoutes;
