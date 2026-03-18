---
Feature: seo-optimization
Doc type: deployment-guide
Status: draft
Created: 2026-03-18
Last updated: 2026-03-18
Updated by: agent
Depends on: seo-optimization_tasks.md, seo-optimization_architecture.md
---

# SEO Optimization — Deployment & Testing Guide

## What Changed That Affects Infrastructure

### 1. Nginx Proxy (explorers-earth)
**File:** `explorers-earth/nginx.conf`

A new `location = /sitemap.xml` block was added that proxies requests to the tunes backend. This means:
- When Google crawls `https://explorers.earth/sitemap.xml`, Nginx forwards the request to `http://tunes-app:5000/api/explorers-sitemap.xml`
- This uses Docker internal DNS — `tunes-app` resolves because both containers are on the `proxy` network
- **No docker-compose changes needed** — the `proxy` network already connects both containers

### 2. New Tunes Server Routes
**File:** `tunes/server/seo-routes.ts`

Two sitemap endpoints were added/modified:
- `GET /sitemap.xml` — now dynamically queries PostgreSQL for venue guest URLs
- `GET /api/explorers-sitemap.xml` — queries Strapi for public user profiles

Both use env vars already in docker-compose: `DATABASE_URL`, `STRAPI_URL`, `STRAPI_ACCESS_TOKEN`.

### 3. New Dependency (tunes)
`react-helmet-async` was added to tunes. This is bundled into the client JS at build time — no runtime server dependency.

---

## Pre-Deployment Checklist

### On Your Machine (before pushing)
- [ ] `cd tunes && npm install` — ensure react-helmet-async is installed
- [ ] `cd tunes && npm run check` — TypeScript compilation passes
- [ ] `cd explorers-earth && npm run build` — Vite build succeeds

### Environment Variables (on Hetzner server)
No new env vars needed. Verify these already exist in your `.env`:
- [ ] `STRAPI_URL` — the Strapi GraphQL endpoint base URL
- [ ] `STRAPI_ACCESS_TOKEN` — has read access to `accounts` collection
- [ ] `DATABASE_URL` — PostgreSQL connection (already required for tunes)

---

## Deployment Steps

### Step 1: Push & Build Images
```bash
# Push the branch
git push origin feature/seo-optimization

# If using CI/CD (GitHub Actions), the images will build automatically
# If manual, build on the server:
docker compose build tunes explorers
```

### Step 2: Deploy on Hetzner
```bash
# SSH into your Hetzner server
ssh your-server

# Pull latest images (if using GHCR)
docker compose pull

# Restart both services
docker compose up -d tunes explorers

# Verify containers are healthy
docker compose ps
```

### Step 3: Verify Nginx Config
```bash
# Check Nginx config is valid inside the explorers container
docker exec explorers-app nginx -t

# Expected output:
# nginx: the configuration file /etc/nginx/conf.d/default.conf syntax is ok
# nginx: configuration file /etc/nginx/conf.d/default.conf test is successful
```

---

## Post-Deployment Testing

### Test 1: Verify Tunes Sitemap
```bash
# From the server (or locally via curl)
curl -s https://localtunes.earth/sitemap.xml | head -30

# Expected: Valid XML with <urlset>, containing:
# - https://localtunes.earth/ (homepage)
# - https://localtunes.earth/terms
# - https://localtunes.earth/privacy
# - https://localtunes.earth/features/venues
# - https://localtunes.earth/playlist/{guestUrl} entries (one per venue)
```

### Test 2: Verify Explorers Sitemap (via Nginx Proxy)
```bash
curl -s https://explorers.earth/sitemap.xml | head -30

# Expected: Valid XML with <urlset>, containing:
# - https://explorers.earth/ (homepage)
# - https://explorers.earth/contact
# - https://explorers.earth/privacy, /terms, /cookies
# - https://explorers.earth/{username} entries (one per public user)
# - https://explorers.earth/{username}/places entries
```

### Test 3: Verify Nginx Proxy Works (directly)
```bash
# Test the tunes endpoint directly
curl -s https://localtunes.earth/api/explorers-sitemap.xml | head -10

# Should return the same XML as Test 2
# This confirms the tunes backend is generating it correctly
```

### Test 4: Verify Tunes Robots.txt
```bash
curl -s https://localtunes.earth/robots.txt

# Expected: NO localtunes.com references
# Expected: NO /*.js$ or /*.css$ disallow rules
# Expected: Sitemap: https://localtunes.earth/sitemap.xml
```

### Test 5: Verify Explorers Robots.txt
```bash
curl -s https://explorers.earth/robots.txt

# Expected: Sitemap: https://explorers.earth/sitemap.xml
# This file is served from the static build (public/robots.txt)
```

### Test 6: Verify Meta Tags (browser)
1. Open `https://localtunes.earth/` in Chrome
2. Right-click → Inspect → Elements → expand `<head>`
3. Check for:
   - `<title>Local Tunes - Create and Share Live Playlists...</title>`
   - `<meta property="og:url" content="https://localtunes.earth">`
   - `<meta name="ai:page-type" content="landing">`
   - `<script type="application/ld+json">` with `"@type": "FAQPage"`

4. Open `https://explorers.earth/about`
5. Check for `<meta name="ai:page-type" content="webpage">`

### Test 7: Validate with Google Tools
- [Rich Results Test](https://search.google.com/test/rich-results) — paste each URL
- [Schema Markup Validator](https://validator.schema.org/) — paste JSON-LD from page source

---

## Troubleshooting

### Sitemap returns HTML instead of XML on explorers.earth
**Cause:** Nginx SPA fallback is catching `/sitemap.xml` before the proxy block.
**Fix:** The `location = /sitemap.xml` exact match should take priority. Verify the nginx.conf has this block BEFORE `location /`.
```bash
docker exec explorers-app cat /etc/nginx/conf.d/default.conf
```

### Sitemap returns 502 Bad Gateway on explorers.earth
**Cause:** Nginx can't reach `tunes-app:5000`.
**Fix:** Both containers must be on the `proxy` network.
```bash
# Check if both containers are on the same network
docker network inspect $(docker network ls -q -f name=proxy) | grep -A2 "tunes-app\|explorers-app"

# Check if tunes is healthy
docker exec explorers-app curl -s http://tunes-app:5000/api/explorers-sitemap.xml | head -5
```

### Explorers sitemap only shows static pages (no users)
**Cause:** Strapi query failed — either env vars missing or Strapi is down.
**Fix:** Check tunes server logs:
```bash
docker logs tunes-app --tail 50 | grep -i "strapi\|sitemap\|error"

# Verify env vars
docker exec tunes-app env | grep STRAPI
```

### Tunes sitemap only shows static pages (no venues)
**Cause:** Database query for users failed.
**Fix:** Check tunes server logs:
```bash
docker logs tunes-app --tail 50 | grep -i "sitemap\|venues\|error"
```

### Meta tags not updating on page navigation
**Cause:** This is normal for client-side rendering. react-helmet-async updates `<head>` after JS executes. "View Page Source" shows the original index.html.
**Verify:** Use DevTools (Elements tab, not View Source) to see the live `<head>`.

---

## Google Search Console Steps (After Deploy)

### Submit Sitemaps
1. Go to [Google Search Console](https://search.google.com/search-console)
2. Select **explorers.earth** → Sitemaps → type `sitemap.xml` → Submit
3. Select **localtunes.earth** → Sitemaps → type `sitemap.xml` → Submit
4. Wait for status to show **"Success"** (can take minutes to hours)

### Request Indexing
1. In GSC, go to **URL Inspection**
2. Paste `https://explorers.earth/` → click **Request Indexing**
3. Paste `https://localtunes.earth/` → click **Request Indexing**
4. Paste one public user profile URL → Request Indexing
5. Paste one guest playlist URL → Request Indexing

### Monitor (Weekly for First Month)
1. **Pages report** — check for new crawl errors
2. **Enhancements** → look for FAQ, Breadcrumbs, Organization results
3. **Performance** → search impressions should start appearing in 1-2 weeks
4. **Sitemaps** — verify status stays "Success"

---

## Architecture Diagram (How Requests Flow)

```
Google Bot crawls https://explorers.earth/sitemap.xml
    │
    ▼
Traefik (port 443, TLS) → Host: explorers.earth
    │
    ▼
explorers-app (Nginx, port 80)
    │
    ├── location = /sitemap.xml  ──► proxy_pass http://tunes-app:5000/api/explorers-sitemap.xml
    │                                        │
    │                                        ▼
    │                                tunes-app (Express)
    │                                        │
    │                                queries Strapi GraphQL
    │                                        │
    │                                        ▼
    │                                returns XML with user URLs
    │
    ├── location ~* \.(js|css|...)$  ──► static assets from /usr/share/nginx/html
    │
    └── location /  ──► SPA fallback → index.html


Google Bot crawls https://localtunes.earth/sitemap.xml
    │
    ▼
Traefik (port 443, TLS) → Host: localtunes.earth
    │
    ▼
tunes-app (Express, port 5000)
    │
    ├── GET /sitemap.xml  ──► queries PostgreSQL users table
    │                              │
    │                              ▼
    │                         returns XML with venue playlist URLs
    │
    └── GET /robots.txt   ──► returns from seo_settings DB table
```
