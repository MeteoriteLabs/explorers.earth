import { useEffect, useContext } from "react";
import { useParams, Outlet } from "react-router-dom";
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

      markLoading?.(generation);
    }
  }, [data, loading, error, generation, markLoading, markError, markNotFound, refetch]);

  if (loading || error || !data || !data.accounts?.[0]) {
    return null;
  }

  return <Outlet />;
};

export default UsernameValidator;
