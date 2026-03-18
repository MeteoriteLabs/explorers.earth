---
Feature: seo-optimization
Doc type: runbook
Status: draft
Created: 2026-03-18
Last updated: 2026-03-18
Updated by: agent
Depends on: seo-optimization_tasks.md, seo-optimization_api_contract.md
---

# SEO Optimization — Runbook

## How to Debug

### Sitemap not loading on explorers.earth
1. Check Nginx proxy: `docker exec explorers-app nginx -t`
2. Check tunes is reachable: `docker exec explorers-app curl -s http://tunes-app:5000/api/explorers-sitemap.xml | head -5`
3. Check tunes logs: `docker logs tunes-app --tail 50 | grep sitemap`
4. If Nginx can't resolve `tunes-app`: both containers must be on the `proxy` network

### Sitemap not loading on localtunes.earth
1. Check tunes server logs: `docker logs tunes-app --tail 50 | grep sitemap`
2. Test directly: `curl -s https://localtunes.earth/sitemap.xml | head -20`
3. Check DB connection: the sitemap route queries `users` table
4. Check fallback: if DB query fails, should fall back to `seo_settings.sitemapXml`

### Strapi query failing for explorers sitemap
1. Check env vars: `docker exec tunes-app env | grep STRAPI`
2. Test Strapi access: `docker exec tunes-app curl -s $STRAPI_URL/graphql -X POST -H "Authorization: Bearer $STRAPI_ACCESS_TOKEN" -H "Content-Type: application/json" -d '{"query": "{ accounts(pagination: { limit: 1 }) { username } }"}'`
3. If Strapi is down: endpoint returns static-only sitemap (graceful degradation)

### Meta tags not updating on tunes pages
1. View page source (not DevTools Elements) to see server-sent HTML
2. Note: react-helmet-async updates `<head>` client-side. View source will show default tags. DevTools Elements shows the final state after JS execution.
3. Check console for Helmet errors
4. Verify HelmetProvider wraps the app in `main.tsx`

### Structured data not detected by Google
1. Test with Rich Results Test: https://search.google.com/test/rich-results
2. Check JSON-LD syntax: paste into https://validator.schema.org/
3. Common issues: missing required fields, incorrect `@type`, malformed JSON
4. Note: Google may take days to weeks to process new structured data

## How to Roll Back

### Quick rollback (revert domain fixes)
```bash
git revert HEAD  # or specific commit hash
# Rebuild and redeploy
```

### Partial rollback (disable dynamic sitemap only)
1. In `tunes/server/seo-routes.ts`: comment out the dynamic generation, restore DB-only fallback
2. In `explorers-earth/nginx.conf`: remove the `location = /sitemap.xml` proxy block
3. The static `public/sitemap.xml` files will be served instead

### Disable tunes SEO component
1. Remove `<SEO>` component usage from affected pages
2. Restore hardcoded meta tags in `tunes/client/index.html` if needed
3. No DB changes to revert

## How to Monitor

### Google Search Console (primary)
- **Pages report**: Check weekly for crawl errors, "Discovered but not indexed"
- **Performance report**: Watch for impressions and click trends
- **Enhancements**: Check for structured data issues (FAQ, Breadcrumbs)
- **Sitemaps**: Verify status remains "Success" after each sitemap update

### Server-side
- Tunes server logs: watch for sitemap generation errors
- Nginx access logs: confirm Google crawlers hitting `/sitemap.xml`
- Strapi availability: if Strapi goes down, explorers sitemap degrades to static-only

### Key metrics to watch
- Number of indexed pages (should increase over weeks)
- Crawl errors (should decrease immediately after fixing domain/robots)
- Search impressions (lagging indicator, takes weeks)
- Structured data valid items (Enhancements tab)
