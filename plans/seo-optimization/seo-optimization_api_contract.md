---
Feature: seo-optimization
Doc type: api_contract
Status: draft
Created: 2026-03-18
Last updated: 2026-03-18
Updated by: agent
Depends on: seo-optimization_prd.md, seo-optimization_schema.md
---

# SEO Optimization — API Contract

## Modified Endpoints

### GET /sitemap.xml (tunes)
**File:** `tunes/server/seo-routes.ts`
**Auth:** None (public)
**Change:** Enhanced from static DB-stored XML to dynamic generation.

**Current behavior:** Returns `sitemapXml` from `seo_settings` table, or empty default.

**New behavior:**
1. Query `users` table for all rows where `guestUrl IS NOT NULL`
2. Generate XML with:
   - Static pages: `/`, `/auth`, `/terms`, `/privacy`, `/features/venues`, `/features/guest-experience`, `/features/karaoke`, `/features/silent-parties`
   - Dynamic pages: `/playlist/{guestUrl}` for each venue
3. Cache response for 1 hour
4. If query fails, fall back to DB-stored `sitemapXml`

**Response:**
```
Content-Type: application/xml
Cache-Control: public, max-age=3600
```

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://localtunes.earth/</loc>
    <lastmod>2026-03-18</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <!-- ... static pages ... -->
  <url>
    <loc>https://localtunes.earth/playlist/abc123</loc>
    <lastmod>2026-03-18</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <!-- ... dynamic venue pages ... -->
</urlset>
```

**Error handling:** On DB error, returns fallback XML from `seo_settings.sitemapXml`. If that's also empty, returns minimal XML with homepage only.

---

## New Endpoints

### GET /api/explorers-sitemap.xml (tunes)
**File:** `tunes/server/seo-routes.ts`
**Auth:** None (public)
**Purpose:** Serves the dynamic sitemap for explorers.earth, proxied via Nginx.

**Behavior:**
1. Query Strapi GraphQL for all accounts where `public_profile: true`
   ```graphql
   query {
     accounts(filters: { public_profile: { eq: true } }, pagination: { limit: 1000 }) {
       username
       updatedAt
     }
   }
   ```
2. Generate XML with:
   - Static pages: `/`, `/contact`, `/privacy`, `/terms`, `/cookies`, `/login`, `/register`
   - Dynamic pages: `/{username}` and `/{username}/places` for each public user
3. Cache response for 1 hour
4. Base URL: `https://explorers.earth`

**Response:**
```
Content-Type: application/xml
Cache-Control: public, max-age=3600
```

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://explorers.earth/</loc>
    <lastmod>2026-03-18</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <!-- ... static pages ... -->
  <url>
    <loc>https://explorers.earth/john-doe</loc>
    <lastmod>2026-03-15</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://explorers.earth/john-doe/places</loc>
    <lastmod>2026-03-15</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <!-- ... more users ... -->
</urlset>
```

**Error handling:** On Strapi error, returns static-only sitemap (no dynamic user URLs). Logs warning.

**Env vars used:** `STRAPI_URL`, `STRAPI_ACCESS_TOKEN` (already in docker-compose).

---

## Nginx Proxy Configuration

### explorers-earth/nginx.conf — new location block

```nginx
# Dynamic sitemap served by tunes backend
location = /sitemap.xml {
    proxy_pass http://tunes-app:5000/api/explorers-sitemap.xml;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_cache_valid 200 1h;
}
```

**Placement:** Before the `location /` SPA fallback block.
**DNS resolution:** `tunes-app` resolves via Docker internal DNS (both containers on `proxy` network).

---

## No Changes to Existing Endpoints

- `GET /api/seo` — unchanged
- `PUT /api/seo` — unchanged
- `GET /robots.txt` — unchanged (already dynamic from DB)
