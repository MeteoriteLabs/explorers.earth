import { Outlet } from "react-router-dom";

import { usePublicProfileBootstrap } from "../../layouts/PublicProfileBootstrapContext";

export function UsernameValidator() {
  const bootstrap = usePublicProfileBootstrap();

  if (bootstrap.status !== "ready") return null;

  return <Outlet />;
}

export default UsernameValidator;
