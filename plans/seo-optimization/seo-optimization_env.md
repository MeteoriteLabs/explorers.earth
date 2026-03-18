---
Feature: seo-optimization
Doc type: env
Status: draft
Created: 2026-03-18
Last updated: 2026-03-18
Updated by: agent
Depends on: seo-optimization_api_contract.md
---

# SEO Optimization — Environment Variables

## No New Environment Variables Required

All required env vars already exist in the docker-compose.yml and are available to the tunes container.

## Existing Env Vars Used by New Code

### Tunes dynamic sitemap (T4)
| Variable | Source | Purpose |
|----------|--------|---------|
| `DATABASE_URL` | docker-compose.yml | Query `users` table for guest URLs |

Already used by the tunes app for all DB operations.

### Explorers dynamic sitemap via tunes (T5)
| Variable | Source | Purpose |
|----------|--------|---------|
| `STRAPI_URL` | docker-compose.yml | Strapi GraphQL endpoint base URL |
| `STRAPI_ACCESS_TOKEN` | docker-compose.yml | Auth token for Strapi API queries |

Already used by `tunes/server/services/strapi-service.ts` for Strapi CMS sync.

**Note:** Verify that `STRAPI_ACCESS_TOKEN` has read access to the `accounts` collection. The existing strapi-service.ts already queries Strapi, so permissions should be in place.

### Nginx proxy (T6)
No env vars needed. Uses Docker internal DNS (`tunes-app:5000`) which resolves via the shared `proxy` network.

## Env Var Checklist for Production Deploy
- [ ] `STRAPI_URL` is set and accessible from the tunes container
- [ ] `STRAPI_ACCESS_TOKEN` has read access to `accounts` collection
- [ ] `DATABASE_URL` is set (already required for tunes to function)
- [ ] No new secrets to add to CI/CD
