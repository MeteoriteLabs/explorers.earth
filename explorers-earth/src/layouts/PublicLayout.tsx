import { useState, useEffect } from "react";
import { Outlet, useLocation, useParams } from "react-router-dom";
import PublicNav from "../components/PublicNav";
import { EarthLoader } from "../components/EarthLoader";
import { PublicMusicAvailabilityProvider } from "../features/music/PublicMusicAvailabilityProvider";
import PublicProfileThemeProvider from "../features/PublicHome/components/PublicProfileThemeProvider";

const PublicLayout = () => {
  const location = useLocation();
  const { username } = useParams();
  const [isPageLoaded, setIsPageLoaded] = useState(false);

  // Check if current route is a map route
  const isMapRoute = location.pathname.includes('/map') || location.pathname.includes('/placesmap');

  // Readiness belongs to the route, so a prior child cannot reveal the next one.
  useEffect(() => {
    setIsPageLoaded(false);
  }, [username, location.pathname]);

  return (
    <PublicMusicAvailabilityProvider>
      <PublicProfileThemeProvider>
      {isPageLoaded && !isMapRoute && <PublicNav />}
      <main>
        <Outlet context={{ isPageLoaded, setIsPageLoaded }} />
      </main>
      {!isPageLoaded && (
        <div className="bg-black min-h-screen fixed inset-0 z-50 flex items-center justify-center">
          <EarthLoader context="general" size="default" />
        </div>
      )}
      </PublicProfileThemeProvider>
    </PublicMusicAvailabilityProvider>
  );
};

export default PublicLayout;
