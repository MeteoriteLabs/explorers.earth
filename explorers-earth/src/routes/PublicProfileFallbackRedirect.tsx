import { Navigate, useLocation, useParams } from "react-router-dom";

export type PublicProfileFallbackLocationState = {
  publicProfileFallback: true;
};

const publicProfileFallbackLocationState: PublicProfileFallbackLocationState = {
  publicProfileFallback: true,
};

export function PublicProfileFallbackRedirect() {
  const { username } = useParams<{ username: string }>();
  const location = useLocation();

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
