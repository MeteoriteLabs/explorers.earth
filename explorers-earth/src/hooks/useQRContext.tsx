import { useLocation, useParams } from "react-router-dom";

export type QRContext = "profile" | "places" | "recommendation";

/**
 * Custom hook to determine QR context based on current route
 *
 * Route patterns:
 * - /:username → 'profile' (PublicProfile page)
 * - /:username/places → 'places' (PublicHome page - places overview)
 * - /:username/places/:placeSlug → 'recommendation' (PublicHome page - specific recommendation)
 * - /recommendations (authenticated) → 'recommendation' (Favorites page)
 */
export const useQRContext = (): {
  context: QRContext;
  username?: string;
  recommendationListName?: string;
} => {
  const location = useLocation();
  const params = useParams();

  const { username, placeSlug } = params;
  const pathname = location.pathname;

  // Handle authenticated routes (recommendations page)
  if (pathname.includes("/recommendations")) {
    return {
      context: "recommendation",
      username: undefined, // Will be retrieved from auth store
      recommendationListName: undefined, // Will be retrieved from city store
    };
  }

  // Handle public routes
  if (username) {
    // Check if it's a places route
    if (pathname.includes("/places")) {
      if (placeSlug) {
        // Specific recommendation: /:username/places/:placeSlug
        return {
          context: "recommendation",
          username,
          recommendationListName: placeSlug,
        };
      } else {
        // Places overview: /:username/places
        return {
          context: "places",
          username,
          recommendationListName: undefined,
        };
      }
    } else {
      // Profile page: /:username
      return {
        context: "profile",
        username,
        recommendationListName: undefined,
      };
    }
  }

  // Default fallback
  return {
    context: "profile",
    username: undefined,
    recommendationListName: undefined,
  };
};
