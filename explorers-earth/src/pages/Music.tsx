import { gql, useQuery } from "@apollo/client";
import { useRef, type RefObject } from "react";
import { useNavigate } from "react-router-dom";
import MusicDashboard from "../components/MusicDashboard";
import SEO from "../components/SEO";
import { selectExplorerAccountState, type ExplorerAccountCandidate } from "../features/music/musicIdentityCoordinator";
import {
  selectMusicSurfaceState,
  type MusicEntitlement,
  type MusicIdentity,
  type MusicLifecycle,
  type MusicOnboarding,
} from "../features/music/musicState";
import { useTunesDashboard, type TunesDashboardData } from "../hooks/useTunesDashboard";
import useAuthStore from "../store/store";
import { createCanonicalUrl } from "../utils/getCurrentDomain";

const musicPageEligibilityQuery = gql`
  query MusicPageEligibility($documentId: ID!) {
    usersPermissionsUser(documentId: $documentId) {
      documentId
      accounts {
        documentId
        Account_Name
        Account_Type
        mobile_number
      }
    }
  }
`;

const actionLabels = {
  check_status: "Check status",
  sign_in: "Sign in",
  finish_profile: "Finish profile",
  get_help: "Get help",
  view_plans: "View plans",
  view_usage: "View usage",
  try_again: "Try again",
} as const;

function lifecycleFrom(data: TunesDashboardData): MusicLifecycle {
  if (data.identityStatus === "pending_deletion") return "pending_deletion";
  if (data.identityStatus === "suspended") return "suspended";
  return "active";
}

function identityFrom(data: TunesDashboardData): MusicIdentity {
  if (data.identityStatus === "conflict") return "conflict";
  if (data.identityStatus === "retryable") return "retryable";
  if (data.identityStatus === "unavailable") return "unavailable";
  if (data.identityStatus === "ready") return "ready";
  return "setting_up";
}

function entitlementFrom(data: TunesDashboardData): MusicEntitlement {
  // The workspace query cannot fetch entitlement before identity is ready. Treat
  // that absence as neutral so a retryable identity failure remains actionable;
  // once identity is ready, a missing entitlement is a real checking state.
  if (!data.entitlement) return data.identityStatus === "ready" ? "unknown" : "included";
  if (data.entitlement.state === "unknown") return "unknown";
  if (!data.entitlement.coreRead) return "upgrade";
  if (!data.entitlement.coreMutation) return "read_only";
  return "included";
}

export function onboardingFromEligibility(eligibility: {
  loading: boolean;
  error?: unknown;
  data?: { usersPermissionsUser?: { accounts?: ExplorerAccountCandidate[] | null } | null } | null;
}): MusicOnboarding {
  if (eligibility.loading || eligibility.error || !eligibility.data?.usersPermissionsUser
      || !Array.isArray(eligibility.data.usersPermissionsUser.accounts)) return "unknown";
  const selection = selectExplorerAccountState(eligibility.data.usersPermissionsUser.accounts, { authoritative: true });
  if (selection.kind === "selected") return "complete";
  if (selection.kind === "incomplete") return "incomplete";
  return "unknown";
}

export function MusicPageContent({
  authenticated,
  onboarding,
  data,
  onAction,
  statusRef,
}: {
  authenticated: boolean;
  onboarding: MusicOnboarding;
  data: TunesDashboardData;
  onAction: (action: keyof typeof actionLabels) => void;
  statusRef?: RefObject<HTMLDivElement>;
}) {
  const state = selectMusicSurfaceState({
    lifecycle: lifecycleFrom(data),
    authenticated: authenticated && data.identityStatus !== "auth_required",
    onboarding,
    entitlement: entitlementFrom(data),
    identity: identityFrom(data),
    content: data.error ? "failure" : data.isLoading ? "loading" : "ready",
    playlistCount: data.playlists.length,
  });
  const showInlineStatus = !["ready_empty", "ready_content"].includes(state.kind);
  const role = state.live === "assertive" ? "alert" : "status";

  return (
    <main className="dashboard-theme min-h-full bg-dashboard-bg px-4 py-5 text-dashboard sm:px-6 md:py-7">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-semibold tracking-tight text-dashboard sm:text-3xl">Music</h1>
        {showInlineStatus && (
          <div ref={statusRef} tabIndex={-1} role={role} aria-live={state.live === "off" ? undefined : state.live} aria-atomic="true" className="mt-2 min-h-6 text-base text-dashboard-light outline-none focus-visible:ring-2 focus-visible:ring-dashboard-accent">
            {state.message}
          </div>
        )}

        {state.blocksContent ? (
          <section className="mt-6 rounded-2xl border border-dashboard bg-dashboard-sidebar p-5 sm:p-7">
            {["setting_up", "entitlement_unknown", "content_loading"].includes(state.kind) && (
              <div aria-hidden="true" className="space-y-3">
                <div className="h-11 w-full animate-pulse rounded-xl bg-dashboard-muted motion-reduce:animate-none" />
                <div className="h-32 w-full animate-pulse rounded-xl bg-dashboard-muted motion-reduce:animate-none" />
              </div>
            )}
            {state.action && (
              <button type="button" onClick={() => onAction(state.action!)} className="min-h-11 min-w-11 rounded-xl bg-dashboard-accent px-4 text-sm font-semibold text-[var(--dash-accent-text)] outline-none focus-visible:ring-2 focus-visible:ring-dashboard-accent focus-visible:ring-offset-2 focus-visible:ring-offset-dashboard-bg">
                {actionLabels[state.action]}
              </button>
            )}
            {state.secondaryAction && (
              <button type="button" onClick={() => onAction(state.secondaryAction!)} className="ml-2 min-h-11 min-w-11 rounded-xl border border-dashboard bg-dashboard-muted px-4 text-sm font-semibold text-dashboard outline-none focus-visible:ring-2 focus-visible:ring-dashboard-accent focus-visible:ring-offset-2 focus-visible:ring-offset-dashboard-bg">
                {actionLabels[state.secondaryAction]}
              </button>
            )}
          </section>
        ) : (
          <div className="mt-5 space-y-5">
            {state.action && (
              <button type="button" onClick={() => onAction(state.action!)} className="min-h-11 min-w-11 rounded-xl border border-dashboard bg-dashboard-muted px-4 text-sm font-semibold text-dashboard outline-none focus-visible:ring-2 focus-visible:ring-dashboard-accent focus-visible:ring-offset-2 focus-visible:ring-offset-dashboard-bg">
                {actionLabels[state.action]}
              </button>
            )}
            {state.secondaryAction && (
              <button type="button" onClick={() => onAction(state.secondaryAction!)} className="min-h-11 min-w-11 rounded-xl border border-dashboard bg-dashboard-muted px-4 text-sm font-semibold text-dashboard outline-none focus-visible:ring-2 focus-visible:ring-dashboard-accent focus-visible:ring-offset-2 focus-visible:ring-offset-dashboard-bg">
                {actionLabels[state.secondaryAction]}
              </button>
            )}
            <MusicDashboard data={data} readOnly={["read_only", "content_stale"].includes(state.kind)} />
          </div>
        )}
      </div>
    </main>
  );
}

const MusicPage = () => {
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const statusRef = useRef<HTMLDivElement>(null);
  const eligibility = useQuery(musicPageEligibilityQuery, {
    variables: { documentId: user?.documentId },
    skip: !user?.documentId,
    fetchPolicy: "cache-and-network",
    errorPolicy: "all",
  });
  const selection = selectExplorerAccountState(eligibility.data?.usersPermissionsUser?.accounts, {
    authoritative: !eligibility.loading && !eligibility.error && Array.isArray(eligibility.data?.usersPermissionsUser?.accounts),
  });
  const data = useTunesDashboard(selection.kind === "selected" && user?.documentId ? {
    userDocumentId: user.documentId,
    accountDocumentId: selection.account.documentId,
  } : undefined);
  const onboarding = onboardingFromEligibility(eligibility);

  const action = (value: keyof typeof actionLabels) => {
    if (value === "try_again") {
      void data.retryIdentity().then(() => data.refetch()).finally(() => statusRef.current?.focus());
      return;
    }
    if (value === "sign_in") navigate("/login");
    else if (value === "finish_profile") navigate("/onboarding");
    else if (value === "view_plans") navigate("/subscription-plans");
    else if (value === "check_status") navigate("/settings");
    else if (value === "view_usage") navigate("/settings?section=billing");
    else navigate("/contact");
  };

  return (
    <>
      <SEO
        title="Music | explorers"
        description="Create playlists and share music from your Explorer profile."
        canonical={createCanonicalUrl("/recommendations/music")}
        type="website"
        noIndex
        siteName="explorers"
      />
      <MusicPageContent authenticated={isAuthenticated} onboarding={onboarding} data={data} onAction={action} statusRef={statusRef} />
    </>
  );
};

export default MusicPage;
