---
Feature: seo-optimization
Doc type: gotchas
Status: draft
Created: 2026-03-18
Last updated: 2026-03-18
Updated by: agent
Depends on: none
---

# SEO Optimization — Gotchas

## Known gotchas discovered during planning

### G1: localtunes.com vs localtunes.earth
The codebase has `localtunes.com` in multiple files (sitemap, robots.txt, index.html canonical, OG URLs) but the actual production domain is `localtunes.earth`. Must grep thoroughly to catch all references.

### G2: tunes robots.txt blocks JS/CSS
`Disallow: /*.js$` and `Disallow: /*.css$` prevents Google from rendering the SPA. This is counterintuitive because many old robots.txt guides recommend blocking static assets. Google reversed this guidance in 2014.

### G3: Nginx location block ordering matters
The `location = /sitemap.xml` exact match MUST come before `location /` (SPA fallback). If placed after, the SPA fallback catches it first and returns `index.html` instead of proxying to the sitemap endpoint.

### G4: react-helmet-async is client-side only
When you "View Page Source" in the browser, you'll see the original index.html meta tags. react-helmet-async only updates the DOM after JavaScript executes. Google's crawler can handle this (Googlebot renders JS), but other crawlers (Facebook, Twitter, LinkedIn) may not see dynamic OG tags. This is a known limitation of CSR apps.

### G5: Strapi public access token
The explorers-earth sitemap endpoint on tunes needs to query Strapi. The `STRAPI_ACCESS_TOKEN` in docker-compose is for authenticated access. Verify this token has permission to read `accounts` collection. If not, may need `VITE_PUBLIC_ACCESS_TOKEN` equivalent on the server side.

### G6: Docker DNS for Nginx proxy
`proxy_pass http://tunes-app:5000/...` relies on Docker internal DNS. The container name `tunes-app` (from `container_name: tunes-app` in docker-compose) must match exactly. If the tunes container restarts, Nginx may cache the old IP. Consider adding `resolver 127.0.0.11 valid=30s;` to the Nginx config.

### G7: Hardcoded fake ratings = Google penalty risk
The tunes index.html has `"ratingValue": "4.8", "reviewCount": "95"` with no real reviews. Google's Rich Results guidelines explicitly prohibit fabricated ratings. This could trigger a manual action in GSC. Must remove.

### G8: Sitemap cache invalidation
Both sitemap endpoints cache for 1 hour. New users won't appear for up to 1 hour. This is acceptable for SEO (Google typically crawls sitemaps every few hours to days), but be aware during testing.

---

*This document will be updated during implementation as new gotchas are discovered.*
