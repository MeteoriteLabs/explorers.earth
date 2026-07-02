---
Feature: products
Doc type: architecture
Status: draft
Created: 2026-07-02
Last updated: 2026-07-02
Updated by: agent
Depends on: products_schema.md, products_api_contract.md, UI_UX_Implementation.md
---

# Products Feature Architecture

## Overview

The Products feature extends explorers.earth with creator-curated gear logs, workspace setups, and physical product recommendations. Creators can organize lists, add specs/features, specify price/currency, pin top items, and embed affiliate buy links. Visitors browse recommendations by creator, category, or list.

This document defines the technical architecture, component hierarchy, state management, and integration points.

### UI/UX Standards
All components must adhere to the [UI/UX Implementation Guide](./UI_UX_Implementation.md). Key constraints include:
- **Dashboard Blue**: Always use the standard blue accent variables (`var(--dash-accent)`).
- **Mobile Layout**: Add `pb-32` or `pb-40` to main containers to prevent action buttons from being hidden behind the fixed dashboard footer.
- **Switch Toggles**: Use the `Switch` component for Published/Draft toggles.

## 1. Feature Module Structure

The Products feature follows the existing feature-based module pattern:

```
src/features/Products/
├── api/
│   ├── query.ts              — GraphQL queries (lists, products, categories)
│   └── mutation.ts           — GraphQL mutations (CRUD operations, reordering)
├── components/
│   ├── dashboard/            — Creator dashboard (protected routes)
│   │   ├── ProductsHome.tsx          — Main products dashboard view (includes inline CreateListModal)
│   │   ├── ProductListView.tsx       — Single list detail (Recommendations + Manage tabs)
│   │   ├── AddProductPage.tsx        — Page to add/edit product (includes scraping interface + specs editor)
│   │   └── TopProductsManager.tsx    — Pin/feature top products manager (slide-up modal)
│   └── public/               — Visitor-facing components
│       ├── PublicProducts.tsx        — Public products landing page
│       ├── ProductCarouselRow.tsx    — Horizontal scrollable product card row
│       ├── ProductCard.tsx           — Product image + metadata compact card
│       ├── ProductCardSkeleton.tsx   — Loading skeleton
│       ├── TopProductsHero.tsx       — Desktop cinematic showcase (auto-cycling cards)
│       ├── TopProductsMobileHero.tsx — Mobile swipe stack card carousel
│       ├── ProductDetailModal.tsx    — Slide-up details, specs, and buy modal
│       ├── PublicProductList.tsx     — List grid page for single product list
│       ├── PublicProductCategory.tsx — Category grid page
│       └── CategoryBrowse.tsx        — Category selection section
├── hooks/
│   ├── useProductLists.ts            — Fetch creator's product lists
│   ├── useProductsByList.ts          — Fetch products in a list
│   ├── usePinnedProducts.ts          — Fetch top products across all lists
│   ├── useProductDetail.ts           — Fetch single product details
│   ├── useProductLinkScraper.ts      — Product link metadata extraction hook
│   └── useProductActions.ts          — Create, update, delete, pin, reorder
├── types/
│   └── index.ts              — TypeScript interfaces (ProductList, RecommendedProduct, ScraperResult)
├── utils/
│   ├── categoryUtils.ts      — Category slug generation and mappings
│   └── productHelpers.ts     — Image URL builders, currency formatters, data transformers
└── index.ts                  — Public exports (components, hooks, types)
```

### Directory Explanations

**api/**
- `query.ts`: GraphQL queries (getProductLists, getProductsByList, getProductDetail, getPublicProducts, getTopProducts, getProductsByCategory)
- `mutation.ts`: GraphQL mutations (createProductList, updateProductList, deleteProductList, createRecommendedProduct, updateRecommendedProduct, deleteRecommendedProduct, pinProduct, reorderProducts, publishProductList)

**components/dashboard/**
- `ProductsHome.tsx`: Dashboard landing showing lists, Top Products strip, create list modal.
- `ProductListView.tsx`: Detailed view of a single list. Contains **Recommendations** tab (table/list rows with drag handles, pin toggle, ⋮ menu) and **Manage** tab (Delete/Edit/Publish settings, sharing URL and QR code card).
- `AddProductPage.tsx`: Full-page add/edit flow. Contains a retail link scraper input. Pasting a link triggers `useProductLinkScraper` to populate Title, Description, Brand, Price, Currency, and primary image. Creator inputs specifications (dynamic key-value grid), personal notes (Tiptap), user rating (1-10 stars), custom affiliate link, and photo uploads.
- `TopProductsManager.tsx`: Slide-up bottom-sheet modal. Lets creators manage up to 15 pinned products, change display headers, and drag-and-drop to reorder pins.

**components/public/**
- `PublicProducts.tsx`: Landing page for a creator's products (featured lists, carousels, category cards).
- `ProductCarouselRow.tsx`: Horizontal scrollable row displaying `ProductCard` items.
- `ProductCard.tsx`: Product image with brand, title, rating, price, and affiliate buy tag.
- `TopProductsHero.tsx`: Desktop showcase for top products featuring active product hero layout (high-res image, brand, title, price, recommendation text, and specifications list) and active thumbnail selectors.
- `TopProductsMobileHero.tsx`: Mobile card stack layout allowing swipe gestures to browse pinned products.
- `ProductDetailModal.tsx`: Slide-up overlay showing image gallery, brand, title, price badge, specs grid, buy button (with affiliate), creator's note, and source list.

**hooks/**
- `useProductLists.ts`, `useProductsByList.ts`, `usePinnedProducts.ts`, `useProductDetail.ts`, `useProductActions.ts`: Apollo Client query and mutation wrappers.
- `useProductLinkScraper.ts`: Triggerable hook calling a backend REST scraper endpoint (`/api/products/scrape-link?url=...`) returning page title, description, price, currency, brand, and images.

**types/index.ts**
```typescript
export interface ProductList {
  id: string;
  name: string;
  slug: string;
  description: string;
  published: boolean;
  creatorId: string;
  products: RecommendedProduct[];
  topProductsHeading: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecommendedProduct {
  id: string;
  listId: string;
  productUrl: string;
  title: string;
  brand?: string;
  price?: number;
  currency?: string; // 'USD', 'EUR', etc.
  buyUrl?: string; // custom affiliate link
  logoUrl: string; // S3 URL for main product image
  description: string;
  specifications: Record<string, string>; // e.g. {"Color": "Space Grey", "Weight": "1.2kg"}
  user_recommendation_note?: any;
  user_rating?: number;
  isPinned: boolean;
  order: number;
  pinOrder?: number;
  images: string[]; // S3 URLs
  createdAt: string;
}

export interface ScraperResult {
  title: string;
  description: string;
  brand?: string;
  price?: number;
  currency?: string;
  logoUrl: string;
  images: string[];
}
```

## 2. Shared Component Integrations

### src/components/DashboardSidebar.tsx
Update the sidebar to include the "Products" tab.
```typescript
interface DashboardSidebarProps {
  currentCategory: 'places' | 'movies' | 'books' | 'games' | 'apps' | 'products';
  onCategoryChange: (category: 'places' | 'movies' | 'books' | 'games' | 'apps' | 'products') => void;
}
```

### src/components/CategoryCards.tsx
Add "Products" to the mobile categories dashboard landing grid.

## 3. Routes & Navigation

Update routes in `src/routes.tsx` (or main Router file):
- Creator Dashboard:
  - `/dashboard/products` -> `ProductsHome`
  - `/dashboard/products/:listId` -> `ProductListView`
  - `/dashboard/products/:listId/new` -> `AddProductPage`
  - `/dashboard/products/:listId/:productId/edit` -> `AddProductPage`
- Public Profile:
  - `/:username/products` -> `PublicProducts`
  - `/:username/products/:listSlug` -> `PublicProductList`
  - `/:username/products/category/:categorySlug` -> `PublicProductCategory`
```
