---
Feature: apps-and-tools
Doc type: tasks
Status: draft
Created: 2026-07-02
Last updated: 2026-07-02
Updated by: agent
Depends on: apps_and_tools_prd.md, apps_and_tools_architecture.md
---

# Apps & Tools Implementation Tasks

Checklist of concrete items for developers implementing the Apps & Tools feature.

## Phase 1: Database & Strapi Config
- [ ] Create Strapi collection `AppList` with fields matching schema.
- [ ] Create Strapi collection `RecommendedApp` with fields matching schema.
- [ ] Create Strapi collection `App_Category` with fields matching schema.
- [ ] Configure S3 media folders: `{username}/apps/{listId}/` for covers and icons.
- [ ] Update public and authenticated API roles in Strapi settings to enable finds and mutations.
- [ ] Create backend controller route `GET /api/apps/scrape-url` and implement metatag parsing logic.

## Phase 2: GraphQL API Layer
- [ ] Write GraphQL queries `GetAppLists`, `GetAppListDetail`, `GetPinnedApps` in `api/query.ts`.
- [ ] Write GraphQL mutations `CreateAppList`, `UpdateAppList`, `CreateRecommendedApp`, `UpdateRecommendedApp`, `ReorderAppsInList` in `api/mutation.ts`.
- [ ] Generate typescript typings for GraphQL responses.

## Phase 3: Custom React Hooks
- [ ] Implement `useAppLists` to fetch lists under user Account.
- [ ] Implement `useAppsByList` to query list details.
- [ ] Implement `usePinnedApps` for Top Apps.
- [ ] Implement `useURLScraper` for page-crawling pre-fill logic.
- [ ] Implement `useAppActions` wrapping Apollo mutations.

## Phase 4: Core & Routing
- [ ] Update `DashboardSidebar.tsx` to add "Apps & Tools" item.
- [ ] Update `CategoryCards.tsx` (mobile) to include "Apps & Tools" grid option.
- [ ] Configure frontend route mappings in `src/routes.tsx` for `/dashboard/apps` and public `/:username/apps` paths.

## Phase 5: Creator Dashboard Pages
- [ ] Build `AppsHome.tsx` view with lists grids and `CreateListModal`.
- [ ] Build `AppListView.tsx` showing app rows with reorder drag handles and a settings Manage tab.
- [ ] Build `AddAppPage.tsx` showing the url scraper input, auto-enrichment loaders, and form fields.
- [ ] Integrate Tiptap editor for rich-text notes and star ratings.
- [ ] Build `TopAppsManager.tsx` modal for managing the featured row.

## Phase 6: Public Profile Pages
- [ ] Build `PublicApps.tsx` landing page.
- [ ] Build `TopAppsHero.tsx` (desktop slideshow) and `TopAppsMobileHero.tsx` (mobile stack card).
- [ ] Build horizontal `AppCarouselRow.tsx` for lists.
- [ ] Build compact `AppCard.tsx` showing logo, rating, platform badges, and price category.
- [ ] Build details `AppDetailModal.tsx` displaying full description, note, and screenshots carousel.
- [ ] Build grid sub-views `PublicAppList.tsx` and `PublicAppCategory.tsx`.

## Phase 7: Polish & Internationalization
- [ ] Add translation strings to `locales/en.json` (under "apps.*" prefix).
- [ ] Set up loading skeletons for all grids, cards, and pages.
- [ ] Verify responsivity from mobile (360px) up to 4K displays.
