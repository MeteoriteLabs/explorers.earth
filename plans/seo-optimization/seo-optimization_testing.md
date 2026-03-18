---
Feature: seo-optimization
Doc type: testing
Status: draft
Created: 2026-03-18
Last updated: 2026-03-18
Updated by: agent
Depends on: seo-optimization_prd.md, seo-optimization_tasks.md
---

# SEO Optimization — Test Plan

## Testing Strategy
Manual verification only. No automated tests for SEO meta tags (brittle, change frequently). Validation uses Google's own tools which are authoritative.

---

## Pre-Deploy Verification (Local Dev)

### V1 — Tunes sitemap and robots.txt (after T1)
- [ ] Open `tunes/public/sitemap.xml` — no `localtunes.com` references
- [ ] Open `tunes/public/robots.txt` — no `localtunes.com`, no JS/CSS blocks
- [ ] Start tunes dev server → visit `http://localhost:5000/robots.txt` → verify content
- [ ] Start tunes dev server → visit `http://localhost:5000/sitemap.xml` → verify XML is valid

### V2 — Explorers sitemap (after T2)
- [ ] Run `node explorers-earth/scripts/generate-static-files.js`
- [ ] Check `explorers-earth/public/sitemap.xml` — no `/example-user` URLs

### V3 — Tunes index.html (after T3)
- [ ] Open `tunes/client/index.html` — no `localtunes.com` references
- [ ] No hardcoded JSON-LD scripts remaining
- [ ] Canonical URL is `https://localtunes.earth`

### V4 — Dynamic sitemap endpoints (after T4, T5)
- [ ] Start tunes dev server
- [ ] `curl http://localhost:5000/sitemap.xml` → returns valid XML with venue playlist URLs
- [ ] `curl http://localhost:5000/api/explorers-sitemap.xml` → returns valid XML with user profile URLs
- [ ] Validate XML: paste into https://www.xml-validation.com/

### V5 — Tunes SEO component (after T8, T9, T10)
- [ ] Start tunes dev server
- [ ] Visit `http://localhost:5000/` → open DevTools → Elements → `<head>`
  - [ ] `<title>` is dynamic (not "Local Tunes" default)
  - [ ] `<meta name="description">` is present
  - [ ] `<meta property="og:title">` is present
  - [ ] `<script type="application/ld+json">` contains Organization schema
  - [ ] FAQ structured data present on landing page
- [ ] Visit `http://localhost:5000/playlist/{some-guestUrl}` → check `<head>`
  - [ ] `<title>` includes venue name
  - [ ] OG tags include venue-specific data
  - [ ] Structured data present
- [ ] Visit `http://localhost:5000/terms` → check `<head>`
  - [ ] `<title>` is "Terms of Service | Local Tunes"
- [ ] Visit `http://localhost:5000/privacy` → check `<head>`
  - [ ] `<title>` is "Privacy Policy | Local Tunes"

### V6 — Explorers GEO gaps (after T11)
- [ ] Start explorers-earth dev server
- [ ] Visit each page (About, Contact, Privacy, Terms, Cookies, ForgotPassword)
- [ ] Check DevTools `<head>` for `<meta name="ai:page-type">` tag (indicates GEO is enabled)

### V7 — Breadcrumb schema (after T12)
- [ ] Visit `http://localhost:5173/{username}` → check JSON-LD for BreadcrumbList
- [ ] Visit `http://localhost:5173/{username}/places` → check breadcrumbs include Profile
- [ ] Visit place detail page → check breadcrumbs include Profile → Places

---

## Post-Deploy Verification (Production)

### V8 — Sitemap accessibility
- [ ] `curl -s https://explorers.earth/sitemap.xml | head -20` → valid XML, real user URLs
- [ ] `curl -s https://localtunes.earth/sitemap.xml | head -20` → valid XML, venue URLs
- [ ] `curl -s https://explorers.earth/robots.txt` → correct sitemap reference
- [ ] `curl -s https://localtunes.earth/robots.txt` → correct domain, no JS/CSS blocks

### V9 — Google Search Console
- [ ] Submit sitemap for explorers.earth → status: "Success"
- [ ] Submit sitemap for localtunes.earth → status: "Success"
- [ ] URL Inspection: `https://explorers.earth/` → "URL is on Google" or "URL can be indexed"
- [ ] URL Inspection: `https://localtunes.earth/` → "URL is on Google" or "URL can be indexed"
- [ ] URL Inspection: one public user profile → renders correctly
- [ ] URL Inspection: one guest playlist page → renders correctly

### V10 — Google Rich Results Test
- [ ] Test `https://explorers.earth/` → detects Organization schema
- [ ] Test `https://localtunes.earth/` → detects FAQ schema
- [ ] Test a public user profile → detects structured data
- [ ] Test a guest playlist page → detects structured data

### V11 — Ongoing monitoring (first month)
- [ ] Check GSC Pages report weekly for new crawl errors
- [ ] Watch for "Discovered but not indexed" trend
- [ ] Check Enhancements tab for structured data issues
- [ ] Verify search impressions appear in Performance report
