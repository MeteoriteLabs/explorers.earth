import { useEffect, useRef, useState } from "react";
import { PublicMusicError, publicMusicClient, type PublicMusicRequestVideo } from "../publicMusicClient";

type RequestClient = Pick<typeof publicMusicClient, "search" | "videoFromUrl" | "requestSong">;

export function PublicMusicRequest({ publicSlug, capability, allowed, client = publicMusicClient, onOutcome, onRequestOutcome, onCanonicalRevoked }: {
  publicSlug: string; capability?: string; allowed: boolean; client?: RequestClient;
  onOutcome?: (event: { action: "search" | "request"; outcome: "success" | "empty" | "invalid" | "rate_limited" | "queue_full" | "forbidden" | "unavailable" }) => void;
  onRequestOutcome?: (outcome: "accepted" | "invalid" | "rate_limited" | "queue_full" | "forbidden" | "unavailable") => void;
  onCanonicalRevoked?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicMusicRequestVideo[]>([]);
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState<string>();
  const [message, setMessage] = useState("");
  const [retrySeconds, setRetrySeconds] = useState(0);
  const active = useRef<AbortController>();
  const mounted = useRef(true);
  const scope = useRef({ publicSlug, capability, generation: 0, revoked: false });
  if (scope.current.publicSlug !== publicSlug || scope.current.capability !== capability) {
    active.current?.abort();
    active.current = undefined;
    scope.current = { publicSlug, capability, generation: scope.current.generation + 1, revoked: false };
    setBusy(false);
    setSubmitting(undefined);
    setResults([]);
    setMessage("");
    setRetrySeconds(0);
  }
  const statusRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; active.current?.abort(); }; }, []);
  useEffect(() => {
    if (retrySeconds <= 0) return;
    const timer = window.setTimeout(() => setRetrySeconds((value) => Math.max(0, value - 1)), 1_000);
    return () => window.clearTimeout(timer);
  }, [retrySeconds]);
  useEffect(() => { if (!allowed) { active.current?.abort(); setResults([]); setMessage(""); setRetrySeconds(0); } }, [allowed]);
  if (!allowed) return null;
  const errorCopy = (error: unknown) => error instanceof PublicMusicError
    ? error.code === "RATE_LIMITED" ? `Too many requests. Try again in ${error.retryAfterSeconds ?? 60} seconds.`
      : error.code === "QUEUE_FULL" ? "The request queue is full. Try again later."
        : error.code === "REQUEST_FORBIDDEN" ? "Song requests are no longer available."
          : error.code === "REQUEST_INVALID" ? "Enter a valid song search or YouTube URL."
            : "Music is temporarily unavailable."
    : "Music is temporarily unavailable.";
  const handleCanonicalRevocation = (error: unknown, generation: number): boolean => {
    if (!mounted.current || generation !== scope.current.generation) return true;
    if (!isCanonicalRevocation(error)) return false;
    if (scope.current.revoked) return true;
    scope.current.revoked = true;
    active.current?.abort();
    active.current = undefined;
    setBusy(false);
    setSubmitting(undefined);
    setResults([]);
    onCanonicalRevoked?.();
    return true;
  };
  const search = async () => {
    const generation = scope.current.generation;
    active.current?.abort();
    const controller = new AbortController(); active.current = controller; setBusy(true); setMessage(""); setResults([]);
    try {
      const value = /^https?:\/\//i.test(query.trim())
        ? { items: [await client.videoFromUrl(publicSlug, query.trim(), capability, controller.signal)] }
        : await client.search(publicSlug, query, capability, controller.signal);
      if (!controller.signal.aborted && mounted.current && generation === scope.current.generation && !scope.current.revoked) { setRetrySeconds(0); setResults(value.items); onOutcome?.({ action: "search", outcome: value.items.length ? "success" : "empty" }); if (value.items.length === 0) setMessage("No songs found."); }
    } catch (error) { if (!controller.signal.aborted) { if (handleCanonicalRevocation(error, generation)) return; setMessage(errorCopy(error)); if (error instanceof PublicMusicError && error.code === "RATE_LIMITED") setRetrySeconds(error.retryAfterSeconds ?? 60); onOutcome?.({ action: "search", outcome: normalizedOutcome(error) }); } }
    finally { if (!controller.signal.aborted && mounted.current && generation === scope.current.generation && !scope.current.revoked) setBusy(false); }
  };
  const submit = async (video: PublicMusicRequestVideo) => {
    if (submitting) return;
    const generation = scope.current.generation;
    setSubmitting(video.id.videoId); setMessage("");
    try {
      await client.requestSong(publicSlug, { youtubeId: video.id.videoId, title: video.snippet.title, artist: video.snippet.channelTitle, thumbnailUrl: video.snippet.thumbnails.default.url }, capability, `tunes-share-v1-${Date.now()}-${crypto.randomUUID()}`);
      if (!mounted.current || generation !== scope.current.generation || scope.current.revoked) return;
      setResults([]); setMessage("Song requested."); onOutcome?.({ action: "request", outcome: "success" }); onRequestOutcome?.("accepted");
      window.setTimeout(() => statusRef.current?.focus(), 0);
    } catch (error) {
      if (!mounted.current || generation !== scope.current.generation || scope.current.revoked) return;
      if (isCanonicalRevocation(error)) onRequestOutcome?.("forbidden");
      if (handleCanonicalRevocation(error, generation)) return;
      setMessage(errorCopy(error));
      if (error instanceof PublicMusicError && error.code === "RATE_LIMITED") setRetrySeconds(error.retryAfterSeconds ?? 60);
      onOutcome?.({ action: "request", outcome: normalizedOutcome(error) });
      onRequestOutcome?.(normalizedOutcome(error));
    }
    finally { if (mounted.current && generation === scope.current.generation && !scope.current.revoked) setSubmitting(undefined); }
  };
  return <section aria-labelledby="public-music-request-heading" className="min-w-0">
    <h2 id="public-music-request-heading" className="text-xl font-semibold">Request a song</h2>
    <label className="mt-3 block" htmlFor="public-music-request-query">Search for a song or paste a YouTube URL</label>
    <div className="mt-2 flex gap-2">
      <input id="public-music-request-query" value={query} maxLength={200} onChange={(event) => { active.current?.abort(); active.current = undefined; setBusy(false); setResults([]); setQuery(event.target.value); }} className="min-h-11 min-w-0 flex-1 rounded-lg border border-dashboard-border bg-dashboard-card px-3 text-base" />
      <button type="button" disabled={busy || retrySeconds > 0 || query.trim().length === 0} onClick={search} className="min-h-11 rounded-lg bg-dashboard-accent px-4 disabled:opacity-50">{busy ? "Searching…" : retrySeconds > 0 ? `Retry in ${retrySeconds}s` : "Search"}</button>
    </div>
    {results.length ? <ul className="mt-3 divide-y divide-dashboard-border" aria-label="Song search results">{results.map((video) => <li key={video.id.videoId} className="py-2"><button type="button" disabled={Boolean(submitting) || retrySeconds > 0} onClick={() => submit(video)} aria-label={`${retrySeconds > 0 ? `Retry in ${retrySeconds} seconds:` : submitting === video.id.videoId ? "Requesting" : "Request"} ${video.snippet.title} by ${video.snippet.channelTitle}`} className="min-h-11 w-full rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-dashboard-accent">{video.snippet.title}<span className="block text-sm text-dashboard-text-muted">{video.snippet.channelTitle}</span></button></li>)}</ul> : null}
    {message ? <p ref={statusRef} role="status" tabIndex={message === "Song requested." ? -1 : undefined} className="mt-3 text-sm">{message}</p> : null}
  </section>;
}

function normalizedOutcome(error: unknown): "invalid" | "rate_limited" | "queue_full" | "forbidden" | "unavailable" {
  if (!(error instanceof PublicMusicError)) return "unavailable";
  if (error.code === "REQUEST_INVALID") return "invalid";
  if (error.code === "RATE_LIMITED") return "rate_limited";
  if (error.code === "QUEUE_FULL") return "queue_full";
  if (error.code === "REQUEST_FORBIDDEN" || error.code === "PUBLIC_NOT_FOUND") return "forbidden";
  return "unavailable";
}

function isCanonicalRevocation(error: unknown): boolean {
  return error instanceof PublicMusicError && (error.code === "REQUEST_FORBIDDEN" || error.code === "PUBLIC_NOT_FOUND");
}
