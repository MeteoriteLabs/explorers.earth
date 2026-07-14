import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@apollo/client";
import { gql } from "@apollo/client";
import useAuthStore from "../store/store";
import { EarthLoader } from "./EarthLoader";

const checkOnboardingStatusQuery = gql`
  query CheckOnboardingStatus($documentId: ID!) {
    usersPermissionsUser(documentId: $documentId) {
      accounts {
        Account_Name
        Account_Type
        mobile_number
      }
    }
  }
`;

const ProtectedRoute = () => {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  const { data, loading } = useQuery(checkOnboardingStatusQuery, {
    variables: { documentId: user?.documentId },
    skip: !user?.documentId,
    fetchPolicy: "cache-first", // Use cache to speed up navigation
    nextFetchPolicy: "cache-first",
  });

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    const savedTheme = localStorage.getItem('dashboard-theme');
    const isDark = savedTheme === 'dark' || !savedTheme;
    return (
      <div className={`dashboard-theme ${isDark ? 'dashboard-theme-dark' : ''} bg-dashboard-bg min-h-screen flex items-center justify-center`}>
        <EarthLoader context="general" size="default" />
      </div>
    );
  }

  // Check if mandatory fields are missing
  const account = data?.usersPermissionsUser?.accounts?.[0];
  const isOnboardingRequired =
    !account ||
    !account.Account_Name ||
    !account.Account_Type ||
    !account.mobile_number;

  // Allow access to onboarding, music, instagram, subscription-plans, and checkout pages even if onboarding is required
  const allowedDuringOnboarding = [
    "/onboarding",
    "/music",
    "/instagram",
    "/subscription-plans",
    "/checkout"
  ];

  const isAllowedRoute = allowedDuringOnboarding.includes(location.pathname);

  // Debug logging
  console.log("ProtectedRoute - pathname:", location.pathname, "isAllowedRoute:", isAllowedRoute, "isOnboardingRequired:", isOnboardingRequired);

  // Always allow subscription-plans, music, and onboarding routes
  if (isAllowedRoute) {
    // If we're on the onboarding page but onboarding is not required, redirect to home
    if (location.pathname === "/onboarding" && !isOnboardingRequired) {
      return <Navigate to="/home" replace />;
    }
    // Otherwise, show the allowed route
    return <Outlet />;
  }

  // For all other protected routes, check if onboarding is required
  if (isOnboardingRequired) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
