import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import {
  matchRoutes,
  Outlet,
  useLocation,
  useParams,
  type RouteObject,
} from "react-router-dom";
import { useTranslation } from "react-i18next";

import PublicNav from "../components/PublicNav";
import { EarthLoader } from "../components/EarthLoader";
import PublicProfileFeedback from "../features/PublicHome/components/PublicProfileFeedback";
import { getThemeTokenStyles } from "../features/Profile/constants/themePresets";
import { normalizeThemeSettings } from "../features/Profile/constants/recommendationsPresentation";
import NotFound from "../pages/NotFound";
import {
  publicRouteContract,
  type PublicRouteContractEntry,
} from "../routes/publicRouteContract";
import type { PublicProfileFallbackLocationState } from "../routes/PublicProfileFallbackRedirect";
import {
  PublicProfileBootstrapProvider,
  usePublicProfileBootstrap,
} from "./PublicProfileBootstrapContext";
import { PublicRouteReadinessContext, type PublicRouteReadinessContextValue } from "./PublicRouteReadinessContext";
import { PublicRouteSkeleton } from "./PublicRouteSkeleton";
import {
  createGenerationBoundRouteActions,
  createInitialPublicRouteState,
  publicRouteReadinessReducer,
  type PublicRouteErrorSource,
  type PublicRouteReadinessState,
} from "./publicRouteReadiness";

const publicRouteMatchers: RouteObject[] = [{
  path: "/:username",
  children: publicRouteContract.map((route) => ({
    id: route.id,
    index: "index" in route && route.index,
    path: "index" in route && route.index ? undefined : route.path,
  })),
}];

function matchedPublicRoute(pathname: string): PublicRouteContractEntry | undefined {
  const matches = matchRoutes(publicRouteMatchers, pathname);
  const matchedId = matches?.[matches.length - 1]?.route.id;
  return publicRouteContract.find((route) => route.id === matchedId);
}

function focusFirstContentHeading() {
  const heading = document.querySelector<HTMLElement>(
    "main [data-public-route-content] h1, main [data-public-route-content] h2",
  );
  if (!heading) return;
  if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
  heading.focus({ preventScroll: true });
}

function PublicLayoutContent() {
  const location = useLocation();
  const { username } = useParams<{ username: string }>();
  const { t } = useTranslation();
  const bootstrap = usePublicProfileBootstrap();
  const route = matchedPublicRoute(location.pathname);
  const generation = useMemo(
    () => `${username ?? ""}:${location.key}`,
    [location.key, username],
  );
  const generationRef = useRef(generation);
  generationRef.current = generation;
  const previousBootstrapKeyRef = useRef(bootstrap.bootstrapKey);
  const retryRef = useRef<(() => Promise<unknown>) | null>(null);

  const [readiness, dispatch] = useReducer(
    publicRouteReadinessReducer,
    generation,
    createInitialPublicRouteState,
  );

  useLayoutEffect(() => {
    const bootstrapChanged = previousBootstrapKeyRef.current !== bootstrap.bootstrapKey;
    if (bootstrapChanged) {
      previousBootstrapKeyRef.current = bootstrap.bootstrapKey;
      retryRef.current = null;
      dispatch({ type: "begin-bootstrap", generation });
      if (bootstrap.status === "ready") {
        dispatch({ type: "begin-route", generation });
      }
      return;
    }

    if (
      bootstrap.status === "ready" &&
      (readiness.generation !== generation || readiness.status === "validating-bootstrap")
    ) {
      retryRef.current = null;
      dispatch({ type: "begin-route", generation });
    }
  }, [bootstrap.bootstrapKey, bootstrap.status, generation, readiness.generation, readiness.status]);

  const actions = useMemo(
    () =>
      createGenerationBoundRouteActions({
        generation,
        isCurrent: () => generationRef.current === generation,
        dispatch,
      }),
    [generation],
  );

  const markLoading = useCallback((eventGeneration: string) => {
    dispatch({ type: "begin-route", generation: eventGeneration });
  }, []);
  const markReady = useCallback((eventGeneration: string) => {
    dispatch({ type: "ready", generation: eventGeneration });
  }, []);
  const markRefreshing = useCallback((eventGeneration: string) => {
    dispatch({ type: "refreshing", generation: eventGeneration });
  }, []);
  const markEmpty = useCallback((eventGeneration: string) => {
    dispatch({ type: "empty", generation: eventGeneration });
  }, []);
  const markNotFound = useCallback((eventGeneration: string) => {
    dispatch({ type: "not-found", generation: eventGeneration });
  }, []);
  const markError = useCallback(
    (
      eventGeneration: string,
      source: PublicRouteErrorSource,
      retry: () => Promise<unknown>,
      hasUsableContent: boolean,
    ) => {
      if (eventGeneration !== generationRef.current) return;
      retryRef.current = retry;
      dispatch({
        type: "failed",
        generation: eventGeneration,
        source,
        hasUsableContent,
      });
    },
    [],
  );

  const effectiveReadiness = useMemo<PublicRouteReadinessState>(() => {
    if (readiness.generation !== generation) {
      return { generation, status: "initial-loading" };
    }
    if (bootstrap.status === "ready" && readiness.status === "validating-bootstrap") {
      return { generation, status: "initial-loading" };
    }
    return readiness;
  }, [bootstrap.status, generation, readiness]);

  const contextValue = useMemo<PublicRouteReadinessContextValue>(
    () => ({
      generation,
      readiness: effectiveReadiness,
      markLoading,
      markReady,
      markRefreshing,
      markEmpty,
      markNotFound,
      markError,
    }),
    [effectiveReadiness, generation, markEmpty, markError, markLoading, markNotFound, markReady, markRefreshing],
  );

  const previousReadinessRef = useRef<PublicRouteReadinessState>(effectiveReadiness);
  const focusedFallbackKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const previous = previousReadinessRef.current;
    const isSettled = effectiveReadiness.status === "ready" || effectiveReadiness.status === "empty";
    const recovered = previous.status === "error" && isSettled;
    const fallbackState = location.state as PublicProfileFallbackLocationState | null;
    const landedFromFallback =
      route?.id === "profile" &&
      fallbackState?.publicProfileFallback === true &&
      focusedFallbackKeyRef.current !== location.key &&
      isSettled;

    if (recovered || landedFromFallback) {
      if (landedFromFallback) focusedFallbackKeyRef.current = location.key;
      window.requestAnimationFrame(focusFirstContentHeading);
    }

    previousReadinessRef.current = effectiveReadiness;
  }, [effectiveReadiness, location.key, location.state, route?.id]);

  if (bootstrap.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <EarthLoader context="general" size="default" />
      </div>
    );
  }

  if (bootstrap.status === "not-found" || effectiveReadiness.status === "not-found") {
    return <NotFound />;
  }

  if (bootstrap.status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4">
        <PublicProfileFeedback
          kind="all-error"
          focusOnMount
          title={t("publicProfile.error.verifyTitle", "Couldn’t verify this profile")}
          description={t(
            "publicProfile.error.description",
            "Please check your connection and try again.",
          )}
          retrying={bootstrap.retrying}
          onRetry={() => void bootstrap.retry().catch(() => undefined)}
        />
      </div>
    );
  }

  const skeletonKind = route?.skeleton ?? "profile-root";
  const isMapRoute = route?.shell === "map";
  const showContent =
    effectiveReadiness.status === "ready" ||
    effectiveReadiness.status === "empty" ||
    effectiveReadiness.status === "refreshing" ||
    (effectiveReadiness.status === "error" && effectiveReadiness.hasUsableContent);
  const isRefreshing = effectiveReadiness.status === "refreshing";
  const leafRefreshFailed =
    effectiveReadiness.status === "error" && effectiveReadiness.hasUsableContent;
  const bootstrapRefreshFailed = Boolean(bootstrap.refreshError);
  const refreshFailed = leafRefreshFailed || bootstrapRefreshFailed;
  const themeSettings = normalizeThemeSettings(
    (bootstrap.account.social_media as { theme_settings?: unknown } | null | undefined)
      ?.theme_settings,
  );

  const retryLeaf = () => {
    const retry = retryRef.current;
    if (retry) void actions.retry(retry).catch(() => undefined);
  };

  return (
    <PublicRouteReadinessContext.Provider value={contextValue}>
      <div
        className="min-h-screen"
        style={{
          ...getThemeTokenStyles(themeSettings),
          backgroundColor: "var(--bg-page)",
          color: "var(--text-primary)",
        }}
      >
        {!isMapRoute && <PublicNav />}

        {(isRefreshing || bootstrap.refreshing) && (
          <div
            data-testid="public-route-refresh-progress"
            aria-hidden="true"
            className="fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden bg-[var(--border-card)]"
          >
            <div className="h-full w-1/3 animate-pulse bg-[var(--accent-color)] motion-reduce:animate-none" />
          </div>
        )}

        <main aria-busy={isRefreshing || bootstrap.refreshing ? "true" : "false"}>
          {effectiveReadiness.status === "initial-loading" && (
            <PublicRouteSkeleton kind={skeletonKind} />
          )}

          {effectiveReadiness.status === "error" && !effectiveReadiness.hasUsableContent && (
            <PublicProfileFeedback
              kind="all-error"
              focusOnMount
              title={
                effectiveReadiness.source === "profile"
                  ? t("publicProfile.error.loadTitle", "Couldn’t load this profile")
                  : t("publicProfile.error.sectionTitle", "Couldn’t load this section")
              }
              description={t(
                "publicProfile.error.description",
                "Please check your connection and try again.",
              )}
              retrying={effectiveReadiness.retrying}
              onRetry={retryLeaf}
            />
          )}

          <div
            data-public-route-content
            className={showContent ? undefined : "hidden"}
            aria-hidden={showContent ? undefined : true}
          >
            <Outlet key={generation} />
          </div>

          {refreshFailed && (
            <PublicProfileFeedback
              kind="partial-error"
              title={t(
                "publicProfile.error.refreshTitle",
                "Couldn’t refresh this section",
              )}
              retrying={
                bootstrapRefreshFailed
                  ? bootstrap.retrying
                  : effectiveReadiness.status === "error"
                    ? effectiveReadiness.retrying
                    : false
              }
              onRetry={
                bootstrapRefreshFailed
                  ? () => void bootstrap.retry().catch(() => undefined)
                  : retryLeaf
              }
            />
          )}
        </main>
      </div>
    </PublicRouteReadinessContext.Provider>
  );
}

export default function PublicLayout() {
  return (
    <PublicProfileBootstrapProvider>
      <PublicLayoutContent />
    </PublicProfileBootstrapProvider>
  );
}
