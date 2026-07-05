---
Feature: person
Doc type: api_contract
Status: draft
Created: 2026-07-05
Last updated: 2026-07-05
Updated by: agent
Depends on: person_schema.md
---

# People API Contract

## Overview

The People feature provides lists and curation mechanisms for recommended individuals. The architecture combines:
- **Strapi CMS (GraphQL)**: Manages lists, recommended profiles, relationships, and creator content.
- **Strapi Scraper Controller (REST)**: Handles profile crawling for Instagram and LinkedIn URLs.
- **Apollo Client**: Frontend GraphQL client for queries and mutations.

This document specifies the contracts between the frontend dashboard/public screens and backend services.

---

## 1. GraphQL Queries (Strapi)

All queries use Strapi v4+ GraphQL with `documentId` pattern, filters, pagination, and sorting.

### 1.1 personListsByAccount

**Purpose**: Fetch all person lists for a user account. Used by dashboard People Home and public profile landing.

**Query**:
```graphql
query PersonListsByAccount($accountDocumentId: ID!) {
  personLists(
    filters: { account: { documentId: { eq: $accountDocumentId } } }
    sort: ["display_order:asc"]
    pagination: { limit: 100 }
  ) {
    documentId
    List_Name
    list_description
    slug
    Visibility
    cover_image {
      url
      alternativeText
    }
    display_order
    top_picks_heading
    recommended_people {
      documentId
      name
      username_handle
      headline
      avatar_path
      primary_platform
      is_pinned
    }
    account {
      documentId
      username
    }
  }
}
```

**Variables**:
```typescript
{
  accountDocumentId: string;
}
```

**Response Shape**:
```typescript
interface PersonListsResponse {
  personLists: Array<{
    documentId: string;
    List_Name: string;
    list_description: string | null;
    slug: string;
    Visibility: boolean;
    cover_image: {
      url: string;
      alternativeText: string | null;
    } | null;
    display_order: number;
    top_picks_heading: string | null;
    recommended_people: Array<{
      documentId: string;
      name: string;
      username_handle: string | null;
      headline: string | null;
      avatar_path: string | null;
      primary_platform: string;
      is_pinned: boolean;
    }>;
    account: {
      documentId: string;
      username: string;
    };
  }>;
}
```

---

### 1.2 peopleByList

**Purpose**: Fetch all recommended people in a specific list, sorted by display order. Used by the list view and public page.

**Query**:
```graphql
query PeopleByList($personListDocumentId: ID!) {
  personLists(filters: { documentId: { eq: $personListDocumentId } }) {
    documentId
    List_Name
    list_description
    slug
    Visibility
    recommended_people(sort: ["display_order:asc"]) {
      documentId
      name
      username_handle
      headline
      location
      avatar_path
      primary_platform
      social_urls
      skills_tags
      user_recommendation_note
      user_rating
      is_pinned
      display_order
      Media {
        url
      }
      person_categories {
        documentId
        category_name
      }
    }
  }
}
```

---

### 1.3 pinnedPeopleByAccount

**Purpose**: Fetch all pinned recommended people (Top Picks) across all lists for a user.

**Query**:
```graphql
query PinnedPeopleByAccount($accountDocumentId: ID!) {
  recommendedPeople(
    filters: {
      is_pinned: { eq: true }
      person_list: { account: { documentId: { eq: $accountDocumentId } } }
    }
    sort: ["pin_order:asc"]
  ) {
    documentId
    name
    username_handle
    headline
    location
    avatar_path
    primary_platform
    skills_tags
    user_recommendation_note
    user_rating
    person_list {
      documentId
      List_Name
      slug
    }
  }
}
```

---

### 1.4 peopleBySector

**Purpose**: Fetch people filtered by sector/category name across lists of a user.

**Query**:
```graphql
query PeopleBySector($accountDocumentId: ID!, $categoryName: String!) {
  recommendedPeople(
    filters: {
      person_categories: { category_name: { eq: $categoryName } }
      person_list: { account: { documentId: { eq: $accountDocumentId } }, Visibility: { eq: true } }
    }
    sort: ["display_order:asc"]
  ) {
    documentId
    name
    username_handle
    headline
    avatar_path
    primary_platform
    skills_tags
    person_list {
      documentId
      List_Name
      slug
    }
  }
}
```

---

## 2. GraphQL Mutations (Strapi)

### 2.1 createPersonList / updatePersonList / deletePersonList

**Mutations**:
```graphql
mutation CreatePersonList($data: PersonListInput!) {
  createPersonList(data: $data) {
    documentId
    List_Name
    slug
  }
}

mutation UpdatePersonList($documentId: ID!, $data: PersonListInput!) {
  updatePersonList(documentId: $documentId, data: $data) {
    documentId
    List_Name
    Visibility
  }
}

mutation DeletePersonList($documentId: ID!) {
  deletePersonList(documentId: $documentId) {
    documentId
  }
}
```

---

### 2.2 createRecommendedPerson / updateRecommendedPerson / deleteRecommendedPerson

**Mutations**:
```graphql
mutation CreateRecommendedPerson($data: RecommendedPersonInput!) {
  createRecommendedPerson(data: $data) {
    documentId
    name
    display_order
  }
}

mutation UpdateRecommendedPerson($documentId: ID!, $data: RecommendedPersonInput!) {
  updateRecommendedPerson(documentId: $documentId, data: $data) {
    documentId
    name
    is_pinned
  }
}

mutation DeleteRecommendedPerson($documentId: ID!) {
  deleteRecommendedPerson(documentId: $documentId) {
    documentId
  }
}
```

---

### 2.3 reorderRecommendedPeople

**Purpose**: Bulk-update ordering of profiles in a list after a drag-and-drop operation.

**Mutation**:
```graphql
mutation ReorderRecommendedPeople($orders: [RecommendedPersonOrderInput!]!) {
  reorderPeople(orders: $orders) {
    success
  }
}
```

---

## 3. Profile Scraper API (REST Endpoint)

**Endpoint**: `GET /api/people/scrape-profile`

**Query Parameters**:
- `url`: String (required) - Instagram, LinkedIn, or general profile link

**Response Shapes**:

- **Successful Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "name": "Jane Doe",
    "username": "janedoe",
    "headline": "Lead Product Designer at Figma",
    "avatarUrl": "https://instagram.fccu.cdn.com/v/t51/...",
    "platform": "instagram"
  }
}
```

- **Error Response (200 OK / 400 Bad Request)**:
```json
{
  "success": false,
  "error": "Failed to bypass rate limit / login wall. Please enter profile details manually."
}
```
