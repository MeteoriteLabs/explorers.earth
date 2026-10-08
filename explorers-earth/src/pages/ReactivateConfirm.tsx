import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SEO from "../components/SEO";
import { createCanonicalUrl } from "../utils/getCurrentDomain";
import { authClient } from "../lib/authClient";
import { lifecycleObservationSchema } from "../../../tunes/shared/explorersLifecycleObservation";

/**
 * Ticket 2.4 package L0. This page used to decide what to show from the account's raw
 * status, treating anything other than suspended or pending_deletion as "This account
 * cannot be recovered." Three different situations landed on that sentence, and the first
 * one was wrong rather than merely unhelpful:
 *
 *  - A recovery that SUCCEEDED but whose response was lost. The account is active, the
 *    recovery worked, and this page told the owner it could not be done. The proof cookie
 *    is cleared only on delivered success exactly so that this re-read can answer the
 *    question; it answered it with a false failure.
 *  - A terminally deleted account, which can never come back, offering "Try Google
 *    recovery again" forever.
 *  - A lifecycle operation that failed and needs a person, indistinguishable from both.
 *
 * The server now returns a typed outcome, so each of those is its own state here.
 * `terminal` and `review` deliberately do NOT offer the retry affordance: an action that
 * cannot work is worse than no action, because the owner keeps taking it.
 */
type State = { kind: "loading" } | { kind: "ready"; revision: number } | { kind: "submitting" } |
  { kind: "success" } | { kind: "recovered" } |
  { kind: "terminal" } | { kind: "review"; operationId: string | null } |
  { kind: "error"; message: string };

export default function ReactivateConfirm() {
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ kind: "loading" });
  useEffect(() => {
    let live = true;
    void fetch("/api/explorers/v1/recovery/status", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Recovery proof is expired or unavailable. Start again with Google.");
        const body = await response.json() as { recovery?: unknown };
        // Parsed, not trusted: an outcome this build does not understand is indeterminate,
        // and the only safe thing to offer then is observing again.
        const parsed = lifecycleObservationSchema.safeParse(body.recovery);
        if (!parsed.success) throw new Error("Recovery status is unavailable. Please try again.");
        const recovery = parsed.data;
        if (!live) return;
        if (recovery.outcome === "pending") return setState({ kind: "ready", revision: recovery.revision });
        if (recovery.outcome === "recovered") return setState({ kind: "recovered" });
        if (recovery.outcome === "terminal") return setState({ kind: "terminal" });
        if (recovery.outcome === "manual_review") return setState({ kind: "review", operationId: recovery.operationId });
        return setState({ kind: "error", message: "Recovery status is unavailable. Please try again." });
      }).catch((error) => { if (live) setState({ kind: "error", message: error.message }); });
    return () => { live = false; };
  }, []);

  const complete = async () => {
    if (state.kind !== "ready") return;
    const revision = state.revision;
    setState({ kind: "submitting" });
    try {
      const response = await fetch("/api/explorers/v1/recovery/complete", { method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedRevision: revision }) });
      if (!response.ok) throw new Error("Recovery could not finish. The proof may have expired or already been used.");
      setState({ kind: "success" });
    } catch (error) { setState({ kind: "error", message: (error as Error).message }); }
  };

  return <>
    <SEO title="Recover Account – explorers" description="Confirm recovery of your deactivated account."
      canonical={createCanonicalUrl("/reactivate-confirm")} noIndex={true} />
    <div className="dashboard-theme dashboard-theme-dark min-h-screen flex font-poppins items-center justify-center bg-black text-white px-4 sm:px-6 py-10">
      <div className="relative w-full max-w-md mx-auto">
        <div className="backdrop-blur-sm bg-dashboard-sidebar border border-dashboard p-8 rounded-2xl shadow-dashboard-elevated text-center">
          {state.kind === "loading" && <p>Checking Google recovery...</p>}
          {state.kind === "ready" && <>
            <h1 className="text-xl sm:text-2xl font-bold mb-3">Restore your account</h1>
            <p className="text-sm text-gray-400 mb-6">Your Google identity was verified. Confirm to restore access or cancel pending deletion.</p>
            <button type="button" onClick={complete} className="w-full py-2.5 px-4 rounded-xl bg-dashboard-accent text-dashboard">Reactivate account</button>
          </>}
          {state.kind === "submitting" && <p>Reactivating your account...</p>}
          {state.kind === "success" && <>
            <h1 className="text-xl sm:text-2xl font-bold mb-3">Account reactivated</h1>
            <p className="text-sm text-gray-400 mb-6">Sign in with Google again to create a fresh session.</p>
            <button type="button" onClick={() => { void authClient.startGoogleSignIn(); }}
              className="w-full py-2.5 px-4 rounded-xl bg-dashboard-accent text-dashboard">Sign in with Google</button>
          </>}
          {/* The recovery already took effect - typically because its response was lost.
              Same destination as success, stated as the fact it is rather than as a retry. */}
          {state.kind === "recovered" && <>
            <h1 className="text-xl sm:text-2xl font-bold mb-3">Your account is already active</h1>
            <p className="text-sm text-gray-400 mb-6">Nothing further is needed. Sign in with Google to create a fresh session.</p>
            <button type="button" onClick={() => { void authClient.startGoogleSignIn(); }}
              className="w-full py-2.5 px-4 rounded-xl bg-dashboard-accent text-dashboard">Sign in with Google</button>
          </>}
          {/* Deleted. No retry affordance, because no retry can ever succeed. */}
          {state.kind === "terminal" && <>
            <h1 className="text-xl sm:text-2xl font-bold mb-3">This account was deleted</h1>
            <p role="alert" className="text-sm text-gray-400">Deletion is permanent, so it cannot be recovered. You can start again with a new account.</p>
          </>}
          {/* A failed or unaccounted-for transition. A reference to quote, and no action
              that would re-enter the flow that is already stuck. */}
          {state.kind === "review" && <>
            <h1 className="text-xl sm:text-2xl font-bold mb-3">This needs a person to check</h1>
            <p role="alert" className="text-sm text-gray-400 mb-2">Your account is mid-change and we have stopped rather than guess. Support can finish it.</p>
            {state.operationId && <p className="text-xs text-gray-500">Reference: {state.operationId}</p>}
          </>}
          {state.kind === "error" && <>
            <p role="alert" className="text-red-400 mb-4">{state.message}</p>
            <button type="button" onClick={() => navigate("/reactivate")}
              className="w-full py-2.5 px-4 rounded-xl bg-dashboard-accent text-dashboard">Try Google recovery again</button>
          </>}
        </div>
      </div>
    </div>
  </>;
}
