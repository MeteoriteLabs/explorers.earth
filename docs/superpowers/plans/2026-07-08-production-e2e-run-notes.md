# Production E2E Run Notes

Date: 2026-07-08
Target: https://explorers.earth

## Product

- Private list: `Travel Gear`
- Private URL: `https://explorers.earth/recommendations/products/fkki9o4apc1zhhe9xr1s3l9u`
- Item created: `QA Travel Bottle`
- Publish status: passed
- Public index: `https://explorers.earth/tandavkrishna/products`
- Canonical public detail: `https://explorers.earth/tandavkrishna/products/ui-seed-travel-gear-55205`
- Public verification: passed; list and item are visible.
- Notes:
  - Product item creation took roughly 30 seconds.
  - Manual publish took roughly 53 seconds.
  - Direct protected-route reload briefly showed `Loading...` before recovering after roughly 37 seconds.
  - No console warnings/errors were captured.

## Apps & Tools

- Private list: `Daily Workflow`
- Private URL: `https://explorers.earth/recommendations/apps/os93sy6wssd8qpv0cmefnvls`
- Item created: `The AI workspace that works for you. | Notion`
- Publish status: passed
- Public index: `https://explorers.earth/tandavkrishna/apps`
- Public verification: passed; list and item are visible.
- Notes:
  - URL scrape for `https://www.notion.com` succeeded.
  - App item creation took roughly 45 seconds.
  - Manual publish took roughly 60 seconds.
  - Current production did not show the post-add publish prompt; local patch fixes this by passing `justAddedRecommendation`.
  - No console warnings/errors were captured.

## Movies

- Private list: `Mind-Bending Sci-Fi`
- Private URL: `https://explorers.earth/recommendations/movies/abywnyu2b3go37zowxi8bwom`
- Search query: `Interstellar`
- Status: blocked by browser automation control, not by a visible app error.
- Evidence:
  - Movie list page loaded correctly.
  - TMDB search returned visible results including `Interstellar 2014 Movie 8.5`.
  - No console warnings/errors were captured.
  - Playwright locator clicks against the visible result timed out in CDP.
  - The in-app browser wrapper did not expose `mouse` or `keyboard` helpers.
  - The page remained visible and responsive after the failed automation attempts.

## Next

Resume Movies by manually clicking the first `Interstellar` search result in the in-app browser, or switch to a full Playwright harness with normal mouse/keyboard control. After Movies, continue Books, Games, People, and Places with the same checkpoint pattern.

## Infrastructure Investigation

- `explorers.earth` resolves to `157.180.87.241`, geolocated to Hetzner, Helsinki, Finland.
- Local Vite config points `/graphql` and `/api` to `77.42.95.255:1337`, geolocated to Hetzner, Helsinki, Finland.
- `api.explorers.earth` resolves to `89.167.10.255`, geolocated to Hetzner, Gunzenhausen, Germany.
- The commented older AWS IP `13.126.235.177` geolocates to AWS Mumbai / ap-south-1.
- Tiny direct requests from this machine to `77.42.95.255:1337/graphql` take roughly 0.39-0.43s.
- Tiny same-origin requests through `https://explorers.earth/graphql` take roughly 0.56-0.65s.
- Therefore user-to-Helsinki latency is real, but it does not by itself explain 45-60s create/publish waits.
- If Strapi in Helsinki is using RDS in India, the cross-region app-to-database path is the likely multiplier: each backend mutation/refetch can perform many DB operations across a long-distance connection.

## Code Investigation

- `App.tsx` had `ErrorBoundary` commented out; local patch re-enabled it.
- `main.tsx` contains `console.warn = () => {};`, so browser warning capture is artificially muted.
- `ProtectedRoute` blocks private route rendering on an onboarding GraphQL query.
- `AuthSyncManager` can run an additional network-only onboarding/sync query on private routes.
- Product/App add success returned without `justAddedRecommendation` in production; local patch fixes this.
- Product/App create mutations are awaited before navigation; slow create means the awaited backend mutation path is slow, not merely the next page render.
- Product/App publish uses `update*List` plus `refetchQueries` for the full list query.
- Product/App list queries include nested recommendation data with `pagination: { limit: 200 }`.
- Movie create is heavier than Product/App: after selecting a TMDB item it can upload poster, backdrop, and cast images to Strapi/S3 before creating the recommendation, then it waits for list refetch.
