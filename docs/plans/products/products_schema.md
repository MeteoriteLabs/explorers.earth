---
Feature: products
Doc type: schema
Status: draft
Created: 2026-07-02
Last updated: 2026-07-02
Updated by: agent
Depends on: products_decisions.md
---

# Products — Strapi Schema

Complete data model for the Products feature. These collections need to be created in the Strapi admin panel (Content-Type Builder).

> [!IMPORTANT]
> Since we use S3 storage, remember to always structure paths to avoid collision and clean up orphaned files upon deletion.

---

## Collection 1: ProductList

**Purpose:** A themed list of product recommendations created by a user (e.g., "Desk Setup Gear", "Vlogging Kit").

**API ID (singular):** `product-list`
**API ID (plural):** `product-lists`

### Fields

| Field Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `List_Name` | Short text | Yes | — | Display name of the list (e.g., "My Backpack Essentials") |
| `list_description` | Long text | No | — | Creator's description of what this list is about |
| `slug` | Short text | Yes | Auto | URL-safe slug. Auto-generated from List_Name, editable. Unique per user. |
| `Visibility` | Boolean | Yes | `false` | Published (true) = visible on public profile. Draft (false) = hidden. |
| `cover_image` | Media (single) | No | — | List banner image. Falls back to first product's cover image if blank. |
| `display_order` | Integer | No | `0` | Vertical display position on public page. |
| `top_products_heading` | Short text | No | "Top Products" | Custom display name for the Pinned Products section |
| `account` | Relation (Many-to-One) | Yes | — | Relates to user Account. Many ProductLists belong to one Account. |
| `recommended_products` | Relation (One-to-Many) | No | — | Products in this list. One ProductList has many RecommendedProducts. |

---

## Collection 2: RecommendedProduct

**Purpose:** A single product recommendation with scraped/manual retail details and the creator's note.

**API ID (singular):** `recommended-product`
**API ID (plural):** `recommended-products`

### Fields

| Field Name | Type | Required | Default | Description |
|---|---|---|---|---|
| **Product Metadata** | | | | |
| `product_url` | Short text | Yes | — | Original retail URL of the product (e.g., Amazon link) |
| `title` | Short text | Yes | — | Product name |
| `brand` | Short text | No | — | Brand/Manufacturer (e.g. Keychron, Sony) |
| `price` | Decimal | No | — | Product cost (e.g., 79.99) |
| `currency` | Short text | No | `"USD"` | 3-letter currency code (e.g., USD, EUR, GBP) |
| `buy_url` | Short text | No | — | Customized affiliate/referral link for visitor redirection |
| `logo_url` | Short text | Yes | — | S3 URL of the downloaded main product cover image |
| `description` | Long text | No | — | Brief synopsis (from meta tags or manual entry) |
| `specifications` | JSON | No | `{}` | Dynamic key-value pairs of product specs: `{"Color": "Space Grey", "Weight": "1.2kg"}` |
| **Creator Content** | | | | |
| `user_recommendation_note` | Rich text | No | — | Creator's personal note (Tiptap blocks) |
| `user_rating` | Integer | No | — | User's 1-10 rating (consistent with other categories) |
| `is_pinned` | Boolean | No | `false` | Pinned to Top Products |
| `pin_order` | Integer | No | `null` | Order index within Top Products |
| `display_order` | Integer | No | `0` | Order index within the list |
| **Media** | | | | |
| `images` | JSON | No | `[]` | Array of S3 URLs for creator-uploaded or scraped product photos |
| **Relations** | | | | |
| `product_list` | Relation (Many-to-One) | Yes | — | The ProductList this belongs to |
| `product_categories` | Relation (Many-to-Many) | No | — | Links to matched categories (e.g., Desk Setup, Tech) |

### Notes for Strapi Admin
- **S3 Storage Paths:**
  - ProductList cover: `{username}/products/{productListId}/cover/{filename}`
  - RecommendedProduct Image: `{username}/products/{productListId}/{productId}/logo/{filename}`
  - RecommendedProduct Gallery: `{username}/products/{productListId}/{productId}/gallery/{filename}`

---

## Collection 3: Product_Category

**Purpose:** Grouping categories for products (e.g., Desk Setup, Photography, Audio, Travel Gear, Tech, Clothing).

**API ID (singular):** `product-category`
**API ID (plural):** `product-categories`

### Fields

| Field Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | Short text | Yes | — | Category display name (e.g., "Desk Setup") |
| `slug` | Short text | Yes | Auto | URL slug (e.g., "desk-setup") |
| `recommended_products` | Relation (Many-to-Many) | No | — | Relates to RecommendedProduct collection |

---

## Relation Diagram

```
Account (existing)
    │
    ├── 1:N ── ProductList
    │              │
    │              ├── 1:N ── RecommendedProduct
    │              │              │
    │              │              └── M:M ── Product_Category
    │              │
    │              └── (cover_image: Media)
```
