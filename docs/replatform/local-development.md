# Disposable local platform environment

Ticket 1.2 runs the current Explorers client and Tunes API against disposable local fixtures. It does not use hosted application data, production credentials, or a real provider account. The canonical account, profile, and content tables and acceptance personas are owned by Epics 2–3; the current acceptance seed creates only the existing Music fixture identity. Do not treat it as a completed cross-domain acceptance dataset.

## Prerequisites

- Node.js 22.12 or newer, npm, Git, and Docker with Compose v2. Docker Desktop is supported on Windows; a local Docker socket is required on Linux/macOS. Remote Docker contexts and inherited database/test-authority variables are refused.
- Install the checked-in package locks with `npm ci` at the root and `npm ci --prefix tunes` and `npm ci --prefix explorers-earth`. Docker builds the fixture API and web gateway images on first provision.
- Keep loopback port 51434 available for PostgreSQL's declared binding, 51474 for the gateway, and 5175 for Vite. On Windows, check `netsh interface ipv4 show excludedportrange protocol=tcp` if Docker reports a port allocation failure. No hosted provider secret is needed.

## Commands

Run from the repository root:

```text
npm run platform:local -- provision
npm run platform:local -- check
npm run platform:seed -- --dataset acceptance
npm run platform:seed -- --dataset acceptance
npm run platform:test:integration
npm run platform:local -- start
```

`provision` creates the exact `explorers-replatform-local` Compose project and `music_fixture` PostgreSQL 15 database, runs migrations, then starts the private API and the fixed-upstream web gateway. It records the container ID and source commit in ignored `.replatform-local/authority.json`. The generated fixture secret files and receipt stay in that directory and are never printed. A complete, regular-file secret inventory can be reused after an interrupted provision; partial, linked, unexpected, or mismatched state is refused.

`check` validates the receipt, live container identity and labels, loopback binding, private network, PostgreSQL version, and migration count. `platform:test:integration` requires this check before it runs the existing disposable Music UAT database harness; that harness still creates isolated databases for its tests. `seed` upserts the current fixture Music identity and verifies its one-row stable ID, so rerunning it does not multiply that identity.

`start` ensures the API and gateway are healthy, then starts the existing Explorers Vite app at `http://127.0.0.1:5175` in the foreground. Stop Vite with Ctrl+C. The gateway is at `http://127.0.0.1:51474`; Vite forwards application requests only to that loopback gateway. The gateway has fixed internal upstreams and no arbitrary URL forwarding. PostgreSQL, Tunes, and Strapi are attached only to the internal Docker network, which denies their direct hosted egress. Browser requests are also confined by the local Vite CSP and existing E2E hosted-egress guard. The static gateway can serve the fixture web build at port 51474 without Vite.

`npm run platform:local -- stop` stops the owned containers and retains local volumes and receipt. `provision` or `start` can restart them. `npm run platform:local -- reset` removes only the exact attested Compose project and its volumes after checking the recorded container and resource ownership. Reset writes a local intent so a following `provision` can reuse complete interrupted fixture secrets. A source commit change invalidates `check`, `start`, and `seed`; `reset` still accepts the exact recorded authority so you can reprovision from the new revision. Never repoint this wrapper to a QA or production database.

The fixture-mode API preserves the current native route graph, including optional auth, analytics, lifecycle, and Music integrations; external provider calls are contained by the private network. Canonical profile/content routes, the account/persona seed manifest, and the dedicated real-API browser harness remain pending their owning tickets. Real provider smoke runs require a separately selected nonproduction configuration.
