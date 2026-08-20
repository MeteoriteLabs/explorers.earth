import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { musicApi, musicIdentityCoordinator } from "../features/music/musicApi";
import {
  createMusicWorkspaceClient,
  type MusicDashboardResponse,
  type MusicEntitlementResponse,
  type MusicPlaylist,
} from "../features/music/musicWorkspaceClient";

export interface TunesDashboardData {
  playlists: MusicPlaylist[];
  dashboard: MusicDashboardResponse | null;
  entitlement: MusicEntitlementResponse | null;
  playlist: MusicDashboardResponse | null;
  guestUrl: string | null;
  localUser: null;
  identityStatus: ReturnType<typeof musicIdentityCoordinator.getSnapshot>;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<unknown>;
  retryIdentity: () => Promise<void>;
}

export const musicWorkspaceClient = createMusicWorkspaceClient((input) => musicApi.request(input));

export function useTunesDashboard(): TunesDashboardData {
  const identityStatus = useSyncExternalStore(
    musicIdentityCoordinator.subscribe,
    musicIdentityCoordinator.getSnapshot,
    musicIdentityCoordinator.getSnapshot,
  );
  const query = useQuery({
    queryKey: ["music-workspace"],
    queryFn: () => musicWorkspaceClient.load(),
    enabled: identityStatus === "ready",
    staleTime: 30_000,
    retry: 1,
  });
  const dashboard = query.data?.dashboard ?? null;
  return {
    playlists: query.data?.playlists ?? [],
    dashboard,
    entitlement: query.data?.entitlement ?? null,
    playlist: dashboard,
    guestUrl: dashboard?.publication.publicSlug ?? null,
    localUser: null,
    identityStatus,
    isLoading: identityStatus === "setting_up" || query.isLoading,
    error: query.error ? "Music is temporarily unavailable." : null,
    refetch: query.refetch,
    retryIdentity: () => musicIdentityCoordinator.retry(),
  };
}
