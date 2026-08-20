import { useEffect, useRef } from "react";
import { gql, useQuery } from "@apollo/client";
import useAuthStore from "../store/store";
import { musicApi, musicIdentityCoordinator } from "../features/music/musicApi";
import { selectExplorerAccountState } from "../features/music/musicIdentityCoordinator";
import { musicSessionBoundary } from "../features/music/musicSessionBoundary";
import { clearAllMusicWorkspaceQueries, clearMusicWorkspaceScope } from "../hooks/useTunesDashboard";
import { queryClient } from "../lib/queryClient";

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
  const { data, loading, error } = useQuery(musicEligibilityQuery, {
    variables: { documentId: user?.documentId },
    skip: !isAuthenticated || !user?.documentId,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    errorPolicy: "all",
  });
  const activeScope = useRef<{ userDocumentId: string; accountDocumentId: string }>();

  useEffect(() => {
    const authoritative = data?.usersPermissionsUser;
    if (!isAuthenticated || !user) {
      musicApi.logout();
      musicIdentityCoordinator.reset();
      void clearAllMusicWorkspaceQueries(queryClient);
      activeScope.current = undefined;
      return;
    }
    if (loading || error) return;
    if (!authoritative || authoritative.documentId !== user.documentId) return;
    if (authoritative.blocked === true) return;
    const selection = selectExplorerAccountState(authoritative.accounts, { authoritative: true });
    if (selection.kind !== "selected") {
      if (activeScope.current) {
        void clearMusicWorkspaceScope(queryClient, activeScope.current);
        musicApi.setAuthority(undefined);
        musicIdentityCoordinator.reset();
        musicSessionBoundary.publish("account-generation");
        activeScope.current = undefined;
      }
      return;
    }
    const account = selection.account;
    const nextScope = { userDocumentId: authoritative.documentId, accountDocumentId: account.documentId };
    const nextAuthority = `${nextScope.userDocumentId}:${nextScope.accountDocumentId}`;
    const previous = activeScope.current;
    if (!previous || previous.userDocumentId !== nextScope.userDocumentId || previous.accountDocumentId !== nextScope.accountDocumentId) {
      if (previous) void clearMusicWorkspaceScope(queryClient, previous);
      musicApi.setAuthority(nextAuthority);
      musicIdentityCoordinator.reset();
      if (previous) musicSessionBoundary.publish("account-generation");
      activeScope.current = nextScope;
    }
    void musicIdentityCoordinator.reconcile({
      provider: authoritative.provider === "google" ? "google" : "email",
      authenticated: true,
      verified: authoritative.confirmed === true || authoritative.provider === "google",
      userDocumentId: authoritative.documentId,
      account,
    }).catch(() => undefined);
  }, [data, error, isAuthenticated, loading, user]);

  return null;
};

export default AuthSyncManager;
