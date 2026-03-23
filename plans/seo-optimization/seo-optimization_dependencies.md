---
Feature: seo-optimization
Doc type: dependencies
Status: draft
Created: 2026-03-18
Last updated: 2026-03-18
Updated by: agent
Depends on: seo-optimization_decisions.md
---

# SEO Optimization — Dependencies

## New Dependencies

### react-helmet-async (tunes only)
- **Package:** `react-helmet-async`
- **Version:** Latest (currently ^2.0.5)
- **Purpose:** Dynamic `<head>` management for React SPAs. Allows each page to set its own title, meta tags, OG tags, and structured data.
- **Why this library:**
  - Already used in explorers-earth — proven in this codebase
  - Thread-safe (async) — compatible with concurrent rendering
  - Lightweight (~4KB gzipped)
  - Active maintenance, 3M+ weekly downloads
- **Alternatives rejected:**
  - `react-helmet` (original) — deprecated, not async-safe
  - Manual `document.head` manipulation — fragile, no declarative API
  - `next-seo` — Next.js specific
- **Impact:** Adds ~4KB to client bundle. No server-side changes. Requires `<HelmetProvider>` wrapper in app root.
- **Install:** `cd tunes && npm install react-helmet-async`

## No Dependencies Removed

## No Dependencies Changed

## Existing Dependencies Leveraged

| Dependency | App | Already Installed | Used For |
|-----------|-----|-------------------|----------|
| `react-helmet-async` | explorers-earth | Yes | SEO.tsx component |
| `drizzle-orm` | tunes | Yes | Querying users table for sitemap |
| `@neondatabase/serverless` | tunes | Yes | DB connection for sitemap queries |
