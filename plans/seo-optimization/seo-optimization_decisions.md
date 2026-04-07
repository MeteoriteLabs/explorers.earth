---
Feature: seo-optimization
Doc type: decisions
Status: draft
Created: 2026-03-18
Last updated: 2026-03-18
Updated by: agent
Depends on: none
---

# SEO Optimization — Decisions Log

## DEC-1: Verification Method — DNS (already done)
**Decision:** Use DNS TXT record verification for Google Search Console.
**Context:** Both properties (explorers.earth, localtunes.earth) were already verified via DNS before this work began.
**Consequence:** No HTML file or meta tag verification needed. Most robust method — survives domain transfers and hosting changes.

## DEC-2: Dynamic Sitemap via Tunes Backend (not build-time)
**Decision:** Serve dynamic sitemaps from the tunes Express backend for BOTH apps, rather than generating at build time.
**Context:** explorers-earth is a static Nginx SPA with no backend. Build-time generation would mean new users don't appear in the sitemap until the next deploy. The tunes backend already has access to both databases (PostgreSQL for tunes data, Strapi via env vars for explorers data).
**Alternatives considered:**
- Build-time generation in `generate-static-files.js` — rejected: stale between deploys
- Netlify serverless function — rejected: Netlify is QA only, not production
- Strapi endpoint + redirect — rejected: adds Strapi as a production dependency for sitemap serving
**Consequence:** Tunes server gets two new routes. Nginx config needs a proxy rule. Sitemap is always current.

## DEC-3: Nginx Proxy for Explorers Sitemap
**Decision:** Add a `location = /sitemap.xml` block in explorers-earth's nginx.conf that proxies to tunes backend at `http://tunes-app:5000/api/explorers-sitemap.xml`.
**Context:** Google crawls `https://explorers.earth/sitemap.xml`. The response needs to come from the explorers.earth domain. Since the Nginx container and tunes container share the `proxy` Docker network, internal DNS resolution works.
**Consequence:** Nginx config change required. Must be placed before the SPA fallback `location /` block.

## DEC-4: react-helmet-async for Tunes
**Decision:** Use `react-helmet-async` for dynamic meta tag management in tunes, matching explorers-earth's approach.
**Context:** Tunes currently has zero dynamic meta tags — everything is hardcoded in index.html. react-helmet-async is the standard for React SPAs, already proven in the explorers-earth codebase.
**Alternatives considered:**
- Manual `document.head` manipulation — rejected: fragile, no SSR compatibility if needed later
- next-seo — rejected: Next.js specific
- No dynamic meta (keep static) — rejected: guest playlist pages need unique meta per venue
**Consequence:** New dependency added to tunes. HelmetProvider wraps app root.

## DEC-5: Production Domain is localtunes.earth (not .com)
**Decision:** All SEO references use `localtunes.earth` as the canonical domain.
**Context:** Docker-compose and Traefik route to `localtunes.earth`. The current sitemap/robots.txt/index.html all incorrectly reference `localtunes.com`. This is a critical fix.
**Consequence:** All domain references in tunes static files and meta tags must be updated.

## DEC-6: Remove Hardcoded Fake Ratings from Tunes
**Decision:** Remove the hardcoded AggregateRating (4.8 stars, 95 reviews) from tunes index.html.
**Context:** These ratings are fabricated. Google's Rich Results guidelines explicitly prohibit fake structured data. If detected, it could trigger a manual action penalty in GSC.
**Consequence:** No AggregateRating schema until real rating data exists.

## DEC-7: Unblock JS/CSS in Tunes robots.txt
**Decision:** Remove `Disallow: /*.js$` and `Disallow: /*.css$` from tunes robots.txt.
**Context:** Google's renderer needs JS and CSS to render SPAs. Blocking these causes "Page is not mobile-friendly" errors and prevents proper indexing. Google has explicitly recommended against blocking these since 2014.
**Consequence:** Google can now fully render tunes pages.

## DEC-8: GEO Helpers Architecture for Tunes
**Decision:** Create a separate `geoHelpers.ts` for tunes (not share from explorers-earth).
**Context:** The two apps have different page types and data models. Tunes needs venue/playlist-focused generators while explorers needs profile/place generators. Sharing would create unnecessary coupling between independent apps.
**Consequence:** Some structural patterns are duplicated, but each app's GEO data is tailored to its domain.

## DEC-9: Ship All at Once
**Decision:** Deploy all SEO changes in a single release.
**Context:** The changes are interdependent (e.g., Nginx proxy needs the tunes endpoint). Phasing would mean partial/broken SEO between deploys.
**Consequence:** Larger diff to review, but cleaner deployment.

## DEC-10: Manual Testing Only (No Automated SEO Tests)
**Decision:** Verify via GSC, Google Rich Results Test, and browser DevTools. No unit tests for SEO meta tags.
**Context:** SEO meta tags change frequently and testing them is brittle. The real validation is whether Google can parse them, which is best tested with Google's own tools.
**Consequence:** No test files to maintain. Verification is manual but authoritative.
