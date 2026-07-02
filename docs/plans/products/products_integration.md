---
Feature: products
Doc type: integration
Status: draft
Created: 2026-07-02
Last updated: 2026-07-02
Updated by: agent
Depends on: products_architecture.md, products_api_contract.md
---

# Products — Integration Guide

A step-by-step implementation guide for developers setting up the Products feature.

---

## Phase 1: Strapi Schema & Backend Setup

### 1. Create Strapi Collections
Using the Strapi Content-Type Builder, create the three collections described in `products_schema.md`:
- `ProductList` (singular ID: `product-list`, plural: `product-lists`)
- `RecommendedProduct` (singular ID: `recommended-product`, plural: `recommended-products`)
- `Product_Category` (singular ID: `product-category`, plural: `product-categories`)

### 2. Implement the Product Link Scraper Endpoint
In your Strapi backend project, create the link crawler endpoint.

**Dependencies:** `npm install cheerio node-fetch`

Create the controller `src/api/recommended-product/controllers/scraper.js`:
```javascript
const fetch = require('node-fetch');
const cheerio = require('cheerio');

module.exports = {
  async scrape(ctx) {
    const { url } = ctx.query;
    if (!url) return ctx.badRequest('URL query parameter is required');

    try {
      const response = await fetch(url, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });
      const html = await response.text();
      const $ = cheerio.load(html);

      let title = $('meta[property="og:title"]').attr('content') || $('title').text() || '';
      let description = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '';
      let brand = $('meta[property="product:brand"]').attr('content') || '';
      let price = null;
      let currency = 'USD';
      let logoUrl = $('meta[property="og:image"]').attr('content') || '';
      let images = [];

      // Attempt parsing JSON-LD schema for product details
      $('script[type="application/ld+json"]').each((_, elem) => {
        try {
          const data = JSON.parse($(elem).html());
          const product = data['@graph'] ? data['@graph'].find(item => item['@type'] === 'Product') : data;
          if (product && product['@type'] === 'Product') {
            title = product.name || title;
            description = product.description || description;
            brand = product.brand?.name || product.brand || brand;
            
            if (product.offers) {
              const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
              price = parseFloat(offer.price || offer.lowPrice) || price;
              currency = offer.priceCurrency || currency;
            }
            if (product.image) {
              images = Array.isArray(product.image) ? product.image : [product.image];
              logoUrl = images[0] || logoUrl;
            }
          }
        } catch (e) {
          // ignore parsing error for this schema tag
        }
      });

      if (images.length === 0 && logoUrl) {
        images = [logoUrl];
      }

      ctx.body = {
        success: true,
        data: {
          title: title.trim(),
          description: description.trim(),
          brand: brand.trim(),
          price,
          currency,
          logoUrl,
          images
        }
      };
    } catch (err) {
      ctx.send({ success: false, error: err.message });
    }
  }
};
```

Bind this controller to `GET /api/products/scrape-link` route in your router config.

---

## Phase 2: Frontend GraphQL & Hooks

1. **GraphQL queries**: Write GQL queries to `src/features/Products/api/query.ts` conforming to `products_api_contract.md`.
2. **GraphQL mutations**: Write GQL mutations to `src/features/Products/api/mutation.ts`.
3. **Register Hooks**: Create `useProductLists`, `useProductsByList`, `usePinnedProducts`, and `useProductActions` wrapping Apollo client queries and mutations.
4. **Link Scraper Hook**: Create `useProductLinkScraper` containing the fetch action:
```typescript
import { useState } from 'react';
import axios from 'axios';

export function useProductLinkScraper() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrape = async (url: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`/api/products/scrape-link?url=${encodeURIComponent(url)}`);
      return response.data;
    } catch (err: any) {
      setError(err.message || 'Failed to extract product info');
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
   - Update `src/components/DashboardSidebar.tsx` to add the Products option.
   - Update `src/components/CategoryCards.tsx` (mobile menu).
2. **Products Home (`ProductsHome.tsx`)**:
   - Query all `ProductList` items via `useProductLists`.
   - Render a list of cards with status badges (Draft/Published) and edit navigation.
   - Add a inline `CreateListModal` for creation.
3. **Product List View (`ProductListView.tsx`)**:
   - Render lists of `RecommendedProduct` items.
   - Drag-to-reorder handler using `@hello-pangea/dnd`.
   - "Manage" tab with Edit Slug, Delete List, and visibility Toggle (Switch).
4. **Add/Edit Product Page (`AddProductPage.tsx`)**:
   - Link paste card input field with "Fetch Product Data" button.
   - Form fields: Title, Brand, Description, Price, Currency, Custom buy/affiliate link.
   - **Dynamic Specifications Editor**: A key-value table builder allowing creators to click "+ Add Spec" and enter custom properties (e.g. "Keyboard Layout": "75%"). Saves as a JSON mapping in Strapi.
   - S3 drag-and-drop area for product main image & gallery photos.
   - Rich Text recommendation card (Tiptap) and 1-10 slider rating.

---

## Phase 4: Public Page & Details

1. **Routing**:
   - Add `/:username/products` route loading `PublicProducts.tsx`.
   - Add `/:username/products/:listSlug` route loading `PublicProductList.tsx`.
   - Add `/:username/products/category/:categorySlug` route loading `PublicProductCategory.tsx`.
2. **Public Screen Layout**:
   - Header with creator avatar and products count.
   - Pinned Top Products Hero carousel.
   - Lists rows represented as horizontal scrollable card rows.
   - CategoryBrowse section showing square category tiles at the page footer.
3. **Slide-up Detail Modal (`ProductDetailModal.tsx`)**:
   - Modal background blur effect (`backdrop-blur-sm`).
   - Left column: Product image, Brand, title, formatted price (e.g. "$79.99"), creator's rating, download/buy action button (includes affiliate tracking).
   - Right column: Creator recommendation notes and a specs table showing keys and values.
   - Bottom row: Scrollable product gallery images.
