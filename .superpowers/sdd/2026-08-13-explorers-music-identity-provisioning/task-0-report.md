# Task 0 report — topology, contracts, inventory, and baselines

Status: DONE_WITH_CONCERNS

## Implementation

- Added the root `music:*` command contract and Node-native launcher,
  deterministic disposable Compose fixture, generated ignored test credentials,
  JSON/human evidence envelopes, interruption checkpoints, resume fingerprint
  rejection, safety-gated destructive cleanup/reset, and a live-capture block.
- Added versioned Strapi identity fixture validation (person ID, exactly one
  completed Account, schema version, complete pagination, read-only service
  operations) plus runtime-table manifest validation.
- Recorded Decision A, interim TK ownership assignments, data-family lifecycle
  classification, table/API/socket/job inventory boundary, TypeScript baseline,
  and the production preflight blocking abort.
- No live/production credentials were read, printed, or persisted; no live
  probe ran and no production mutation was attempted.

## Files

`package.json`, `.gitignore`, `.env.music.example`, `.env.music.test.example`,
`docker-compose.music-test.yml`, `fixtures/strapi/music-identity/identity.fixture.json`,
`tunes/scripts/music-cli.ts`, `tunes/scripts/inventory-runtime-tables.ts`,
`tunes/server/test/contracts/*.test.ts`, and the six requested Music documents
under `docs/`.

## TDD evidence

1. RED: `npm test --prefix tunes -- server/test/contracts/strapi-identity-contract.test.ts`
   failed because `../../../scripts/music-cli.ts` did not exist. GREEN after
   the minimal live-read-only credential refusal: 1/1 passed.
2. RED: `npm test --prefix tunes -- server/test/contracts/runtime-table-manifest.test.ts`
   failed because `inventory-runtime-tables.ts` did not exist. GREEN: manifest
   and referenced-table checks passed.
3. RED: expanded identity tests failed for missing immutable user ID, ambiguous
   Account selection, and schema drift. GREEN: those checks passed; a later RED
   for a write-capable service token also passed after read-only enforcement.
4. RED: `music-cli-contract.test.ts` failed with `Unexpected end of JSON input`
   because the CLI emitted exit 0 without an envelope. GREEN: final JSON
   envelope test passed. A subsequent RED showed resume accepted a different
   commit; GREEN rejects it with exit 3.

## Commands and results

| Command | Result |
| --- | --- |
| `npm ci --ignore-scripts; npm run music:bootstrap -- --format json` | pass; 33.7–39.7s local cold bootstrap; root + both child lockfiles installed |
| `npm run music:doctor -- --format json` | correctly fails with exit 3 because Docker daemon is unavailable; gives start-Docker recovery |
| focused contract tests | pass: 3 files, 9 tests |
| `npm test --prefix tunes` | pass: 9 files, 81 tests |
| `npm run check --prefix tunes` | existing baseline: exit 2, 245 diagnostics in 26 files |
| deliberate `shared/schema.ts` type mismatch | regression gate failed with the added `TS2322`; probe removed immediately |
| `npm run music:up -- --detach --wait --format json` | safely failed exit 4: Docker Desktop Linux engine pipe unavailable; no fixture started |
| `npm run music:fixtures:capture -- --mode live --format json` | safety refusal exit 5; no probe attempted without explicit RO URL/credential |

## Self-review

- Confirmed no production endpoints are called in fixture mode and live capture
  remains blocked before network activity.
- Confirmed all fixture secrets are generated into ignored `.env.music.test`.
- Confirmed the preflight says “BLOCKED” rather than claiming evidence not
  observed, and named interim TK assignments carry the required replacement
  warning.
- `git diff --check` passed before commit.

## Concerns / blockers

1. Docker Desktop's daemon is unavailable, so the Compose up/smoke/down portion
   of the Windows golden path could not be completed locally.
2. C0 intentionally has a documented production-preflight abort: no separately
   authorized read-only database/Strapi credentials, topology proof, migration
   history, backup restore proof, or Strapi lifecycle/pagination proof exists.
3. Tunes has 245 pre-existing TypeScript diagnostics. The baseline is recorded;
   C0 added no intentional persistent diagnostic.
4. The repository has no versioned Drizzle migrations; cutover remains blocked
   until a migration baseline is introduced and tested against a fresh DB.
5. The requested independent Codex reviewer could not be dispatched because
   the active team-agent limit was reached; this report contains the completed
   self-review, and an independent review remains required before C1 relies on
   this baseline.
