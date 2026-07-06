---
Feature: person
Doc type: tasks
Status: draft
Created: 2026-07-05
Last updated: 2026-07-05
Updated by: agent
Depends on: person_decisions.md
---

# People — Task Breakdown

Epic-level breakdown of the development phases, execution order, and implementation tasks for the People recommendation feature.

---

## Execution Order Overview

```
Phase A: Documentation (Completed)
    ↓
Phase B: Strapi Setup & Backend Scraper (Tasks B1-B2)
    ↓
Phase C: Frontend API Foundation (Tasks C1-C3)
    ↓
Phase D: Dashboard UI Development (Tasks D1-D5)
    ↓
Phase E: Public Visitor Page Development (Tasks E1-E5)
    ↓
Phase F: Polish & Verification (Tasks F1-F3)
```

---

## Phase A: Documentation (Completed)
- **UI/UX Implementation Standards** (`UI_UX_Implementation.md`)
- **Product Requirements Document** (`person_prd.md`)
- **Strapi Schema Details** (`person_schema.md`)
- **Feature Architecture** (`person_architecture.md`)
- **Architectural Decisions** (`person_decisions.md`)
- **User Flows** (`person_flow.md`)
- **Integration Details** (`person_integration.md`)
- **GraphQL API Contracts** (`person_api_contract.md`)

---

## Phase B: Strapi Setup & Backend Scraper

### B1 — Strapi Collections Setup
- **Owner**: User (Developer / Strapi Admin Panel)
- **Description**: Set up the Strapi content-type collections via the Strapi Admin Panel.
- **Tasks**:
  - Create `PersonList` collection with fields (`List_Name`, `list_description`, `slug`, `Visibility`, `cover_image`, `display_order`, `top_picks_heading`, `account` relation, `recommended_people` relation).
  - Create `RecommendedPerson` collection with fields (`name`, `username_handle`, `headline`, `location`, `avatar_path`, `primary_platform`, `social_urls` JSON, `skills_tags` JSON, `user_recommendation_note`, `user_rating`, `is_pinned`, `pin_order`, `display_order`, `Media` multiple, `media_details` JSON, `person_list` relation, `people_category` relation).
  - Create `People_Category` collection with fields (`Category_name`, `recommended_people` relation).
  - Enable API permissions for Authenticated (CRUD) and Public roles (find/findOne).

### B2 — Backend Scraper Controller
- **Description**: Write the `cheerio`/`node-fetch` profile scraper controller.
- **Tasks**:
  - Install dependencies: `cheerio`, `node-fetch`.
  - Create controller `src/api/recommended-person/controllers/scraper.js` extracting name, handle, biography, platform, and avatar image.
  - Set up router path `GET /api/people/scrape-profile` mapped to scraper controller.
  - Implement the `downloadAndStoreAvatar` lifecycles hook on create/update events in Strapi content types.

---

## Phase C: Frontend API Foundation

### C1 — TypeScript Definitions
- **File**: `src/features/People/types/index.ts`
- **Tasks**:
  - Define interfaces: `PersonList`, `RecommendedPerson`, `SocialUrls`, `ScrapedProfileMetadata`.

### C2 — GraphQL Query & Mutation Registration
- **Files**: `src/features/People/api/query.ts`, `src/features/People/api/mutation.ts`
- **Tasks**:
  - Write queries: `personListsByAccount`, `peopleByList`, `pinnedPeopleByAccount`, `peopleBySector`.
  - Write mutations: CRUD for lists, CRUD for people, bulk reordering mutations.

### C3 — Apollo Client Query Hooks
- **Files**: `src/features/People/hooks/`
- **Tasks**:
  - Create `usePersonLists.ts` and `usePeopleByList.ts`.
  - Create `usePinnedPeople.ts` and `usePersonDetail.ts`.
  - Create `usePersonLinkScraper.ts` wrapping the scraper fetch call.
  - Create `usePersonActions.ts` wrapping CRUD operations.

---

## Phase D: Dashboard UI Development

### D1 — Sidebar & Dashboard Shell Navigation
- **Files to modify**: `src/components/DashboardSidebar.tsx`, `src/components/CategoryCards.tsx`
- **Tasks**:
  - Add "People" category navigation items.
  - Map click-through route triggers to `/dashboard/people`.

### D2 — People Home (`PeopleHome.tsx`)
- **File**: `src/features/People/components/dashboard/PeopleHome.tsx`
- **Tasks**:
  - Query creator's lists.
  - Render list overview cards (with visibility badges, drag reorder hooks, edit links).
  - Add inline `CreateListModal` to create new lists with auto-generated slugs.

### D3 — Person List View (`PersonListView.tsx`)
- **File**: `src/features/People/components/dashboard/PersonListView.tsx`
- **Tasks**:
  - Render list of recommendations with handles, headline, platform badges.
  - Integrate drag handle and `@hello-pangea/dnd` for reordering.
  - Build **Manage** tab containing list info forms, Visibility Switch, and share links/QR download cards.

### D4 — Add/Edit Person Page (`AddProductPage.tsx`)
- **File**: `src/features/People/components/dashboard/AddPersonPage.tsx`
- **Tasks**:
  - Create profile scraper search box.
  - Hook search to `usePersonLinkScraper`.
  - Build manual fallback flow triggering form overlay on scraping failure.
  - Add form inputs (Name, Headline, Location, Sector, Skills input tagger, Tiptap Note editor, 1-10 slider, and multi-file drag-drop S3 screenshots uploader).
  - Build S3 avatar file-upload override.

### D5 — Top Picks Showcase Manager (`TopPeopleManager.tsx`)
- **File**: `src/features/People/components/dashboard/TopPeopleManager.tsx`
- **Tasks**:
  - Create bottom-sheet modal.
  - List pinned members with pin counters (max 15).
  - Enable ordering and fast unpin (×) triggers.

---

## Phase E: Public Visitor Page Development

### E1 — Routing registration
- **File**: `src/routes/AppRoutes.tsx`
- **Tasks**:
  - Add routes: `/people`, `/people/:listSlug`, `/people/sector/:sectorSlug`.

### E2 — Public People Landing (`PublicPeople.tsx`)
- **File**: `src/features/People/components/public/PublicPeople.tsx`
- **Tasks**:
  - Fetch public lists and pinned items.
  - Render Top Picks Hero slider section.
  - Render each published list as a horizontal scrollable row.
  - Render Sector browse category buttons in the footer.

### E3 — Circular Profile Cards (`PersonCard.tsx`, `PersonCarouselRow.tsx`)
- **Files**: `src/features/People/components/public/PersonCard.tsx`, `PersonCarouselRow.tsx`
- **Tasks**:
  - Build circular avatar wrapper with platform badge overlays.
  - Add hover transitions (opacity shifts, circular zoom effects).
  - Add direct-to-social external action click button.

### E4 — Detail Slide-up Modal (`PersonDetailModal.tsx`)
- **File**: `src/features/People/components/public/PersonDetailModal.tsx`
- **Tasks**:
  - Build slide-up sheet overlay (`backdrop-blur-sm`).
  - Render profile info (Avatar, name, headline, location).
  - Map social URLs JSON into brand SVG buttons (LinkedIn, Instagram, X, GitHub, Website).
  - Display skills tags, Tiptap notes, 1-10 rating, and screenshot gallery.

### E5 — List Grid & Sector Grid Pages
- **Files**: `src/features/People/components/public/PublicPersonList.tsx`, `PublicPersonSector.tsx`
- **Tasks**:
  - Build standard columns layout (`grid-cols-2 lg:grid-cols-4`) displaying poster/profile grids for specific lists or sectors.

---

## Phase F: Polish & Verification

### F1 — Multi-lingual i18n
- **Files**: `src/i18n/resources/en.json` (and all other localization files)
- **Tasks**:
  - Translate all dashboard buttons, labels, and forms.
  - Translate public header tags, empty states, and errors.

### F2 — Performance & Polish
- **Tasks**:
  - Create loading skeletons (`PersonSkeleton.tsx`).
  - Optimize S3 upload speed and compress avatar images.
  - Check for mobile safe boundaries (`pb-32` spacing).

### F3 — Testing & Verification
- **Tasks**:
  - Run comprehensive testing scenarios as defined in `person_testing.md`.
