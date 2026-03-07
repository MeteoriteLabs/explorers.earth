import { Outlet } from "react-router-dom";
import Header from "../components/Header";
import Navbar from "../components/Navbar";
import { DashboardRouteValidator } from "../routes/validators";
import { DashboardThemeProvider } from "../contexts/DashboardThemeContext";
import RouteLoader from "../components/RouteLoader";

const MobileLayout = () => {
  return (
    <DashboardThemeProvider>
      <DashboardRouteValidator>
        <div className="dashboard-theme bg-dashboard-bg min-h-screen">
          <Header />
          <RouteLoader />
          <main className="pt-16 md:pt-0">
            <Outlet />
          </main>
          <Navbar />
        </div>
      </DashboardRouteValidator>
    </DashboardThemeProvider>
  );
};

export default MobileLayout;
