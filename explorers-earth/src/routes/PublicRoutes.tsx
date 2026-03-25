import { Route } from "react-router-dom";

// Import components
import PublicProfile from "../features/PublicHome/components/PublicProfile";
import PublicHomePage from "../pages/public/PublicHomePage";
import Community from "../features/PublicHome/components/Community";
import MapView from "../features/PublicHome/components/MapView";
import PlaceMapView from "../features/PublicHome/components/PlaceMapView";
import PublicMusic from "../pages/public/PublicMusic";
import PublicGuides from "../features/PublicHome/components/PublicGuides";
import PublicGuideDetailPage from "../features/PublicHome/components/PublicGuideDetailPage";
import { UsernameValidator } from "./validators";
import TabVisibilityGuard from "./validators/TabVisibilityGuard";
import { PublicMovies, PublicMovieList, PublicMovieGenre } from "../features/Movies";
import { PublicBooks, PublicBookList, PublicBookSubject } from "../features/Books";

// Import layout
import PublicLayout from "../layouts/PublicLayout";

const PublicRoutes = [
  <Route
    key="public-routes"
    path=":username/*"
    element={
      <UsernameValidator>
        <PublicLayout />
      </UsernameValidator>
    }
  >
    <Route index element={
      <TabVisibilityGuard tabField="public_profile" defaultVisible={true}>
        <PublicProfile />
      </TabVisibilityGuard>
    } />
    <Route path="music" element={
      <TabVisibilityGuard tabField="public_music" defaultVisible={false}>
        <PublicMusic />
      </TabVisibilityGuard>
    } />
    <Route path="places">
      <Route index element={
        <TabVisibilityGuard tabField="public_recommendations" defaultVisible={true}>
          <PublicHomePage />
        </TabVisibilityGuard>
      } />
      <Route path=":placeSlug" element={
        <TabVisibilityGuard tabField="public_recommendations" defaultVisible={true}>
          <PublicHomePage />
        </TabVisibilityGuard>
      } />
      <Route path="map" element={<MapView />} />
      <Route path=":placeSlug/map" element={<MapView />} />
      <Route path=":place/placesmap" element={<PlaceMapView />} />
    </Route>
    <Route path="guides">
      <Route index element={
        <TabVisibilityGuard tabField="public_guides" defaultVisible={false}>
          <PublicGuides />
        </TabVisibilityGuard>
      } />
      <Route path=":guideSlug" element={
        <TabVisibilityGuard tabField="public_guides" defaultVisible={false}>
          <PublicGuideDetailPage />
        </TabVisibilityGuard>
      } />
    </Route>
    <Route path="community" element={<Community />} />

    {/* Movies & Shows public routes */}
    <Route path="movies">
      <Route index element={
        <TabVisibilityGuard tabField="public_movie" defaultVisible={false}>
          <PublicMovies />
        </TabVisibilityGuard>
      } />
      <Route path="genre/:genreSlug" element={
        <TabVisibilityGuard tabField="public_movie" defaultVisible={false}>
          <PublicMovieGenre />
        </TabVisibilityGuard>
      } />
      <Route path=":listSlug" element={
        <TabVisibilityGuard tabField="public_movie" defaultVisible={false}>
          <PublicMovieList />
        </TabVisibilityGuard>
      } />
    </Route>

    {/* Books public routes */}
    <Route path="books">
      <Route index element={
        <TabVisibilityGuard tabField="public_books" defaultVisible={false}>
          <PublicBooks />
        </TabVisibilityGuard>
      } />
      <Route path="subject/:subjectSlug" element={
        <TabVisibilityGuard tabField="public_books" defaultVisible={false}>
          <PublicBookSubject />
        </TabVisibilityGuard>
      } />
      <Route path=":listSlug" element={
        <TabVisibilityGuard tabField="public_books" defaultVisible={false}>
          <PublicBookList />
        </TabVisibilityGuard>
      } />
    </Route>
  </Route>,
];

export default PublicRoutes;

