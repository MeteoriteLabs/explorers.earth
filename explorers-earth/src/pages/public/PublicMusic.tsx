import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Music2 } from "lucide-react";
import SEO from "../../components/SEO";
import {
  publicMusicClient,
  PublicMusicError,
  type PublicMusicResource,
} from "../../features/music/publicMusicClient";
import { PublicMusicSections } from "../../features/music/components/PublicMusicSections";

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
}: {
  state: PublicMusicViewState;
  resource?: PublicMusicResource;
  retryAfterSeconds?: number;
  onRetry?: () => void;
  standalone?: boolean;
  returnTo?: string;
  publicSlug?: string;
  capability?: string;
}) {
  const Frame = standalone ? "main" : "div";
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
        <PublicMusicSections resource={resource} publicSlug={publicSlug} capability={capability} onReconcile={onRetry} />
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
  const [state, setState] = useState<PublicMusicViewState>(publicSlug ? "loading" : "not-found");
  const [resource, setResource] = useState<PublicMusicResource>();
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(60);
  const [attempt, setAttempt] = useState(0);
  const capability = publicSlug ? capabilityFromFragment(location.hash || window.location.hash) ?? retainedCapability(publicSlug) : undefined;

  useEffect(() => {
    if (!publicSlug) return;
    const controller = new AbortController();
    const fragment = location.hash || window.location.hash;
    const fragmentCapability = capabilityFromFragment(fragment);
    if (fragmentCapability) retainCapability(publicSlug, fragmentCapability);
    const capability = fragmentCapability ?? retainedCapability(publicSlug);
    if (window.location.hash) {
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
    }
    setResource(undefined);
    setState("loading");
    publicMusicClient.load(publicSlug, capability, controller.signal).then((value) => {
      if (controller.signal.aborted) return;
      setResource(value);
      setState("ready");
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      if (error instanceof PublicMusicError && error.code === "PUBLIC_NOT_FOUND") {
        forgetCapability(publicSlug);
        setState("not-found");
      }
      else if (error instanceof PublicMusicError && error.code === "RATE_LIMITED") {
        setRetryAfterSeconds(error.retryAfterSeconds ?? 60);
        setState("rate-limited");
      } else setState("unavailable");
    });
    return () => { controller.abort(); };
  }, [attempt, location.hash, location.pathname, publicSlug]);

  return (
    <>
      <SEO
        title="Music | Explorers"
        description="Public Music playlists on Explorers."
        canonical={publicSlug ? `${window.location.origin}/music/share/${encodeURIComponent(publicSlug)}` : undefined}
        noIndex={Boolean(capability)}
        noFollow={Boolean(capability)}
      />
      <PublicMusicContent state={state} resource={resource} publicSlug={publicSlug} capability={capability} retryAfterSeconds={retryAfterSeconds} onRetry={() => setAttempt((value) => value + 1)} />
    </>
  );
}
