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
generated disposable `.env.music.test`.

## Safety sequence

1. Run `music:doctor`; it checks Node >=22.12, npm/Compose availability,
   required files, test environment, and an unsafe `DATABASE_URL` target.
2. Never call live Strapi without `--mode live`, a separate read-only
   credential, and TK's identity-owner endpoint review.
3. Preserve fixture volumes by default. Use `music:down -- --volumes
   --confirm-project explorers-music-fixture` only for the labeled project.
4. Before C12 production mutation, obtain TK's separate explicit approval and
   a signed preflight. A local empty database is not proof.

## Incident recovery

Use the final JSON `checkpoint` artifact to resume only the same commit,
fixture version, gate values and environment fingerprint. On interruption use
`music:down`, retain volumes, inspect the checkpoint, then restart `doctor`.
Disable provisioning using `MUSIC_PROVISIONING_KILL_SWITCH=true`; reconciliation
remains disabled until an explicit cohort and row ceiling are approved.
