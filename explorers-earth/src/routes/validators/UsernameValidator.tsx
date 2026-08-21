import { useEffect, useContext } from "react";
import { useNavigate, useParams, useLocation, Outlet } from "react-router-dom";
import { useQuery } from "@apollo/client";
import { gql } from "@apollo/client";
import { PublicRouteReadinessContext } from "../../layouts/PublicRouteReadinessContext";

// Query to check if username exists — intentionally minimal
export const checkUsernameQuery = gql`
  query CheckUsername($username: String!) {
    accounts(filters: { username: { eq: $username } }) {
      documentId
      Account_Name
    }
  }
`;

export const UsernameValidator = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const readinessCtx = useContext(PublicRouteReadinessContext);
  const generation = readinessCtx?.generation || "";
  const markLoading = readinessCtx?.markLoading;
  const markError = readinessCtx?.markError;
  const markNotFound = readinessCtx?.markNotFound;

  const { data, loading, error, refetch } = useQuery(checkUsernameQuery, {
    variables: { username },
    skip: !username,
  });

  useEffect(() => {
    if (loading) {
      markLoading?.(generation);
      return;
    }

    if (error) {
      markError?.(generation, "username", refetch);
      return;
    }

    if (data) {
      const account = data.accounts?.[0];

      // If username doesn't exist, mark not found
      if (!account) {
        markNotFound?.(generation);
        return;
      }

      // Normalize the path to handle trailing slashes
      const normalizedPath = location.pathname.replace(/\/$/, "");
      const pathSegments = normalizedPath.split("/");

      // If we have more than 2 segments, validate the nested route
      if (pathSegments.length > 2) {
        const validRoutes = [
          "places",
          "community",
          "music",
          "guides",
          "movies",
          "books",
          "games",
          "apps",
          "products",
          "people",
        ];
        const currentRoute = pathSegments[2];

        // Check if the current route is valid
        if (!validRoutes.includes(currentRoute)) {
          navigate(`/${username}/places`, { replace: true });
          return;
        }

        // Additional validation for places sub-routes
        if (currentRoute === "places" && pathSegments.length > 3) {
          const validPlacesSubRoutes = ["map"];
          const placesSubRoute = pathSegments[3];

          if (
            !validPlacesSubRoutes.includes(placesSubRoute) &&
            !/^[a-zA-Z0-9-_]+$/.test(placesSubRoute)
          ) {
            navigate(`/${username}/places`, { replace: true });
            return;
          }
        }
      }

      readinessCtx?.markLoading(generation);
    }
  }, [data, loading, error, username, navigate, location.pathname, generation, readinessCtx, refetch]);

  if (loading || error || !data || !data.accounts?.[0]) {
    return null;
  }

  return <Outlet />;
};

export default UsernameValidator;