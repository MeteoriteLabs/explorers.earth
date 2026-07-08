---
Feature: apps-and-tools
Doc type: schema
Status: draft
Created: 2026-07-02
Last updated: 2026-07-02
Updated by: agent
Depends on: apps_and_tools_decisions.md
---

# Apps & Tools — Strapi Schema

Complete data model for the Apps & Tools feature. These collections need to be created in the Strapi admin panel (Content-Type Builder).

> [!IMPORTANT]
> Since we use S3 storage, remember to always structure paths to avoid collision and clean up orphaned files upon deletion.

---

## Collection 1: AppList

**Purpose:** A themed list/stack of apps and digital tools recommended by a user (e.g., "Developer Productivity", "My Travel Apps").

**API ID (singular):** `app-list`
**API ID (plural):** `app-lists`

### Fields

| Field Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `List_Name` | Short text | Yes | — | Display name of the list (e.g., "Design Stack") |
| `list_description` | Long text | No | — | Creator's description of what this list is about |
| `slug` | Short text | Yes | Auto | URL-safe slug. Auto-generated from List_Name, editable. Unique per user. |
| `Visibility` | Boolean | Yes | `false` | Published (true) = visible on public profile. Draft (false) = hidden. |
| `cover_image` | Media (single) | No | — | List banner image. Falls back to first app's logo if blank. |
| `display_order` | Integer | No | `0` | Vertical display position on public page. |
| `top_apps_heading` | Short text | No | "Top Apps" | Custom display name for the Pinned Apps section |
| `account` | Relation (Many-to-One) | Yes | — | Relates to user Account. Many AppLists belong to one Account. |
| `recommended_apps` | Relation (One-to-Many) | No | — | Apps in this list. One AppList has many RecommendedApps. |

---

## Collection 2: RecommendedApp

**Purpose:** A single app or tool recommendation with scraped/manual metadata and the creator's note.

**API ID (singular):** `recommended-app`
**API ID (plural):** `recommended-apps`

### Fields

| Field Name | Type | Required | Default | Description |
|---|---|---|---|---|
| **App Metadata** | | | | |
| `app_url` | Short text | Yes | — | Homepage or official URL of the app (e.g. `https://figma.com`) |
| `title` | Short text | Yes | — | App/tool name |
| `description` | Long text | No | — | Brief synopsis (from meta description or manual entry) |
| `logo_url` | Short text | Yes | — | S3 URL of the downloaded app logo/icon |
| `developer` | Short text | No | — | Developer or company name |
| `platforms` | JSON | Yes | `[]` | Array of platform strings: `["macOS", "Windows", "Web"]` |
| `price_tier` | Enumeration | Yes | `Freemium` | `["Free", "Freemium", "Paid", "Subscription"]` |
| `download_url` | Short text | No | — | Direct download/purchase URL, supporting affiliate links |
| **Creator Content** | | | | |
| `user_recommendation_note` | Rich text | No | — | Creator's personal note (Tiptap blocks) |
| `user_rating` | Integer | No | — | User's 1-10 rating (consistent with other categories) |
| `is_pinned` | Boolean | No | `false` | Pinned to Top Apps |
| `pin_order` | Integer | No | `null` | Order index within Top Apps |
| `display_order` | Integer | No | `0` | Order index within the list |
| **Media** | | | | |
| `screenshots` | JSON | No | `[]` | Array of S3 URLs for creator-uploaded or scraped screenshots |
| **Relations** | | | | |
| `app_list` | Relation (Many-to-One) | Yes | — | The AppList this belongs to |
| `app_categories` | Relation (Many-to-Many) | No | — | Links to matched categories (e.g., Productivity, Design) |

### Notes for Strapi Admin
- **S3 Storage Paths:**
  - AppList cover: `{username}/apps/{appListId}/cover/{filename}`
  - RecommendedApp Logo: `{username}/apps/{appListId}/{appId}/logo/{filename}`
  - RecommendedApp Screenshots: `{username}/apps/{appListId}/{appId}/screenshot/{filename}`

---

## Collection 3: App_Category

**Purpose:** Tag-like categories for grouping apps (e.g., Productivity, Developer Tools, Design, Finance).

**API ID (singular):** `app-category`
**API ID (plural):** `app-categories`

### Fields

| Field Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | Short text | Yes | — | Category display name (e.g., "Productivity") |
| `slug` | Short text | Yes | Auto | URL slug (e.g., "productivity") |
| `recommended_apps` | Relation (Many-to-Many) | No | — | Relates to RecommendedApp collection |

---

## Relation Diagram

```
Account (existing)
    │
    ├── 1:N ── AppList
    │              │
    │              ├── 1:N ── RecommendedApp
    │              │              │
    │              │              └── M:M ── App_Category
    │              │
    │              └── (cover_image: Media)
```
