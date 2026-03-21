import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

interface DashboardRouteValidatorProps {
  children: React.ReactNode;
}

const DashboardRouteValidator = ({
  children,
}: DashboardRouteValidatorProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Define valid dashboard route patterns
    const validRoutePatterns = [
      /^\/home$/,
      /^\/profile$/,
      /^\/recommendations$/,
      /^\/analytics$/,
      /^\/settings$/,
      /^\/music$/,
      /^\/instagram$/,
      /^\/onboarding$/,
      /^\/guides$/,
      /^\/guides\/new$/,
      /^\/guides\/[^\/]+$/, // Guide details: /guides/:guideId
      /^\/guides\/[^\/]+\/edit$/,
      /^\/guides\/[^\/]+\/sections\/new$/, // Add section: /guides/:guideId/sections/new
      /^\/guides\/[^\/]+\/sections\/[^\/]+\/edit$/, // Edit section: /guides/:guideId/sections/:sectionId/edit
      /^\/recommendations\/movies$/, // Movies & Shows home
      /^\/recommendations\/movies\/[^\/]+$/, // Movie list view: /recommendations/movies/:listId
      /^\/[^\/]+\/new$/, // Dynamic routes like /:listId/new
      /^\/[^\/]+\/edit$/, // Dynamic routes like /:placeId/edit
    ];

    // Check if current path matches any valid pattern
    const currentPath = location.pathname;
    const isValidRoute = validRoutePatterns.some((pattern) =>
      pattern.test(currentPath)
    );

    if (!isValidRoute) {
      // Redirect to NotFound page for invalid dashboard routes
      navigate("/404", { replace: true });
    }
  }, [location.pathname, navigate]);

  return <>{children}</>;
};

export default DashboardRouteValidator;
