interface PublicMusicRouteStateInput {
  accountLoading: boolean;
  accountError: unknown;
  guestUrl: string | null;
  playlistLoading: boolean;
  playlistError: unknown;
  playlist: unknown;
}

interface PublicMusicRouteState {
  loading: boolean;
  error: unknown;
  hasUsableData: boolean;
  empty: boolean;
}

export function derivePublicMusicRouteState({
  accountLoading,
  accountError,
  guestUrl,
  playlistLoading,
  playlistError,
  playlist,
}: PublicMusicRouteStateInput): PublicMusicRouteState {
  const hasUsableData = Boolean(playlist);
  const loading = accountLoading || (Boolean(guestUrl) && playlistLoading);
  const error = accountError ?? playlistError;
  const empty = !loading && !error && (!guestUrl || !playlist);

  return { loading, error, hasUsableData, empty };
}
