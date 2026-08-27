import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Music2 } from "lucide-react";
import SEO from "../../components/SEO";
import {
  publicMusicClient,
  PublicMusicError,
  type PublicMusicResource,
} from "../../features/music/publicMusicClient";

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
}: {
  state: PublicMusicViewState;
  resource?: PublicMusicResource;
  retryAfterSeconds?: number;
  onRetry?: () => void;
}) {
  if (state === "loading") {
    return (
      <main className="min-h-screen bg-dashboard-bg px-4 py-20 text-dashboard-text">
        <div className="mx-auto max-w-4xl" role="status" aria-live="polite">Loading Music…</div>
      </main>
    );
  }
  if (state === "not-found") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-dashboard-bg px-4 text-dashboard-text">
        <section className="max-w-md text-center">
          <Music2 aria-hidden="true" className="mx-auto mb-4 h-10 w-10 text-dashboard-accent" />
          <h1 className="text-2xl font-semibold">Music page unavailable</h1>
          <Link className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-dashboard-accent px-5 text-[var(--dash-accent-text)]" to="/">Return to Explorers</Link>
        </section>
      </main>
    );
  }
  if (state === "rate-limited") {
    return <RateLimitedMusic retryAfterSeconds={retryAfterSeconds} onRetry={onRetry} />;
  }
  if (state === "unavailable" || !resource) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-dashboard-bg px-4 text-dashboard-text">
        <section className="max-w-md text-center" role="alert">
          <h1 className="text-2xl font-semibold">Music is temporarily unavailable.</h1>
          <Link className="mt-6 inline-flex min-h-11 items-center rounded-lg border border-dashboard-border px-5" to="/">Return to Explorers</Link>
        </section>
      </main>
    );
  }

  const publicPlaylists = resource.playlists.filter((playlist) => playlist.isVisibleToGuests);
  const showQueue = resource.allowQueueVisibility === true;
  const upNextSongs = resource.songs.filter((song) => song.id !== resource.currentlyPlaying?.id);
  return (
    <main className="min-h-screen bg-dashboard-bg px-4 py-12 text-dashboard-text sm:px-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-semibold">Music</h1>
        {showQueue && (resource.currentlyPlaying || resource.songs.length > 0) ? (
          <section className="mt-8 rounded-xl border border-dashboard-border bg-dashboard-card p-5" aria-labelledby="public-music-queue">
            <h2 id="public-music-queue" className="text-xl font-semibold">Playing now &amp; up next</h2>
            {resource.currentlyPlaying ? (
              <div className="mt-4 flex min-h-14 items-center gap-3 rounded-lg bg-dashboard-bg p-3">
                <img className="h-12 w-12 rounded object-cover" src={resource.currentlyPlaying.thumbnailUrl} alt="" />
                <span><span className="block text-xs font-semibold uppercase tracking-wide text-dashboard-accent">Playing now</span><span className="block font-medium">{resource.currentlyPlaying.title}</span><span className="block text-sm text-dashboard-text-muted">{resource.currentlyPlaying.artist}</span></span>
              </div>
            ) : null}
            {upNextSongs.length > 0 ? (
              <ol className="mt-3 divide-y divide-dashboard-border" aria-label="Up next">
                {upNextSongs.map((song) => (
                  <li key={song.id} className="flex min-h-11 items-center gap-3 py-3">
                    <img className="h-11 w-11 rounded object-cover" src={song.thumbnailUrl} alt="" />
                    <span><span className="block font-medium">{song.title}</span><span className="block text-sm text-dashboard-text-muted">{song.artist}</span></span>
                  </li>
                ))}
              </ol>
            ) : null}
          </section>
        ) : null}
        {publicPlaylists.length === 0 ? (
          <div className="mt-8">
            <p className="text-base text-dashboard-text-muted">No public playlists yet.</p>
            <Link className="mt-5 inline-flex min-h-11 items-center rounded-lg border border-dashboard-border px-5" to="/">Return to Explorers</Link>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {publicPlaylists.map((playlist) => (
              <section key={playlist.id} className="rounded-xl border border-dashboard-border bg-dashboard-card p-5">
                <h2 className="text-xl font-semibold">{playlist.name}</h2>
                {playlist.description ? <p className="mt-1 text-dashboard-text-muted">{playlist.description}</p> : null}
                <ol className="mt-4 divide-y divide-dashboard-border">
                  {playlist.songs.map((song) => (
                    <li key={song.id} className="flex min-h-11 items-center gap-3 py-3">
                      <img className="h-11 w-11 rounded object-cover" src={song.thumbnailUrl} alt="" />
                      <span><span className="block font-medium">{song.title}</span><span className="block text-sm text-dashboard-text-muted">{song.artist}</span></span>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
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
      <SEO title="Music | Explorers" description="Public Music playlists on Explorers." />
      <PublicMusicContent state={state} resource={resource} retryAfterSeconds={retryAfterSeconds} onRetry={() => setAttempt((value) => value + 1)} />
    </>
  );
}
