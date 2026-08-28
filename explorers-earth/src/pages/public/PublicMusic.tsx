import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Music2 } from "lucide-react";
import SEO from "../../components/SEO";
import { type PublicMusicResource } from "../../features/music/publicMusicClient";
import { PublicMusicSections } from "../../features/music/components/PublicMusicSections";
import { usePublicMusicResource } from "../../features/music/usePublicMusicResource";
import { createPublicMusicAnalyticsOccurrence, usePublicMusicProductAnalytics, type PublicMusicProductEvent } from "../../features/music/publicMusicAnalytics";

type PublicMusicViewState = "loading" | "ready" | "not-found" | "rate-limited" | "unavailable";

function capabilityFromFragment(fragment: string): string | undefined {
  const params = new URLSearchParams(fragment.replace(/^#/, ""));
  const capability = params.get("access") ?? undefined;
  return capability && /^[A-Za-z0-9_-]{43}$/.test(capability) ? capability : undefined;
}

function capabilityStorageKey(publicSlug: string): string {
  return `explorers.music.unlisted-capability.v1:${publicSlug}`;
}

function retainedCapability(publicSlug: string): string | undefined {
  try {
    return capabilityFromFragment(`#access=${window.sessionStorage.getItem(capabilityStorageKey(publicSlug)) ?? ""}`);
  } catch {
    return undefined;
  }
}

function retainCapability(publicSlug: string, capability: string): void {
  try { window.sessionStorage.setItem(capabilityStorageKey(publicSlug), capability); } catch { /* storage can be unavailable */ }
}

function forgetCapability(publicSlug: string): void {
  try { window.sessionStorage.removeItem(capabilityStorageKey(publicSlug)); } catch { /* storage can be unavailable */ }
}

export function PublicMusicContent({
  state,
  resource,
  retryAfterSeconds = 60,
  onRetry,
  standalone = true,
  returnTo = "/",
  publicSlug,
  capability,
  analyticsRoute = "direct",
  onAnalytics,
}: {
  state: PublicMusicViewState;
  resource?: PublicMusicResource;
  retryAfterSeconds?: number;
  onRetry?: () => void;
  standalone?: boolean;
  returnTo?: string;
  publicSlug?: string;
  capability?: string;
  analyticsRoute?: "friendly" | "direct";
  onAnalytics?: (event: PublicMusicProductEvent, occurrenceId?: string) => void | Promise<void>;
}) {
  const Frame = standalone ? "main" : "div";
  const acknowledgedState = useRef<PublicMusicViewState>();
  const stateOccurrence = useRef<string>();
  useEffect(() => {
    if (acknowledgedState.current === state) return;
    stateOccurrence.current = createPublicMusicAnalyticsOccurrence();
    if (state === "ready") {
      acknowledgedState.current = state;
      void onAnalytics?.({ name: "navigation_opened", route: analyticsRoute }, stateOccurrence.current);
    } else if (state === "not-found" || state === "rate-limited" || state === "unavailable") {
      acknowledgedState.current = state;
      void onAnalytics?.({
        name: "unavailable",
        reason: state === "not-found" ? "not_public" : state === "rate-limited" ? "rate_limited" : "service_unavailable",
      }, stateOccurrence.current);
    } else {
      acknowledgedState.current = state;
    }
  }, [analyticsRoute, onAnalytics, state]);
  if (state === "loading") {
    return (
      <Frame className="min-h-screen bg-dashboard-bg px-4 py-20 text-dashboard-text">
        <div className="mx-auto max-w-4xl" role="status" aria-live="polite">Loading Music…</div>
      </Frame>
    );
  }
  if (state === "not-found") {
    return (
      <Frame className="flex min-h-screen items-center justify-center bg-dashboard-bg px-4 text-dashboard-text">
        <section className="max-w-md text-center">
          <Music2 aria-hidden="true" className="mx-auto mb-4 h-10 w-10 text-dashboard-accent" />
          <h1 className="text-2xl font-semibold">Music page unavailable</h1>
          {onRetry ? <button className="mt-6 min-h-11 rounded-lg bg-dashboard-accent px-5" type="button" onClick={onRetry}>Retry</button> : null}
          <Link className="mt-6 ml-3 inline-flex min-h-11 items-center rounded-lg border border-dashboard-border px-5" to={returnTo}>{standalone ? "Return to Explorers" : "Return to Profile"}</Link>
        </section>
      </Frame>
    );
  }
  if (state === "rate-limited") {
    return <RateLimitedMusic retryAfterSeconds={retryAfterSeconds} onRetry={onRetry} />;
  }
  if (state === "unavailable" || !resource) {
    return (
      <Frame className="flex min-h-screen items-center justify-center bg-dashboard-bg px-4 text-dashboard-text">
        <section className="max-w-md text-center" role="alert">
          <h1 className="text-2xl font-semibold">Music is temporarily unavailable.</h1>
          {onRetry ? <button className="mt-6 min-h-11 rounded-lg bg-dashboard-accent px-5" type="button" onClick={onRetry}>Retry</button> : null}
          <Link className="mt-6 ml-3 inline-flex min-h-11 items-center rounded-lg border border-dashboard-border px-5" to={returnTo}>{standalone ? "Return to Explorers" : "Return to Profile"}</Link>
        </section>
      </Frame>
    );
  }

  return (
    <Frame className="min-h-screen bg-dashboard-bg px-4 py-12 text-dashboard-text sm:px-6">
      <div className="mx-auto max-w-6xl">
        <h1 id="public-music-heading" tabIndex={-1} className="text-3xl font-semibold">Music</h1>
        <PublicMusicSections resource={resource} publicSlug={publicSlug} capability={capability} onReconcile={onRetry} onAnalytics={onAnalytics} />
      </div>
    </Frame>
  );
}

function RateLimitedMusic({ retryAfterSeconds, onRetry }: { retryAfterSeconds: number; onRetry?: () => void }) {
  const [ready, setReady] = useState(retryAfterSeconds <= 0);
  useEffect(() => {
    setReady(retryAfterSeconds <= 0);
    if (retryAfterSeconds <= 0) return;
    const timer = window.setTimeout(() => setReady(true), retryAfterSeconds * 1_000);
    return () => window.clearTimeout(timer);
  }, [retryAfterSeconds]);
  return (
    <main className="flex min-h-screen items-center justify-center bg-dashboard-bg px-4 text-dashboard-text">
      <section className="max-w-md text-center" role="alert">
        <h1 className="text-2xl font-semibold">Too many requests. Try again in {retryAfterSeconds} seconds.</h1>
        <button type="button" disabled={!ready} onClick={onRetry} className="mt-6 min-h-11 min-w-11 rounded-lg bg-dashboard-accent px-5 text-base font-semibold text-[var(--dash-accent-text)] disabled:cursor-not-allowed disabled:opacity-50">Retry</button>
      </section>
    </main>
  );
}

export default function PublicMusic() {
  const { publicSlug } = useParams<{ publicSlug: string }>();
  const location = useLocation();
  const capability = publicSlug ? capabilityFromFragment(location.hash || window.location.hash) ?? retainedCapability(publicSlug) : undefined;
  const revoke = useCallback(() => { if (publicSlug) forgetCapability(publicSlug); }, [publicSlug]);

  useEffect(() => {
    if (!publicSlug) return;
    const fragment = location.hash || window.location.hash;
    const fragmentCapability = capabilityFromFragment(fragment);
    if (fragmentCapability) retainCapability(publicSlug, fragmentCapability);
    if (window.location.hash) {
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
    }
  }, [location.hash, location.pathname, publicSlug]);

  const music = usePublicMusicResource({
    publicSlug, capability, enabled: Boolean(publicSlug), disabledState: "not-found", onRevoked: revoke,
  });
  const trackMusic = usePublicMusicProductAnalytics({ publicSlug, capability, route: "direct" });

  return (
    <>
      <SEO
        title="Music | Explorers"
        description="Public Music playlists on Explorers."
        canonical={publicSlug ? `${window.location.origin}/music/share/${encodeURIComponent(publicSlug)}` : undefined}
        noIndex={Boolean(capability)}
        noFollow={Boolean(capability)}
      />
      <PublicMusicContent state={music.state} resource={music.resource} publicSlug={publicSlug} capability={capability} retryAfterSeconds={music.retryAfterSeconds} onRetry={music.retry} analyticsRoute="direct" onAnalytics={trackMusic} />
    </>
  );
}
