# Acceptance evidence ledger

This directory holds **references and sanitized run records**, not provider credentials, private profiles or database dumps. The provisional [matrix](../acceptance-matrix.md) has no claimed pass results yet. Ticket 1.2 must first provision its attested disposable local database and deterministic owner, second-owner, anonymous and suspended fixtures. A mocked browser check must say `mocked`; a real API fixture run must say `local-fixture`; a Google/Maps/S3 QA check must say `qa-provider`. None is owner sign-off.

For each run create a dated Markdown or JSON record with these fields:

| Field | Required content |
|---|---|
| `scenarioIds` | Exact stable IDs from matrix, including expanded category IDs |
| `sourceCommit` | Full Git SHA and dirty-tree state |
| `artifactDigest` | Immutable image/web digest if deployed; `not deployed` locally |
| `environment` | `mocked`, `local-fixture`, `qa-provider`, or `production-read-only` plus browser, viewport and OS |
| `fixture` | Seed version, account roles and non-secret authority identifier; explicitly distinguish mocks |
| `commandOrSteps` | Exact bounded command or reproducible browser steps, project/spec and flags |
| `actualResult` | Pass, fail or skip with observed UI, HTTP/network and storage effects; never infer from exit status alone |
| `traceOrScreenshot` | Relative artifact paths and SHA-256 digests; include desktop/mobile baseline images where applicable |
| `defects` | Issue or local defect IDs, impact, and whether pre-existing at source commit |
| `skippedReason` | Required when not run; state missing fixture/provider or authority gate, not “N/A” |
| `operatorAndTime` | Agent or owner identity and UTC start/end; mark owner UAT only when owner performed it |

Recommended directory: `evidence/YYYY-MM-DD/<run-id>/record.md` with `desktop/`, `mobile/`, and `traces/` children. Keep generated browser artifacts out of git when large or sensitive; commit a stable manifest with hashes and an accessible artifact reference. Scrub tokens, cookies, email addresses, raw profile contents, private URLs and connection strings before retention. Snapshot refresh alone is not parity evidence: attach observed run result and review the changed image.

Current status: **inventory only** at source `79ef17d0b88c7e11b49d618fc7c888a513f29fa8`. No new browser screenshots or baseline suite runs were produced for Ticket 1.1. Those runs are deferred until 1.2's safe local authority exists; the existing PNG snapshots in `explorers-earth/e2e/music-public-contract.spec.ts-snapshots/` are historical fixtures, not this run's screenshots.
