# CI and baseline execution inventory

Source revision `79ef17d0b88c7e11b49d618fc7c888a513f29fa8`; read-only settings inspection on 2026-09-30. This records current authority, not a green baseline. [Ticket 1.3](../replatform-audit/tickets/ticket-1-3.md) owns trigger changes and required-check configuration.

## GitHub required checks

Authenticated read-only `gh api repos/MeteoriteLabs/explorers.earth/branches/main/protection` returned `required_status_checks: null` and `enforce_admins.enabled: false`. The dedicated `.../protection/required_status_checks` endpoint returned HTTP 404, “Required status checks not enabled.” `gh api repos/MeteoriteLabs/explorers.earth/rulesets` returned an empty array. Thus **there are no exact required check names currently configured for main** in these settings. Workflow job names below are source inventory, not enforced check names. Re-read settings after 1.3 configures rules and records an actual PR run.

## Existing lanes and deferred run record

| Lane | Current source / command | Authority and interpretation | 1.1 result |
|---|---|---|---|
| Frontend unit/type/lint/build | `explorers-earth/package.json`: `npm run test:unit`, `npx tsc -b`, `npm run lint`, `npm run build` | Vitest containment; build includes static generation and needs network/config audit | Not run; no safe baseline claim |
| Existing browser smoke | `explorers-earth/playwright.config.ts`: `npx playwright test <spec> --project=chromium-pr-safe` | Config starts local Vite but specs can mock/intercept; default all-project run overlaps fixture/live selections | Not run; select bounded specs after 1.2 |
| Public Music read-only | root `music:test:public-fast`, `music:test:public-pr`, `music:fixture:public:verify` | Mocked/PR-safe and harness verification; not a real replacement API result | Not run |
| Music real fixture | Root `music:test:pr -- --mode fixture`; live public E2E has separate exact authority in `docs/testing.md` | Requires disposable PG15/Strapi fixture and attested reset; no ambient hosted target | Deferred to 1.2; no live writes authorized here |
| Full performance/recovery | Music nightly/load/chaos and recovery drills | Separate milestone/operations lanes; do not substitute for PR smoke | Deferred |

`docs/testing.md` documents existing commands and the fixture authority contract. `explorers-earth/playwright.config.ts` uses one worker, two CI retries, traces retained on failure and screenshots only on failure. `chromium-pr-safe` matches all `.spec.ts` files while Music fixture/live and visual project patterns overlap; a bare `playwright test` cannot be reported as a bounded lane. Existing `explorers-earth/e2e/{books,movies,games,apps,products,people,locations,guides,analytics,account-lifecycle,category-navigation,music*}.spec.ts` are coverage seeds, often mocked, and need real route-graph replacement checks as their owning tickets land.

The source workflows are `.github/workflows/ci.yml`, `explorers.yml`, `tunes.yml`, `tunes-deploy.yml`, `test.yml`, `music-reconcile.yml` and `tunes-test-direct-deploy.yml`. The parent epic documents that `explorers.yml` can deploy after successful main CI or manual dispatch and Tunes deployment has main/`GATE_PROD`/environment gates. These are reasons Ticket 1.3 must verify trigger and ref combinations **before any push**. The temporary direct-deploy workflow was already expired at the audit date and is not a QA path.

## Baseline execution gate

After 1.2 provisions the safe environment, record each command, source SHA, fixture version, exact exit status, test counts, retries, trace links, desktop/mobile captures and pre-existing failures in `evidence/`. Run bounded suites; use real-API fixture browser runs only after local route parity and egress containment pass. Do not mark a matrix scenario passed from a mocked test, an old snapshot, a workflow definition or a skipped project. Final Ticket 1.1 baseline remains **open** until those records exist.
