import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { gql, useQuery } from "@apollo/client";
import useAuthStore from "../store/store";
import { musicApi, musicIdentityCoordinator } from "../features/music/musicApi";
import { selectExplorerAccountState } from "../features/music/musicIdentityCoordinator";
import { musicSessionBoundary } from "../features/music/musicSessionBoundary";
import { clearAllMusicWorkspaceQueries, clearMusicWorkspaceScope } from "../hooks/useTunesDashboard";
import { queryClient } from "../lib/queryClient";
import { clearMusicPublicationCommands } from "../features/music/musicPublicationCommandRegistry";

const musicEligibilityQuery = gql`
  query MusicIdentityEligibility($documentId: ID!) {
    usersPermissionsUser(documentId: $documentId) {
      documentId
      provider
      confirmed
      blocked
      accounts {
        documentId
        Account_Name
        Account_Type
        mobile_number
      }
    }
  }
`;

/** Starts the sole automatic Music identity flow after authoritative eligibility is positive. */
const AuthSyncManager = () => {
  const { user, isAuthenticated } = useAuthStore();
  const { data, loading, error, refetch } = useQuery(musicEligibilityQuery, {
    variables: { documentId: user?.documentId },
    skip: !isAuthenticated || !user?.documentId,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    errorPolicy: "all",
  });
  const activeScope = useRef<{ userDocumentId: string; accountDocumentId: string }>();
  const accountGeneration = useSyncExternalStore(
    musicSessionBoundary.subscribeAccountGeneration,
    musicSessionBoundary.getAccountGenerationSnapshot,
    musicSessionBoundary.getAccountGenerationSnapshot,
  );
  const observedAccountGeneration = useRef(accountGeneration);
  const remoteRefreshActive = useRef(false);

  const reconcileAuthoritative = useCallback((authoritative: typeof data.usersPermissionsUser | undefined, options: {
    broadcastChange: boolean;
    force: boolean;
  }) => {
    if (!isAuthenticated || !user || !authoritative || authoritative.documentId !== user.documentId) return;
    const clearActiveScope = () => {
      const previous = activeScope.current;
      if (!previous) return;
      activeScope.current = undefined;
      musicApi.setAuthority(undefined);
      musicIdentityCoordinator.reset();
      clearMusicPublicationCommands(previous);
      void clearMusicWorkspaceScope(queryClient, previous);
      if (options.broadcastChange) musicSessionBoundary.publish("account-generation");
    };
    if (authoritative.blocked === true) {
      clearActiveScope();
      return;
    }
    const selection = selectExplorerAccountState(authoritative.accounts, { authoritative: true });
    if (selection.kind !== "selected") {
      clearActiveScope();
      return;
    }
    const account = selection.account;
    const nextScope = { userDocumentId: authoritative.documentId, accountDocumentId: account.documentId };
    const nextAuthority = `${nextScope.userDocumentId}:${nextScope.accountDocumentId}`;
    const previous = activeScope.current;
    const changed = !previous || previous.userDocumentId !== nextScope.userDocumentId || previous.accountDocumentId !== nextScope.accountDocumentId;
    if (changed || options.force) {
      if (previous && changed) {
        clearMusicPublicationCommands(previous);
        void clearMusicWorkspaceScope(queryClient, previous);
      }
      musicApi.setAuthority(nextAuthority);
      musicIdentityCoordinator.reset();
      if (previous && changed && options.broadcastChange) musicSessionBoundary.publish("account-generation");
      activeScope.current = nextScope;
    }
    void musicIdentityCoordinator.reconcile({
      provider: authoritative.provider === "google" ? "google" : "email",
      authenticated: true,
      verified: authoritative.confirmed === true || authoritative.provider === "google",
      userDocumentId: authoritative.documentId,
      account,
    }).catch((cause: unknown) => musicIdentityCoordinator.reportFailure(cause));
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (observedAccountGeneration.current === accountGeneration) return;
    observedAccountGeneration.current = accountGeneration;
    if (!isAuthenticated || !user?.documentId || typeof refetch !== "function") return;
    let cancelled = false;
    remoteRefreshActive.current = true;
    activeScope.current = undefined;
    void refetch().then((result) => {
      if (!cancelled) reconcileAuthoritative(result.data?.usersPermissionsUser, { broadcastChange: false, force: true });
    }).catch(() => undefined).finally(() => {
      if (!cancelled) remoteRefreshActive.current = false;
    });
    return () => { cancelled = true; };
  }, [accountGeneration, isAuthenticated, reconcileAuthoritative, refetch, user?.documentId]);

  useEffect(() => {
    const authoritative = data?.usersPermissionsUser;
    if (!isAuthenticated || !user) {
      musicApi.logout();
      musicIdentityCoordinator.reset();
      void clearAllMusicWorkspaceQueries(queryClient);
      clearMusicPublicationCommands();
      activeScope.current = undefined;
      return;
    }
    if (remoteRefreshActive.current) return;
    if (loading || error) return;
    reconcileAuthoritative(authoritative, { broadcastChange: true, force: false });
  }, [data, error, isAuthenticated, loading, reconcileAuthoritative, user]);

  return null;
};

export default AuthSyncManager;
