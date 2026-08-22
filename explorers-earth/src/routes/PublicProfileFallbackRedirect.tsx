import { useContext } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { PublicRouteReadinessContext } from "../layouts/PublicRouteReadinessContext";

export type PublicProfileFallbackLocationState = {
  publicProfileFallback: true;
};

const publicProfileFallbackLocationState: PublicProfileFallbackLocationState = {
  publicProfileFallback: true,
};

export function PublicProfileFallbackRedirect({ expectedGeneration }: { expectedGeneration?: string }) {
  const { username } = useParams<{ username: string }>();
  const location = useLocation();
  const readiness = useContext(PublicRouteReadinessContext);

  if (expectedGeneration && readiness && expectedGeneration !== readiness.generation) {
    return null;
  }

  return (
    <Navigate
      replace
      state={publicProfileFallbackLocationState}
      to={{
        pathname: username ? `/${username}` : "/",
        search: location.search,
        hash: location.hash,
      }}
    />
  );
}
