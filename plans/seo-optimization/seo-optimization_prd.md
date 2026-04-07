---
Feature: seo-optimization
Doc type: prd
Status: draft
Created: 2026-03-18
Last updated: 2026-03-18
Updated by: agent
Depends on: none
---

# SEO Optimization — Product Requirements Document

## Goal
Make both apps (explorers.earth and localtunes.earth) properly discoverable by Google Search. Fix broken crawling infrastructure, add dynamic sitemaps with real content URLs, and implement GEO/AEO structured data across all public pages.

## Problem
1. **Tunes references wrong domain** — sitemap, robots.txt, and canonical URL all point to `localtunes.com` instead of `localtunes.earth`. Google is being directed to a non-existent site.
2. **Tunes blocks JS/CSS** — robots.txt prevents Google from rendering the SPA, causing indexing failures.
3. **Explorers sitemap has fake URLs** — `/example-user` entries cause 404 crawl errors in GSC.
4. **No dynamic sitemaps** — public user profiles (explorers) and guest playlist pages (tunes) aren't discoverable via sitemap.
5. **Tunes has no dynamic SEO** — all meta tags are hardcoded in index.html. Every page shows the same title/description/OG tags.
6. **Tunes has fake ratings** — hardcoded AggregateRating violates Google's guidelines.
7. **Explorers has GEO gaps** — 13 pages lack GEO optimization that's available but unused.

## Who Benefits
- **End users** — their public profiles and shared playlists become findable via Google Search
- **Venue owners** — their guest playlist pages can appear in local search results
- **Product** — organic traffic channel is currently broken; this unblocks it

## Scope

### In Scope
- Fix all domain references in tunes (sitemap, robots.txt, index.html, meta tags)
- Fix explorers-earth sitemap (remove fake URLs)
- Create dynamic sitemap endpoints on tunes backend for both apps
- Add Nginx proxy for explorers-earth sitemap
- Install react-helmet-async in tunes
- Create tunes SEO component and GEO helpers
- Add dynamic SEO to all public tunes pages (landing, guest playlist, terms, privacy)
- Enable GEO on remaining explorers-earth pages (7 pages)
- Add breadcrumb schema to explorers-earth
- Add coordinate data to explorers-earth PublicHome GEO

### Out of Scope
- Server-side rendering (SSR) or pre-rendering
- Google Ads / paid search
- Social media sharing previews (beyond OG/Twitter tags)
- Analytics dashboard changes
- Dynamic OG image generation
- i18n/hreflang tags
- New database tables or schema changes
- Tunes authenticated page SEO (dashboard, settings, admin)

## User Stories

1. **As a Google crawler**, I can fetch `https://explorers.earth/sitemap.xml` and discover all public user profiles with correct URLs, so I can index them.
2. **As a Google crawler**, I can fetch `https://localtunes.earth/sitemap.xml` and discover all public guest playlist pages, so venues appear in search results.
3. **As a Google crawler**, I can render tunes pages (JS/CSS not blocked) and read unique meta tags per page, so each page gets indexed with the correct title and description.
4. **As a venue owner**, my guest playlist page appears in Google search results with my venue name and description, not generic "Local Tunes" text.
5. **As a search user**, I can find an explorer's public profile by searching their name or location.
6. **As a search user**, I can find a venue's playlist page by searching the venue name.
7. **As Google's structured data parser**, I can read FAQ schema on the tunes landing page and display FAQ rich results.
8. **As Google's structured data parser**, I can read BreadcrumbList schema on explorers-earth public pages and display breadcrumb navigation in search results.

## Acceptance Criteria

1. Both sitemaps submitted in GSC with "Success" status
2. URL Inspection passes for homepage + 1 public page per app (no rendering errors)
3. Google Rich Results Test detects structured data on public pages (FAQ, Breadcrumbs, Organization)
4. All public tunes pages have unique, dynamic meta tags visible in browser DevTools
5. No `localtunes.com` references remain in any file
6. No fake/example URLs in any sitemap
7. robots.txt does not block JS or CSS on either app
8. No hardcoded fake ratings in structured data
