# Partial local fixture cleanup repair

2026-10-03. Scoped repair on `codex/unified-replatform`, based on `8a36e5fcd21d49eb42f4e50410c5332333cb211d`. No push, workflow, image, application or ledger change.

## Diagnosis and implementation

Read Ticket 1.2, current ledger and `checkpoint-1071193c-platform-fixture-triage.md`. Original fixture was introduced in `6856e884`; subsequent cleanup review was `9bd0973b`, diagnostics `59833271`/`c64a274e`/`50c18c55`, build sequencing `40c23bed`, and pinned images `8ce52776` (repository author TK). The hosted record proves a service-build rate-limit classification, not a particular registry or image.

Provision records the healthy owned PostgreSQL receipt before application image builds. Previously `stop` called full `check`, requiring all three applications healthy and migrations completed. A failed application build could therefore prevent cleanup of an otherwise owned partial fixture.

`stopPlatformLocal` now validates exact receipt/target, attests the recorded PostgreSQL container without requiring health, attests the checked Compose model, and verifies every present project resource before mutation. The actual CLI uses that attested model for `stop`. Source revision and local Docker endpoint checks remain in the CLI. Read receipts must have the exact authority keys. Present resources retain project/fixture labels and declared container/network/volume names, volume mount bounds, and network bounds. Duplicate services and foreign collisions at declared container names are refused. Absent declared resources do not require provisioning success. `check`, migration and browser qualification readiness assertions are unchanged.

Failure diagnostics add a fixed build-stage category based on the failed BuildKit step ID: base-image pull, npm build command, other build command, or unknown. Unrelated successful metadata progress cannot identify a later npm failure. Ambiguous/missing evidence remains unknown; no raw image, registry URL, output or secret is emitted. The existing cause category is preserved alongside this narrower stage evidence.

## Verification and limits

- Initial new cleanup/stage contracts were red (six missing-export failures); implementation made them green. A subsequent duplicate ownership inventory regression reproduced an actual missing rejection and passed after the bounded validation fix.
- Clean committed-source archive with only owned script/test overlays, separately installed locked root and Tunes dependencies, Node 24.21.0: **50 tests passed**, zero skips: authority 39, Compose safety six, runtime inventory five. No historical scratch test collection was included. `git diff --check` passed.
- Full C0 compilation and baseline comparison were attempted, and are **not claimed green**: three TS7006 errors in existing `betterAuth.ts`/`recoveryCallback.ts` callback parameters. Untouched HEAD and repaired source in the same locked environment produce byte-identical C0 diagnostics, so no introduced compiler diagnostic was observed. No auth source or baseline was altered.
- Actual deterministic post-PostgreSQL build injection was prepared in an isolated source archive. Actual provision safely refused first at `resource-inventory`, before PostgreSQL startup, because five historical stopped `explorers-replatform-local` containers and both declared networks/volumes already exist. The existing worktree receipt belongs to `c91cef4a6a014f3649844e42a342e62a28313525`, with reset intent; current source differs. Those historical resources and state were preserved. Thus **actual PostgreSQL partial-build/stop/reset execution remains unqualified**, pending orchestrator coordination for exact old-receipt reset. No actual cleanup or empty-resource claim is made.

Archive: `C:/Users/TK/AppData/Local/Temp/replatform-partial-cleanup-7000a099488a4828af724d6a957fb73b`. The throwaway injection changes only the archive's service-build callback and never the committed wrapper. Initial archive provision exit1 at resource-inventory is retained as blocked evidence; unit tests explicitly inject build failure and prove cleanup can operate on a PostgreSQL-only unhealthy/stopped authority while readiness rejects it.

Independent review and coordinated actual fixture reproduction are required before push/hosted rerun. The hosted rate-limit source remains unknown until future failed-step diagnostics establish it. Mandatory broader parity/release gates are unchanged.
