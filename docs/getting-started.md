# Getting Started

## Supported local fixture

The supported integrated Music development path uses Node.js 22.12+, npm, Docker,
and Docker Compose v2. It starts deterministic fixture Strapi, disposable
PostgreSQL 15, the production-built Tunes service, and the production-built
Explorer client. You do not need a local PostgreSQL or Strapi service for this
flow.

From a clean checkout at the repository root:

```text
npm ci
npm run music:bootstrap -- --mode fixture
npm run music:doctor -- --mode fixture
npm run music:up -- --mode fixture --detach --wait
npm run music:test:smoke -- --mode fixture
```

Bootstrap installs the locked Tunes and Explorer dependencies and creates the
guarded, ignored fixture authority. Do not create or export `DATABASE_URL`.
Fixture database commands use only the generated `DATABASE_URL_TEST` for
`music_migrator@127.0.0.1:55432/music_fixture`; application startup applies the
reviewed append-only migration chain rather than synchronizing schema implicitly.
Do not inspect, copy, or commit `.env.music.test` or generated credential files.

## Open and verify the applications

- Explorer fixture: `http://127.0.0.1:55173`
- Tunes fixture and API: `http://127.0.0.1:55000`
- Live API documentation: `http://127.0.0.1:55000/api-docs`
- Deterministic fixture Strapi: `http://127.0.0.1:51337`

Open `http://127.0.0.1:55173/google-auth/callback?access_token=fixture-read-only-token`
to complete the deterministic fixture Google callback, then navigate to
`http://127.0.0.1:55173/recommendations/music`. Explorer loads the fixture's
authenticated identity and selected Account and forwards its proof only to the bodyless
`POST /api/music/identity/ensure` boundary. Tunes projects the canonical identity
and returns a short-lived Music credential; owner routes use only that credential.
The retired native registration journey is not part of embedded Music.

The smoke command verifies readiness across Explorer, Tunes, PostgreSQL, and the
fixture identity boundary. For deeper lanes, follow the
[Music identity testing guide](testing/music-identity-testing.md).

When finished, stop the same isolated fixture lifecycle:

```text
npm run music:down -- --mode fixture
```

`music:down` preserves guarded fixture volumes. Destructive reset requires the
exact disposable target and confirmation tuple documented in the testing guide.
Production mutation is never authorized by these commands; use the
[immutable deployment runbook](operations/music-deploy-runbook.md) for release
policy and evidence requirements.

## Other development and documentation

The two applications also have independent development modes, but they require
their own correctly configured external services and are not a substitute for
the integrated fixture proof above. See [environment variables](environment-variables.md),
[architecture](architecture.md), [contributing](contributing.md), and
[troubleshooting](troubleshooting.md) for those separate concerns.
