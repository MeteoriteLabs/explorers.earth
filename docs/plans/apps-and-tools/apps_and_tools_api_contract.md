---
Feature: apps-and-tools
Doc type: api_contract
Status: draft
Created: 2026-07-02
Last updated: 2026-07-02
Updated by: agent
Depends on: apps_and_tools_schema.md
---

# Apps & Tools — API Contract

GraphQL queries, mutations, and REST endpoints for the Apps & Tools feature.

---

## 1. GraphQL Queries

### Get All App Lists for Creator (Dashboard)
```graphql
query GetAppLists($accountId: ID!) {
  appLists(filters: { account: { id: { eq: $accountId } } }, sort: "display_order:asc") {
    data {
      id
      attributes {
        name
        slug
        description
        published
        display_order
        top_apps_heading
        cover_image {
          data {
            attributes {
              url
            }
          }
        }
        recommended_apps {
          data {
            id
            attributes {
              title
              logo_url
              platforms
              price_tier
              is_pinned
            }
          }
        }
      }
    }
  }
}
```

### Get App List with Apps (Dashboard / Public Grid)
```graphql
query GetAppListDetail($username: String!, $slug: String!) {
  appLists(
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
        top_apps_heading
        recommended_apps(sort: "display_order:asc") {
          data {
            id
            attributes {
              title
              logo_url
              description
              app_url
              developer
              platforms
              price_tier
              download_url
              user_rating
              is_pinned
              screenshots
            }
          }
        }
      }
    }
  }
}
```

### Get Pinned Apps (Top Apps)
```graphql
query GetPinnedApps($username: String!) {
  recommendedApps(
    filters: { 
      is_pinned: { eq: true }, 
      app_list: { account: { username: { eq: $username } } }
    },
    sort: "pin_order:asc"
  ) {
    data {
      id
      attributes {
        title
        logo_url
        description
        app_url
        developer
        platforms
        price_tier
        download_url
        user_rating
        screenshots
        app_list {
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

### Create App List
```graphql
mutation CreateAppList($input: AppListInput!) {
  createAppList(data: $input) {
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

### Create Recommended App
```graphql
mutation CreateRecommendedApp($input: RecommendedAppInput!) {
  createRecommendedApp(data: $input) {
    data {
      id
      attributes {
        title
        app_url
        display_order
      }
    }
  }
}
```

### Update Recommended App
```graphql
mutation UpdateRecommendedApp($id: ID!, $input: RecommendedAppInput!) {
  updateRecommendedApp(id: $id, data: $input) {
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

### Reorder Apps in List
```graphql
mutation ReorderAppsInList($listId: ID!, $orders: [AppOrderInput!]!) {
  reorderApps(listId: $listId, orders: $orders) {
    success
    message
  }
}
```

---

## 3. Metadata Scraper REST API

To enable pasting a URL and auto-enriching app details, the backend exposes a REST endpoint.

### Scrape URL Metadata
- **Endpoint:** `GET /api/apps/scrape-url`
- **Headers:** `Authorization: Bearer <token>`
- **Query Parameters:**
  - `url` (String, Required) — The website URL of the app to crawl (e.g., `https://notion.so`)

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "title": "Notion – One workspace. Every team.",
    "description": "A new tool that blends your everyday work apps into one. It's the all-in-one workspace for you and your team.",
    "logoUrl": "https://notion.so/images/logo-ios.png",
    "developer": "Notion Labs, Inc.",
    "ogImage": "https://notion.so/images/meta/default.png",
    "favicon": "https://notion.so/images/favicon.ico"
  }
}
```

#### Error Response (`400 Bad Request` or `500 Internal Server Error`)
```json
{
  "success": false,
  "error": {
    "code": "SCRAPE_FAILED",
    "message": "Unable to connect or extract metadata from the provided URL. Please fill in details manually."
  }
}
```
