import { useRef, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidenav";
import Header from "../components/Header";
import { DashboardRouteValidator } from "../routes/validators";
import { DashboardThemeProvider } from "../contexts/DashboardThemeContext";
import RouteLoader from "../components/RouteLoader";

const DashboardLayout = () => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollTop = useRef(0);
  const location = useLocation();

  // Reset scroll and header visibility on route change
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    document.body.classList.remove('hide-dashboard-header');
    lastScrollTop.current = 0;
  }, [location.pathname]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    
    const currentScrollTop = scrollContainerRef.current.scrollTop;
    const scrollDelta = currentScrollTop - lastScrollTop.current;

    // Only apply logic after a small initial scroll to avoid jitter at the very top
    if (currentScrollTop > 20) {
      if (scrollDelta > 0) {
        // Scrolling down - hide header to give more space
        document.body.classList.add('hide-dashboard-header');
      } else if (scrollDelta < 0) {
        // Scrolling up - the user specifically asked to keep it hidden 
        // to avoid clipping the tab switcher on large screens
        document.body.classList.add('hide-dashboard-header');
      }
    } else {
      // Near the very top - always show header
      document.body.classList.remove('hide-dashboard-header');
    }

    lastScrollTop.current = currentScrollTop;
  };

  return (
    <DashboardThemeProvider>
      <DashboardRouteValidator>
        <div className="dashboard-theme flex h-screen bg-dashboard-bg overflow-hidden">
          {/* Sidebar */}
          <Sidebar />

          {/* Main Content - width/margin driven by body[data-sidebar-open] via CSS */}
          <div className="dashboard-content relative flex flex-col bg-dashboard-bg min-w-0">
            <RouteLoader />
            <Header />
            <div 
              ref={scrollContainerRef}
              className="flex-1 overflow-auto pt-[72px] md:pt-[54px]"
              onScroll={handleScroll}
            >
              <Outlet />
            </div>
          </div>
        </div>
      </DashboardRouteValidator>
    </DashboardThemeProvider>
  );
};

export default DashboardLayout;
