import { useEffect, useCallback, useRef, useMemo, useReducer } from "react";
import { Outlet, useLocation, useParams } from "react-router-dom";
import PublicNav from "../components/PublicNav";
import NotFound from "../pages/NotFound";
import PublicProfileSkeleton from "../features/PublicHome/components/PublicProfileSkeleton";
import PublicProfileFeedback from "../features/PublicHome/components/PublicProfileFeedback";
import { EarthLoader } from "../components/EarthLoader";
import {
  PublicRouteReadinessContext,
  type PublicRouteReadinessContextValue,
} from "./PublicRouteReadinessContext";
import {
  createGenerationBoundRouteActions,
  createInitialPublicRouteState,
  publicRouteReadinessReducer,
  type PublicRouteErrorSource,
} from "./publicRouteReadiness";
import { useTranslation } from "react-i18next";

const PublicLayout = () => {
  const location = useLocation();
  const { username } = useParams();
  const { t } = useTranslation();

  const generation = useMemo(() => `${username || ""}:${location.key}`, [username, location.key]);
  const generationRef = useRef(generation);
  generationRef.current = generation;
  const resetGenerationRef = useRef(generation);

  const [readiness, dispatch] = useReducer(
    publicRouteReadinessReducer,
    generation,
    createInitialPublicRouteState,
  );
  const retryRef = useRef<(() => Promise<unknown>) | null>(null);

  // Reset state on generation change
  useEffect(() => {
    if (resetGenerationRef.current === generation) return;
    resetGenerationRef.current = generation;
    retryRef.current = null;
    dispatch({ type: "begin-bootstrap", generation });
  }, [generation]);

  const actions = useMemo(
    () =>
      createGenerationBoundRouteActions({
        generation,
        isCurrent: () => generationRef.current === generation,
        dispatch,
      }),
    [generation],
  );

  const markLoading = useCallback((gen: string) => {
    dispatch({ type: "begin-route", generation: gen });
  }, []);

  const markReady = useCallback((gen: string) => {
    dispatch({ type: "ready", generation: gen });
  }, []);

  const markRefreshing = useCallback((gen: string) => {
    dispatch({ type: "refreshing", generation: gen });
  }, []);

  const markEmpty = useCallback((gen: string) => {
    dispatch({ type: "empty", generation: gen });
  }, []);

  const markNotFound = useCallback((gen: string) => {
    dispatch({ type: "not-found", generation: gen });
  }, []);

  const markError = useCallback(
    (gen: string, source: PublicRouteErrorSource, retryFn: () => Promise<unknown>) => {
      if (gen !== generationRef.current) return;
      retryRef.current = retryFn;
      dispatch({ type: "failed", generation: gen, source });
    },
    []
  );

  const contextValue = useMemo<PublicRouteReadinessContextValue>(
    () => ({
      generation,
      readiness,
      markLoading,
      markReady,
      markRefreshing,
      markEmpty,
      markNotFound,
      markError,
    }),
    [generation, readiness, markLoading, markReady, markRefreshing, markEmpty, markNotFound, markError]
  );

  // Check if current route is a map route
  const isMapRoute = location.pathname.includes("/map") || location.pathname.includes("/placesmap");
  const isPageLoaded = readiness.status === "ready" || readiness.status === "empty" || readiness.status === "refreshing";

  return (
    <PublicRouteReadinessContext.Provider value={contextValue}>
      {readiness.status === "not-found" ? (
        <NotFound />
      ) : readiness.status === "validating-bootstrap" ? (
        <div className="min-h-screen bg-black flex items-center justify-center">
          <EarthLoader context="general" size="default" />
          <div className="hidden" aria-hidden="true">
            <Outlet />
          </div>
        </div>
      ) : isPageLoaded ? (
        <>
          {isPageLoaded && !isMapRoute && <PublicNav />}
          <main>
            <Outlet />
          </main>
        </>
      ) : (
        <>
          <PublicProfileSkeleton />
          {readiness.status === "error" && (
            <PublicProfileFeedback
              kind="all-error"
              title={
                readiness.source === "username"
                  ? t("publicProfile.error.verifyTitle", "Couldn’t verify this profile")
                  : readiness.source === "profile"
                    ? t("publicProfile.error.loadTitle", "Couldn’t load this profile")
                    : t("publicProfile.error.sectionTitle", "Couldn’t load this section")
              }
              description={t("publicProfile.error.description", "Please check your connection and try again.")}
              retrying={readiness.retrying}
              onRetry={() => {
                const retry = retryRef.current;
                if (retry) void actions.retry(retry).catch(() => undefined);
              }}
            />
          )}
          <div className="hidden" aria-hidden="true">
            <Outlet />
          </div>
        </>
      )}
    </PublicRouteReadinessContext.Provider>
  );
};

export default PublicLayout;
