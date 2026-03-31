import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidenav";
import Header from "../components/Header";
import { DashboardRouteValidator } from "../routes/validators";
import { DashboardThemeProvider } from "../contexts/DashboardThemeContext";
import RouteLoader from "../components/RouteLoader";

const DashboardLayout = () => {
  return (
    <DashboardThemeProvider>
      <DashboardRouteValidator>
        <div className="dashboard-theme flex h-screen bg-dashboard-bg">
          {/* Sidebar */}
          <Sidebar />

          {/* Main Content - width/margin driven by body[data-sidebar-open] via CSS */}
          <div className="dashboard-content relative flex flex-col bg-dashboard-bg">
            <RouteLoader />
            <Header />
            <div className="flex-1 overflow-auto">
              <Outlet />
            </div>
          </div>
        </div>
      </DashboardRouteValidator>
    </DashboardThemeProvider>
  );
};

export default DashboardLayout;
