# Ticket 8.2: Remove duplicate Tunes frontend

**Status:** consult the [durable implementation ledger](../../../.superpowers/sdd/epic-01/progress.md); checkboxes below do not assert implementation status.

[Parent epic and shared contracts](../epics/epic-08.md) · [Master plan](../implementation-plan.md) · [All tickets](../ticket-index.md) · [Shared execution checklist](../execution-checklist.md)

## 2026-10-05 execution amendment

Read the [re-groomed dependency and ownership plan](../../superpowers/plans/2026-10-05-replatform-regroomed-execution.md), including this ticket's all-ticket disposition, before allocation. Preserve the implementation and acceptance requirements below. Canonical producer, active consumer, fixture, real-backend evidence and exact-commit hosted status must be tracked separately; missing future producers are dependencies, never fixture waivers. Every new delegated assignment uses a fresh agent. Proposed original paths/commands must be checked against current source before execution.

## Current execution card

**Disposition:** waiting. **Technical inputs:** 8.1. Dependencies refer to reviewed interfaces for partial packages; complete-ticket acceptance retains all original gates.

**Next package:** Consolidate approved API-only/Music topology after retirement; retain security and role boundaries.

**Ownership:** The ticket owns its category/feature files listed below. Shared schema, migration identifiers, route registration, auth clients, Settings, seeds and protected manifests require coordinator allocation before any writer starts. Do not dispatch overlapping writers.

**Execution gate:** Verify listed paths and actual package scripts against current source; classify proposed tests as to-create, never executed. Record the exact failing behavior before changing production code; run focused automated regressions, canonical real-backend/browser acceptance, fresh independent review, then commit/push and exact-SHA hosted checks. Preserve source/dependency hashes, counts/skips, first failure and owned-resource cleanup. Historical acceptance is retained, not rerun by default. External inputs and deployment authority remain explicit gates.

**Current commands:** Read the [command custody correction](../command-custody-2026-10-05.md). Historical generic suite/project/environment commands are proposed interfaces, not supported current runner flags; original behavior obligations remain required.

## Required context

Read the [authoritative database schema](../target-database-schema.md) and apply the [shared execution checklist](../execution-checklist.md) to affected surfaces. Apply the parent epic's global constraints, shared interface definitions, review focus and test-harness prerequisites. Those contracts are maintained once in the epic, rather than copied into thirty-eight potentially conflicting versions. Existing files refer to the pinned audit source; paths labelled create/new were proposed when authored. Commands and checkboxes specify required verification, not completed runs.

## Implementation and acceptance

**Prerequisite:** 8.1; API-only 1.4; Explorers Music acceptance complete.

**Files:** remove `tunes/client/`, frontend-only `tunes/vite.config.ts` and Vite-serving code after import audit; modify `tunes/package.json`/lockfile, Dockerfile, TypeScript/Vitest configuration, root commands, fixture build scripts and CI scripts referencing client tests. Keep any UI library still imported by server tooling until dependency resolution proves unnecessary.

**Interface produced:** backend has no duplicate frontend build or runtime dependency. Explorers owns corresponding client behavior tests.

- [ ] Map every deleted test, particularly `client/src/lib/musicCredential.test.ts` and `musicPublicationClient.test.ts`, to retained Explorers equivalents. Preserve retry, credential expiry, public capability and idempotency assertions; document genuinely retired behaviors.
- [ ] Remove client/config/imports and regenerate lockfile reproducibly. Do not make unrelated dependency upgrades.
- [ ] Run API build, production graph smoke, contract/unit/database suites, critical coverage using updated source paths, and Explorers owner/guest/reconnect/publication browser scenarios.
- [ ] Inspect packaged image for removed UI assets and verify health/API errors still correct. Commit separately from rename. **Gate:** removal loses no retained behavioral coverage and no runtime imports resolve into client.


## Independent review correction (2026-10-05)

**Verdict: NOT-STARTED.** All requirements and gates above are retained. This section records exactly where the duplicate frontend still lives, and corrects the ticket's implied risk profile: **product risk is lower than the ticket implies, and CI-gating risk is higher.**

### Where the duplicate frontend still lives

- **It exists.** `tunes/client/` is present with **162 tracked files**.
- **It is the Vite root.** `tunes/vite.config.ts:31` sets `root: path.resolve(__dirname, "client")`.
- **It is built.** `tunes/package.json:18` defines `"build": "vite build && esbuild …"`, reached from the root workspace by `package.json:14` `build:all` (`npm run build --prefix tunes && …`).
- **It is served.** `tunes/server/index.ts:20` wires `setupVite`; `tunes/server/runtime.ts:18` exports `serveStatic`; `tunes/server/config/music-startup.ts:124` selects `runtime.serveStatic(app)`.
- **It is still CI-gated.** `.github/workflows/test.yml:70` runs `test:music-critical-coverage --prefix tunes`, and that script at `tunes/package.json:36` includes `client/src/lib/musicCredential.test.ts` and `client/src/lib/musicPublicationClient.test.ts` with `--coverage.thresholds.perFile=true` and lines/branches/functions/statements all at **100**, with `client/src/lib/musicCredential.ts` and `client/src/lib/musicPublicationClient.ts` in `--coverage.include`.

### It is NOT in the shipped image

- `tunes/Dockerfile:40` runs `npm run build:api` (not `build`), and `:74` is `CMD ["node", "dist/server/api.js"]`.
- `tunes/server/test/contracts/api-only-build.test.ts:119` asserts the esbuild metafile contains **no** input matching `client/`, `vite.config.ts` or `server/vite.ts`.

So production does not ship this client. The ticket's framing — remove a duplicate frontend that users could be served — overstates the product exposure. What the ticket **understates** is that two of its deletion targets currently hold 100%-per-file coverage thresholds inside a required CI lane, so deleting them without re-homing them will either break `test:music-critical-coverage` or silently drop a 100% gate.

### Required removal order

This ordering is a gate, not a suggestion. Any other order either deletes coverage-gated behavior with no replacement, or breaks a required lane:

- [ ] **First**, re-home `client/src/lib/musicCredential.test.ts` and `client/src/lib/musicPublicationClient.test.ts` to retained Explorers equivalents, including their `--coverage.include` targets, and update `tunes/package.json:36` so `test:music-critical-coverage` still names real files at 100% per-file thresholds. A reduced threshold, a removed `--coverage.include` entry or a dropped test file is a weakened gate, not a completed removal.
- [ ] **Then** remove the Vite build path: `tunes/package.json:18` `build`, `tunes/vite.config.ts`, `tunes/server/index.ts:20` `setupVite` and the `serveStatic` branch at `tunes/server/config/music-startup.ts:124` / `tunes/server/runtime.ts:18`. Reconcile `package.json:14` `build:all` in the same change.
- [ ] **Then** delete `tunes/client/` and regenerate lockfiles reproducibly, with no unrelated dependency upgrades.
- [ ] Retain `api-only-build.test.ts:119` as the post-removal regression: it must still pass, and must not be relaxed to accommodate the removal.
