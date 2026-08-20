import { useEffect, useSyncExternalStore } from "react";
import { useQuery, type QueryClient } from "@tanstack/react-query";
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

export interface MusicWorkspaceScope {
  userDocumentId: string;
  accountDocumentId: string;
}

export function musicWorkspaceQueryKey(scope: MusicWorkspaceScope) {
  return ["music-workspace", scope.userDocumentId, scope.accountDocumentId] as const;
}

export async function clearMusicWorkspaceScope(queryClient: QueryClient, scope: MusicWorkspaceScope): Promise<void> {
  const queryKey = musicWorkspaceQueryKey(scope);
  await queryClient.cancelQueries({ queryKey, exact: true });
  queryClient.removeQueries({ queryKey, exact: true });
}

export async function clearAllMusicWorkspaceQueries(queryClient: QueryClient): Promise<void> {
  await queryClient.cancelQueries({ queryKey: ["music-workspace"] });
  queryClient.removeQueries({ queryKey: ["music-workspace"] });
}

function retryWorkspaceFailure(failureCount: number, error: unknown): boolean {
  const upstreamCode = (error as { upstreamCode?: unknown })?.upstreamCode;
  if (["IDENTITY_PENDING_DELETION", "IDENTITY_TOMBSTONED", "IDENTITY_SUSPENDED", "AUTH_REQUIRED", "AUTH_INVALID"]
    .includes(typeof upstreamCode === "string" ? upstreamCode : "")) return false;
  return failureCount < 1;
}

export function useTunesDashboard(scope?: MusicWorkspaceScope): TunesDashboardData {
  const identityStatus = useSyncExternalStore(
    musicIdentityCoordinator.subscribe,
    musicIdentityCoordinator.getSnapshot,
    musicIdentityCoordinator.getSnapshot,
  );
  const query = useQuery({
    queryKey: scope ? musicWorkspaceQueryKey(scope) : ["music-workspace", "no-user", "no-account"],
    queryFn: () => musicWorkspaceClient.load(),
    enabled: identityStatus === "ready" && scope !== undefined,
    staleTime: 30_000,
    retry: retryWorkspaceFailure,
  });
  useEffect(() => {
    if (query.error) musicIdentityCoordinator.reportFailure(query.error);
  }, [query.error]);
  const dashboard = query.data?.dashboard ?? null;
  return {
    playlists: query.data?.playlists ?? [],
    dashboard,
    entitlement: query.data?.entitlement ?? null,
    playlist: dashboard,
    guestUrl: dashboard?.publication.publicSlug ?? null,
    localUser: null,
    identityStatus,
    isLoading: identityStatus === "setting_up" || (scope !== undefined && query.isLoading),
    error: query.error ? "Music is temporarily unavailable." : null,
    refetch: query.refetch,
    retryIdentity: () => musicIdentityCoordinator.retry(),
  };
}
