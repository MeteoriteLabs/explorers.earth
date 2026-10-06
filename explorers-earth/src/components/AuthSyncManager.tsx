import { useEffect, useRef } from "react";
import { useApolloClient } from "@apollo/client";
import useAuthStore from "../store/store";
import { authClient } from "../lib/authClient";
import { queryClient } from "../lib/queryClient";
import { musicApi, musicIdentityCoordinator } from "../features/music/musicApi";
import { clearMusicPublicationCommands } from "../features/music/musicPublicationCommandRegistry";
import { clearAllMusicWorkspaceQueries } from "../hooks/useTunesDashboard";

/** Bootstrap cookie authority once and clear mounted private caches on each generation change. */
export default function AuthSyncManager() {
  const apollo = useApolloClient();
  const { generation, status, isAuthenticated, user, accountId } = useAuthStore();
  const previous = useRef<number | null>(null);
  useEffect(() => { void authClient.refresh(); }, []);
  useEffect(() => {
    if (previous.current === null) { previous.current = generation; return; }
    if (previous.current === generation) return;
    previous.current = generation;
    musicApi.logout();
    musicIdentityCoordinator.reset();
    clearMusicPublicationCommands();
    void clearAllMusicWorkspaceQueries(queryClient);
    void queryClient.cancelQueries();
    queryClient.removeQueries({ queryKey: ["explorers-account"] });
    void apollo.clearStore();
  }, [apollo, generation]);

  // ADR-006: the canonical session is the Music owner's authority, so owner
  // provisioning is reconciled from the verified account here. Nothing called
  // reconcile() before, which left musicIdentityCoordinator.isReadyFor() permanently
  // false, and with it `eligible` in MusicPublishProvider - so every Music
  // publication control rendered disabled in the real application.
  const userDocumentId = user?.id;
  useEffect(() => {
    if (!isAuthenticated || status !== "active-complete" || !userDocumentId || !accountId) return;
    // Google-only by configuration; the server takes the subject from the Actor, so
    // these identifiers scope the client's own readiness, not the request.
    void musicIdentityCoordinator.reconcile({
      provider: "google",
      authenticated: true,
      verified: true,
      userDocumentId,
      account: { documentId: accountId },
    });
  }, [isAuthenticated, status, userDocumentId, accountId, generation]);

  return null;
}
