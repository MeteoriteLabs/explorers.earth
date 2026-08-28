import { useEffect, useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";
import SEO from "../../components/SEO";
import { publicMusicClient, PublicMusicError, type PublicMusicResource } from "../../features/music/publicMusicClient";
import { usePublicMusicAvailability } from "../../features/music/PublicMusicAvailabilityProvider";
import { PublicMusicContent } from "./PublicMusic";

type State = "loading" | "ready" | "not-found" | "unavailable";

export default function ProfileMusic() {
  const { username } = useParams();
  const availability = usePublicMusicAvailability();
  const outlet = useOutletContext<{ setIsPageLoaded?: (loaded: boolean) => void } | null>();
  const settleReadiness = outlet?.setIsPageLoaded;
  const [state, setState] = useState<State>("loading");
  const [resource, setResource] = useState<PublicMusicResource>();
  const [attempt, setAttempt] = useState(0);
  const descriptorSlug = availability.descriptor?.publication.publicSlug;

  useEffect(() => {
    if (availability.state === "loading" || availability.state === "revalidating") return;
    if (availability.state !== "available" || !descriptorSlug) {
      setState(availability.state === "not-public" ? "not-found" : "unavailable");
      settleReadiness?.(true);
      return;
    }
    const controller = new AbortController();
    setState("loading");
    publicMusicClient.load(descriptorSlug, undefined, controller.signal).then((value) => {
      if (!controller.signal.aborted) { setResource(value); setState("ready"); settleReadiness?.(true); }
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) {
        setState(reason instanceof PublicMusicError && reason.code === "PUBLIC_NOT_FOUND" ? "not-found" : "unavailable");
        settleReadiness?.(true);
      }
    });
    return () => controller.abort();
  }, [attempt, availability.state, descriptorSlug, settleReadiness]);

  const canonical = descriptorSlug ? `${window.location.origin}/music/share/${encodeURIComponent(descriptorSlug)}` : undefined;
  return <>
    <SEO title="Music | Explorers" description="Public Music on Explorers." canonical={canonical} />
    <PublicMusicContent
      standalone={false}
      state={state}
      resource={resource}
      returnTo={`/${username ?? ""}`}
      onRetry={() => { availability.retry(); setAttempt((value) => value + 1); }}
    />
  </>;
}
