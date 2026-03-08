import { Outlet, useLocation } from "react-router-dom";
import PublicNav from "../components/PublicNav";

const PublicLayout = () => {
  const location = useLocation();

  // Check if current route is a map route
  const isMapRoute = location.pathname.includes('/map') || location.pathname.includes('/placesmap');

  return (
    <>
      {!isMapRoute && <PublicNav />}
      <main>
        <Outlet />
      </main>
    </>
  );
};

export default PublicLayout;
