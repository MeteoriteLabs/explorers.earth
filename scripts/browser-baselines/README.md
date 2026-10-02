# Browser contract baselines

These are **discovery-only** snapshots from bounded Playwright `--list --reporter=json` on source 359635f6, Node24.21.0 and the installed locked dependency topology. No browser/database was started. Discovery statuses are not execution results. Music has 75 structured identities and Publishing69, obtained from the full stored suite trees, not count constants. Publishing's actual default project name is the empty string; never rename it to chromium in an identity.

Each JSON records exact command, project repeat counts, Playwright version, raw stdout hash, normalized identities, inventory hash and source/config/lock hashes. Source hashes include tracked frontend src/e2e/config files and tunes/shared contracts; a historical snapshot need not match a future checkout. A future executor must recompute source/config/lock digests before accepting assignments. Source hash excludes unrelated backend lifecycle-runner edits and public generated files. Full suite trees retain nested title structure and support independent inventory comparison. Neither these local JSON files nor SHA256 content hashes authenticate a hosted producer.

Pure module API:

- `discoveryIdentities({stdout,status,signal,error,stderr},{filePrefix,projects})` rejects malformed/empty/error discovery; expands repeatEach; preserves title hierarchy and project names.
- `planShards({identities,provenance,shardCount,timings?,atomicGroups?})` returns deterministic source-bound assignments. Timings are attempt-zero `{identity,durationMs}`; unknown/duplicate/invalid timing fails. Missing timings cost1ms as a stable packing weight, not a measured runtime forecast. Atomic groups are disjoint nonempty known subsets and remain whole. The caller retains/reviews group metadata. Empty shards fail.
- `validatePlan(plan)` checks schema, digest, assignment digests, exact disjoint union and source-hash shape.
- `validateReceipts(plan,receipts,expectedProducer)` accepts only complete attempt-zero pass, expectedStatus passed, clean cleanup and success conclusion. expectedProducer has repository/workflow/runId/attempt/event/ref plus exact `shardJobs` mapping from shard index to trusted job ID. Each receipt includes matching producer, source provenance, plan/assignment hashes, shard/jobId and structured results with exactly one `{retry:0,status:'passed'}` attempt.

The expected plan and producer/job mapping must come from trusted orchestration. Validators compare data; they do not perform HTTP, subprocesses, Docker, filesystem operations, signatures or GitHub authentication. They do not parse arbitrary execution JSON into qualifying receipts. Future adapters must preserve runtime annotations, retry/outcome/expectedStatus and teardown evidence; never normalize a red/flaky/skip into pass. Exact browser selection, namespaces/ports, trusted artifact origin/expiry, wrapper receipts and workflow/aggregate wiring remain unimplemented separate tickets.

Run focused contracts: `node --test scripts/browser-contract.test.mjs`. Only synthetic clean receipts are accepted in tests; real hosted browser failures remain red. No shard is an executor and no CI gate has changed.
