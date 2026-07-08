---
Feature: person
Doc type: architecture
Status: draft
Created: 2026-07-05
Last updated: 2026-07-05
Updated by: agent
Depends on: person_schema.md, person_api_contract.md, UI_UX_Implementation.md
---

# People Feature Architecture

## Overview

The People feature extends explorers.earth with creator-managed recommendation lists of individuals (such as designers, developers, mentors, or content creators). Creators can build lists, add endorsement notes, link social media handles, pin top picks, and share their human network. Visitors can browse these curated profiles, read detailed endorsements, view portfolio works, and link directly to social accounts (Instagram, LinkedIn, X, etc.).

This document defines the technical architecture, component hierarchy, state management hooks, utilities, and integrations.

### UI/UX Standards
All components must adhere to the [UI/UX Implementation Guide](./UI_UX_Implementation.md). Key constraints include:
- **Dashboard Blue**: Always use the standard blue accent variables (`var(--dash-accent)`).
- **Mobile Layout**: Add `pb-32` or `pb-40` to main containers to prevent action buttons from being hidden behind the fixed dashboard footer.
- **Switch Toggles**: Use the `Switch` component for Published/Draft toggles.

## 1. Feature Module Structure

The People feature follows the existing feature-based module pattern:

```
src/features/People/
├── api/
│   ├── query.ts              — GraphQL queries (lists, people, categories)
│   └── mutation.ts           — GraphQL mutations (CRUD operations)
├── components/
│   ├── dashboard/            — Creator dashboard (protected routes)
│   │   ├── PeopleHome.tsx            — Main people dashboard view (includes inline CreateListModal)
│   │   ├── PersonListView.tsx        — Single list detail (tabs: Recommendations + Manage)
│   │   ├── AddPersonPage.tsx         — Page to add/edit person (includes profile crawler/manual form)
│   │   └── TopPeopleManager.tsx      — Pin/feature top picks manager (slide-up modal)
│   └── public/               — Visitor-facing components
│       ├── PublicPeople.tsx          — Public people landing page
│       ├── PersonCarouselRow.tsx     — Horizontal scrollable profile carousel
│       ├── PersonCard.tsx            — Avatar + headline compact card
│       ├── PersonSkeleton.tsx        — Loading skeleton
│       ├── TopPeopleHero.tsx         — Desktop cinematic profile hero (auto-cycling slideshow)
│       ├── TopPeopleMobileHero.tsx   — Mobile swipe card stack carousel
│       ├── PersonDetailModal.tsx     — Slide-up detailed profile card view
│       ├── PublicPersonList.tsx      — Grid page for a single list
│       ├── PublicPersonSector.tsx    — Sector/Industry grid page
│       └── SectorBrowse.tsx          — Sector selection / discovery categories
├── hooks/
│   ├── usePersonLists.ts             — Fetch creator's lists
│   ├── usePeopleByList.ts            — Fetch people in specific list
│   ├── usePinnedPeople.ts            — Fetch top picks across all lists
│   ├── usePersonDetail.ts            — Fetch single person details
│   ├── usePersonLinkScraper.ts       — Trigger profile metadata scraper
│   └── usePersonActions.ts           — Create, update, delete, pin, reorder
├── types/
│   └── index.ts              — TypeScript interfaces (PersonList, RecommendedPerson, ScrapedProfileMetadata)
├── utils/
│   ├── sectorUtils.ts        — Sector slug generation and mapping
│   └── personHelpers.ts      — Platform icon resolver, image URL builders
└── index.ts                  — Public exports (components, hooks, types)
```

### Directory Explanations

**api/**
- `query.ts`: GraphQL queries using Apollo Client (getPersonLists, getPeopleByList, getPersonDetail, getPublicPeople, getTopPinnedPeople, getPublishedPersonLists, getPeopleBySector).
- `mutation.ts`: GraphQL mutations (createPersonList, updatePersonList, deletePersonList, createRecommendedPerson, updateRecommendedPerson, deleteRecommendedPerson, pinPerson, reorderPeople, publishPersonList).

**components/dashboard/**
- `PeopleHome.tsx`: Dashboard landing page displaying the creator's lists, top picks showcase, "Create New List" action, and inline `CreateListModal`.
- `PersonListView.tsx`: Single list details screen. Features a **Recommendations** tab (people rows with edit/delete actions, pin toggle, drag handle) and a **Manage** tab (visibility switch, edit slug, delete list, sharing URLs, and QR code widgets).
- `AddPersonPage.tsx`: Full-page add/edit overlay. Features an inline URL crawler search card. After pasting a profile link, it queries the backend API. If successful, pre-fills the form. Form fields include: Name, Social Handle, Headline, Location, Primary Platform, Custom platform URLs JSON editor, Custom Tags input, Endorsement Note (Tiptap editor), rating slider, avatar upload, and portfolio media area.
- `TopPeopleManager.tsx`: Bottom sheet slider for managing pinned profiles. Allows ordering and toggling pins.

**components/public/**
- `PublicPeople.tsx`: Main public route showing the creator's curated network. Displays the Top Picks Hero, list carousels, and Sector filters.
- `PersonCarouselRow.tsx`: Horizontal scrollable row displaying `PersonCard` components.
- `PersonCard.tsx`: Tappable circular profile card showing the avatar, name, headline, platform indicator, and quick-action social button.
- `PersonDetailModal.tsx`: Slide-up overlay showing the person's avatar, metadata, creator endorsement text (rich text), a skills/tags gallery, screenshots/photos of their portfolio, and prominent icons for their linked social profiles.
- `PublicPersonList.tsx`: Grid showing all people in a list.
- `PublicPersonSector.tsx`: Grid showing all people matching a sector across the creator's lists.

---

## 2. TypeScript Types

Defined in `src/features/People/types/index.ts`:

```typescript
export interface PersonList {
  id: string;
  name: string;
  slug: string;
  description?: string;
  published: boolean;
  creatorId: string;
  recommendedPeople: RecommendedPerson[];
  topPicksCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecommendedPerson {
  id: string;
  listId: string;
  name: string;
  username_handle?: string;
  headline?: string;
  location?: string;
  avatarUrl?: string; // S3 hosted URL
  primaryPlatform: 'instagram' | 'linkedin' | 'twitter' | 'github' | 'youtube' | 'website' | 'other';
  socialUrls: SocialUrls;
  skillsTags: string[];
  user_recommendation_note?: any; // Rich text block structure
  user_rating?: number | null; // 1-10 rating
  isPinned: boolean;
  pinOrder?: number | null;
  displayOrder: number;
  portfolioMedia?: string[]; // S3 hosted screenshots URLs
  createdAt: string;
}

export interface SocialUrls {
  linkedin?: string;
  instagram?: string;
  twitter?: string;
  github?: string;
  youtube?: string;
  website?: string;
  medium?: string;
  tiktok?: string;
}

export interface ScrapedProfileMetadata {
  name?: string;
  username?: string;
  headline?: string;
  avatarUrl?: string;
  platform: 'instagram' | 'linkedin' | 'other';
}
```

---

## 3. Shared Components Modifications

These core shell components must be updated to integrate the People category:

### `src/components/DashboardSidebar.tsx`
Update desktop navigation tabs to include People:
```typescript
interface DashboardSidebarProps {
  currentCategory: 'places' | 'movies' | 'books' | 'products' | 'apps' | 'games' | 'people';
  onCategoryChange: (category: 'places' | 'movies' | 'books' | 'products' | 'apps' | 'games' | 'people') => void;
}
```

### `src/components/CategoryCards.tsx`
Add "People" category card to the mobile category selector dashboard.

### `src/routes/AppRoutes.tsx`
Register the new route paths:
- Dashboard: `/dashboard/people`, `/dashboard/people/:listId`, `/dashboard/people/:listId/add`
- Public: `/:username/people`, `/:username/people/:listSlug`, `/:username/people/sector/:sectorSlug`
