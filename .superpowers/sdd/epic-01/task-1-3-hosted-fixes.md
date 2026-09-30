# Ticket 1.3 hosted PR 119 fixes and diagnosis

2026-09-30. Base `347f8c89c038a6d5de9bf5be22b36b383fa122aa`. Read-only GitHub logs were inspected for [CI run 36714617257](https://github.com/MeteoriteLabs/explorers.earth/actions/runs/36714617257), [Music run 36714617246](https://github.com/MeteoriteLabs/explorers.earth/actions/runs/36714617246), and [Tunes image run 36714617732](https://github.com/MeteoriteLabs/explorers.earth/actions/runs/36714617732). No secret values, production settings, deployment commands, or remote mutations were inspected or used.

## Classification and source action

| Job | Hosted evidence | Classification and local action |
|---|---|---|
| CI `🔍 Lint` | One error, 1,524 pre-existing warnings: `replatformLocalVite.test.ts:44` violated `no-unsafe-finally`. TypeScript, build, unit and integration succeeded; E2E skipped through `needs`; strict aggregate correctly failed. | New test defect. Moved the temporary-root containment assertion before `try`, retaining the guard and cleanup. Local ESLint reproduced red before fix and passed afterward. |
| Music `contracts` | One real Compose-model contract timed out at Vitest's default 5 seconds; 666 tests passed, 10 were skipped on that hosted run. | Hosted Docker Compose command exceeded the test's 5-second budget. Kept the real `docker compose config` assertion, bounded the child command at 15 seconds and gave this specific test 20 seconds. Local targeted contract passed; full contracts passed after the change. No assertion was suppressed. |
| Music `platform-fixture` | `provision` failed after about 11 seconds with only “authority details redacted”; `stop` then refused because provision had not completed. Its exact failing boundary is absent from the hosted log. | Root cause **not yet established**; do not claim this lane fixed. Added fixed, non-sensitive phase labels to the CLI's existing redacted refusal, covering Docker endpoint, Compose model, inventory, secret creation, PostgreSQL start/attestation and service build/check. No underlying error, path, command argument, host, or credential is printed. A refusal with synthetic `DOCKER_HOST` locally reported only `phase=docker-endpoint`. The next hosted run must identify the boundary; resolve it without bypassing attestation or marking this job optional. |
| Tunes `build-test-scan-push` | Build and tests completed; Anchore Grype's `only-fixed` high scan failed. The retained [SARIF artifact](https://github.com/MeteoriteLabs/explorers.earth/actions/runs/36714617732/artifacts/11094794754) lists exactly two high findings with available fixes in the production image: `brace-expansion` 1.1.18 → at least 1.1.19, and `engine.io` 6.6.9 → at least 6.6.10. Other reported high Alpine/Chromium findings have no listed fix version and did not make the only-fixed scan pass. | Fixable dependency vulnerabilities, not runner failure. Refreshed only the Tunes transitive lock resolutions: `brace-expansion` 1.1.21 and `engine.io` 6.6.11. `npm ci --legacy-peer-deps` and Tunes build passed; production-only `npm audit --omit=dev` reports **zero high** (four moderate remain). The original Grype fail-on-high/only-fixed gate and full-disclosure report are unchanged. A new hosted image build/scan must confirm the result. |

The Music job's dependent database, security, frontend, browser and image-contract jobs were skipped because `contracts` failed; `music-required` correctly failed. The CI E2E skip and both aggregate failures must stay red until prerequisites succeed. The C0 Linux and Windows jobs succeeded on the PR head. The separate image push run 36714597983 was still running when dispatched; no fix was inferred from it.

## Local validation

- Red then green: `npx eslint src/features/music/__tests__/replatformLocalVite.test.ts` (one `no-unsafe-finally` error, then exit 0).
- `npm test -- src/features/music/__tests__/replatformLocalVite.test.ts`: 4/4 passed.
- `npm test --prefix tunes -- --run server/test/contracts/replatform-local-authority.test.ts`: 17/17 passed. A first subprocess-based diagnostic test failed because the Tunes-local older `tsx` loads a root script in the wrong module mode; replaced that test harness with a pure formatter contract. The root-owned `tsx` CLI was separately exercised with a synthetic forbidden Docker host and emitted only the fixed safe phase.
- `npm test -- --run server/test/contracts --maxWorkers=1 --fileParallelism=false` in Tunes: 40 files, 675 passed, 3 existing skipped.
- `npm ci --legacy-peer-deps` in Tunes and `npm run build` passed. `npm ls brace-expansion engine.io --all` resolves the fixed versions, and `npm audit --omit=dev --json` reported zero high, four moderate.
- YAML gate conditions and source trust boundaries were not changed. The Grype gate remains a required fail-closed image qualification.

## Next remote decision

Independent review of this local patch is required before controller push. After push, inspect exact-SHA PR runs: lint, Compose contract, `platform-fixture` phase, both strict aggregates, E2E, all Music dependents and the Tunes image scan. If `platform-fixture` remains red, the phase code is diagnostic evidence for a further source or hosted-runner fix; it is not an approval to omit the job. No branch protection or production release should rely on this PR until all mandatory checks actually pass.


## Lockfile peer coherence correction

Independent review of commit `59833271` found that `npm update ... --legacy-peer-deps --package-lock-only` removed the existing `openapi-types@12.1.3` peer entry. The C0 Linux/Windows workflow deliberately uses plain `npm ci --prefix tunes`, which then rejects the lock as out of sync. This was reproduced locally with plain `npm ci --dry-run --ignore-scripts --no-audit --no-fund`: exit 1, “Missing: openapi-types@12.1.3 from lock file.”

Restored only the previous `node_modules/openapi-types` lock entry (same resolved tarball, integrity, dev/peer metadata). The patched production resolutions remain `brace-expansion@1.1.21` and `engine.io@6.6.11`; no C0 install mode or check was changed.

Green after the lock correction: plain and `--legacy-peer-deps` `npm ci` dry runs both exited 0; full plain `npm ci` exited 0 and installed the peer. `npm ls` confirms all three versions. Four focused C0/local authority files passed 63/63; `music:types:scoped` and Tunes build passed. The baseline comparator passed with the known 142 diagnostics/compiler exit 2, not a full typecheck success. Production-only npm audit reports zero high and four moderate. The hosted Grype and C0 checks must still verify the new commit.
