import { useCallback, useEffect, useRef, useState } from "react";
import { publicMusicClient, PublicMusicError, type PublicMusicResource } from "./publicMusicClient";
import { subscribeToPublicMusic } from "./publicMusicLiveClient";

export type PublicMusicResourceState = "loading" | "ready" | "not-found" | "rate-limited" | "unavailable";

export function usePublicMusicResource(options: {
  publicSlug?: string;
  capability?: string;
  enabled: boolean;
  disabledState: Exclude<PublicMusicResourceState, "ready" | "rate-limited">;
  onRevoked?(): void;
  onSettled?(): void;
}) {
  const [state, setState] = useState<PublicMusicResourceState>(options.enabled ? "loading" : options.disabledState);
  const [resource, setResource] = useState<PublicMusicResource>();
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(60);
  const [attempt, setAttempt] = useState(0);
  const renderedRevision = useRef(-1);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  const fail = useCallback((error: unknown) => {
    if (error instanceof PublicMusicError && (error.code === "PUBLIC_NOT_FOUND" || error.code === "REQUEST_FORBIDDEN")) {
      options.onRevoked?.(); setResource(undefined); setState("not-found");
    } else if (error instanceof PublicMusicError && error.code === "RATE_LIMITED") {
      setRetryAfterSeconds(error.retryAfterSeconds ?? 60); setState("rate-limited");
    } else setState("unavailable");
    options.onSettled?.();
  }, [options.onRevoked, options.onSettled]);

  const failLive = useCallback((error: unknown) => {
    if (error instanceof PublicMusicError && (error.code === "PUBLIC_NOT_FOUND" || error.code === "REQUEST_FORBIDDEN")) {
      options.onRevoked?.(); setResource(undefined); setState("not-found"); options.onSettled?.();
    } else if (error instanceof PublicMusicError && error.code === "RATE_LIMITED") {
      setRetryAfterSeconds(error.retryAfterSeconds ?? 60);
    }
  }, [options.onRevoked, options.onSettled]);

  useEffect(() => {
    if (!options.enabled || !options.publicSlug) {
      setResource(undefined); setState(options.disabledState);
      if (options.disabledState !== "loading") options.onSettled?.();
      return;
    }
    const controller = new AbortController();
    setResource(undefined); setState("loading");
    publicMusicClient.load(options.publicSlug, options.capability, controller.signal).then((value) => {
      if (!controller.signal.aborted) { renderedRevision.current = value.revision; setResource(value); setState("ready"); options.onSettled?.(); }
    }).catch((error: unknown) => { if (!controller.signal.aborted) fail(error); });
    return () => controller.abort();
  }, [attempt, fail, options.capability, options.disabledState, options.enabled, options.onSettled, options.publicSlug]);

  useEffect(() => {
    if (!options.enabled || !options.publicSlug || state !== "ready" || renderedRevision.current < 0) return;
    const controller = new AbortController();
    const subscription = subscribeToPublicMusic({
      publicSlug: options.publicSlug,
      capability: options.capability,
      initialRevision: renderedRevision.current,
      signal: controller.signal,
      onInvalidate: async (signal) => {
        const value = await publicMusicClient.load(options.publicSlug!, options.capability, signal);
        return { revision: value.revision, apply: () => { renderedRevision.current = value.revision; setResource(value); setState("ready"); } };
      },
      onError: failLive,
    });
    return () => { controller.abort(); subscription.unsubscribe(); };
  }, [failLive, options.capability, options.enabled, options.publicSlug, state]);

  return { state, resource, retryAfterSeconds, retry };
}
