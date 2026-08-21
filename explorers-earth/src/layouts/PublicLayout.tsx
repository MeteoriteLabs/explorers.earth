import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Outlet, useLocation, useParams } from "react-router-dom";
import PublicNav from "../components/PublicNav";
import NotFound from "../pages/NotFound";
import PublicProfileSkeleton from "../features/PublicHome/components/PublicProfileSkeleton";
import PublicProfileFeedback from "../features/PublicHome/components/PublicProfileFeedback";
import {
  PublicRouteReadinessContext,
  type PublicRouteReadiness,
  type PublicRouteReadinessContextValue,
} from "./PublicRouteReadinessContext";
import { useTranslation } from "react-i18next";

const PublicLayout = () => {
  const location = useLocation();
  const { username } = useParams();
  const { t } = useTranslation();

  const generation = useMemo(() => `${username || ""}:${location.key}`, [username, location.key]);
  const generationRef = useRef(generation);
  generationRef.current = generation;

  const [readiness, setReadiness] = useState<PublicRouteReadiness>({ status: "validating-username" });
  const retryingRef = useRef(false);

  // Reset state on generation change
  useEffect(() => {
    setReadiness({ status: "validating-username" });
    retryingRef.current = false;
  }, [generation]);

  const markLoading = useCallback((gen: string) => {
    if (gen !== generationRef.current) return;
    setReadiness((prev) => {
      if (prev.status === "validating-username") {
        return { status: "loading-route" };
      }
      return prev;
    });
  }, []);

  const markReady = useCallback((gen: string) => {
    if (gen !== generationRef.current) return;
    setReadiness({ status: "ready" });
  }, []);

  const markNotFound = useCallback((gen: string) => {
    if (gen !== generationRef.current) return;
    setReadiness({ status: "not-found" });
  }, []);

  const markError = useCallback(
    (gen: string, source: "username" | "profile", retryFn: () => Promise<unknown>) => {
      if (gen !== generationRef.current) return;

      const retry = async () => {
        const currentGen = generationRef.current;
        if (currentGen !== gen || retryingRef.current) return;

        retryingRef.current = true;
        setReadiness({ status: "route-error", source, retrying: true, retry });

        try {
          await retryFn();
        } catch {
          if (generationRef.current === currentGen) {
            setReadiness({ status: "route-error", source, retrying: false, retry });
          }
        } finally {
          retryingRef.current = false;
        }
      };

      setReadiness({
        status: "route-error",
        source,
        retrying: false,
        retry,
      });
    },
    []
  );

  const setIsPageLoaded = useCallback(
    (loaded: boolean) => {
      const currentGen = generationRef.current;
      if (loaded) {
        markReady(currentGen);
      } else {
        markLoading(currentGen);
      }
    },
    [markReady, markLoading]
  );

  const contextValue = useMemo<PublicRouteReadinessContextValue>(
    () => ({
      generation,
      readiness,
      markLoading,
      markReady,
      markNotFound,
      markError,
      setIsPageLoaded,
    }),
    [generation, readiness, markLoading, markReady, markNotFound, markError, setIsPageLoaded]
  );

  // Check if current route is a map route
  const isMapRoute = location.pathname.includes("/map") || location.pathname.includes("/placesmap");
  const isPageLoaded = readiness.status === "ready";

  const outletContext = useMemo(
    () => ({ isPageLoaded, setIsPageLoaded }),
    [isPageLoaded, setIsPageLoaded]
  );

  return (
    <PublicRouteReadinessContext.Provider value={contextValue}>
      {readiness.status === "not-found" ? (
        <NotFound />
      ) : readiness.status === "ready" ? (
        <>
          {isPageLoaded && !isMapRoute && <PublicNav />}
          <main>
            <Outlet context={outletContext} />
          </main>
        </>
      ) : (
        <>
          <PublicProfileSkeleton />
          {readiness.status === "route-error" && (
            <PublicProfileFeedback
              kind="all-error"
              title={
                readiness.source === "username"
                  ? t("publicProfile.error.verifyTitle", "Couldn’t verify this profile")
                  : t("publicProfile.error.loadTitle", "Couldn’t load this profile")
              }
              description={t("publicProfile.error.description", "Please check your connection and try again.")}
              retrying={readiness.retrying}
              onRetry={readiness.retry}
            />
          )}
          <div className="hidden" aria-hidden="true">
            <Outlet context={outletContext} />
          </div>
        </>
      )}
    </PublicRouteReadinessContext.Provider>
  );
};

export default PublicLayout;
