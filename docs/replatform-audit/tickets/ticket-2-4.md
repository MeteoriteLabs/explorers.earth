# Ticket 2.4: Auth UX and lifecycle

**Status:** consult the [durable implementation ledger](../../../.superpowers/sdd/epic-01/progress.md); checkboxes below do not assert implementation status.

[Parent epic and shared contracts](../epics/epic-02.md) · [Master plan](../implementation-plan.md) · [All tickets](../ticket-index.md) · [Shared execution checklist](../execution-checklist.md)

## 2026-10-05 execution amendment

Read the [re-groomed dependency and ownership plan](../../superpowers/plans/2026-10-05-replatform-regroomed-execution.md), including this ticket's all-ticket disposition, before allocation. Preserve the implementation and acceptance requirements below. Canonical producer, active consumer, fixture, real-backend evidence and exact-commit hosted status must be tracked separately; missing future producers are dependencies, never fixture waivers. Every new delegated assignment uses a fresh agent. Proposed original paths/commands must be checked against current source before execution.

## Current execution card

**Disposition:** partial. **Technical inputs:** 2.2, 2.3. Dependencies refer to reviewed interfaces for partial packages; complete-ticket acceptance retains all original gates.

**Next package:** Package L: map original 18 plus 3 recovery behaviors against accepted 12; implement missing held completion, response-loss and reload cases. Socket closure joins reviewed 6.1.

**Ownership:** The ticket owns its category/feature files listed below. Shared schema, migration identifiers, route registration, auth clients, Settings, seeds and protected manifests require coordinator allocation before any writer starts. Do not dispatch overlapping writers.

**Execution gate:** Verify listed paths and actual package scripts against current source; classify proposed tests as to-create, never executed. Record the exact failing behavior before changing production code; run focused automated regressions, canonical real-backend/browser acceptance, fresh independent review, then commit/push and exact-SHA hosted checks. Preserve source/dependency hashes, counts/skips, first failure and owned-resource cleanup. Historical acceptance is retained, not rerun by default. External inputs and deployment authority remain explicit gates.

**Current commands:** Read the [command custody correction](../command-custody-2026-10-05.md). Historical generic suite/project/environment commands are proposed interfaces, not supported current runner flags; original behavior obligations remain required.

## Required context

Read the [authoritative database schema](../target-database-schema.md) and apply the [shared execution checklist](../execution-checklist.md) to affected surfaces. Apply the parent epic's global constraints, shared interface definitions, review focus and test-harness prerequisites. Those contracts are maintained once in the epic, rather than copied into thirty-eight potentially conflicting versions. Existing files refer to the pinned audit source; paths labelled create/new were proposed when authored. Commands and checkboxes specify required verification, not completed runs.

## Implementation and acceptance

**Depends on:** 2.2/2.3; socket disconnection acceptance completes with 6.1.

**Grooming focus:** verify stale-session and cross-tab transitions using the actual web client, including in-flight response cancellation, repeat logout/recovery and guarded real-API sessions. A test fixture cannot stand in for the live Google callback acceptance.

**Create:** `explorers-earth/src/lib/authClient.ts`, `tunes/server/application/accountLifecycle.ts`, `tunes/server/routes/explorersLifecycleRoutes.ts`, `explorers-earth/e2e/replatform/auth.spec.ts`, `tunes/server/test/explorers-lifecycle.integration.test.ts`.

**Modify:** `explorers-earth/src/pages/Login.tsx`, `explorers-earth/src/pages/GoogleAuthRedirect.tsx`, `explorers-earth/src/routes/AuthRoutes.tsx`, `explorers-earth/src/store/store.ts`, `explorers-earth/src/components/AuthSyncManager.tsx`, `explorers-earth/src/hooks/useLogout.ts`, `explorers-earth/src/services/accountLifecycleService.ts`, `explorers-earth/src/features/Settings/Settings.tsx`, `explorers-earth/src/features/Settings/api/mutation.ts`, `explorers-earth/src/features/Settings/components/AccountDeletionLifecyclePanel.tsx`.

**Deletion feedback contract:** the current Settings wizard writes freeform reasons before advancing; this is not seeded reference content. Add `recordDeletionFeedback(actor, input:{reason:string}, context):Promise<{id:string}>` to `accountLifecycle.ts` with POST `/account/deletion-feedback`. Require trimmed nonempty reason, bound length to 2,000 characters, use idempotency, derive account/user from Actor and avoid copying private address/email into generic feedback. Preserve current required-reason/error/retry step behavior, and define restricted retention with deletion policy before production. Add tests for failed feedback retry, duplicate submit and no cross-account payload injection; full deletion E2E must prove no Strapi mutation remains.

**Lifecycle boundary:** define `requestAccountDeactivation(actor:Actor,input:RevisionInput,context:RequestContext):Promise<AccountLifecycleDto>`, `requestAccountDeletion(actor:Actor,input:RevisionInput & {feedbackId:string},context:RequestContext):Promise<AccountLifecycleDto>` and `getAccountLifecycle(actor:Actor):Promise<AccountLifecycleDto>`. AccountLifecycleDto is `{accountId,status:'active'|'suspended'|'pending_deletion'|'deleted',operationId:string|null,revision:number}`. Feedback must belong to the same account. Retain the currently exposed reactivation/cancellation journey through a purpose-bound recovery authority, not `requireActor` which correctly denies suspended accounts; pin that authority to the verified Better Auth session/re-authentication primitives during 2.1. Its implementation must reject cross-account, expired and replayed recovery authority. A deleted account must not be automatically recreated with the old content merely by repeating Google login. Retain a minimal deletion boundary or remove ownership references according to the reviewed deletion policy; test this separately from fresh first-login provisioning. Ticket 2.4 cannot pass before the following recovery contract is qualified.

**Recovery contract (owned by 2.1, consumed by 2.4):** create `server/auth/accountRecovery.ts` and `server/test/account-recovery.test.ts`. `requireRecoveryPrincipal(request):Promise<RecoveryPrincipal>` verifies fresh Google authentication through the pinned Better Auth integration and resolves only the existing identity/account binding. `RecoveryPrincipal` is a server-only `{userId:string,accountId:string,purpose:'account-recovery',proofId:string}` and is never assignable to `Actor`. Issue an opaque, single-use, five-minute recovery proof held in a secure HttpOnly same-site cookie; persist only its hash, binding and expiry. `recoverAccount(principal:RecoveryPrincipal,input:RevisionInput,context:RequestContext):Promise<AccountLifecycleDto>` consumes the proof atomically with the permitted reactivation/deletion-cancellation transition. It cannot recover terminally deleted accounts or provision a replacement account. Require the ordinary CSRF/origin protections. Successful recovery requires a new normal session; the recovery credential itself grants no profile/content/Music access. Qualification in 2.1 must identify the actual supported provider callback hook and prove inactive-account authentication can complete without provisioning or ordinary authorization. If the pinned library cannot support that flow, stop that ticket and amend the adapter design before downstream lifecycle implementation, rather than inventing an API.

- [ ] Assert `recovery_only_authorizes_recovery`: recovery proof is denied on ordinary content routes; another account ID, an expired proof and a replay each fail without state changes. Assert two simultaneous recoveries produce exactly one transition, Google re-login cannot restore a terminally deleted account, and a successful eligible recovery requires a fresh ordinary session before content access.

- [ ] Add failing tests for expired/revoked session, cross-origin mutation, logout in another tab, cancelled Google callback, blocked account login and repeated lifecycle request. Existing password-only routes redirect to Google sign-in without exposing broken forms; record this agreed visible change.
- [ ] Replace localStorage Strapi JWT authority with verified Better Auth session client; clear old auth cache on transition/logout, retain noncredential presentation preferences, and invalidate pending requests from the previous account generation.
- [ ] Implement deactivation/deletion/reactivation state transitions from the existing baseline, deriving ownership from Actor and requiring current authority for irreversible operations. Revoke sessions and publish disconnection after the transaction commits. Do not retain upstream absence polling as proof of canonical deletion.
- [ ] Run auth/lifecycle unit/integration and browser scenarios. Perform an actual development Google callback using configured credentials; provider simulation is separate evidence. Commit. **Done:** session behavior and existing lifecycle screens work; any provider access blocker is explicit, not a mock-based success claim.

**Frontend authority closure (2.4):** include `components/ProtectedRoute.tsx`, `GuestRoute.tsx`, `OnboardingCheckError.tsx`, `main.tsx`, `pages/OnBoarding.tsx`, `ReactivateAccount.tsx`, `ReactivateConfirm.tsx`, `features/Settings/Settings.tsx`, `features/navigation/CategoryNavigationProvider.tsx`, `services/useAccountLifecycleIdentity.ts` and their source-listed tests. The [auth gap review](../frontend-auth-gap-review.md) is part of this ticket's required file/test inventory.

- [ ] Implement explicit verified-session states: loading, signed-out, active/incomplete, active/complete, recovery-only, terminal and retryable error. Stale local auth storage cannot authorize rendering. Test private/public deep links, reload and no home/onboarding redirect loop.
- [ ] Replace all logout entry points with one server-session-ending coordinator. Immediately fence local authority, cancel old work, clear account-scoped stores/caches, disconnect sockets and notify other tabs. Preserve theme/language. A failed revocation stays visible as retryable; do not silently rehydrate old authority or claim server logout completed.
- [ ] Handle definitive session expiry once across simultaneous requests; do not globally log out for ordinary404/403/provider outages. Never automatically replay a failed mutation after re-login. Test delayed A→B→A responses and stale navigation/lifecycle callbacks under a new session generation.
- [ ] Replace email/token recovery page integrations and corresponding text with the agreed Google recovery flow. This is an explicit Google-only auth exception to visual-behavior parity. Test cancellation, wrong identity, expired/replayed proof, deleted account and fresh-session success; legacy URL tokens confer no authority.
- [ ] Remove new-auth dependency on qrtoken from global bootstrap. Clearly fence temporarily retained Apollo traffic until category conversion; new session credentials never go to Strapi. Extend every named existing test in the gap review and the real auth/profile browser suites before the Books milestone.


## Remaining lifecycle acceptance (2026-10-05)

Accepted canonical lifecycle12 proves only its reviewed identities, including feedback A-B/verified ABA. Preserve all18 original lifecycle plus3 recovery equivalents: held deletion/deactivation/recovery completion fences, successful response-loss observation without proof replay, precommit atomicity/retry, purpose-only reload/second-tab recovery and the unresolved typed manual-review UI contract. Music45/accessibility12 remain separately owned. Discovery/registry changes must be atomic before protected execution. Do not retire old workflow coverage from a partial map; real Google and Music socket revocation remain named prerequisites.


## Independent review correction (2026-10-05)

Lifecycle observation is a prerequisite contract package L0 owned by 2.4, before L1 response-loss/reload implementation. Trace the actual service and define observation authority, typed terminal/pending/unknown/manual-review response and fresh-session transition. Ordinary Actor reads cannot be assumed available after deletion; single-use proof replay is forbidden. Retain HttpOnly purpose-only cookie and server-side hashed authority; never persist proof in browser-readable storage/logs. Freeze the original 18+3 requirement-to-receipt map and manual-review UI DTO before writer dispatch. This contract is unresolved, not an invented new endpoint.
