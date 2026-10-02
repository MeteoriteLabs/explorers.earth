# Task3.2 Books provider and recommendation media report

Finite producer/media implementation on `codex/unified-replatform`, based on `22456f78`. The authoritative preflight and contract review rulings are implemented. This report does not claim the full Books milestone or browser/UI acceptance.

## Delivered behavior

The canonical owner API provides bounded Google Books candidate search and exact server refetch resolution. Requests carry identity only; provider facts and provenance are server-owned. Successful command receipts replay before provider I/O. Shared existing facts remain immutable; referenced provider refresh is deferred. Candidate cursors bind normalized query, English language, limit and expiry; they are offset pagination, not provider snapshots. Search caches successful bounded responses with coalescing; failures are explicit safe errors.

The initial exact `books.google.com` metadata host policy is conservative application policy, not an exhaustive official Google host list. HTTP is upgraded only on that host. Provider covers remain external metadata; no remote image byte fetch/copy is implemented. Provider and manual Books use typed bibliographic facts, independently mapped ISBN10/13, source subject strings, sparse account presentation overrides and explicit account buy-link context.

Named `POST /recommendations/:id/entity` requires expected revision and idempotency key. Any existing compatible global canonical UUID is eligible, as in create; there is no account ownership/grant map. Same identity is422. Replacement preserves rating, rich note, media, context, overrides, collection membership and pins, and updates the recommendation/category revision transactionally.

Recommendation uploads use existing raw bounded transport, image-only5MiB. Public bytes require ready media, completed public account, public Books category, published active recommendation, and at least one active published public collection membership before storage reads, HEAD, range or ETag handling. Existing profile/feed eligibility remains compatible. Shared client methods validate typed provider/Book responses and respect actor/generation fences, cancellation and issued recommendation observations.

Append-only0034 adds exact target Book details/context companions, guards, minimal runtime grants and context statement revision triggers.0033/historical migrations are unchanged. Current floor, recognized markers, runtime/restore inventories, deployment/image configuration, purge manifests and generated route/authorization inventory are coupled to0034. Actual purge preserves shared Book facts while removing owner context. Restore compares nonempty companions and schema/grant/trigger fingerprints.

## Qualification

All final commands use portable `C:/Users/TK/.codex/tmp/node24-alignment/node-v24.21.0-win-x64/node.exe`24.21.0. Initial host24.14 results are provisional only. Heavy lanes were serialized. No thresholds or production test exclusions were changed.

Deterministic TDD includes observed missing-module/behavior failures, invalid provider bounds/UTF8/depth/deadline/cursor/identity failures, integer overflow and cross-provenance identity red/green cases. Final provider unit12/12 pass. Final provider/storage/shared-write/CLI scope73/73 passed through npm test.

Guarded disposable PostgreSQL51538 runs through the existing attested `scripts/.shared-notes-harness.ts`; no environment guard bypass. Composed API regression97/97 passed. Producer/purge/migration48/48 passed; runtime-role27/27 passed. A later68-case producer/recommendation/media/owner run caught a missing pin-state fixture in the strengthened test (67 passed); corrected fixture and final Books7/7 passed, preserving nonempty media/pin/membership. Actual restore58038 through `scripts/.shared-notes-restore-harness.ts`:3/3 passed with nonempty Book facts/context hash and value comparisons; owned restore container stopped afterward.

Clean tracked archive with scoped source overlay, no copied scratch: clean root/backend/frontend installs and final API/frontend production builds are recorded below. Canonical migration/CLI contract tests require local Git metadata, so an initial archive test attempt was stopped after missing-Git failures/skips; a local qualification snapshot was initialized and tests rerun unchanged. The direct Vitest invocation omitted npm_execpath for one public-root CLI contract. Clean root dependencies were installed and the exact file reran through npm test successfully; no skipped fixture test is accepted as final qualification.

## Final-source command results

`N` denotes the exact portable Node24.21 executable above; `P` is its sibling `node_modules/npm/bin/npm-cli.js`, with that portable directory first in PATH for child processes.

- Clean `N P ci` at root, tunes and explorers-earth: pass, unchanged lockfiles.
- Clean scoped `N tunes/node_modules/vitest/vitest.mjs run <15 changed unit files>`:377 pass/1 failure,727.43s. The failure was solely omitted npm_execpath; all14 other files, including executable deployment contracts, passed. Corrected clean `N P test -- server/test/contracts/music-cli-contract.test.ts server/test/book-catalog.test.ts server/test/book-writes.test.ts server/test/explorers-object-storage.test.ts`:4 files73/73,40.99s. No full bare backend aggregate is claimed.
- Clean frontend `N P run test:unit`:283 files4026/4026, zero skips,28.99s. An initial4025-pass/1-failure run exposed the isolated owner-validator bundle fixture missing its new Book companion; the copy inventory was extended and assertions retained.
- Clean tunes `N P run music:types:scoped`:pass. `N P run music:types:baseline`:pass,142 current/103 resolved known baseline diagnostics; whole-project compiler still exits2 as expected by that comparison.
- Clean tunes `N P run test:music-critical-coverage`:24 files587 passed/1 preexisting Windows skip,52.72s; all per-file statements/branches/functions/lines thresholds remain100%, aggregate100%. The existing skip is POSIX group-writable checkpoint-directory qualification on Windows; no new skip was introduced.
- Final guarded51538 `N --import ./node_modules/tsx/dist/loader.mjs scripts/.shared-notes-harness.ts test server/test/book-catalog.integration.test.ts server/test/explorers-recommendations.integration.test.ts server/test/explorers-media.integration.test.ts server/test/explorers-owner-content.integration.test.ts`:4 files68/68,29.19s, zero skips. This includes actual image5MiB overflow, video/mismatched MIME denial before storage, replacement with nonempty media/pins/membership, immutable shared provider facts, receipt replay/rollback, public effective presentation and all tested byte ancestor gates.
- Final clean `N P run build:api` in tunes and `N P run build` in explorers-earth:both pass. Frontend includes production HTTPS Music transport assertion. Historical migrations remain unchanged; scoped `git diff --check` passes.

Clean qualification directory: `C:/Users/TK/AppData/Local/Temp/books-provider-clean-ed37ed1d6d834e6e97860f7dab71f4e9`. Logs there:book-scoped-unit.log,book-final-focused.log,book-final-frontend-test.log,book-critical-coverage.log,book-types-scoped.log,book-types-baseline.log,book-api-build.log,book-frontend-build.log. The clean snapshot excludes preserved copied workspace scratch; tests gained no new exclusions.

The initial source commit qualifies implementation and the above lanes. A separate bounded local Docker API image, production graph and startup/floor lane is pending immediately after that commit and independent source review; no image/runtime deployment completion is claimed yet.

## Explicit limits and next acceptance

No live Google quota/entitlement/credential, QA S3, hosted deployment, production image rollout or browser smoke is claimed. Subjects are provider strings; no invented taxonomy fixtures were inserted.3.3 adopts these client/API seams in Books UI. Source automatic provider-cover copy and explicit cover-role parity remain a required3.3 acceptance item; external cover metadata plus uploaded snapshots here does not drop that feature.3.5 owns live provider/storage/real smoke evidence. Existing broader browser failure remains outside this finite producer slice and is not described as passed.

Unrelated audit documents, earlier reports, robots/sitemap and scratch are preserved. No push, merge or production operation was performed. Independent review follows the scoped commit.