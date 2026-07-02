---
Feature: apps-and-tools
Doc type: architecture
Status: draft
Created: 2026-07-02
Last updated: 2026-07-02
Updated by: agent
Depends on: apps_and_tools_schema.md, apps_and_tools_api_contract.md, UI_UX_Implementation.md
---

# Apps & Tools Feature Architecture

## Overview

The Apps & Tools feature extends explorers.earth with creator-managed digital stacks, tool directories, and app recommendations. Creators can organize lists, add notes, specify platforms/price models, flag top apps, and embed referral links. Visitors browse recommendations by creator, category, or list.

This document defines the technical architecture, component hierarchy, state management, and integration points.

### UI/UX Standards
All components must adhere to the [UI/UX Implementation Guide](./UI_UX_Implementation.md). Key constraints include:
- **Dashboard Blue**: Always use the standard blue accent variables (`var(--dash-accent)`).
- **Mobile Layout**: Add `pb-32` or `pb-40` to main containers to prevent action buttons from being hidden behind the fixed dashboard footer.
- **Switch Toggles**: Use the `Switch` component for Published/Draft toggles.

## 1. Feature Module Structure

The Apps & Tools feature follows the existing feature-based module pattern:

```
src/features/AppsAndTools/
├── api/
│   ├── query.ts              — GraphQL queries (lists, apps, categories)
│   └── mutation.ts           — GraphQL mutations (CRUD operations, reordering)
├── components/
│   ├── dashboard/            — Creator dashboard (protected routes)
│   │   ├── AppsHome.tsx              — Main apps dashboard view (includes inline CreateListModal)
│   │   ├── AppListView.tsx           — Single list detail (Recommendations + Manage tabs)
│   │   ├── AddAppPage.tsx            — Page to add/edit app (includes scraping interface)
│   │   └── TopAppsManager.tsx        — Pin/feature top apps manager (slide-up modal)
│   └── public/               — Visitor-facing components
│       ├── PublicApps.tsx            — Public apps landing page
│       ├── AppCarouselRow.tsx        — Horizontal scrollable app card row
│       ├── AppCard.tsx               — App logo + metadata compact card
│       ├── AppCardSkeleton.tsx       — Loading skeleton
│       ├── TopAppsHero.tsx           — Desktop cinematic showcase (auto-cycling cards)
│       ├── TopAppsMobileHero.tsx     — Mobile swipe stack card carousel
│       ├── AppDetailModal.tsx        — Slide-up details, developer, and specs modal
│       ├── PublicAppList.tsx         — List grid page for single app list
│       ├── PublicAppCategory.tsx     — Category grid page
│       └── CategoryBrowse.tsx        — Category selection section
├── hooks/
│   ├── useAppLists.ts                — Fetch creator's app lists
│   ├── useAppsByList.ts              — Fetch apps in a list
│   ├── usePinnedApps.ts              — Fetch top apps across all lists
│   ├── useAppDetail.ts               — Fetch single app details
│   ├── useURLScraper.ts              — URL metadata extraction hook
│   └── useAppActions.ts              — Create, update, delete, pin, reorder
├── types/
│   └── index.ts              — TypeScript interfaces (AppList, RecommendedApp, ScraperResult)
├── utils/
│   ├── categoryUtils.ts      — Category slug generation and mappings
│   └── appHelpers.ts         — Image URL builders, platform maps, data transformers
└── index.ts                  — Public exports (components, hooks, types)
```

### Directory Explanations

**api/**
- `query.ts`: GraphQL queries (getAppLists, getAppsByList, getAppDetail, getPublicApps, getTopApps, getAppsByCategory)
- `mutation.ts`: GraphQL mutations (createAppList, updateAppList, deleteAppList, createRecommendedApp, updateRecommendedApp, deleteRecommendedApp, pinApp, reorderApps, publishAppList)

**components/dashboard/**
- `AppsHome.tsx`: Dashboard landing showing lists, Top Apps strip, create list modal.
- `AppListView.tsx`: Detailed view of a single list. Contains **Recommendations** tab (table/list rows with drag handles, pin toggle, ⋮ menu) and **Manage** tab (Delete/Edit/Publish settings, sharing URL and QR code card).
- `AddAppPage.tsx`: Full-page add/edit flow. Contains a URL scraper input. Pasting a URL triggers `useURLScraper` to populate Title, Description, and Logo. User fills in personal notes (Tiptap), user rating (1-10 stars), platforms, price tier, download/referral URL, and screenshot uploads.
- `TopAppsManager.tsx`: Slide-up bottom-sheet modal. Lets creators manage up to 15 pinned apps, change display headers, and drag-and-drop to reorder pins.

**components/public/**
- `PublicApps.tsx`: Landing page for a creator's apps (featured lists, carousels, category cards).
- `AppCarouselRow.tsx`: Horizontal scrollable row displaying `AppCard` items.
- `AppCard.tsx`: Square app logo with title, platform icons, rating badge, and price badge.
- `TopAppsHero.tsx`: Desktop showcase for top apps featuring active app hero layout (logo, title, platform list, recommendation text, and screenshots) and active thumbnail selectors.
- `TopAppsMobileHero.tsx`: Mobile card stack layout allowing swipe gestures to browse pinned apps.
- `AppDetailModal.tsx`: Slide-up overlay showing high-res logo, details, developer, rating, platform badges, download button (with referral), creator's note, and screenshot gallery.

**hooks/**
- `useAppLists.ts`, `useAppsByList.ts`, `usePinnedApps.ts`, `useAppDetail.ts`, `useAppActions.ts`: Apollo Client query and mutation wrappers.
- `useURLScraper.ts`: Triggerable hook calling a backend REST scraper endpoint (`/api/apps/scrape-url?url=...`) returning page title, description, and high-resolution icons.

**types/index.ts**
```typescript
export interface AppList {
  id: string;
  name: string;
  slug: string;
  description: string;
  published: boolean;
  creatorId: string;
  apps: RecommendedApp[];
  topAppsHeading: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecommendedApp {
  id: string;
  listId: string;
  appUrl: string;
  title: string;
  logoUrl: string;
  description: string;
  developer?: string;
  platforms: string[]; // ['macOS', 'iOS', 'Web', etc.]
  priceTier: 'Free' | 'Freemium' | 'Paid' | 'Subscription';
  downloadUrl?: string;
  user_recommendation_note?: any;
  user_rating?: number;
  isPinned: boolean;
  order: number;
  pinOrder?: number;
  screenshots: string[];
  createdAt: string;
}

export interface ScraperResult {
  title: string;
  description: string;
  logoUrl: string;
  developer?: string;
}
```

## 2. Shared Component Integrations

### src/components/DashboardSidebar.tsx
Update the sidebar to include the "Apps & Tools" tab.
```typescript
interface DashboardSidebarProps {
  currentCategory: 'places' | 'movies' | 'books' | 'games' | 'apps';
  onCategoryChange: (category: 'places' | 'movies' | 'books' | 'games' | 'apps') => void;
}
```

### src/components/CategoryCards.tsx
Add "Apps & Tools" to the mobile categories dashboard landing grid.

## 3. Routes & Navigation

Update routes in `src/routes.tsx` (or main Router file):
- Creator Dashboard:
  - `/dashboard/apps` -> `AppsHome`
  - `/dashboard/apps/:listId` -> `AppListView`
  - `/dashboard/apps/:listId/new` -> `AddAppPage`
  - `/dashboard/apps/:listId/:appId/edit` -> `AddAppPage`
- Public Profile:
  - `/:username/apps` -> `PublicApps`
  - `/:username/apps/:listSlug` -> `PublicAppList`
  - `/:username/apps/category/:categorySlug` -> `PublicAppCategory`
