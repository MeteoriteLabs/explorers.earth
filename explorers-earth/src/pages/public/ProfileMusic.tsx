import { useCallback } from "react";
import { useOutletContext, useParams } from "react-router-dom";
import SEO from "../../components/SEO";
import { usePublicMusicAvailability } from "../../features/music/PublicMusicAvailabilityProvider";
import { usePublicMusicResource } from "../../features/music/usePublicMusicResource";
import { PublicMusicContent } from "./PublicMusic";
import { usePublicMusicProductAnalytics } from "../../features/music/publicMusicAnalytics";

export default function ProfileMusic() {
  const { username } = useParams();
  const availability = usePublicMusicAvailability();
  const outlet = useOutletContext<{ setIsPageLoaded?: (loaded: boolean) => void } | null>();
  const settleReadiness = outlet?.setIsPageLoaded;
  const descriptorSlug = availability.descriptor?.publication.publicSlug;
  const settle = useCallback(() => settleReadiness?.(true), [settleReadiness]);
  const enabled = availability.state === "available" && Boolean(descriptorSlug);
  const disabledState = availability.state === "loading" || availability.state === "revalidating"
    ? "loading" as const : availability.state === "not-public" ? "not-found" as const : "unavailable" as const;
  const music = usePublicMusicResource({
    publicSlug: descriptorSlug, enabled, disabledState,
    onRevoked: availability.retry,
    onSettled: settle,
  });
  const trackMusic = usePublicMusicProductAnalytics({ publicSlug: descriptorSlug, route: "friendly" });

  const canonical = descriptorSlug ? `${window.location.origin}/music/share/${encodeURIComponent(descriptorSlug)}` : undefined;
  return <>
    <SEO title="Music | Explorers" description="Public Music on Explorers." canonical={canonical} />
    <PublicMusicContent
      standalone={false}
      state={music.state}
      resource={music.resource}
      publicSlug={descriptorSlug}
      returnTo={`/${username ?? ""}`}
      retryAfterSeconds={music.retryAfterSeconds}
      onRetry={() => { availability.retry(); music.retry(); }}
      analyticsRoute="friendly"
      onAnalytics={trackMusic}
    />
  </>;
}
