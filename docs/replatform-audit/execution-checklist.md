# Shared execution checklist


**Current finite status (2026-10-05):** A3M manual Games locally qualified and independently reviewed: source104, frontend4231 and canonical protected82 PASS. Scoped commit preparation only; hosted exact-commit qualification, full IGDB/provider parity, operational QA and release remain open. Earlier pending/failed sections are preserved historical evidence, not the current execution state.

Apply this checklist to each ticket where its surface is affected. Record the applicable checks, executed counts, environment, commit and evidence in the ticket report. A check with an unmet prerequisite is pending, not passed. The [durable implementation ledger](../../.superpowers/sdd/epic-01/progress.md) is the status authority; planning checkboxes are requirements, not completion records.

## Contract and consumer closure

- [ ] Before implementation, classify affected tests as current canonical behavior, obsolete implementation assumptions requiring replacement, or future-ticket parity obligations. Record the replacement coverage and dependency owner. Never label failures legacy merely from their filenames or counts.
- [ ] For each changed contract, inventory strict response expectations, fixture DTOs, generated files, imported runtime schemas, package installations and public/owner consumers. Regenerate relevant inventories and qualify test discovery in the exact clean install topology used by CI.
- [ ] Before calling a failure intermittent or preexisting, preserve its exact source, environment, identity and sanitized assertion evidence. Diagnose the first failure before rerunning; report later passes alongside earlier failures. Artifact directory names and incomplete timeout logs are not test outcomes.

- [ ] Map every changed producer to its consumers: owner UI, public profile/list/detail, Settings, onboarding, shared navigation, test fixtures and external adapters. Check actual typed payloads emitted by the current components and accepted by the API; include omitted and blank optional values and nullable enum fields. Verify save, reload and public projection with those payloads.
- [ ] Exercise repeat save, stale revision, two-tab edits, account switch and stale-session responses. A failed write must leave persisted state and UI authority unchanged; a late response from an old account cannot populate the new account's view.
- [ ] For private/public data and media, check authorization at storage, delivery and cache boundaries. Invalidate or partition caches across visibility and account changes. Test concurrent attach/delete, replacement failure and durable cleanup retries so committed references never point at deleted objects and orphaned objects are recoverable.

## Schema, runtime and deployment

- [ ] Keep each migration atomic with its manifest, generated inventory, readiness rules, runtime/migrator privileges and deployment schema floor. Run the migration against the attested disposable database and prove startup/rollback behavior. Synthetic fixture identities must be explicitly test-only and cannot authorize production requests.
- [ ] Validate each CI package from a clean isolated `npm ci`, then build and run that package's required tests with its own lockfile and dependency graph. Record local versus hosted evidence separately. Run the full affected frontend regression selection before review, including shared consumers and legacy harnesses; targeted tests alone do not close cross-feature changes. Call a failure “preexisting” only after reproducing it at the base commit under the same environment.
- [ ] Define guarded real-API session and data fixtures before dependent browser acceptance. Require a real application API and disposable database for persistence claims; label mocked UI and provider simulations separately. Respect the containment boundary and report skipped/blocked scenarios with their cause.
- [ ] Keep phase diagnostics useful without printing secrets, session cookies, tokens, database URLs or registry credentials. Inspect the built runtime image and its dependency scan, not only source and unit tests. Preserve required security gates and capture the exact failing phase and artifact on failure.

## Handoff

- [ ] Agent briefs must name the exact source/worktree, plan and review paths, owned files, dependency closure, test commands, red reproduction, cleanup/artifact policy and acceptance limits. Completion reports must distinguish implemented, locally verified, independently reviewed, pushed and hosted-qualified states.

- [ ] Bind qualification receipts to the complete executed source and configuration closure, including migrations, fixture authority helpers, entry points, assets and transitive dependencies. Record commit and actual checkout hashes separately where line endings differ. Test that a relevant change is detected even when the checkout was already dirty; do not use the dirty boolean as a source fence.
- [ ] For browser tests carrying real signed sessions or recovery proofs, use protected artifact settings and owned output directories. Prevent credential-bearing traces, videos, raw reporter data and secret files from surviving outside the reviewed artifact allowlist. Exercise a controlled failure and verify cleanup while retaining its failed result.
- [ ] Separate delivered-slice evidence, whole-milestone obligations and full parity. Missing prerequisites, skipped tests and simulated providers remain explicit. CI optimization must preserve exact structured test identities, browser projects and fail-closed results; shorter runs do not establish feature completion.
- [ ] Give each agent bounded file ownership, prerequisites and completion criteria. Require diagnosis and a failing regression before scoped fixes, independent review before promotion, and immediate completion/blocker messages with evidence. The coordinator records the next ready action and acts on it rather than only polling.

- [ ] At agent completion or a blocking discovery, immediately report the exact commit, files, executed checks/counts, blocked checks, evidence location and next action to the coordinating task. The ledger is updated from that evidence; do not wait for polling or infer completion from a file appearing.

## Category delivery learning supplement

Apply [Books and Movies delivery learnings](category-delivery-learnings.md) when grooming each remaining category and writing agent briefs. Verify consumer closure, asynchronous scope fences, truthful busy/retry recovery, real pagination/publication interactions and atomic schema/fixture closure. Parallelize only independent file/resource ownership; focus runs never replace full protected acceptance.

- [ ] Before category allocation, verify actual command routes/service/repository/client signatures, category media allowlists and shared signed-cursor consumers; do not infer mutation support from read contracts. Apply the Games integration findings in the category learning supplement. Privacy negatives must establish the same resource was readable beforehand; aggregate limits must apply before driver materialization and initial authority awaits.

## Evidence and inventory learnings from Games manual delivery

Before source-bound qualification, register every reviewed new runtime/test file in the private Git inventory. A guard rejection before any fixture/case is a zero-execution scheduling failure, not a product failure. Preserve it and correct only the exact reviewed inventory without weakening the guard. Bind actual checkout byte format and dependency topology; private transformer preflight must exercise raw executed bytes plus LF/CRLF variants and an actual source-bound transform/build.

Owner detail fanout must latch the first error (including undefined), stop future claims after transport/revision/byte failure, retain caller-cancellation guards and bounded sibling settlement. Requested abort is not proof of native settlement. Private owner hooks synchronously exclude settled content from a previous account/generation before passive cleanup. Test intermediate render samples, not only final hook state.

Observer/manual paging tests must require current-scope final content and settled terminal state. A redundant manual control may disappear after automatic completion; detachment alone proves nothing. Preserve original action errors unless exact current-route required row and absence of busy/loading/error/continuation are established, and retain final native modal/privacy/later-page assertions. Proactive synchronization tests are not evidence of a historical timeout root cause.

Latest finite local manual Games slice is independently reviewed canonical82 PASS, source104 exact. Hosted proposed-commit qualification, real-provider parity and operational QA/release remain open; do not mark shared checklist requirements universally complete.
