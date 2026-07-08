---
Feature: apps-and-tools
Doc type: integration
Status: draft
Created: 2026-07-02
Last updated: 2026-07-02
Updated by: agent
Depends on: apps_and_tools_architecture.md, apps_and_tools_api_contract.md
---

# Apps & Tools — Integration Guide

A step-by-step implementation guide for developers setting up the Apps & Tools feature.

---

## Phase 1: Strapi Schema & Backend Setup

### 1. Create Strapi Collections
Using the Strapi Content-Type Builder, create the three collections described in `apps_and_tools_schema.md`:
- `AppList` (singular ID: `app-list`, plural: `app-lists`)
- `RecommendedApp` (singular ID: `recommended-app`, plural: `recommended-apps`)
- `App_Category` (singular ID: `app-category`, plural: `app-categories`)

### 2. Implement the URL Scraper Endpoint
In your Strapi backend project (or custom Node middleware), create the scraping endpoint.

**Dependencies:** `npm install cheerio metatascraper linkedom node-fetch` (or standard parsing libraries).

Create the controller `src/api/recommended-app/controllers/scraper.js`:
```javascript
const fetch = require('node-fetch');
const cheerio = require('cheerio');

module.exports = {
  async scrape(ctx) {
    const { url } = ctx.query;
    if (!url) return ctx.badRequest('URL query parameter is required');

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      const html = await response.text();
      const $ = cheerio.load(html);

      const title = $('meta[property="og:title"]').attr('content') || $('title').text() || '';
      const description = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '';
      
      // Logo search hierarchy: apple-touch-icon -> icon -> og:image
      let logoUrl = '';
      const appleTouch = $('link[rel="apple-touch-icon"]').attr('href');
      const icon = $('link[rel="icon"]').attr('href') || $('link[rel="shortcut icon"]').attr('href');
      const ogImg = $('meta[property="og:image"]').attr('content');

      if (appleTouch) {
        logoUrl = new URL(appleTouch, url).href;
      } else if (icon) {
        logoUrl = new URL(icon, url).href;
      } else if (ogImg) {
        logoUrl = ogImg;
      }

      ctx.body = {
        success: true,
        data: {
          title: title.trim(),
          description: description.trim(),
          logoUrl,
          developer: new URL(url).hostname.replace('www.', '')
        }
      };
    } catch (err) {
      ctx.send({ success: false, error: err.message });
    }
  }
};
```

Bind this controller to `GET /api/apps/scrape-url` route in your router config.

---

## Phase 2: Frontend GraphQL & API setup

1. **GraphQL queries**: Write GQL strings to `src/features/AppsAndTools/api/query.ts` conforming to `apps_and_tools_api_contract.md`.
2. **GraphQL mutations**: Write GQL strings to `src/features/AppsAndTools/api/mutation.ts`.
3. **Register Hooks**: Create `useAppLists`, `useAppsByList`, `usePinnedApps`, and `useAppActions` wrapping Apollo client queries and mutations with error caching.
4. **Scraper Hook**: Create `useURLScraper` containing the fetch action:
```typescript
import { useState } from 'react';
import axios from 'axios';

export function useURLScraper() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrape = async (url: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`/api/apps/scrape-url?url=${encodeURIComponent(url)}`);
      return response.data;
    } catch (err: any) {
      setError(err.message || 'Failed to extract metadata');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { scrape, loading, error };
}
```

---

## Phase 3: Dashboard Interface

1. **Category navigation**:
   - Update `src/components/DashboardSidebar.tsx` to add the Apps & Tools option.
   - Update `src/components/CategoryCards.tsx` (mobile menu).
2. **Apps Home (`AppsHome.tsx`)**:
   - Query all `AppList` items via `useAppLists`.
   - Render a list of cards with status badges (Draft/Published) and edit navigation.
   - Add a inline `CreateListModal` for creation.
3. **App List View (`AppListView.tsx`)**:
   - Render lists of `RecommendedApp` items.
   - Drag-to-reorder handler using `@hello-pangea/dnd` or `framer-motion`.
   - "Manage" tab with Edit Slug, Delete List, and visibility Toggle (Switch).
4. **Add/Edit App Page (`AddAppPage.tsx`)**:
   - URL paste card input field with "Fetch Metadata" button.
   - Form fields: Title, description, developer, direct download link.
   - Select multi-options for platforms (`macOS`, `Windows`, `Linux`, `iOS`, `Android`, `Web`, `Chrome Extension`, `Safari Extension`, `Firefox Addon`).
   - Radio buttons for price model (`Free`, `Freemium`, `Paid`, `Subscription`).
   - S3 drag-and-drop area for logo & screenshots.
   - Rich Text recommendation card (Tiptap) and 1-10 slider rating.

---

## Phase 4: Public Page & Details

1. **Routing**:
   - Add `/:username/apps` route loading `PublicApps.tsx`.
   - Add `/:username/apps/:listSlug` route loading `PublicAppList.tsx`.
   - Add `/:username/apps/category/:categorySlug` route loading `PublicAppCategory.tsx`.
2. **Public Screen Layout**:
   - Header with creator avatar and apps count.
   - Pinned Top Apps Hero slider.
   - Lists rows represented as horizontal poster-style sliders showing `AppCard` items.
   - CategoryBrowse section showing square category tiles at the page footer.
3. **Slide-up Detail Modal (`AppDetailModal.tsx`)**:
   - Modal background blur effect (`backdrop-blur-sm`).
   - Left column: App Logo, title, developer, platforms list (icons), price tier, rating badge, download action.
   - Right column: Creator recommendation notes and a scrollable screenshots grid (16:9 thumbnails).
