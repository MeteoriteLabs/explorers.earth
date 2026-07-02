---
Feature: products
Doc type: api_contract
Status: draft
Created: 2026-07-02
Last updated: 2026-07-02
Updated by: agent
Depends on: products_schema.md
---

# Products — API Contract

GraphQL queries, mutations, and REST endpoints for the Products feature.

---

## 1. GraphQL Queries

### Get All Product Lists for Creator (Dashboard)
```graphql
query GetProductLists($accountId: ID!) {
  productLists(filters: { account: { id: { eq: $accountId } } }, sort: "display_order:asc") {
    data {
      id
      attributes {
        name
        slug
        description
        published
        display_order
        top_products_heading
        cover_image {
          data {
            attributes {
              url
            }
          }
        }
        recommended_products {
          data {
            id
            attributes {
              title
              brand
              price
              currency
              logo_url
              is_pinned
            }
          }
        }
      }
    }
  }
}
```

### Get Product List with Products (Dashboard / Public Grid)
```graphql
query GetProductListDetail($username: String!, $slug: String!) {
  productLists(
    filters: { 
      slug: { eq: $slug }, 
      account: { username: { eq: $username } } 
    }
  ) {
    data {
      id
      attributes {
        name
        slug
        description
        published
        top_products_heading
        recommended_products(sort: "display_order:asc") {
          data {
            id
            attributes {
              title
              brand
              price
              currency
              buy_url
              logo_url
              description
              specifications
              user_rating
              is_pinned
              images
            }
          }
        }
      }
    }
  }
}
```

### Get Pinned Products (Top Products)
```graphql
query GetPinnedProducts($username: String!) {
  recommendedProducts(
    filters: { 
      is_pinned: { eq: true }, 
      product_list: { account: { username: { eq: $username } } }
    },
    sort: "pin_order:asc"
  ) {
    data {
      id
      attributes {
        title
        brand
        price
        currency
        buy_url
        logo_url
        description
        specifications
        user_rating
        images
        product_list {
          data {
            attributes {
              name
            }
          }
        }
      }
    }
  }
}
```

---

## 2. GraphQL Mutations

### Create Product List
```graphql
mutation CreateProductList($input: ProductListInput!) {
  createProductList(data: $input) {
    data {
      id
      attributes {
        name
        slug
        description
      }
    }
  }
}
```

### Create Recommended Product
```graphql
mutation CreateRecommendedProduct($input: RecommendedProductInput!) {
  createRecommendedProduct(data: $input) {
    data {
      id
      attributes {
        title
        brand
        price
        display_order
      }
    }
  }
}
```

### Update Recommended Product
```graphql
mutation UpdateRecommendedProduct($id: ID!, $input: RecommendedProductInput!) {
  updateRecommendedProduct(id: $id, data: $input) {
    data {
      id
      attributes {
        title
        user_recommendation_note
        user_rating
        is_pinned
      }
    }
  }
}
```

### Reorder Products in List
```graphql
mutation ReorderProductsInList($listId: ID!, $orders: [ProductOrderInput!]!) {
  reorderProducts(listId: $listId, orders: $orders) {
    success
    message
  }
}
```

---

## 3. Product Link Scraper REST API

To enable pasting a product link and auto-enriching specifications and details, the backend exposes a REST endpoint.

### Scrape Product Link
- **Endpoint:** `GET /api/products/scrape-link`
- **Headers:** `Authorization: Bearer <token>`
- **Query Parameters:**
  - `url` (String, Required) — The retail link (Amazon, Shopify, Etsy, Nike, etc.) to crawl.

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "title": "Keychron K2 Version 2 Wireless Mechanical Keyboard",
    "description": "A 75% layout wireless mechanical keyboard with Gateron switches, RGB backlighting, and a 4000 mAh battery.",
    "brand": "Keychron",
    "price": 79.99,
    "currency": "USD",
    "logoUrl": "https://m.media-amazon.com/images/I/61H5+S-92FL._AC_SL1500_.jpg",
    "images": [
      "https://m.media-amazon.com/images/I/61H5+S-92FL._AC_SL1500_.jpg",
      "https://m.media-amazon.com/images/I/71wLpWzV4BL._AC_SL1500_.jpg"
    ]
  }
}
```

#### Error Response (`400 Bad Request` or `500 Internal Server Error`)
```json
{
  "success": false,
  "error": {
    "code": "SCRAPE_FAILED",
    "message": "Failed to parse product specifications. You can input fields manually."
  }
}
```
