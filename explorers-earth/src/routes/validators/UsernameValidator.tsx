import { useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useQuery } from "@apollo/client";
import { gql } from "@apollo/client";
import { EarthLoader } from "../../components/EarthLoader";
import NotFound from "../../pages/NotFound";

// Query to check if username exists — intentionally minimal
const checkUsernameQuery = gql`
  query CheckUsername($username: String!) {
    accounts(filters: { username: { eq: $username } }) {
      documentId
      Account_Name
    }
  }
`;

interface UsernameValidatorProps {
  children: React.ReactNode;
}

const UsernameValidator = ({ children }: UsernameValidatorProps) => {
  const { username } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const { data, loading, error } = useQuery(checkUsernameQuery, {
    variables: { username },
    skip: !username,
  });

  useEffect(() => {
    if (!loading && !error && data) {
      const account = data.accounts[0];

      // If username doesn't exist, show 404
      if (!account) {
        return; // This will render NotFound component
      }

      // Normalize the path to handle trailing slashes
      // Remove trailing slash and split
      const normalizedPath = location.pathname.replace(/\/$/, '');
      const pathSegments = normalizedPath.split('/');

      // If we have exactly 2 segments (e.g., /correctUsername), don't redirect
      if (pathSegments.length === 2) {
        return; // Allow the route to render normally
      }

      // If we have more than 2 segments, validate the nested route
      if (pathSegments.length > 2) {
        const validRoutes = ['places', 'community', 'music', 'guides', 'movies'];
        const currentRoute = pathSegments[2];

        // Check if the current route is valid
        if (!validRoutes.includes(currentRoute)) {
          // Redirect to the user's places page
          navigate(`/${username}/places`, { replace: true });
          return;
        }

        // Additional validation for places sub-routes
        if (currentRoute === 'places' && pathSegments.length > 3) {
          const validPlacesSubRoutes = ['map'];
          const placesSubRoute = pathSegments[3];

          // If it's not a valid places sub-route and not a placeSlug (which can be anything), redirect
          if (!validPlacesSubRoutes.includes(placesSubRoute) &&
            !/^[a-zA-Z0-9-_]+$/.test(placesSubRoute)) {
            navigate(`/${username}/places`, { replace: true });
            return;
          }
        }
      }
    }
  }, [data, loading, error, username, navigate, location.pathname]);

  // Show loading while checking username
  if (loading) {
    return (
      <div className="bg-black">
        <EarthLoader context="general" />
      </div>
    );
  }

  // Show 404 if username doesn't exist
  if (!loading && (!data || !data.accounts[0])) {
    return <NotFound />;
  }

  // Render children if username is valid
  return <>{children}</>;
};

export default UsernameValidator; 