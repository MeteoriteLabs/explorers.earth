---
Feature: seo-optimization
Doc type: architecture
Status: draft
Created: 2026-03-18
Last updated: 2026-03-18
Updated by: agent
Depends on: seo-optimization_prd.md, seo-optimization_decisions.md
---

# SEO Optimization — Architecture

## Dynamic Sitemap Architecture

```
                    ┌─────────────────────────────────────────┐
                    │            Google Crawler                 │
                    └──────┬──────────────────┬────────────────┘
                           │                  │
                    crawls /sitemap.xml  crawls /sitemap.xml
                           │                  │
                    ┌──────▼──────┐    ┌──────▼──────┐
                    │ explorers   │    │ localtunes  │
                    │   .earth    │    │   .earth    │
                    │  (Nginx)    │    │  (Express)  │
                    └──────┬──────┘    └──────┬──────┘
                           │                  │
               nginx proxy_pass          direct route
                           │                  │
                    ┌──────▼──────────────────▼──────┐
                    │       Tunes Express Server      │
                    │                                  │
                    │  GET /api/explorers-sitemap.xml  │
                    │  GET /sitemap.xml                │
                    └──────┬──────────────────┬───────┘
                           │                  │
                    queries Strapi       queries PostgreSQL
                    (GraphQL)            (Drizzle ORM)
                           │                  │
                    ┌──────▼──────┐    ┌──────▼──────┐
                    │   Strapi    │    │  PostgreSQL  │
                    │   CMS       │    │   (tunes)    │
                    │  accounts   │    │   users      │
                    └─────────────┘    └──────────────┘
```

## Tunes GEO/SEO Component Architecture

```
                    ┌───────────────────────────┐
                    │     Page Component         │
                    │  (landing, playlist, etc)  │
                    └──────────┬────────────────┘
                               │ passes props
                    ┌──────────▼────────────────┐
                    │     <SEO> Component         │
                    │  (react-helmet-async)       │
                    │                             │
                    │  - <title>                  │
                    │  - <meta> tags              │
                    │  - OG / Twitter tags        │
                    │  - Canonical URL            │
                    │  - JSON-LD structured data  │
                    │  - AI meta tags (if GEO)    │
                    └──────────┬────────────────┘
                               │ uses
                    ┌──────────▼────────────────┐
                    │     GEO Helpers             │
                    │  (geoHelpers.ts)            │
                    │                             │
                    │  createVenueGEOData()       │
                    │  createLandingGEOData()     │
                    │  createWebPageGEOData()     │
                    └───────────────────────────┘
```

## Pattern: Mirrors Explorers-Earth

The tunes SEO system mirrors the proven pattern from explorers-earth:

| Component | explorers-earth | tunes (new) |
|-----------|----------------|-------------|
| Meta tag lib | react-helmet-async | react-helmet-async |
| SEO component | `src/components/SEO.tsx` | `client/src/components/SEO.tsx` |
| GEO helpers | `src/utils/geoHelpers.ts` | `client/src/utils/geoHelpers.ts` |
| GEO types | `src/types/geoTypes.ts` | `client/src/types/geoTypes.ts` |
| Provider | `<HelmetProvider>` in main.tsx | `<HelmetProvider>` in main.tsx |

The tunes version is simplified (fewer page types, fewer GEO generators) but follows the same props interface and rendering pattern.

## Nginx Proxy Pattern

```nginx
# NEW: Dynamic sitemap (proxied to tunes backend)
location = /sitemap.xml {
    proxy_pass http://tunes-app:5000/api/explorers-sitemap.xml;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

# EXISTING: Static assets (unchanged)
location ~* \.(js|css|png|jpg|...)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    try_files $uri =404;
}

# EXISTING: SPA fallback (unchanged)
location / {
    try_files $uri $uri/ /index.html;
}
```

The `= /sitemap.xml` exact match takes priority over both the regex static asset match and the prefix `/` match.
