import { useEffect } from "react";
import { gql, useQuery } from "@apollo/client";
import useAuthStore from "../store/store";
import { musicIdentityCoordinator } from "../features/music/musicApi";
import { selectCompletedAccount } from "../features/music/musicIdentityCoordinator";

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
  const { data } = useQuery(musicEligibilityQuery, {
    variables: { documentId: user?.documentId },
    skip: !isAuthenticated || !user?.documentId,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    errorPolicy: "all",
  });

  useEffect(() => {
    const authoritative = data?.usersPermissionsUser;
    if (!isAuthenticated || !user) {
      musicIdentityCoordinator.reset();
      return;
    }
    if (!authoritative || authoritative.documentId !== user.documentId) return;
    if (authoritative.blocked === true) return;
    const account = selectCompletedAccount(authoritative.accounts);
    void musicIdentityCoordinator.reconcile({
      provider: authoritative.provider === "google" ? "google" : "email",
      authenticated: true,
      verified: authoritative.confirmed === true || authoritative.provider === "google",
      userDocumentId: authoritative.documentId,
      account,
    }).catch(() => undefined);
  }, [data, isAuthenticated, user]);

  return null;
};

export default AuthSyncManager;
