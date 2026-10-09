# PR121 integration review — 2026-10-09

Frozen base `46274e061ffb44f5b7ec5bdea84cd57e4748a541`; reviewed head `67260702ecca801d5e10301161ade8fefafcbece`. Local reconciliation preserved in `5161c383` before merge preparation. Three independent read-only reviewers covered auth/Music, frontend/media/removals, and CI/evidence. This review targets integration PR119, not main or production.

## Review disposition

No introduced blocking correctness issue remains in the reviewed diff. The media reviewer withdrew an initial P2 after checking canonical-only launch/no-data-migration scope: opt-in legacy Strapi Places images intentionally fall back because raw storage URLs bypass visibility. Corrected misleading resolver comment; no behavior changed. **Release gate:** canonical public-profile composition is mandatory for launch; disable the legacy public-profile gateway. Future support for legacy saved attachments requires authorized normalization before enabling it.

Auth review confirms Actor-derived session bindings propagate through socket tickets/rechecks. Remaining qualification: actual connected browser sign-out, older unbound credential compatibility, held terminal completions and numeric retirement proof, already assigned by re-grooming. No new whole-ticket closure follows from this review.

## Evidence inspected

- Exact pending CI run [37893101451](https://github.com/tandavkrishna27/explorers.earth/actions/runs/37893101451), source `67260702`: database43 passed/5 skipped files,657 passed/7 skipped tests. Applicable jobs succeed except known route-fixture/music-required failure; load-chaos intentionally skipped.
- Local7.3 receipt names historical `03cfede6`; its cited backend CI substitute names `c3c6c896`. Neither is exact candidate evidence.
- Google receipt narrates actual local first consent at `f16b6202`, empty→one account/session, stopping at onboarding. Raw observations are not independently available in committed artifacts; no hosted/full-onboarding/recovery claim.

## Local combined-tree checks

Before merge commit, on the prepared merge overlay over `5161c383` incorporating frozen PR121:

- Frontend contained Vitest: canonicalMedia, canonicalMediaCallers, PublicHome.place-image, retiredApolloDocumentSurface —4 files/62 tests pass,0 skips.
- Backend Vitest: music-principal, music-critical-identity-coverage, music-critical-gateway-coverage —3 files/78 tests pass,0 skips.
- Frontend `npx tsc -b --pretty false` exits0.

These are bounded merge checks, not full database/browser qualification. Local Node is24.14.0; frontend package pins24.21.0, so exact hosted pinned-runtime checks remain authoritative. No new dependencies, database, provider traffic, hosted rerun or deployment was allocated.

Only two documentation conflicts occurred: HANDOFF and remaining-work-sequence. Resolution retains incoming full body plus local authoritative reconciliation notice. Other reconciliation annotations merge automatically. Existing incoming EOF whitespace is cosmetic, not a failed behavior check.

After push, inspect checks against the resulting integration SHA. Preserve known-red route decision; an unrelated failure requires diagnosis. Do not claim hosted acceptance from this prepared overlay.
