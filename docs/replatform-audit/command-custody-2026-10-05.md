# Current command custody

Inspected from integration source on 2026-10-05; no browser or test run is implied.

`package.json` defines `platform:test:e2e` as `node scripts/replatform-e2e.mjs` and `platform:release` as `tsx scripts/platform-release.ts`. The current browser runner is a protected finite delivered-slice runner. It accepts exactly `--milestone delivered-auth-profile-books --ack TASK4_FIXTURE_OWNED_DISPOSABLE_PG15 --receipt <fresh-owned-temp-directory>`. Despite the compatibility name, its current manifest has auth/profile/Books/lifecycle/Movies/Games lanes. Counts and configs are source-bound; the dirty source must be independently reviewed before qualification.

Historical commands using `--suite`, numeric `--milestone 1|2`, `--project desktop-chromium|mobile-chromium`, or `--environment local|qa` **are proposed interfaces, not executable current commands**. `explorers-earth/playwright.replatform.config.ts` does not exist in this inspected tree. Actual category configs include `explorers-earth/e2e/replatform/books.playwright.config.ts`, `lifecycle.playwright.config.ts`, `movies.playwright.config.ts` and `games.playwright.config.ts`, with their specific project names and guarded fixture runners. Do not invoke the hypothetical generic command or weaken the current guard to support it.

Each new category ticket owns its guarded real-backend fixture, exact discovery and browser qualification contract, coordinating manifest registration as a separately reviewed shared edit. Ticket 3.5 owns a QA-specific guarded acceptance interface if needed; ticket 7.3 consumes reviewed category/Music runners rather than requiring one unrestricted generic wrapper. Their original desktop/mobile/local/QA behavior obligations remain mandatory even though the historical CLI spelling is superseded.

An executor's source preflight must record: actual script/config/runner, exact expected discovery, source hashes, supported Node/npm, attested database authority, owned receipt/resource names, environment rejection rules, and first failure. Do not expand CI or perform unchanged full-suite runs to resolve a documentation mismatch.
