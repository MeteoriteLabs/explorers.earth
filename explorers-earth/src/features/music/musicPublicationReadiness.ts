export type MusicPublicationReadinessState = "hidden" | "setup-required" | "published-hidden" | "live" | "unavailable";

export interface MusicPublicationReadiness {
  state: MusicPublicationReadinessState;
  label: string;
  primaryAction: string;
  secondaryAction: string;
}

export function getMusicPublicationReadiness(input: {
  profilePreference: "Yes" | "No" | null | undefined;
  publicationMode: "private" | "unlisted" | "public";
  statusAvailable: boolean;
}): MusicPublicationReadiness {
  if (!input.statusAvailable) return { state: "unavailable", label: "Status unavailable", primaryAction: "Retry status", secondaryAction: "Open Music workspace" };
  const profileEnabled = input.profilePreference === "Yes";
  const published = input.publicationMode === "public";
  if (profileEnabled && published) return { state: "live", label: "Live on profile", primaryAction: "View as guest", secondaryAction: "Copy public link" };
  if (profileEnabled) return { state: "setup-required", label: "Profile enabled, Music not public", primaryAction: "Make Music public", secondaryAction: "Hide profile Music" };
  if (published) return { state: "published-hidden", label: "Public link active, profile tab hidden", primaryAction: "Show on profile", secondaryAction: "Copy public link" };
  return { state: "hidden", label: "Hidden from profile", primaryAction: "Enable profile Music", secondaryAction: "Open sharing settings" };
}
