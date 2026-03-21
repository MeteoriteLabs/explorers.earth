import { ReactElement } from "react";
import { Route } from "react-router-dom";
import ProtectedRoute from "../components/ProtectedRoute";

// Import components
import OnBoarding from "../pages/OnBoarding";
import Profile from "../pages/Profile";
import Favorites from "../pages/Favorites";
import Analytics from "../pages/Analytics";
import SettingsPage from "../pages/SettingsPage";
import Home from "../pages/Home";
import Music from "../pages/Music";
import Instagram from "../pages/Instagram";
import SubscriptionPlans from "../pages/SubscriptionPlans";
import Checkout from "../pages/Checkout";
import AddRecommendation from "../features/Favorites/components/AddRecommendation";
import {
  GuidesPage,
  CreateGuidePage,
  GuideDetailsPage,
  GuideSectionFormPage,
} from "../features/Guides";
import { MoviesHome, MovieListView } from "../features/Movies";

// Import layouts
import DashboardLayout from "../layouts/DashboardLayout";
import MobileLayout from "../layouts/MobileLayout";

interface ProtectedRoutesProps {
  isDesktop: boolean;
}

const ProtectedRoutes = ({
  isDesktop,
}: ProtectedRoutesProps): ReactElement[] => {
  const desktopRoutes = (
    <Route key="desktop-routes" path="/*" element={<DashboardLayout />}>
      <Route path="profile" element={<Profile />} />
      <Route path="recommendations" element={<Favorites />} />
      <Route path="analytics" element={<Analytics />} />
      <Route path="settings" element={<SettingsPage />} />
      <Route path="home" element={<Home />} />
      <Route path="guides" element={<GuidesPage />} />
      <Route path="guides/new" element={<CreateGuidePage />} />
      <Route path="guides/:guideId" element={<GuideDetailsPage />} />
      <Route path="guides/:guideId/sections/new" element={<GuideSectionFormPage />} />
      <Route path="guides/:guideId/sections/:sectionId/edit" element={<GuideSectionFormPage />} />
      <Route path="music" element={<Music />} />
      <Route path="instagram" element={<Instagram />} />
      <Route path="recommendations/movies" element={<MoviesHome />} />
      <Route path="recommendations/movies/:listId" element={<MovieListView />} />
      <Route path=":listId/new" element={<AddRecommendation />} />
      <Route
        path="guides/:guideId/edit"
        element={<CreateGuidePage type="edit" />}
      />
      <Route path=":listId/new" element={<AddRecommendation />} />
      <Route path=":placeId/edit" element={<AddRecommendation type="edit" />} />
    </Route>
  );

  const mobileRoutes = (
    <Route key="mobile-routes" path="/*" element={<MobileLayout />}>
      <Route path="profile" element={<Profile />} />
      <Route path="recommendations" element={<Favorites />} />
      <Route path="analytics" element={<Analytics />} />
      <Route path="settings" element={<SettingsPage />} />
      <Route path="home" element={<Home />} />
      <Route path="guides" element={<GuidesPage />} />
      <Route path="guides/new" element={<CreateGuidePage />} />
      <Route path="guides/:guideId" element={<GuideDetailsPage />} />
      <Route path="guides/:guideId/sections/new" element={<GuideSectionFormPage />} />
      <Route path="guides/:guideId/sections/:sectionId/edit" element={<GuideSectionFormPage />} />
      <Route
        path="guides/:guideId/edit"
        element={<CreateGuidePage type="edit" />}
      />
      <Route path=":listId/new" element={<AddRecommendation />} />
      <Route path=":placeId/edit" element={<AddRecommendation type="edit" />} />
      <Route path="music" element={<Music />} />
      <Route path="instagram" element={<Instagram />} />
      <Route path="recommendations/movies" element={<MoviesHome />} />
      <Route path="recommendations/movies/:listId" element={<MovieListView />} />
    </Route>
  );

  return [
    <Route key="protected-wrapper" element={<ProtectedRoute />}>
      <Route key="subscription-plans" path="/subscription-plans" element={<SubscriptionPlans />} />
      <Route key="checkout" path="/checkout" element={<Checkout />} />
      <Route key="onboarding" path="/onboarding" element={<OnBoarding />} />
      {isDesktop ? desktopRoutes : mobileRoutes}
    </Route>,
  ];
};

export default ProtectedRoutes;
