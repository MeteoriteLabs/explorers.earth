# CI follow-up after lifecycle implementation — 2026-10-09

Checks on pushed `55eba604b39b14016b89674f513b1cdee5f8de52` exposed two implementation-package regressions. They do not establish ticket closure.

## OCI fixture schema

[Linux C0 run37942291418](https://github.com/tandavkrishna27/explorers.earth/actions/runs/37942291418), [backend contracts run37942291407](https://github.com/tandavkrishna27/explorers.earth/actions/runs/37942291407), and [image run37942292296](https://github.com/tandavkrishna27/explorers.earth/actions/runs/37942292296) fail at stale independently generated OCI fixtures. Releases claim51 while the current schema floor is52, so release parsing rejects them before case-specific OCI validation. Direct Windows invocation reproduces53 failed/44 passed; this is not an OS-specific behavior defect.

The existing independent generator now emits52, and its cases/receipt are regenerated. Historical51 rejection is added. Four focused contract files pass284 tests. Independent review compared all71 cases: names, intended errors, API/web OCI bytes and layers unchanged; decoded release differences are limited to schemaVersion and manifestDigest. A second generation produces identical bytes. Production validation is unchanged.

The image job stopped before building/scanning; its later report-validation failure reflects absent image evidence. No new Handlebars scanner pass follows from this run.

## Lifecycle regression isolation

Hosted database job113859472515 reports42 files passed/1 failed/5 skipped,653 tests passed/6 failed/7 skipped, plus a cleanup-hook timeout. The new numeric cases pass, but leave pending deletion operations. Later global worker tests with batchSize1 claim those older operations, and the final default batch claims3 instead of1. An assertion in the paused-upload case occurs before releasing its held put, causing the cleanup timeout.

The correction completes each new case's own deletion through the actual worker and checks its terminal operation, after returning checked-out clients. The paused upload is released and joined in finally even on assertion failure. Worker assertions and production behavior remain unchanged. Fresh-head database execution is required to verify the repair.

The known platform-fixture failure remains `phase=ingress-check; cause=ingress-malformed-body`; no candidate waiver is introduced. Backend browser, frontend, static/security/docs/image-deploy contracts and unit coverage pass on55eba604. Frontend TypeScript, build, lint, full unit and integration checks pass; its Music/account browser lane passes. Remaining browser-lane outcomes must be read from the exact run, not inferred.
