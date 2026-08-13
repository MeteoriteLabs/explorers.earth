# Music identity implementation playbook

Decision A: after verified Explorer authentication and completed Account
selection/onboarding, provision person-owned Music state keyed by immutable
Account context. Every eligible Explorer receives core personal Music; venue
and premium features remain separately entitlement-gated.

## Safe golden path

```text
nvm use
npm ci
npm run music:bootstrap
npm run music:doctor
npm run music:up -- --detach --wait
npm run music:test:smoke
npm run music:down
```

Run with `--format json` when collecting evidence. The target is ten minutes
cold and five minutes warm on Windows and Ubuntu; record actual timing in the
run artifact. Use only `docker-compose.music-test.yml`, project
`explorers-music-fixture`, PostgreSQL 15, deterministic fixture Strapi and the
generated disposable `.env.music.test`. The isolated topology exposes fake
Strapi on `127.0.0.1:51337`, the Tunes contract harness on `127.0.0.1:55000`,
and the Explorers contract harness on `127.0.0.1:55173`; health dependencies
gate each service. `music:test:smoke` verifies health, current-user and Account
responses, the Tunes person/Account projection, and Explorers readiness.

## Safety sequence

1. Run `music:doctor`; it checks Node >=22.12, npm/Compose availability,
   required files, typed/ranged control values, fixture version and gates, free
   ports/disk, and the exact disposable `DATABASE_URL_TEST` target. The same
   typed schema is invoked by Tunes startup whenever `MUSIC_MODE` is enabled.
2. Never call live Strapi without `--mode live`, a separate read-only
   credential, and TK's identity-owner endpoint review.
3. Preserve fixture volumes by default. Use `music:down -- --volumes
   --confirm-project explorers-music-fixture` only for the labeled project.
4. Before C12 production mutation, obtain TK's separate explicit approval and
   a signed preflight. A local empty database is not proof.
5. `music:db:migrate` is deliberately disabled until reviewed versioned
   migrations are introduced in C3; schema push is not a migration substitute.

## Incident recovery

Use the final JSON `checkpoint` artifact to resume only the same commit,
fixture version, gate values and environment fingerprint. On interruption use
`music:down`, retain volumes, inspect the checkpoint, then restart `doctor`.
Disable provisioning using `MUSIC_PROVISIONING_KILL_SWITCH=true`; reconciliation
remains disabled until an explicit cohort and row ceiling are approved.
