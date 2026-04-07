---
Feature: seo-optimization
Doc type: tasks
Status: draft
Created: 2026-03-18
Last updated: 2026-03-18
Updated by: agent
Depends on: seo-optimization_prd.md, seo-optimization_decisions.md
---

# SEO Optimization — Task Breakdown

## Execution Order & Dependencies

```
T1 (tunes sitemap/robots/domain fixes) ─┐
T2 (explorers-earth sitemap cleanup)    ─┤── No dependencies, can parallelize
T3 (tunes index.html fixes)             ─┘
                                          │
T4 (tunes dynamic sitemap endpoint)      ─── Depends on T1 (domain must be correct)
T5 (explorers dynamic sitemap endpoint)  ─── Depends on T4 (same server, similar pattern)
T6 (Nginx proxy for explorers sitemap)   ─── Depends on T5 (endpoint must exist)
                                          │
T7 (install react-helmet-async in tunes) ─── No dependency
T8 (create tunes SEO component)          ─── Depends on T7
T9 (create tunes GEO helpers)            ─── No dependency (pure utility)
T10 (add SEO to tunes pages)             ─── Depends on T8, T9
                                          │
T11 (explorers-earth GEO gap closure)    ─── No dependency (uses existing SEO component)
T12 (add breadcrumb schema to explorers) ─── No dependency (modifies existing SEO.tsx)
T13 (add coordinates to PublicHome)      ─── No dependency
                                          │
D1 (document: gotchas)                   ─── During T1-T13
D2 (document: decisions)                 ─── During T1-T13
D3 (document: runbook)                   ─── After T1-T13
D4 (document: changelog)                 ─── After all tasks complete
                                          │
H1 (submit sitemaps in GSC)              ─── After deploy (user manual step)
H2 (verify in GSC + Rich Results Test)   ─── After H1
```

---

## Tasks

### T1 — Fix tunes static sitemap and robots.txt domain
**Priority:** Critical
**Files to modify:**
- `tunes/public/sitemap.xml`
- `tunes/public/robots.txt`

**Changes:**
- Replace all `localtunes.com` → `localtunes.earth`
- Remove auth-only pages from sitemap (`/dashboard`, `/settings`)
- Update `<lastmod>` dates to `2026-03-18`
- Remove `Disallow: /*.js$` and `Disallow: /*.css$` from robots.txt
- Add `Disallow: /dashboard/` to robots.txt

**Acceptance:** Domain references correct, JS/CSS unblocked, auth pages removed from sitemap.

---

### T2 — Clean up explorers-earth static sitemap
**Priority:** Critical
**Files to modify:**
- `explorers-earth/scripts/generate-static-files.js`

**Changes:**
- Remove fake `/example-user` URLs from the generated sitemap template
- Keep static pages (homepage, contact, privacy, terms, cookies, login, register, forgot-password)
- The script will still generate the static sitemap, but dynamic URLs will come from the new tunes endpoint (T5)

**Acceptance:** No fake URLs in generated sitemap. Static pages remain correct.

---

### T3 — Fix tunes index.html domain and structured data
**Priority:** Critical
**Files to modify:**
- `tunes/client/index.html`

**Changes:**
- Fix canonical URL from `localtunes.com` → `localtunes.earth`
- Fix all OG/Twitter URL references
- Remove hardcoded JSON-LD schemas (WebApplication, Organization) — will be generated dynamically by SEO component (T8)
- Remove hardcoded fake AggregateRating (4.8 stars, 95 reviews)

**Acceptance:** Correct domain in all meta tags. No hardcoded schemas remaining.

---

### T4 — Create dynamic sitemap endpoint for tunes
**Priority:** High
**Files to modify:**
- `tunes/server/seo-routes.ts`

**Changes:**
- Enhance existing `GET /sitemap.xml` route
- Query `users` table for all venues with guest URLs (guestUrl field)
- Generate `<url>` entries for each `/playlist/:guestUrl`
- Include static pages (homepage, terms, privacy, feature pages)
- Cache response for 1 hour (avoid DB hits on every crawl)
- Fall back to DB-stored sitemapXml if query fails

**Acceptance:** `/sitemap.xml` returns valid XML with real venue playlist URLs.

---

### T5 — Create dynamic sitemap endpoint for explorers-earth (on tunes server)
**Priority:** High
**Files to modify:**
- `tunes/server/seo-routes.ts`

**Changes:**
- Add new route: `GET /api/explorers-sitemap.xml`
- Query Strapi GraphQL via existing `STRAPI_URL` + `STRAPI_ACCESS_TOKEN`
- Fetch all accounts with `public_profile: true`
- Generate entries: `/{username}`, `/{username}/places` for each public user
- Include explorers-earth static pages
- Cache response for 1 hour
- Return `Content-Type: application/xml`

**Acceptance:** `/api/explorers-sitemap.xml` returns valid XML with real user profile URLs.

---

### T6 — Add Nginx proxy for explorers-earth sitemap
**Priority:** High
**Files to modify:**
- `explorers-earth/nginx.conf`

**Changes:**
- Add `location = /sitemap.xml` block that proxies to tunes backend
- Use Docker internal DNS: `proxy_pass http://tunes-app:5000/api/explorers-sitemap.xml`
- Set appropriate headers (Content-Type, Cache-Control)
- This must be placed BEFORE the SPA fallback `location /` block

**Acceptance:** `https://explorers.earth/sitemap.xml` returns dynamic sitemap from tunes backend.

---

### T7 — Install react-helmet-async in tunes
**Priority:** High
**Files to modify:**
- `tunes/package.json` (via npm install)
- `tunes/client/src/main.tsx`

**Changes:**
- `npm install react-helmet-async` in tunes directory
- Wrap app root in `<HelmetProvider>` in main.tsx

**Acceptance:** HelmetProvider wrapping app, no console errors.

---

### T8 — Create tunes SEO component
**Priority:** High
**Files to create:**
- `tunes/client/src/components/SEO.tsx`

**Changes:**
- Create SEO component modeled on explorers-earth's `SEO.tsx`
- Simplified for tunes use cases (fewer page types)
- Props: title, description, keywords, canonical, ogImage, type, enableGEO, geoData, breadcrumbs
- Renders: meta tags, OG tags, Twitter Cards, JSON-LD structured data
- AI meta tags when GEO enabled
- Uses `localtunes.earth` as base URL

**Acceptance:** Component renders correct meta tags when used in a page.

---

### T9 — Create tunes GEO helpers
**Priority:** High
**Files to create:**
- `tunes/client/src/utils/geoHelpers.ts`
- `tunes/client/src/types/geoTypes.ts` (copy and adapt from explorers-earth)

**Changes:**
- `createVenueGEOData()` — for guest playlist pages (LocalBusiness + MusicPlaylist schema)
- `createLandingGEOData()` — for landing page (SoftwareApplication schema, FAQ schema)
- `createWebPageGEOData()` — for static pages (terms, privacy)

**Acceptance:** Helpers return valid GEO data objects matching the SEO component's expected interface.

---

### T10 — Add SEO component to tunes pages
**Priority:** High
**Files to modify:**
- `tunes/client/src/pages/landing-page.tsx` — add SEO + FAQ schema from existing FAQ data
- `tunes/client/src/pages/playlist-page.tsx` — add SEO + venue GEO data
- `tunes/client/src/pages/privacy-page.tsx` — add basic SEO
- `tunes/client/src/pages/terms-page.tsx` — add basic SEO

**Acceptance:** Each page renders unique meta tags visible in DevTools. Landing page generates FAQ schema.

---

### T11 — Enable GEO on remaining explorers-earth pages
**Priority:** Medium
**Files to modify:**
- `explorers-earth/src/pages/public/About.tsx`
- `explorers-earth/src/pages/public/Contact.tsx`
- `explorers-earth/src/pages/public/Privacy.tsx`
- `explorers-earth/src/pages/public/Terms.tsx`
- `explorers-earth/src/pages/public/Cookies.tsx`
- `explorers-earth/src/pages/ForgotPassword.tsx`
- Guides pages (if SEO component not already present)

**Changes:**
- Add `<SEO>` component with `enableGEO={true}` and `createWebPageGEOData()`
- Reuse existing helpers from `src/utils/geoHelpers.ts`

**Acceptance:** All public pages have GEO-enabled SEO meta tags.

---

### T12 — Add breadcrumb schema to explorers-earth SEO component
**Priority:** Medium
**Files to modify:**
- `explorers-earth/src/components/SEO.tsx`
- `explorers-earth/src/features/PublicHome/components/PublicProfile.tsx`
- `explorers-earth/src/features/PublicHome/components/PublicHome.tsx`
- `explorers-earth/src/features/PublicHome/components/PlaceDetails/PlaceDetails.tsx`

**Changes:**
- Add optional `breadcrumbs` prop to SEO component: `Array<{name: string, url: string}>`
- Generate `BreadcrumbList` JSON-LD schema when prop is provided
- Add breadcrumbs to public pages: Home → Profile → Places → Place Detail

**Acceptance:** BreadcrumbList schema appears in page source for public hierarchical pages.

---

### T13 — Add coordinates to explorers-earth PublicHome GEO data
**Priority:** Medium
**Files to modify:**
- `explorers-earth/src/features/PublicHome/components/PublicHome.tsx`

**Changes:**
- Extract lat/lng from recommendation place data already available in component state
- Pass coordinates to `createLocationGEOData()` call
- Enhances location-based structured data for "near me" queries

**Acceptance:** GEO data includes coordinates when place data is available.

---

### D1 — Document: gotchas
**Timing:** During T1-T13
**File:** `plans/seo-optimization/seo-optimization_gotchas.md`

---

### D2 — Document: decisions (update)
**Timing:** During T1-T13
**File:** `plans/seo-optimization/seo-optimization_decisions.md`

---

### D3 — Document: runbook
**Timing:** After T1-T13
**File:** `plans/seo-optimization/seo-optimization_runbook.md`

---

### D4 — Document: changelog
**Timing:** After all tasks complete
**File:** `plans/seo-optimization/seo-optimization_changelog.md`

---

### H1 — Submit sitemaps in GSC (user manual step)
**After deploy:**
1. Go to GSC → explorers.earth → Sitemaps → submit `sitemap.xml`
2. Go to GSC → localtunes.earth → Sitemaps → submit `sitemap.xml`

---

### H2 — Verify in GSC + Rich Results Test (user manual step)
**After H1:**
1. URL Inspection on homepages → Request Indexing
2. Rich Results Test on public pages → confirm structured data detected
3. Check Enhancements report for FAQ, Breadcrumbs, etc.
4. Monitor Pages report weekly for first month
