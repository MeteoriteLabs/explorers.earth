import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import useAuthStore from "../store/store";
import { useLogout } from "../hooks/useLogout";
import { EarthLoader } from "./EarthLoader";
import OnboardingCheckError from "./OnboardingCheckError";
import { AccountLifecycleError, createAccountLifecycleService } from "../services/accountLifecycleService";
import { useAccountLifecycleIdentity } from "../services/useAccountLifecycleIdentity";
import { useCanonicalAccount } from "../features/Profile/api/useCanonicalAccount";

/** The canonical owner account is the authority for onboarding redirects. */
const ProtectedRoute = () => {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();
  const account = useCanonicalAccount({ skip: !isAuthenticated });
  const lifecycleIdentity = useAccountLifecycleIdentity();
  const logout = useLogout();
  const isAccountComplete = account.data?.onboardingStatus === "complete";
  const [gate, setGate] = useState<{ identity: typeof lifecycleIdentity; status: "idle" | "checking" | "pending" | "none" | "error" }>({ identity: lifecycleIdentity, status: "idle" });
  const deletionGate = gate.identity === lifecycleIdentity ? gate.status : "idle";
  const [lifecycleRetry, setLifecycleRetry] = useState(0);

  useEffect(() => {
    if (!isAuthenticated || account.isLoading || account.error || isAccountComplete || location.pathname !== "/settings") {
      setGate({ identity: lifecycleIdentity, status: "idle" });
      return;
    }
    let active = true;
    setGate({ identity: lifecycleIdentity, status: "checking" });
    void Promise.resolve().then(() => createAccountLifecycleService({
      baseUrl: import.meta.env.VITE_LOCAL_TUNES_API_URL || "https://localtunes.earth",
      getBearer: lifecycleIdentity.getBearer,
    }).status()).then((result) => {
      if (!active || !lifecycleIdentity.isCurrent()) return;
      setGate({ identity: lifecycleIdentity, status: result.operation.status === "pending_deletion" || result.operation.status === "tombstoned"
        ? "pending" : "none" });
    }).catch((cause) => {
      if (!active || !lifecycleIdentity.isCurrent()) return;
      setGate({ identity: lifecycleIdentity, status: cause instanceof AccountLifecycleError && cause.code === "LIFECYCLE_NOT_FOUND" ? "none" : "error" });
    });
    return () => { active = false; };
  }, [account.error, account.isLoading, isAccountComplete, isAuthenticated, location.pathname, lifecycleIdentity, lifecycleRetry]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (account.isLoading) return <div className="dashboard-theme dashboard-theme-dark bg-dashboard-bg min-h-screen flex items-center justify-center">
    <EarthLoader context="general" size="default" />
  </div>;
  if (account.error || !account.data) return <OnboardingCheckError onRetry={() => { void account.refetch(); }} onLogout={logout} />;

  if (!isAccountComplete && location.pathname === "/settings") {
    if (deletionGate === "idle" || deletionGate === "checking") return <EarthLoader context="general" size="default" />;
    if (deletionGate === "pending") return <Outlet />;
    if (deletionGate === "error") return <OnboardingCheckError onRetry={() => {
      if (!lifecycleIdentity.isCurrent()) return;
      setGate({ identity: lifecycleIdentity, status: "idle" });
      setLifecycleRetry((attempt) => attempt + 1);
      void account.refetch();
    }} onLogout={() => { if (lifecycleIdentity.isCurrent()) logout(); }} />;
  }

  const allowedDuringOnboarding = ["/onboarding", "/music", "/recommendations/music", "/instagram", "/subscription-plans", "/checkout"];
  if (allowedDuringOnboarding.includes(location.pathname)) {
    if (location.pathname === "/onboarding" && isAccountComplete) return <Navigate to="/home" replace />;
    return <Outlet />;
  }
  if (!isAccountComplete) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
};

export default ProtectedRoute;
