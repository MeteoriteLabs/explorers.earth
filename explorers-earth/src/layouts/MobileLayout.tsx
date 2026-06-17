import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "../components/Header";
import Navbar from "../components/Navbar";
import { DashboardRouteValidator } from "../routes/validators";
import { DashboardThemeProvider } from "../contexts/DashboardThemeContext";
import RouteLoader from "../components/RouteLoader";

const MobileLayout = () => {
  const lastScrollTop = useRef(0);
  const location = useLocation();

  useEffect(() => {
    // Reset scroll and header visibility on route change
    window.scrollTo(0, 0);
    document.body.classList.remove('hide-dashboard-header');
    lastScrollTop.current = 0;
  }, [location.pathname]);

  useEffect(() => {
    (window as any).__dashboardLoaded = false;
    return () => {
      (window as any).__dashboardLoaded = false;
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollDelta = currentScrollTop - lastScrollTop.current;

      if (currentScrollTop > 20) {
        if (scrollDelta > 0) {
          document.body.classList.add('hide-dashboard-header');
        } else if (scrollDelta < 0) {
          // Keep it hidden on scroll up too, as requested
          document.body.classList.add('hide-dashboard-header');
        }
      } else {
        document.body.classList.remove('hide-dashboard-header');
      }

      lastScrollTop.current = currentScrollTop;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <DashboardThemeProvider>
      <DashboardRouteValidator>
        <div className="dashboard-theme bg-dashboard-bg min-h-screen">
          <Header />
          <RouteLoader />
          <main className="pt-16">
            <Outlet />
          </main>
          <Navbar />
        </div>
      </DashboardRouteValidator>
    </DashboardThemeProvider>
  );
};

export default MobileLayout;
