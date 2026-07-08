---
Feature: products
Doc type: tasks
Status: draft
Created: 2026-07-02
Last updated: 2026-07-02
Updated by: agent
Depends on: products_prd.md, products_architecture.md
---

# Products Implementation Tasks

Checklist of concrete items for developers implementing the Products feature.

## Phase 1: Database & Strapi Config
- [ ] Create Strapi collection `ProductList` with fields matching schema.
- [ ] Create Strapi collection `RecommendedProduct` with fields matching schema.
- [ ] Create Strapi collection `Product_Category` with fields matching schema.
- [ ] Configure S3 media folders: `{username}/products/{listId}/` for covers and gallery.
- [ ] Update public and authenticated API roles in Strapi settings to enable finds and mutations.
- [ ] Create backend controller route `GET /api/products/scrape-link` and implement JSON-LD/Open Graph parsing.

## Phase 2: GraphQL API Layer
- [ ] Write GraphQL queries `GetProductLists`, `GetProductListDetail`, `GetPinnedProducts` in `api/query.ts`.
- [ ] Write GraphQL mutations `CreateProductList`, `UpdateProductList`, `CreateRecommendedProduct`, `UpdateRecommendedProduct`, `ReorderProductsInList` in `api/mutation.ts`.
- [ ] Generate typescript typings for GraphQL responses.

## Phase 3: Custom React Hooks
- [ ] Implement `useProductLists` to fetch lists under user Account.
- [ ] Implement `useProductsByList` to query list details.
- [ ] Implement `usePinnedProducts` for Top Products.
- [ ] Implement `useProductLinkScraper` for page-crawling pre-fill logic.
- [ ] Implement `useProductActions` wrapping Apollo mutations.

## Phase 4: Core & Routing
- [ ] Update `DashboardSidebar.tsx` to add "Products" item.
- [ ] Update `CategoryCards.tsx` (mobile) to include "Products" grid option.
- [ ] Configure frontend route mappings in `src/routes.tsx` for `/dashboard/products` and public `/:username/products` paths.

## Phase 5: Creator Dashboard Pages
- [ ] Build `ProductsHome.tsx` view with lists grids and `CreateListModal`.
- [ ] Build `ProductListView.tsx` showing product rows with reorder drag handles and a settings Manage tab.
- [ ] Build `AddProductPage.tsx` showing the link scraper input, auto-enrichment loaders, and form fields.
- [ ] Build key-value dynamic specifications editor table.
- [ ] Build `TopProductsManager.tsx` modal for managing the featured row.

## Phase 6: Public Profile Pages
- [ ] Build `PublicProducts.tsx` landing page.
- [ ] Build `TopProductsHero.tsx` (desktop slideshow) and `TopProductsMobileHero.tsx` (mobile stack card).
- [ ] Build horizontal `ProductCarouselRow.tsx` for lists.
- [ ] Build compact `ProductCard.tsx` showing thumbnail, rating, price, brand, and affiliate buy tag.
- [ ] Build details `ProductDetailModal.tsx` displaying full description, note, specifications table, and photos gallery.
- [ ] Build grid sub-views `PublicProductList.tsx` and `PublicProductCategory.tsx`.

## Phase 7: Polish & Internationalization
- [ ] Add translation strings to `locales/en.json` (under "products.*" prefix).
- [ ] Set up loading skeletons for all grids, cards, and pages.
- [ ] Verify responsivity from mobile (360px) up to 4K displays.
