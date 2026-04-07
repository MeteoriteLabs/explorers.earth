---
Feature: seo-optimization
Doc type: schema
Status: draft
Created: 2026-03-18
Last updated: 2026-03-18
Updated by: agent
Depends on: seo-optimization_prd.md
---

# SEO Optimization — Schema / Data Model

## No New Tables Required

This feature reuses existing database infrastructure. No migrations needed.

## Existing Tables Used

### tunes: `seo_settings` (shared/schema.ts)
```
id              serial PK
siteTitle       text
metaDescription text
metaKeywords    text
ogTitle         text
ogDescription   text
ogImage         text
twitterTitle    text
twitterDescription text
twitterImage    text
googleAnalyticsId  text
facebookPixelId    text
googleTagManagerId text
microsoftClarityId text
robotsTxt       text      ← stores custom robots.txt content
sitemapXml      text      ← stores custom sitemap XML (fallback only)
isActive        boolean
updatedAt       timestamp
updatedBy       text
```

**Usage in this feature:** The dynamic sitemap endpoint (T4) falls back to `sitemapXml` if the dynamic query fails. The `robotsTxt` field continues to be served by the existing `GET /robots.txt` route.

### tunes: `users` (shared/schema.ts)
```
id              serial PK
username        text (unique)
guestUrl        text         ← public playlist URL slug
displayName     text
venueName       text
...
```

**Usage in this feature:** The dynamic tunes sitemap (T4) queries for all users with non-null `guestUrl` to generate `/playlist/:guestUrl` entries.

### Strapi: `accounts` (external, accessed via GraphQL)
```
Account_Name    text
username        text         ← public URL slug
public_profile  boolean      ← whether profile is public
profile_picture media
...
```

**Usage in this feature:** The dynamic explorers sitemap (T5) queries Strapi for all accounts where `public_profile: true` to generate `/{username}` and `/{username}/places` entries.

## Data Flow

```
Google crawls explorers.earth/sitemap.xml
  → Nginx proxies to tunes-app:5000/api/explorers-sitemap.xml
    → Tunes server queries Strapi GraphQL for public accounts
    → Returns XML with user profile URLs

Google crawls localtunes.earth/sitemap.xml
  → Tunes server queries PostgreSQL users table for guestUrls
  → Returns XML with guest playlist URLs
```

## Caching Strategy

Both sitemap endpoints cache responses in memory for **1 hour** to avoid hitting the database/Strapi on every crawler request. Cache is invalidated on server restart.
